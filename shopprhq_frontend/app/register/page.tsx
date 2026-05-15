'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { registerMerchant, merchantLogin, verifyEmailCode, resendVerification } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.slice(0, 2)
  const masked  = '*'.repeat(Math.min(local.length - 2, 5))
  return `${visible}${masked}@${domain}`
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full px-3.5 py-2.5 rounded-[13px]',
    'bg-bg border-[1.5px]',
    'text-sm font-sans text-ink placeholder:text-ink-4/50',
    'outline-none transition-all',
    hasError
      ? 'border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-2 focus:ring-red-200/50'
      : 'border-border focus:border-wa focus:bg-white focus:ring-2 focus:ring-wa/10',
  )
}

function Field({
  label, hint, error, children,
}: {
  label: React.ReactNode; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-500 leading-relaxed flex items-center gap-1">
          <span>↑</span> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-4 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ stage }: { stage: 1 | 2 | 3 }) {
  const steps = ['Create account', 'Verify email', 'Activate number']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n        = i + 1
        const done     = n < stage
        const active   = n === stage
        const upcoming = n > stage
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                done    ? 'bg-wa text-white'
                  : active  ? 'bg-ink text-white ring-4 ring-ink/10'
                  : 'bg-bg border-2 border-border text-ink-4',
              )}>
                {done ? '✓' : n}
              </div>
              <span className={cn(
                'text-[10px] font-semibold whitespace-nowrap',
                active ? 'text-ink' : 'text-ink-4',
              )}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-[2px] mb-4 mx-1 rounded transition-all',
                done ? 'bg-wa' : 'bg-border',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Stage 1: Registration form ────────────────────────────────────────────

type FieldErrors = Partial<Record<'name' | 'email' | 'pin' | 'pin2', string>>

function StageRegister({ onSuccess }: {
  onSuccess: (email: string, pin: string, name: string, mid: string) => void
}) {
  const [form,        setForm]        = useState({ name: '', email: '', pin: '', pin2: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading,     setLoading]     = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(p => ({ ...p, [field]: e.target.value }))
      setFieldErrors(p => ({ ...p, [field]: undefined }))
      setServerError('')
    }
  }

  function validate(): FieldErrors {
    const { name, email, pin, pin2 } = form
    const errs: FieldErrors = {}
    if (!name.trim())                   errs.name  = 'Enter your business name.'
    if (!email || !email.includes('@')) errs.email = 'Enter a valid email address.'
    if (!/^\d{6,}$/.test(pin))         errs.pin   = 'PIN must be at least 6 digits.'
    if (pin !== pin2)                   errs.pin2  = 'PINs do not match.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    const { name, email, pin } = form
    setLoading(true)
    try {
      const data = await registerMerchant({ name, email, password: pin, whatsapp_number: null })
      onSuccess(email, pin, name, data.id)
    } catch (err: any) {
      const detail = err.detail
      if (Array.isArray(detail)) {
        const mapped: FieldErrors = {}
        for (const d of detail) {
          const loc = d.loc?.[1] as string | undefined
          if (loc === 'password') mapped.pin = d.msg
          else if (loc === 'email') mapped.email = d.msg
          else if (loc === 'name') mapped.name = d.msg
        }
        if (Object.keys(mapped).length) { setFieldErrors(mapped); return }
      }
      setServerError(typeof detail === 'string' ? detail : 'Registration failed — please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-3xl border border-border shadow-lg p-9">
      <h1 className="font-display font-extrabold text-[1.45rem] tracking-tight text-ink mb-1.5">
        Create your store
      </h1>
      <p className="text-sm text-ink-4 mb-7 leading-relaxed">
        Open your WhatsApp store in minutes. No technical setup needed.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Business Name" error={fieldErrors.name}>
          <input type="text" placeholder="e.g. Altekflo Enterprises"
            value={form.name} onChange={set('name')}
            autoComplete="organization" className={inputClass(!!fieldErrors.name)} />
        </Field>
        <Field label="Email Address"
          hint="Your verification code and Merchant ID will be sent here."
          error={fieldErrors.email}>
          <input type="email" placeholder="you@example.com"
            value={form.email} onChange={set('email')}
            autoComplete="email" className={inputClass(!!fieldErrors.email)} />
        </Field>
        <Field label="PIN (min. 6 digits)"
          hint="This is your login PIN — keep it memorable."
          error={fieldErrors.pin}>
          <input type="password" placeholder="••••••" maxLength={10} inputMode="numeric"
            value={form.pin} onChange={set('pin')}
            autoComplete="new-password" className={inputClass(!!fieldErrors.pin)} />
        </Field>
        <Field label="Confirm PIN" error={fieldErrors.pin2}>
          <input type="password" placeholder="••••••" maxLength={10} inputMode="numeric"
            value={form.pin2} onChange={set('pin2')}
            autoComplete="new-password" className={inputClass(!!fieldErrors.pin2)} />
        </Field>
        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full bg-wa text-white font-semibold text-sm py-3.5 rounded-2xl
            shadow-wa hover:bg-wa-dark transition-all hover:-translate-y-0.5
            disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
      </form>
    </div>
  )
}

// ── Stage 2: Email verification ───────────────────────────────────────────

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60
const MAX_RESENDS = 3

function OtpBoxes({ value, onChange, error, disabled }: {
  value: string
  onChange: (v: string) => void
  error: boolean
  disabled: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus()
      onChange(value.slice(0, i - 1))
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    if (!digit) return
    const next = value.slice(0, i) + digit + value.slice(i + 1)
    onChange(next)
    if (i < CODE_LENGTH - 1) refs.current[i + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (pasted) {
      onChange(pasted.padEnd(CODE_LENGTH, '').slice(0, CODE_LENGTH))
      refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
    }
  }

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onFocus={e => e.target.select()}
          disabled={disabled}
          className={cn(
            'w-12 h-14 rounded-2xl border-[2px] text-center text-xl font-bold font-mono',
            'outline-none transition-all',
            disabled ? 'opacity-50 cursor-not-allowed bg-bg' : 'bg-white',
            value[i]
              ? error
                ? 'border-red-400 bg-red-50 text-red-700'
                : 'border-wa bg-wa/5 text-ink'
              : error
                ? 'border-red-300'
                : 'border-border focus:border-wa focus:ring-2 focus:ring-wa/10',
          )}
        />
      ))}
    </div>
  )
}

function StageVerify({ email, token, mid, storeName, onSuccess, onWrongEmail }: {
  email: string
  token: string
  mid: string
  storeName: string
  onSuccess: () => void
  onWrongEmail: () => void
}) {
  const [code,        setCode]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [resendCount, setResendCount] = useState(0)
  const [cooldown,    setCooldown]    = useState(0)
  const [resending,   setResending]   = useState(false)
  const [resendMsg,   setResendMsg]   = useState('')

  // Start cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === CODE_LENGTH) handleVerify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function handleVerify() {
    if (code.length !== CODE_LENGTH) return
    setLoading(true); setError('')
    try {
      await verifyEmailCode(token, code)
      onSuccess()
    } catch (err: any) {
      setError(err.detail ?? 'Incorrect code. Please try again.')
      setCode('')
    } finally { setLoading(false) }
  }

  async function handleResend() {
    if (cooldown > 0 || resendCount >= MAX_RESENDS) return
    setResending(true); setResendMsg(''); setError('')
    try {
      await resendVerification(token)
      setResendCount(c => c + 1)
      setCooldown(RESEND_COOLDOWN)
      setResendMsg('Code resent — check your inbox.')
      setCode('')
    } catch (err: any) {
      setResendMsg(err.detail ?? 'Could not resend. Try again.')
    } finally { setResending(false) }
  }

  return (
    <div className="bg-white rounded-3xl border border-border shadow-lg overflow-hidden">

      {/* Top banner */}
      <div className="bg-gradient-to-br from-wa/10 to-transparent px-9 pt-9 pb-7 text-center border-b border-border">
        <div className="w-16 h-16 rounded-2xl bg-white border border-border shadow-sm
          flex items-center justify-center mx-auto mb-5 text-3xl">
          ✉️
        </div>
        <h2 className="font-display font-extrabold text-xl tracking-tight text-ink mb-2">
          Check your email
        </h2>
        <p className="text-sm text-ink-4 leading-relaxed mb-3">
          We sent a 6-digit code to
        </p>
        <div className="inline-flex items-center gap-2 bg-white border border-border
          rounded-2xl px-5 py-2.5 shadow-sm">
          <span className="text-xs text-ink-4">📧</span>
          <span className="font-mono text-sm font-bold text-ink tracking-wide">
            {maskEmail(email)}
          </span>
        </div>
      </div>

      <div className="px-9 py-7 space-y-6">

        {/* Merchant ID chip */}
        <div className="bg-bg border border-border rounded-2xl py-4 px-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-4 mb-2">
            Your Merchant ID — save this somewhere safe
          </p>
          <p className="font-display font-extrabold text-3xl tracking-widest text-ink">
            {mid}
          </p>
        </div>

        {/* Code instruction */}
        <p className="text-center text-xs text-ink-4 leading-relaxed">
          Enter the 6-digit code from your email below.
          The code expires in 15 minutes.
        </p>

        {/* Code boxes */}
        <div className="space-y-4">
          <OtpBoxes
            value={code}
            onChange={v => { setCode(v); setError('') }}
            error={!!error}
            disabled={loading}
          />

          {error && (
            <p className="text-center text-sm text-red-600 font-semibold bg-red-50
              border border-red-200 rounded-xl py-2.5 px-4">
              {error}
            </p>
          )}
        </div>

        {/* Resend */}
        <div className="text-center space-y-2 pt-1">
          {resendMsg && (
            <p className="text-xs text-emerald-700 font-semibold bg-emerald-50
              border border-emerald-200 rounded-xl py-2 px-4 inline-block">
              {resendMsg}
            </p>
          )}
          {resendCount >= MAX_RESENDS ? (
            <p className="text-xs text-ink-4">
              Too many resend attempts.{' '}
              <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
                Sign in
              </Link>{' '}
              to request another.
            </p>
          ) : cooldown > 0 ? (
            <p className="text-xs text-ink-4">
              Resend available in <strong className="text-ink">{cooldown}s</strong>
            </p>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending}
              className="text-sm font-semibold text-wa-dark hover:underline disabled:opacity-50
                flex items-center gap-1.5 mx-auto">
              <span>↺</span>
              {resending ? 'Resending…' : "Didn't get it? Resend code"}
            </button>
          )}
          <p className="text-xs text-ink-4/60">
            Check your spam folder if you don't see it.
          </p>
        </div>

        {/* Wrong email */}
        <div className="text-center border-t border-border pt-4">
          <button type="button" onClick={onWrongEmail}
            className="text-xs text-ink-4 hover:text-ink transition-colors
              flex items-center gap-1.5 mx-auto">
            <span>←</span> Wrong email? Start over
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Stage 3: Verified success ─────────────────────────────────────────────

function StageVerified({ storeName }: { storeName: string }) {
  const router = useRouter()

  useEffect(() => {
    const id = setTimeout(() => router.push('/onboarding'), 2200)
    return () => clearTimeout(id)
  }, [router])

  return (
    <div className="bg-white rounded-3xl border border-border shadow-lg p-10 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-wa/20 to-wa/5
        flex items-center justify-center mx-auto mb-6 text-3xl
        animate-[ping_0.4s_ease-out_forwards]">
        ✅
      </div>
      <h2 className="font-display font-extrabold text-xl tracking-tight text-ink mb-2">
        Email verified!
      </h2>
      <p className="text-sm text-ink-4 leading-relaxed">
        Welcome, {storeName}. Taking you to activate your ShopprHQ number…
      </p>
      <div className="mt-5 flex justify-center">
        <div className="w-6 h-6 border-2 border-wa border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

type Stage = 1 | 2 | 3

export default function RegisterPage() {
  const [stage,     setStage]     = useState<Stage>(1)
  const [email,     setEmail]     = useState('')
  const [pin,       setPin]       = useState('')
  const [storeName, setStoreName] = useState('')
  const [mid,       setMid]       = useState('')
  const [token,     setToken]     = useState('')

  async function handleRegistered(
    regEmail: string,
    regPin: string,
    regName: string,
    regMid: string,
  ) {
    setEmail(regEmail)
    setPin(regPin)
    setStoreName(regName)
    setMid(regMid)

    // Auto-login to get a token so verifyEmailCode can be called
    try {
      const data = await merchantLogin(regEmail, regPin)
      setToken(data.access_token)
      sessionStorage.setItem('m_tok',  data.access_token)
      sessionStorage.setItem('m_id',   data.merchant_id)
      sessionStorage.setItem('m_name', data.name)
    } catch {
      // Login failed — still advance, user can verify from dashboard
    }

    setStage(2)
  }

  function handleVerified() {
    setStage(3)
  }

  function handleWrongEmail() {
    setStage(1)
    setEmail('')
    setPin('')
    setMid('')
    setToken('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-bg">
      <div className="w-full max-w-[26rem] py-8">

        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        <ProgressBar stage={stage} />

        <div className={cn('transition-all duration-300', stage === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none absolute')}>
          {stage === 1 && (
            <StageRegister onSuccess={handleRegistered} />
          )}
        </div>

        {stage === 2 && (
          <StageVerify
            email={email}
            token={token}
            mid={mid}
            storeName={storeName}
            onSuccess={handleVerified}
            onWrongEmail={handleWrongEmail}
          />
        )}

        {stage === 3 && <StageVerified storeName={storeName} />}

        {stage === 1 && (
          <p className="text-center mt-5 text-sm text-ink-4">
            Already have an account?{' '}
            <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
              Sign in →
            </Link>
          </p>
        )}

      </div>
    </div>
  )
}
