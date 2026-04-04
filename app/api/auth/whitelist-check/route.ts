import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Check whitelist
    console.log('🔐 [WHITELIST-CHECK] Validating email:', email)

    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from('whitelist')
      .select('email, status')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (whitelistError && whitelistError.code !== 'PGRST116') {
      console.error('🔐 [WHITELIST-CHECK] Error:', whitelistError)
      return NextResponse.json(
        { error: 'Erro ao validar autorização' },
        { status: 500 }
      )
    }

    // Email not in whitelist
    if (!whitelistEntry) {
      console.warn('🔐 [WHITELIST-CHECK] ❌ Not authorized:', email)
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
      console.warn('🔐 [WHITELIST-CHECK] ⚠️ Inactive account:', email)
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
    console.log('🔐 [WHITELIST-CHECK] ✅ Authorized:', email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('🔐 [WHITELIST-CHECK] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao validar' },
      { status: 500 }
    )
  }
}
