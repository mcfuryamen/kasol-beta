#!/bin/bash

set -x

echo "🧪 Starting Smoke Test for Gerobak App..."
echo ""

# Start server
echo "Starting HTTP server on port 8080..."
npx http-server -p 8080 -c-1 --cors --index index.html > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

BASE_URL="http://localhost:8080"

echo "Testing file accessibility..."
echo "1. index.html:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/index.html"

echo "2. css/style.css:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/css/style.css"

echo "3. js/app.js:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/js/app.js"

echo "4. js/vendor/dexie.min.js:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/js/vendor/dexie.min.js"

echo "5. manifest.json:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/manifest.json"

echo "6. sw-gerobak.js:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/sw-gerobak.js"

echo "7. assets/logo.png:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" "${BASE_URL}/assets/logo.png"

echo ""
echo "Testing content..."
echo "8. Check index.html has app container:"
curl -s "${BASE_URL}/index.html" | grep -q 'id="app"' && echo "   ✅ PASS: app container found" || echo "   ❌ FAIL: app container missing"

echo "9. Check CSS loaded in index.html:"
curl -s "${BASE_URL}/index.html" | grep -q 'css/style.css' && echo "   ✅ PASS: CSS link found" || echo "   ❌ FAIL: CSS link missing"

echo "10. Check JS loaded in index.html:"
curl -s "${BASE_URL}/index.html" | grep -q 'js/app.js' && echo "   ✅ PASS: JS link found" || echo "   ❌ FAIL: JS link missing"

echo "11. Check manifest reference:"
curl -s "${BASE_URL}/index.html" | grep -q 'manifest.json' && echo "   ✅ PASS: manifest link found" || echo "   ❌ FAIL: manifest link missing"

echo ""
echo "Smoke test complete!"
# Stop the server
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null || true # Suppress error if server already stopped

echo "Server PID: $SERVER_PID (killed)"
