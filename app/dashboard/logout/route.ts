import { NextResponse } from 'next/server'

// Simple logout endpoint - just returns success
// The actual logout happens on the client side with supabase.auth.signOut()
export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Logout failed' },
      { status: 500 }
    )
  }
}
