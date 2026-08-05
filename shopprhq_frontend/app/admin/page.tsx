'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { BASE, INPUT, BTN, StoreList, ApplicationsList } from './_shared'

// ══════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════

function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${BASE}/verify-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.ok) { setError('Incorrect password.'); return }
      sessionStorage.setItem('_adm_tok', data.token)
      onSuccess(data.token)
    } catch {
      setError('Could not reach server.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-9">
          <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-white text-lg">🔐</span>
          </div>
          <h1 className="font-bold text-xl text-gray-900 mb-1 tracking-tight">ShopprHQ Admin</h1>
          <p className="text-sm text-gray-500 mb-7">WhatsApp onboarding panel</p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoFocus
              className={INPUT}
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading || !password}
              className={cn(BTN, 'w-full bg-gray-900 text-white hover:bg-gray-700 py-3')}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [token,   setToken]   = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [tab,     setTab]     = useState<'stores' | 'applications'>('applications')

  useEffect(() => {
    const t = sessionStorage.getItem('_adm_tok')
    setToken(t)
    setChecked(true)
  }, [])

  if (!checked) return null

  if (!token) {
    return <AdminLogin onSuccess={t => { sessionStorage.setItem('_adm_tok', t); setToken(t) }} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs">S</span>
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">ShopprHQ Admin</span>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('_adm_tok'); setToken(null) }}
            className="text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-5 flex gap-1 pb-2">
          {([
            { id: 'applications', label: 'Applications' },
            { id: 'stores',       label: 'WhatsApp Onboarding' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8">
        {tab === 'applications' ? <ApplicationsList token={token} /> : <StoreList token={token} />}
      </main>
    </div>
  )
}
