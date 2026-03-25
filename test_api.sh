#!/bin/bash

# Start server in background
node dist/src/main.js &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting for server to start..."
sleep 6

echo ""
echo "==================================="
echo "Test 1: Get Russia info"
echo "==================================="
curl -s "http://localhost:3000/api/delivery/countries/RU?lang=ru"

echo ""
echo ""
echo "==================================="
echo "Test 2: Get Belarus info"
echo "==================================="
curl -s "http://localhost:3000/api/delivery/countries/BY?lang=ru"

echo ""
echo ""
echo "==================================="
echo "Test 3: Get Poland info"
echo "==================================="
curl -s "http://localhost:3000/api/delivery/countries/PL?lang=ru"

echo ""
echo ""
echo "==================================="
echo "Test 4: Get regions of Russia"
echo "==================================="
curl -s "http://localhost:3000/api/delivery/regions?countryCode=RU" | head -c 500

echo ""
echo ""
echo "==================================="
echo "Test 5: Get cities of Moscow region"
echo "==================================="
curl -s "http://localhost:3000/api/delivery/cities?countryCode=RU&regionCode=77" | head -c 500

echo ""
echo ""
# Kill server
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "Tests completed!"
