import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service key not configured' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // Get all agents
    const { data: agents, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('id, name, system_prompt')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const documentAccessNotice = `Quando documentos são anexados à conversa, você tem acesso total ao seu conteúdo completo (extraído do PDF ou arquivo original). Use-os quando forem relevantes para responder.

`

    const updates = []

    for (const agent of agents || []) {
      // Skip if already has document notice
      if (agent.system_prompt.includes('Quando documentos são anexados')) {
        console.log(`⏭️ Agent "${agent.name}" already updated, skipping`)
        continue
      }

      // Add document access notice at the beginning
      const updatedPrompt = documentAccessNotice + agent.system_prompt

      const { error: updateError } = await supabaseAdmin
        .from('agents')
        .update({ system_prompt: updatedPrompt })
        .eq('id', agent.id)

      if (updateError) {
        console.error(`❌ Failed to update agent "${agent.name}":`, updateError)
        updates.push({
          id: agent.id,
          name: agent.name,
          status: 'error',
          error: updateError.message,
        })
      } else {
        console.log(`✅ Updated agent "${agent.name}"`)
        updates.push({
          id: agent.id,
          name: agent.name,
          status: 'success',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.filter(u => u.status === 'success').length} agents`,
      updates,
    })
  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
