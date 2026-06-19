'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import DoodleBackground from '@/components/DoodleBackground'

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver(
      (e) => e.forEach((x) => x.isIntersecting && x.target.classList.add('visible')),
      { threshold: 0.1 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/* ── Industry scroll ── */
const INDUSTRIES = [
  'Food & Restaurants', 'Fashion Boutiques', 'Pharmacies', 'Electronics Stores',
  'Hair Salons', 'Bakeries', 'Supermarkets', 'Grocery Stores', 'Caterers',
  'Pet Shops', 'Laundry Services', 'Tailors', 'Stationery Shops', 'Furniture Stores',
  'Cosmetics & Beauty', 'Sportswear', 'Auto Parts', 'Printing Services', 'Bookstores',
  'Meat & Fish Sellers', 'Confectionery', 'Mobile Accessories', 'Skincare Brands',
]

/* ── Live chat simulation ── */
const CHAT = [
  { from: 'customer', text: 'Hi, do you have chicken suya?' },
  { from: 'bot',      text: 'Yes! 👋 We have suya platters available today.\n\nSmall — ₦2,500\nLarge — ₦4,500\n\nWhich one?' },
  { from: 'customer', text: 'Large one. And do you deliver to Ikeja?' },
  { from: 'bot',      text: 'Yes, we deliver to Ikeja!\n\nDelivery fee: ₦600\nTotal: ₦5,100\n\nCash or card?' },
  { from: 'customer', text: 'Card' },
  { from: 'bot',      text: '💳 Pay here:\npay.shopprhq.com/su4k2\n\nOrder confirmed once payment lands 🎉' },
  { from: 'customer', text: 'Done! How long?' },
  { from: 'bot',      text: 'Payment received ✅\n\nYour suya platter is being prepared. Estimated delivery: 30–40 mins.\n\nWe\'ll message you when it\'s on the way!' },
]

function LivePhone() {
  const [visible, setVisible] = useState<number[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        CHAT.forEach((_, i) => setTimeout(() => setVisible(v => [...v, i]), i * 1200))
      }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ width: 220 }} className="mx-auto relative z-10">
      <div className="rounded-[32px] bg-[#1a1a1a] p-[7px] shadow-2xl">
        <div className="rounded-[26px] overflow-hidden bg-[#0d1b0f]">
          {/* Status bar */}
          <div className="bg-[#0d1b0f] px-4 pt-2.5 pb-1 flex justify-between items-center">
            <span className="text-white text-[8px] font-medium">9:41</span>
            <div className="w-14 h-2.5 bg-[#333] rounded-full" />
            <span className="text-white text-[8px]">●●●</span>
          </div>
          {/* WA header */}
          <div className="bg-[#075E54] px-3 py-2.5 flex items-center gap-2.5">
            <span className="text-white/70 text-[10px]">←</span>
            <div className="w-7 h-7 rounded-full bg-[#25D366]/40 flex items-center justify-center text-[8px] font-bold text-[#25D366]">SK</div>
            <div>
              <p className="text-white text-[10px] font-semibold leading-none">Spice Kitchen</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <p className="text-green-300 text-[8px]">online</p>
              </div>
            </div>
          </div>
          {/* Chat */}
          <div className="bg-[#0d1b0f] p-2.5 space-y-2 min-h-[340px] max-h-[340px] overflow-hidden">
            {CHAT.map((msg, i) =>
              visible.includes(i) ? (
                <div key={i} className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}
                  style={{ animation: 'msgIn .3s ease both' }}>
                  <div className={[
                    'max-w-[88%] px-2.5 py-1.5 rounded-xl text-[8.5px] leading-relaxed whitespace-pre-line',
                    msg.from === 'customer'
                      ? 'bg-[#1a5c2e] text-white/90 rounded-br-none'
                      : 'bg-[#1e2e20] text-white/80 rounded-bl-none border border-white/5',
                  ].join(' ')}>
                    {msg.text}
                    <span className="block text-right text-[6px] text-white/25 mt-0.5">
                      {msg.from === 'bot' ? '✓✓' : ''}
                    </span>
                  </div>
                </div>
              ) : null
            )}
          </div>
          {/* Input */}
          <div className="bg-[#111] px-2.5 py-2 flex items-center gap-2">
            <div className="flex-1 bg-[#1e1e1e] rounded-full px-3 py-1.5 text-[8px] text-white/20">Message</div>
            <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[10px]">↑</div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <div className="w-16 h-1 bg-black/15 rounded-full" />
      </div>
    </div>
  )
}

/* ── Screenshot cards scattered around phone ── */
function ScreenshotCard({
  title, lines, rotate, className,
}: { title: string; lines: string[]; rotate: number; className?: string }) {
  return (
    <div
      className={`bg-white border border-border rounded-xl shadow-lg p-3.5 w-48 ${className ?? ''}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-[#25D366]" />
        <span className="text-[10px] font-semibold text-ink">{title}</span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p key={i} className="text-[10px] text-ink-3 leading-snug">{line}</p>
        ))}
      </div>
    </div>
  )
}

/* ── Steps ── */
const STEPS = [
  {
    n: '01',
    title: 'Add your products',
    body: 'Build your catalogue — names, prices, descriptions, stock. Takes minutes. Your store is ready before your next order arrives.',
    detail: 'No technical knowledge needed. If you can fill a spreadsheet, you can set up ShopprHQ.',
  },
  {
    n: '02',
    title: 'Connect your WhatsApp',
    body: 'Your customers message your existing number — same as always. ShopprHQ takes over: reading orders, answering questions, collecting payments.',
    detail: 'Works on the WhatsApp Business API. Your number, your brand. Customers don\'t notice anything different.',
  },
  {
    n: '03',
    title: 'Watch orders come in',
    body: 'Every order appears live on your dashboard. Confirm, dispatch, track revenue — you stay in control of fulfilment, nothing else.',
    detail: 'You get notified for every order. Inventory updates automatically. Revenue summary hits your dashboard daily.',
  },
]

const INCLUDED = [
  'Natural conversation — no rigid menus or button flows',
  'Automatic order confirmation and delivery updates',
  'Card & cash on delivery payments',
  'Real-time stock tracking with low-stock alerts',
  'Multiple branches, one dashboard',
  'Daily revenue summaries',
  'Zero missed orders — even at 3am',
  'No app download required for your customers',
  'Typo and spelling correction — understands "jelo rice"',
  'Cross-selling built in — it suggests add-ons naturally',
  'Concurrent customer conversations, no queue',
  'Delivery toggle — on/off per store, any time',
]

/* ── ScribbleCTA (copied from home page) ── */
function ScribbleCTA() {
  return (
    <Link href="/book-demo" className="group inline-block relative">
      <span className="relative z-10 font-bold text-base text-ink group-hover:text-wa transition-colors px-6 py-3 inline-block">
        Book a demo →
      </span>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 46" fill="none" preserveAspectRatio="none">
        <path
          d="M8,23 C8,8 22,4 80,4 C138,4 152,8 152,23 C152,38 138,42 80,42 C22,42 8,38 8,23 Z"
          stroke="#25D366" strokeWidth="2.2" strokeLinecap="round" fill="none"
          style={{ strokeDasharray: 310, strokeDashoffset: 310, animation: 'drawCircle 0.9s ease forwards 0.4s' }}
        />
      </svg>
    </Link>
  )
}

export default function HowItWorksPage() {
  useReveal()

  return (
    <div className="min-h-screen bg-white">
      <DoodleBackground />
      <Navbar />

      {/* ── HERO ── */}
      <section className="pt-32 pb-16 px-5">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-4 fade-in-up">How it works</p>
          <h1 className="font-display font-extrabold text-[clamp(2.4rem,5.5vw,4.2rem)] tracking-tight leading-[1.0] text-ink mb-5 fade-in-up" style={{ animationDelay: '80ms' }}>
            Live in three steps.<br />
            <span className="text-ink-3">Selling in four.</span>
          </h1>
          <p className="text-ink-3 text-lg max-w-md leading-relaxed fade-in-up" style={{ animationDelay: '160ms' }}>
            No developers. No integrations. No waiting weeks.
          </p>
        </div>
      </section>

      {/* ── INDUSTRY SCROLL ── */}
      <div className="border-y border-border py-3 bg-bg overflow-hidden">
        <div className="animate-marquee-slow">
          {[...INDUSTRIES, ...INDUSTRIES].map((name, i) => (
            <span key={i} className="inline-flex items-center gap-3 mx-5 text-sm font-medium text-ink-3 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-wa inline-block flex-shrink-0" />
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* ── PHONE + SCREENSHOTS ── */}
      <section className="py-24 px-5 bg-bg border-b border-border overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-3 reveal">See it in action</p>
            <h2 className="font-display font-extrabold text-[clamp(1.8rem,4vw,3rem)] tracking-tight text-ink leading-tight reveal">
              Every conversation.<br />
              <span className="text-ink-3">Fully automatic.</span>
            </h2>
          </div>

          {/* Desktop: phone centre, screenshots left and right */}
          <div className="relative flex items-start justify-center gap-0">

            {/* Left screenshots */}
            <div className="hidden lg:flex flex-col gap-8 pt-16 mr-[-24px] z-0">
              <div className="reveal" style={{ transitionDelay: '100ms' }}>
                <ScreenshotCard
                  rotate={-4}
                  title="Order received"
                  lines={[
                    '📦 New order #2841',
                    'Spice Kitchen · Ikeja',
                    '',
                    'Large suya platter × 1',
                    'Delivery fee: ₦600',
                    '─────────────',
                    'Total: ₦5,100 ✓ Paid',
                  ]}
                />
              </div>
              <div className="reveal ml-8" style={{ transitionDelay: '200ms' }}>
                <ScreenshotCard
                  rotate={3}
                  title="Inventory alert"
                  lines={[
                    '⚠️ Low stock',
                    '',
                    'Chicken suya — 3 left',
                    'Beef suya — out of stock',
                    '',
                    'Update your catalog to',
                    'hide sold-out items.',
                  ]}
                />
              </div>
            </div>

            {/* Phone centre */}
            <div className="relative z-10">
              <LivePhone />
            </div>

            {/* Right screenshots */}
            <div className="hidden lg:flex flex-col gap-8 pt-8 ml-[-24px] z-0">
              <div className="reveal ml-6" style={{ transitionDelay: '150ms' }}>
                <ScreenshotCard
                  rotate={5}
                  title="Catalog view"
                  lines={[
                    'Spice Kitchen Menu',
                    '',
                    '• Suya (small) ₦2,500',
                    '• Suya (large) ₦4,500',
                    '• Pepper soup  ₦3,200',
                    '• Asun platter ₦5,000',
                    '',
                    '4 items · 2 in stock',
                  ]}
                />
              </div>
              <div className="reveal" style={{ transitionDelay: '250ms' }}>
                <ScreenshotCard
                  rotate={-3}
                  title="Today's revenue"
                  lines={[
                    'Thursday · Spice Kitchen',
                    '',
                    'Orders today:    12',
                    'Revenue today: ₦46,800',
                    'Avg. order:    ₦3,900',
                    '',
                    '↑ 23% vs yesterday',
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Mobile: screenshots below phone */}
          <div className="mt-10 grid grid-cols-2 gap-4 lg:hidden">
            <ScreenshotCard rotate={-2} title="Order received" lines={['📦 Order #2841', 'Total: ₦5,100 ✓ Paid']} />
            <ScreenshotCard rotate={2} title="Today's revenue" lines={['Orders: 12', 'Revenue: ₦46,800']} />
          </div>
        </div>
      </section>

      {/* ── STEPS ── */}
      <section className="py-24 px-5 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-3 reveal">The process</p>
            <h2 className="font-display font-extrabold text-[clamp(1.8rem,4vw,3rem)] tracking-tight text-ink leading-tight reveal">
              Three steps to live.
            </h2>
          </div>

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                className="reveal grid lg:grid-cols-[72px_1fr_1fr] gap-6 lg:gap-12 border border-border rounded-2xl p-8 bg-white hover:border-wa/30 hover:bg-bg transition-all duration-300"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0">
                  <span className="font-mono text-3xl font-extrabold text-wa leading-none">{step.n}</span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-ink mb-3">{step.title}</h3>
                  <p className="text-ink-3 leading-relaxed">{step.body}</p>
                </div>
                <div className="border-l border-border pl-6 hidden lg:block">
                  <p className="text-sm text-ink-4 leading-relaxed italic">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INCLUDED ── */}
      <section className="py-24 px-5 bg-bg border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-3 reveal">What's included</p>
            <h2 className="font-display font-extrabold text-[clamp(1.8rem,4vw,3rem)] tracking-tight text-ink leading-tight reveal">
              Everything. Out of the box.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 reveal">
            {INCLUDED.map((item) => (
              <div key={item} className="flex items-start gap-3 bg-white border border-border rounded-xl px-5 py-4">
                <svg className="w-4 h-4 text-wa shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16">
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm text-ink-2 leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-5 border-t border-border bg-white">
        <div className="max-w-6xl mx-auto reveal">
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.5rem)] tracking-tight text-ink leading-[1.0] mb-5">
            Seen enough?
          </h2>
          <p className="text-ink-3 text-base mb-8 max-w-sm leading-relaxed">
            Book a 20-minute demo. We'll walk you through it live with your own type of business.
          </p>
          <ScribbleCTA />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-12 px-5 bg-bg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display font-extrabold text-ink text-lg tracking-tight">
              Shoppr<span className="text-wa">HQ</span>
            </p>
            <p className="text-xs text-ink-4 mt-1 font-mono">WhatsApp commerce · Nigeria</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-3 font-mono">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <Link href="/book-demo" className="hover:text-ink transition-colors">Book a demo</Link>
            <a href="mailto:hello@shopprhq.com" className="hover:text-ink transition-colors">hello@shopprhq.com</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-border">
          <p className="text-[11px] text-ink-4 font-mono">© 2025 ShopprHQ</p>
        </div>
      </footer>
    </div>
  )
}
