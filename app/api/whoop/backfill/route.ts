import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRange, getValidAccessToken, metricsToRow } from '@/lib/whoop'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId: string | undefined = body.userId
  const days: number = Math.min(Math.max(Number(body.days) || 365, 1), 1825) // 1 day .. 5 years
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  try {
    const token = await getValidAccessToken(userId)
    const start = new Date(Date.now() - days * 86400_000)
    const map = await fetchRange(token, start)

    const supabase = admin()
    const rows = Object.entries(map).map(([date, m]) => metricsToRow(userId, date, m))
    if (!rows.length) return NextResponse.json({ ok: true, synced: 0 })

    const { error } = await supabase
      .from('daily_logs')
      .upsert(rows, { onConflict: 'user_id,date' })
    if (error) throw new Error(error.message)

    return NextResponse.json({
      ok: true,
      synced: rows.length,
      from: rows[0].date,
      to: rows[rows.length - 1].date,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('whoop backfill:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
