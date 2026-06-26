'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DoodleBackground from '@/components/DoodleBackground'
import { storeLogin, merchantLogin, forgotPassword, resetPassword } from '@/lib/api'
import { cn } from '@/lib/utils'

const INPUT = cn(
  'w-full px-4 py-3 rounded-xl',
  'bg-[#F7F6F2] border-[1.5px] border-[#E8E7E2]',
  'text-sm font-medium text-[#0D0D0C] placeholder:text-[#9E9E99]',
  'outline-none transition-all',
  'focus:border-[#25D366] focus:bg-white focus:ring-2 focus:ring-[#25D366]/10',
)

type Tab = 'store' | 'merchant'
type MerchantScreen = 'login' | 'forgot' | 'reset'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<Tab>(
    searchParams.get('as') === 'merchant' ? 'merchant' : 'store'
  )

  // ── Store form ────────────────────────────────────────────────────────────
  const [clientId,  setClientId]  = useState('')
  const [storePass,     setStorePass]     = useState('')
  const [showStorePass, setShowStorePass] = useState(false)

  // ── Merchant form ─────────────────────────────────────────────────────────
  const [merchantScreen, setMerchantScreen] = useState<MerchantScreen>(
    searchParams.get('forgot') === '1' ? 'forgot' : 'login'
  )
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Forgot
  const [fEmail,   setFEmail]   = useState('')
  // Reset
  const [fCode,    setFCode]    = useState('')
  const [fPw,      setFPw]      = useState('')
  const [fPwConf,  setFPwConf]  = useState('')

  // ── Shared ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { setError(''); setSuccess('') }, [tab, merchantScreen])

  // Redirect already-authenticated users
  useEffect(() => {
    const tok = sessionStorage.getItem('tok')
    const mid = sessionStorage.getItem('mid')
    const cid = sessionStorage.getItem('cid')
    if (tok && mid && !cid) router.replace('/dashboard')
    else if (tok && cid)    router.replace('/store-dashboard')
  }, [router])

  // ── Store submit ──────────────────────────────────────────────────────────
  async function handleStoreSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!clientId.trim()) return setError('Enter your Store ID.')
    if (!storePass)       return setError('Enter your password.')
    setLoading(true)
    try {
      const data = await storeLogin(clientId.trim().toUpperCase(), storePass)
      sessionStorage.setItem('tok',   data.access_token)
      sessionStorage.setItem('cid',   data.client_id)
      sessionStorage.setItem('cname', data.store_name)
      sessionStorage.setItem('mid',   data.merchant_id)
      router.replace('/store-dashboard')
    } catch (err: any) {
      setError(err.detail ?? 'Incorrect Store ID or password. Try again.')
    } finally { setLoading(false) }
  }

  // ── Merchant login ────────────────────────────────────────────────────────
  async function handleMerchantLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Enter your email address.')
    if (!password)     return setError('Enter your password.')
    setLoading(true)
    try {
      const data = await merchantLogin(email.trim().toLowerCase(), password)

      // Admin-created account — force password change before entering dashboard
      if (data.must_change_password) {
        setFEmail(email.trim().toLowerCase())
        try { await forgotPassword(email.trim().toLowerCase()) } catch {}
        setSuccess('For your security, please set a personal password before continuing.')
        setMerchantScreen('reset')
        return
      }

      sessionStorage.setItem('tok',    data.access_token)
      sessionStorage.setItem('mid',    data.merchant_id)
      sessionStorage.setItem('mname',  data.name)
      sessionStorage.setItem('memail', data.email)
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err.detail ?? 'Incorrect email or password. Try again.')
    } finally { setLoading(false) }
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fEmail.trim() || !fEmail.includes('@')) return setError('Enter a valid email address.')
    setLoading(true)
    try {
      await forgotPassword(fEmail.trim().toLowerCase())
      setSuccess('Check your email — a 6-digit reset code has been sent.')
      setMerchantScreen('reset')
    } catch (err: any) {
      setError(err.detail ?? 'Could not send reset code. Try again.')
    } finally { setLoading(false) }
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fCode.trim() || fCode.length !== 6) return setError('Enter the 6-digit code from your email.')
    if (fPw.length < 6) return setError('New password must be at least 6 characters.')
    if (fPw !== fPwConf) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await resetPassword(fEmail.trim().toLowerCase(), fCode.trim(), fPw)
      setFCode(''); setFPw(''); setFPwConf('')
      setMerchantScreen('login')
      setSuccess('Password updated — sign in with your new password.')
    } catch (err: any) {
      setError(err.detail ?? 'Could not reset password. Check the code and try again.')
    } finally { setLoading(false) }
  }

  async function handleResendCode() {
    try { await forgotPassword(fEmail.trim().toLowerCase()) } catch {}
    setSuccess('Code resent — check your email.')
  }

  // ── UI ────────────────────────────────────────────────────────────────────
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
          <p className="text-xs text-[#9E9E99] mt-1 font-mono">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-[#E8E7E2] shadow-md p-8">

          {/* Tab switcher — only show on login screen */}
          {merchantScreen === 'login' && (
            <div className="flex bg-[#F7F6F2] rounded-2xl p-1 mb-7 gap-1">
              <button
                type="button"
                onClick={() => setTab('store')}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                  tab === 'store'
                    ? 'bg-white text-[#0D0D0C] shadow-sm'
                    : 'text-[#9E9E99] hover:text-[#6B6B66]',
                )}
              >
                Store login
              </button>
              <button
                type="button"
                onClick={() => setTab('merchant')}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                  tab === 'merchant'
                    ? 'bg-white text-[#0D0D0C] shadow-sm'
                    : 'text-[#9E9E99] hover:text-[#6B6B66]',
                )}
              >
                Merchant login
              </button>
            </div>
          )}

          {/* ── Store tab ── */}
          {tab === 'store' && (
            <>
              <h1 className="font-display font-extrabold text-[1.4rem] tracking-tight text-[#0D0D0C] mb-1.5">
                Sign in to your store
              </h1>
              <p className="text-sm text-[#9E9E99] mb-7 leading-relaxed">
                Your Store ID was provided by your merchant when your account was set up.
              </p>

              <form onSubmit={handleStoreSubmit} className="space-y-4" noValidate>
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
                  <div className="relative">
                    <input
                      type={showStorePass ? 'text' : 'password'}
                      placeholder="Your store password"
                      value={storePass}
                      onChange={(e) => { setStorePass(e.target.value); setError('') }}
                      autoComplete="current-password"
                      className={cn(INPUT, 'pr-11')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStorePass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E99] hover:text-[#0D0D0C] transition-colors"
                      aria-label={showStorePass ? 'Hide password' : 'Show password'}
                    >
                      {showStorePass ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && <ErrorBanner message={error} />}

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
            </>
          )}

          {/* ── Merchant tab ── */}
          {tab === 'merchant' && (
            <>
              {/* ── Login screen ── */}
              {merchantScreen === 'login' && (
                <>
                  <h1 className="font-display font-extrabold text-[1.4rem] tracking-tight text-[#0D0D0C] mb-1.5">
                    Merchant sign in
                  </h1>
                  <p className="text-sm text-[#9E9E99] mb-7 leading-relaxed">
                    Sign in to manage your stores, inventory and orders.
                  </p>

                  {success && <SuccessBanner message={success} />}

                  <form onSubmit={handleMerchantLogin} className="space-y-4" noValidate>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
                        Email address
                      </label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError('') }}
                        autoComplete="email"
                        spellCheck={false}
                        className={INPUT}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66]">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => { setFEmail(email); setMerchantScreen('forgot'); setError('') }}
                          className="text-[11px] font-semibold text-[#25D366] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Your password"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError('') }}
                          autoComplete="current-password"
                          className={cn(INPUT, 'pr-11')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E99] hover:text-[#0D0D0C] transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#0D0D0C] text-white font-semibold text-sm py-3.5 rounded-2xl
                        hover:bg-[#2C2C29] transition-all hover:-translate-y-0.5
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-2"
                    >
                      {loading ? 'Signing in…' : 'Sign in'}
                    </button>

                    <p className="text-center text-xs text-[#9E9E99] pt-1">
                      Don't have an account?{' '}
                      <a href="/get-started" className="text-[#25D366] font-semibold hover:underline">
                        Apply to join
                      </a>
                    </p>
                  </form>
                </>
              )}

              {/* ── Forgot screen ── */}
              {merchantScreen === 'forgot' && (
                <>
                  <button
                    type="button"
                    onClick={() => setMerchantScreen('login')}
                    className="text-xs font-semibold text-[#6B6B66] hover:text-[#0D0D0C] mb-6 flex items-center gap-1"
                  >
                    ← Back to sign in
                  </button>

                  <h1 className="font-display font-extrabold text-[1.3rem] tracking-tight text-[#0D0D0C] mb-1.5">
                    Reset your password
                  </h1>
                  <p className="text-sm text-[#9E9E99] mb-7 leading-relaxed">
                    Enter the email on your merchant account and we'll send a 6-digit code.
                  </p>

                  <form onSubmit={handleForgotSend} className="space-y-4" noValidate>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
                        Email address
                      </label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={fEmail}
                        onChange={(e) => { setFEmail(e.target.value); setError('') }}
                        autoComplete="email"
                        autoFocus
                        className={INPUT}
                      />
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#0D0D0C] text-white font-semibold text-sm py-3.5 rounded-2xl
                        hover:bg-[#2C2C29] transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {loading ? 'Sending…' : 'Send reset code'}
                    </button>
                  </form>
                </>
              )}

              {/* ── Reset screen ── */}
              {merchantScreen === 'reset' && (
                <>
                  <button
                    type="button"
                    onClick={() => setMerchantScreen('forgot')}
                    className="text-xs font-semibold text-[#6B6B66] hover:text-[#0D0D0C] mb-6 flex items-center gap-1"
                  >
                    ← Back
                  </button>

                  <h1 className="font-display font-extrabold text-[1.3rem] tracking-tight text-[#0D0D0C] mb-1.5">
                    Enter your code
                  </h1>

                  {success && <SuccessBanner message={success} />}

                  <p className="text-sm text-[#9E9E99] mb-7 leading-relaxed">
                    Check <strong className="text-[#0D0D0C]">{fEmail}</strong> for the 6-digit code,
                    then set your new password below.
                  </p>

                  <form onSubmit={handleReset} className="space-y-4" noValidate>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
                        6-digit code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={fCode}
                        onChange={(e) => { setFCode(e.target.value.replace(/\D/g, '')); setError('') }}
                        autoComplete="one-time-code"
                        autoFocus
                        className={cn(INPUT, 'font-mono tracking-widest text-center text-lg')}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
                        New password
                      </label>
                      <input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={fPw}
                        onChange={(e) => { setFPw(e.target.value); setError('') }}
                        autoComplete="new-password"
                        className={INPUT}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B66] mb-1.5">
                        Confirm new password
                      </label>
                      <input
                        type="password"
                        placeholder="Repeat password"
                        value={fPwConf}
                        onChange={(e) => { setFPwConf(e.target.value); setError('') }}
                        autoComplete="new-password"
                        className={INPUT}
                      />
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#0D0D0C] text-white font-semibold text-sm py-3.5 rounded-2xl
                        hover:bg-[#2C2C29] transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {loading ? 'Updating…' : 'Set new password'}
                    </button>

                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="w-full text-xs text-[#9E9E99] hover:text-[#0D0D0C] text-center py-1 transition-colors"
                    >
                      Didn't receive it? Resend code
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        {/* Help footer */}
        <div className="mt-6 bg-[#F7F6F2] border border-[#E8E7E2] rounded-2xl px-5 py-4">
          {tab === 'store' ? (
            <>
              <p className="text-xs font-semibold text-[#0D0D0C] mb-1">Can't sign in?</p>
              <p className="text-xs text-[#6B6B66] leading-relaxed">
                Contact the merchant who set up your account. They can reset your password or retrieve
                your Store ID from their dashboard.
              </p>
              <p className="text-xs text-[#9E9E99] mt-2">
                ShopprHQ support:{' '}
                <a href="mailto:hello@shopprhq.com" className="text-[#25D366] font-semibold hover:underline">
                  hello@shopprhq.com
                </a>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-[#0D0D0C] mb-1">Are you a store operator?</p>
              <p className="text-xs text-[#6B6B66] leading-relaxed">
                Use the{' '}
                <button
                  onClick={() => { setTab('store'); setMerchantScreen('login') }}
                  className="text-[#25D366] font-semibold hover:underline"
                >
                  Store login
                </button>{' '}
                tab instead — your Store ID starts with{' '}
                <span className="font-mono font-semibold">ST</span>.
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 leading-snug">
      {message}
    </div>
  )
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 leading-snug mb-5">
      {message}
    </div>
  )
}

export default function StoreLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
