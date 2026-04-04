import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
        { error: 'Forbidden: Only admins can access this' },
        { status: 403 }
      )
    }

    // Get pagination params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const ITEMS_PER_PAGE = 50

    console.log('📋 [ADMIN LIST] Query params:', { page, search, roleFilter, statusFilter })

    // Build query
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (search) {
      query = query.ilike('email', `%${search}%`)
    }
    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    // Apply pagination
    const from = (page - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    const { data: users, count, error: queryError } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (queryError) throw queryError

    return NextResponse.json(
      {
        users: users || [],
        total: count || 0,
        page,
        itemsPerPage: ITEMS_PER_PAGE,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
