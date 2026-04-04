import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Verify token and get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
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
        { error: 'Forbidden: Only admins can update users' },
        { status: 403 }
      )
    }

    // Parse request body
    const { userId, status, role } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

    if (!status && !role) {
      return NextResponse.json(
        { error: 'Must provide status or role to update' },
        { status: 400 }
      )
    }

    // Prepare update object
    const updateData: Record<string, string> = {}
    if (status) updateData.status = status
    if (role) updateData.role = role

    // Create admin client for operations that bypass RLS
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Update user (use admin client to bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('❌ [USERS] Update failed:', updateError)
      throw updateError
    }

    console.log('✅ [USERS] Updated:', { userId, updateData })

    // Log audit action
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: user.id,
          action: status ? 'update_user_status' : 'update_user_role',
          resource_type: 'user',
          resource_id: userId,
          changes: {
            [status ? 'status' : 'role']: status || role,
          },
        })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json(
      { message: 'User updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
