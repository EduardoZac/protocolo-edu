'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Fast, DailyLog } from '@/lib/types'

function fmt(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function getDuration(fast: Fast) {
  const end = fast.ended_at ? new Date(fast.ended_at) : new Date()
  return Math.round(((end.getTime() - new Date(fast.started_at).getTime()) / 3600000) * 10) / 10
}

const TOOLTIP_STYLE = {
  backgroundColor: '#262626',
  border: '1px solid #404040',
  borderRadius: 8,
  fontSize: 12,
  color: '#e5e5e5',
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
      <p className="text-xs text-neutral-400 uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-neutral-600 text-sm text-center py-6">Sin datos aún</p>
}

interface Props {
  logs: DailyLog[]
  fasts: Fast[]
}

export default function Charts({ logs, fasts }: Props) {
  const logsAsc = [...logs].reverse()
  const fastsAsc = [...fasts].reverse()

  const hrvData = logsAsc.filter(l => l.hrv).map(l => ({ date: fmt(l.date), v: l.hrv }))
  const sleepData = logsAsc.filter(l => l.sleep_performance).map(l => ({ date: fmt(l.date), v: l.sleep_performance }))
  const recoveryData = logsAsc.filter(l => l.recovery_score).map(l => ({ date: fmt(l.date), v: l.recovery_score }))
  const stepsData = logsAsc.filter(l => l.steps).map(l => ({ date: fmt(l.date), v: Math.round((l.steps ?? 0) / 1000 * 10) / 10 }))
  const fastData = fastsAsc.map(f => ({ date: fmt(f.started_at), v: getDuration(f), goal: f.goal_reached }))

  return (
    <div className="space-y-4">

      {/* HRV */}
      <ChartCard title="HRV · ms">
        {hrvData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={hrvData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} ms`, 'HRV']} labelStyle={{ color: '#a3a3a3' }} />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Sueño */}
      <ChartCard title="Sueño · %">
        {sleepData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={sleepData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Sueño']} labelStyle={{ color: '#a3a3a3' }} />
              <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line type="monotone" dataKey="v" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#818cf8' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Recovery */}
      <ChartCard title="Recovery · %">
        {recoveryData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={recoveryData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Recovery']} labelStyle={{ color: '#a3a3a3' }} />
              <ReferenceLine y={67} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={34} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line type="monotone" dataKey="v" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#34d399' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Pasos */}
      <ChartCard title="Pasos · miles">
        {stepsData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stepsData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}k`, 'Pasos']} labelStyle={{ color: '#a3a3a3' }} />
              <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Bar dataKey="v" fill="#fbbf24" radius={[3, 3, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Ayunos */}
      <ChartCard title="Ayunos · horas">
        {fastData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={fastData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}h`, 'Ayuno']} labelStyle={{ color: '#a3a3a3' }} />
              <ReferenceLine y={14} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Bar dataKey="v" radius={[3, 3, 0, 0]} maxBarSize={16}
                fill="#f59e0b"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

    </div>
  )
}
