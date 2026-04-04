import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Verify token and get current user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
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
        { error: 'Forbidden: Only admins can manage agents' },
        { status: 403 }
      )
    }

    // Parse request
    const { agentId } = await request.json()
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId' },
        { status: 400 }
      )
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Get current agent state
    const { data: agent, error: getError } = await supabaseAdmin
      .from('agents')
      .select('is_published, name')
      .eq('id', agentId)
      .single()

    if (getError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Toggle publish status
    const newStatus = !agent.is_published
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({ is_published: newStatus })
      .eq('id', agentId)

    if (updateError) throw updateError

    console.log('✅ [AGENTS] Published:', { agentId, newStatus })

    // Log audit action
    try {

      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
        admin_id: user.id,
        action: newStatus ? 'publish_agent' : 'unpublish_agent',
        resource_type: 'agent',
        resource_id: agentId,
        changes: {
          is_published: newStatus,
          agent_name: agent.name,
        },
      })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
    }

    return NextResponse.json({ success: true, is_published: newStatus })
  } catch (error) {
    console.error('Error toggling agent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
