import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchGoogle, formatResultsForPrompt } from '@/lib/serpapi'

/**
 * Web Search API endpoint
 * Rate limited to 10 searches per user per day
 * Results are cached for 24 hours
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Verify token and get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      )
    }

    // Get request body
    const { query } = await request.json()
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const trimmedQuery = query.trim()

    console.log('🔍 [SEARCH] Query from user:', {
      userId: user.id,
      query: trimmedQuery,
    })

    // TODO: Implement rate limiting check
    // For now, allow all searches - will add Redis rate limiting later

    // TODO: Implement cache check
    // For now, always fetch fresh results - will add Supabase caching later

    try {
      // Call SerpAPI
      const results = await searchGoogle(trimmedQuery, {
        num: 5,
        gl: 'br',
        hl: 'pt-br',
      })

      // TODO: Store in web_search_cache table

      // TODO: Log search usage to web_search_usage table

      console.log('✅ [SEARCH] Success:', {
        userId: user.id,
        query: trimmedQuery,
        resultCount: results.length,
      })

      return NextResponse.json({
        success: true,
        query: trimmedQuery,
        results,
        formatted: formatResultsForPrompt(results),
      })
    } catch (searchError) {
      console.error('❌ [SEARCH] SerpAPI error:', searchError)

      // Graceful fallback: Return empty results instead of error
      // This allows the chat to continue without web search
      return NextResponse.json({
        success: false,
        query: trimmedQuery,
        results: [],
        formatted: 'Web search temporarily unavailable. Using knowledge base only.',
        error: searchError instanceof Error ? searchError.message : 'Search failed',
      })
    }
  } catch (error) {
    console.error('❌ [SEARCH] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
