/**
 * SerpAPI Integration
 * Handles web search requests with caching and rate limiting
 */

import axios from 'axios'

const SERPAPI_KEY = process.env.SERPAPI_API_KEY
const SERPAPI_BASE_URL = 'https://serpapi.com/search'

export interface SearchResult {
  position: number
  title: string
  snippet: string
  link: string
}

export interface SerpAPIResponse {
  searchParameters: {
    q: string
    type: string
    engine: string
  }
  answerBox?: {
    answer: string
    source: string
  }
  knowledgeGraph?: {
    title: string
    description: string
    attributes: Record<string, string>
  }
  organic_results: SearchResult[]
  related_searches?: Array<{
    query: string
  }>
  peopleAlsoAsk?: Array<{
    question: string
    snippet: string
    link: string
  }>
}

/**
 * Search Google via SerpAPI
 * @param query - Search query
 * @param options - Additional options (language, location, etc)
 * @returns Array of search results
 */
export async function searchGoogle(
  query: string,
  options?: {
    num?: number // Number of results (default: 5)
    gl?: string // Country code (default: 'br')
    hl?: string // Language (default: 'pt-br')
    recency?: 'day' | 'week' | 'month' | 'year' | 'any' // Default: 'month' (2026 preferred)
  }
): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) {
    throw new Error('SERPAPI_API_KEY not configured')
  }

  try {
    console.log('🔍 [SERPAPI] Searching:', query)

    // Map recency options to SerpAPI tbs parameter
    // tbs = "time-based search"
    const recencyMap = {
      day: 'qdr:d',   // Last 24 hours
      week: 'qdr:w',  // Last week
      month: 'qdr:m', // Last month (DEFAULT - prefers 2026)
      year: 'qdr:y',  // Last year
      any: undefined, // No time restriction
    }

    const tbs = recencyMap[options?.recency || 'month']

    const response = await axios.get<SerpAPIResponse>(SERPAPI_BASE_URL, {
      params: {
        q: query,
        api_key: SERPAPI_KEY,
        engine: 'google',
        num: options?.num || 5,
        gl: options?.gl || 'br',
        hl: options?.hl || 'pt-br',
        ...(tbs && { tbs }), // Only include tbs if defined
      },
    })

    const results = response.data.organic_results
      .slice(0, options?.num || 5)
      .map(result => ({
        position: result.position,
        title: result.title,
        snippet: result.snippet,
        link: result.link,
      }))

    const recencyLabel = options?.recency || 'month'
    console.log(`✅ [SERPAPI] Found ${results.length} results (filtered: last ${recencyLabel})`)
    return results
  } catch (error) {
    console.error('❌ [SERPAPI] Error:', error)
    throw error
  }
}

/**
 * Get full SerpAPI response with all enrichments
 * Useful for debugging or getting knowledge graph, people also ask, etc
 */
export async function searchGoogleFull(
  query: string,
  options?: {
    num?: number
    gl?: string
    hl?: string
  }
): Promise<SerpAPIResponse | null> {
  if (!SERPAPI_KEY) {
    throw new Error('SERPAPI_API_KEY not configured')
  }

  try {
    const response = await axios.get<SerpAPIResponse>(SERPAPI_BASE_URL, {
      params: {
        q: query,
        api_key: SERPAPI_KEY,
        engine: 'google',
        num: options?.num || 5,
        gl: options?.gl || 'br',
        hl: options?.hl || 'pt-br',
      },
    })

    return response.data
  } catch (error) {
    console.error('❌ [SERPAPI] Full search error:', error)
    return null
  }
}

/**
 * Format search results for LLM injection
 * Returns a string that can be injected into the prompt
 */
export function formatResultsForPrompt(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'Nenhum resultado encontrado.'
  }

  const formatted = results
    .map((r, i) => `${i + 1}. "${r.title}"\n   ${r.snippet}\n   Link: ${r.link}`)
    .join('\n\n')

  return `Resultados da busca na web:\n\n${formatted}`
}

/**
 * Calculate hash of query for caching
 */
export function hashQuery(query: string): string {
  const hash = require('crypto').createHash('sha256').update(query).digest('hex')
  return hash
}
