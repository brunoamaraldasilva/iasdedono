# 📋 AUDITORIA: Prompts + Materiais dos Agentes

**Data:** 13 Abril 2026
**Status:** ⚠️ GAPS ENCONTRADOS

---

## 1️⃣ PROMPTS ATUAIS (lib/prompts.ts)

### **Diretor Comercial**
```
Você é um Diretor Comercial experiente com expertise profunda em Marketing e Vendas.
Sua responsabilidade é ajudar a empresa a crescer através de estratégias comerciais efetivas.

Ao analisar as questões do usuário:
- Considere sempre o contexto do negócio fornecido
- Foque em go-to-market, customer acquisition, retenção, e expansão
- Forneça recomendações práticas e acionáveis
- Baseie-se em dados e métricas quando possível
- Sugira KPIs relevantes para acompanhamento

Mantenha uma abordagem consultiva, fazendo perguntas quando necessário para melhor compreender o contexto.
```

**Problemas identificados:**
- ❌ Ultra padronizado (parece IA genérica)
- ❌ Sem tom "Sábio + Rebelde"
- ❌ Sem exemplos práticos
- ❌ Sem nuance sobre estágios do negócio
- ✅ Considera contexto do negócio (bom!)

---

### **Diretor Financeiro**
```
Você é um Diretor Financeiro experiente com expertise em Gestão Financeira e Análise de Custos.
Sua responsabilidade é garantir saúde financeira e otimização de recursos da empresa.

Ao analisar as questões do usuário:
- Considere sempre o contexto do negócio fornecido
- Foque em análise de custos, fluxo de caixa, previsões e estrutura de capital
- Forneça recomendações práticas baseadas em números
- Sugira métricas financeiras relevantes (burn rate, runway, ROI, etc)
- Considere cenários de diferentes taxas de crescimento

Mantenha uma abordagem analítica e orientada a números.
```

**Problemas identificados:**
- ❌ Mesmo padrão genérico
- ❌ Sem exemplos reais
- ❌ Sem tom conversacional
- ✅ Menciona métricas (bom!)

---

### **Diretor de Gente**
```
Você é um Diretor de Gente experiente com expertise em RH, Cultura Organizacional e Desenvolvimento de Pessoas.
Sua responsabilidade é garantir que o time esteja engajado, desenvolvido e alinhado com os objetivos da empresa.

Ao analisar as questões do usuário:
- Considere sempre o contexto do negócio fornecido
- Foque em cultura organizacional, retenção, desenvolvimento, e escalabilidade do time
- Forneça recomendações práticas sobre estrutura, processos e people management
- Sugira estratégias para engajamento e retenção de talentos
- Considere os desafios de crescimento e escalabilidade

Mantenha uma abordagem humanizada mas orientada a resultados.
```

**Problemas identificados:**
- ❌ Mesmo padrão genérico
- ❌ Sem exemplos
- ✅ Tenta ter tom humanizado (mas falha)

---

## 2️⃣ MATERIAIS DOS AGENTES (agent_materials)

### **Status Atual**

✅ **Tabela existe:** `agent_materials` com:
- `id` (UUID)
- `agent_id` (FK para agents)
- `material_type` (text, file)
- `title`
- `content`
- `file_path`
- `created_at`

✅ **APIs funcionam:**
- `GET /api/agents/[id]/materials` - Listar materiais
- `POST /api/agents/[id]/materials/upload` - Upload de arquivo
- `POST /api/agents/[id]/materials/text` - Adicionar texto

❌ **PROBLEMA CRÍTICO:**
**Os materiais NÃO estão sendo carregados no chat!**

### **Fluxo Atual do Chat**
```
1. User envia mensagem
2. API carrega:
   - ✅ agent.system_prompt (de lib/prompts.ts ou tabela agents)
   - ✅ business_context (Contexto do Negócio do usuário)
   - ✅ recent messages (últimas 7)
   - ❌ agent_materials (NÃO CARREGADO!)
3. Envia pro OpenAI
4. Response
```

### **Onde deveriam ser carregados**
Arquivo: `app/api/chat/route.ts` linhas 119-144

Deveria adicionar depois do contexto:
```typescript
// Carregar materiais do agente
let agentMaterialsText = ''
if (agentId) {
  const { data: materials } = await supabase
    .from('agent_materials')
    .select('title, content')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  if (materials && materials.length > 0) {
    agentMaterialsText = `\n\n## Materiais do Agente:\n`
    materials.forEach(m => {
      agentMaterialsText += `\n### ${m.title}\n${m.content}\n`
    })
    systemPrompt += agentMaterialsText
  }
}
```

---

## 3️⃣ INJEÇÃO DE CONTEXTO NO PROMPT

### **Fluxo Atual**
```
system_prompt
    ↓
+ business_context (nome, tipo, receita, team_size, goals, challenges, additional_info)
    ↓
[FALTA] + agent_materials (deveria vir aqui!)
    ↓
final_prompt enviado pro OpenAI
```

### **Ordem Recomendada**
```
1. Base prompt (quem é, ton, como responder)
2. Contexto do negócio do usuário (tamanho, receita, desafios)
3. Materiais do agente (exemplos, dados, frameworks)
4. Mensagens anteriores da conversa
```

---

## 4️⃣ ELEMENTOS CRÍTICOS A PRESERVAR

### **NÃO REMOVER:**
- ✅ Injeção de `business_context` (crucial para personalização)
- ✅ Tool instructions para web_search, web_scrape
- ✅ Instruções sobre formato de fonte (Fontes Utilizadas)
- ✅ Carregamento de `agent.system_prompt` do banco

### **ADICIONAR:**
- ✅ Carregamento de `agent_materials`
- ✅ Tom "Sábio + Rebelde" (direto, prático, conversacional)
- ✅ Exemplos concretos por agente
- ✅ Melhor contextualização de estágio do negócio

### **MODIFICAR:**
- ✅ Estrutura dos prompts (menos listas, mais conversacional)
- ✅ Reduzir tamanho (respostas longas → concisas)
- ✅ Adicionar tom Rony Meisler (documento a revisar)

---

## 5️⃣ DOCUMENTAÇÃO DE RONY MEISLER

**Arquivo:** `/Users/amaral.bruno/Downloads/DOCUMENTO DE APRENDIZADO_ LINGUAGEM RONY MEISLER.docx`

**Próximo:** Extrair padrões de linguagem e incorporar nos prompts

---

## 6️⃣ PLANO DE AÇÃO

### **ANTES DE REFATORAR:**

✅ **FASE 1 - Implementar carregamento de materiais** (15 min)
- Modificar `app/api/chat/route.ts`
- Injetar `agent_materials` no systemPrompt
- Testar se IA consegue acessar os materiais

✅ **FASE 2 - Verificar lógica de tools** (10 min)
- Confirmar que web_search, web_scrape, document_upload estão funcionando
- Debug se necessário

✅ **FASE 3 - Reestruturar prompts** (120 min)
- Estudar documento de Rony Meisler
- Reescrever cada prompt com novo tom
- Adicionar exemplos contextualizados
- Testar qualidade das respostas

---

## 7️⃣ CHECKLIST ANTES DO DEPLOY

- [ ] Agent materials estão sendo carregados
- [ ] Tools funcionam corretamente (web search, web scrape)
- [ ] Document upload funciona
- [ ] Prompts refatorados com tom Sábio + Rebelde
- [ ] Respostas não ultrapassam 4 parágrafos
- [ ] Contexto do negócio está sendo considerado
- [ ] Nenhuma lógica crítica foi removida
- [ ] Conversation starters funcionam
- [ ] Context page tem botão salvar
- [ ] Tudo testado localmente

---

**Status:** 🟡 PRONTO PARA FASE 1 (Carregar materiais)
