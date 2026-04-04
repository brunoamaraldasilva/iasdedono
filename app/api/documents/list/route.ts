// GET /api/documents/list
// List user's documents

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    console.log('📋 [DOCUMENTS] Listing documents')

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

    // Fetch documents
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, filename, file_size, file_type, processing_status, total_chunks, total_tokens, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [DOCUMENTS] Query failed:', error)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    console.log('✅ [DOCUMENTS] Found', documents?.length || 0, 'documents')

    return NextResponse.json({
      documents: documents || [],
      total: documents?.length || 0,
    })
  } catch (err) {
    console.error('❌ [DOCUMENTS] Error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
