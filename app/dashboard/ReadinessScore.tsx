'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface LogSlice {
  recovery_score: number | null
  hrv: number | null
  sleep_performance: number | null
  resting_hr: number | null
}

function computeReadiness(log: LogSlice | null): { score: number; driver: string; color: string; label: string } {
  if (!log || (!log.recovery_score && !log.hrv && !log.sleep_performance)) {
    return { score: 0, driver: '', color: '#525252', label: '—' }
  }

  let total = 0, weight = 0

  if (log.recovery_score != null) { total += log.recovery_score * 0.4; weight += 0.4 }
  if (log.hrv != null) {
    const normalized = Math.min(100, Math.max(0, ((log.hrv - 20) / 80) * 100))
    total += normalized * 0.35; weight += 0.35
  }
  if (log.sleep_performance != null) { total += log.sleep_performance * 0.25; weight += 0.25 }

  const score = Math.round(total / weight)

  const parts: string[] = []
  if (log.recovery_score != null) parts.push(`Recovery ${log.recovery_score}%`)
  if (log.hrv != null) parts.push(`HRV ${log.hrv}ms`)
  if (log.sleep_performance != null) parts.push(`Sueño ${log.sleep_performance}%`)

  const color = score >= 67 ? '#22c55e' : score >= 34 ? '#f59e0b' : '#ef4444'
  const label = score >= 67 ? 'Listo' : score >= 34 ? 'Moderado' : 'Bajo'

  return { score, driver: parts.slice(0, 2).join(' · '), color, label }
}

export default function ReadinessScore({ userId, date }: { userId: string; date: string }) {
  const [log, setLog] = useState<LogSlice | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('recovery_score, hrv, sleep_performance, resting_hr')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    setLog(data as LogSlice | null)
  }, [supabase, userId, date])

  useEffect(() => { load() }, [load])

  const { score, driver, color, label } = computeReadiness(log)
  if (!score) return null

  const r = 28
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - score / 100)

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5"
      style={{
        background: `radial-gradient(ellipse at 20% 60%, ${color}12 0%, transparent 65%), #1c1c1c`,
        border: `1px solid ${color}28`,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Readiness</p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-bold tabular-nums"
              style={{ color, textShadow: `0 0 24px ${color}50` }}
            >
              {score}
            </span>
            <span className="text-neutral-500 text-sm font-medium">/100</span>
          </div>
          <p className="text-xs mt-1.5" style={{ color: color + 'cc' }}>{label}</p>
          {driver && <p className="text-neutral-500 text-[11px] mt-0.5">{driver}</p>}
        </div>

        <div className="relative w-[68px] h-[68px]">
          <svg viewBox="0 0 64 64" className="-rotate-90 w-full h-full">
            <circle cx="32" cy="32" r={r} fill="none" stroke="#2a2a2a" strokeWidth="5" />
            <circle
              cx="32" cy="32" r={r}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                transition: 'stroke-dashoffset 1.2s ease',
                filter: `drop-shadow(0 0 5px ${color}70)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color }}>
              {score >= 67 ? '↑' : score >= 34 ? '→' : '↓'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
