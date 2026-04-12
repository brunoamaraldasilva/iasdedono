'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Helper function to check password strength
function checkPasswordStrength(password: string) {
  return {
    length: password.length >= 6,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  }
}

export default function LoginPage() {
  const router = useRouter()
  const initCheckRef = useRef(false)
  const mountCountRef = useRef(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState<{
    detail?: string
    helpText?: string
    helpUrl?: string
  } | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [passwordsMatch, setPasswordsMatch] = useState(true)
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
  })

  // Check if already logged in and redirect
  useEffect(() => {
    // Prevent multiple executions
    if (initCheckRef.current) return
    initCheckRef.current = true

    let isMounted = true

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (isMounted && user) {
          router.push('/dashboard')
        }
      } catch (err) {
        // Ignorar erro de auth check
        console.debug('Auth check error on login page:', err instanceof Error ? err.message : String(err))
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [])

  // Check password match and strength in real-time
  useEffect(() => {
    if (isSignUp && password && passwordConfirm) {
      setPasswordsMatch(password === passwordConfirm)
      setPasswordStrength(checkPasswordStrength(password))
    } else if (isSignUp && password) {
      setPasswordStrength(checkPasswordStrength(password))
    }
  }, [password, passwordConfirm, isSignUp])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setErrorDetail(null)

    try {
      if (isSignUp) {
        // Validate password confirmation
        if (password !== passwordConfirm) {
          setError('As senhas não conferem')
          setLoading(false)
          return
        }

        // Validate password strength
        const strength = checkPasswordStrength(password)
        if (!strength.length || !strength.hasUpperCase || !strength.hasLowerCase || !strength.hasNumber) {
          setError('Senha deve ter: 6+ caracteres, maiúscula, minúscula e número')
          setLoading(false)
          return
        }

        // Create account via API
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Erro ao criar conta')
          setErrorDetail({
            detail: data.detail,
            helpText: data.helpText,
            helpUrl: data.helpUrl,
          })
          setLoading(false)
          return
        }

        // Now login with the new account
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (loginError) throw loginError

        // Verify session was created
        if (data.session) {
          router.push('/dashboard')
        } else {
          throw new Error('Sessão não foi estabelecida')
        }
      } else {
        // ✅ NEW: Check whitelist FIRST via API
        const whitelistCheckResponse = await fetch('/api/auth/whitelist-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        if (!whitelistCheckResponse.ok) {
          const data = await whitelistCheckResponse.json()
          setError(data.error || 'Acesso negado')
          setErrorDetail({
            detail: data.detail,
            helpText: data.helpText,
            helpUrl: data.helpUrl,
          })
          setLoading(false)
          return
        }

        // If whitelist check passes, proceed with login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        // Verify session was created
        if (data.session) {
          router.push('/dashboard')
        } else {
          throw new Error('Sessão não foi estabelecida')
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao autenticar'
      setError(errorMsg)
      setErrorDetail(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#161616' }}>
      <div className="w-full max-w-md rounded-xl shadow-lg p-8" style={{ backgroundColor: '#222423' }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>IAs de Dono</h1>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
              style={{ color: '#ffffff' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
                setErrorDetail(null)
              }}
              required
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              style={{ backgroundColor: '#161616', color: '#ffffff', borderColor: '#161616' }}
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
              style={{ color: '#ffffff' }}
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              style={{ backgroundColor: '#161616', color: '#ffffff', borderColor: '#161616' }}
              placeholder="Sua senha"
            />
          </div>

          {isSignUp && (
            <>
              {/* Password Strength Indicator */}
              {password && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#e0521d' }}>
                    Requisitos de Senha:
                  </p>
                  <div className="space-y-1 text-xs">
                    <div style={{ color: passwordStrength.length ? '#10b981' : '#999999' }}>
                      {passwordStrength.length ? '✓' : '○'} Mínimo 6 caracteres
                    </div>
                    <div style={{ color: passwordStrength.hasUpperCase ? '#10b981' : '#999999' }}>
                      {passwordStrength.hasUpperCase ? '✓' : '○'} Uma letra MAIÚSCULA
                    </div>
                    <div style={{ color: passwordStrength.hasLowerCase ? '#10b981' : '#999999' }}>
                      {passwordStrength.hasLowerCase ? '✓' : '○'} Uma letra minúscula
                    </div>
                    <div style={{ color: passwordStrength.hasNumber ? '#10b981' : '#999999' }}>
                      {passwordStrength.hasNumber ? '✓' : '○'} Um número (0-9)
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="passwordConfirm"
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#ffffff' }}
                >
                  Confirmar Senha
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required={isSignUp}
                  className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  style={{
                    backgroundColor: '#161616',
                    color: '#ffffff',
                    borderColor: passwordConfirm
                      ? passwordsMatch
                        ? '#10b981'
                        : '#ef4444'
                      : '#161616',
                  }}
                  placeholder="Confirme sua senha"
                />
                {passwordConfirm && !passwordsMatch && (
                  <p className="text-red-400 text-sm mt-1">Senhas não conferem</p>
                )}
                {passwordConfirm && passwordsMatch && (
                  <p className="text-green-400 text-sm mt-1">Senhas conferem</p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="border rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#3f2f2f', borderColor: '#ef4444', color: '#ef4444' }}>
              <p className="font-semibold mb-1">{error}</p>
              {errorDetail?.detail && (
                <p className="text-xs mb-2" style={{ color: '#fca5a5' }}>
                  {errorDetail.detail}
                </p>
              )}
              {errorDetail?.helpUrl && errorDetail?.helpText && (
                <a
                  href={errorDetail.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline hover:opacity-80 transition"
                  style={{ color: '#fca5a5' }}
                >
                  → {errorDetail.helpText}
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isSignUp && (!passwordConfirm || !passwordsMatch || !passwordStrength.length || !passwordStrength.hasUpperCase || !passwordStrength.hasLowerCase || !passwordStrength.hasNumber))}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: '#999999' }}>
            {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setErrorDetail(null)
                setPasswordConfirm('')
              }}
              className="font-semibold hover:opacity-80"
              style={{ color: '#e0521d' }}
            >
              {isSignUp ? 'Entrar' : 'Criar Conta'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
