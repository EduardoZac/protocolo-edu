'use client'

import type { Fast, DailyLog } from '@/lib/types'

function getDuration(fast: Fast): number {
  const end = fast.ended_at ? new Date(fast.ended_at) : new Date()
  return (end.getTime() - new Date(fast.started_at).getTime()) / 3600000
}

function cell(
  value: string | number | null | undefined,
  colorFn?: (v: number) => string,
  suffix = ''
): { text: string; color: string } {
  if (value == null || value === '') return { text: '—', color: 'text-neutral-700' }
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  const color = colorFn ? colorFn(num) : 'text-neutral-300'
  return { text: `${typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}${suffix}`, color }
}

const recColor = (v: number) => v >= 67 ? 'text-green-400' : v >= 34 ? 'text-amber-400' : 'text-red-400'
const hrvColor = (v: number) => v >= 70 ? 'text-green-400' : v >= 40 ? 'text-amber-400' : 'text-red-400'
const sleepColor = (v: number) => v >= 85 ? 'text-green-400' : v >= 70 ? 'text-amber-400' : 'text-red-400'
const stepsColor = (v: number) => v >= 8000 ? 'text-green-400' : v >= 5000 ? 'text-amber-400' : 'text-red-400'
const fastColor = (v: number) => v >= 14 ? 'text-green-400' : v >= 12 ? 'text-amber-400' : 'text-red-400'
const rainbowColor = (v: number) => v >= 7 ? 'text-green-400' : v >= 5 ? 'text-amber-400' : 'text-neutral-400'
const glucoseColor = (v: number) => v < 100 ? 'text-green-400' : v < 126 ? 'text-amber-400' : 'text-red-400'

const COLS = [
  { key: 'fecha',    label: 'Fecha',   width: 'w-16' },
  { key: 'ayuno',   label: 'Ayuno',   width: 'w-14' },
  { key: 'pasos',   label: 'Pasos',   width: 'w-14' },
  { key: 'rec',     label: 'Rec%',    width: 'w-12' },
  { key: 'hrv',     label: 'HRV',     width: 'w-12' },
  { key: 'sleep',   label: 'Sueño',   width: 'w-12' },
  { key: 'arco',    label: '🌈',      width: 'w-10' },
  { key: 'peso',    label: 'Peso',    width: 'w-14' },
  { key: 'glucosa', label: 'Gluc',    width: 'w-14' },
]

interface Props {
  logs: DailyLog[]
  fasts: Fast[]
  days?: number
}

export default function DailyTable({ logs, fasts, days = 14 }: Props) {
  // Build a map of date → last fast that started on that date
  const fastByDate = new Map<string, Fast>()
  for (const f of fasts) {
    if (f.ended_at) {
      const d = f.started_at.slice(0, 10)
      if (!fastByDate.has(d)) fastByDate.set(d, f)
    }
  }

  // Merge logs and ensure we show the last `days` days
  const recent = logs.slice(0, days)

  if (recent.length === 0) return null

  return (
    <div>
      <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-3">Tabla diaria · últimos {days} días</p>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 520 }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={`${col.width} text-left pb-2 text-neutral-600 font-normal uppercase tracking-wider text-[9px] pr-2`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((log, i) => {
              const fast = fastByDate.get(log.date)
              const fastH = fast ? getDuration(fast) : null
              const d = new Date(log.date + 'T12:00:00')
              const dateLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
              const isToday = log.date === new Date().toISOString().slice(0, 10)

              const rows: { text: string; color: string }[] = [
                { text: dateLabel, color: isToday ? 'text-amber-400' : 'text-neutral-400' },
                cell(fastH != null ? Math.round(fastH * 10) / 10 : null, fastColor, 'h'),
                cell(log.steps != null ? Math.round(log.steps / 100) / 10 : null, stepsColor, 'k'),
                cell(log.recovery_score, recColor, '%'),
                cell(log.hrv, hrvColor, ''),
                cell(log.sleep_performance, sleepColor, '%'),
                cell(log.colors?.length ?? null, rainbowColor, '/7'),
                cell(log.weight_kg, undefined, 'kg'),
                cell(log.glucose_avg != null ? Math.round(log.glucose_avg) : null, glucoseColor, ''),
              ]

              return (
                <tr
                  key={log.date}
                  className={`border-t transition-colors ${
                    i % 2 === 0 ? 'border-neutral-800' : 'border-neutral-800'
                  } hover:bg-neutral-800/50`}
                >
                  {rows.map((r, j) => (
                    <td key={j} className={`py-2 pr-2 font-mono ${r.color} ${j === 0 ? 'font-sans' : ''}`}>
                      {r.text}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {[
          ['text-green-400', 'Óptimo'],
          ['text-amber-400', 'Aceptable'],
          ['text-red-400', 'Mejorar'],
          ['text-neutral-700', 'Sin datos'],
        ].map(([color, label]) => (
          <span key={label} className={`text-[10px] ${color} flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
