# IAs de Dono - Project Instructions

## ⚠️ CRITICAL: THIS IS THE CORRECT PROJECT

**Project Name:** IAs de Dono
**GitHub:** https://github.com/brunoamaraldasilva/iasdedono
**Vercel:** https://iasdedono.vercel.app
**Live Users:** ~700 users
**Status:** Production application with streaming issues being fixed

---

## ❌ DO NOT CONFUSE WITH:
- **c-lvls** project — This is a different, unrelated project. IGNORE IT COMPLETELY.
- Always verify working directory: `/Users/amaral.bruno/Product-Hub/projects/iasdedono`

---

## Current Focus: STREAMING FIX (Session 9)

**Problem reported by user:**
- Streaming responses don't work in production
- Responses appear all at once instead of incrementally
- Web search queries take 10-20s with no feedback to user
- Session breaks on page refresh
- Web scraping extremely slow (10-20s+ wait times)

**Recent fixes completed:**
1. ✅ Fixed Supabase dummy client issue (lib/supabase.ts)
   - Was using IIFE pattern that returned dummy client if env vars missing at build time
   - Now uses direct createClient() at runtime with real env vars
2. ✅ Fixed cache response streaming (app/api/chat/route.ts)
   - Cache hits now return streaming response instead of JSON
   - Cached responses chunked into 50-char pieces
   - Added X-Cache: HIT header for monitoring
3. ✅ TypeScript types corrected
4. ✅ Local build verified (npm run build passes)
5. **NEXT:** Deploy to production and monitor for errors

---

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL database + auth)
- OpenAI API (gpt-4o-mini)
- SerpAPI (web search)
- js-tiktoken (token counting)

---

## Key Files (Streaming Architecture)

### Backend Streaming
- `app/api/chat/route.ts` — Chat endpoint with streaming + caching
  - Lines 413-442: Cache response streaming
  - Lines 444-475: Main ReadableStream for non-cached responses
  - Logs: Every 5 chunks for diagnostics

- `lib/openai.ts` — OpenAI integration with tool calling
  - Function `generateChatResponseWithTools()` (async generator)
  - Yields chunks as they come from OpenAI
  - Tool execution blocks streaming (expected behavior)

- `lib/chatCache.ts` — Response caching system
  - generateQueryHash() — SHA256 hash of query+conversation+persona
  - getCachedResponse() — Non-blocking cache lookup (silent fail)
  - cacheResponse() — Fire-and-forget cache storage

- `lib/supabase.ts` — **CRITICAL FIX**
  - Now uses direct createClient() calls
  - No more IIFE pattern (which evaluated at build time)
  - Real Supabase client created fresh at runtime

### Frontend Streaming
- `hooks/useChat.ts` — Client-side streaming consumption
  - Lines 266-295: Properly reads response.body with getReader()
  - TextDecoder correctly decodes chunks
  - State updates for each chunk received
  - Shows placeholder "🔄 Processando sua pergunta..." during processing

---

## Database
- Supabase PostgreSQL with RLS policies
- Tables: conversations, messages, documents, chat_response_cache, etc.
- Chat cache TTL: 24 hours default
- Migrations documented in `/docs/PHASE2_*.sql` files

---

## Recent Git Commit
**Commit 8d73bc5** (April 11, 2026)
```
Fix: Streaming responses for both cache hits and regular responses

- Cache hits now return streaming response instead of JSON (consistency)
- Cached responses chunked into 50-char pieces for smooth streaming
- Added X-Cache: HIT header for cache monitoring
- Improved logging: every 5 chunks instead of 10 for better diagnostics
```

---

## Expected Behavior After Fix

### Simple Questions (no web search)
Example: "Como posso aumentar minhas vendas?"
```
User sends message
↓ Shows placeholder: "🔄 Processando sua pergunta..."
↓ API starts streaming response immediately
↓ User sees text appearing character by character
↓ Typical latency: 2-5 seconds to first chunk, 5-10 seconds total
```

### Web Search Questions
Example: "Qual é a última notícia sobre FinTech?"
```
User sends message
↓ Shows placeholder: "🔄 Processando sua pergunta..."
↓ OpenAI detects need for web_search tool
↓ Tool execution happens (5-20 seconds depending on SerpAPI)
↓ Once tool completes, response streams back to user
↓ User sees sources cited with clickable links
↓ Total latency: 10-25 seconds (web search adds time)
```

### Cached Queries
Example: Same question asked twice
```
First query: Standard streaming (5-15s)
Second query: Cache HIT - returns cached response as stream (<1-2s)
  (Both show same streaming UI for consistency)
```

---

## Deployment Readiness Checklist

- [x] Build passes locally (npm run build)
- [x] Dev server runs successfully (npm run dev)
- [x] API responds with streaming headers
- [x] TypeScript types are correct
- [x] Cache streaming implemented
- [x] Tool calling logic in place
- [x] Error handling covers edge cases
- [x] Code committed and pushed
- [ ] **NEXT: Deploy to production with `vercel --prod`**
- [ ] Monitor streaming behavior for 24-48 hours
- [ ] Verify cache hit rates and error logs
- [ ] Get user feedback on response times

---

## Important Notes

### Why Web Search Takes So Long
When a web search is triggered:
1. User sees loading placeholder (correct feedback)
2. OpenAI calls web_search_tool
3. SerpAPI returns search results (5-20 seconds)
4. Tool callback processes results
5. OpenAI generates final response with search context
6. **THEN** response streams to user

This is correct behavior — tools must complete before response generation.

### Monitoring in Production
After each deployment, monitor:
- ✅ Error rates in Vercel logs
- ✅ Response time distribution (should peak at 5-15s)
- ✅ Cache hit rates (should be 30-50% after 1 week)
- ✅ User session stability
- ✅ Web search API rate limits (SerpAPI quota)
- ✅ Streaming header presence (Transfer-Encoding: chunked)

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Response appears all at once | Streaming headers not sent or client buffering | Check X-Cache header, verify Transfer-Encoding header |
| 10-20s wait with no feedback | Web search needed but placeholder not showing | Check ChatWindow component, verify placeholder message |
| Session breaks on refresh | Supabase client is dummy/invalid | Verify NEXT_PUBLIC_SUPABASE_URL and key in .env |
| Cache not working | chat_response_cache table missing | Run migration: PHASE2_RESPONSE_CACHING.sql |
| 404 on /api/chat | Route not built | Run: npm run build |

---

## Never Do This
❌ Work on c-lvls project (it's different)
❌ Deploy to wrong Vercel project
❌ Skip local testing before production deployment
❌ Forget to check git status before deploying
❌ Add large files to .env (should only have env var names)
❌ Disable streaming without discussing with user

---

## Key Contacts & Resources
- **User:** Bruno Amaral (project owner)
- **Explicit requirement:** "Faça testes, chamadas, requests.... antes de mandar pra produçao"
  (Do tests, calls, requests... before sending to production)
- **GitHub Issues:** https://github.com/brunoamaraldasilva/iasdedono/issues
- **Deployment:** Vercel (auto-deploy from main branch)

---

**Remember:** This file is your safety net. If you ever see "c-lvls" in the working directory, CHECK THIS FILE immediately!

Last updated: April 11, 2026 (Session 9)
