'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// ── Shared icon ────────────────────────────────────────────────────────────

function ArrowRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Static data ────────────────────────────────────────────────────────────

const stats = [
  { value: '60s',  label: 'to go live'   },
  { value: '₦0',   label: 'upfront cost' },
  { value: '<1%',  label: 'per order'    },
  { value: '24/7', label: 'AI handling orders' },
]

const steps = [
  {
    n: '01',
    title: 'Build your catalogue',
    body: 'Add products with names, prices, and descriptions. Your full storefront is ready in under a minute — no dev, no setup.',
  },
  {
    n: '02',
    title: 'Share your number',
    body: 'Customers send a WhatsApp message to browse and order. The AI handles the conversation. No app, no link, just the chat.',
  },
  {
    n: '03',
    title: 'Run your business',
    body: 'Orders arrive in real time. Confirm, dispatch, and track payments from your dashboard. Always in control.',
  },
]

const features = [
  {
    title: 'AI takes the orders',
    body: 'Customers type naturally. ShopprHQ understands, structures, and confirms the order — automatically.',
  },
  {
    title: 'Two ways to pay',
    body: 'Card or cash on delivery. Payouts go straight to your bank account.',
  },
  {
    title: 'Instant order alerts',
    body: 'Every new order, payment, and status change hits your WhatsApp the moment it happens.',
  },
  {
    title: 'Inventory that keeps up',
    body: 'Track stock levels in real time. Get warned before you run out.',
  },
  {
    title: 'One account, many stores',
    body: 'Manage multiple WhatsApp storefronts from a single merchant dashboard.',
  },
  {
    title: 'Know your numbers',
    body: 'Daily revenue breakdowns, full order history, and printable receipts — all in one place.',
  },
]

// ── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  useReveal()

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ════════════════════════════════════════════
          NAV
      ════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Logo />

          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <a href="#how-it-works" className="text-sm font-medium text-ink-3 hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#features" className="text-sm font-medium text-ink-3 hover:text-ink transition-colors">
              Features
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard"
              className="text-sm font-semibold text-ink-2 px-4 py-2 rounded-xl hover:bg-border/70 transition-colors">
              Sign in
            </Link>
            <Link href="/register"
              className="text-sm font-semibold bg-ink text-white px-4 py-2.5 rounded-xl
                hover:bg-ink-2 transition-all duration-150 hover:-translate-y-px shadow-sm">
              Create store
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════
          HERO  — doodle shows here (transparent bg)
      ════════════════════════════════════════════ */}
      <section className="pt-24 pb-32 px-5 text-center">
        <div className="max-w-3xl mx-auto">

          <h1 className="font-display font-extrabold text-[clamp(2.8rem,7.5vw,5rem)]
            tracking-tight leading-[1.02] text-ink mb-7">
            The store that lives<br />
            <span className="text-wa-dark">in WhatsApp.</span>
          </h1>

          <p className="text-[1.1rem] sm:text-xl text-ink-3 leading-relaxed
            max-w-[32rem] mx-auto mb-12 font-normal">
            Your customers order in the chat.
            You manage inventory, confirm orders, and track revenue — from one clean dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                bg-wa text-white font-semibold text-base px-8 py-3.5 rounded-2xl
                shadow-wa hover:bg-wa-dark hover:shadow-wa-lg
                transition-all duration-200 hover:-translate-y-0.5">
              Create your free store
              <ArrowRight />
            </Link>
            <a href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                bg-white text-ink-2 font-semibold text-base px-8 py-3.5 rounded-2xl
                border border-border shadow-sm hover:border-ink-4 hover:shadow-md
                transition-all duration-200 hover:-translate-y-0.5">
              See how it works
            </a>
          </div>

          {/* Stats */}
          <div className="max-w-xl mx-auto mt-20 grid grid-cols-2 sm:grid-cols-4
            bg-border gap-px rounded-2xl overflow-hidden border border-border shadow-sm">
            {stats.map((s) => (
              <div key={s.value} className="bg-white/90 backdrop-blur-sm px-4 py-5 text-center">
                <p className="font-display font-extrabold text-[1.65rem] tracking-tight text-ink">
                  {s.value}
                </p>
                <p className="text-[11px] text-ink-4 mt-0.5 font-medium leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          HOW IT WORKS  — dark, no doodle
      ════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-5 bg-ink">
        <div className="max-w-5xl mx-auto">

          <div className="text-center mb-16 reveal">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-wa mb-4">
              How it works
            </p>
            <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.2rem)]
              tracking-tight text-white leading-tight">
              Live in three steps.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {steps.map((step, i) => (
              <div key={step.n}
                className="reveal bg-white/[.05] border border-white/[.08] rounded-3xl p-8
                  hover:bg-white/[.08] transition-colors duration-300"
                style={{ transitionDelay: `${i * 90}ms` }}>
                <p className="font-display font-extrabold text-[3rem] leading-none
                  text-white/[.07] mb-6 tracking-tight select-none">
                  {step.n}
                </p>
                <h3 className="font-display font-bold text-[1.1rem] text-white mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FEATURES  — doodle shows here (transparent bg)
      ════════════════════════════════════════════ */}
      <section id="features" className="py-28 px-5">
        <div className="max-w-5xl mx-auto">

          <div className="text-center mb-16 reveal">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-wa mb-4">
              Features
            </p>
            <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.2rem)]
              tracking-tight text-ink leading-tight">
              Everything you need.<br className="hidden sm:block" />
              <span className="text-ink-3 font-bold"> Nothing you don't.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={f.title}
                className="reveal bg-white border border-border rounded-3xl px-7 py-6
                  hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                style={{ transitionDelay: `${i * 60}ms` }}>
                <h3 className="font-display font-bold text-[1rem] text-ink mb-2 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm text-ink-3 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CTA BAND
      ════════════════════════════════════════════ */}
      <section className="py-28 px-5 bg-wa-dark relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none
          bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(37,211,102,.18)_0%,transparent_70%)]" />

        <div className="relative max-w-2xl mx-auto text-center reveal">
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.2rem)]
            tracking-tight text-white leading-tight mb-5">
            Ready to start<br />taking orders?
          </h2>
          <p className="text-white/55 text-lg mb-10 leading-relaxed">
            Your store is live in under a minute.<br className="hidden sm:block" />
            No setup fee. No card required.
          </p>

          <Link href="/register"
            className="inline-flex items-center gap-2.5 bg-white text-wa-dark font-bold
              text-base px-8 py-4 rounded-2xl shadow-xl
              hover:-translate-y-1 hover:shadow-2xl transition-all duration-200">
            Create your free store
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <footer className="bg-ink py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center
            justify-between gap-8 mb-10 pb-10 border-b border-white/10">
            <div>
              <Logo dark />
              <p className="text-sm text-white/30 mt-3 max-w-xs leading-relaxed">
                Turn your WhatsApp number into a real storefront.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-white/40">
              <a href="#how-it-works" className="hover:text-white/70 transition-colors">How it works</a>
              <a href="#features"     className="hover:text-white/70 transition-colors">Features</a>
              <Link href="/register"  className="hover:text-white/70 transition-colors">Create store</Link>
              <Link href="/dashboard" className="hover:text-white/70 transition-colors">Sign in</Link>
              <a href="mailto:hello@shopprhq.com" className="hover:text-white/70 transition-colors">Contact</a>
            </div>
          </div>
          <p className="text-xs text-white/20">© 2025 ShopprHQ</p>
        </div>
      </footer>

    </div>
  )
}
