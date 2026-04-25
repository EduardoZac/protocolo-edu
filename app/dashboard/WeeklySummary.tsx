'use client'

import { useState } from 'react'

interface Props {
  userId: string
}

export default function WeeklySummary({ userId }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.reason === 'no_data') {
        setSummary(null)
        setError('No hay suficientes datos esta semana para generar un resumen.')
      } else {
        setSummary(data.summary)
        setGenerated(true)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400 uppercase tracking-widest">Resumen IA · esta semana</p>
        {generated && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Regenerar
          </button>
        )}
      </div>

      {!generated && !loading && (
        <button
          onClick={generate}
          className="w-full bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 active:scale-[0.98] transition-all rounded-2xl px-4 py-4 flex items-center gap-3 text-left"
        >
          <span className="text-2xl">✨</span>
          <div>
            <p className="text-amber-400 font-semibold text-sm">Analizar mi semana</p>
            <p className="text-neutral-500 text-xs">Claude revisa tus métricas y detecta patrones</p>
          </div>
        </button>
      )}

      {loading && (
        <div className="bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-5 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-neutral-400 text-sm">Analizando tu semana…</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {summary && !loading && (
        <div className="bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤖</span>
            <span className="text-xs text-neutral-500 font-medium">Claude · análisis semanal</span>
          </div>
          <p className="text-neutral-200 text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  )
}
