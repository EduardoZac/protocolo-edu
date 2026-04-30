'use client'

import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Area,
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
  backgroundColor: '#1f1f1f',
  border: '1px solid #333',
  borderRadius: 8,
  fontSize: 12,
  color: '#e5e5e5',
}
const AXIS_PROPS = {
  tick: { fill: '#525252', fontSize: 10 },
  tickLine: false,
  axisLine: false,
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-4">
      <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-neutral-600 text-sm text-center py-6">Sin datos aún</p>
}

const TABS = [
  { id: 'whoop', label: 'WHOOP' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'cuerpo', label: 'Cuerpo' },
  { id: 'ayuno', label: 'Ayuno' },
]

interface Props {
  logs: DailyLog[]
  fasts: Fast[]
}

export default function Charts({ logs, fasts }: Props) {
  const [tab, setTab] = useState('whoop')
  const logsAsc = [...logs].reverse()
  const fastsAsc = [...fasts].reverse()

  // WHOOP
  const hrvData = logsAsc.filter(l => l.hrv).map(l => ({ date: fmt(l.date), v: l.hrv }))
  const sleepData = logsAsc.filter(l => l.sleep_performance).map(l => ({ date: fmt(l.date), v: l.sleep_performance }))
  const recoveryData = logsAsc.filter(l => l.recovery_score).map(l => ({ date: fmt(l.date), v: l.recovery_score }))
  const combinedWhoopData = logsAsc
    .filter(l => l.recovery_score || l.hrv || l.sleep_performance)
    .map(l => ({ date: fmt(l.date), rec: l.recovery_score, hrv: l.hrv, sleep: l.sleep_performance }))

  // Actividad
  const stepsData = logsAsc.filter(l => l.steps).map(l => ({
    date: fmt(l.date),
    v: Math.round((l.steps ?? 0) / 1000 * 10) / 10,
  }))
  const kcalData = logsAsc.filter(l => l.active_kcal).map(l => ({ date: fmt(l.date), v: l.active_kcal }))
  const distData = logsAsc.filter(l => l.distance_km).map(l => ({ date: fmt(l.date), v: l.distance_km }))

  // Cuerpo
  const weightData = logsAsc.filter(l => l.weight_kg).map(l => ({ date: fmt(l.date), v: l.weight_kg }))
  const glucoseData = logsAsc.filter(l => l.glucose_avg).map(l => ({
    date: fmt(l.date), avg: l.glucose_avg, min: l.glucose_min, max: l.glucose_max,
  }))
  const rhrData = logsAsc.filter(l => l.resting_hr).map(l => ({ date: fmt(l.date), v: l.resting_hr }))
  const vo2Data = logsAsc.filter(l => l.vo2_max).map(l => ({ date: fmt(l.date), v: l.vo2_max }))

  // Ayuno
  const fastData = fastsAsc.map(f => ({ date: fmt(f.started_at.slice(0, 10)), v: getDuration(f), goal: f.goal_reached }))

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-3 bg-neutral-900 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-500 hover:text-neutral-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* WHOOP */}
      {tab === 'whoop' && (
        <div className="space-y-3">
          <ChartCard title="Recovery · HRV · Sueño">
            {combinedWhoopData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={combinedWhoopData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} domain={[0, 100]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#a3a3a3' }} />
                  <ReferenceLine y={67} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <ReferenceLine y={34} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <Line type="monotone" dataKey="rec" name="Recovery %" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="sleep" name="Sueño %" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="HRV · ms">
            {hrvData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={hrvData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} ms`, 'HRV']} labelStyle={{ color: '#a3a3a3' }} />
                  <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <Line type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#38bdf8' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* Actividad */}
      {tab === 'actividad' && (
        <div className="space-y-3">
          <ChartCard title="Pasos · miles">
            {stepsData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stepsData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} tickFormatter={v => `${v}k`} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v.toFixed(1)}k pasos`, '']}
                    labelStyle={{ color: '#a3a3a3' }}
                  />
                  <ReferenceLine y={8} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '8k', position: 'right', fill: '#22c55e', fontSize: 9 }} />
                  <Bar dataKey="v" fill="#fbbf24" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Kcal activas">
            {kcalData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={kcalData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} kcal`, '']} labelStyle={{ color: '#a3a3a3' }} />
                  <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Bar dataKey="v" fill="#fb923c" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {distData.length > 0 && (
            <ChartCard title="Distancia · km">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={distData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} tickFormatter={v => `${v}km`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} km`, '']} labelStyle={{ color: '#a3a3a3' }} />
                  <Bar dataKey="v" fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* Cuerpo */}
      {tab === 'cuerpo' && (
        <div className="space-y-3">
          {weightData.length > 0 && (
            <ChartCard title="Peso · kg">
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={weightData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} domain={['auto', 'auto']} tickFormatter={v => `${v}kg`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} kg`, 'Peso']} labelStyle={{ color: '#a3a3a3' }} />
                  <Area type="monotone" dataKey="v" stroke="#f472b6" fill="#f472b620" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {glucoseData.length > 0 && (
            <ChartCard title="Glucosa · mg/dL">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={glucoseData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} domain={[60, 'auto']} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [`${v} mg/dL`, name === 'avg' ? 'Promedio' : name === 'max' ? 'Máx' : 'Mín']} labelStyle={{ color: '#a3a3a3' }} />
                  <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '100', position: 'right', fill: '#22c55e', fontSize: 9 }} />
                  <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="max" stroke="#f87171" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="avg" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="min" stroke="#60a5fa" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center">
                {[['#34d399', 'Promedio'], ['#f87171', 'Máx'], ['#60a5fa', 'Mín']].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-1 text-[10px] text-neutral-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </ChartCard>
          )}

          {rhrData.length > 0 && (
            <ChartCard title="FC en reposo · bpm">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={rhrData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} bpm`, 'RHR']} labelStyle={{ color: '#a3a3a3' }} />
                  <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="v" stroke="#fb923c" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {vo2Data.length > 0 && (
            <ChartCard title="VO2 Max · ml/kg/min">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={vo2Data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                  <YAxis {...AXIS_PROPS} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} ml/kg`, 'VO2 Max']} labelStyle={{ color: '#a3a3a3' }} />
                  <Line type="monotone" dataKey="v" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {weightData.length === 0 && glucoseData.length === 0 && rhrData.length === 0 && vo2Data.length === 0 && <Empty />}
        </div>
      )}

      {/* Ayuno */}
      {tab === 'ayuno' && (
        <ChartCard title="Ayunos · horas">
          {fastData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fastData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" />
                <YAxis {...AXIS_PROPS} tickFormatter={v => `${v}h`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}h`, 'Ayuno']} labelStyle={{ color: '#a3a3a3' }} />
                <ReferenceLine y={14} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'Meta 14h', position: 'right', fill: '#22c55e', fontSize: 9 }} />
                <Bar dataKey="v" radius={[3, 3, 0, 0]} maxBarSize={20}
                  fill="#f59e0b"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}
    </div>
  )
}
