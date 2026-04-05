import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'
import { syncUserProfile } from '@/lib/userProfileSync'

export async function POST(request: NextRequest) {
  try {
    // Rate limit signup: 5 attempts per hour per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitCheck = rateLimit(`signup:${ip}`, 5, 3600000) // 1 hour
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: 'Senha deve conter ao menos uma letra MAIÚSCULA' },
        { status: 400 }
      )
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json(
        { error: 'Senha deve conter ao menos uma letra minúscula' },
        { status: 400 }
      )
    }
    if (!/\d/.test(password)) {
      return NextResponse.json(
        { error: 'Senha deve conter ao menos um número' },
        { status: 400 }
      )
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Servidor não configurado corretamente. Contate o administrador.' },
        { status: 500 }
      )
    }

    const supabase = createServerSupabaseClient()

    // ✅ NEW: Check whitelist before allowing signup
    console.log('🔐 [WHITELIST] Checking authorization for:', email)

    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from('whitelist')
      .select('email, status')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (whitelistError && whitelistError.code !== 'PGRST116') {
      console.error('🔐 [WHITELIST] Error checking whitelist:', whitelistError)
      return NextResponse.json(
        { error: 'Erro ao validar autorização. Tente novamente.' },
        { status: 500 }
      )
    }

    // If email not in whitelist
    if (!whitelistEntry) {
      console.warn('🔐 [WHITELIST] Email not authorized:', email)
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

    // If email is in whitelist but inactive
    if (whitelistEntry.status === 'inactive') {
      console.warn('🔐 [WHITELIST] Account inactive:', email)
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

    // ✅ If we get here, email is active and authorized
    console.log('🔐 [WHITELIST] ✅ Authorization granted for:', email)

    let userId: string | undefined

    // Try to sign up user
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm email
    })

    // If user already exists, get the user by email
    if (signUpError && signUpError.message.includes('already registered')) {
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

      if (listError) {
        return NextResponse.json(
          { error: 'Não foi possível verificar o usuário' },
          { status: 400 }
        )
      }

      const existingUser = existingUsers?.users?.find((u) => u.email === email)
      if (!existingUser) {
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 400 }
        )
      }

      userId = existingUser.id
    } else if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    } else if (authData.user) {
      userId = authData.user.id
    } else {
      return NextResponse.json(
        { error: 'Falha ao criar usuário' },
        { status: 500 }
      )
    }

    // Create user profile if it doesn't exist
    if (userId) {
      const { data: existingProfile, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (!existingProfile && !checkError) {
        // Profile doesn't exist, create it
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: userId,
              email,
              name: '',
              role: 'user',
            },
          ])

        if (profileError) {
          // Continue anyway - profile will be created on first login
        }
      }

      // ✅ Sync to user_profiles table for fast indexing + RLS
      await syncUserProfile(userId, email)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar conta' },
      { status: 500 }
    )
  }
}
