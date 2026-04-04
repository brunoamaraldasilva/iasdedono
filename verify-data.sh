#!/bin/bash

# Extract the token from the last test run
# For simplicity, we'll do a quick signup + login to get credentials

APP_URL="http://localhost:3000"
TEST_EMAIL="verify-$(date +%s)@example.com"
TEST_PASSWORD="VerifyPass123"

echo "🔍 Verifying PHASE 2 Data in Supabase"
echo "════════════════════════════════════════"
echo ""

# Signup
echo "1️⃣  Signing up verification user..."
SIGNUP=$(curl -s -X POST "$APP_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

# Login
echo "2️⃣  Logging in..."
LOGIN=$(curl -s -X POST "$APP_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained"
echo ""

# List documents
echo "3️⃣  Fetching all documents..."
DOCS=$(curl -s -X GET "$APP_URL/api/documents/list" \
  -H "Authorization: Bearer $TOKEN")

echo "📊 Response:"
echo "$DOCS" | jq . 2>/dev/null || echo "$DOCS"

echo ""
echo "════════════════════════════════════════"
echo "✅ Verification Complete"
echo "════════════════════════════════════════"
