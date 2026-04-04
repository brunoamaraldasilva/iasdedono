import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // ✅ NEW: Check whitelist BEFORE login attempt
    console.log('🔐 [LOGIN-WHITELIST] Checking status for:', email)

    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from('authorized_users')
      .select('email, status')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    // If email exists in whitelist but is inactive, block login
    if (whitelistEntry && whitelistEntry.status === 'inactive') {
      console.warn('🔐 [LOGIN-WHITELIST] Account inactive:', email)
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

    // Sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!data.session) {
      return NextResponse.json(
        { error: 'Falha ao criar sessão' },
        { status: 500 }
      )
    }

    // ✅ NEW: Log successful login
    console.log('🔐 [LOGIN-WHITELIST] ✅ Login successful for:', email)

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao fazer login' },
      { status: 500 }
    )
  }
}
