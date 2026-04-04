# Test Plan - Context & Document Workflow

## Prerequisites
1. Run the SQL migration: `FINAL_CONTEXT_SCHEMA.sql` in Supabase SQL Editor
2. Ensure dev server is running: `npm run dev`

## Test Flow

### PHASE 1: Context Saving
**Goal:** Verify context saves automatically and persists after page refresh

1. **Open Browser**
   - Navigate to: `http://localhost:3000`
   - Login with test credentials

2. **Navigate to Context Page**
   - Go to: `/dashboard/context`
   - Should load context form with empty fields

3. **Fill Context Fields**
   - Enter data in any field (e.g., "Business Name: Test Company")
   - Stop typing
   - Wait 1 second (auto-save debounce)
   - Check browser console: should see `✅ [CONTEXT] Saved successfully`

4. **Verify Auto-Save**
   - Open browser DevTools → Network tab
   - Fill another field
   - Should see POST to `/api/context/save` after 1 second
   - Response should include `completion_percentage`

5. **Persist After Refresh**
   - Fill more fields (aim for 75% completion)
   - Progress bar should turn green
   - Press F5 to refresh
   - All previously filled fields should still be visible
   - Data should be loaded from database

### PHASE 2: Document Upload
**Goal:** Verify documents upload and persist with messages

1. **Open Chat**
   - Go to: `/dashboard/chat/[conversation_id]`
   - Select a persona

2. **Upload Document**
   - Click 📎 (attachment icon) in message input
   - Select a PDF or CSV file
   - File should upload and appear in "Documentos anexados" dropdown
   - Check browser console: should see upload progress

3. **Send Message with Document**
   - Type a message
   - With document attached, send message
   - AI should respond using document content
   - Response should mention document sources

4. **Verify Persistence**
   - Refresh page (F5)
   - Previous message with attachment should still show
   - Document info should be visible in the message

### PHASE 3: Document Usage in AI
**Goal:** Verify AI uses documents when responding

1. **Upload PDF with Data**
   - Upload a PDF with specific data/tables
   - Example: "2024 revenue was $500,000"

2. **Ask Question About Data**
   - Send message: "What was our revenue in 2024?"
   - AI should reference the document
   - Response should include: "📄 Based on: filename.pdf" or similar

3. **Multiple Documents**
   - Upload 2+ documents
   - Ask a question that requires both documents
   - AI should synthesize information from multiple sources

## Expected Outcomes

### Context Saving ✅
- [ ] Auto-save triggers after 1 second of inactivity
- [ ] POST request to `/api/context/save` returns 200
- [ ] Completion percentage displayed correctly
- [ ] Data persists after page refresh
- [ ] Progress bar changes color at 75%

### Document Upload ✅
- [ ] File uploads successfully
- [ ] Document appears in dropdown list
- [ ] File size and type validated
- [ ] Storage shows in Supabase

### Document Persistence ✅
- [ ] Messages remember attached documents
- [ ] Document metadata loads after refresh
- [ ] Document list visible in chat

### Document Usage ✅
- [ ] AI responds based on document content
- [ ] Document sources shown in response
- [ ] Multiple documents handled correctly

## Troubleshooting

### Issue: Context not saving
```
Check:
- Browser console for errors
- Network tab: POST /api/context/save response
- Server logs: /private/tmp/dev.log
- Supabase: business_context table has data
```

### Issue: Document not attached
```
Check:
- File size < 10MB
- File type supported (PDF, CSV, etc.)
- Conversation ID is valid
- DocumentUpload component mounted
```

### Issue: AI not using documents
```
Check:
- Document extracted_text is populated (query documents table)
- Chat API includes documents in prompt
- Check: lib/documentProcessing.ts extractTextFromPDF()
```

## SQL Queries to Debug

```sql
-- Check context data
SELECT id, user_id, business_name, completion_percentage
FROM business_context
LIMIT 5;

-- Check documents
SELECT id, filename, extracted_text, processing_status
FROM documents
LIMIT 5;

-- Check messages with documents
SELECT id, role, document_ids
FROM messages
WHERE document_ids IS NOT NULL
LIMIT 5;
```

## Next Steps After Testing
1. ✅ Fix any failing tests
2. ✅ Verify completion percentage calculation
3. ✅ Ensure document persistence works
4. ✅ Test multi-document scenarios
5. ⏳ Implement web search (PHASE 3)
6. ⏳ Add email whitelist (PHASE 4)
