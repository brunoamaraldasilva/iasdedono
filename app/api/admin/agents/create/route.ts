import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
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
        { error: 'Forbidden: Only admins can create agents' },
        { status: 403 }
      )
    }

    // Parse request
    const { name, description, system_prompt } = await request.json()
    if (!name || !description || !system_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Create agent
    const { data: agent, error: createError } = await supabaseAdmin
      .from('agents')
      .insert([
        {
          name,
          description,
          system_prompt,
          created_by: user.id,
          is_published: false,
          is_beta: false,
        },
      ])
      .select()
      .single()

    if (createError) throw createError

    console.log('✅ [AGENTS] Created:', { agentId: agent.id, name })

    // Log audit action
    try {

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'create_agent',
        resource_type: 'agent',
        resource_id: agent.id,
        changes: {
          name,
          description,
        },
      })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
    }

    return NextResponse.json({ success: true, data: agent })
  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
