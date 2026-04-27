'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function WhoopConnect({ userId }: { userId: string }) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('whoop_tokens').select('user_id').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setConnected(!!data))

    const params = new URLSearchParams(window.location.search)
    const w = params.get('whoop')
    if (w === 'connected') setMsg('Whoop conectado ✓')
    else if (w === 'error') setMsg('Error conectando Whoop')
    else if (w === 'state_error') setMsg('Sesión OAuth expirada — reintenta')
  }, [supabase, userId])

  async function syncNow() {
    setSyncing(true)
    setMsg(null)
    try {
      const r = await fetch('/api/whoop/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const j = await r.json()
      setMsg(r.ok ? `Sync ✓ (${j.synced} días)` : `Error: ${j.error}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSyncing(false)
    }
  }

  if (connected === null) return null

  return (
    <div className="bg-neutral-800 rounded-xl p-3 flex items-center justify-between">
      <div>
        <p className="text-neutral-200 text-sm font-medium">Whoop</p>
        <p className="text-neutral-500 text-xs">{msg ?? (connected ? 'Conectado' : 'No conectado')}</p>
      </div>
      {connected ? (
        <button
          onClick={syncNow}
          disabled={syncing}
          className="text-xs px-3 py-2 bg-amber-500/20 text-amber-300 rounded-lg disabled:opacity-50"
        >
          {syncing ? 'Sync…' : 'Sync ahora'}
        </button>
      ) : (
        <a
          href="/api/whoop/auth"
          className="text-xs px-3 py-2 bg-amber-500 text-neutral-900 rounded-lg font-medium"
        >
          Conectar
        </a>
      )}
    </div>
  )
}
