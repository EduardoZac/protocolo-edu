'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { recoveryColor, hrvColor } from '@/lib/types'
import type { Fast, DailyLog } from '@/lib/types'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
}

function getDuration(fast: Fast): number {
  const end = fast.ended_at ? new Date(fast.ended_at) : new Date()
  return (end.getTime() - new Date(fast.started_at).getTime()) / 3600000
}

export default function HistoryView({ userId }: { userId: string }) {
  const [fasts, setFasts] = useState<Fast[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadHistory = useCallback(async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [{ data: fastsData }, { data: logsData }] = await Promise.all([
      supabase
        .from('fasts')
        .select('*')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .order('started_at', { ascending: false })
        .limit(30),
      supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString().slice(0, 10))
        .order('date', { ascending: false })
        .limit(30),
    ])

    setFasts(fastsData ?? [])
    setLogs(logsData ?? [])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { loadHistory() }, [loadHistory])

  if (loading) {
    return <div className="p-4 text-neutral-500 text-sm text-center">Cargando historial...</div>
  }

  const recentFasts = [...fasts].slice(0, 14)
  const maxFastHours = Math.max(...recentFasts.map(f => getDuration(f)), 14)

  // Stats
  const goalFasts = fasts.filter(f => f.goal_reached).length
  const avgHrv = logs.filter(l => l.hrv).map(l => l.hrv!).reduce((a, b) => a + b, 0) / (logs.filter(l => l.hrv).length || 1)
  const avgRecovery = logs.filter(l => l.recovery_score).map(l => l.recovery_score!).reduce((a, b) => a + b, 0) / (logs.filter(l => l.recovery_score).length || 1)

  return (
    <div className="p-4 space-y-6 pb-10">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ayunos ≥14h', value: `${goalFasts}`, sub: `de ${fasts.length}` },
          { label: 'HRV promedio', value: avgHrv > 0 ? `${Math.round(avgHrv)}ms` : '—', sub: '30 días' },
          { label: 'Recovery prom.', value: avgRecovery > 0 ? `${Math.round(avgRecovery)}%` : '—', sub: '30 días' },
        ].map(item => (
          <div key={item.label} className="bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-center">
            <p className="text-xs text-neutral-400 mb-1 leading-tight">{item.label}</p>
            <p className="text-xl font-semibold font-mono text-neutral-100">{item.value}</p>
            <p className="text-xs text-neutral-500">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Fasting bars */}
      <div>
        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Últimos ayunos</p>
        {recentFasts.length === 0 ? (
          <p className="text-neutral-500 text-sm">Sin datos aún</p>
        ) : (
          <div className="space-y-2">
            {recentFasts.map(fast => {
              const hours = getDuration(fast)
              const pct = Math.min((hours / maxFastHours) * 100, 100)
              const isGoal = fast.goal_reached
              return (
                <div key={fast.id} className="flex items-center gap-3">
                  <span className="text-neutral-400 text-xs w-20 flex-shrink-0 text-right">
                    {formatDate(fast.started_at)}
                  </span>
                  <div className="flex-1 h-6 bg-neutral-700 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isGoal ? '#22c55e33' : '#f59e0b22',
                        borderRight: `2px solid ${isGoal ? '#22c55e' : '#f59e0b'}`,
                      }}
                    />
                    {/* 14h goal line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-neutral-700"
                      style={{ left: `${(14 / maxFastHours) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono w-12 flex-shrink-0 ${isGoal ? 'text-green-400' : 'text-amber-400'}`}>
                    {hours.toFixed(1)}h
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-neutral-500 text-xs mt-2">— Línea = meta 14h</p>
      </div>

      {/* WHOOP trend */}
      <div>
        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-3">WHOOP · últimos 14 días</p>
        {logs.filter(l => l.recovery_score || l.hrv).length === 0 ? (
          <p className="text-neutral-500 text-sm">Sin datos WHOOP aún</p>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 14).map(log => (
              <div key={log.id} className="flex items-center gap-3 bg-neutral-800 rounded-xl px-3 py-2">
                <span className="text-neutral-400 text-xs w-20 flex-shrink-0">{formatDate(log.date)}</span>
                <div className="flex gap-4 flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-neutral-500 text-xs">Rec</span>
                    <span className={`font-mono text-sm font-semibold ${recoveryColor(log.recovery_score)}`}>
                      {log.recovery_score ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-neutral-500 text-xs">HRV</span>
                    <span className={`font-mono text-sm font-semibold ${hrvColor(log.hrv)}`}>
                      {log.hrv ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-neutral-500 text-xs">Sleep</span>
                    <span className="font-mono text-sm font-semibold text-neutral-400">
                      {log.sleep_performance ? `${log.sleep_performance}%` : '—'}
                    </span>
                  </div>
                  {log.colors && log.colors.length > 0 && (
                    <span className="text-neutral-500 text-xs ml-auto">{log.colors.length}/7 🌈</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
