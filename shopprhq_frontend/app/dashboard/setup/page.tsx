'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  getMerchantProfile, getClients, getInventory, getSubaccount,
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
  const [hasProducts,      setHasProducts]      = useState(false)
  const [hasBankAccount,   setHasBankAccount]   = useState(false)

  useEffect(() => {
    const tok = sessionStorage.getItem('m_tok')
    setToken(tok); setChecked(true)
  }, [])

  const loadData = useCallback(async (tok: string) => {
    setLoading(true)
    try {
      const prof = await getMerchantProfile(tok)
      setStoreName(prof.name)
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

  const allDone = hasProducts && hasBankAccount

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
          {loading
            ? <div className="skeleton h-[68px] rounded-2xl" />
            : <StepItem done={false} label="Activate your WhatsApp number"
                hint="Submit your number for Meta verification." href="/onboarding" />
          }

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
