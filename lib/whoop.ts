import { createClient } from '@supabase/supabase-js'

const WHOOP_AUTH = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_TOKEN = 'https://api.prod.whoop.com/oauth/oauth2/token'
const WHOOP_API = 'https://api.prod.whoop.com/developer'

export const WHOOP_SCOPES = [
  'read:recovery',
  'read:sleep',
  'read:cycles',
  'read:workout',
  'read:profile',
  'offline',
].join(' ')

export function whoopAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    scope: WHOOP_SCOPES,
    state,
  })
  return `${WHOOP_AUTH}?${params}`
}

interface WhoopTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

export async function exchangeCode(code: string): Promise<WhoopTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
  })
  const r = await fetch(WHOOP_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) throw new Error(`Whoop token exchange failed: ${r.status} ${await r.text()}`)
  return r.json()
}

async function refreshTokens(refreshToken: string): Promise<WhoopTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: WHOOP_SCOPES,
  })
  const r = await fetch(WHOOP_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) throw new Error(`Whoop refresh failed: ${r.status} ${await r.text()}`)
  return r.json()
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function saveTokens(userId: string, t: WhoopTokenResponse) {
  const expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString()
  const supabase = admin()
  const { error } = await supabase.from('whoop_tokens').upsert({
    user_id: userId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at,
    scope: t.scope,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`saveTokens: ${error.message}`)
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = admin()
  const { data, error } = await supabase
    .from('whoop_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error || !data) throw new Error('No Whoop tokens — connect Whoop first.')

  // Refresh 60s before expiry
  const expiresAt = new Date(data.expires_at).getTime()
  if (expiresAt - Date.now() > 60_000) return data.access_token

  const fresh = await refreshTokens(data.refresh_token)
  await saveTokens(userId, fresh)
  return fresh.access_token
}

async function whoopFetch<T>(token: string, path: string): Promise<T> {
  const r = await fetch(`${WHOOP_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`Whoop ${path}: ${r.status} ${await r.text()}`)
  return r.json()
}

interface RecoveryRecord {
  cycle_id: number
  created_at: string
  score?: { recovery_score: number; hrv_rmssd_milli: number; resting_heart_rate: number }
}
interface SleepRecord {
  start: string
  end: string
  score?: { sleep_performance_percentage: number; stage_summary?: { total_in_bed_time_milli: number; total_awake_time_milli: number } }
}
interface CycleRecord {
  start: string
  end: string | null
  score?: { strain: number; average_heart_rate: number; max_heart_rate: number }
}

interface Paginated<T> { records: T[]; next_token?: string }

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

export async function fetchLastNDays(token: string, days: number) {
  const start = new Date(Date.now() - days * 86400_000).toISOString()
  const qs = `?start=${encodeURIComponent(start)}&limit=25`

  const [recovery, sleep, cycle] = await Promise.all([
    whoopFetch<Paginated<RecoveryRecord>>(token, `/v1/recovery${qs}`),
    whoopFetch<Paginated<SleepRecord>>(token, `/v1/activity/sleep${qs}`),
    whoopFetch<Paginated<CycleRecord>>(token, `/v1/cycle${qs}`),
  ])

  // Bucket by date (use sleep end / cycle start day)
  const byDate: Record<string, {
    hrv?: number
    recovery_score?: number
    resting_hr?: number
    sleep_performance?: number
    strain?: number
  }> = {}

  for (const r of recovery.records) {
    if (!r.score) continue
    const day = isoDate(new Date(r.created_at))
    byDate[day] ??= {}
    byDate[day].hrv = Math.round(r.score.hrv_rmssd_milli)
    byDate[day].recovery_score = Math.round(r.score.recovery_score)
    byDate[day].resting_hr = Math.round(r.score.resting_heart_rate)
  }
  for (const s of sleep.records) {
    if (!s.score) continue
    // Sleep belongs to the day you wake up
    const day = isoDate(new Date(s.end))
    byDate[day] ??= {}
    byDate[day].sleep_performance = Math.round(s.score.sleep_performance_percentage)
  }
  for (const c of cycle.records) {
    if (!c.score) continue
    const day = isoDate(new Date(c.start))
    byDate[day] ??= {}
    byDate[day].strain = Math.round(c.score.strain * 10) / 10
  }

  return byDate
}
