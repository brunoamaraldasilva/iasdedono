export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  role: UserRole
  created_at: string
  last_login?: string
}

export interface AuthSession {
  user: User | null
  loading: boolean
  error?: string
}
