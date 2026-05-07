#!/usr/bin/env node

/**
 * Simple test script for JSON-RPC protocol
 * 
 * Usage: node test-rpc.js | node src/index.js
 */

// Test requests
const testRequests = [
  // Health check
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'health_check',
    params: {}
  },
  
  // Initialize session
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'init_session',
    params: {
      session_id: 'test_session_001'
    }
  },
  
  // Get QR code
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'get_qr',
    params: {
      session_id: 'test_session_001'
    }
  },
  
  // Test invalid method
  {
    jsonrpc: '2.0',
    id: 4,
    method: 'invalid_method',
    params: {}
  },
  
  // Test missing params
  {
    jsonrpc: '2.0',
    id: 5,
    method: 'send_message',
    params: {}
  },
  
  // Disconnect session
  {
    jsonrpc: '2.0',
    id: 6,
    method: 'disconnect',
    params: {
      session_id: 'test_session_001'
    }
  }
];

// Send requests with delay
let index = 0;
const interval = setInterval(() => {
  if (index >= testRequests.length) {
    clearInterval(interval);
    // Give time for responses then exit
    setTimeout(() => process.exit(0), 1000);
    return;
  }
  
  console.log(JSON.stringify(testRequests[index]));
  index++;
}, 500);
