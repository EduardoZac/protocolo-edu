'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Fast } from '@/lib/types'

const GOAL_HOURS = 14
const GOAL_MS = GOAL_HOURS * 3600 * 1000
const CIRCUMFERENCE = 2 * Math.PI * 52 // r=52

const PHASES = [
  { minH: 0,  maxH: 4,  emoji: '🍽️', name: 'Digestión',       desc: 'Tu cuerpo procesa los alimentos. Glucosa e insulina elevadas.', color: '#94a3b8' },
  { minH: 4,  maxH: 8,  emoji: '🔋', name: 'Transición',      desc: 'El glucógeno hepático se agota. El cuerpo busca fuentes alternas.', color: '#fb923c' },
  { minH: 8,  maxH: 12, emoji: '🔥', name: 'Quema de grasa',  desc: 'Insulina baja. Tu cuerpo empieza a oxidar grasa como combustible.', color: '#f59e0b' },
  { minH: 12, maxH: 16, emoji: '⚡', name: 'Cetosis leve',    desc: 'Cetonas en sangre. HGH aumenta hasta 5x. Claridad mental.', color: '#a78bfa' },
  { minH: 16, maxH: 18, emoji: '🧬', name: 'Autofagia inicia', desc: 'Las células empiezan a reciclarse y limpiar proteínas dañadas.', color: '#34d399' },
  { minH: 18, maxH: 24, emoji: '✨', name: 'Autofagia activa', desc: 'Regeneración celular intensa. Reducción de inflamación sistémica.', color: '#22c55e' },
  { minH: 24, maxH: Infinity, emoji: '🌟', name: 'Autofagia máxima', desc: 'Regeneración profunda. Solo recomendado con supervisión.', color: '#4ade80' },
]

function getPhase(hours: number) {
  return PHASES.find(p => hours >= p.minH && hours < p.maxH) ?? PHASES[0]
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function toLocalDatetimeValue(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function FastingTimer({ userId }: { userId: string }) {
  const [activeFast, setActiveFast] = useState<Fast | null>(null)
  const [lastFast, setLastFast] = useState<Fast | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editingLast, setEditingLast] = useState(false)
  const [lastStartValue, setLastStartValue] = useState('')
  const [lastEndValue, setLastEndValue] = useState('')

  const supabase = createClient()

  // Load active fast and last completed fast on mount
  const loadActiveFast = useCallback(async () => {
    const [{ data: active }, { data: last }] = await Promise.all([
      supabase.from('fasts').select('*').eq('user_id', userId).is('ended_at', null).maybeSingle(),
      supabase.from('fasts').select('*').eq('user_id', userId).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    setActiveFast(active)
    if (active) setElapsed(Date.now() - new Date(active.started_at).getTime())
    setLastFast(last)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { loadActiveFast() }, [loadActiveFast])

  // Tick every second while fasting
  useEffect(() => {
    if (!activeFast) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(activeFast.started_at).getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [activeFast])

  async function startFast() {
    setSaving(true)
    const { data } = await supabase
      .from('fasts')
      .insert({ user_id: userId, started_at: new Date().toISOString() })
      .select('*')
      .single()
    setActiveFast(data)
    setElapsed(0)
    setSaving(false)
  }

  async function saveStartTime() {
    if (!activeFast || !editValue) return
    setSaving(true)
    const newStart = new Date(editValue).toISOString()
    await supabase.from('fasts').update({ started_at: newStart }).eq('id', activeFast.id)
    setActiveFast({ ...activeFast, started_at: newStart })
    setElapsed(Date.now() - new Date(newStart).getTime())
    setEditing(false)
    setSaving(false)
  }

  async function saveLastFast() {
    if (!lastFast || !lastStartValue || !lastEndValue) return
    const newStart = new Date(lastStartValue).toISOString()
    const newEnd = new Date(lastEndValue).toISOString()
    if (new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
      alert('La hora de fin debe ser después de la de inicio.')
      return
    }
    setSaving(true)
    const goalReachedNow = new Date(newEnd).getTime() - new Date(newStart).getTime() >= GOAL_MS
    await supabase
      .from('fasts')
      .update({ started_at: newStart, ended_at: newEnd, goal_reached: goalReachedNow })
      .eq('id', lastFast.id)
    setLastFast({ ...lastFast, started_at: newStart, ended_at: newEnd, goal_reached: goalReachedNow })
    setEditingLast(false)
    setSaving(false)
  }

  async function stopFast() {
    if (!activeFast) return
    setSaving(true)
    const endedAt = new Date().toISOString()
    const goalReachedNow = elapsed >= GOAL_MS
    await supabase
      .from('fasts')
      .update({ ended_at: endedAt, goal_reached: goalReachedNow })
      .eq('id', activeFast.id)
    setLastFast({ ...activeFast, ended_at: endedAt, goal_reached: goalReachedNow })
    setActiveFast(null)
    setElapsed(0)
    setSaving(false)
  }

  const progress = Math.min(elapsed / GOAL_MS, 1)
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const hours = elapsed / 3600000
  const goalReached = elapsed >= GOAL_MS
  const strokeColor = goalReached ? '#22c55e' : '#f59e0b'
  const startTime = activeFast
    ? new Date(activeFast.started_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
      <p className="text-xs text-neutral-400 uppercase tracking-widest mb-4">Ayuno</p>

      {/* Phase banner */}
      {activeFast && (() => {
        const phase = getPhase(hours)
        return (
          <div className="mb-4 rounded-xl px-3 py-2.5" style={{ backgroundColor: phase.color + '18', border: `1px solid ${phase.color}33` }}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base">{phase.emoji}</span>
              <span className="text-xs font-semibold" style={{ color: phase.color }}>{phase.name}</span>
            </div>
            <p className="text-neutral-400 text-xs leading-relaxed">{phase.desc}</p>
          </div>
        )
      })()}

      <div className="flex items-center gap-5">
        {/* Liquid fill circle */}
        <div className="flex-shrink-0">
          <div
            className="relative w-[120px] h-[120px] rounded-full overflow-hidden"
            style={{
              background: '#111',
              boxShadow: activeFast
                ? `0 0 0 3px ${strokeColor}30, 0 0 22px ${strokeColor}18`
                : '0 0 0 3px #282828',
            }}
          >
            {activeFast && (
              <div
                className="liquid-fill"
                style={{
                  height: `${Math.max(4, progress * 100)}%`,
                  background: goalReached
                    ? 'linear-gradient(to top, #15803d, #22c55e)'
                    : 'linear-gradient(to top, #b45309, #f59e0b)',
                }}
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-0.5">
              <span className="text-[10px] font-mono tabular-nums text-neutral-400">
                {activeFast ? formatElapsed(elapsed) : '─:──:──'}
              </span>
              <span
                className="text-2xl font-bold tabular-nums leading-none"
                style={{
                  color: activeFast ? strokeColor : '#404040',
                  textShadow: activeFast ? `0 0 14px ${strokeColor}70` : 'none',
                }}
              >
                {Math.round(progress * 100)}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-neutral-600">
                de {GOAL_HOURS}h
              </span>
            </div>
          </div>
        </div>

        {/* Info & Controls */}
        <div className="flex-1 min-w-0">
          {activeFast ? (
            <>
              <div className="mb-3">
                <p className="text-xs text-neutral-400 mb-1">Inicio</p>
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="datetime-local"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="bg-neutral-900 border border-neutral-600 rounded-lg px-2 py-1 text-sm text-neutral-100 focus:outline-none focus:border-amber-500 w-full"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveStartTime} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-medium">
                        {saving ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditing(false)} className="flex-1 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditValue(toLocalDatetimeValue(activeFast.started_at)); setEditing(true) }}
                    className="font-mono text-sm text-neutral-100 hover:text-amber-400 transition-colors text-left"
                  >
                    {startTime} ✎
                  </button>
                )}
              </div>
              <div className="mb-4">
                <p className="text-xs text-neutral-400 mb-1">Horas</p>
                <p className={`font-semibold text-lg ${goalReached ? 'text-green-400' : 'text-amber-400'}`}>
                  {hours.toFixed(1)}h {goalReached && '✓'}
                </p>
              </div>
              {goalReached && (
                <p className="text-green-400 text-xs mb-3">Meta alcanzada</p>
              )}
            </>
          ) : (
            <div className="mb-4">
              {lastFast ? (() => {
                const lastMs = new Date(lastFast.ended_at!).getTime() - new Date(lastFast.started_at).getTime()
                const lastHours = lastMs / 3600000
                const lastPhase = getPhase(lastHours)
                const lastGoal = lastFast.goal_reached ?? lastMs >= GOAL_MS
                const fmt = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div className="rounded-xl px-3 py-2.5 mb-2" style={{ backgroundColor: lastGoal ? '#22c55e18' : '#f59e0b18', border: `1px solid ${lastGoal ? '#22c55e33' : '#f59e0b33'}` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: lastGoal ? '#22c55e' : '#f59e0b' }}>
                        {lastGoal ? '✓ Meta alcanzada' : 'Último ayuno'}
                      </p>
                      {!editingLast && (
                        <button
                          onClick={() => {
                            setLastStartValue(toLocalDatetimeValue(lastFast.started_at))
                            setLastEndValue(toLocalDatetimeValue(lastFast.ended_at!))
                            setEditingLast(true)
                          }}
                          className="text-[10px] text-neutral-400 hover:text-amber-400"
                        >
                          Editar ✎
                        </button>
                      )}
                    </div>
                    {editingLast ? (
                      <div className="flex flex-col gap-2 text-xs">
                        <label className="text-neutral-400">
                          Inicio
                          <input
                            type="datetime-local"
                            value={lastStartValue}
                            onChange={e => setLastStartValue(e.target.value)}
                            className="mt-1 w-full bg-neutral-900 border border-neutral-600 rounded-lg px-2 py-1 text-neutral-100 focus:outline-none focus:border-amber-500"
                          />
                        </label>
                        <label className="text-neutral-400">
                          Fin
                          <input
                            type="datetime-local"
                            value={lastEndValue}
                            onChange={e => setLastEndValue(e.target.value)}
                            className="mt-1 w-full bg-neutral-900 border border-neutral-600 rounded-lg px-2 py-1 text-neutral-100 focus:outline-none focus:border-amber-500"
                          />
                        </label>
                        <div className="flex gap-2 mt-1">
                          <button onClick={saveLastFast} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium">
                            {saving ? '...' : 'Guardar'}
                          </button>
                          <button onClick={() => setEditingLast(false)} className="flex-1 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-neutral-400">Duración</span>
                        <span className="text-neutral-100 font-medium">{lastHours.toFixed(1)}h</span>
                        <span className="text-neutral-400">Inicio</span>
                        <span className="text-neutral-100">{fmt(lastFast.started_at)}</span>
                        <span className="text-neutral-400">Fin</span>
                        <span className="text-neutral-100">{fmt(lastFast.ended_at!)}</span>
                        <span className="text-neutral-400">Fase</span>
                        <span style={{ color: lastPhase.color }}>{lastPhase.emoji} {lastPhase.name}</span>
                      </div>
                    )}
                  </div>
                )
              })() : (
                <>
                  <p className="text-neutral-300 text-sm">Sin ayuno activo</p>
                  <p className="text-neutral-500 text-xs mt-1">Meta: {GOAL_HOURS}h diarias</p>
                </>
              )}
            </div>
          )}

          <button
            onClick={activeFast ? stopFast : startFast}
            disabled={loading || saving}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
              activeFast
                ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-100 border border-neutral-600'
                : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
            }`}
          >
            {saving ? '...' : activeFast ? 'Terminar ayuno' : 'Iniciar ayuno'}
          </button>
        </div>
      </div>
    </div>
  )
}
