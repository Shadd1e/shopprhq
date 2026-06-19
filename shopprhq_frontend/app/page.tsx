'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

/* ── Scroll reveal ── */
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

/* ── Typing effect ── */
const PAIN_LINES = [
  'Chidi sent a message at 1:47am. No one replied.',
  'Amaka spent 3 hours answering "how much is this?"',
  'Another customer dropped off after "send your account number".',
  'Tunde lost 4 orders while away from his phone.',
  'Same questions. Every. Single. Day.',
  'Bisi\'s staff couldn\'t handle the DM volume alone.',
]

function TypingLine() {
  const [lineIdx, setLineIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing')

  useEffect(() => {
    const line = PAIN_LINES[lineIdx]
    let timeout: ReturnType<typeof setTimeout>

    if (phase === 'typing') {
      if (displayed.length < line.length) {
        timeout = setTimeout(() => setDisplayed(line.slice(0, displayed.length + 1)), 38)
      } else {
        timeout = setTimeout(() => setPhase('pause'), 2000)
      }
    } else if (phase === 'pause') {
      timeout = setTimeout(() => setPhase('erasing'), 400)
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 18)
      } else {
        setLineIdx((i) => (i + 1) % PAIN_LINES.length)
        setPhase('typing')
      }
    }
    return () => clearTimeout(timeout)
  }, [displayed, phase, lineIdx])

  return (
    <p className="text-white/40 text-sm sm:text-base font-mono min-h-[1.5em]">
      {displayed}
      <span className="cursor-blink text-[#25D366]">|</span>
    </p>
  )
}

/* ── Live WhatsApp conversation ── */
const CHAT_SCRIPT = [
  { from: 'customer', text: 'Hi, do you have jollof rice?' },
  { from: 'bot',      text: 'Yes! 👋 We have:\n• Jollof Rice — ₦2,500\n• Fried Rice — ₦2,800\n• Party Rice — ₦3,200\n\nHow many portions?' },
  { from: 'customer', text: '2 jollof and add 1 chicken' },
  { from: 'bot',      text: '✅ Got it!\n\n2× Jollof Rice — ₦5,000\n1× Chicken — ₦1,800\n\nTotal: ₦6,800\n\nCard or cash on delivery?' },
  { from: 'customer', text: 'Card' },
  { from: 'bot',      text: '💳 Pay here:\nhttps://pay.shopprhq.com/k8x2\n\nOrder confirmed once payment lands 🎉' },
]

function LiveChat() {
  const [visible, setVisible] = useState<number[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        CHAT_SCRIPT.forEach((_, i) => {
          setTimeout(() => setVisible((v) => [...v, i]), i * 1100)
        })
      }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#111]">
      {/* Header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#25D366]/30 flex items-center justify-center text-xs font-bold text-[#25D366]">MT</div>
        <div>
          <p className="text-white text-sm font-semibold">Mama Tee Foods</p>
          <p className="text-green-300 text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Online now
          </p>
        </div>
      </div>
      {/* Messages */}
      <div className="bg-[#0d1b0f] p-4 space-y-2 min-h-[300px]">
        {CHAT_SCRIPT.map((msg, i) =>
          visible.includes(i) ? (
            <div
              key={i}
              className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}
              style={{ animation: 'msgIn .35s ease both' }}
            >
              <div className={[
                'max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-line shadow-sm',
                msg.from === 'customer'
                  ? 'bg-[#1a3a22] text-white/90 rounded-br-sm'
                  : 'bg-[#1c2b1e] text-white/80 rounded-bl-sm border border-white/5',
              ].join(' ')}>
                {msg.text}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

/* ── Ticker ── */
const TICKER_ITEMS = [
  'Missed a 2am order',
  'Sent account number manually',
  'Staff couldn\'t keep up with DMs',
  'Customer never replied after payment link',
  'Answered "how much?" for the 50th time',
  '4 hours on WhatsApp. Zero fulfilled orders.',
  'Lost a sale while at a meeting',
  'Customer went elsewhere',
]

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="overflow-hidden border-y border-white/8 py-3 bg-[#0d1a11]">
      <div className="animate-marquee">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-6 px-6 text-xs font-mono text-white/30 whitespace-nowrap">
            <span className="text-[#25D366] text-[8px]">✦</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Why section cards ── */
const WHY_CARDS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    title: 'Always on',
    body: 'Handles orders at 2am, during weekends, public holidays. It doesn\'t clock out.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    title: 'Handles the repetition',
    body: '"Do you have this?" "How much?" "Is delivery available?" Answered instantly, every time.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 21Z" />
      </svg>
    ),
    title: 'Collects payment too',
    body: 'No more sending account numbers. Customers pay by card in the chat, confirmed automatically.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: 'One dashboard',
    body: 'Every order, every branch, every naira — visible in real time from one place.',
  },
]

/* ── Stats ── */
const STATS = [
  { value: '₦0',   label: 'Setup fee' },
  { value: '60s',  label: 'To go live' },
  { value: '24/7', label: 'On duty' },
  { value: '<1%',  label: 'Per transaction' },
]

/* ── Page ── */
export default function HomePage() {
  useReveal()

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative pt-36 pb-24 px-5 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#25D366]/10 blur-[120px] glow-pulse pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div
            className="inline-flex items-center gap-2 border border-[#25D366]/25 text-[#25D366] text-xs font-mono px-4 py-1.5 rounded-full mb-10 fade-in-up"
            style={{ animationDelay: '0ms' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
            Now accepting Nigerian merchants
          </div>

          <h1
            className="font-display font-extrabold text-[clamp(3rem,9vw,6.5rem)] tracking-tight leading-[0.95] text-white mb-6 fade-in-up"
            style={{ animationDelay: '80ms' }}
          >
            The employee<br />
            <span className="text-[#25D366]">that pays you.</span>
          </h1>

          <p
            className="text-white/50 text-lg sm:text-xl max-w-lg mx-auto mb-4 leading-relaxed fade-in-up"
            style={{ animationDelay: '160ms' }}
          >
            From hello to completed sale. Every conversation, any hour, any volume.
          </p>

          <div className="mb-10 fade-in-up" style={{ animationDelay: '220ms' }}>
            <TypingLine />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 fade-in-up" style={{ animationDelay: '300ms' }}>
            <Link
              href="/book-demo"
              className="inline-flex items-center gap-2 bg-[#25D366] text-[#0A1F10] font-bold text-base px-8 py-4 rounded-full hover:bg-[#1fba57] transition-all hover:-translate-y-0.5 shadow-[0_0_30px_rgba(37,211,102,0.25)]"
            >
              Book a demo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm text-white/40 hover:text-white/70 transition-colors underline underline-offset-4"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <Ticker />

      {/* ── LIVE DEMO ── */}
      <section className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-xs font-mono text-[#25D366]/60 tracking-[.16em] uppercase mb-4">Live conversation</p>
            <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.2rem)] tracking-tight text-white leading-tight">
              Watch it sell<br />
              <span className="text-white/30">while you do nothing.</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="reveal">
              <LiveChat />
            </div>
            <div className="reveal space-y-6" style={{ transitionDelay: '120ms' }}>
              <p className="text-white/60 text-base leading-relaxed">
                Your customer sends a message. ShopprHQ reads it, responds naturally, handles the cart, sends a payment link, and confirms the order — all before you've even looked at your phone.
              </p>
              <p className="text-white/60 text-base leading-relaxed">
                No menus. No buttons. Just a real conversation that ends in a completed sale.
              </p>
              <div className="pt-4 border-t border-white/8">
                <p className="text-xs font-mono text-white/25 uppercase tracking-widest mb-4">Works for</p>
                <div className="flex flex-wrap gap-2">
                  {['Food & restaurants', 'Fashion', 'Grocery', 'Pharmacy', 'Electronics', 'Beauty'].map(t => (
                    <span key={t} className="text-xs text-white/40 border border-white/10 px-3 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 px-5 border-y border-white/8 bg-[#0d1a11]">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/8 rounded-2xl overflow-hidden">
          {STATS.map((s) => (
            <div key={s.value} className="bg-[#0d1a11] px-6 py-8 text-center reveal">
              <p className="font-display font-extrabold text-[2.5rem] leading-none text-[#25D366] tracking-tight">{s.value}</p>
              <p className="text-xs text-white/30 font-mono mt-2 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY ── */}
      <section id="why" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-xs font-mono text-[#25D366]/60 tracking-[.16em] uppercase mb-4">Why ShopprHQ</p>
            <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.2rem)] tracking-tight text-white leading-tight">
              Not software.<br />
              <span className="text-white/30">A salesperson.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {WHY_CARDS.map((card, i) => (
              <div
                key={card.title}
                className="reveal group border border-white/8 rounded-2xl p-8 hover:border-[#25D366]/30 hover:bg-[#0d1a11] transition-all duration-300"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-[#25D366] mb-5 group-hover:border-[#25D366]/30 transition-colors">
                  {card.icon}
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="py-24 px-5 border-t border-white/8">
        <div className="max-w-2xl mx-auto text-center reveal">
          <h2 className="font-display font-extrabold text-[clamp(2.2rem,6vw,4rem)] tracking-tight text-white leading-[0.95] mb-6">
            Ready to stop<br />
            <span className="text-[#25D366]">missing sales?</span>
          </h2>
          <p className="text-white/40 text-base mb-10 max-w-sm mx-auto leading-relaxed">
            Book a 20-minute demo. We'll show you exactly how it works for your type of business.
          </p>
          <Link
            href="/book-demo"
            className="inline-flex items-center gap-2 bg-[#25D366] text-[#0A1F10] font-bold text-base px-10 py-4 rounded-full hover:bg-[#1fba57] transition-all hover:-translate-y-0.5 shadow-[0_0_40px_rgba(37,211,102,0.2)]"
          >
            Book a demo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p className="text-xs text-white/20 mt-5 font-mono">No payment required. We review every application.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/8 py-12 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display font-extrabold text-white text-lg tracking-tight">
              Shoppr<span className="text-[#25D366]">HQ</span>
            </p>
            <p className="text-xs text-white/20 mt-1 font-mono">WhatsApp commerce · Nigeria</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/25 font-mono">
            <Link href="/how-it-works" className="hover:text-white/50 transition-colors">How it works</Link>
            <Link href="/book-demo"    className="hover:text-white/50 transition-colors">Book a demo</Link>
            <a href="mailto:hello@shopprhq.com" className="hover:text-white/50 transition-colors">hello@shopprhq.com</a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-white/5">
          <p className="text-[11px] text-white/15 font-mono">© 2025 ShopprHQ</p>
        </div>
      </footer>
    </div>
  )
}
