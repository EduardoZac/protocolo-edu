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
  score?: {
    recovery_score: number
    hrv_rmssd_milli: number
    resting_heart_rate: number
    spo2_percentage?: number
    skin_temp_celsius?: number
  }
}
interface SleepStageSummary {
  total_in_bed_time_milli?: number
  total_awake_time_milli?: number
  total_light_sleep_time_milli?: number
  total_slow_wave_sleep_time_milli?: number
  total_rem_sleep_time_milli?: number
  disturbance_count?: number
}
interface SleepNeeded {
  baseline_milli?: number
  need_from_sleep_debt_milli?: number
  need_from_recent_strain_milli?: number
  need_from_recent_nap_milli?: number
}
interface SleepRecord {
  start: string
  end: string
  nap?: boolean
  score?: {
    sleep_performance_percentage: number
    sleep_efficiency_percentage?: number
    sleep_consistency_percentage?: number
    respiratory_rate?: number
    stage_summary?: SleepStageSummary
    sleep_needed?: SleepNeeded
  }
}
interface CycleRecord {
  start: string
  end: string | null
  score?: {
    strain: number
    average_heart_rate?: number
    max_heart_rate?: number
    kilojoule?: number
  }
}

interface Paginated<T> { records: T[]; next_token?: string }

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

async function fetchAllPages<T>(token: string, basePath: string, baseQs: URLSearchParams, maxPages = 40): Promise<T[]> {
  const all: T[] = []
  let nextToken: string | undefined
  for (let i = 0; i < maxPages; i++) {
    const qs = new URLSearchParams(baseQs)
    if (nextToken) qs.set('nextToken', nextToken)
    const page = await whoopFetch<Paginated<T>>(token, `${basePath}?${qs}`)
    all.push(...page.records)
    if (!page.next_token) break
    nextToken = page.next_token
  }
  return all
}

export async function fetchRange(token: string, startDate: Date, endDate: Date = new Date()) {
  const qs = new URLSearchParams({
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    limit: '25',
  })

  const [recovery, sleep, cycle] = await Promise.all([
    fetchAllPages<RecoveryRecord>(token, '/v2/recovery', qs),
    fetchAllPages<SleepRecord>(token, '/v2/activity/sleep', qs),
    fetchAllPages<CycleRecord>(token, '/v2/cycle', qs),
  ])

  // Bucket by date (use sleep end / cycle start day)
  const byDate: Record<string, DayMetrics> = {}
  const msToMin = (ms?: number) => (ms == null ? undefined : Math.round(ms / 60000))

  for (const r of recovery) {
    if (!r.score) continue
    const day = isoDate(new Date(r.created_at))
    byDate[day] ??= {}
    byDate[day].hrv = Math.round(r.score.hrv_rmssd_milli)
    byDate[day].recovery_score = Math.round(r.score.recovery_score)
    byDate[day].resting_hr = Math.round(r.score.resting_heart_rate)
    if (r.score.spo2_percentage != null) byDate[day].spo2 = Math.round(r.score.spo2_percentage * 10) / 10
    if (r.score.skin_temp_celsius != null) byDate[day].skin_temp_celsius = Math.round(r.score.skin_temp_celsius * 100) / 100
  }
  for (const s of sleep) {
    if (!s.score || s.nap) continue
    const day = isoDate(new Date(s.end))
    byDate[day] ??= {}
    byDate[day].sleep_performance = Math.round(s.score.sleep_performance_percentage)
    if (s.score.sleep_efficiency_percentage != null) byDate[day].sleep_efficiency = Math.round(s.score.sleep_efficiency_percentage)
    if (s.score.sleep_consistency_percentage != null) byDate[day].sleep_consistency = Math.round(s.score.sleep_consistency_percentage)
    if (s.score.respiratory_rate != null) byDate[day].respiratory_rate = Math.round(s.score.respiratory_rate * 10) / 10
    const ss = s.score.stage_summary
    if (ss) {
      byDate[day].sleep_in_bed_min = msToMin(ss.total_in_bed_time_milli)
      byDate[day].sleep_awake_min = msToMin(ss.total_awake_time_milli)
      byDate[day].sleep_light_min = msToMin(ss.total_light_sleep_time_milli)
      byDate[day].sleep_deep_min = msToMin(ss.total_slow_wave_sleep_time_milli)
      byDate[day].sleep_rem_min = msToMin(ss.total_rem_sleep_time_milli)
      byDate[day].sleep_disturbances = ss.disturbance_count
      const inBed = ss.total_in_bed_time_milli ?? 0
      const awake = ss.total_awake_time_milli ?? 0
      if (inBed) byDate[day].sleep_total_min = msToMin(inBed - awake)
    }
    const sn = s.score.sleep_needed
    if (sn) {
      const total = (sn.baseline_milli ?? 0) + (sn.need_from_sleep_debt_milli ?? 0) + (sn.need_from_recent_strain_milli ?? 0) - (sn.need_from_recent_nap_milli ?? 0)
      if (total > 0) byDate[day].sleep_need_min = msToMin(total)
    }
  }
  for (const c of cycle) {
    if (!c.score) continue
    const day = isoDate(new Date(c.start))
    byDate[day] ??= {}
    byDate[day].strain = Math.round(c.score.strain * 10) / 10
    if (c.score.average_heart_rate != null) byDate[day].avg_hr = Math.round(c.score.average_heart_rate)
    if (c.score.max_heart_rate != null) byDate[day].max_hr = Math.round(c.score.max_heart_rate)
    if (c.score.kilojoule != null) byDate[day].kilojoules = Math.round(c.score.kilojoule)
  }

  return byDate
}

export interface DayMetrics {
  hrv?: number
  recovery_score?: number
  resting_hr?: number
  sleep_performance?: number
  sleep_efficiency?: number
  sleep_consistency?: number
  sleep_total_min?: number
  sleep_in_bed_min?: number
  sleep_light_min?: number
  sleep_deep_min?: number
  sleep_rem_min?: number
  sleep_awake_min?: number
  sleep_need_min?: number
  sleep_disturbances?: number
  respiratory_rate?: number
  spo2?: number
  skin_temp_celsius?: number
  strain?: number
  avg_hr?: number
  max_hr?: number
  kilojoules?: number
}

export async function fetchLastNDays(token: string, days: number) {
  return fetchRange(token, new Date(Date.now() - days * 86400_000))
}

const ROW_FIELDS: (keyof DayMetrics)[] = [
  'hrv', 'recovery_score', 'resting_hr', 'sleep_performance',
  'sleep_efficiency', 'sleep_consistency', 'sleep_total_min', 'sleep_in_bed_min',
  'sleep_light_min', 'sleep_deep_min', 'sleep_rem_min', 'sleep_awake_min',
  'sleep_need_min', 'sleep_disturbances', 'respiratory_rate',
  'spo2', 'skin_temp_celsius', 'strain', 'avg_hr', 'max_hr', 'kilojoules',
]

export function metricsToRow(userId: string, date: string, m: DayMetrics) {
  const row: Record<string, unknown> = {
    user_id: userId,
    date,
    updated_at: new Date().toISOString(),
  }
  for (const f of ROW_FIELDS) {
    if (m[f] != null) row[f] = m[f]
  }
  return row
}
