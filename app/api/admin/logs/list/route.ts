import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Simple in-memory cache for audit logs (5 minute TTL)
const logsCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
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

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || adminUser?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can access logs' },
        { status: 403 }
      )
    }

    // Get pagination params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const actionFilter = searchParams.get('action') || 'all'
    const resourceFilter = searchParams.get('resource') || 'all'
    const ITEMS_PER_PAGE = 50

    // Build cache key
    const cacheKey = `logs:${page}:${actionFilter}:${resourceFilter}`

    // Check cache
    const cached = logsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📋 [AUDIT LOGS] Cache hit for:', cacheKey)
      return NextResponse.json(cached.data)
    }

    // Create admin client for RLS bypass
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Build query using admin client to bypass RLS
    // Use estimated count instead of exact for better performance
    let query = supabaseAdmin
      .from('admin_audit_logs')
      .select('id, admin_id, action, resource_type, resource_id, created_at', { count: 'estimated' })

    // Apply filters
    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter)
    }
    if (resourceFilter !== 'all') {
      query = query.eq('resource_type', resourceFilter)
    }

    // Apply pagination
    const from = (page - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    const { data: logs, count, error: queryError } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (queryError) throw queryError

    console.log('📋 [AUDIT LOGS] Read by admin:', {
      adminId: user.id,
      page,
      resultsCount: logs?.length || 0,
      totalCount: count || 0,
    })

    const responseData = {
      logs: logs || [],
      total: count || 0,
      page,
      itemsPerPage: ITEMS_PER_PAGE,
    }

    // Store in cache
    logsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    })

    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    console.error('Error reading audit logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
