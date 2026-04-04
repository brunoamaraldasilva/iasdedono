// POST /api/documents/upload
// Upload a PDF or CSV file and start processing

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [UPLOAD] Starting document upload (conversation-scoped)')

    // Step 1: Authenticate user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const authHeader = request.headers.get('Authorization') || ''

    console.log('🔐 [UPLOAD] Auth header present:', !!authHeader)

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) {
      console.error('❌ [UPLOAD] Auth failed:', authError?.message || 'No user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ [UPLOAD] User authenticated:', user.id)

    // Step 2: Parse form data FIRST to get conversationId
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const conversationId = formData.get('conversationId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    console.log('💬 [UPLOAD] Conversation ID:', conversationId)

    // TODO: Enable rate limiting in production
    // const rateLimitCheck = rateLimit(`upload:${user.id}`, 20, 3600000)
    // if (!rateLimitCheck.success) {
    //   return NextResponse.json(
    //     { error: 'Too many uploads. Please wait before uploading again.' },
    //     { status: 429 }
    //   )
    // }

    // Step 3: Validate conversation ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      console.error('❌ [UPLOAD] Conversation not found:', conversationId)
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (conversation.user_id !== user.id) {
      console.error('❌ [UPLOAD] Access denied to conversation:', conversationId)
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    console.log('✅ [UPLOAD] Conversation verified')

    console.log('📄 [UPLOAD] File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // Step 4: Validate file
    const fileTypeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'text/csv': 'csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xlsx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
    }

    const fileType = fileTypeMap[file.type] || null
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!fileType) {
      return NextResponse.json(
        { error: 'Only PDF, CSV, XLSX, and DOCX files are supported' },
        { status: 400 }
      )
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Step 5: Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const documentId = crypto.randomUUID()

    // Sanitize filename for Supabase Storage (remove accents, special chars)
    const sanitizedFileName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .toLowerCase()

    const filePath = `${user.id}/${documentId}/${sanitizedFileName}`

    console.log('💾 [UPLOAD] Uploading to storage:', filePath)

    // Use service role for storage upload to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: { persistSession: false },
    })

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('❌ [UPLOAD] Storage upload failed:', uploadError)
      console.error('❌ [UPLOAD] Upload error details:', {
        message: uploadError.message,
        status: uploadError.status,
        statusCode: (uploadError as any).statusCode,
      })
      return NextResponse.json(
        {
          error: 'Failed to upload file to storage',
          details: uploadError.message
        },
        { status: 500 }
      )
    }

    // Step 6: Create document record (status: pending)
    console.log('📝 [UPLOAD] Creating document record')
    console.log('📝 [UPLOAD] Insert data:', {
      user_id: user.id,
      filename: file.name,
      file_size: file.size,
      file_type: fileType,
      file_path: filePath,
      processing_status: 'pending',
    })

    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert([
        {
          user_id: user.id,
          conversation_id: conversationId,
          filename: file.name,
          file_size: file.size,
          file_type: fileType,
          file_path: filePath,
          processing_status: 'pending',
        },
      ])
      .select()
      .single()

    if (insertError || !document) {
      console.error('❌ [UPLOAD] Document record failed:', insertError)
      console.error('❌ [UPLOAD] Insert error details:', {
        message: insertError?.message,
        code: (insertError as any)?.code,
      })
      // Try to clean up the uploaded file
      await supabase.storage.from('documents').remove([filePath])
      return NextResponse.json(
        { error: 'Failed to create document record', details: insertError?.message },
        { status: 500 }
      )
    }

    // Step 7: Extract text from document
    console.log('📖 [UPLOAD] Extracting text from', fileType)

    try {
      const {
        extractTextFromPDF,
        extractTextFromCSV,
        extractTextFromXLSX,
        extractTextFromDOCX
      } = await import('@/lib/documentProcessing')

      let extractedText: string
      if (fileType === 'pdf') {
        extractedText = await extractTextFromPDF(buffer)
      } else if (fileType === 'csv') {
        extractedText = await extractTextFromCSV(buffer)
      } else if (fileType === 'xlsx') {
        extractedText = await extractTextFromXLSX(buffer)
      } else if (fileType === 'docx' || fileType === 'doc') {
        extractedText = await extractTextFromDOCX(buffer)
      } else {
        throw new Error(`Unsupported file type: ${fileType}`)
      }

      // Update document with extracted text (use admin client to bypass RLS)
      const { error: updateError } = await supabaseAdmin
        .from('documents')
        .update({
          extracted_text: extractedText,
          processing_status: 'completed',
        })
        .eq('id', document.id)

      if (updateError) {
        console.error('❌ [UPLOAD] Update with text failed:', updateError)
        throw new Error(`Failed to update document: ${updateError.message}`)
      }

      console.log('✅ [UPLOAD] Text extracted:', extractedText.length, 'chars')
    } catch (extractErr) {
      console.error('❌ [UPLOAD] Text extraction failed:', extractErr)
      const errorMsg = extractErr instanceof Error ? extractErr.message : 'Extraction failed'

      // Update status to error (use admin client)
      await supabaseAdmin
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: errorMsg,
        })
        .eq('id', document.id)
    }

    return NextResponse.json(
      {
        success: true,
        documentId: document.id,
        status: 'completed',
        message: 'File uploaded.',
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('❌ [UPLOAD] Unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
