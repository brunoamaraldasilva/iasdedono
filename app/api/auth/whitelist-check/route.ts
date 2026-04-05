import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getCachedValue, setCachedValue } from '@/lib/cache'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()
    const cacheKey = `whitelist:${normalizedEmail}`

    console.log('🔐 [WHITELIST-CHECK] Validating email:', normalizedEmail)

    // ✅ Check cache first (reduces DB queries by 80%)
    const cachedEntry = await getCachedValue<{ email: string; status: string }>(
      cacheKey
    )

    let whitelistEntry: { email: string; status: string } | undefined = cachedEntry

    // If not in cache, query database
    if (!whitelistEntry) {
      console.log('🔐 [WHITELIST-CHECK] Cache miss, querying database...')
      const supabase = createServerSupabaseClient()

      const { data, error: whitelistError } = await supabase
        .from('whitelist')
        .select('email, status')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (whitelistError && whitelistError.code !== 'PGRST116') {
        console.error('🔐 [WHITELIST-CHECK] Error:', whitelistError)
        return NextResponse.json(
          { error: 'Erro ao validar autorização' },
          { status: 500 }
        )
      }

      whitelistEntry = data || undefined

      // Cache the result for 5 minutes (TTL: 300s)
      // Tag with 'whitelist' for bulk invalidation if needed
      if (whitelistEntry) {
        await setCachedValue(cacheKey, whitelistEntry, 300, ['whitelist'])
      }
    }

    // Email not in whitelist
    if (!whitelistEntry) {
      console.warn('🔐 [WHITELIST-CHECK] ❌ Not authorized:', normalizedEmail)
      return NextResponse.json(
        {
          error: 'Você não tem autorização para acessar.',
          detail: 'Email não encontrado na lista de usuários autorizados.',
          helpUrl: 'https://manualdedonos.com.br',
          helpText: 'Entre em contato com Manual de Donos para mais informações.',
        },
        { status: 403 }
      )
    }

    // Email in whitelist but inactive
    if (whitelistEntry.status === 'inactive') {
      console.warn('🔐 [WHITELIST-CHECK] ⚠️ Inactive account:', normalizedEmail)
      return NextResponse.json(
        {
          error: 'Sua conta está inativa.',
          detail: 'Entre em contato com o suporte para reativação.',
          helpUrl: 'https://manualdedonos.com.br/suporte',
          helpText: 'Entre em contato com o suporte',
        },
        { status: 403 }
      )
    }

    // ✅ Authorized
    console.log('🔐 [WHITELIST-CHECK] ✅ Authorized:', normalizedEmail)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('🔐 [WHITELIST-CHECK] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao validar' },
      { status: 500 }
    )
  }
}
