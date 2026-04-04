/**
 * useWebSearch Hook
 * Manages web search functionality with loading and error states
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SearchResult } from '@/lib/serpapi'

interface SearchResponse {
  success: boolean
  query: string
  results: SearchResult[]
  formatted: string
  error?: string
}

export function useWebSearch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (query: string): Promise<SearchResponse | null> => {
    try {
      setLoading(true)
      setError(null)

      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      // Call search API
      const response = await fetch('/api/search/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data: SearchResponse = await response.json()
      return data
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search error'
      setError(errorMsg)
      console.error('❌ [useWebSearch] Error:', errorMsg)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    search,
    loading,
    error,
  }
}
