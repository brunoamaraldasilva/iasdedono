import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    console.log('💬 [CONVERSATIONS] Creating new conversation')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      },
    })

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, agent_id } = await request.json()

    // If agent_id not provided, try to get the first existing agent
    let finalAgentId = agent_id

    if (!finalAgentId) {
      const { data: agents, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .limit(1)

      if (agents && agents.length > 0) {
        finalAgentId = agents[0].id
      } else {
        // If no agents exist, create a default one
        const defaultAgent = {
          id: crypto.randomUUID(),
          name: 'Default Agent',
          description: 'Default agent for conversations',
          created_by: user.id,
        }

        const { data: created, error: createAgentError } = await supabase
          .from('agents')
          .insert([defaultAgent])
          .select()
          .single()

        if (createAgentError || !created) {
          console.error('❌ [CONVERSATIONS] Failed to create default agent:', createAgentError)
          return NextResponse.json(
            { error: 'Failed to setup agent' },
            { status: 500 }
          )
        }

        finalAgentId = created.id
      }
    }

    const conversationData = {
      user_id: user.id,
      agent_id: finalAgentId,
      title: title || 'New Chat',
    }

    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert([conversationData])
      .select()
      .single()

    if (createError || !conversation) {
      console.error('❌ [CONVERSATIONS] Create failed:', JSON.stringify(createError))
      console.error('❌ [CONVERSATIONS] Data sent:', conversationData)
      return NextResponse.json(
        { error: 'Failed to create conversation', details: createError?.message },
        { status: 500 }
      )
    }

    console.log('✅ [CONVERSATIONS] Created:', conversation.id)

    return NextResponse.json({
      success: true,
      conversation,
    })
  } catch (err) {
    console.error('❌ [CONVERSATIONS] Error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
