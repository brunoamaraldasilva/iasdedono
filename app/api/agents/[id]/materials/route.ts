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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    const adminSupabase = createAdminSupabaseClient()

    // Get materials for agent
    const { data: materials, error } = await adminSupabase
      .from('agent_materials')
      .select('*')
      .eq('agent_id', agentId)
      .order('order', { ascending: true })

    if (error) {
      console.error('[MATERIALS] Load error:', error)
      throw error
    }

    return NextResponse.json(materials || [])
  } catch (error) {
    console.error('[MATERIALS] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load materials' },
      { status: 500 }
    )
  }
}
