# Análise de Infraestrutura e Custos - c-lvls para 5K Usuários

**Data:** 4 de Abril de 2026
**Objetivo:** Definir estratégia de WebSearch, Vercel, Supabase e OpenAI API para escalabilidade até 5K usuários

---

## 1. WEB SEARCH - Opções e Estratégia

### 1.1 Provedores Disponíveis

| Provider | Preço | QPS | Limit Free | Recomendação |
|----------|-------|-----|-----------|--------------|
| **Serper.dev** | $10-50/mês (500-2500 queries) | 100 | 100 free | ⭐ Melhor custo/benefício |
| **SerpAPI** | $50/mês (100 queries/dia) | - | 100 free | ✅ Estável, Scraping |
| **Google Custom Search** | $100/ano (10K queries) | - | 100 free/dia | ❌ Caro, muita burocracia |
| **Bing Search API** | $7/1000 queries | - | 0 free | ✅ Barato mas lento |
| **DuckDuckGo API** | Free (rate limited) | 1 | - | ❌ Rate limited severo |

**Recomendação:** **Serper.dev** (melhor relação custo-benefício até 5K usuários)

### 1.2 Estratégia de Rate Limiting & Caching

```typescript
// Proposta: Implementar estratégia em camadas

1. LIMITE POR USUÁRIO (rate limit Supabase)
   - Free tier: 2 web searches/dia
   - Premium: 10 web searches/dia
   - Enterprise: Ilimitado

2. CACHE GLOBAL (Redis/Supabase)
   - Query → Hash da query
   - Resultados cacheados por 24h
   - Compartilhado entre usuários (privacidade OK)
   - Economia: ~60-70% das queries redundantes

3. CACHE INTELIGENTE
   - Queries populares (trending topics) = 7 dias
   - Queries normais = 1 dia
   - Queries very specific (nomes de pessoas/empresas) = sem cache

4. FALLBACK
   - Se atingir limite Serper → cache ou não fazer search
   - Não quebra a aplicação
```

### 1.3 Cenário de Uso Real

**Estimativa conservadora:**
- 5K usuários ativos
- ~30% fazem pelo menos 1 search/dia = 1.5K buscas/dia
- Com cache (70% hit rate) = 450 buscas/dia novas
- **Cost: Serper $10-15/mês (500 queries planilha)**

---

## 2. CUSTOS POR CENÁRIO DE USUÁRIOS ATIVOS

### 2.1 Breakdown de Custos

#### **CENÁRIO 1: 100 Usuários**
```
Supabase:        $0 (free tier: 500MB storage, 2M pgbouncer transactions)
Vercel:          $0 (hobby: 100 deployments/day, unlimited serverless)
OpenAI:          ~$20/mês (1M tokens/mês ÷ 100 users)
Web Search:      $10/mês (500 queries Serper)
────────────────────────────────
TOTAL:           ~$30/mês
Cost per user:   $0.30/mês
```

#### **CENÁRIO 2: 500 Usuários**
```
Supabase:        $25/mês (Pro: 8GB storage, unlimited pgbouncer)
Vercel:          $20/mês (Pro: 50GB bandwidth, priority support)
OpenAI:          ~$80/mês (4M tokens/mês ÷ 500 users)
Web Search:      $15/mês (1000 queries com cache hit)
────────────────────────────────
TOTAL:           ~$140/mês
Cost per user:   $0.28/mês
```

#### **CENÁRIO 3: 1K Usuários**
```
Supabase:        $50/mês (Pro + add-ons: compute, storage)
Vercel:          $50/mês (Pro + extra bandwidth)
OpenAI:          ~$150/mês (7M tokens/mês ÷ 1K users)
Web Search:      $25/mês (1500 queries com cache)
────────────────────────────────
TOTAL:           ~$275/mês
Cost per user:   $0.27/mês
```

#### **CENÁRIO 4: 5K Usuários**
```
Supabase:        $200/mês (Team Plan: 200GB, 32vCPU, dedicated resources)
Vercel:          $200/mês (Enterprise: 1TB bandwidth, 1000 concurrent builds)
OpenAI:          ~$600/mês (30M tokens/mês ÷ 5K users)
Web Search:      $50/mês (2500 queries com cache)
────────────────────────────────
TOTAL:           ~$1,050/mês
Cost per user:   $0.21/mês

*** Potencial Revenue: $5K × $29/mês = $145K/mês (com 12x markup)
```

---

## 3. OPENAI TOKENS - Breakdown Detalhado

### 3.1 Tokens por Tipo de Requisição

```
CHAT SIMPLES (sem RAG):
  Input:  ~800 tokens (system prompt + contexto + histórico)
  Output: ~300 tokens (resposta média)
  Total:  ~1,100 tokens/msg ≈ $0.018/msg

CHAT COM RAG (documentos):
  Input:  ~2,500 tokens (system + 3 docs + contexto + histórico)
  Output: ~400 tokens (resposta com fontes)
  Total:  ~2,900 tokens/msg ≈ $0.047/msg

CHAT COM WEB SEARCH:
  Input:  ~1,800 tokens (system + 3 snippets + histórico)
  Output: ~350 tokens
  Total:  ~2,150 tokens/msg ≈ $0.035/msg

TRANSCRIPTION (Whisper):
  ~60 segundos de áudio = $0.60/transcrição
```

### 3.2 Estimativa por Cenário (5K usuários)

```
Cenário CONSERVADOR (30% ativos, 2 msgs/dia, sem RAG):
  5K × 0.3 × 2 × 1,100 tokens = 3.3M tokens/dia
  = 99M tokens/mês
  = $1,485/mês

Cenário REALISTA (50% ativos, 3 msgs/dia, 20% com RAG):
  5K × 0.5 × 3 × (1,100 × 0.8 + 2,900 × 0.2) = 5.7M tokens/dia
  = 171M tokens/mês
  = $2,565/mês

Cenário AGRESSIVO (70% ativos, 5 msgs/dia, 40% com RAG, 20% com web search):
  5K × 0.7 × 5 × (1,100 × 0.4 + 2,900 × 0.4 + 2,150 × 0.2) = 10.3M tokens/dia
  = 309M tokens/mês
  = $4,635/mês
```

---

## 4. VERCEL - Plano Recomendado por Fase

### 4.1 Escalabilidade Vercel

| Aspecto | Hobby | Pro | Enterprise |
|---------|-------|-----|-----------|
| **Custo** | $0 | $20 | Custom |
| **Concurrent Builds** | 1 | 1 | 4+ |
| **Bandwidth** | 100GB | 1TB | Unlimited |
| **Serverless Execution** | 60s timeout | 900s timeout | Custom |
| **Edge Middleware** | ✓ | ✓ | ✓ |
| **Priority Support** | ✗ | ✓ | ✓ |

### 4.2 Timeline Recomendada

```
HOJE (100-500 users):     Hobby ($0)  → Pro ($20) quando atingir 300 users
PRÓXIMO MÊS (500-1K):     Pro ($20)
3 MESES (1K-3K):          Pro ($20) + extras ou Enterprise
6 MESES (3K-5K):          Enterprise ($200+) com SLA

⚠️ Considerar usar Vercel Functions + Fluid Compute (não Edge Functions)
   - Edge = compatibilidade limitada
   - Fluid = Node.js completo, melhor para ML/heavy workloads
```

---

## 5. SUPABASE - Plano Recomendado

### 5.1 Bottlenecks por Fase

```
FREE TIER (até 50K MAU):
  ✅ Suficiente para MVP/beta (até 500 usuários)
  ❌ Problema: 500MB storage, RLS lento em queries grandes

PRO TIER ($25/mês):
  ✅ 8GB storage, unlimited pgbouncer, 100K MAU
  ✅ Priority support
  ⚠️ RLS ainda pode ficar lenta em queries complexas (1K+ usuarios)

TEAM TIER ($250/mês):
  ✅ 200GB storage, 32vCPU, dedicated resources
  ✅ Real-time replication, 1M MAU
  ✅ Melhor performance RLS
  ✅ Better para 5K+ usuarios
```

### 5.2 Estratégia para 5K Usuários

```
1. ÍNDICES CRÍTICOS:
   - messages(conversation_id, created_at DESC) → chats rápidos
   - users(email) UNIQUE → login rápido
   - admin_audit_logs(created_at DESC) → logs rápidos
   - documents(user_id, created_at DESC) → lista docs rápida

2. PARTITIONING:
   - messages table → particionar por conversation_id (para 5K users)
   - Reduce query scan time em 70-80%

3. VACUUMING:
   - Automático no Supabase
   - Importante rodar manual 1x/mês em Pro tier

4. CACHING ESTRATÉGICO:
   - Cache GET endpoints → Redis (se usar Team tier)
   - Resultado: -70% database load
```

---

## 6. PROPOSTA FINAL: ESTRATÉGIA WEB SEARCH

### 6.1 Arquitetura Recomendada

```typescript
// Fluxo Smart WebSearch

1. USER FAZ PERGUNTA
   ↓
2. HASH QUERY + 24h TTL
   ├─ Cache hit? → Return cached results (instant)
   └─ Cache miss? → Continue...
   ↓
3. CHECK RATE LIMIT
   ├─ Limit exceeded? → Use cached or fail gracefully
   └─ Limit OK? → Continue...
   ↓
4. SERPER API CALL
   ├─ Error? → Fallback to LLM knowledge
   └─ Success? → Cache + continue...
   ↓
5. SCRAPE TOP 3 RESULTS
   ├─ Store in document_cache
   └─ Embed snippets (optional)
   ↓
6. INJECT INTO PROMPT
   ├─ System: "Use these web results if relevant"
   └─ Stream response

COST OPTIMIZATION:
- 70% cache hit rate = 70% cost reduction
- Rate limiting = prevent abuse/overcost
- Graceful degradation = doesn't break if API fails
```

### 6.2 Implementação Sugerida

```sql
-- Tabela de cache de web search
CREATE TABLE web_search_cache (
  id UUID PRIMARY KEY,
  query_hash TEXT UNIQUE NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- 24h later
  hits INT DEFAULT 0, -- track popularity
  INDEX idx_expires_at (expires_at)
);

-- Tabela de rate limits
CREATE TABLE web_search_limits (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  searches_today INT DEFAULT 0,
  reset_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 day'),
  tier TEXT DEFAULT 'free', -- free, pro, enterprise
  limit_per_day INT DEFAULT 2 -- escalable
);
```

---

## 7. ROADMAP RECOMENDADO

```
SEMANA 1-2 (NOW):
  ✅ Terminar admin interface (logs, agents) ← DONE
  ⏳ Implementar WebSearch v1 (Serper + simple caching)

SEMANA 3-4:
  ⏳ Document upload + RAG (já parcial)
  ⏳ Smart caching strategy

SEMANA 5-6 (SOFT LAUNCH - 100 users):
  ⏳ QA/Testing completo
  ⏳ Performance benchmarking
  ⏳ Cost monitoring setup

SEMANA 7-8 (SOFT LAUNCH - 500 users):
  ⏳ Scale to Pro Vercel ($20)
  ⏳ Scale to Pro Supabase ($25)
  ⏳ Monitor OpenAI costs ($50-100/mês)

MÊS 2-3 (SCALE - 1K users):
  ⏳ WebSearch optimization
  ⏳ Database indexing/partitioning
  ⏳ Consider Team Supabase ($250) se RLS lento

MÊS 4+ (GROWTH - 5K users):
  ⏳ Enterprise Vercel ($200)
  ⏳ Team Supabase ($250)
  ⏳ OpenAI cost optimization (batch API?)
  ⏳ Consider competitors pricing
```

---

## 8. PONTOS-CHAVE PARA DISCUSSÃO AMANHÃ

1. **WebSearch Trade-off**: Free (DuckDuckGo rate limited) vs Paid (Serper/SerpAPI)?
2. **Caching Strategy**: Supabase table vs Redis (Team tier)?
3. **OpenAI Costs**: Aceitar $600+/mês em cenário 5K ou otimizar?
4. **Revenue Model**: Qual o plano de monetização para cobrir infraestrutura?
5. **Phases**: Ir passo a passo ou já pensar em arquitetura pronta pra 5K?

---

## RESUMO EXECUTIVO

| Métrica | 100 Users | 500 Users | 1K Users | 5K Users |
|---------|-----------|-----------|----------|----------|
| **Infra/mês** | $30 | $140 | $275 | $1,050 |
| **OpenAI/mês** | $20 | $80 | $150 | $600-2,600 |
| **WebSearch/mês** | $10 | $15 | $25 | $50 |
| **Cost per user** | $0.30 | $0.28 | $0.27 | $0.21 |
| **Breakeven** (@ $29/mês) | 300 users start lucrar | ~500+ lucra | ~1K+ lucra | Muito lucrativo |

**Conclusão:** Modelo é escalável e lucrativo se charge $29/mês. WebSearch via Serper é viável com caching.
