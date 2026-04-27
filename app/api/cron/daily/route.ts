import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Vercel Cron entrypoint. Vercel sends `Authorization: Bearer $CRON_SECRET`
// when `CRON_SECRET` is set. We translate it to our internal x-sync-secret.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = new URL(req.url).origin
  const headers = {
    'Content-Type': 'application/json',
    'x-sync-secret': process.env.HEALTH_SYNC_SECRET!,
  }

  const syncRes = await fetch(`${base}/api/whoop/sync`, { method: 'POST', headers })
  const sync = await syncRes.json().catch(() => ({}))

  const briefRes = await fetch(`${base}/api/morning-brief`, { method: 'POST', headers })
  const brief = await briefRes.json().catch(() => ({}))

  return NextResponse.json({ ok: syncRes.ok && briefRes.ok, sync, brief })
}
