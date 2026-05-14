/**
 * Baileys Session Manager
 * 
 * Manages WhatsApp session lifecycle including:
 * - QR code generation and pairing
 * - Session state serialization/deserialization
 * - Connection event handling
 * - Multi-device protocol support
 * - Reconnection with exponential backoff
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';
import qrcode from 'qrcode-terminal';

/**
 * BaileysSession class manages a single WhatsApp connection
 */
export class BaileysSession {
  constructor(sessionId, logger, eventCallback) {
    this.sessionId = sessionId;
    this.logger = logger.child({ session_id: sessionId });
    this.eventCallback = eventCallback; // Callback to send events to parent process
    
    this.sock = null;
    this.store = null;
    this.authState = null;
    this.qrCode = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    const configuredMaxReconnectAttempts = Number.parseInt(process.env.WA_MAX_RECONNECT_ATTEMPTS || '0', 10);
    this.maxReconnectAttempts = Number.isFinite(configuredMaxReconnectAttempts) && configuredMaxReconnectAttempts > 0
      ? configuredMaxReconnectAttempts
      : null; // null = keep reconnecting until logged out or manually disconnected
    const configuredMaxReconnectDelay = Number.parseInt(process.env.WA_MAX_RECONNECT_DELAY_MS || '300000', 10);
    this.maxReconnectDelay = Number.isFinite(configuredMaxReconnectDelay) && configuredMaxReconnectDelay > 0
      ? configuredMaxReconnectDelay
      : 300000;
    this.reconnectDelays = [5000, 15000, 45000, 120000, this.maxReconnectDelay]; // Capped backoff
    this.reconnectTimer = null;
    
    // Session storage directory
    this.authDir = path.join(process.cwd(), 'sessions', sessionId);
    
    // Message retry cache
    this.msgRetryCounterCache = new Map();
  }

  /**
   * Initialize session with optional credentials
   * @param {Object|null} credentials - Serialized session credentials
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(credentials = null) {
    try {
      this.logger.info('Initializing session');

      // Ensure auth directory exists
      await fs.mkdir(this.authDir, { recursive: true });

      // Prefer the local multi-file auth directory. The DB snapshot is only a
      // fallback for a fresh machine; using an older snapshot can overwrite a
      // newer valid session and force QR pairing again.
      let hasLocalCredentials = false;
      try {
        await fs.access(path.join(this.authDir, 'creds.json'));
        hasLocalCredentials = true;
      } catch {
        hasLocalCredentials = false;
      }

      // Restore credentials if provided and no local session exists.
      if (credentials && !hasLocalCredentials) {
        await this.deserializeCredentials(credentials);
      } else if (hasLocalCredentials) {
        this.logger.info('Using local auth state');
      }

      // Load auth state from directory
      this.authState = await useMultiFileAuthState(this.authDir);

      // Get latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.info({ version, isLatest }, 'Using Baileys version');

      // Create WhatsApp socket
      await this.createSocket();

      return {
        success: true,
        requires_pairing: !this.authState.state.creds?.registered,
        session_id: this.sessionId
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize session');
      throw error;
    }
  }

  /**
   * Create WhatsApp socket with Baileys
   */
  async createSocket() {
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }, pino.destination(2)),
      printQRInTerminal: false, // We'll handle QR code ourselves
      auth: {
        creds: this.authState.state.creds,
        keys: makeCacheableSignalKeyStore(this.authState.state.keys, pino({ level: 'silent' }, pino.destination(2)))
      },
      msgRetryCounterCache: this.msgRetryCounterCache,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      browser: ['Tridjaya.com', 'Chrome', '120.0.0'] // Custom browser identifier
    });

    // Register event handlers
    this.registerEventHandlers();

    this.logger.info('WhatsApp socket created');
  }

  /**
   * Register Baileys event handlers
   */
  registerEventHandlers() {
    // Connection updates (QR code, connection status, etc.)
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Credentials update (save session state)
    this.sock.ev.on('creds.update', async () => {
      await this.handleCredsUpdate();
    });

    // Incoming messages
    this.sock.ev.on('messages.upsert', async (messageUpdate) => {
      await this.handleMessagesUpsert(messageUpdate);
    });

    // Message status updates (sent, delivered, read)
    this.sock.ev.on('messages.update', async (updates) => {
      await this.handleMessagesUpdate(updates);
    });

    // Presence updates (typing, online, offline)
    this.sock.ev.on('presence.update', async (presence) => {
      this.logger.debug({ presence }, 'Presence update');
    });
  }

  /**
   * Handle connection updates
   */
  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    // QR code received - send to parent process
    if (qr) {
      this.qrCode = qr;
      this.logger.info('QR code generated');
      
      // Print QR to terminal for debugging
      if (process.env.PRINT_QR === 'true') {
        qrcode.generate(qr, { small: true });
      }

      // Notify parent process
      this.sendEvent('qr_generated', { qr, session_id: this.sessionId });
    }

    // Connection status changed
    if (connection) {
      this.logger.info({ connection }, 'Connection status changed');

      if (connection === 'open') {
        this.connected = true;
        this.reconnectAttempts = 0; // Reset reconnect counter
        this.qrCode = null; // Clear QR code
        await this.handleCredsUpdate();
        
        this.logger.info('Connection established');
        this.sendEvent('connected', {
          session_id: this.sessionId,
          phone: this.sock.user?.id?.split(':')[0] || null
        });
      } else if (connection === 'close') {
        this.connected = false;
        
        // Handle disconnection
        await this.handleDisconnection(lastDisconnect);
      }
    }
  }

  /**
   * Handle disconnection with reconnection logic
   */
  async handleDisconnection(lastDisconnect) {
    const statusCode = lastDisconnect?.error instanceof Boom
      ? lastDisconnect.error.output?.statusCode
      : null;
    const shouldReconnect = lastDisconnect?.error
      ? (lastDisconnect.error instanceof Boom
          ? statusCode !== DisconnectReason.loggedOut
          : true)
      : true;
    const hasReconnectAttemptsRemaining = this.maxReconnectAttempts === null
      || this.reconnectAttempts < this.maxReconnectAttempts;

    this.logger.info({
      reason: lastDisconnect?.error?.message,
      shouldReconnect,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts ?? 'unlimited'
    }, 'Connection closed');

    if (shouldReconnect && hasReconnectAttemptsRemaining) {
      const delay = Math.min(
        this.reconnectDelays[Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1)] || this.maxReconnectDelay,
        this.maxReconnectDelay
      );
      this.reconnectAttempts++;

      this.logger.info({ delay, attempt: this.reconnectAttempts }, 'Scheduling reconnection');
      
      this.sendEvent('reconnecting', {
        session_id: this.sessionId,
        attempt: this.reconnectAttempts,
        max_attempts: this.maxReconnectAttempts ?? 0,
        delay_ms: delay
      });

      // Schedule reconnection
      this.reconnectTimer = setTimeout(async () => {
        try {
          this.logger.info('Attempting reconnection');
          await this.createSocket();
        } catch (error) {
          this.logger.error({ error: error.message }, 'Reconnection failed');
          this.sendEvent('reconnect_failed', {
            session_id: this.sessionId,
            error: error.message
          });
          await this.handleDisconnection({ error });
        }
      }, delay);
    } else {
      // Max reconnect attempts reached by explicit config, or WhatsApp logged the session out.
      const reason = lastDisconnect?.error instanceof Boom
        ? statusCode === DisconnectReason.loggedOut
          ? 'logged_out'
          : 'connection_failed'
        : 'max_reconnect_attempts';

      this.logger.warn({ reason }, 'Session disconnected permanently');
      
      this.sendEvent('disconnected', {
        session_id: this.sessionId,
        reason,
        reconnect_attempts: this.reconnectAttempts
      });
    }
  }

  /**
   * Handle credentials update - save session state
   */
  async handleCredsUpdate() {
    try {
      await this.authState.saveCreds();
      this.logger.debug('Credentials updated');
      
      // Serialize and send to parent for database storage
      const serialized = await this.serializeCredentials();
      this.sendEvent('creds_updated', {
        session_id: this.sessionId,
        credentials: serialized
      });
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to handle creds update');
    }
  }

  /**
   * Handle incoming messages
   */
  async handleMessagesUpsert(messageUpdate) {
    const { messages, type } = messageUpdate;

    for (const msg of messages) {
      // Skip if message is from self
      if (msg.key.fromMe) continue;

      // Extract message details
      const messageData = {
        session_id: this.sessionId,
        message_id: msg.key.id,
        sender: msg.key.remoteJid,
        timestamp: msg.messageTimestamp,
        type: type, // 'notify' or 'append'
        text: this.extractMessageText(msg),
        media_url: null, // TODO: Handle media messages
        is_group: msg.key.remoteJid.endsWith('@g.us')
      };

      this.logger.info({ messageData }, 'Incoming message');
      
      // Send to parent process
      this.sendEvent('message_received', messageData);
    }
  }

  /**
   * Handle message status updates (sent, delivered, read)
   */
  async handleMessagesUpdate(updates) {
    for (const update of updates) {
      const statusData = {
        session_id: this.sessionId,
        message_id: update.key.id,
        recipient: update.key.remoteJid,
        status: null
      };

      // Determine status based on WhatsApp status codes
      // Status codes: 0 = error, 1 = pending, 2 = server ack (sent), 3 = delivered, 4 = read
      if (update.update.status === 2) {
        statusData.status = 'sent';
      } else if (update.update.status === 3) {
        statusData.status = 'delivered';
      } else if (update.update.status === 4) {
        statusData.status = 'read';
      }

      if (statusData.status) {
        this.logger.debug({ statusData }, 'Message status update');
        this.sendEvent('message_status', statusData);
      }
    }
  }

  /**
   * Extract text content from message
   */
  extractMessageText(msg) {
    const messageContent = msg.message;
    if (!messageContent) return null;

    // Handle different message types
    if (messageContent.conversation) {
      return messageContent.conversation;
    } else if (messageContent.extendedTextMessage) {
      return messageContent.extendedTextMessage.text;
    } else if (messageContent.imageMessage) {
      return messageContent.imageMessage.caption || '[Image]';
    } else if (messageContent.videoMessage) {
      return messageContent.videoMessage.caption || '[Video]';
    } else if (messageContent.documentMessage) {
      return messageContent.documentMessage.caption || '[Document]';
    }

    return '[Unsupported message type]';
  }

  /**
   * Send text message
   */
  async sendMessage(phone, text, typingDelay = 0) {
    if (!this.connected) {
      throw new Error('Session not connected');
    }

    try {
      // Format phone number to WhatsApp JID
      const jid = this.formatPhoneToJid(phone);

      // Simulate typing if delay specified
      if (typingDelay > 0) {
        await this.sock.sendPresenceUpdate('composing', jid);
        await this.sleep(typingDelay);
        await this.sock.sendPresenceUpdate('paused', jid);
      }

      // Send message
      const result = await this.sock.sendMessage(jid, { text });

      this.logger.info({ phone, message_id: result.key.id }, 'Message sent');

      return {
        message_id: result.key.id,
        timestamp: result.messageTimestamp,
        status: 'sent'
      };
    } catch (error) {
      this.logger.error({ error: error.message, phone }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Send media message
   */
  async sendMedia(phone, mediaType, mediaBuffer, caption = null, typingDelay = 0) {
    if (!this.connected) {
      throw new Error('Session not connected');
    }

    try {
      const jid = this.formatPhoneToJid(phone);

      // Simulate typing if delay specified
      if (typingDelay > 0) {
        await this.sock.sendPresenceUpdate('composing', jid);
        await this.sleep(typingDelay);
        await this.sock.sendPresenceUpdate('paused', jid);
      }

      // Prepare media message based on type
      let messageContent;
      switch (mediaType) {
        case 'image':
          messageContent = {
            image: mediaBuffer,
            caption: caption || undefined
          };
          break;
        case 'video':
          messageContent = {
            video: mediaBuffer,
            caption: caption || undefined
          };
          break;
        case 'pdf':
        case 'document':
          messageContent = {
            document: mediaBuffer,
            mimetype: 'application/pdf',
            fileName: caption || 'document.pdf'
          };
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      // Send media message
      const result = await this.sock.sendMessage(jid, messageContent);

      this.logger.info({ phone, media_type: mediaType, message_id: result.key.id }, 'Media sent');

      return {
        message_id: result.key.id,
        timestamp: result.messageTimestamp,
        status: 'sent',
        media_type: mediaType
      };
    } catch (error) {
      this.logger.error({ error: error.message, phone, media_type: mediaType }, 'Failed to send media');
      throw error;
    }
  }

  /**
   * Get current QR code
   */
  getQRCode() {
    return {
      qr: this.qrCode,
      connected: this.connected,
      session_id: this.sessionId
    };
  }

  /**
   * Disconnect session
   */
  async disconnect() {
    try {
      this.logger.info('Disconnecting session');

      // Clear reconnect timer if active
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Close socket
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
      }

      // Clear auth state
      this.authState = null;
      this.connected = false;
      this.qrCode = null;

      this.logger.info('Session disconnected');

      return { success: true };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to disconnect');
      throw error;
    }
  }

  /**
   * Serialize credentials for storage
   */
  async serializeCredentials() {
    try {
      // Read all auth files from directory
      const files = await fs.readdir(this.authDir);
      const credentials = {};

      for (const file of files) {
        const filePath = path.join(this.authDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          credentials[file] = content;
        } catch (error) {
          if (error.code === 'ENOENT') {
            this.logger.debug({ file }, 'Auth file changed during serialization, skipping');
            continue;
          }
          throw error;
        }
      }

      if (!Object.prototype.hasOwnProperty.call(credentials, 'creds.json')) {
        throw new Error('Auth snapshot is incomplete: missing creds.json');
      }

      return JSON.stringify(credentials);
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to serialize credentials');
      throw error;
    }
  }

  /**
   * Deserialize credentials from storage
   */
  async deserializeCredentials(serialized) {
    try {
      const credentials = JSON.parse(serialized);

      if (!Object.prototype.hasOwnProperty.call(credentials, 'creds.json')) {
        this.logger.warn('Stored credentials snapshot is incomplete, skipping DB restore');
        return;
      }

      // Write each file to auth directory
      for (const [filename, content] of Object.entries(credentials)) {
        const filePath = path.join(this.authDir, filename);
        await fs.writeFile(filePath, content, 'utf-8');
      }

      this.logger.info('Credentials deserialized');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to deserialize credentials');
      throw error;
    }
  }

  /**
   * Format phone number to WhatsApp JID
   */
  formatPhoneToJid(phone) {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add @s.whatsapp.net suffix
    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Send event to parent process
   */
  sendEvent(event, data) {
    if (this.eventCallback) {
      this.eventCallback(event, data);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get session health status
   */
  getHealthStatus() {
    return {
      session_id: this.sessionId,
      connected: this.connected,
      reconnect_attempts: this.reconnectAttempts,
      has_qr: this.qrCode !== null,
      phone: this.sock?.user?.id?.split(':')[0] || null
    };
  }
}
