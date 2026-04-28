import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Whitelist of fields the iOS Shortcut can send. Order = also the response order.
const NUMERIC_FIELDS = [
  // Apple Health basics
  'resting_hr', 'steps', 'flights_climbed', 'distance_km',
  'active_kcal', 'exercise_min', 'stand_hours', 'mindfulness_min',
  // Antropometría
  'weight_kg', 'body_fat_pct', 'lean_mass_kg', 'waist_cm',
  // Metabólicas (CGM / glucómetro)
  'glucose_avg', 'glucose_min', 'glucose_max', 'glucose_time_in_range',
  // Cardiovasculares
  'bp_systolic', 'bp_diastolic', 'vo2_max',
  // Legacy (backwards compat)
  'hrv',
] as const

const INT_FIELDS = new Set([
  'resting_hr', 'steps', 'flights_climbed',
  'active_kcal', 'exercise_min', 'stand_hours', 'mindfulness_min',
  'glucose_time_in_range', 'bp_systolic', 'bp_diastolic', 'hrv',
])

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  if (!secret || secret !== process.env.HEALTH_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { date, sleep_hours } = body

  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

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

  // sleep_hours → sleep_performance % (goal: 8h) — only if Whoop hasn't already filled it
  if (sleep_hours != null) {
    const sleep_performance = Math.min(Math.round((sleep_hours / 8) * 100), 100)
    payload.sleep_performance = sleep_performance
  }

  for (const field of NUMERIC_FIELDS) {
    const v = body[field]
    if (v == null || isNaN(Number(v))) continue
    payload[field] = INT_FIELDS.has(field) ? Math.round(Number(v)) : Number(v)
  }

  const { error } = await supabase
    .from('daily_logs')
    .upsert(payload, { onConflict: 'user_id,date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    date,
    synced: Object.keys(payload).filter(k => !['user_id', 'date', 'updated_at'].includes(k)),
  })
}
