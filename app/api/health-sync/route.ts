import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// === Schema for the simple flat-JSON path (manual Shortcut, curl, etc.) ===

const NUMERIC_FIELDS = [
  'resting_hr', 'steps', 'flights_climbed', 'distance_km',
  'active_kcal', 'exercise_min', 'stand_hours', 'mindfulness_min',
  'weight_kg', 'body_fat_pct', 'lean_mass_kg', 'waist_cm',
  'glucose_avg', 'glucose_min', 'glucose_max', 'glucose_time_in_range',
  'bp_systolic', 'bp_diastolic', 'vo2_max',
  'hrv',
] as const

const INT_FIELDS = new Set([
  'resting_hr', 'steps', 'flights_climbed',
  'active_kcal', 'exercise_min', 'stand_hours', 'mindfulness_min',
  'glucose_time_in_range', 'bp_systolic', 'bp_diastolic', 'hrv',
])

// === Mapping for Health Auto Export (HAE) JSON format ===
// HAE sends: { data: { metrics: [{ name, units, data: [{ date, qty | min | max | avg | Min | Max | Avg }] }] } }

interface HAEDatum {
  date: string
  qty?: number
  Min?: number
  Max?: number
  Avg?: number
  min?: number
  max?: number
  avg?: number
  systolic?: number
  diastolic?: number
}
interface HAEMetric {
  name: string
  units?: string
  data: HAEDatum[]
}

// Map HAE metric names → our fields. Some metrics produce multiple fields (glucose, BP).
const HAE_MAP: Record<string, (m: HAEMetric, units: string) => Record<string, number | undefined>> = {
  step_count: (m) => ({ steps: sumQty(m) }),
  flights_climbed: (m) => ({ flights_climbed: sumQty(m) }),
  walking_running_distance: (m, u) => ({ distance_km: kmFrom(sumQty(m), u) }),
  active_energy: (m) => ({ active_kcal: sumQty(m) }),
  apple_exercise_time: (m) => ({ exercise_min: sumQty(m) }),
  apple_stand_hour: (m) => ({ stand_hours: sumQty(m) }),
  mindful_minutes: (m) => ({ mindfulness_min: sumQty(m) }),
  resting_heart_rate: (m) => ({ resting_hr: avgQty(m) }),
  heart_rate_variability: (m) => ({ hrv: avgQty(m) }),
  weight_body_mass: (m, u) => ({ weight_kg: kgFrom(latestQty(m), u) }),
  body_fat_percentage: (m) => ({ body_fat_pct: pct(latestQty(m)) }),
  lean_body_mass: (m, u) => ({ lean_mass_kg: kgFrom(latestQty(m), u) }),
  waist_circumference: (m, u) => ({ waist_cm: cmFrom(latestQty(m), u) }),
  vo2_max: (m) => ({ vo2_max: latestQty(m) }),
  blood_glucose: (m, u) => {
    const vals = m.data.map(d => d.qty).filter((v): v is number => v != null).map(v => mgdlFrom(v, u)!)
    if (!vals.length) return {}
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const inRange = vals.filter(v => v >= 70 && v <= 140).length
    return {
      glucose_avg: round1(avg),
      glucose_min: round1(min),
      glucose_max: round1(max),
      glucose_time_in_range: Math.round((inRange / vals.length) * 100),
    }
  },
  blood_pressure: (m) => {
    // HAE returns blood_pressure with both systolic and diastolic per datum
    const last = m.data[m.data.length - 1]
    if (!last) return {}
    return { bp_systolic: last.systolic, bp_diastolic: last.diastolic }
  },
}

// === Helpers ===

function sumQty(m: HAEMetric): number | undefined {
  const vals = m.data.map(d => d.qty).filter((v): v is number => v != null)
  if (!vals.length) return undefined
  return Math.round(vals.reduce((a, b) => a + b, 0))
}
function avgQty(m: HAEMetric): number | undefined {
  const vals = m.data.map(d => d.qty).filter((v): v is number => v != null)
  if (!vals.length) return undefined
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}
function latestQty(m: HAEMetric): number | undefined {
  for (let i = m.data.length - 1; i >= 0; i--) {
    if (m.data[i].qty != null) return m.data[i].qty
  }
  return undefined
}
function kgFrom(v: number | undefined, units: string): number | undefined {
  if (v == null) return undefined
  if (/lb/i.test(units)) return round2(v * 0.453592)
  return round2(v)
}
function kmFrom(v: number | undefined, units: string): number | undefined {
  if (v == null) return undefined
  if (/mi/i.test(units)) return round2(v * 1.60934)
  if (/m\b/i.test(units) && !/km/i.test(units)) return round2(v / 1000)
  return round2(v)
}
function cmFrom(v: number | undefined, units: string): number | undefined {
  if (v == null) return undefined
  if (/in/i.test(units)) return round1(v * 2.54)
  if (/m\b/i.test(units) && !/cm/i.test(units)) return round1(v * 100)
  return round1(v)
}
function mgdlFrom(v: number, units: string): number | undefined {
  if (/mmol/i.test(units)) return round1(v * 18.0182)
  return round1(v)
}
function pct(v: number | undefined): number | undefined {
  if (v == null) return undefined
  // HAE may return 0.182 or 18.2 — normalize to "18.2"
  return v <= 1 ? round1(v * 100) : round1(v)
}
function round1(n: number) { return Math.round(n * 10) / 10 }
function round2(n: number) { return Math.round(n * 100) / 100 }

// Pick the date from HAE: latest data point's date (YYYY-MM-DD).
function inferHAEDate(metrics: HAEMetric[]): string | null {
  for (const m of metrics) {
    const last = m.data[m.data.length - 1]
    if (last?.date) {
      const d = last.date.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    }
  }
  return null
}

// === Handler ===

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  if (!secret || secret !== process.env.HEALTH_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users?.[0]
  if (!user) return NextResponse.json({ error: 'No user found' }, { status: 404 })

  const payload: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  // Detect format. Health Auto Export wraps data under .data.metrics
  const isHAE = body?.data?.metrics && Array.isArray(body.data.metrics)

  if (isHAE) {
    const metrics: HAEMetric[] = body.data.metrics
    const date = body.date ?? inferHAEDate(metrics)
    if (!date) return NextResponse.json({ error: 'date is required (Health Auto Export gave no date)' }, { status: 400 })
    payload.date = date

    for (const m of metrics) {
      const handler = HAE_MAP[m.name]
      if (!handler) continue
      const fields = handler(m, m.units ?? '')
      for (const [k, v] of Object.entries(fields)) {
        if (v != null) payload[k] = v
      }
    }
  } else {
    // Flat JSON (manual / curl / iOS Shortcut nativo)
    const { date, sleep_hours } = body
    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })
    payload.date = date

    if (sleep_hours != null) {
      payload.sleep_performance = Math.min(Math.round((sleep_hours / 8) * 100), 100)
    }
    for (const field of NUMERIC_FIELDS) {
      const v = body[field]
      if (v == null || isNaN(Number(v))) continue
      payload[field] = INT_FIELDS.has(field) ? Math.round(Number(v)) : Number(v)
    }
  }

  const { error } = await supabase
    .from('daily_logs')
    .upsert(payload, { onConflict: 'user_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    format: isHAE ? 'health-auto-export' : 'flat',
    date: payload.date,
    synced: Object.keys(payload).filter(k => !['user_id', 'date', 'updated_at'].includes(k)),
  })
}
