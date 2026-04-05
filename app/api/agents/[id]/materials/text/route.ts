import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Get auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify user
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse JSON body
    const body = await request.json()
    const { title, content, type } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminSupabaseClient()

    // Verify agent exists
    const { data: agent } = await adminSupabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get current max order
    const { data: maxOrderData } = await adminSupabase
      .from('agent_materials')
      .select('order')
      .eq('agent_id', agentId)
      .order('order', { ascending: false })
      .limit(1)

    const maxOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order + 1 : 0

    // Insert material
    const materialId = uuidv4()
    const { data: material, error: materialError } = await adminSupabase
      .from('agent_materials')
      .insert([
        {
          id: materialId,
          agent_id: agentId,
          title,
          content,
          type,
          order: maxOrder,
          is_file_based: false,
          extraction_status: 'completed',
        },
      ])
      .select()
      .single()

    if (materialError) {
      console.error('[MATERIALS] DB insert error:', materialError)
      throw new Error('Failed to save material: ' + materialError.message)
    }

    console.log('[MATERIALS] Text material created:', material.id)

    return NextResponse.json(material)
  } catch (error) {
    console.error('[MATERIALS] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create material: ' + message },
      { status: 500 }
    )
  }
}
