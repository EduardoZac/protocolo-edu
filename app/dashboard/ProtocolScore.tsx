'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Item { label: string; done: boolean }

export default function ProtocolScore({ userId, date }: { userId: string; date: string }) {
  const [items, setItems] = useState<Item[]>([])
  const supabase = createClient()

  const load = useCallback(async () => {
    const fastStart = `${date}T00:00:00`
    const fastEnd   = `${date}T23:59:59`

    const [{ data: log }, { data: fast }, { data: brief }] = await Promise.all([
      supabase.from('daily_logs').select('colors, notes, hrv, recovery_score').eq('user_id', userId).eq('date', date).maybeSingle(),
      supabase.from('fasts').select('goal_reached').eq('user_id', userId).not('ended_at', 'is', null).gte('started_at', fastStart).lte('started_at', fastEnd).order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('briefs').select('date').eq('user_id', userId).eq('date', date).maybeSingle(),
    ])

    setItems([
      { label: 'Ayuno 14h+',    done: fast?.goal_reached === true },
      { label: 'Arcoíris 7/7',  done: (log?.colors ?? []).length >= 7 },
      { label: 'WHOOP sync',    done: !!(log?.recovery_score || log?.hrv) },
      { label: 'Nota del día',  done: !!(log?.notes?.trim()) },
      { label: 'Morning brief', done: !!brief },
    ])
  }, [supabase, userId, date])

  useEffect(() => { load() }, [load])

  if (!items.length) return null

  const done = items.filter(i => i.done).length
  const pct  = (done / items.length) * 100
  const color = pct === 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#525252'

  return (
    <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-neutral-500">Protocolo de hoy</p>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {done}/{items.length}
        </span>
      </div>

      <div className="h-1 bg-neutral-700 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: pct === 100 ? `0 0 8px ${color}80` : 'none',
          }}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map(item => (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-300 ${
              item.done ? 'text-neutral-200' : 'text-neutral-600'
            }`}
          >
            <span className={`text-sm leading-none transition-all duration-300 ${item.done ? 'scale-110' : ''}`}>
              {item.done ? '✓' : '○'}
            </span>
            {item.label}
          </div>
        ))}
      </div>

      {pct === 100 && (
        <p className="text-green-400 text-xs text-center mt-3 font-medium">
          Protocolo completo
        </p>
      )}
    </div>
  )
}
