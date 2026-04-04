import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Validação de autenticação acontece no layout do dashboard usando useAuth
  // O Supabase salva a sessão em localStorage, não em cookies HTTP
  // Por isso não podemos validar aqui no middleware
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
