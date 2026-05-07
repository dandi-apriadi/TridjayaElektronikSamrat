#!/usr/bin/env node

/**
 * Baileys Bridge - JSON-RPC wrapper for Baileys WhatsApp library
 * 
 * This service communicates with the Rust backend via stdin/stdout using JSON-RPC protocol.
 * It handles WhatsApp protocol operations through the Baileys library.
 * 
 * Supported JSON-RPC methods:
 * - init_session: Initialize WhatsApp session with credentials
 * - send_message: Send text message to recipient
 * - send_media: Send media message (image, PDF, video) with optional caption
 * - get_qr: Get QR code for pairing
 * - disconnect: Disconnect WhatsApp session
 * - health_check: Check service health status
 */

import { createInterface } from 'readline';
import pino from 'pino';
import { BaileysSession } from './session.js';

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: false,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Store active sessions
const sessions = new Map();

/**
 * JSON-RPC error codes
 */
const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SESSION_NOT_FOUND: -32001,
  SESSION_ALREADY_EXISTS: -32002,
  CONNECTION_ERROR: -32003,
  SEND_ERROR: -32004
};

/**
 * Create JSON-RPC error response
 */
function createErrorResponse(id, code, message, data = null) {
  const error = { code, message };
  if (data) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/**
 * Create JSON-RPC success response
 */
function createSuccessResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

/**
 * Send JSON-RPC notification (no response expected)
 */
function sendNotification(method, params) {
  const notification = { jsonrpc: '2.0', method, params };
  console.log(JSON.stringify(notification));
}

/**
 * Send JSON-RPC response
 */
function sendResponse(response) {
  console.log(JSON.stringify(response));
}

/**
 * Handle init_session method
 * Initializes a WhatsApp session with optional credentials
 * 
 * @param {Object} params - { session_id: string, credentials?: object }
 */
async function handleInitSession(params) {
  const { session_id, credentials } = params;

  if (!session_id) {
    throw { code: ErrorCodes.INVALID_PARAMS, message: 'session_id is required' };
  }

  if (sessions.has(session_id)) {
    throw { code: ErrorCodes.SESSION_ALREADY_EXISTS, message: `Session ${session_id} already exists` };
  }

  logger.info({ session_id }, 'Initializing session');

  try {
    // Create event callback to send notifications
    const eventCallback = (event, data) => {
      sendNotification(event, data);
    };

    // Create new Baileys session
    const session = new BaileysSession(session_id, logger, eventCallback);
    
    // Initialize session with credentials if provided
    const result = await session.initialize(credentials);

    // Store session
    sessions.set(session_id, session);

    return {
      session_id,
      status: 'initialized',
      requires_pairing: result.requires_pairing,
      connected: session.connected
    };
  } catch (error) {
    logger.error({ session_id, error: error.message }, 'Failed to initialize session');
    throw { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to initialize session', data: error.message };
  }
}

/**
 * Handle send_message method
 * Sends a text message to a recipient
 * 
 * @param {Object} params - { session_id: string, phone: string, message: string, typing_delay?: number }
 */
async function handleSendMessage(params) {
  const { session_id, phone, message, typing_delay } = params;

  if (!session_id || !phone || !message) {
    throw { code: ErrorCodes.INVALID_PARAMS, message: 'session_id, phone, and message are required' };
  }

  const session = sessions.get(session_id);
  if (!session) {
    throw { code: ErrorCodes.SESSION_NOT_FOUND, message: `Session ${session_id} not found` };
  }

  if (!session.connected) {
    throw { code: ErrorCodes.CONNECTION_ERROR, message: 'Session not connected' };
  }

  logger.info({ session_id, phone, message_length: message.length }, 'Sending message');

  try {
    const result = await session.sendMessage(phone, message, typing_delay || 0);

    return {
      message_id: result.message_id,
      status: result.status,
      timestamp: new Date(result.timestamp * 1000).toISOString()
    };
  } catch (error) {
    logger.error({ session_id, phone, error: error.message }, 'Failed to send message');
    throw { code: ErrorCodes.SEND_ERROR, message: 'Failed to send message', data: error.message };
  }
}

/**
 * Handle send_media method
 * Sends a media message (image, PDF, video) with optional caption
 * 
 * @param {Object} params - { session_id: string, phone: string, media_type: string, media_path: string, caption?: string, typing_delay?: number }
 */
async function handleSendMedia(params) {
  const { session_id, phone, media_type, media_path, caption, typing_delay } = params;

  if (!session_id || !phone || !media_type || !media_path) {
    throw { code: ErrorCodes.INVALID_PARAMS, message: 'session_id, phone, media_type, and media_path are required' };
  }

  const validMediaTypes = ['image', 'pdf', 'video'];
  if (!validMediaTypes.includes(media_type)) {
    throw { code: ErrorCodes.INVALID_PARAMS, message: `Invalid media_type. Must be one of: ${validMediaTypes.join(', ')}` };
  }

  const session = sessions.get(session_id);
  if (!session) {
    throw { code: ErrorCodes.SESSION_NOT_FOUND, message: `Session ${session_id} not found` };
  }

  if (!session.connected) {
    throw { code: ErrorCodes.CONNECTION_ERROR, message: 'Session not connected' };
  }

  logger.info({ session_id, phone, media_type, caption }, 'Sending media');

  try {
    // Read media file
    const fs = await import('fs/promises');
    const mediaBuffer = await fs.readFile(media_path);

    // Send media via session
    const result = await session.sendMedia(phone, media_type, mediaBuffer, caption, typing_delay || 0);

    return {
      message_id: result.message_id,
      status: result.status,
      media_type: result.media_type,
      timestamp: new Date(result.timestamp * 1000).toISOString()
    };
  } catch (error) {
    logger.error({ session_id, phone, media_type, error: error.message }, 'Failed to send media');
    throw { code: ErrorCodes.SEND_ERROR, message: 'Failed to send media', data: error.message };
  }
}

/**
 * Handle get_qr method
 * Gets the QR code for pairing (if session requires pairing)
 * 
 * @param {Object} params - { session_id: string }
 */
async function handleGetQR(params) {
  const { session_id } = params;

  if (!session_id) {
    throw { code: ErrorCodes.INVALID_PARAMS, message: 'session_id is required' };
  }

  const session = sessions.get(session_id);
  if (!session) {
    throw { code: ErrorCodes.SESSION_NOT_FOUND, message: `Session ${session_id} not found` };
  }

  logger.info({ session_id }, 'Getting QR code');

  const qrData = session.getQRCode();

  return {
    session_id: qrData.session_id,
    qr: qrData.qr,
    status: qrData.connected ? 'connected' : (qrData.qr ? 'waiting_for_pairing' : 'initializing')
  };
}

/**
 * Handle disconnect method
 * Disconnects a WhatsApp session
 * 
 * @param {Object} params - { session_id: string }
 */
async function handleDisconnect(params) {
  const { session_id } = params;

  if (!session_id) {
    throw { code: ErrorCodes.INVALID_PARAMS, message: 'session_id is required' };
  }

  const session = sessions.get(session_id);
  if (!session) {
    throw { code: ErrorCodes.SESSION_NOT_FOUND, message: `Session ${session_id} not found` };
  }

  logger.info({ session_id }, 'Disconnecting session');

  try {
    await session.disconnect();
    sessions.delete(session_id);

    return {
      session_id,
      status: 'disconnected'
    };
  } catch (error) {
    logger.error({ session_id, error: error.message }, 'Failed to disconnect session');
    throw { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to disconnect session', data: error.message };
  }
}

/**
 * Handle health_check method
 * Returns service health status
 * 
 * @param {Object} params - {}
 */
async function handleHealthCheck(params) {
  const sessionHealths = Array.from(sessions.values()).map(s => s.getHealthStatus());
  const active_sessions = sessionHealths.filter(s => s.connected).length;
  const total_sessions = sessions.size;

  return {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: {
      total: total_sessions,
      active: active_sessions,
      details: sessionHealths
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Route JSON-RPC method to handler
 */
async function handleMethod(method, params) {
  switch (method) {
    case 'init_session':
      return await handleInitSession(params);
    case 'send_message':
      return await handleSendMessage(params);
    case 'send_media':
      return await handleSendMedia(params);
    case 'get_qr':
      return await handleGetQR(params);
    case 'disconnect':
      return await handleDisconnect(params);
    case 'health_check':
      return await handleHealthCheck(params);
    default:
      throw { code: ErrorCodes.METHOD_NOT_FOUND, message: `Method '${method}' not found` };
  }
}

/**
 * Process JSON-RPC request
 */
async function processRequest(line) {
  let request;
  let id = null;

  try {
    // Parse JSON
    try {
      request = JSON.parse(line);
    } catch (err) {
      sendResponse(createErrorResponse(null, ErrorCodes.PARSE_ERROR, 'Parse error', err.message));
      return;
    }

    // Validate JSON-RPC structure
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      sendResponse(createErrorResponse(null, ErrorCodes.INVALID_REQUEST, 'Invalid JSON-RPC version'));
      return;
    }

    id = request.id;

    if (!request.method || typeof request.method !== 'string') {
      sendResponse(createErrorResponse(id, ErrorCodes.INVALID_REQUEST, 'Invalid or missing method'));
      return;
    }

    const params = request.params || {};

    // Handle method
    const result = await handleMethod(request.method, params);
    sendResponse(createSuccessResponse(id, result));

  } catch (err) {
    // Handle application errors
    if (err.code && err.message) {
      sendResponse(createErrorResponse(id, err.code, err.message, err.data));
    } else {
      // Unexpected error
      logger.error({ err, request }, 'Unexpected error processing request');
      sendResponse(createErrorResponse(id, ErrorCodes.INTERNAL_ERROR, 'Internal error', err.message));
    }
  }
}

/**
 * Main entry point
 */
function main() {
  logger.info('Baileys Bridge starting...');
  logger.info(`Node.js version: ${process.version}`);
  logger.info('Listening for JSON-RPC requests on stdin...');

  // Create readline interface for stdin
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Process each line as a JSON-RPC request
  rl.on('line', (line) => {
    if (line.trim()) {
      processRequest(line.trim()).catch(err => {
        logger.error({ err }, 'Fatal error processing request');
      });
    }
  });

  // Handle stdin close
  rl.on('close', () => {
    logger.info('Stdin closed, shutting down...');
    process.exit(0);
  });

  // Handle process signals
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    rl.close();
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    rl.close();
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
  });
}

// Start the service
main();
