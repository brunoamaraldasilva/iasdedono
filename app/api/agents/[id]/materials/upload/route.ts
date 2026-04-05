import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { extractTextFromFile } from '@/lib/documentProcessing'

// Create admin client for file operations
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

    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify user is admin (check Supabase auth)
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify agent exists
    const adminSupabase = createAdminSupabaseClient()
    const { data: agent, error: agentError } = await adminSupabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = (formData.get('title') as string) || file.name
    const type = (formData.get('type') as string) || 'resource'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 400 }
      )
    }

    const ALLOWED_TYPES = [
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, CSV, XLSX, or DOCX' },
        { status: 400 }
      )
    }

    // Generate IDs
    const materialId = uuidv4()
    const fileBuffer = await file.arrayBuffer()
    const fileExtension = file.name.split('.').pop() || 'file'
    const storagePath = 'agents/' + agentId + '/' + materialId + '/' + file.name

    console.log('[MATERIALS] Uploading file:', {
      agentId,
      materialId,
      filename: file.name,
      size: file.size,
      type: file.type,
      storagePath,
    })

    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[MATERIALS] Storage upload error:', uploadError)
      throw new Error('Storage upload failed: ' + uploadError.message)
    }

    console.log('[MATERIALS] File uploaded successfully')

    // Extract text from file
    console.log('[MATERIALS] Extracting text from file...')
    let extractedText = ''
    try {
      extractedText = await extractTextFromFile(file)
      console.log('[MATERIALS] Text extracted:', extractedText.substring(0, 100) + '...')
    } catch (extractError) {
      console.error('[MATERIALS] Extraction error:', extractError)
      extractedText = '[Error extracting content]'
    }

    // Limit extracted text to 10000 chars
    extractedText = extractedText.substring(0, 10000)

    // Insert material record
    const { data: material, error: materialError } = await adminSupabase
      .from('agent_materials')
      .insert([
        {
          id: materialId,
          agent_id: agentId,
          type,
          title,
          content: extractedText,
          order: 0,
          file_path: storagePath,
          file_type: fileExtension,
          is_file_based: true,
          file_size: file.size,
          extraction_status: 'completed',
        },
      ])
      .select()
      .single()

    if (materialError) {
      console.error('[MATERIALS] DB insert error:', materialError)
      throw new Error('Failed to save material: ' + materialError.message)
    }

    console.log('[MATERIALS] Material created:', material.id)

    return NextResponse.json(material)
  } catch (error) {
    console.error('[MATERIALS] Upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Upload failed: ' + message },
      { status: 500 }
    )
  }
}
