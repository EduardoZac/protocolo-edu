import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Auth via secret token
  const secret = req.headers.get('x-sync-secret')
  if (!secret || secret !== process.env.HEALTH_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { date, hrv, sleep_hours, resting_hr, steps } = body

  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }

  // sleep_hours → sleep_performance % (goal: 8h)
  const sleep_performance = sleep_hours != null
    ? Math.min(Math.round((sleep_hours / 8) * 100), 100)
    : null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Find user — this endpoint is single-user, use the owner's email
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users?.[0]
  if (!user) {
    return NextResponse.json({ error: 'No user found' }, { status: 404 })
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    date,
    updated_at: new Date().toISOString(),
  }

  if (hrv != null) payload.hrv = Math.round(hrv)
  if (sleep_performance != null) payload.sleep_performance = sleep_performance
  if (resting_hr != null) payload.resting_hr = Math.round(resting_hr)
  if (steps != null) payload.steps = Math.round(steps)

  const { error } = await supabase
    .from('daily_logs')
    .upsert(payload, { onConflict: 'user_id,date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, date, synced: Object.keys(payload).filter(k => k !== 'user_id' && k !== 'date' && k !== 'updated_at') })
}
