import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify user via Supabase auth
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token)

    if (authError || !user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin Supabase for DB operations
    const supabase = createServerSupabaseClient()

    // Check user role is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can create beta links' },
        { status: 403 }
      )
    }

    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Check for existing beta link
    const { data: existingBeta } = await supabase
      .from('agent_beta_links')
      .select('*')
      .eq('agent_id', id)
      .maybeSingle()

    if (existingBeta) {
      return NextResponse.json({
        beta_token: existingBeta.beta_token,
        url: `/beta/${existingBeta.beta_token}`,
      })
    }

    // Create new beta link
    const betaToken = randomUUID()

    const { data: betaLink, error: betaError } = await supabase
      .from('agent_beta_links')
      .insert([
        {
          agent_id: id,
          beta_token: betaToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        },
      ])
      .select()
      .single()

    if (betaError) throw betaError

    return NextResponse.json({
      beta_token: betaLink.beta_token,
      url: `/beta/${betaLink.beta_token}`,
    })
  } catch (error) {
    console.error('Error creating beta link:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify user via Supabase auth
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token)

    if (authError || !user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin Supabase for DB operations
    const supabase = createServerSupabaseClient()

    // Check user role is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get beta link
    const { data: betaLink, error: betaError } = await supabase
      .from('agent_beta_links')
      .select('*')
      .eq('agent_id', id)
      .maybeSingle()

    if (betaError) throw betaError

    if (!betaLink) {
      return NextResponse.json(
        { error: 'No beta link found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      beta_token: betaLink.beta_token,
      url: `/beta/${betaLink.beta_token}`,
      created_at: betaLink.created_at,
      expires_at: betaLink.expires_at,
    })
  } catch (error) {
    console.error('Error fetching beta link:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
