# Web Search - Opções de APIs

## 🎯 Resumo Executivo

| Provider | Preço | Limite Gratuito | Qualidade | Recomendação |
|----------|-------|-----------------|-----------|--------------|
| **Bing Search API** | FREE | 1000 req/mês | Boa | ⭐⭐⭐ MVP |
| **Serper.dev** | $10-20/mês | 500 req/mês | Excelente | ⭐⭐⭐⭐ Melhor |
| **SerpAPI** | $20+/mês | 100 req/mês | Excelente | ⭐⭐ Caro |
| **DuckDuckGo** | FREE | Ilimitado* | Boa | ⭐ Lento |
| **Google Custom Search** | FREE | 100 req/dia | Excelente | ⭐⭐ Limitado |

---

## 📊 Análise Detalhada

### 1. **Bing Search API** (Recomendado para MVP Gratuito)

**Preço:** GRATUITO
- 1.000 queries/mês (ilimitado após isso, ~$7-20/mês)

**Vantagens:**
- ✅ Gratuito para começar
- ✅ Suporte oficial Microsoft
- ✅ Resultados de qualidade
- ✅ Sem limite de requisições após gratuito

**Desvantagens:**
- ❌ Interface mais complexa
- ❌ Requer conta Azure

**Setup:**
```
1. Ir para: https://portal.azure.com
2. Criar "Bing Search v7" resource
3. Copiar API Key
4. Usar em NODE.js com @azure/cognitiveservices-search-websearch
```

**Custo estimado:** FREE indefinidamente se < 1000 req/mês

---

### 2. **Serper.dev** (Melhor custo-benefício)

**Preço:**
- FREE: 500 queries/mês
- PAGO: $10/mês (5000 req) → $20/mês (25000 req)

**Vantagens:**
- ✅ Interface super simples
- ✅ Resultados excelentes
- ✅ Documentação clara
- ✅ Suporte rápido
- ✅ 500 free queries é razoável para MVP

**Desvantagens:**
- ❌ Precisa de cartão para account (mesmo free)
- ❌ Após 500 queries, precisa upgrade

**Setup:**
```
1. Ir para: https://serper.dev
2. Signup com email
3. Copiar API Key
4. Usar em NODE.js com fetch() direto
```

**Custo estimado:**
- MVP (< 500 req/mês): FREE
- Produção (500-5000 req/mês): $10/mês
- Escala (5000-25000 req/mês): $20/mês

---

### 3. **DuckDuckGo** (Gratuito total, mas lento)

**Preço:** GRATUITO (sem API oficial)

**Vantagens:**
- ✅ Completamente gratuito
- ✅ Sem limite
- ✅ Privacidade

**Desvantagens:**
- ❌ Sem API oficial (precisa scraping)
- ❌ Mais lento
- ❌ Pode quebrar com atualizações
- ❌ Rate limiting

**Setup:**
```
1. Usar biblioteca: ddg-node (não oficial)
2. Fazer scraping com cheerio
```

**Custo estimado:** FREE indefinidamente

---

### 4. **SerpAPI** (Premium)

**Preço:**
- FREE: 100 queries/mês
- PAGO: $20/mês (5000 req)

**Vantagens:**
- ✅ Resultados muito bons
- ✅ Suporte para Google, Bing, Yahoo, Baidu, etc
- ✅ Interface intuitiva

**Desvantagens:**
- ❌ Caro para MVP
- ❌ 100 free queries é pouco

**Custo estimado:** $20+/mês após free tier

---

### 5. **Google Custom Search** (Limitado)

**Preço:**
- FREE: 100 queries/dia (100 queries/dia max!)
- PAGO: $0.08/query após 100/dia

**Vantagens:**
- ✅ Resultados Google (excelente qualidade)
- ✅ Gratuito por dia

**Desvantagens:**
- ❌ MAX 100 queries/dia = inutilizável para produção
- ❌ Após 100, caro demais

**Custo estimado:** FREE (limitado), $2.40+/dia depois

---

## 🎯 Recomendação por Cenário

### **Para MVP (Não quer gastar)**
→ **Bing Search API**
- 1000 queries/mês grátis = suficiente para testar
- Depois escala com custo baixo

### **Para Produção Early (Melhor relação custo/benefício)**
→ **Serper.dev**
- 500 free/mês (teste)
- $10/mês (5000 req) é muito razoável
- Melhor interface e documentação

### **Se quer algo totalmente Free (sem setup)**
→ **DuckDuckGo**
- Gratuito forever
- Mas qualidade inferior e mais lento

### **Se quer máxima qualidade (pode gastar)**
→ **SerpAPI ou Serper.dev PAGO**
- Resultados premium
- Suporte dedicado

---

## 💡 Implementação Recomendada

**Fase 1 (MVP): Serper.dev FREE**
```
1. Signup em serper.dev (gratuito)
2. Copiar API Key
3. Adicionar em .env: SERPER_API_KEY=xxx
4. Implementar endpoint: POST /api/search/web
5. Testar com 10-20 queries/dia
6. Se passar dos 500/mês, upgrade para $10
```

**Fase 2 (Produção): Serper.dev PAGO ($10/mês)**
```
1. Confirmar que web search é feature core
2. Fazer upgrade para $10/mês (5000 req)
3. Escalar conforme demanda
```

---

## 🔧 Implementação Técnica (Serper.dev)

```typescript
// app/api/search/web/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    })

    const results = await response.json()

    return NextResponse.json({
      results: results.organic?.slice(0, 5).map((r: any) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
```

---

## 📋 Próximos Passos

1. **Escolher provider** (recomendação: Serper.dev)
2. **Signup e copiar API key**
3. **Adicionar .env: SERPER_API_KEY=xxx**
4. **Implementar `/api/search/web` endpoint**
5. **Integrar no chat** (toggle + mostrar sources)
6. **Testar com alguns queries**
