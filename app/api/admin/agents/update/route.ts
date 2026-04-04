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
        { error: 'Forbidden: Only admins can update agents' },
        { status: 403 }
      )
    }

    // Parse request
    const { agentId, name, description, system_prompt } = await request.json()
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

    // Get agent info for logging
    const { data: agent, error: getError } = await supabaseAdmin
      .from('agents')
      .select('name, description, system_prompt')
      .eq('id', agentId)
      .single()

    if (getError) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, string> = {}
    if (name) updateData.name = name
    if (description) updateData.description = description
    if (system_prompt) updateData.system_prompt = system_prompt

    // Update agent
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update(updateData)
      .eq('id', agentId)

    if (updateError) throw updateError

    console.log('✅ [AGENTS] Updated:', { agentId, updateData })

    // Log audit action
    try {

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'update_agent',
        resource_type: 'agent',
        resource_id: agentId,
        changes: {
          name: name !== agent.name ? name : undefined,
          description: description !== agent.description ? description : undefined,
          system_prompt: system_prompt !== agent.system_prompt ? '(atualizado)' : undefined,
        },
      })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
