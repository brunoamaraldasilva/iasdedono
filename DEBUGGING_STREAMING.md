# Streaming Message Rendering - Diagnostic Guide

## Problem Summary
- Messages are not appearing in the UI when using SSE streaming
- Chunks are being received by the server (confirmed in previous logs)
- Stream completes successfully (confirmed in previous logs)
- But messages never render in ChatWindow component

## Root Cause Investigation Strategy

We've added comprehensive diagnostic logging across all 5 phases of the data flow:

### Phase 1: Hook Initialization
**Log:** `[PHASE 1] Hook mounted for conversation: {conversationId}`
- **Expected:** Should appear once when you open a conversation
- **If missing:** Hook not initializing properly

### Phase 2: Assistant Message Created
**Log:** `[PHASE 2] Adding empty assistant message: { assistantIndex, totalMessages, contentLength }`
- **Expected:** Should appear when you click "Send"
- **Shows:** Empty message added to state and ready for chunks
- **If missing:** sendMessage function not being called

### Phase 3: EventSource Chunks Arrive
**Log:** `[PHASE 3] EventSource message received: { dataLength, isComplete, preview }`
- **Expected:** Should appear multiple times (one per chunk) + one final "[DONE]" message
- **Shows:** Chunks are arriving from the server
- **If missing:** Network issue or EventSource not connecting (ERROR in browser console)

### Phase 3.5: setMessages Callback (Before Update)
**Log:** `[PHASE 3.5] setMessages callback - prev state: { prevLength, assistantIndex, assistantExists }`
- **Expected:** Should appear once per chunk, showing current state before update
- **Key value:** `assistantExists` should be `true` (index < length)
- **If assistantExists is false:** The index is out of bounds - data corruption issue

### Phase 3.6: setMessages Callback (After Update)
**Log:** `[PHASE 3.6] State updated with new content: { assistantIndex, updatedLength, contentLength, preview }`
- **Expected:** Should appear once per chunk, showing new accumulated content
- **Shows:** State was actually updated with the chunk
- **If missing:** setMessages callback is not returning the updated state

### Phase 4: Stream Complete
**Log:** `[PHASE 4] Final messagesRef state: { length, assistantIndex, assistantContentLength, assistantContent }`
- **Expected:** Should appear once when stream ends
- **Shows:** Final accumulated message in the ref
- **Key value:** `assistantContentLength` should be > 0 and contain the full response

### Phase 5: ChatWindow Receives Updated Prop
**Log:** `[PHASE 5] ChatWindow received messages prop: { count, loading, lastMessage, lastMessageLength, preview }`
- **Expected:** Should appear whenever messages state changes (multiple times during streaming)
- **Shows:** Component received the updated messages array
- **If missing:** ChatWindow not receiving updates (rendering issue)

## How to Test

1. **Deploy the current code** (already pushed to main)
   ```bash
   # Vercel automatically deploys, or manually deploy:
   vercel deploy --prod
   ```

2. **Open the app in production**
   - https://iasdedono.vercel.app

3. **Open Developer Tools**
   - Press `F12` or `Cmd+Option+I` (Mac)
   - Go to the **Console** tab

4. **Log in** if needed

5. **Open a conversation** with any agent

6. **Clear the console** (click the 🚫 icon or type `clear()`)

7. **Send a simple test message** like "Olá" or "Como você está?"

8. **Watch the console logs** and identify:
   - Which PHASE logs appear?
   - Which PHASE logs are **missing**?
   - Are there any ERROR logs?

## Expected Console Output

For a successful stream, you should see logs flowing in this order:
```
[PHASE 1] Hook mounted...
[PHASE 2] Adding empty assistant message...
[PHASE 3] EventSource message received... (multiple times)
[PHASE 3.5] setMessages callback - prev state... (multiple times)
[PHASE 3.6] State updated with new content... (multiple times)
[PHASE 3.5] setMessages callback... (for each chunk)
[PHASE 3.6] State updated... (for each chunk)
✅ [SSE] Stream completo!
[PHASE 4] Final messagesRef state...
[PHASE 5] ChatWindow received messages prop... (multiple times)
```

## How to Interpret Results

| Scenario | What It Means | Next Step |
|----------|--------------|-----------|
| See all phases 1-5 | Everything works, but rendering still fails | Check if ChatWindow has CSS issues hiding messages |
| Stop at Phase 3 | EventSource not receiving chunks | Check network tab in DevTools, verify API response |
| Stop at Phase 3.6 | Chunks arrive but state update fails | Check if assistantIndex is out of bounds |
| Stop at Phase 5 | State updates but ChatWindow doesn't receive prop | Check if Hook is properly passing messages to component |
| See Phase 4 with empty content | Stream completed but no content accumulated | Check if JSON.parse is failing on chunks |

## What to Do Next

Once you identify which phase stops:

1. **Screenshot the console output** or copy the full log
2. **Note any ERROR messages** (in red)
3. **Check the Network tab**:
   - Open DevTools → Network tab
   - Send a message
   - Look for `/api/chat-stream` request
   - Check the Response to see if it contains chunks
4. **Share the logs** so we can identify the exact root cause

## Technical Details

### The Data Flow Architecture
```
User clicks Send
    ↓
sendMessage() in useChat.ts
    ↓
Add empty assistant message to state [PHASE 2]
    ↓
Create EventSource to /api/chat-stream [PHASE 3]
    ↓
Receive chunks from EventSource [PHASE 3]
    ↓
Accumulate in streamingRef
    ↓
Call setMessages with accumulated content [PHASE 3.5 → 3.6]
    ↓
React batch updates and re-renders
    ↓
ChatWindow receives updated messages prop [PHASE 5]
    ↓
ChatWindow renders the accumulated message
    ↓
User sees streaming text appear character by character
```

### Key Files Involved
- `hooks/useChat.ts` - Manages state, EventSource, message accumulation
- `app/api/chat-stream/route.ts` - Server-side streaming endpoint
- `components/ChatWindow.tsx` - Renders messages
- `app/dashboard/chat/[id]/page.tsx` - Page component that connects everything

## Debugging Checklist

- [ ] Code committed and pushed to main
- [ ] Vercel deployment completed
- [ ] Opened production app
- [ ] Opened DevTools Console
- [ ] Sent a test message
- [ ] Watched all 5 PHASE logs flow
- [ ] Identified where logs stop
- [ ] Checked Network tab for API response
- [ ] Took screenshot of console logs
- [ ] Verified if messages appear in state but not in UI
- [ ] Checked if there are CSS issues (messages hidden?)

---

**Once you run the test and share the logs, we'll have concrete evidence of the root cause and can implement a targeted fix.**
