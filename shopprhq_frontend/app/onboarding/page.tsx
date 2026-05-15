'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { submitWhatsappNumber, getOnboardingStatus } from '@/lib/api'
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
  if (['123456789', '1234567890'].includes(full)) return "That doesn't look like a real phone number."
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
              <li>Tap Account → Delete My Account</li>
              <li>Enter the number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <div>
            <p className="font-bold mb-1.5">On Android</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp</li>
              <li>Tap the three dots top right → Settings</li>
              <li>Tap Account → Delete My Account</li>
              <li>Enter your number and confirm</li>
              <li>Then uninstall the app</li>
            </ol>
          </div>
          <div>
            <p className="font-bold mb-1.5">WhatsApp Business App</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Open WhatsApp Business</li>
              <li>More options → Settings</li>
              <li>Account → Delete My Account</li>
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
          Make sure WhatsApp has been removed from this number before confirming.
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

// ── Main page ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router  = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  // Number form state
  const [cc,           setCC]           = useState('234')
  const [local,        setLocal]        = useState('')
  const [checks,       setChecks]       = useState({ notActive: false, canReceive: false, understood: false })
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [localErr,     setLocalErr]     = useState('')
  const [serverErr,    setServerErr]    = useState('')
  const [submitted,    setSubmitted]    = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState(3)

  useEffect(() => {
    const tok = sessionStorage.getItem('m_tok')
    setToken(tok); setChecked(true)
  }, [])

  useEffect(() => {
    if (!checked) return
    if (!token) { router.push('/register'); return }
    // Check if already submitted
    getOnboardingStatus(token).then(s => {
      if (s.onboarding_status !== 'pending') setSubmitted(true)
    }).catch(() => {})
  }, [checked, token, router])

  if (!checked) return null

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
      await submitWhatsappNumber(token!, fullNumber)
      setSubmitted(true)
    } catch (err: any) {
      const msg = err.detail ?? 'Could not submit your number. Please try again.'
      setServerErr(msg)
      if (err.status === 429) setAttemptsLeft(0)
      else setAttemptsLeft(a => Math.max(0, a - 1))
    } finally { setSubmitting(false); setShowConfirm(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-bg">
        <div className="w-full max-w-[26rem] py-8">
          <div className="flex justify-center mb-8"><Logo /></div>
          <div className="bg-white rounded-3xl border border-border shadow-lg p-10 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="font-display font-extrabold text-xl tracking-tight text-ink">
              You're all set!
            </h2>
            <p className="text-sm text-ink-4 leading-relaxed">
              Your number has been received. We'll activate your store within 24 hours
              and notify you by email. In the meantime, set up your catalogue.
            </p>
            {preview && (
              <div className="bg-bg border border-border rounded-2xl py-2.5 px-6
                font-mono font-bold text-lg text-ink inline-block">
                {preview}
              </div>
            )}
            <Link href="/dashboard"
              className="flex items-center justify-center gap-2 w-full bg-wa text-white
                font-semibold text-sm py-3.5 px-6 rounded-2xl shadow-wa hover:bg-wa-dark
                transition-all hover:-translate-y-0.5 mt-2">
              Go to Dashboard →
            </Link>
          </div>
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

      <div className="min-h-screen flex items-center justify-center p-5 bg-bg">
        <div className="w-full max-w-[26rem] py-8">

          <div className="flex justify-center mb-6"><Logo /></div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-wa" />
            <div className="w-2 h-2 rounded-full bg-wa" />
            <div className="w-2 h-2 rounded-full bg-ink ring-2 ring-ink/20" />
          </div>
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-ink-4 mb-6">
            Step 3 of 3 — Activate your WhatsApp number
          </p>

          <div className="bg-white rounded-3xl border border-border shadow-lg p-7 space-y-5">
            <div>
              <h2 className="font-display font-extrabold text-[1.3rem] tracking-tight text-ink mb-1.5">
                WhatsApp Activation
              </h2>
              <p className="text-xs text-ink-4 leading-relaxed">
                This is the number customers will message to browse and order from your store.
                Meta will send a single 6-digit code to verify it — that's the only step on your end.
              </p>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              {/* Checklist */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  Confirm all of the following:
                </p>
                {[
                  { key: 'notActive'  as const, text: 'This number is not currently active on WhatsApp or WhatsApp Business App' },
                  { key: 'canReceive' as const, text: 'This number can receive SMS or phone calls' },
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
                    Enter without leading 0 — e.g. 8012345678
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

          <p className="text-center mt-5 text-xs text-ink-4">
            Want to do this later?{' '}
            <Link href="/dashboard" className="text-wa-dark font-semibold hover:underline">
              Go to dashboard →
            </Link>
          </p>

        </div>
      </div>
    </>
  )
}
