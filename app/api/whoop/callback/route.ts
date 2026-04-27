import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { exchangeCode, saveTokens } from '@/lib/whoop'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = req.cookies.get('whoop_oauth_state')?.value

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL('/dashboard?whoop=state_error', req.url))
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => req.cookies.get(n)?.value, set: () => {}, remove: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const tokens = await exchangeCode(code)
    await saveTokens(user.id, tokens)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Whoop callback:', msg)
    return NextResponse.redirect(new URL(`/dashboard?whoop=error`, req.url))
  }

  const res = NextResponse.redirect(new URL('/dashboard?whoop=connected', req.url))
  res.cookies.delete('whoop_oauth_state')
  return res
}
