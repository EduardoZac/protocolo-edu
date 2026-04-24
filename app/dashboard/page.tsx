'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import FastingTimer from './FastingTimer'
import RainbowTracker from './RainbowTracker'
import WhoopLogger from './WhoopLogger'
import DailyNote from './DailyNote'
import HistoryView from './HistoryView'

type Tab = 'hoy' | 'historia'

function getTodayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHeaderDate(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const today = getTodayLocal()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
    })
  }, [supabase, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col max-w-2xl mx-auto">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div>
          <h1 className="font-semibold text-neutral-100 text-base">Protocolo</h1>
          <p className="text-neutral-500 text-xs capitalize">{formatHeaderDate()}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors px-2 py-1"
        >
          Salir
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex px-4 gap-1 mb-1">
        {(['hoy', 'historia'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
              tab === t
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-600 hover:text-neutral-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'hoy' ? (
          <div className="p-4 space-y-3 pb-10">
            {/* Row 1: Fasting + Rainbow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FastingTimer userId={userId} />
              <RainbowTracker userId={userId} date={today} />
            </div>
            {/* Row 2: WHOOP + Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WhoopLogger userId={userId} date={today} />
              <DailyNote userId={userId} date={today} />
            </div>
          </div>
        ) : (
          <HistoryView userId={userId} />
        )}
      </main>
    </div>
  )
}
