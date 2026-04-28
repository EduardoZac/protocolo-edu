export interface Fast {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  goal_reached: boolean
  created_at: string
}

export interface DailyLog {
  id: string
  user_id: string
  date: string
  // Rainbow — array of color IDs eaten today
  colors: string[]
  // WHOOP manual entry
  hrv: number | null
  recovery_score: number | null     // 0-100
  sleep_performance: number | null  // 0-100
  strain: number | null             // 0-21 WHOOP scale
  // Apple Health (auto-sync via Shortcut)
  resting_hr: number | null
  steps: number | null
  // WHOOP extended (auto-sync via API)
  sleep_total_min: number | null
  sleep_in_bed_min: number | null
  sleep_light_min: number | null
  sleep_deep_min: number | null
  sleep_rem_min: number | null
  sleep_awake_min: number | null
  sleep_efficiency: number | null
  sleep_consistency: number | null
  sleep_need_min: number | null
  sleep_disturbances: number | null
  respiratory_rate: number | null
  skin_temp_celsius: number | null
  spo2: number | null
  kilojoules: number | null
  avg_hr: number | null
  max_hr: number | null
  // Subjective
  energy: number | null             // 1-10
  notes: string | null
  created_at: string
  updated_at: string
}

export const RAINBOW_COLORS = [
  { id: 'rojo',      label: 'Rojo',       hex: '#ef4444', tip: 'jitomate, fresa, pimiento' },
  { id: 'naranja',   label: 'Naranja',    hex: '#f97316', tip: 'zanahoria, naranja, mango' },
  { id: 'amarillo',  label: 'Amarillo',   hex: '#eab308', tip: 'limón, maíz, piña' },
  { id: 'verde',     label: 'Verde',      hex: '#22c55e', tip: 'espinaca, pepino, aguacate' },
  { id: 'crucifero', label: 'Crucífero',  hex: '#16a34a', tip: 'brócoli, col, kale' },
  { id: 'morado',    label: 'Morado',     hex: '#8b5cf6', tip: 'arándano, berenjena, uva' },
  { id: 'blanco',    label: 'Blanco',     hex: '#a3a3a3', tip: 'ajo, cebolla, nueces' },
] as const

export type ColorId = typeof RAINBOW_COLORS[number]['id']

// WHOOP color coding helpers
export function recoveryColor(score: number | null): string {
  if (score === null) return 'text-neutral-500'
  if (score >= 67) return 'text-green-400'
  if (score >= 34) return 'text-amber-400'
  return 'text-red-400'
}

export function hrvColor(hrv: number | null): string {
  if (hrv === null) return 'text-neutral-500'
  if (hrv >= 70) return 'text-green-400'
  if (hrv >= 40) return 'text-amber-400'
  return 'text-red-400'
}

export function sleepColor(score: number | null): string {
  if (score === null) return 'text-neutral-500'
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-red-400'
}

export function strainColor(strain: number | null): string {
  if (strain === null) return 'text-neutral-500'
  if (strain < 10) return 'text-sky-400'
  if (strain < 14) return 'text-amber-400'
  if (strain < 18) return 'text-orange-400'
  return 'text-red-400'
}
