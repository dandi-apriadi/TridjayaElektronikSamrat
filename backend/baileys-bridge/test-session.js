#!/usr/bin/env node

/**
 * Test script for Baileys session management
 * 
 * This script tests the session initialization and QR code generation
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the baileys-bridge process
const bridge = spawn('node', ['src/index.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'inherit']
});

let requestId = 1;
const pendingRequests = new Map();

// Setup readline for bridge output
const rl = createInterface({
  input: bridge.stdout,
  terminal: false
});

// Handle responses from bridge
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    
    // Handle notifications (events)
    if (!response.id && response.method) {
      console.log('📢 Event:', response.method, JSON.stringify(response.params, null, 2));
      return;
    }

    // Handle responses
    if (response.id && pendingRequests.has(response.id)) {
      const { resolve, reject } = pendingRequests.get(response.id);
      pendingRequests.delete(response.id);

      if (response.error) {
        reject(response.error);
      } else {
        resolve(response.result);
      }
    }
  } catch (error) {
    console.error('Failed to parse response:', line);
  }
});

// Send JSON-RPC request
function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = requestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    pendingRequests.set(id, { resolve, reject });
    bridge.stdin.write(JSON.stringify(request) + '\n');

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Run tests
async function runTests() {
  try {
    console.log('🧪 Testing Baileys Session Management\n');

    // Test 1: Health check
    console.log('1️⃣ Testing health_check...');
    const health = await sendRequest('health_check');
    console.log('✅ Health check passed:', JSON.stringify(health, null, 2));
    console.log();

    // Test 2: Initialize session
    console.log('2️⃣ Testing init_session...');
    const sessionId = 'test-session-' + Date.now();
    const initResult = await sendRequest('init_session', { session_id: sessionId });
    console.log('✅ Session initialized:', JSON.stringify(initResult, null, 2));
    console.log();

    // Wait a bit for QR code generation
    console.log('⏳ Waiting for QR code generation (5 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 3: Get QR code
    console.log('3️⃣ Testing get_qr...');
    const qrResult = await sendRequest('get_qr', { session_id: sessionId });
    console.log('✅ QR code retrieved:', {
      session_id: qrResult.session_id,
      status: qrResult.status,
      has_qr: qrResult.qr ? 'yes' : 'no',
      qr_length: qrResult.qr ? qrResult.qr.length : 0
    });
    console.log();

    // Test 4: Disconnect session
    console.log('4️⃣ Testing disconnect...');
    const disconnectResult = await sendRequest('disconnect', { session_id: sessionId });
    console.log('✅ Session disconnected:', JSON.stringify(disconnectResult, null, 2));
    console.log();

    // Test 5: Final health check
    console.log('5️⃣ Testing final health_check...');
    const finalHealth = await sendRequest('health_check');
    console.log('✅ Final health check:', JSON.stringify(finalHealth, null, 2));
    console.log();

    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    bridge.stdin.end();
    bridge.kill();
    process.exit(0);
  }
}

// Handle bridge process errors
bridge.on('error', (error) => {
  console.error('Bridge process error:', error);
  process.exit(1);
});

bridge.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('Bridge process exited with code:', code);
    process.exit(code);
  }
});

// Start tests after a short delay
setTimeout(() => {
  runTests().catch(error => {
    console.error('Test runner error:', error);
    bridge.kill();
    process.exit(1);
  });
}, 1000);
