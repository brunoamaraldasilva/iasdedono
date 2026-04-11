/**
 * Document Summarization for RAG Optimization
 * Converts full document content (2000+ tokens) to concise summaries (200 tokens)
 * This reduces context window size while preserving key information
 */

import OpenAI from 'openai'
import { encodingForModel } from 'js-tiktoken'
import { createServerSupabaseClient } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const enc = encodingForModel('gpt-4o-mini')

/**
 * Summarize a document to approximately 200 tokens
 * Preserves numbers, dates, and critical information
 */
export async function summarizeDocument(
  content: string,
  documentTitle: string,
  targetTokens: number = 200
): Promise<{ summary: string; tokens: number }> {
  try {
    console.log(`📄 [SUMMARIZE] Starting summary for: ${documentTitle}`)

    const prompt = `Resume o documento a seguir em Português. Mantenha números, datas e informações críticas.

Documento: ${documentTitle}

Alvo: aproximadamente ${targetTokens} tokens (cerca de ${Math.round(targetTokens * 0.75)} palavras).

IMPORTANTE:
- Preserve números, percentuais, e datas exatamente
- Mantenha precisão técnica
- Use bullet points para clareza
- Se financeiro: destaque métricas-chave
- Se plano: liste objetivos principais

Conteúdo:
${content.substring(0, 4000)}

Forneça APENAS o resumo, sem preâmbulo.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: targetTokens + 100,
    })

    const summary = response.choices[0]?.message?.content || ''
    const tokens = enc.encode(summary).length

    console.log(`✅ [SUMMARIZE] Complete: ${tokens} tokens`)
    return { summary, tokens }
  } catch (error) {
    console.error(`❌ [SUMMARIZE] Error:`, error)
    throw new Error(`Failed to summarize document: ${error}`)
  }
}

/**
 * Summarize all documents with pending status
 * Processes in batches of 5 to avoid rate limits
 */
export async function summarizeExistingDocuments(): Promise<{
  processed: number
  failed: number
  totalTimeMs: number
}> {
  const start = Date.now()
  let processed = 0
  let failed = 0

  try {
    const supabase = createServerSupabaseClient()

    // Get all documents pending summarization
    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, filename, extracted_text')
      .eq('summary_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error
    if (!docs?.length) {
      console.log('[SUMMARIZE] No documents to summarize')
      return { processed: 0, failed: 0, totalTimeMs: 0 }
    }

    console.log(`📋 [SUMMARIZE] Found ${docs.length} documents to summarize`)

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < docs.length; i += 5) {
      const batch = docs.slice(i, i + 5)
      const promises = batch.map(async (doc) => {
        try {
          const { summary, tokens } = await summarizeDocument(
            doc.extracted_text || '',
            doc.filename,
            250
          )

          await supabase
            .from('documents')
            .update({
              summary,
              summary_tokens: tokens,
              summary_status: 'completed',
              summarized_at: new Date().toISOString(),
            })
            .eq('id', doc.id)

          processed++
          console.log(`✅ Summarized: ${doc.filename} (${tokens} tokens)`)
        } catch (err) {
          failed++
          console.error(`❌ Failed to summarize ${doc.filename}:`, err)

          await supabase
            .from('documents')
            .update({
              summary_status: 'error',
              summary: `[Summary failed: ${err}]`,
            })
            .eq('id', doc.id)
        }
      })

      await Promise.all(promises)
      console.log(`⏳ Batch complete: ${i + batch.length}/${docs.length}`)
    }

    const totalTimeMs = Date.now() - start
    console.log(
      `✅ [SUMMARIZE] Complete: ${processed} success, ${failed} failed, ${totalTimeMs}ms`
    )
    return { processed, failed, totalTimeMs }
  } catch (error) {
    console.error(`❌ [SUMMARIZE] Fatal error:`, error)
    throw error
  }
}
