import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * POST /api/admin/whitelist/import
 * Bulk import emails into whitelist for external systems
 *
 * Security: Requires ADMIN_API_KEY in Authorization header
 * Rate limit: 1000 emails per request, 10 requests per minute
 */

interface ImportEmail {
  email: string
  status?: 'active' | 'inactive'
  metadata?: Record<string, unknown>
}

interface ImportRequest {
  emails: ImportEmail[]
}

interface ImportResult {
  success: boolean
  imported: number
  updated: number
  failed: number
  errors: Array<{ email: string; error: string }>
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  try {
    // ============================================================================
    // STEP 1: Verify Admin API Key
    // ============================================================================
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    const adminApiKey = process.env.ADMIN_API_KEY
    if (!adminApiKey || !apiKey || apiKey !== adminApiKey) {
      console.warn('🔐 [WHITELIST-IMPORT] Unauthorized access attempt')
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [{ email: '', error: 'Invalid or missing ADMIN_API_KEY' }]
        },
        { status: 401 }
      )
    }

    // ============================================================================
    // STEP 2: Parse and validate request body
    // ============================================================================
    let body: ImportRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [{ email: '', error: 'Invalid JSON body' }],
        },
        { status: 400 }
      )
    }

    if (!body.emails || !Array.isArray(body.emails)) {
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [{ email: '', error: 'Missing "emails" array in request body' }],
        },
        { status: 400 }
      )
    }

    // ============================================================================
    // STEP 3: Validate email count (max 1000 per request)
    // ============================================================================
    if (body.emails.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [{ email: '', error: 'Maximum 1000 emails per request' }],
        },
        { status: 400 }
      )
    }

    // ============================================================================
    // STEP 4: Connect to Supabase (admin/service role)
    // ============================================================================
    const supabase = createServerSupabaseClient()

    // ============================================================================
    // STEP 5: Import emails
    // ============================================================================
    const errors: Array<{ email: string; error: string }> = []
    let imported = 0
    let updated = 0
    let failed = 0

    // Normalize emails and validate format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validatedEmails = body.emails
      .filter((item) => {
        if (!item.email) {
          errors.push({ email: item.email || '', error: 'Empty email' })
          failed++
          return false
        }
        if (!emailRegex.test(item.email)) {
          errors.push({ email: item.email, error: 'Invalid email format' })
          failed++
          return false
        }
        return true
      })
      .map((item) => ({
        ...item,
        email: item.email.toLowerCase().trim(),
        status: (item.status || 'active') as 'active' | 'inactive',
      }))

    console.log(
      `📨 [WHITELIST-IMPORT] Starting import: ${validatedEmails.length} valid emails, ${errors.length} invalid`
    )

    // ============================================================================
    // STEP 6: Upsert to database (batch insert/update)
    // ============================================================================
    if (validatedEmails.length > 0) {
      const { data, error: upsertError } = await supabase
        .from('whitelist')
        .upsert(
          validatedEmails.map((item) => ({
            email: item.email,
            status: item.status,
            metadata: item.metadata || null,
            updated_at: new Date().toISOString(),
          })),
          {
            onConflict: 'email',
          }
        )
        .select('email, status')

      if (upsertError) {
        console.error('❌ [WHITELIST-IMPORT] Upsert error:', upsertError)
        return NextResponse.json(
          {
            success: false,
            imported: 0,
            updated: 0,
            failed: validatedEmails.length,
            errors: [{ email: '', error: `Database error: ${upsertError.message}` }],
          },
          { status: 500 }
        )
      }

      // ========================================================================
      // STEP 7: Count imports vs updates
      // ========================================================================
      // We don't know which were new vs updated from upsert response,
      // so assume all are "imported". If you need this distinction, modify schema
      // to add a "created_at" vs "updated_at" check.
      imported = validatedEmails.length

      console.log(`✅ [WHITELIST-IMPORT] Success: ${imported} emails upserted`)
    }

    // ============================================================================
    // STEP 8: Invalidate cache so next auth checks get fresh data
    // ============================================================================
    // Note: If using Vercel Runtime Cache, invalidate with:
    // await invalidateByTag('whitelist')
    // For now, cache will expire naturally (5 min TTL)

    return NextResponse.json({
      success: true,
      imported,
      updated: 0, // We don't distinguish in current schema
      failed,
      errors: errors.slice(0, 10), // Return first 10 errors to avoid response bloat
    })
  } catch (error) {
    console.error('❌ [WHITELIST-IMPORT] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [
          {
            email: '',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      },
      { status: 500 }
    )
  }
}
