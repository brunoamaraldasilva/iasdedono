# NEXT STEPS - Immediate Actions Required

## 🚨 CRITICAL - Do This First

### Step 1: Execute SQL Migration in Supabase (5 minutes)

**Why:** The database schema needs completion_percentage column and trigger to calculate it automatically.

**How:**
1. Go to: **Supabase Dashboard → SQL Editor**
2. Click **"New Query"**
3. Copy ALL content from: `docs/FINAL_CONTEXT_SCHEMA.sql`
4. Paste into the query editor
5. Click **"Run"** (or Cmd+Enter)
6. Wait for success message
7. See output showing all columns in business_context table

**Expected output:**
```
SELECT columns from information_schema should show:
- business_name (TEXT)
- business_type (TEXT)
- description (TEXT)
- annual_revenue (NUMERIC)
- team_size (INTEGER)
- founded_year (INTEGER)
- main_goals (TEXT) ← Not array!
- main_challenges (TEXT) ← Not array!
- target_market (TEXT)
- main_competitors (TEXT)
- additional_info (JSONB)
- is_completed (BOOLEAN)
- completion_percentage (INTEGER)
```

---

## ✅ Verify Everything Works

### Step 2: Test Context Saving (10 minutes)

1. **Open Browser**
   ```
   http://localhost:3000
   ```

2. **Login** (use any test account)

3. **Go to Context Page**
   ```
   http://localhost:3000/dashboard/context
   ```

4. **Fill ONE field** (e.g., "Business Name: My Company")

5. **Open DevTools** (F12)
   - Go to: **Network tab**
   - Stop typing
   - Wait 1 second
   - Look for: **POST request to `/api/context/save`**
   - Response should show:
   ```json
   {
     "success": true,
     "completion_percentage": 9,
     "data": {...}
   }
   ```

6. **Refresh Page** (F5)
   - Your "Business Name" should STILL be there
   - ✅ If yes, context saving works!

7. **Fill More Fields**
   - Try to reach 75% completion
   - Progress bar should turn green
   - Message should appear: "✓ Contexto suficientemente preenchido!"

---

### Step 3: Test Document Upload (10 minutes)

1. **Go to Chat**
   ```
   http://localhost:3000/dashboard/chat/[any-conversation-id]
   ```
   Or create new conversation first

2. **Click Paperclip Icon** 📎 (in message input)

3. **Upload a PDF or CSV**
   - Check console: should see upload progress
   - File should appear in dropdown below input

4. **Type a message** and **Send** with document attached

5. **Check Console**
   - Should see: `✅ [CONTEXT] Updating message with documents`
   - AI should respond based on document content

6. **Refresh Page** (F5)
   - Previous message should still show document badge
   - Attachment should persist

---

### Step 4: Run Full Test Suite

Follow the instructions in: `docs/TEST_PLAN.md`

---

## 📊 What Was Implemented (Session 3)

### Backend (Server-Side)
✅ `/api/context/save/route.ts` - Saves context using admin client (bypasses RLS)
✅ Document extraction with pdftotext (no DOM dependencies)
✅ Document persistence via document_ids in messages table
✅ AI prompts updated to use documents

### Frontend
✅ Context page with auto-save (1s debounce)
✅ Real-time progress bar with color change at 75%
✅ Message input with attachment button
✅ Document persistence after refresh

### Database Schema (TO BE EXECUTED)
⏳ business_context table with all required columns
⏳ Automatic completion_percentage calculation via trigger
⏳ is_completed flag set at 75%

---

## 🔗 How It Works (Technical Overview)

### Context Saving Flow
```
User types in context page
  ↓ (1 second debounce)
GET auth token from Supabase
  ↓
POST /api/context/save with Bearer token
  ↓
Backend validates user via Authorization header
  ↓
Create admin Supabase client (SERVICE_ROLE_KEY)
  ↓
Try UPDATE first, if no rows → INSERT
  ↓
Trigger calculates completion_percentage automatically
  ↓
Return completion_percentage to frontend
  ↓
Frontend updates progress bar
```

### Document Flow
```
User clicks 📎 and selects file
  ↓
POST /api/documents/upload
  ↓
Extract text using pdftotext/csv-parse
  ↓
Save document_ids with message
  ↓
Load documents when user opens chat
  ↓
Inject extracted_text into AI prompt
  ↓
AI responds based on document content
```

---

## ⚠️ Common Issues & Fixes

### Issue: "Cannot read property 'completion_percentage' of undefined"
**Cause:** SQL migration not executed yet
**Fix:** Execute `FINAL_CONTEXT_SCHEMA.sql` in Supabase

### Issue: Context saves but progress bar doesn't update
**Cause:** completion_percentage returning null from database
**Fix:** Execute SQL migration to add trigger

### Issue: Document upload fails with 404
**Cause:** Endpoint not reloaded after code changes
**Fix:** Restart dev server `npm run dev`

### Issue: Document metadata lost after refresh
**Cause:** document_ids migration not run
**Fix:** Execute `PHASE2_ADD_MESSAGE_DOCUMENTS.sql` in Supabase

---

## 📋 Checklist Before Moving Forward

- [ ] SQL migration executed in Supabase
- [ ] Context page opens and loads without errors
- [ ] Auto-save works (check Network tab)
- [ ] Data persists after F5 refresh
- [ ] Document upload button appears
- [ ] PDF/CSV files upload successfully
- [ ] AI responds based on document content
- [ ] Completion % shows and changes with filled fields

---

## Next Features (After Core Verification)

1. **Web Search Integration** - Search the internet for current data
2. **Email Whitelist** - Only allow specific email domains
3. **Admin Dashboard** - Stats, user management, agent management
4. **Custom Agents** - Let admins create new personas
5. **Beta Testing** - Test agents before publishing

---

## Questions?

Check the logs:
```bash
# Terminal with dev server running
tail -f /private/tmp/dev.log
```

Check browser console (F12) for detailed error messages.
