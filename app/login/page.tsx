'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <span className="text-amber-400 text-xl">⬡</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-100">Protocolo</h1>
          <p className="text-neutral-500 text-sm mt-1">Dashboard personal · Edu</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-semibold rounded-xl py-3 text-sm transition-colors mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-neutral-600 text-xs text-center mt-8">
          Acceso personal · No hay registro público
        </p>
      </div>
    </div>
  )
}
