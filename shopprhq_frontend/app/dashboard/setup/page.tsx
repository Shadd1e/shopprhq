'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  getMerchantProfile, getClients, getInventory, getSubaccount,
} from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Step row ───────────────────────────────────────────────────────────────

function StepItem({
  done, label, hint, href,
}: {
  done: boolean
  label: string
  hint: string
  href?: string
}) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-2xl border transition-colors',
      done ? 'bg-green-50 border-green-200' : 'bg-white border-border',
    )}>
      {/* tick / empty box */}
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 font-bold',
        done
          ? 'bg-green-500 text-white'
          : 'bg-bg border-2 border-border text-ink-4',
      )}>
        {done ? '✓' : ''}
      </div>

      {/* text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-semibold text-sm flex items-center gap-2',
          done ? 'text-green-800' : 'text-ink',
        )}>
          {label}
          <span>{done ? '✅' : '⬜'}</span>
        </p>
        <p className="text-xs text-ink-4 mt-0.5">{hint}</p>
      </div>

      {/* action button — only when incomplete */}
      {!done && href && (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold bg-ink text-white px-3.5 py-2
            rounded-xl hover:bg-ink/80 transition-colors whitespace-nowrap"
        >
          Go →
        </Link>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()

  const [checked,  setChecked]  = useState(false)
  const [token,    setToken]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)

  const [storeName,      setStoreName]      = useState('')
  const [hasWhatsapp,    setHasWhatsapp]    = useState(false)
  const [hasProducts,    setHasProducts]    = useState(false)
  const [hasBankAccount, setHasBankAccount] = useState(false)

  // ── Auth check ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tok = sessionStorage.getItem('m_tok')
    setToken(tok)
    setChecked(true)
  }, [])

  // ── Data load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!checked) return
    if (!token) { router.push('/dashboard'); return }

    async function load() {
      setLoading(true)
      try {
        const prof = await getMerchantProfile(token!)
        setStoreName(prof.name)
        const mId = prof.id

        const clientList = await getClients(token!)

        // WhatsApp: any store has a connected number
        setHasWhatsapp(clientList.some(c => !!c.whatsapp_number))

        // Products + bank: iterate stores, stop early once found
        let foundProducts = false
        let foundBank = false

        for (const c of clientList) {
          if (!foundProducts) {
            try {
              const prods = await getInventory(token!, mId, c.id)
              if (prods.length > 0) foundProducts = true
            } catch {}
          }
          if (!foundBank) {
            try {
              await getSubaccount(token!, c.id)
              foundBank = true
            } catch {}
          }
          if (foundProducts && foundBank) break
        }

        setHasProducts(foundProducts)
        setHasBankAccount(foundBank)
      } catch (err: any) {
        if (err?.status === 401) {
          sessionStorage.removeItem('m_tok')
          router.push('/dashboard')
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [checked, token, router])

  if (!checked) return null

  const allDone = hasWhatsapp && hasProducts && hasBankAccount

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className="w-full max-w-[26rem] py-8">

        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-white rounded-3xl border border-border shadow-lg p-8">

          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-wa/20 to-wa/10
              flex items-center justify-center mx-auto mb-4 text-3xl">
              🚀
            </div>
            {loading ? (
              <div className="skeleton h-7 w-48 rounded-lg mx-auto" />
            ) : (
              <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink">
                {storeName ? `Hey, ${storeName}!` : 'Almost there!'}
              </h1>
            )}
            <p className="text-sm text-ink-4 mt-1">
              Complete these steps to launch your WhatsApp store.
            </p>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton h-[68px] rounded-2xl" />
              ))
            ) : (
              <>
                <StepItem
                  done
                  label="Store created"
                  hint="Your merchant account is ready."
                />
                <StepItem
                  done={hasWhatsapp}
                  label="Add your WhatsApp number"
                  hint="Connect a phone number to receive orders."
                  href="/dashboard?tab=settings"
                />
                <StepItem
                  done={hasProducts}
                  label="Add your first product"
                  hint="List at least one item customers can order."
                  href="/dashboard?tab=inventory"
                />
                <StepItem
                  done={hasBankAccount}
                  label="Connect your bank account"
                  hint="Set up payouts to receive your earnings."
                  href="/dashboard?tab=settings"
                />
              </>
            )}
          </div>

          {/* Footer CTA */}
          {!loading && (
            <div className="mt-6">
              {allDone ? (
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 w-full bg-wa text-white
                    font-semibold text-sm py-3.5 px-6 rounded-2xl shadow-wa hover:bg-wa-dark
                    transition-all hover:-translate-y-0.5"
                >
                  Go to Dashboard →
                </Link>
              ) : (
                <p className="text-center text-xs text-ink-4">
                  Pick a step above to get started.{' '}
                  <Link
                    href="/dashboard"
                    className="text-wa-dark font-semibold hover:underline"
                  >
                    Skip for now
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
