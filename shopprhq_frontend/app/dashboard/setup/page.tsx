'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  getMerchantProfile, getClients, getInventory, getSubaccount,
} from '@/lib/api'
import { cn } from '@/lib/utils'

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
