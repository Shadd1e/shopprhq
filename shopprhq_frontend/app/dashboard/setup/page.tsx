'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  getMerchantProfile, getClients, getInventory, getSubaccount,
  submitWhatsappNumber, getOnboardingStatus,
  type OnboardingStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Country codes ─────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '233', flag: '🇬🇭', name: 'Ghana' },
  { code: '254', flag: '🇰🇪', name: 'Kenya' },
  { code: '27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '256', flag: '🇺🇬', name: 'Uganda' },
  { code: '251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '225', flag: '🇨🇮', name: "Cote d'Ivoire" },
  { code: '221', flag: '🇸🇳', name: 'Senegal' },
  { code: '212', flag: '🇲🇦', name: 'Morocco' },
  { code: '20',  flag: '🇪🇬', name: 'Egypt' },
  { code: '44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: '1',   flag: '🇺🇸', name: 'United States' },
]

// ── Number helpers ────────────────────────────────────────────────────────

function normaliseLocal(raw: string, cc: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith(cc)) d = d.slice(cc.length)
  if (d.startsWith('0')) d = d.slice(1)
  return d
}

function buildFull(local: string, cc: string): string {
  return cc + local.replace(/\D/g, '').replace(/^0/, '')
}

function formatPreview(local: string, cc: string): string {
  const full = buildFull(local, cc)
  return full.length >= 7 ? '+' + full : ''
}

function validateLocal(local: string, cc: string): string | null {
  const full = buildFull(local, cc)
  if (!local.trim()) return 'Enter your phone number.'
  if (full.length < 7) return 'That number is too short.'
  if (full.length > 15) return 'That number is too long. Check for extra digits.'
  if (new Set(full).size === 1) return "That doesn't look like a real phone number."
  if (['123456789','1234567890'].includes(full)) return "That doesn't look like a real phone number."
  return null
}

// ── Delete guide ──────────────────────────────────────────────────────────

function DeleteGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-amber-200 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50
          text-left text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors">
        <span>How to properly delete WhatsApp from this number</span>
        <span className={cn('transition-transform text-amber-500 text-[10px]', open && 'rotate-180')}>▼</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-amber-50/50 space-y-4 text-xs text-amber-900 leading-relaxed border-t border-amber-200">
          <p className="font-semibold text-amber-800">
            Uninstalling the app is NOT the same as deleting your account. Delete the account first.
          </p>
          <div>
            <p className="font-bold mb-1.5">On iPhone</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp on that phone</li>
              <li>Tap Settings (bottom right)</li>
              <li>Tap Account</li>
              <li>Tap Delete My Account</li>
              <li>Enter the number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <div>
            <p className="font-bold mb-1.5">On Android</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp</li>
              <li>Tap the three dots top right, then Settings</li>
              <li>Tap Account</li>
              <li>Tap Delete My Account</li>
              <li>Enter your number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <div>
            <p className="font-bold mb-1.5">WhatsApp Business App</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp Business</li>
              <li>More options, then Settings</li>
              <li>Tap Account, then Delete My Account</li>
              <li>Enter your number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <p className="text-amber-700 font-medium">
            Once deleted, come back and submit your number. It usually takes a few minutes to clear on Meta's side.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────

function ConfirmModal({ number, onConfirm, onCancel, loading }: {
  number: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5">
      <div className="bg-white rounded-3xl border border-border shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📲</div>
          <h3 className="font-display font-bold text-lg text-ink tracking-tight mb-2">
            Confirm your number
          </h3>
          <p className="text-sm text-ink-4 leading-relaxed mb-3">
            We will register this number for your WhatsApp store:
          </p>
          <div className="bg-bg border border-border rounded-2xl py-3 px-6
            font-mono font-bold text-xl text-ink tracking-widest">
            {number}
          </div>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200
          rounded-xl px-3 py-2.5 mb-5 leading-relaxed text-center">
          Make sure this number has been removed from WhatsApp before confirming.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="flex-1 border border-border text-sm font-semibold text-ink-3
              py-3 rounded-2xl hover:bg-bg hover:text-ink transition-all disabled:opacity-50">
            Let me change it
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 bg-ink text-white text-sm font-semibold py-3 rounded-2xl
              hover:bg-ink/80 transition-all disabled:opacity-50">
            {loading ? 'Submitting…' : "Yes, that's correct"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── WhatsApp activation form ──────────────────────────────────────────────

function WhatsAppActivation({ token, onSubmitted }: {
  token: string; onSubmitted: () => void
}) {
  const [cc,           setCC]           = useState('234')
  const [local,        setLocal]        = useState('')
  const [checks,       setChecks]       = useState({ notActive: false, canReceive: false, understood: false })
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [localErr,     setLocalErr]     = useState('')
  const [serverErr,    setServerErr]    = useState('')
  const [submitted,    setSubmitted]    = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState(3)

  const allChecked = Object.values(checks).every(Boolean)
  const preview    = formatPreview(local, cc)
  const fullNumber = buildFull(local, cc)

  function handleNumberChange(raw: string) {
    setLocal(normaliseLocal(raw, cc))
    setLocalErr(''); setServerErr('')
  }

  function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault()
    const err = validateLocal(local, cc)
    if (err) { setLocalErr(err); return }
    if (!allChecked) { setLocalErr('Please tick all boxes above before continuing.'); return }
    setShowConfirm(true)
  }

  async function handleConfirm() {
    setSubmitting(true); setServerErr('')
    try {
      await submitWhatsappNumber(token, fullNumber)
      setSubmitted(true)
      onSubmitted()
    } catch (err: any) {
      const msg = err.detail ?? 'Could not submit your number. Please try again.'
      setServerErr(msg)
      if (err.status === 429) setAttemptsLeft(0)
      else setAttemptsLeft(a => Math.max(0, a - 1))
    } finally {
      setSubmitting(false); setShowConfirm(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
        <div className="text-3xl">✅</div>
        <h3 className="font-display font-bold text-base text-emerald-800 tracking-tight">
          Number received
        </h3>
        <p className="text-sm text-emerald-700 leading-relaxed">
          We will activate your store within 24 hours and notify you by email.
          In the meantime, go ahead and set up your catalogue below.
        </p>
        <div className="bg-white border border-emerald-200 rounded-2xl py-2.5 px-5
          font-mono font-bold text-lg text-ink inline-block">
          {preview}
        </div>
      </div>
    )
  }

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          number={preview}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          loading={submitting}
        />
      )}
      <div className="bg-white border border-border rounded-3xl p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📲</span>
            <h3 className="font-display font-bold text-base text-ink tracking-tight">
              WhatsApp Activation
            </h3>
          </div>
          <p className="text-xs text-ink-4 leading-relaxed">
            This is the number customers will message to browse and order from your store.
            Meta will send a single 6-digit code to verify it.
          </p>
        </div>

        <form onSubmit={handleSubmitRequest} className="space-y-4">
          {/* Checklist */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Confirm all of the following before continuing:
            </p>
            {[
              { key: 'notActive' as const,  text: 'This number is not currently active on WhatsApp or WhatsApp Business App' },
              { key: 'canReceive' as const, text: 'This number can receive SMS or phone calls (not a VoIP-only number)' },
              { key: 'understood' as const, text: 'I understand Meta will send a 6-digit verification code to this number' },
            ].map(({ key, text }) => (
              <label key={key}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  checks[key] ? 'bg-emerald-50 border-emerald-200' : 'bg-bg border-border hover:border-ink-3',
                )}>
                <input type="checkbox" checked={checks[key]}
                  onChange={e => setChecks(p => ({ ...p, [key]: e.target.checked }))}
                  className="mt-0.5 accent-emerald-600 shrink-0" />
                <span className={cn('text-xs leading-relaxed', checks[key] ? 'text-emerald-800' : 'text-ink-3')}>
                  {text}
                </span>
              </label>
            ))}
          </div>

          <DeleteGuide />

          {/* Number input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
              Your WhatsApp number
            </label>
            <div className="flex gap-2">
              <div className="relative">
                <select value={cc} onChange={e => { setCC(e.target.value); setLocalErr(''); setServerErr('') }}
                  className="h-full pl-3 pr-7 rounded-[13px] bg-bg border-[1.5px] border-border
                    text-sm font-sans text-ink outline-none transition-all appearance-none
                    focus:border-wa focus:ring-2 focus:ring-wa/10"
                  style={{ minWidth: '5.5rem' }}>
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 text-[10px]">▼</span>
              </div>
              <input type="tel" inputMode="numeric" placeholder="8012345678" maxLength={12}
                value={local}
                onChange={e => handleNumberChange(e.target.value)}
                className={cn(
                  'flex-1 px-3.5 py-2.5 rounded-[13px] bg-bg border-[1.5px]',
                  'text-sm font-sans text-ink placeholder:text-ink-4/50 outline-none transition-all',
                  localErr
                    ? 'border-red-400 bg-red-50/40 focus:border-red-400 focus:ring-2 focus:ring-red-200/50'
                    : 'border-border focus:border-wa focus:bg-white focus:ring-2 focus:ring-wa/10',
                )} />
            </div>
            {preview && !localErr && (
              <p className="mt-1.5 text-xs text-ink-4">
                We will register: <strong className="text-ink font-mono">{preview}</strong>
              </p>
            )}
            {localErr && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span>↑</span> {localErr}
              </p>
            )}
            {!localErr && !preview && (
              <p className="mt-1.5 text-xs text-ink-4">
                Enter your number without the leading 0 — e.g. 8012345678
              </p>
            )}
          </div>

          {serverErr && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 leading-relaxed">
              {serverErr}
              {attemptsLeft > 0 && attemptsLeft < 3 && (
                <span className="block mt-1 font-semibold">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining.</span>
              )}
              {attemptsLeft === 0 && (
                <span className="block mt-1 font-semibold">No attempts remaining. Please contact support.</span>
              )}
            </div>
          )}

          <button type="submit"
            disabled={!allChecked || !local || attemptsLeft === 0}
            className="w-full bg-ink text-white font-semibold text-sm py-3.5 rounded-2xl
              hover:bg-ink/80 transition-all hover:-translate-y-0.5
              disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
            Submit my number →
          </button>
        </form>
      </div>
    </>
  )
}

// ── Step item ─────────────────────────────────────────────────────────────

function StepItem({ done, label, hint, href }: {
  done: boolean; label: string; hint: string; href?: string
}) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-2xl border transition-colors',
      done ? 'bg-green-50 border-green-200' : 'bg-white border-border',
    )}>
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 font-bold',
        done ? 'bg-green-500 text-white' : 'bg-bg border-2 border-border text-ink-4',
      )}>
        {done ? '✓' : ''}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm', done ? 'text-green-800' : 'text-ink')}>{label}</p>
        <p className="text-xs text-ink-4 mt-0.5">{hint}</p>
      </div>
      {!done && href && (
        <Link href={href}
          className="shrink-0 text-xs font-semibold bg-ink text-white px-3.5 py-2
            rounded-xl hover:bg-ink/80 transition-colors whitespace-nowrap">
          Go →
        </Link>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [checked,          setChecked]          = useState(false)
  const [token,            setToken]            = useState<string | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [storeName,        setStoreName]        = useState('')
  const [hasNumber,        setHasNumber]        = useState(false)
  const [hasProducts,      setHasProducts]      = useState(false)
  const [hasBankAccount,   setHasBankAccount]   = useState(false)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>('pending')

  useEffect(() => {
    const tok = sessionStorage.getItem('m_tok')
    setToken(tok); setChecked(true)
  }, [])

  const loadData = useCallback(async (tok: string) => {
    setLoading(true)
    try {
      const prof = await getMerchantProfile(tok)
      setStoreName(prof.name)
      try {
        const ob = await getOnboardingStatus(tok)
        setOnboardingStatus(ob.onboarding_status)
        setHasNumber(ob.onboarding_status !== 'pending')
      } catch {}
      const clientList = await getClients(tok)
      let foundProducts = false, foundBank = false
      for (const c of clientList) {
        if (!foundProducts) {
          try { const p = await getInventory(tok, prof.id, c.id); if (p.length > 0) foundProducts = true } catch {}
        }
        if (!foundBank) {
          try { await getSubaccount(tok, c.id); foundBank = true } catch {}
        }
        if (foundProducts && foundBank) break
      }
      setHasProducts(foundProducts); setHasBankAccount(foundBank)
    } catch (err: any) {
      if (err?.status === 401) { sessionStorage.removeItem('m_tok'); router.push('/dashboard') }
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => {
    if (!checked) return
    if (!token) { router.push('/dashboard'); return }
    loadData(token)
  }, [checked, token, loadData, router])

  if (!checked) return null

  const allDone = hasNumber && hasProducts && hasBankAccount

  return (
    <div className="min-h-screen bg-bg p-5">
      <div className="max-w-[28rem] mx-auto py-8">
        <div className="flex justify-center mb-8"><Logo /></div>

        <div className="text-center mb-6">
          {loading
            ? <div className="skeleton h-8 w-48 rounded-lg mx-auto" />
            : <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink">
                {storeName ? `Welcome, ${storeName}!` : 'Set up your store'}
              </h1>
          }
          <p className="text-sm text-ink-4 mt-1.5">
            Complete these steps to launch your WhatsApp store.
          </p>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="skeleton h-64 rounded-3xl" />
          ) : !hasNumber ? (
            <WhatsAppActivation
              token={token!}
              onSubmitted={() => { setHasNumber(true); setOnboardingStatus('number_submitted') }}
            />
          ) : (
            <div className={cn(
              'flex items-center gap-4 p-4 rounded-2xl border',
              onboardingStatus === 'active' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200',
            )}>
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 font-bold',
                onboardingStatus === 'active' ? 'bg-green-500 text-white' : 'bg-blue-200 text-blue-700',
              )}>
                {onboardingStatus === 'active' ? '✓' : '⏳'}
              </div>
              <div>
                <p className={cn('font-semibold text-sm', onboardingStatus === 'active' ? 'text-green-800' : 'text-blue-800')}>
                  {onboardingStatus === 'active' ? 'WhatsApp store is live' : 'WhatsApp number submitted'}
                </p>
                <p className="text-xs text-ink-4 mt-0.5">
                  {onboardingStatus === 'active'
                    ? 'Your store is connected and receiving orders.'
                    : 'We will activate your store within 24 hours. Check your dashboard for updates.'}
                </p>
              </div>
            </div>
          )}

          {loading
            ? <div className="skeleton h-[68px] rounded-2xl" />
            : <StepItem done={hasProducts} label="Add your first product"
                hint="List at least one item customers can order." href="/dashboard?tab=inventory" />
          }

          {loading
            ? <div className="skeleton h-[68px] rounded-2xl" />
            : <StepItem done={hasBankAccount} label="Connect your bank account"
                hint="Set up payouts to receive your earnings." href="/dashboard?tab=settings" />
          }
        </div>

        {!loading && (
          <div className="mt-6">
            {allDone ? (
              <Link href="/dashboard"
                className="flex items-center justify-center gap-2 w-full bg-wa text-white
                  font-semibold text-sm py-3.5 px-6 rounded-2xl shadow-wa hover:bg-wa-dark
                  transition-all hover:-translate-y-0.5">
                Go to Dashboard →
              </Link>
            ) : (
              <p className="text-center text-xs text-ink-4">
                You can complete these steps in any order.{' '}
                <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
                  Go to dashboard →
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
