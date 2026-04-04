import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
        { error: 'Forbidden: Only admins can access dashboard' },
        { status: 403 }
      )
    }

    // Get days parameter
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7')

    // Calculate cutoff date
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    console.log('📊 [DASHBOARD-API] Loading messages from:', cutoffDate)

    // Create admin client for RLS bypass
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Query messages with admin client (bypasses RLS)
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('created_at')
      .eq('role', 'user')
      .gte('created_at', cutoffDate)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ [DASHBOARD-API] Chart data error:', error)
      return NextResponse.json(
        { error: 'Error loading chart data' },
        { status: 500 }
      )
    }

    console.log('📊 [DASHBOARD-API] Total messages loaded:', messages?.length || 0)

    if (!messages || messages.length === 0) {
      console.log('⚠️ [DASHBOARD-API] No user messages in period')
      return NextResponse.json({
        messages: [],
        total: 0,
      })
    }

    // Group by date
    const groupedData: Record<string, number> = {}
    messages.forEach((msg) => {
      const dateOnly = msg.created_at.substring(0, 10)
      const [year, month, day] = dateOnly.split('-')
      const date = `${day}/${month}/${year}`
      groupedData[date] = (groupedData[date] || 0) + 1
    })

    console.log('📊 [DASHBOARD-API] Grouped data:', groupedData)

    // Convert to array and sort by date
    const chartArray = Object.entries(groupedData)
      .map(([date, count]) => {
        const [day, month, year] = date.split('/')
        const sortKey = `${year}-${month}-${day}`
        return {
          date,
          sortKey,
          messages: count,
        }
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ date, messages }) => ({ date, messages }))

    console.log('📊 [DASHBOARD-API] Final chart array:', chartArray)

    return NextResponse.json({
      messages: chartArray,
      total: messages.length,
    })
  } catch (error) {
    console.error('❌ [DASHBOARD-API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
