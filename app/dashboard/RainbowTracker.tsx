'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { RAINBOW_COLORS } from '@/lib/types'

export default function RainbowTracker({ userId, date }: { userId: string; date: string }) {
  const [activeColors, setActiveColors] = useState<string[]>([])
  const [justToggled, setJustToggled] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadLog = useCallback(async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('colors')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    setActiveColors(data?.colors ?? [])
    setLoading(false)
  }, [supabase, userId, date])

  useEffect(() => { loadLog() }, [loadLog])

  async function toggleColor(colorId: string) {
    const next = activeColors.includes(colorId)
      ? activeColors.filter(c => c !== colorId)
      : [...activeColors, colorId]

    setActiveColors(next)
    setFocused(colorId)

    if (!activeColors.includes(colorId)) {
      setJustToggled(colorId)
      setTimeout(() => setJustToggled(null), 350)
    }

    await supabase
      .from('daily_logs')
      .upsert({ user_id: userId, date, colors: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
  }

  const count = activeColors.length
  const allDone = count === 7
  const focusedIndex = RAINBOW_COLORS.findIndex(c => c.id === focused)
  const focusedColor = focusedIndex >= 0 ? RAINBOW_COLORS[focusedIndex] : null
  // Center of each circle: (i + 0.5) / 7 of the total width
  const arrowLeft = focusedIndex >= 0 ? `calc(${((focusedIndex + 0.5) / 7) * 100}% - 6px)` : '0'

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-500"
      style={{
        background: allDone
          ? 'linear-gradient(135deg, #1a1a1a 0%, #1c1a10 100%)'
          : '#1c1c1c',
        border: allDone ? '1px solid #f59e0b30' : '1px solid #2a2a2a',
        boxShadow: allDone ? '0 0 24px #f59e0b10' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-neutral-500">Arcoíris</p>
        <span
          className="text-sm font-bold tabular-nums transition-colors duration-300"
          style={{ color: count >= 7 ? '#22c55e' : count >= 5 ? '#f59e0b' : count >= 3 ? '#a3a3a3' : '#525252' }}
        >
          {count}/7
        </span>
      </div>

      {/* Color circles */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {RAINBOW_COLORS.map(color => {
          const active = activeColors.includes(color.id)
          const popping = justToggled === color.id
          const isFocused = focused === color.id
          return (
            <button
              key={color.id}
              onClick={() => toggleColor(color.id)}
              disabled={loading}
              className="flex flex-col items-center gap-1.5 min-h-[52px] justify-center"
            >
              <div
                className={`w-9 h-9 rounded-full transition-all duration-200 ${popping ? 'dot-active' : ''}`}
                style={{
                  backgroundColor: color.hex,
                  opacity: active ? 1 : 0.22,
                  boxShadow: isFocused
                    ? `0 0 0 2px ${color.hex}, 0 0 16px ${color.hex}60`
                    : active
                    ? `0 0 12px ${color.hex}60, 0 0 4px ${color.hex}40`
                    : 'none',
                  transform: active && !popping ? 'scale(1.12)' : undefined,
                }}
              />
              <span
                className="text-[9px] leading-none transition-colors duration-200"
                style={{ color: active ? '#d4d4d4' : '#525252' }}
              >
                {color.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Info panel with arrow pointing at the tapped circle */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: focusedColor ? '90px' : '0px', opacity: focusedColor ? 1 : 0 }}
      >
        {focusedColor && (
          <div className="relative mb-3">
            {/* Triangle arrow */}
            <div
              className="absolute -top-1.5 w-3 h-3 rotate-45 transition-all duration-200"
              style={{
                left: arrowLeft,
                backgroundColor: focusedColor.hex + '20',
                borderTop: `1px solid ${focusedColor.hex}35`,
                borderLeft: `1px solid ${focusedColor.hex}35`,
              }}
            />
            <div
              className="rounded-xl px-3 py-2.5"
              style={{
                backgroundColor: focusedColor.hex + '14',
                border: `1px solid ${focusedColor.hex}30`,
              }}
            >
              <p className="text-xs font-medium mb-0.5" style={{ color: focusedColor.hex }}>
                {focusedColor.tip}
              </p>
              <p className="text-[11px] text-neutral-400 leading-snug">
                {focusedColor.benefit}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Multicolor progress bar */}
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden flex gap-px">
        {RAINBOW_COLORS.map((color, i) => (
          <div
            key={color.id}
            className="flex-1 rounded-full transition-all duration-400"
            style={{
              background: activeColors.includes(color.id) ? color.hex : '#2a2a2a',
              transitionDelay: `${i * 30}ms`,
            }}
          />
        ))}
      </div>

      <p className="text-neutral-600 text-[11px] mt-3 text-center transition-all duration-300">
        {count === 0 && 'Toca los que ya comiste'}
        {count > 0 && count < 5 && `${5 - count} más para la meta`}
        {count >= 5 && count < 7 && 'Casi completo'}
        {count === 7 && '✓ Arcoíris completo'}
      </p>
    </div>
  )
}
