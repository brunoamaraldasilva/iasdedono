#!/bin/bash

# Simple integration test that uses curl to test document upload
# This doesn't require environment variables

set -e

APP_URL="http://localhost:3000"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_FILE="/tmp/test-doc-$(date +%s).csv"

echo "════════════════════════════════════════════════"
echo "Document Upload Integration Test"
echo "════════════════════════════════════════════════"
echo ""

# Create test CSV file
echo "📄 Creating test CSV file..."
cat > "$TEST_FILE" << 'EOF'
name,email,department,salary
John Doe,john@example.com,Sales,50000
Jane Smith,jane@example.com,Engineering,80000
Bob Johnson,bob@example.com,Marketing,60000
Alice Williams,alice@example.com,HR,55000
Charlie Brown,charlie@example.com,Finance,70000
EOF

echo "✅ Test CSV created: $TEST_FILE"
echo ""

# Signup user
echo "🔐 Signing up user..."
SIGNUP_RESPONSE=$(curl -s -X POST "$APP_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Response: $SIGNUP_RESPONSE"

if echo "$SIGNUP_RESPONSE" | grep -q "error"; then
  echo "❌ Signup failed"
  cat "$TEST_FILE" && rm "$TEST_FILE"
  exit 1
fi

echo "✅ User signed up: $TEST_EMAIL"
echo ""

# Extract user ID if available
USER_ID=$(echo "$SIGNUP_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
if [ -z "$USER_ID" ]; then
  USER_ID="unknown"
fi

echo "ℹ️  User ID: $USER_ID"
echo ""

# Login to get a session token
echo "🔑 Logging in user..."
LOGIN_RESPONSE=$(curl -s -X POST "$APP_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Response: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
  echo "❌ Login failed"
  rm "$TEST_FILE"
  exit 1
fi

SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo "⚠️  Could not extract session token from login response"
  echo "Full response: $LOGIN_RESPONSE"
  rm "$TEST_FILE"
  exit 1
fi

echo "✅ Session token obtained: ${SESSION_TOKEN:0:20}..."
echo ""

# Upload document
echo "📤 Uploading document..."
UPLOAD_RESPONSE=$(curl -s -X POST "$APP_URL/api/documents/upload" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -F "file=@$TEST_FILE;type=text/csv")

echo "Response: $UPLOAD_RESPONSE"

if echo "$UPLOAD_RESPONSE" | grep -q "error"; then
  echo "❌ Upload failed"
  rm "$TEST_FILE"
  exit 1
fi

DOCUMENT_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"documentId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DOCUMENT_ID" ]; then
  echo "⚠️  Could not extract document ID from response"
  rm "$TEST_FILE"
  exit 1
fi

echo "✅ Document uploaded: $DOCUMENT_ID"
echo ""

# Wait for processing
echo "⏳ Waiting for processing (up to 30 seconds)..."
for i in {1..30}; do
  LIST_RESPONSE=$(curl -s -X GET "$APP_URL/api/documents/list" \
    -H "Authorization: Bearer $SESSION_TOKEN")

  if echo "$LIST_RESPONSE" | grep -q "\"processing_status\":\"completed\""; then
    echo "✅ Processing completed!"
    echo ""
    echo "📊 Final document list:"
    echo "$LIST_RESPONSE" | grep -o '"filename":"[^"]*"\|"processing_status":"[^"]*"\|"total_chunks":[0-9]*\|"total_tokens":[0-9]*'
    echo ""
    echo "════════════════════════════════════════════════"
    echo "✅ ALL TESTS PASSED"
    echo "════════════════════════════════════════════════"
    rm "$TEST_FILE"
    exit 0
  fi

  echo "  Status: processing... ($i/30)"
  sleep 1
done

echo "❌ Processing timeout"
echo ""
echo "Last response:"
echo "$LIST_RESPONSE"

rm "$TEST_FILE"
exit 1
