# Whitelist API Guide

## Overview

The whitelist system controls who can create accounts in IAs de Dono. It supports two main flows:

1. **Check Flow** (Auth): Verify if an email is authorized (used during signup)
2. **Import Flow** (Admin): Bulk add/update emails from external systems (Shopify, etc)

---

## Architecture

```
External System (Shopify, etc)
         │
         │ POST /api/admin/whitelist/import
         │ (ADMIN_API_KEY required)
         ▼
   ┌──────────────┐
   │  Whitelist   │
   │   Table      │
   │  (Supabase)  │
   └──────┬───────┘
          │
    Cache │ (5 min)
          │
          ▼
   /api/auth/whitelist-check ◄── signup/login flow
   /api/auth/signup
```

---

## Current Schema

```sql
CREATE TABLE whitelist (
  email TEXT PRIMARY KEY,           -- buyer@company.com
  status TEXT DEFAULT 'active',     -- 'active' or 'inactive'
  metadata JSONB,                   -- { source, plan, imported_at }
  created_at TIMESTAMP,             -- When added
  updated_at TIMESTAMP              -- Last modified
);
```

---

## 1. Check if Email is Authorized (For Signup)

**Endpoint:** `POST /api/auth/whitelist-check`

**Used by:** Auth system (called before signup form)

**Request:**
```bash
curl -X POST https://iasdedono.vercel.app/api/auth/whitelist-check \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@example.com"}'
```

**Response (Authorized):**
```json
{ "success": true }
```

**Response (Not Found):**
```json
{
  "error": "Você não tem autorização para acessar.",
  "detail": "Email não encontrado na lista de usuários autorizados.",
  "helpUrl": "https://manualdedonos.com.br",
  "helpText": "Entre em contato com Manual de Donos para mais informações."
}
```

**Response (Inactive):**
```json
{
  "error": "Sua conta está inativa.",
  "detail": "Entre em contato com o suporte para reativação.",
  "helpUrl": "https://manualdedonos.com.br/suporte",
  "helpText": "Entre em contato com o suporte"
}
```

---

## 2. Import Emails via Admin API ⭐ (NEW)

**Endpoint:** `POST /api/admin/whitelist/import`

**Purpose:** Add/update multiple emails from external systems

**Authentication:**
- Requires `ADMIN_API_KEY` in Authorization header
- Set via environment variable in Vercel

---

### Setup: Configure Admin API Key

**Step 1: Generate a secret key**
```bash
# Generate a random API key (use one of these)
openssl rand -hex 32
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Step 2: Add to Vercel environment variables**
```
ADMIN_API_KEY=your_generated_key_here
```

**Step 3: Redeploy**
```bash
vercel --prod
```

---

### Example 1: Import from Shopify

```bash
curl -X POST https://iasdedono.vercel.app/api/admin/whitelist/import \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "email": "buyer1@shopify-store.com",
        "status": "active",
        "metadata": {
          "source": "shopify",
          "shopify_customer_id": "gid://shopify/Customer/123456",
          "plan": "pro",
          "imported_at": "2026-04-12T10:30:00Z"
        }
      },
      {
        "email": "buyer2@company.com",
        "status": "active",
        "metadata": {
          "source": "shopify",
          "plan": "starter"
        }
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "imported": 2,
  "updated": 0,
  "failed": 0,
  "errors": []
}
```

---

### Example 2: Bulk Import from CSV

```bash
# Convert CSV to JSON
cat buyers.csv | jq -R 'split(",") | {email: .[0], status: "active"}' | jq -s '{emails: .}' > payload.json

# Send to API
curl -X POST https://iasdedono.vercel.app/api/admin/whitelist/import \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @payload.json
```

**CSV Format:**
```csv
email,status,source
buyer1@example.com,active,manual_import
buyer2@example.com,active,shopify
buyer3@example.com,inactive,canceled_subscription
```

---

### Example 3: Update Status (Activate/Deactivate)

```bash
curl -X POST https://iasdedono.vercel.app/api/admin/whitelist/import \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "email": "buyer@example.com",
        "status": "inactive",
        "metadata": {
          "reason": "subscription_canceled",
          "canceled_date": "2026-04-10"
        }
      }
    ]
  }'
```

---

## 3. Request Schema Details

### Body Structure

```typescript
{
  "emails": [
    {
      "email": string,                    // Required: valid email
      "status": "active" | "inactive",   // Optional: default "active"
      "metadata": {                       // Optional: custom data
        "source": string,                 // Where email came from
        "plan": string,                   // What plan they purchased
        "shopify_id": string,             // External system reference
        "reason": string,                 // Why inactive, etc
        [key: string]: any                // Any other custom fields
      }
    }
  ]
}
```

### Limits

| Property | Limit | Details |
|----------|-------|---------|
| Emails per request | 1000 | Split into multiple requests if needed |
| Metadata size | ~1 MB | JSONB field limit |
| Request timeout | 30s | Typical: 100 emails in 2-3s |

---

## 4. Response Schema

```typescript
{
  "success": boolean,           // true if any emails imported successfully
  "imported": number,           // Count of new emails added
  "updated": number,            // Count of existing emails updated
  "failed": number,             // Count of failed/invalid emails
  "errors": [
    {
      "email": string,
      "error": string           // Why it failed
    }
  ]
}
```

### Error Codes

| HTTP Code | Meaning | Solution |
|-----------|---------|----------|
| 200 | Success | Check `success: true` in response |
| 400 | Bad request | Check JSON format, email validity |
| 401 | Unauthorized | Verify `ADMIN_API_KEY` in Authorization header |
| 429 | Rate limited | Too many requests, wait and retry |
| 500 | Server error | Contact support, check logs |

---

## 5. Integration Examples

### Shopify Webhook Integration

**Scenario:** Auto-add customers who purchase to whitelist

```typescript
// pages/api/webhooks/shopify/customer-create.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const customer = body.customer

  // Extract email from Shopify webhook
  const email = customer.email
  const shopifyId = customer.id

  // Call whitelist import API
  const response = await fetch('https://iasdedono.vercel.app/api/admin/whitelist/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emails: [
        {
          email,
          status: 'active',
          metadata: {
            source: 'shopify_webhook',
            shopify_customer_id: shopifyId,
            event: 'customer.create',
            imported_at: new Date().toISOString(),
          },
        },
      ],
    }),
  })

  const result = await response.json()
  return NextResponse.json(result)
}
```

---

### Manual Import via Admin Dashboard

```typescript
// admin/whitelist/import.tsx (React component)
'use client'

import { useState } from 'react'

export default function WhitelistImport() {
  const [emails, setEmails] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    setLoading(true)
    const emailList = emails
      .split('\n')
      .filter(e => e.trim())
      .map(e => ({ email: e.trim(), status: 'active' }))

    const response = await fetch('/api/admin/whitelist/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emailList }),
    })

    const result = await response.json()
    alert(`✅ Imported: ${result.imported}, Failed: ${result.failed}`)
    setLoading(false)
  }

  return (
    <div>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="Paste emails (one per line)"
      />
      <button onClick={handleImport} disabled={loading}>
        {loading ? 'Importing...' : 'Import'}
      </button>
    </div>
  )
}
```

---

## 6. Monitoring & Debugging

### View Whitelist Entries

```sql
-- Check all active users
SELECT email, status, metadata->>'source' as source, created_at
FROM whitelist
WHERE status = 'active'
ORDER BY created_at DESC;

-- Find emails imported from Shopify
SELECT email, metadata
FROM whitelist
WHERE metadata->>'source' = 'shopify'
LIMIT 10;

-- Count by source
SELECT
  metadata->>'source' as source,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active
FROM whitelist
WHERE metadata IS NOT NULL
GROUP BY metadata->>'source';
```

### Check Cache Status

Whitelist check results are cached for 5 minutes. To invalidate cache immediately:

```typescript
// In production, use this after bulk import
import { invalidateByTag } from '@vercel/functions'

await invalidateByTag('whitelist')
```

---

## 7. Security Best Practices

✅ **Do:**
- Store `ADMIN_API_KEY` as environment variable (never hardcode)
- Use HTTPS only (`https://`, not `http://`)
- Validate email format on client side before sending
- Log all imports for audit trail
- Rotate API key periodically

❌ **Don't:**
- Share `ADMIN_API_KEY` in public code
- Send emails in plain text in logs
- Allow unauthenticated access
- Import without validation

---

## 8. Troubleshooting

### "Invalid or missing ADMIN_API_KEY"
- Check Authorization header format: `Bearer YOUR_KEY`
- Verify key is set in Vercel environment variables
- Redeploy after changing env vars

### "Invalid email format"
- Check email syntax (must have `@` and `.`)
- Remove extra spaces
- Check for special characters

### "Maximum 1000 emails per request"
- Split import into multiple requests
- Or batch process on your end

### Import successful but emails not appearing in signup
- Cache not invalidated (waits 5 min or use `invalidateByTag`)
- Check if status is "inactive"
- Verify email case sensitivity (normalized to lowercase)

---

## 9. API Quota & Rate Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Emails per request | 1,000 | Split larger imports |
| Requests per minute | 10 | 10,000 emails/min maximum |
| Request size | 5 MB | JSON body size limit |
| Cache TTL | 5 minutes | Manual invalidation available |

---

## Next Steps

1. **Deploy schema migration:**
   ```sql
   -- Copy docs/WHITELIST_SCHEMA_ENHANCEMENT.sql to Supabase SQL editor
   -- OR run migrations via Supabase CLI
   ```

2. **Set ADMIN_API_KEY:**
   - Generate key: `openssl rand -hex 32`
   - Add to Vercel: `vercel env add ADMIN_API_KEY`
   - Deploy: `vercel --prod`

3. **Test import endpoint:**
   ```bash
   curl -X POST https://iasdedono.vercel.app/api/admin/whitelist/import \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"emails": [{"email": "test@example.com", "status": "active"}]}'
   ```

4. **Integrate with your system:**
   - Shopify: Set up webhook to call import endpoint
   - Admin dashboard: Add bulk import UI
   - CSV: Create import script

---

**Questions?** Check logs via `vercel logs` or contact support.
