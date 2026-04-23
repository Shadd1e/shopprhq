'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { storeLogin } from '@/lib/api'
import { cn } from '@/lib/utils'

const INPUT = cn(
  'w-full px-3.5 py-2.5 rounded-[13px]',
  'bg-bg border-[1.5px] border-border',
  'text-sm font-sans text-ink placeholder:text-ink-4/50',
  'outline-none transition-all',
  'focus:border-wa focus:bg-white focus:ring-2 focus:ring-wa/10',
)

export default function StoreLoginPage() {
  const router = useRouter()
  const [clientId,  setClientId]  = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  // If already logged in, skip to dashboard
  useEffect(() => {
    if (sessionStorage.getItem('tok') && sessionStorage.getItem('cid')) {
      router.replace('/store-dashboard')
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!clientId.trim()) return setError('Enter your Store ID.')
    if (!password)         return setError('Enter your password.')

    setLoading(true)
    try {
      const data = await storeLogin(clientId.trim().toUpperCase(), password)
      sessionStorage.setItem('tok',   data.access_token)
      sessionStorage.setItem('cid',   data.client_id)
      sessionStorage.setItem('cname', data.store_name)
      sessionStorage.setItem('mid',   data.merchant_id)
      router.replace('/store-dashboard')
    } catch (err: any) {
      setError(err.detail ?? 'Invalid Store ID or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm py-8">

        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-lg p-9">
          <h1 className="font-display font-extrabold text-[1.45rem] tracking-tight text-ink mb-1.5">
            Store sign in
          </h1>
          <p className="text-sm text-ink-4 mb-7 leading-relaxed">
            Enter your Store ID and password to access your store.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider
                text-ink-3 mb-1.5">
                Store ID
              </label>
              <input
                type="text"
                placeholder="e.g. ST1001"
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setError('') }}
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                className={INPUT}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider
                text-ink-3 mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Your store password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)}
                className={INPUT}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3
                text-sm text-red-700 leading-snug">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-white font-semibold text-sm py-3.5 rounded-2xl
                hover:bg-ink-2 transition-all hover:-translate-y-0.5
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="mt-5 space-y-3 text-center">
          <p className="text-sm text-ink-4">
            Merchant?{' '}
            <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
              Go to merchant dashboard →
            </Link>
          </p>
          <p className="text-sm text-ink-4">
            Lost your Store ID?{' '}
            <a href="mailto:hello@shopprhq.com" className="text-wa-dark font-semibold hover:underline">
              hello@shopprhq.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
