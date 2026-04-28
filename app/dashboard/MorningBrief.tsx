'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Brief {
  date: string
  content: string
  created_at: string
}

function renderBrief(text: string) {
  // Split on **Heading** markers, keep them as section titles
  const parts = text.split(/\*\*([^*]+)\*\*/g).filter(Boolean)
  const sections: { title: string; body: string }[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const title = parts[i]?.trim()
    const body = parts[i + 1]?.trim() ?? ''
    if (title) sections.push({ title, body })
  }
  return sections
}

export default function MorningBrief({ userId }: { userId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('briefs')
      .select('date, content, created_at')
      .eq('user_id', userId)
      .eq('kind', 'morning')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBrief(data ?? null)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const r = await fetch('/api/morning-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Error generando brief')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return null

  const isToday = brief?.date === today
  const sections = brief ? renderBrief(brief.content) : []

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-neutral-400 uppercase tracking-widest">Morning Brief</p>
          {brief && (
            <p className="text-neutral-500 text-xs mt-0.5">
              {isToday ? 'Hoy' : `Último: ${brief.date}`}
            </p>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="text-xs px-3 py-2 bg-amber-500/20 text-amber-300 rounded-lg disabled:opacity-50"
        >
          {generating ? 'Generando…' : isToday ? 'Regenerar' : 'Generar hoy'}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}

      {!brief ? (
        <p className="text-neutral-500 text-sm">
          Aún no hay brief. Click <span className="text-amber-300">Generar hoy</span> para que Claude analice tus datos.
        </p>
      ) : (
        <div className="space-y-3">
          {sections.map(({ title, body }) => (
            <div key={title}>
              <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
              <p className="text-neutral-200 text-sm leading-relaxed whitespace-pre-line">{body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
