'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import FastingTimer from './FastingTimer'
import RainbowTracker from './RainbowTracker'
import WhoopLogger from './WhoopLogger'
import WhoopConnect from './WhoopConnect'
import MorningBrief from './MorningBrief'
import AppleHealthCard from './AppleHealthCard'
import DailyNote from './DailyNote'
import HistoryView from './HistoryView'
import ReadinessScore from './ReadinessScore'
import ProtocolScore from './ProtocolScore'

type Tab = 'hoy' | 'historia'

function getTodayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHeaderDate(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'short',
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col max-w-2xl mx-auto">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-7 pb-3">
        <div>
          <h1 className="font-bold text-neutral-100 text-lg tracking-tight">Protocolo</h1>
          <p className="text-neutral-500 text-xs capitalize mt-0.5">{formatHeaderDate()}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/import"
            className="text-neutral-600 hover:text-neutral-300 text-xs transition-colors px-3 py-2 min-h-[44px] flex items-center"
          >
            Importar
          </Link>
          <button
            onClick={handleLogout}
            className="text-neutral-600 hover:text-neutral-300 text-xs transition-colors px-3 py-2 min-h-[44px] flex items-center"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex px-4 gap-1 mb-1">
        {(['hoy', 'historia'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all duration-200 ${
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
          <div className="p-4 space-y-3 pb-16">
            {/* Readiness — hero widget, only shows when WHOOP data exists */}
            <ReadinessScore userId={userId} date={today} />

            <WhoopConnect userId={userId} />
            <AppleHealthCard userId={userId} date={today} />

            {/* Row: Fasting + Rainbow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FastingTimer userId={userId} />
              <RainbowTracker userId={userId} date={today} />
            </div>

            {/* Row: WHOOP + Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WhoopLogger userId={userId} date={today} />
              <DailyNote userId={userId} date={today} />
            </div>

            <MorningBrief userId={userId} />

            {/* Protocol score — gamified daily completion */}
            <ProtocolScore userId={userId} date={today} />
          </div>
        ) : (
          <HistoryView userId={userId} />
        )}
      </main>
    </div>
  )
}
