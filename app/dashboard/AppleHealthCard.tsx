'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { DailyLog } from '@/lib/types'

function stepsColor(s: number | null): string {
  if (s == null) return 'text-neutral-500'
  if (s >= 8000) return 'text-green-400'
  if (s >= 5000) return 'text-amber-400'
  return 'text-red-400'
}
function bpColor(sys: number | null, dia: number | null): string {
  if (sys == null || dia == null) return 'text-neutral-500'
  if (sys < 120 && dia < 80) return 'text-green-400'
  if (sys < 130 && dia < 80) return 'text-amber-400'
  return 'text-red-400'
}
function glucoseAvgColor(g: number | null): string {
  if (g == null) return 'text-neutral-500'
  if (g < 100) return 'text-green-400'
  if (g < 126) return 'text-amber-400'
  return 'text-red-400'
}
function tirColor(t: number | null): string {
  if (t == null) return 'text-neutral-500'
  if (t >= 90) return 'text-green-400'
  if (t >= 70) return 'text-amber-400'
  return 'text-red-400'
}

interface MetricProps {
  label: string
  value: string
  unit?: string
  className?: string
}
function Metric({ label, value, unit, className }: MetricProps) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">{label}</p>
      <p className={`font-mono text-sm ${className ?? 'text-neutral-100'}`}>
        {value}
        {unit && value !== '—' && <span className="text-neutral-500 text-xs ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

function Vo2MaxField({ value, onSave }: { value: number | null; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setInput(value != null ? String(value) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function save() {
    const num = parseFloat(input)
    if (!isNaN(num) && num > 0) {
      setSaving(true)
      await onSave(Math.round(num * 10) / 10)
      setSaving(false)
    }
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">VO2 max</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            step="0.1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onBlur={save}
            onKeyDown={onKeyDown}
            className="w-16 bg-neutral-700 border border-amber-500/50 rounded px-1.5 py-0.5 text-sm font-mono text-neutral-100 focus:outline-none focus:border-amber-500"
          />
          <span className="text-neutral-500 text-xs">ml/kg</span>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="flex items-baseline gap-1 group"
          title="Toca para editar"
        >
          <span className={`font-mono text-sm ${value != null ? 'text-neutral-100' : 'text-neutral-600'}`}>
            {saving ? '…' : value != null ? value.toFixed(1) : '—'}
          </span>
          {value != null && (
            <span className="text-neutral-500 text-xs">ml/kg</span>
          )}
          <span className="text-[10px] text-neutral-700 group-hover:text-neutral-500 transition-colors ml-0.5">
            ✎
          </span>
        </button>
      )}
    </div>
  )
}

export default function AppleHealthCard({ userId, date }: { userId: string; date: string }) {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    setLog(data)
    setLoading(false)
  }, [supabase, userId, date])

  useEffect(() => { load() }, [load])

  async function saveVo2Max(value: number) {
    await supabase
      .from('daily_logs')
      .upsert({ user_id: userId, date, vo2_max: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
    setLog(prev => prev ? { ...prev, vo2_max: value } : prev)
  }

  if (loading) return null

  const hasActivity = log?.steps || log?.active_kcal || log?.exercise_min || log?.stand_hours || log?.distance_km || log?.flights_climbed
  const hasBody = log?.weight_kg || log?.body_fat_pct || log?.lean_mass_kg || log?.waist_cm
  const hasMetabolic = log?.glucose_avg || log?.glucose_max
  const hasCardio = log?.bp_systolic || log?.vo2_max || log?.resting_hr
  const hasMind = log?.mindfulness_min

  if (!hasActivity && !hasBody && !hasMetabolic && !hasCardio && !hasMind) {
    return (
      <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">Apple Health</p>
        <p className="text-neutral-500 text-sm">
          Sin datos hoy. Configura Health Auto Export para que se sincronice automáticamente.
        </p>
      </div>
    )
  }

  const fmt = (v: number | null | undefined, decimals = 0) =>
    v == null ? '—' : decimals === 0 ? `${Math.round(v)}` : `${v.toFixed(decimals)}`

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5 space-y-5">
      <p className="text-xs text-neutral-400 uppercase tracking-widest">Apple Health</p>

      {hasActivity && (
        <Section title="Actividad">
          <Metric label="Pasos" value={fmt(log?.steps)} className={stepsColor(log?.steps ?? null)} />
          <Metric label="Kcal activas" value={fmt(log?.active_kcal)} unit="kcal" />
          <Metric label="Ejercicio" value={fmt(log?.exercise_min)} unit="min" />
          <Metric label="Distancia" value={fmt(log?.distance_km, 1)} unit="km" />
          <Metric label="Pisos" value={fmt(log?.flights_climbed)} />
          <Metric label="Stand" value={fmt(log?.stand_hours)} unit="h" />
        </Section>
      )}

      {(hasCardio || true) && (
        <Section title="Cardiovascular">
          <Metric
            label="Presión"
            value={log?.bp_systolic && log?.bp_diastolic ? `${log.bp_systolic}/${log.bp_diastolic}` : '—'}
            className={bpColor(log?.bp_systolic ?? null, log?.bp_diastolic ?? null)}
          />
          <Vo2MaxField value={log?.vo2_max ?? null} onSave={saveVo2Max} />
          <Metric label="RHR" value={fmt(log?.resting_hr)} unit="bpm" />
        </Section>
      )}

      {hasMetabolic && (
        <Section title="Glucosa">
          <Metric
            label="Promedio"
            value={fmt(log?.glucose_avg, 1)}
            unit="mg/dL"
            className={glucoseAvgColor(log?.glucose_avg ?? null)}
          />
          <Metric label="Mínima" value={fmt(log?.glucose_min, 0)} unit="mg/dL" />
          <Metric label="Máxima" value={fmt(log?.glucose_max, 0)} unit="mg/dL" />
          <Metric
            label="TIR"
            value={fmt(log?.glucose_time_in_range)}
            unit="%"
            className={tirColor(log?.glucose_time_in_range ?? null)}
          />
        </Section>
      )}

      {hasBody && (
        <Section title="Composición">
          <Metric label="Peso" value={fmt(log?.weight_kg, 1)} unit="kg" />
          <Metric label="% grasa" value={fmt(log?.body_fat_pct, 1)} unit="%" />
          <Metric label="Masa magra" value={fmt(log?.lean_mass_kg, 1)} unit="kg" />
          <Metric label="Cintura" value={fmt(log?.waist_cm, 1)} unit="cm" />
        </Section>
      )}

      {hasMind && (
        <Section title="Mente">
          <Metric label="Mindfulness" value={fmt(log?.mindfulness_min)} unit="min" />
        </Section>
      )}
    </div>
  )
}
