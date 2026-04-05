import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const adminSupabase = createAdminSupabaseClient()

    // Get beta link and check expiration
    const { data: betaLink, error: betaError } = await adminSupabase
      .from('agent_beta_links')
      .select('*')
      .eq('beta_token', token)
      .single()

    if (betaError || !betaLink) {
      return NextResponse.json(
        { error: 'Beta link inválido ou expirado' },
        { status: 404 }
      )
    }

    // Check expiration
    if (betaLink.expires_at && new Date(betaLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Beta link expirado' },
        { status: 410 }
      )
    }

    // Get agent details
    const { data: agent, error: agentError } = await adminSupabase
      .from('agents')
      .select('*')
      .eq('id', betaLink.agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      agent,
      betaToken: token,
    })
  } catch (error) {
    console.error('[BETA] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
