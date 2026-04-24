'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { RAINBOW_COLORS } from '@/lib/types'

export default function RainbowTracker({ userId, date }: { userId: string; date: string }) {
  const [activeColors, setActiveColors] = useState<string[]>([])
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

    await supabase
      .from('daily_logs')
      .upsert({ user_id: userId, date, colors: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
  }

  const count = activeColors.length

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-400 uppercase tracking-widest">Arcoíris</p>
        <span className={`text-sm font-mono font-semibold ${count >= 5 ? 'text-green-400' : count >= 3 ? 'text-amber-400' : 'text-neutral-500'}`}>
          {count}/7
        </span>
      </div>

      {/* Color dots */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {RAINBOW_COLORS.map(color => {
          const active = activeColors.includes(color.id)
          return (
            <button
              key={color.id}
              onClick={() => toggleColor(color.id)}
              disabled={loading}
              title={color.tip}
              className="flex flex-col items-center gap-1.5 group min-h-[52px] justify-center"
            >
              <div
                className="w-10 h-10 rounded-full transition-all duration-150 group-hover:scale-110 group-active:scale-95"
                style={{
                  backgroundColor: color.hex,
                  opacity: active ? 1 : 0.28,
                  boxShadow: active ? `0 0 10px ${color.hex}55` : 'none',
                }}
              />
              <span className={`text-[10px] leading-none ${active ? 'text-neutral-100' : 'text-neutral-500'}`}>
                {color.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(count / 7) * 100}%`,
            background: count >= 5 ? '#22c55e' : count >= 3 ? '#f59e0b' : '#525252',
          }}
        />
      </div>

      <p className="text-neutral-500 text-xs mt-3 text-center">
        {count === 0 && 'Toca los colores que ya comiste'}
        {count > 0 && count < 5 && `${5 - count} colores más para meta`}
        {count >= 5 && count < 7 && 'Muy bien — sigue sumando'}
        {count === 7 && '✓ Arcoíris completo hoy'}
      </p>
    </div>
  )
}
