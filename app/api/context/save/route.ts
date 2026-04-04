import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const authHeader = request.headers.get('Authorization') || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { persistSession: false },
    })

    // Prepare data (ensure no arrays)
    const contextData = {
      business_name: body.business_name || null,
      business_type: body.business_type || null,
      description: body.description || null,
      industry: body.industry || null,
      annual_revenue: body.annual_revenue || null,
      team_size: body.team_size || null,
      founded_year: body.founded_year || null,
      main_goals: body.main_goals || null,
      main_challenges: body.main_challenges || null,
      target_market: body.target_market || null,
      main_competitors: body.main_competitors || null,
    }

    console.log('💾 [CONTEXT] Saving for user:', user.id)
    console.log('💾 [CONTEXT] Data:', contextData)

    // Try UPDATE first
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('business_context')
      .update(contextData)
      .eq('user_id', user.id)
      .select()

    // Check for update errors
    if (updateError) {
      console.error('❌ [CONTEXT] Update error:', updateError)
      return NextResponse.json(
        { error: `Failed to save context: ${(updateError as any)?.message || 'Update failed'}` },
        { status: 500 }
      )
    }

    // If no rows updated, do INSERT
    if (!updateData || updateData.length === 0) {
      console.log('📝 [CONTEXT] No record found, inserting new...')

      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('business_context')
        .insert([{ ...contextData, user_id: user.id }])
        .select()

      if (insertError) {
        console.error('❌ [CONTEXT] Insert error:', insertError)
        return NextResponse.json(
          { error: `Failed to save context: ${(insertError as any)?.message || 'Insert failed'}` },
          { status: 500 }
        )
      }

      console.log('✅ [CONTEXT] Inserted successfully')
      return NextResponse.json({
        success: true,
        data: insertData?.[0],
        completion_percentage: insertData?.[0]?.completion_percentage || 0,
      })
    }

    console.log('✅ [CONTEXT] Updated successfully')
    return NextResponse.json({
      success: true,
      data: updateData[0],
      completion_percentage: updateData[0]?.completion_percentage || 0,
    })
  } catch (err) {
    console.error('❌ [CONTEXT] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
