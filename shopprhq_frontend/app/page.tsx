'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import DoodleBackground from '@/components/DoodleBackground'

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

/* ── Rotating hero word ── */
const ROTATING_WORDS = [
  'employee',
  'sales tool',
  'assistant',
  'closer',
  'order-taker',
  'best hire',
]

function RotatingWord() {
  const [wordIdx, setWordIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing')

  useEffect(() => {
    const word = ROTATING_WORDS[wordIdx]
    let t: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      if (displayed.length < word.length) {
        t = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 55)
      } else {
        t = setTimeout(() => setPhase('pause'), 1800)
      }
    } else if (phase === 'pause') {
      t = setTimeout(() => setPhase('erasing'), 400)
    } else {
      if (displayed.length > 0) {
        t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30)
      } else {
        setWordIdx((i) => (i + 1) % ROTATING_WORDS.length)
        setPhase('typing')
      }
    }
    return () => clearTimeout(t)
  }, [displayed, phase, wordIdx])

  return (
    <span className="text-wa">
      {displayed}
      <span className="cursor-blink">|</span>
    </span>
  )
}

/* ── Hand-drawn circle CTA ── */
function ScribbleCTA() {
  return (
    <Link href="/get-started" className="group inline-block relative">
      <span className="relative z-10 font-bold text-base text-ink group-hover:text-wa transition-colors px-6 py-3 inline-block">
        Get started for free →
      </span>
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 160 46"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M8,23 C8,8 22,4 80,4 C138,4 152,8 152,23 C152,38 138,42 80,42 C22,42 8,38 8,23 Z"
          stroke="#25D366"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: 310,
            strokeDashoffset: 310,
            animation: 'drawCircle 0.9s ease forwards 0.4s',
          }}
        />
      </svg>
    </Link>
  )
}

/* ── Girl illustration ── */
function GirlIllustration() {
  return (
    <svg
      viewBox="0 0 280 310"
      fill="none"
      stroke="#0D0D0C"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full max-w-[320px]"
      aria-hidden="true"
    >
      {/* Hair behind head */}
      <path d="M112,55 C106,38 116,22 140,20 C164,22 174,38 168,55" />
      <path d="M168,26 C176,18 184,26 176,38" />
      <path d="M112,26 C104,18 96,26 104,38" />
      {/* Ponytail */}
      <path d="M168,30 C188,28 192,44 182,52" />
      <path d="M182,52 C178,62 172,60 168,55" />

      {/* Head */}
      <ellipse cx="140" cy="58" rx="28" ry="30" />

      {/* Eyebrows */}
      <path d="M125,46 Q129,43 134,46" strokeWidth="1.6" />
      <path d="M146,46 Q151,43 155,46" strokeWidth="1.6" />

      {/* Eyes */}
      <ellipse cx="129" cy="54" rx="4" ry="4.5" />
      <ellipse cx="151" cy="54" rx="4" ry="4.5" />
      <circle cx="129" cy="54" r="2.5" fill="#0D0D0C" stroke="none" />
      <circle cx="151" cy="54" r="2.5" fill="#0D0D0C" stroke="none" />
      <circle cx="130" cy="52.5" r="1" fill="white" stroke="none" />
      <circle cx="152" cy="52.5" r="1" fill="white" stroke="none" />

      {/* Nose */}
      <path d="M138,62 C139,65 141,65 142,62" strokeWidth="1.2" />

      {/* Smile */}
      <path d="M129,72 C133,78 147,78 151,72" />

      {/* Cheek blush */}
      <ellipse cx="120" cy="68" rx="7" ry="4" strokeWidth="0.7" opacity="0.35" />
      <ellipse cx="160" cy="68" rx="7" ry="4" strokeWidth="0.7" opacity="0.35" />

      {/* Neck */}
      <path d="M133,88 L133,100" />
      <path d="M147,88 L147,100" />

      {/* Collar */}
      <path d="M133,100 C136,106 144,106 147,100" />

      {/* Body - blouse/dress top */}
      <path d="M95,105 L82,192 L198,192 L185,105 C174,97 106,97 95,105 Z" />
      {/* Blouse detail */}
      <path d="M118,118 C130,114 150,114 162,118" strokeWidth="1" />
      <line x1="140" y1="100" x2="140" y2="192" strokeWidth="0.8" strokeDasharray="4 3" />

      {/* Left arm extended forward */}
      <path d="M95,118 C76,128 64,148 66,170" />
      <path d="M66,170 C65,178 70,184 78,186" />

      {/* Right arm extended forward */}
      <path d="M185,118 C204,128 216,148 214,170" />
      <path d="M214,170 C215,178 210,184 202,186" />

      {/* Phone held in hands - facing viewer */}
      <rect x="74" y="178" width="132" height="76" rx="10" strokeWidth="2" />
      {/* Phone inner screen */}
      <rect x="78" y="181" width="124" height="70" rx="7" />

      {/* WA header bar */}
      <rect x="78" y="181" width="124" height="18" rx="7" fill="#075E54" stroke="none" />
      {/* Avatar circle */}
      <circle cx="92" cy="190" r="6" fill="#25D366" stroke="none" />
      {/* Name text placeholder */}
      <rect x="102" y="186" width="44" height="4" rx="2" fill="rgba(255,255,255,0.75)" stroke="none" />
      <rect x="102" y="192" width="28" height="2.5" rx="1" fill="rgba(255,255,255,0.4)" stroke="none" />

      {/* Chat bubbles on screen */}
      {/* Customer bubble right */}
      <rect x="138" y="203" width="58" height="10" rx="5" fill="#DCF8C6" stroke="none" />
      <rect x="142" y="206" width="45" height="3" rx="1.5" fill="#9DB" stroke="none" />

      {/* Bot bubble left */}
      <rect x="82" y="217" width="78" height="18" rx="5" fill="white" stroke="#E2E2E2" strokeWidth="0.8" />
      <rect x="87" y="221" width="55" height="3" rx="1.5" fill="#CCC" stroke="none" />
      <rect x="87" y="226" width="45" height="3" rx="1.5" fill="#CCC" stroke="none" />
      <rect x="87" y="231" width="35" height="3" rx="1.5" fill="#CCC" stroke="none" />

      {/* Customer again */}
      <rect x="148" y="239" width="48" height="8" rx="4" fill="#DCF8C6" stroke="none" />
      <rect x="152" y="242" width="35" height="3" rx="1.5" fill="#9DB" stroke="none" />

      {/* Sitting legs */}
      <path d="M108,192 C96,205 78,214 62,218" />
      <path d="M172,192 C184,205 202,214 218,218" />
      {/* Feet */}
      <path d="M62,218 C56,224 60,230 70,228" />
      <path d="M218,218 C224,224 220,230 210,228" />

      {/* Motion sparkles around phone */}
      <path d="M234,185 L237,178 L240,185 L237,192 Z" strokeWidth="1.2" />
      <path d="M40,185 L37,178 L34,185 L37,192 Z" strokeWidth="1.2" />
      <circle cx="238" cy="165" r="2" strokeWidth="1" />
      <circle cx="42" cy="165" r="2" strokeWidth="1" />

      {/* Small stars near head */}
      <path d="M72,40 L74,35 L76,40 L74,45 Z" strokeWidth="1" />
      <path d="M205,32 L207,27 L209,32 L207,37 Z" strokeWidth="1" />
      <circle cx="68" cy="58" r="2" strokeWidth="1" />
      <circle cx="212" cy="52" r="1.5" strokeWidth="1" />
    </svg>
  )
}

/* ── Realistic phone mockup ── */
type Screen = 'catalog' | 'order' | 'payment'

function PhoneMockup({ screen }: { screen: Screen }) {
  const SCREENS = {
    catalog: {
      contact: 'Zara Fashion Hub',
      initials: 'ZF',
      messages: [
        { from: 'customer', text: 'Hi! What clothes do you have available?' },
        { from: 'bot', text: '👗 Here\'s our current collection:\n\n*Tops*\n• Ankara crop top — ₦8,500\n• Linen blouse — ₦12,000\n• Bodysuit (S-XL) — ₦7,200\n\n*Bottoms*\n• Wide-leg trousers — ₦14,500\n• Midi skirt — ₦11,000\n• Denim shorts — ₦9,800\n\nWhat catches your eye? 👀' },
        { from: 'customer', text: 'The midi skirt — do you have it in green?' },
      ],
    },
    order: {
      contact: 'Mama Tee Foods',
      initials: 'MT',
      messages: [
        { from: 'customer', text: '2 jollof rice, 1 fried rice and suya' },
        { from: 'bot', text: '✅ Got it! Here\'s your order:\n\n2× Jollof Rice — ₦5,000\n1× Fried Rice — ₦2,800\n1× Suya platter — ₦3,500\n─────────────\nTotal: ₦11,300\n\nDeliver or pickup? 📍' },
        { from: 'customer', text: 'Deliver to Lekki Phase 1' },
        { from: 'bot', text: '📦 Delivery to Lekki Phase 1\nEstimated: 35–45 mins\n\nPay by card or cash?' },
      ],
    },
    payment: {
      contact: 'Mama Tee Foods',
      initials: 'MT',
      messages: [
        { from: 'customer', text: 'Card please' },
        { from: 'bot', text: '💳 Tap to pay securely:\n\nhttps://pay.shopprhq.com/mt8x2\n\nOrder #2841 · ₦11,300' },
        { from: 'bot', text: '🎉 Payment confirmed!\n\nYour order is being prepared. You\'ll get a message when it\'s on the way.\n\nThank you for ordering from Mama Tee Foods! 🍽️' },
      ],
    },
  }

  const data = SCREENS[screen]

  return (
    <div className="mx-auto relative" style={{ width: 200 }}>
      {/* Phone shell */}
      <div className="rounded-[28px] bg-[#1a1a1a] p-[6px] shadow-xl">
        {/* Screen */}
        <div className="rounded-[22px] overflow-hidden bg-[#0d1b0f]">
          {/* Status bar */}
          <div className="bg-[#0d1b0f] px-3 pt-2 pb-1 flex justify-between items-center">
            <span className="text-white text-[8px] font-medium">9:41</span>
            <div className="w-12 h-2 bg-[#333] rounded-full" />
            <div className="flex gap-1 items-center">
              <div className="w-3 h-1.5 border border-white/40 rounded-sm">
                <div className="w-2/3 h-full bg-white/60 rounded-sm" />
              </div>
            </div>
          </div>
          {/* WA header */}
          <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2">
            <div className="text-[#25D366] text-[8px]">←</div>
            <div className="w-6 h-6 rounded-full bg-[#25D366]/40 flex items-center justify-center text-[7px] font-bold text-[#25D366]">
              {data.initials}
            </div>
            <div>
              <p className="text-white text-[9px] font-semibold leading-none">{data.contact}</p>
              <p className="text-green-300 text-[7px] mt-0.5">online</p>
            </div>
          </div>
          {/* Messages */}
          <div className="bg-[#0d1b0f] p-2 space-y-1.5 min-h-[200px]">
            {data.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className={[
                  'max-w-[85%] px-2 py-1.5 text-[8px] leading-relaxed whitespace-pre-line rounded-lg',
                  msg.from === 'customer'
                    ? 'bg-[#1a5c2e] text-white/90 rounded-br-none'
                    : 'bg-[#1e2e20] text-white/80 rounded-bl-none border border-white/5',
                ].join(' ')}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          {/* Input bar */}
          <div className="bg-[#111] px-2 py-1.5 flex items-center gap-1.5">
            <div className="flex-1 bg-[#1e1e1e] rounded-full px-2 py-1 text-[7px] text-white/20">Message</div>
            <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[8px]">↑</div>
          </div>
        </div>
      </div>
      {/* Home indicator */}
      <div className="mt-1.5 flex justify-center">
        <div className="w-16 h-0.5 bg-black/20 rounded-full" />
      </div>
    </div>
  )
}

/* ── Industries ── */
const INDUSTRIES = [
  'Food & Restaurants', 'Fashion Boutiques', 'Pharmacies', 'Electronics Stores',
  'Hair Salons', 'Bakeries', 'Supermarkets', 'Grocery Stores', 'Caterers',
  'Pet Shops', 'Laundry Services', 'Tailors', 'Stationery Shops', 'Furniture Stores',
  'Cosmetics & Beauty', 'Sportswear', 'Auto Parts', 'Printing Services', 'Bookstores',
  'Meat & Fish Sellers', 'Confectionery', 'Mobile Accessories', 'Skincare Brands',
]

/* ── Why cards ── */
const WHY_CARDS = [
  {
    emoji: '🌙',
    title: 'Always on',
    body: 'Takes orders at 2am, on public holidays, while you sleep. It never clocks out.',
  },
  {
    emoji: '💬',
    title: 'Handles the repetition',
    body: '"How much?" "Do you have this in blue?" "What\'s your delivery fee?" — answered instantly, every time.',
  },
  {
    emoji: '💳',
    title: 'Collects payment',
    body: 'Sends a payment link in the chat. Customer pays by card, order confirmed automatically. No account numbers.',
  },
  {
    emoji: '📊',
    title: 'One dashboard',
    body: 'Every order, every branch, every naira — visible in real time. No spreadsheets.',
  },
  {
    emoji: '⚡',
    title: 'Concurrent carts',
    body: 'Handles 50 customers at the same time, each in their own conversation. No queue, no waiting.',
  },
  {
    emoji: '🔤',
    title: 'Understands typos',
    body: '"jelo rice", "tomatoe stew", "chiken" — it figures out what they mean and keeps the order moving.',
  },
  {
    emoji: '🛍️',
    title: 'Cross-sells naturally',
    body: 'Orders jollof rice? It asks if they want a drink with that. Buys a dress? It mentions the matching bag.',
  },
  {
    emoji: '🚚',
    title: 'Delivery toggle',
    body: 'Switch delivery on or off per store, any time. You control the radius, fee, and availability from the dashboard.',
  },
  {
    emoji: '📦',
    title: 'Smart inventory',
    body: 'Tracks what\'s in stock as orders come in. You get notified when items run low — before customers ask for something you don\'t have.',
  },
  {
    emoji: '🗂️',
    title: 'Catalog management',
    body: 'Add items, update prices, hide sold-out products — all from the dashboard. Changes go live on WhatsApp instantly.',
  },
  {
    emoji: '🏪',
    title: 'Multi-branch support',
    body: 'Each branch gets its own WhatsApp number, its own catalog, and its own order stream — all under one account.',
  },
  {
    emoji: '📋',
    title: 'Order history',
    body: 'Every order is logged with the customer\'s name, number, and what they bought. Repeat orders take seconds.',
  },
]

/* ── Stats ── */
const STATS = [
  { value: '₦0',   label: 'Setup fee' },
  { value: '60s',  label: 'To go live' },
  { value: '24/7', label: 'active time' },
  { value: '<1%',  label: 'charge per transaction' },
]

/* ── Page ── */
export default function HomePage() {
  useReveal()

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <DoodleBackground />
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 px-5 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

            {/* Left: text */}
            <div className="fade-in-up">
              <h1 className="font-display font-extrabold text-[clamp(2.4rem,5.5vw,4.2rem)] tracking-tight leading-[1.0] text-ink mb-5">
                The <RotatingWord /><br />
                that pays you.
              </h1>

              <p className="text-ink-3 text-lg max-w-md mb-8 leading-relaxed">
                From the first hello to completed sale. 
              </p>

              <ScribbleCTA />
              <p className="text-xs text-ink-4 mt-4 font-mono">No setup fee. We get paid when you do.</p>
            </div>

            {/* Right: illustration */}
            <div className="flex flex-col items-center fade-in-up" style={{ animationDelay: '180ms' }}>
              <GirlIllustration />
            </div>

          </div>
        </div>
      </section>

      {/* ── IN ACTION ── */}
      <section className="py-24 px-5 bg-bg border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 reveal">
            <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-3">See it in action</p>
            <h2 className="font-display font-extrabold text-[clamp(1.8rem,4vw,3rem)] tracking-tight text-ink leading-tight max-w-lg">
              Handle every conversation regardless of grammar issues.<br />
              <span className="text-ink-3">with ShopprHQ.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="reveal text-center" style={{ transitionDelay: '0ms' }}>
              <PhoneMockup screen="catalog" />
              <p className="mt-5 font-semibold text-sm text-ink">Catalog browsing</p>
              <p className="text-xs text-ink-3 mt-1 max-w-[160px] mx-auto">Customer asks, bot sends your full product list instantly</p>
            </div>
            <div className="reveal text-center" style={{ transitionDelay: '100ms' }}>
              <PhoneMockup screen="order" />
              <p className="mt-5 font-semibold text-sm text-ink">Order & delivery</p>
              <p className="text-xs text-ink-3 mt-1 max-w-[160px] mx-auto">Builds the cart, confirms the total, arranges delivery</p>
            </div>
            <div className="reveal text-center" style={{ transitionDelay: '200ms' }}>
              <PhoneMockup screen="payment" />
              <p className="mt-5 font-semibold text-sm text-ink">Payment & confirmation</p>
              <p className="text-xs text-ink-3 mt-1 max-w-[160px] mx-auto">Sends a payment link, confirms when it lands. Done.</p>
            </div>
          </div>

          <div className="mt-14 reveal">
            <div className="pt-10 border-t border-border overflow-hidden -mx-5 px-5">
              <p className="text-xs font-mono text-ink-4 uppercase tracking-widest mb-5">Works for</p>
              <div className="relative overflow-hidden">
                <div className="animate-marquee-slow">
                  {[...INDUSTRIES, ...INDUSTRIES].map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-3 mx-4 text-sm font-medium text-ink-3 whitespace-nowrap">
                      <span className="w-1 h-1 rounded-full bg-wa inline-block" />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 px-5 border-b border-border bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden">
            {STATS.map((s) => (
              <div key={s.value} className="bg-white px-6 py-8 text-center reveal">
                <p className="font-display font-extrabold text-[2.6rem] leading-none text-ink tracking-tight">{s.value}</p>
                <p className="text-xs text-ink-3 font-mono mt-2 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-base font-bold text-ink mt-6">
            We only get paid when you do.
          </p>
          <p className="text-center text-xs text-ink-3 mt-1">Zero setup. No monthly fee. Just a small cut of each transaction.</p>
        </div>
      </section>

      {/* ── WHY ── */}
      <section id="why" className="py-24 px-5 bg-bg">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 reveal">
            <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-3">What it does</p>
            <h2 className="font-display font-extrabold text-[clamp(1.8rem,4vw,3rem)] tracking-tight text-ink leading-tight">
              More than just a software.<br />
              <span className="text-ink-3">A full-time salesperson.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_CARDS.map((card, i) => (
              <div
                key={card.title}
                className="reveal group border border-border rounded-2xl p-6 hover:border-wa/40 hover:bg-white transition-all duration-300 bg-white/60"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <div className="text-2xl mb-4">{card.emoji}</div>
                <h3 className="font-display font-bold text-base text-ink mb-2">{card.title}</h3>
                <p className="text-sm text-ink-3 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="py-24 px-5 border-t border-border bg-white">
        <div className="max-w-2xl mx-auto text-center reveal">
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.5rem)] tracking-tight text-ink leading-[1.0] mb-6">
            Ready to stop<br />
            <span className="text-wa">missing sales?</span>
          </h2>
          <p className="text-ink-3 text-base mb-10 max-w-sm mx-auto leading-relaxed">
            Book a 20-minute demo. We'll show you exactly how it works for your type of business.
          </p>
          <div className="flex justify-center">
            <ScribbleCTA />
          </div>
          <p className="text-xs text-ink-4 mt-5 font-mono">Zero setup fee · less than 1% charge per transaction · we only get paid when you do</p>
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
            <Link href="/how-it-works" className="hover:text-ink transition-colors">How it works</Link>
            <Link href="/get-started"    className="hover:text-ink transition-colors">Get started for free</Link>
            <a href="mailto:hello@shopprhq.com" className="hover:text-ink transition-colors">hello@shopprhq.com</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-border">
          <p className="text-[11px] text-ink-4 font-mono">© 2026 ShopprHQ</p>
        </div>
      </footer>
    </div>
  )
}
