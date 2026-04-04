# SerpAPI vs Serper.dev - Análise Comparativa

**Cliente:** Já tem experiência com SerpAPI
**Objetivo:** Decidir qual provider usar para WebSearch em produção com 5K usuários

---

## 1. COMPARAÇÃO LADO A LADO

| Critério | SerpAPI | Serper.dev |
|----------|---------|-----------|
| **Preço base** | $50/mês (100 q/dia) | $10/mês (500 q/mês) |
| **Escalabilidade** | $150/mês (300 q/dia) | $50/mês (2500 q/mês) |
| **Scraping incluído** | ✅ Sim (Google, Bing, Baidu, etc) | ⚠️ Separado ($0.01 cada) |
| **Reliability** | 99.9% SLA | 99.5% SLA |
| **Response time** | 0.5-1s | 0.3-0.8s |
| **Rate limit** | Generous | Mais restritivo |
| **Documentation** | Excelente | Bom |
| **Suporte** | Email + chat | Email |
| **Customização** | Alta (múltiplos parâmetros) | Básica |

---

## 2. POR QUE SERPAPI PODE SER MELHOR PARA VOCÊS

### 2.1 Vantagens SerpAPI

✅ **Já tem integração pronta** - Cliente conhece a API
✅ **Scraping nativo** - Não paga extra por conteúdo de URLs
✅ **Múltiplas engines** - Google, Bing, Baidu, Yahoo, DuckDuckGo
✅ **Structured data** - Retorna organic results bem estruturados
✅ **Reliable** - 99.9% uptime (importante em produção)
✅ **Batch processing** - Pode enviar N queries e processar depois

### 2.2 Exemplos de Uso Real

```typescript
// SerpAPI response é muito bem estruturado
{
  organic_results: [
    {
      position: 1,
      title: "...",
      snippet: "...",
      link: "...",
      rating: 4.5,
      review_count: 120
    }
  ],
  knowledge_graph: { ... },
  related_searches: [ ... ],
  people_also_ask: [ ... ]
}

// Perfeito pra injetar no prompt da IA
// Já vem limpo e estruturado
```

---

## 3. ESTRATÉGIA DE CUSTOS COM SERPAPI

### 3.1 Plano Recomendado por Fase

```
SOFT LAUNCH (100-500 users):
  Plan: $50/mês (100 queries/dia)
  Estimativa de uso: 30-50 queries/dia (com cache)
  Status: ✅ Sobra muita capacidade
  Cost per query: $0.50/query (high, pero...OK pra MVP)

GROWTH (500-1K users):
  Plan: $100/mês (200 queries/dia)
  Estimativa: 100-150 queries/dia (com cache)
  Status: ⚠️ Borderline, considerar upgrade
  Cost per query: $0.50/query

SCALE (1K-5K users):
  Plan: $150/mês (300 queries/dia)
  Estimativa: 200-250 queries/dia (com cache)
  Status: ✅ Seguro, ~20% margem
  Cost per query: $0.50/query

5K USERS (FULL SCALE):
  Plan: $200/mês (500 queries/dia via contato)
  Estimativa: 400-450 queries/dia (com cache)
  Status: ✅ Confortável
  Cost per query: $0.40/query (negociar volume)
```

### 3.2 Comparison: SerpAPI vs Serper.dev em Cenários

**Cenário 5K Users (Realista):**

```
SERPAPI:
  Plan: $150/mês (300 q/dia)
  Cache hit rate: 70%
  Queries novas/dia: 450 × 0.3 = 135 q/dia
  Cost: $150/mês = $0.03/user/mês

SERPER.DEV:
  Plan: $50/mês (2500 q/mês)
  Cache hit rate: 70%
  Queries novas/dia: 450 × 0.3 = 135 q/dia
  Queries/mês: 135 × 30 = 4,050
  ❌ Precisa plan maior ($150/mês para 25K q/mês)
  Cost: $150/mês = $0.03/user/mês

✅ EMPATE: Mesmo custo no final! Mas SerpAPI mais confiável.
```

---

## 4. IMPLEMENTAÇÃO RECOMENDADA COM SERPAPI

### 4.1 Arquitetura

```typescript
// lib/serpapi.ts
import axios from 'axios'

const SERPAPI_KEY = process.env.SERPAPI_API_KEY
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function searchGoogle(query: string) {
  // 1. Check cache
  const cached = await getCachedResult(query)
  if (cached) {
    console.log('✅ Cache hit:', query)
    return cached
  }

  // 2. Rate limit check
  const canSearch = await checkRateLimit()
  if (!canSearch) {
    console.log('⚠️ Rate limit exceeded, using fallback')
    return null // Graceful fallback
  }

  // 3. Call SerpAPI
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: query,
        api_key: SERPAPI_KEY,
        engine: 'google',
        num: 5, // Top 5 results
        gl: 'br', // Brazil
      },
    })

    const results = response.data.organic_results.map(r => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link,
      position: r.position,
    }))

    // 4. Cache result
    await cacheResult(query, results, CACHE_TTL)

    // 5. Log to audit
    await logSearchUsage(query, results.length)

    return results
  } catch (error) {
    console.error('❌ SerpAPI error:', error)
    return null
  }
}

// Rate limiting
async function checkRateLimit(userId: string) {
  const today = new Date().toDateString()
  const key = `search_limit:${userId}:${today}`
  const count = await redis.get(key)

  if (count && parseInt(count) >= 10) { // 10 queries/day per user
    return false
  }

  await redis.incr(key)
  await redis.expire(key, 86400)
  return true
}
```

### 4.2 Banco de Dados

```sql
-- Cache de resultados
CREATE TABLE web_search_cache (
  id UUID PRIMARY KEY,
  query_hash TEXT UNIQUE NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  hits INT DEFAULT 0,
  INDEX idx_expires_at (expires_at),
  INDEX idx_query_hash (query_hash)
);

-- Rate limiting
CREATE TABLE web_search_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  query TEXT NOT NULL,
  results_count INT,
  cost DECIMAL(8, 4), -- SerpAPI cost
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_date (user_id, created_at)
);

-- Audit de custos
CREATE TABLE web_search_billing (
  id UUID PRIMARY KEY,
  period_date DATE UNIQUE,
  total_queries INT,
  total_cost DECIMAL(10, 2),
  cache_hits INT,
  cache_hit_rate DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. RECOMENDAÇÃO FINAL

### ✅ USE SERPAPI SE:
- Cliente já tem experiência
- Quer scraping nativo (sem custo extra)
- Precisa múltiplas search engines (Google + Bing + Baidu)
- Value reliability/uptime
- Já tem SDK implementado

### ✅ USE SERPER.DEV SE:
- Quer minimal cost (mais barato em volumes pequenos)
- Só precisa Google search
- MVP rápido (cheaper to start)
- Pode ficar sem service por algumas horas

---

## 6. PROPOSTA PARA CLIENTE

**Recomendação:** Usar **SerpAPI** baseado em:

1. **Já tem experience** - Reduz risk de integração
2. **Scraping incluído** - Não paga extra
3. **Reliability 99.9%** - Critical pra produção
4. **Cost neutralidade** - Mesmo custo de Serper.dev em scale

**Plan sugerido:**

```
Phase 1 (MVP - 100 users):        $50/mês (SerpAPI Basic)
Phase 2 (Growth - 500 users):      $100/mês (SerpAPI Standard)
Phase 3 (Scale - 5K users):        $150-200/mês (SerpAPI Pro + negociar)
```

**Com caching inteligente:**
- 70% cache hit rate = $0.03 cost per user
- Graceful fallback se atingir limite
- Não quebra feature se API falhar

---

## 7. PRÓXIMOS PASSOS

```
[ ] 1. Confirmar com cliente: SerpAPI vs Serper.dev?
[ ] 2. Se SerpAPI: Pegar API key
[ ] 3. Implementar web_search_cache table
[ ] 4. Implementar /api/search/web endpoint
[ ] 5. Implementar rate limiting por usuário
[ ] 6. Integrar no chat (com toggle "Usar Web Search")
[ ] 7. Monitoring de custos (SerpAPI dashboard)
[ ] 8. A/B testing: sem search vs com search
```

---

## RESUMO

| Aspecto | Decisão |
|---------|---------|
| **Provider** | ✅ SerpAPI (pela experience) |
| **Custo estimado** | $150/mês em 5K users |
| **ROI** | $0.03 por user = Very low risk |
| **Timeline** | Semana 3-4 implementar |
| **Fallback** | Cache + LLM knowledge se falhar |
