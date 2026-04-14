# Whitelist API - Supabase PostgREST

## 🎯 Endpoint

```
POST https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist
```

---

## 🔑 Autenticação

Header obrigatório:
```
apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P
```

Content-Type:
```
Content-Type: application/json
```

---

## 📝 Adicionar 1 Email

### cURL

```bash
curl -X POST https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fulano@gmail.com",
    "status": "active",
    "metadata": {"source": "shopify", "plan": "pro"}
  }'
```

### JavaScript (Node.js / Fetch)

```javascript
const email = "fulano@gmail.com";
const response = await fetch('https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist', {
  method: 'POST',
  headers: {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: email,
    status: 'active',
    metadata: { source: 'shopify', plan: 'pro' }
  })
});

const result = await response.json();
console.log(result);
```

### Python

```python
import requests

url = 'https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist'
headers = {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
    'Content-Type': 'application/json',
}
data = {
    'email': 'fulano@gmail.com',
    'status': 'active',
    'metadata': {'source': 'shopify', 'plan': 'pro'}
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

---

## 📨 Adicionar Múltiplos Emails (Bulk)

### cURL

```bash
curl -X POST https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "email": "buyer1@example.com",
      "status": "active",
      "metadata": {"source": "shopify", "customer_id": "123"}
    },
    {
      "email": "buyer2@example.com",
      "status": "active",
      "metadata": {"source": "shopify", "customer_id": "456"}
    },
    {
      "email": "buyer3@example.com",
      "status": "inactive",
      "metadata": {"reason": "canceled_subscription"}
    }
  ]'
```

### JavaScript

```javascript
const emails = [
  { email: "buyer1@example.com", status: "active", metadata: { source: "shopify" } },
  { email: "buyer2@example.com", status: "active", metadata: { source: "shopify" } },
  { email: "buyer3@example.com", status: "inactive", metadata: { reason: "canceled" } },
];

const response = await fetch('https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist', {
  method: 'POST',
  headers: {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(emails)
});

const result = await response.json();
console.log(result);
```

---

## ✏️ Atualizar Email (Upsert)

Se o email já existe, ele **atualiza**. Se não existe, **cria novo**.

### cURL

```bash
curl -X POST https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fulano@gmail.com",
    "status": "inactive",
    "metadata": {"reason": "subscription_canceled", "date": "2026-04-12"}
  }'
```

---

## 📋 Estrutura de Dados

### Campo: email (obrigatório)
```
email: "fulano@gmail.com"  // string, deve ser email válido
```

### Campo: status (opcional, padrão: "active")
```
status: "active"      // usuário pode fazer signup
status: "inactive"    // bloqueia signup com mensagem de erro
```

### Campo: metadata (opcional)
```json
metadata: {
  "source": "shopify",              // onde veio (shopify, manual, etc)
  "plan": "pro",                    // qual plano comprou
  "customer_id": "123456",          // ID externo
  "imported_at": "2026-04-12T10:30:00Z",
  "reason": "subscription_canceled", // se inactive, por quê?
  "notes": "qualquer informação extra"
}
```

---

## ✅ Resposta de Sucesso

Se deu certo, o response é **vazio** (status 201/200).

Exemplo:
```
(empty response)
```

---

## ❌ Resposta de Erro

### Email inválido
```json
{
  "code": "23514",
  "details": "new row violates check constraint",
  "message": "Email must be valid"
}
```

### Email já existe (com upsert, não é erro)
```
(atualiza e retorna vazio)
```

### Erro de autenticação
```json
{
  "code": "401",
  "message": "Invalid API Key"
}
```

---

## 🔍 Listar Todos os Emails

### cURL

```bash
curl https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P"
```

### JavaScript

```javascript
const response = await fetch('https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist', {
  headers: {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
  }
});

const emails = await response.json();
console.log(emails);
```

### Resposta

```json
[
  {
    "email": "fulano@gmail.com",
    "status": "active",
    "metadata": {
      "source": "manual",
      "imported_at": "2026-04-12"
    },
    "created_at": "2026-04-12T10:30:00",
    "updated_at": "2026-04-12T10:30:00"
  },
  {
    "email": "buyer@shopify.com",
    "status": "active",
    "metadata": {
      "source": "shopify",
      "plan": "pro"
    },
    "created_at": "2026-04-12T11:00:00",
    "updated_at": "2026-04-12T11:00:00"
  }
]
```

---

## 🔎 Filtrar por Status

### Apenas emails ativos

```bash
curl "https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist?status=eq.active" \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P"
```

### Apenas emails inativos

```bash
curl "https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist?status=eq.inactive" \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P"
```

---

## 📊 Buscar por Email Específico

```bash
curl "https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist?email=eq.fulano@gmail.com" \
  -H "apikey: sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P"
```

Resposta:
```json
[
  {
    "email": "fulano@gmail.com",
    "status": "active",
    "metadata": {...},
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

## 🔧 Casos de Uso

### Caso 1: Shopify Webhook (Novo Cliente)

Quando alguém compra no Shopify, chama:

```javascript
// Shopify webhook handler
const customerEmail = body.customer.email;
const shopifyId = body.customer.id;

await fetch('https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist', {
  method: 'POST',
  headers: {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: customerEmail,
    status: 'active',
    metadata: {
      source: 'shopify',
      shopify_customer_id: shopifyId,
      imported_at: new Date().toISOString()
    }
  })
});
```

### Caso 2: Cancelamento de Assinatura

Quando cliente cancela, desativa:

```javascript
await fetch('https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist', {
  method: 'POST',
  headers: {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: customerEmail,
    status: 'inactive',
    metadata: {
      reason: 'subscription_canceled',
      canceled_date: new Date().toISOString()
    }
  })
});
```

### Caso 3: Import em Lote (CSV)

```javascript
const csvData = `
buyer1@example.com,active,shopify
buyer2@example.com,active,manual
buyer3@example.com,inactive,canceled
`;

const emails = csvData
  .trim()
  .split('\n')
  .map(line => {
    const [email, status, source] = line.split(',');
    return {
      email: email.trim(),
      status: status.trim(),
      metadata: { source: source.trim() }
    };
  });

await fetch('https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1/whitelist', {
  method: 'POST',
  headers: {
    'apikey': 'sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(emails)
});
```

---

## ⚙️ Configuração (Seu Time)

**Credenciais:**
- **Project ID:** `yxjrdgtjdyoevvjvgshu`
- **API Key:** `sb_publishable_3ntXOVoQxFmfVNfORE8eSQ_a5E4vI0P`
- **Endpoint Base:** `https://yxjrdgtjdyoevvjvgshu.supabase.co/rest/v1`

**Tabela:** `whitelist`

---

## 📞 Suporte

Para dúvidas sobre:
- **Integração:** Fale com seu desenvolvedor
- **Acesso:** Contate Bruno Amaral (dono do projeto)
- **Documentação Completa:** Ver `docs/WHITELIST_API_GUIDE.md`

---

**Última atualização:** 12 de Abril, 2026
