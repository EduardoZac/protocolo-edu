'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface DayData {
  date: string
  hrv: number | null
  resting_hr: number | null
  steps: number | null
  sleep_hours: number | null
  sleep_performance: number | null
}

const WANTED = new Set([
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKCategoryTypeIdentifierSleepAnalysis',
])

const SLEEP_ASLEEP = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
])

function attr(tag: string, name: string): string {
  const i = tag.indexOf(name + '="')
  if (i === -1) return ''
  const start = i + name.length + 2
  const end = tag.indexOf('"', start)
  return end === -1 ? '' : tag.slice(start, end)
}

function parseHealthXML(xmlText: string): DayData[] {
  // Only last 90 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const acc: Record<string, {
    hrv: number[]
    resting_hr: number[]
    steps: number
    sleepMs: number
  }> = {}

  function slot(date: string) {
    if (!acc[date]) acc[date] = { hrv: [], resting_hr: [], steps: 0, sleepMs: 0 }
    return acc[date]
  }

  // Regex-based parse — no DOM tree, ~5x faster than DOMParser
  const re = /<Record\b[^>]+\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xmlText)) !== null) {
    const tag  = m[0]
    const type = attr(tag, 'type')
    if (!WANTED.has(type)) continue

    const startDate = attr(tag, 'startDate')
    const date = startDate.slice(0, 10)
    if (date < cutoffStr) continue

    if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
      slot(date).hrv.push(parseFloat(attr(tag, 'value')))

    } else if (type === 'HKQuantityTypeIdentifierRestingHeartRate') {
      slot(date).resting_hr.push(parseFloat(attr(tag, 'value')))

    } else if (type === 'HKQuantityTypeIdentifierStepCount') {
      slot(date).steps += parseFloat(attr(tag, 'value'))

    } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      const val = attr(tag, 'value')
      if (SLEEP_ASLEEP.has(val)) {
        const endDate = attr(tag, 'endDate')
        const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
        slot(endDate.slice(0, 10)).sleepMs += ms
      }
    }
  }

  return Object.entries(acc)
    .map(([date, d]) => {
      const hrv = d.hrv.length > 0
        ? Math.round(d.hrv.reduce((a, b) => a + b, 0) / d.hrv.length)
        : null
      const resting_hr = d.resting_hr.length > 0
        ? Math.round(d.resting_hr[d.resting_hr.length - 1])
        : null
      const steps = d.steps > 0 ? Math.round(d.steps) : null
      const sleep_hours = d.sleepMs > 0
        ? Math.round(d.sleepMs / 360000) / 10
        : null
      const sleep_performance = sleep_hours
        ? Math.min(Math.round((sleep_hours / 8) * 100), 100)
        : null
      return { date, hrv, resting_hr, steps, sleep_hours, sleep_performance }
    })
    .filter(d => d.hrv || d.resting_hr || d.steps || d.sleep_hours)
    .sort((a, b) => b.date.localeCompare(a.date))
}

type Stage = 'idle' | 'parsing' | 'preview' | 'uploading' | 'done'

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [days, setDays] = useState<DayData[]>([])
  const [uploaded, setUploaded] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const router = useRouter()

  const processFile = useCallback((file: File) => {
    setStage('parsing')
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = parseHealthXML(text)
        if (parsed.length === 0) {
          setError('No se encontraron datos. Usa el archivo exportar.xml (no export_cda.xml).')
          setStage('idle')
          return
        }
        setDays(parsed)
        setStage('preview')
      } catch (err) {
        setError('Error al parsear el XML. Asegúrate de exportar desde Apple Health.')
        setStage('idle')
      }
    }
    // Read only the last 150 MB — Health exports are chronological,
    // so the last 90 days are always near the end of the file.
    const CHUNK = 150 * 1024 * 1024
    const slice = file.slice(Math.max(0, file.size - CHUNK), file.size)
    reader.readAsText(slice)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function handleUpload() {
    setStage('uploading')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    let count = 0
    for (const day of days) {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        date: day.date,
        updated_at: new Date().toISOString(),
      }
      if (day.hrv !== null) payload.hrv = day.hrv
      if (day.resting_hr !== null) payload.resting_hr = day.resting_hr
      if (day.steps !== null) payload.steps = day.steps
      if (day.sleep_performance !== null) payload.sleep_performance = day.sleep_performance

      await supabase
        .from('daily_logs')
        .upsert(payload, { onConflict: 'user_id,date' })

      count++
      setUploaded(count)
    }
    setStage('done')
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col max-w-2xl mx-auto px-4 py-8">

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
        >
          ← Dashboard
        </button>
        <h1 className="text-neutral-100 font-semibold">Importar Apple Health</h1>
      </div>

      {/* IDLE */}
      {stage === 'idle' && (
        <div className="space-y-6">
          <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5 text-sm text-neutral-400 space-y-2">
            <p className="text-neutral-200 font-medium mb-3">Cómo exportar tus datos</p>
            <p>1. Abre <strong className="text-neutral-100">Apple Health</strong> en tu iPhone</p>
            <p>2. Toca tu foto de perfil (arriba a la derecha)</p>
            <p>3. <strong className="text-neutral-100">Exportar todos los datos de salud</strong></p>
            <p>4. Comparte el ZIP a tu Mac → descomprime → sube el archivo <strong className="text-neutral-100">export.xml</strong></p>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
              dragging
                ? 'border-amber-500 bg-amber-500/5'
                : 'border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <p className="text-neutral-400 mb-4">Arrastra el archivo <strong>export.xml</strong> aquí</p>
            <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-sm px-5 py-2 rounded-xl transition-colors">
              O seleccionar archivo
              <input type="file" accept=".xml" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      )}

      {/* PARSING */}
      {stage === 'parsing' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 mt-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Procesando export.xml...</p>
        </div>
      )}

      {/* PREVIEW */}
      {stage === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-neutral-300 text-sm">
              <span className="text-amber-400 font-semibold">{days.length} días</span> encontrados
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStage('idle')}
                className="text-neutral-500 hover:text-neutral-300 text-sm px-3 py-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-sm px-5 py-2 rounded-xl transition-colors"
              >
                Subir {days.length} días
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {days.map(d => (
              <div key={d.date} className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 flex items-center gap-4 text-sm">
                <span className="text-neutral-400 w-24 flex-shrink-0">{d.date}</span>
                <div className="flex gap-3 flex-wrap">
                  {d.hrv && <span className="text-sky-400">HRV {d.hrv}ms</span>}
                  {d.resting_hr && <span className="text-purple-400">FC {d.resting_hr}bpm</span>}
                  {d.sleep_hours && <span className="text-indigo-400">Sueño {d.sleep_hours}h</span>}
                  {d.steps && <span className="text-green-400">{d.steps.toLocaleString()} pasos</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPLOADING */}
      {stage === 'uploading' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 mt-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Subiendo {uploaded} / {days.length} días...</p>
          <div className="w-48 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(uploaded / days.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* DONE */}
      {stage === 'done' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 mt-20 text-center">
          <div className="text-5xl">✓</div>
          <div>
            <p className="text-neutral-100 font-semibold text-lg">{days.length} días importados</p>
            <p className="text-neutral-500 text-sm mt-1">Tus datos de salud ya están en el dashboard</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            Ver dashboard
          </button>
        </div>
      )}
    </div>
  )
}
