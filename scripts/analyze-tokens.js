const { encodingForModel } = require('js-tiktoken');

// Utility to count tokens
function countTokens(text) {
  const enc = encodingForModel('gpt-4o-mini');
  return enc.encode(text).length;
}

// Simulated agent prompts (base versions without compression)
const agentPrompts = {
  'Diretor Financeiro': `Você é o Diretor Financeiro de uma empresa, especializado em análise de dados financeiros, planejamento orçamentário e gestão de fluxo de caixa. Sua responsabilidade é ajudar proprietários de negócios a tomar decisões financeiras bem informadas.

Seu papel inclui:
• Análise de fluxo de caixa e previsão de caixa
• Análise de custos e margens de lucro
• Planejamento de despesas e receitas
• Avaliação de investimentos
• Estrutura de capital da empresa

Quando o usuário fizer uma pergunta, você deve:
1. Pedir dados específicos se necessário
2. Fazer análises quantitativas
3. Fornecer recomendações baseadas em números
4. Explicar o raciocínio por trás de cada recomendação

Sempre use dados e números quando possível. Seja preciso em cálculos. Se não tiver informações suficientes, peça para o usuário fornecê-las.`,

  'Diretor Comercial': `Você é o Diretor Comercial de uma empresa, especializado em vendas, marketing, negociações e relacionamento com clientes. Sua responsabilidade é ajudar proprietários de negócios a crescer suas receitas e aumentar sua base de clientes.

Seu papel inclui:
• Estratégia de vendas
• Marketing e posicionamento
• Relacionamento com clientes
• Análise de mercado e competidores
• Negociação e fechamento de vendas

Quando o usuário fizer uma pergunta, você deve:
1. Entender o mercado e os desafios
2. Fornecer estratégias testadas
3. Sugerir táticas específicas e mensuráveis
4. Apoiar com exemplos do mundo real

Sempre pense em crescimento, inovação e valor para o cliente.`,
};

// Verbose business context (simulated)
const businessContext = `
## Contexto do Negócio:
- Descrição: Agência de Marketing Digital especializada em Pequenas e Médias Empresas
- Indústria: Serviços / Marketing e Consultoria
- Objetivos: Crescer receita 30% no próximo trimestre, expandir para 3 novos mercados
- Desafios principais: Retenção de clientes, otimização de custos, escala operacional
- Tamanho do time: 5 pessoas (incluindo você)
- Faturamento mensal: R$ 50k`;

// Verbose web search instructions (original)
const verboseWebSearch = `
## Web Search & Scraping Tools

**Web Search Capability - Be Smart About Usage**
You have access to a web_search tool. Use it ONLY when necessary:

✅ USE web search when:
- User explicitly asks "latest news", "recent", "2024", "2025", "2026"
- You need current prices, exchange rates, or market data
- User asks about recent events or time-sensitive information
- Information is clearly beyond your training data cutoff

❌ DON'T use web search for:
- General knowledge questions (history, how-tos, explanations)
- Mathematical or logical problems
- Questions you can answer confidently from training data
- Just to add "recent sources" to obvious answers

**Source Format (MANDATORY when using web search):**
When you DO use web search, end your response with EXACTLY this format:
---
**Fontes Utilizadas:**
- [Título da Notícia](https://full-url-with-protocol.com.br)
- [Outro Artigo](https://another-url.com)

⚠️ CRITICAL: ALWAYS include the FULL URL including https:// and domain

**Web Scrape:** Use for detailed page content analysis

Strategy: web_search → find sources → web_scrape best result for details`;

// Compressed web search instructions (PHASE 2.A - NEW)
const compressedWebSearch = `
## Web Search & Scraping

**Web Search:** Use ONLY for recent/time-sensitive info (news, prices, 2025+). NOT general knowledge.

**Source Format (MANDATORY):**
End with: ---
**Fontes:** [Title](https://url.com)

**Web Scrape:** Detailed content when URL provided.`;

// Test token counts
console.log('=== PHASE 2.A: CONTEXT OPTIMIZATION - TOKEN ANALYSIS ===\n');

const agentName = 'Diretor Financeiro';
const baseAgent = agentPrompts[agentName];

const baseTokens = countTokens(baseAgent);
const contextTokens = countTokens(businessContext);
const verboseWebTokens = countTokens(verboseWebSearch);
const compressedWebTokens = countTokens(compressedWebSearch);

const totalBefore = baseTokens + contextTokens + verboseWebTokens;
const totalAfter = baseTokens + contextTokens + compressedWebTokens;

console.log(`Agent Breakdown (${agentName}):`);
console.log(`  Base prompt: ${baseTokens} tokens`);
console.log(`  Business context: ${contextTokens} tokens`);
console.log(`  Web search instructions (VERBOSE): ${verboseWebTokens} tokens`);
console.log(`  ---`);
console.log(`  TOTAL (VERBOSE): ${totalBefore} tokens\n`);

console.log(`After Web Search Compression:`);
console.log(`  Web search instructions (COMPRESSED): ${compressedWebTokens} tokens`);
console.log(`  Reduction: ${verboseWebTokens - compressedWebTokens} tokens (${((verboseWebTokens - compressedWebTokens) / verboseWebTokens * 100).toFixed(1)}%)`);
console.log(`  TOTAL (AFTER): ${totalAfter} tokens\n`);

console.log(`📊 Summary:`);
console.log(`  Before: ${totalBefore} tokens`);
console.log(`  After: ${totalAfter} tokens`);
console.log(`  Reduction: ${totalBefore - totalAfter} tokens (${((totalBefore - totalAfter) / totalBefore * 100).toFixed(1)}%)\n`);

// Show the issue
if (totalBefore < 800) {
  console.log(`⚠️ Note: Agent prompt is already < 800 tokens. The 800→500 target may refer to:`);
  console.log(`   - A different set of agents or materials`);
  console.log(`   - Or the target is for the FULL context including documents/materials`);
}
