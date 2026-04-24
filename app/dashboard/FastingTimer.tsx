'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Fast } from '@/lib/types'

const GOAL_HOURS = 14
const GOAL_MS = GOAL_HOURS * 3600 * 1000
const CIRCUMFERENCE = 2 * Math.PI * 52 // r=52

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FastingTimer({ userId }: { userId: string }) {
  const [activeFast, setActiveFast] = useState<Fast | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  // Load active fast on mount
  const loadActiveFast = useCallback(async () => {
    const { data } = await supabase
      .from('fasts')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .maybeSingle()

    setActiveFast(data)
    if (data) {
      setElapsed(Date.now() - new Date(data.started_at).getTime())
    }
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

  async function stopFast() {
    if (!activeFast) return
    setSaving(true)
    const endedAt = new Date().toISOString()
    await supabase
      .from('fasts')
      .update({ ended_at: endedAt, goal_reached: elapsed >= GOAL_MS })
      .eq('id', activeFast.id)
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

      <div className="flex items-center gap-5">
        {/* SVG Ring */}
        <div className="flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Progreso de ayuno: ${Math.round(progress * 100)}% de 14 horas`}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#404040" strokeWidth="6" />
            {activeFast && (
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke={strokeColor}
                strokeWidth="6"
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.8s linear' }}
              />
            )}
            <text x="60" y="55" textAnchor="middle" fontSize="11" fill="#a3a3a3" fontFamily="var(--font-mono, monospace)">
              {activeFast ? formatElapsed(elapsed) : '0:00:00'}
            </text>
            <text x="60" y="70" textAnchor="middle" fontSize="18" fontWeight="600" fill={activeFast ? strokeColor : '#737373'}>
              {Math.round(progress * 100)}%
            </text>
            <text x="60" y="84" textAnchor="middle" fontSize="10" fill="#737373">
              de {GOAL_HOURS}h
            </text>
          </svg>
        </div>

        {/* Info & Controls */}
        <div className="flex-1 min-w-0">
          {activeFast ? (
            <>
              <div className="mb-3">
                <p className="text-xs text-neutral-400 mb-1">Inicio</p>
                <p className="font-mono text-sm text-neutral-100">{startTime}</p>
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
              <p className="text-neutral-300 text-sm">Sin ayuno activo</p>
              <p className="text-neutral-500 text-xs mt-1">Meta: {GOAL_HOURS}h diarias</p>
            </div>
          )}

          <button
            onClick={activeFast ? stopFast : startFast}
            disabled={loading || saving}
            className={`w-full py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
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
