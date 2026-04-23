'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { registerMerchant } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Shared input style ─────────────────────────────────────────────────────

const INPUT = cn(
  'w-full px-3.5 py-2.5 rounded-[13px]',
  'bg-bg border-[1.5px] border-border',
  'text-sm font-sans text-ink placeholder:text-ink-4/50',
  'outline-none transition-all',
  'focus:border-wa focus:bg-white focus:ring-2 focus:ring-wa/10',
)

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs text-ink-4 leading-relaxed">{hint}</p>
      )}
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 leading-snug">
      {msg}
    </div>
  )
}

// ── Success state ──────────────────────────────────────────────────────────

function SuccessCard({ mid, email }: { mid: string; email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md py-8">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-lg p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-100 to-green-200
            flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm">
            ✉️
          </div>

          <h2 className="font-display font-extrabold text-2xl tracking-tight text-ink mb-2">
            Check your email
          </h2>
          <p className="text-sm text-ink-3 leading-relaxed mb-6">
            We sent a 6-digit verification code to<br />
            <strong className="text-ink">{email}</strong>
          </p>

          {/* Merchant ID chip */}
          <div className="bg-bg border border-border rounded-2xl py-4 px-8 inline-block
            font-display font-extrabold text-3xl tracking-widest text-ink mb-3">
            {mid}
          </div>
          <p className="text-xs text-ink-4 mb-6 leading-relaxed">
            This is your <strong>Merchant ID</strong> — save it somewhere safe.
            You'll need it every time you sign in.
          </p>

          <p className="text-xs text-ink-3 mb-8 leading-relaxed">
            Verify your email from the dashboard, then{' '}
            <strong>add your products</strong> while you wait. Once you set
            your operator number, your onboarding specialist will activate
            your WhatsApp store.
          </p>

          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-wa text-white font-semibold
              text-sm py-3.5 px-6 rounded-2xl shadow-wa hover:bg-wa-dark
              transition-all hover:-translate-y-0.5"
          >
            Go to dashboard →
          </Link>

          <p className="mt-5 text-xs text-ink-4">
            Didn't get the code?{' '}
            <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
              Sign in
            </Link>{' '}
            and click <em>Resend code</em>.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [form, setForm] = useState({
    name:  '',
    email: '',
    pin:   '',
    pin2:  '',
    wa:    '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState<{ mid: string; email: string } | null>(null)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((p) => ({ ...p, [field]: e.target.value }))
      setError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { name, email, pin, pin2, wa } = form
    const waClean = wa.replace(/^\+/, '').replace(/\s+/g, '') || null

    if (!name)                             return setError('Enter your business name.')
    if (!email || !email.includes('@'))    return setError('Enter a valid email address.')
    if (!/^\d{4}$/.test(pin))             return setError('PIN must be exactly 4 digits.')
    if (pin !== pin2)                      return setError('PINs do not match.')
    if (waClean && !/^\d{7,15}$/.test(waClean))
      return setError('WhatsApp number must be 7–15 digits, no spaces or + sign.')

    setLoading(true)
    try {
      const data = await registerMerchant({
        name,
        email,
        password: pin,
        whatsapp_number: waClean,
      })
      setSuccess({ mid: data.id, email })
    } catch (err: any) {
      setError(err.detail ?? 'Registration failed — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return <SuccessCard {...success} />

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-[26rem] py-8">

        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-lg p-9">
          <h1 className="font-display font-extrabold text-[1.45rem] tracking-tight text-ink mb-1.5">
            Create your store
          </h1>
          <p className="text-sm text-ink-4 mb-7 leading-relaxed">
            Open your WhatsApp store in minutes. No technical setup needed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Business Name">
              <input
                type="text"
                placeholder="e.g. Altekflo Enterprises"
                value={form.name}
                onChange={set('name')}
                autoComplete="organization"
                className={INPUT}
              />
            </Field>

            <Field
              label="Email Address"
              hint="Your Merchant ID and sign-in details arrive here."
            >
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                className={INPUT}
              />
            </Field>

            <Field
              label="4-Digit PIN"
              hint="This is your login PIN — keep it memorable."
            >
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                inputMode="numeric"
                value={form.pin}
                onChange={set('pin')}
                autoComplete="new-password"
                className={INPUT}
              />
            </Field>

            <Field label="Confirm PIN">
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                inputMode="numeric"
                value={form.pin2}
                onChange={set('pin2')}
                autoComplete="new-password"
                className={INPUT}
              />
            </Field>

            <Field
              label={
                <span className="flex items-center gap-2">
                  Store WhatsApp Number
                  <span className="text-[10px] text-ink-4 font-normal normal-case tracking-normal">
                    (optional — add later)
                  </span>
                </span>
              }
              hint="International format, no + sign. e.g. 2348012345678"
            >
              <input
                type="tel"
                placeholder="e.g. 2348012345678"
                inputMode="numeric"
                value={form.wa}
                onChange={set('wa')}
                autoComplete="tel"
                className={INPUT}
              />
            </Field>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3
              text-xs text-amber-800 leading-relaxed">
              ⚠️{' '}
              <strong>Important:</strong> This number must{' '}
              <strong>not</strong> be active on WhatsApp or WhatsApp Business App.
              Your onboarding specialist will guide you through removing it.
            </div>

            {error && <ErrorBox msg={error} />}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-wa text-white font-semibold text-sm py-3.5 rounded-2xl
                shadow-wa hover:bg-wa-dark transition-all hover:-translate-y-0.5
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-ink-4">
          Already have an account?{' '}
          <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
