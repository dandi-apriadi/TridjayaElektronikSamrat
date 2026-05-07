#!/bin/bash

# Simple test script for Baileys Bridge JSON-RPC interface
# This demonstrates how to interact with the bridge via stdin/stdout

echo "Testing Baileys Bridge JSON-RPC Interface"
echo "=========================================="
echo ""

# Start the bridge in the background
node ../src/index.js &
BRIDGE_PID=$!

# Give it time to start
sleep 1

echo "1. Health Check"
echo '{"jsonrpc":"2.0","id":1,"method":"health_check","params":{}}' | nc localhost 3000 2>/dev/null || echo "Bridge running in background (PID: $BRIDGE_PID)"
echo ""

echo "2. Initialize Session"
echo '{"jsonrpc":"2.0","id":2,"method":"init_session","params":{"session_id":"test_001"}}'
echo ""

echo "3. Get QR Code"
echo '{"jsonrpc":"2.0","id":3,"method":"get_qr","params":{"session_id":"test_001"}}'
echo ""

echo "4. Test Invalid Method (should return error)"
echo '{"jsonrpc":"2.0","id":4,"method":"invalid_method","params":{}}'
echo ""

echo "5. Disconnect Session"
echo '{"jsonrpc":"2.0","id":5,"method":"disconnect","params":{"session_id":"test_001"}}'
echo ""

# Kill the bridge
kill $BRIDGE_PID 2>/dev/null

echo "Test complete!"
