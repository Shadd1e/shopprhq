'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DoodleBackground from '@/components/DoodleBackground'
import { storeLogin } from '@/lib/api'
import { cn } from '@/lib/utils'

const INPUT = cn(
  'w-full px-4 py-3 rounded-xl',
  'bg-[#F7F6F2] border-[1.5px] border-[#E8E7E2]',
  'text-sm font-medium text-[#0D0D0C] placeholder:text-[#9E9E99]',
  'outline-none transition-all',
  'focus:border-[#25D366] focus:bg-white focus:ring-2 focus:ring-[#25D366]/10',
)

export default function StoreLoginPage() {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (sessionStorage.getItem('tok') && sessionStorage.getItem('cid')) {
      router.replace('/store-dashboard')
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!clientId.trim()) return setError('Enter your Store ID.')
    if (!password)        return setError('Enter your password.')

    setLoading(true)
    try {
      const data = await storeLogin(clientId.trim().toUpperCase(), password)
      sessionStorage.setItem('tok',   data.access_token)
      sessionStorage.setItem('cid',   data.client_id)
      sessionStorage.setItem('cname', data.store_name)
      sessionStorage.setItem('mid',   data.merchant_id)
      router.replace('/store-dashboard')
    } catch (err: any) {
      setError(err.detail ?? 'Incorrect Store ID or password. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-5">
      <DoodleBackground />

      <div className="w-full max-w-sm relative z-10">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0D0D0C] mb-4">
            <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Zm4.406 13.688c-.24-.12-1.43-.703-1.652-.782-.222-.078-.383-.117-.543.118-.16.234-.62.781-.762.94-.14.16-.28.18-.523.06-.24-.12-1.02-.374-1.94-1.195-.718-.638-1.203-1.426-1.344-1.668-.14-.242-.015-.373.106-.493.109-.109.242-.285.363-.426.12-.14.16-.242.242-.403.08-.16.04-.3-.02-.42-.06-.12-.543-1.31-.743-1.793-.196-.473-.396-.41-.543-.417-.14-.007-.3-.009-.46-.009-.16 0-.42.06-.64.3-.22.241-.842.824-.842 2.01 0 1.185.862 2.33.983 2.49.12.16 1.697 2.592 4.113 3.635.575.25 1.024.398 1.373.508.577.184 1.1.158 1.515.096.462-.069 1.43-.584 1.63-1.15.202-.563.202-1.047.141-1.147-.06-.1-.221-.16-.461-.28Z"/>
            </svg>
          </div>
          <p className="font-display font-extrabold text-[#0D0D0C] text-xl tracking-tight">ShopprHQ</p>
          <p className="text-xs text-[#9E9E99] mt-1 font-mono">Store portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-[#E8E7E2] shadow-md p-8">
          <h1 className="font-display font-extrabold text-[1.4rem] tracking-tight text-[#0D0D0C] mb-1.5">
            Sign in to your store
          </h1>
          <p className="text-sm text-[#9E9E99] mb-7 leading-relaxed">
            Your Store ID was provided by your merchant when your account was set up.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
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
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
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
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 leading-snug">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0D0D0C] text-white font-semibold text-sm py-3.5 rounded-2xl
                hover:bg-[#2C2C29] transition-all hover:-translate-y-0.5
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Help */}
        <div className="mt-6 bg-[#F7F6F2] border border-[#E8E7E2] rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-[#0D0D0C] mb-1">Can't sign in?</p>
          <p className="text-xs text-[#6B6B66] leading-relaxed">
            Contact the merchant who set up your account. They can reset your password or retrieve your Store ID from their dashboard.
          </p>
          <p className="text-xs text-[#9E9E99] mt-2">
            ShopprHQ support:{' '}
            <a href="mailto:hello@shopprhq.com" className="text-[#25D366] font-semibold hover:underline">
              hello@shopprhq.com
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
