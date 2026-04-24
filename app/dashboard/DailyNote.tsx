'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'

export default function DailyNote({ userId, date }: { userId: string; date: string }) {
  const [note, setNote] = useState('')
  const [energy, setEnergy] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
  const supabase = createClient()

  const loadLog = useCallback(async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('notes, energy')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    setNote(data?.notes ?? '')
    setEnergy(data?.energy ?? null)
    setLoading(false)
  }, [supabase, userId, date])

  useEffect(() => { loadLog() }, [loadLog])

  async function save(notes: string, en: number | null) {
    await supabase
      .from('daily_logs')
      .upsert({ user_id: userId, date, notes, energy: en, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
    setSaved(true)
  }

  function handleNoteChange(value: string) {
    setNote(value)
    setSaved(false)
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => save(value, energy), 1500)
  }

  async function handleEnergyClick(val: number) {
    const next = energy === val ? null : val
    setEnergy(next)
    setSaved(false)
    await save(note, next)
    setSaved(true)
  }

  const energyColors: Record<number, string> = {
    1: '#ef4444', 2: '#f97316', 3: '#f59e0b',
    4: '#84cc16', 5: '#22c55e',
  }

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-400 uppercase tracking-widest">Nota del día</p>
        {!loading && saved && <span className="text-xs text-green-500">Guardado</span>}
      </div>

      {/* Energy 1-5 */}
      <div className="mb-4">
        <p className="text-xs text-neutral-400 mb-2">Energía subjetiva</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(val => (
            <button
              key={val}
              onClick={() => handleEnergyClick(val)}
              className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: energy === val ? energyColors[val] : '#3a3a3a',
                color: energy === val ? '#0a0a0a' : '#a3a3a3',
                border: energy === val ? 'none' : '1px solid #525252',
              }}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={note}
        onChange={e => handleNoteChange(e.target.value)}
        placeholder="Cómo estuvo el día, cómo te sentiste en el ayuno, qué comiste, lo que sea..."
        rows={4}
        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-3 text-sm text-neutral-100 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-500 transition-colors leading-relaxed"
      />
    </div>
  )
}
