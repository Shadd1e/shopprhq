'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { registerMerchant } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Shared input style ─────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: React.ReactNode
  hint?: string
  error?: string
  children: React.ReactNode
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

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 leading-snug">
      {msg}
    </div>
  )
}

// ── Success state ──────────────────────────────────────────────────────────

function SuccessCard({ mid, email, storeName }: { mid: string; email: string; storeName: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md py-8">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-lg p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-wa/20 to-wa/10
            flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm">
            🎉
          </div>

          <h2 className="font-display font-extrabold text-2xl tracking-tight text-ink mb-1">
            Welcome to ShopprHQ, {storeName}!
          </h2>
          <p className="text-sm text-ink-3 mb-5">
            Registration successful. Check your email to verify your account before signing in.
          </p>
          <p className="text-sm text-ink-3 leading-relaxed mb-6">
            We sent a 6-digit verification code to{' '}
            <strong className="text-ink">{email}</strong>
          </p>

          {/* Merchant ID chip */}
          <div className="bg-bg border border-border rounded-2xl py-4 px-8 inline-block
            font-display font-extrabold text-3xl tracking-widest text-ink mb-3">
            {mid}
          </div>
          <p className="text-xs text-ink-4 mb-6 leading-relaxed">
            This is your <strong>Merchant ID</strong> — save it somewhere safe.
          </p>

          <p className="text-xs text-ink-3 mb-8 leading-relaxed">
            Next: submit your WhatsApp number for activation. You can also set up your
            product catalogue while we get your store live — usually within 24 hours.
          </p>

          <Link
            href="/dashboard/setup"
            className="flex items-center justify-center gap-2 bg-wa text-white font-semibold
              text-sm py-3.5 px-6 rounded-2xl shadow-wa hover:bg-wa-dark
              transition-all hover:-translate-y-0.5"
          >
            Complete your setup →
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

type FieldErrors = Partial<Record<'name' | 'email' | 'pin' | 'pin2', string>>

export default function RegisterPage() {
  const [form, setForm] = useState({
    name:  '',
    email: '',
    pin:   '',
    pin2:  '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState<{ mid: string; email: string; storeName: string } | null>(null)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((p) => ({ ...p, [field]: e.target.value }))
      // Clear that field's error as soon as the user starts correcting it
      setFieldErrors((p) => ({ ...p, [field]: undefined }))
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
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }

    const { name, email, pin } = form
    setLoading(true)
    try {
      const data = await registerMerchant({ name, email, password: pin, whatsapp_number: null })
      setSuccess({ mid: data.id, email, storeName: name })
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

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            <Field label="Business Name" error={fieldErrors.name}>
              <input
                type="text"
                placeholder="e.g. Altekflo Enterprises"
                value={form.name}
                onChange={set('name')}
                autoComplete="organization"
                className={inputClass(!!fieldErrors.name)}
              />
            </Field>

            <Field
              label="Email Address"
              hint="Your Merchant ID and sign-in details arrive here."
              error={fieldErrors.email}
            >
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                className={inputClass(!!fieldErrors.email)}
              />
            </Field>

            <Field
              label="PIN (min. 6 digits)"
              hint="This is your login PIN — keep it memorable."
              error={fieldErrors.pin}
            >
              <input
                type="password"
                placeholder="••••••"
                maxLength={10}
                inputMode="numeric"
                value={form.pin}
                onChange={set('pin')}
                autoComplete="new-password"
                className={inputClass(!!fieldErrors.pin)}
              />
            </Field>

            <Field label="Confirm PIN" error={fieldErrors.pin2}>
              <input
                type="password"
                placeholder="••••••"
                maxLength={10}
                inputMode="numeric"
                value={form.pin2}
                onChange={set('pin2')}
                autoComplete="new-password"
                className={inputClass(!!fieldErrors.pin2)}
              />
            </Field>

            {serverError && <ErrorBox msg={serverError} />}

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
