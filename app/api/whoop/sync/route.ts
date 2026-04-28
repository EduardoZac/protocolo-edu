import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchLastNDays, getValidAccessToken, metricsToRow } from '@/lib/whoop'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Cron path: shared secret → use single owner user
  const secret = req.headers.get('x-sync-secret')
  if (secret && secret === process.env.HEALTH_SYNC_SECRET) {
    const supabase = admin()
    const { data } = await supabase.auth.admin.listUsers()
    return data?.users?.[0]?.id ?? null
  }
  // Manual path: fall through; caller must pass userId in body
  return null
}

export async function POST(req: NextRequest) {
  let userId = await resolveUserId(req)
  if (!userId) {
    const body = await req.json().catch(() => ({}))
    userId = body.userId ?? null
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const token = await getValidAccessToken(userId)
    const days = await fetchLastNDays(token, 7)
    const supabase = admin()

    const rows = Object.entries(days).map(([date, m]) => metricsToRow(userId!, date, m))

    if (!rows.length) return NextResponse.json({ ok: true, synced: 0 })

    const { error } = await supabase
      .from('daily_logs')
      .upsert(rows, { onConflict: 'user_id,date' })
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, synced: rows.length, dates: Object.keys(days) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('whoop sync:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
