'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { recoveryColor, hrvColor, sleepColor, strainColor } from '@/lib/types'

interface WhoopData {
  hrv: string
  recovery_score: string
  sleep_performance: string
  strain: string
}

const EMPTY: WhoopData = { hrv: '', recovery_score: '', sleep_performance: '', strain: '' }

const FIELDS = [
  { key: 'recovery_score', label: 'Recovery', unit: '%', min: 0, max: 100, step: 1, colorFn: recoveryColor, hint: '67+ verde · 34-66 amarillo · <34 rojo' },
  { key: 'hrv',            label: 'HRV',      unit: 'ms', min: 0, max: 250, step: 1, colorFn: hrvColor, hint: '70+ ms ideal' },
  { key: 'sleep_performance', label: 'Sueño', unit: '%', min: 0, max: 100, step: 1, colorFn: sleepColor, hint: '85%+ óptimo' },
  { key: 'strain',         label: 'Strain',   unit: '',  min: 0, max: 21,  step: 0.1, colorFn: strainColor, hint: '<10 recuperación · 10-14 moderado' },
] as const

export default function WhoopLogger({ userId, date }: { userId: string; date: string }) {
  const [data, setData] = useState<WhoopData>(EMPTY)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
  const supabase = createClient()

  const loadLog = useCallback(async () => {
    const { data: row } = await supabase
      .from('daily_logs')
      .select('hrv, recovery_score, sleep_performance, strain')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (row) {
      setData({
        hrv: row.hrv?.toString() ?? '',
        recovery_score: row.recovery_score?.toString() ?? '',
        sleep_performance: row.sleep_performance?.toString() ?? '',
        strain: row.strain?.toString() ?? '',
      })
    }
    setLoading(false)
  }, [supabase, userId, date])

  useEffect(() => { loadLog() }, [loadLog])

  function handleChange(key: keyof WhoopData, value: string) {
    const next = { ...data, [key]: value }
    setData(next)
    setSaved(false)

    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => autoSave(next), 1200)
  }

  async function autoSave(d: WhoopData) {
    const payload: Record<string, number | null> = {
      hrv: d.hrv ? parseInt(d.hrv) : null,
      recovery_score: d.recovery_score ? parseInt(d.recovery_score) : null,
      sleep_performance: d.sleep_performance ? parseInt(d.sleep_performance) : null,
      strain: d.strain ? parseFloat(d.strain) : null,
    }
    await supabase
      .from('daily_logs')
      .upsert({ user_id: userId, date, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
    setSaved(true)
  }

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-400 uppercase tracking-widest">WHOOP</p>
        {!loading && saved && <span className="text-xs text-green-500">Guardado</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(field => {
          const numVal = data[field.key] ? parseFloat(data[field.key]) : null
          const colorClass = field.colorFn(numVal)
          return (
            <div key={field.key} className="bg-neutral-900 rounded-xl p-3">
              <p className="text-xs text-neutral-400 mb-1">{field.label}</p>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={data[field.key]}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder="—"
                  className={`w-full bg-transparent font-mono text-xl font-semibold focus:outline-none placeholder-neutral-600 ${data[field.key] ? colorClass : 'text-neutral-400'}`}
                />
                {field.unit && <span className="text-neutral-500 text-xs">{field.unit}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-neutral-500 text-xs mt-3 text-center">Guarda solo al escribir el número</p>
    </div>
  )
}
