import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id: agentId, materialId } = await params

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
        { error: 'Forbidden: Only admins can delete materials' },
        { status: 403 }
      )
    }

    // Get material details to check if file-based
    const { data: material, error: matError } = await supabase
      .from('agent_materials')
      .select('*')
      .eq('id', materialId)
      .eq('agent_id', agentId)
      .single()

    if (matError || !material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // Delete from Supabase storage if file-based
    if (material.is_file_based && material.file_path) {
      const adminClient = createAdminSupabaseClient()
      await adminClient.storage
        .from('agent_materials')
        .remove([material.file_path])
    }

    // Delete from database (using admin client to bypass RLS)
    const adminClient = createAdminSupabaseClient()
    const { error: deleteError } = await adminClient
      .from('agent_materials')
      .delete()
      .eq('id', materialId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting material:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
