'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

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

const STEPS = [
  {
    n: '01',
    title: 'Add your products',
    body: 'Build your catalogue — names, prices, descriptions, stock. Takes minutes. Your store is ready before your next order arrives.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Connect your WhatsApp',
    body: 'Your customers message your existing number — same as always. ShopprHQ takes over: reading orders, answering questions, collecting payments.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Watch orders come in',
    body: 'Every order appears live on your dashboard. Confirm, dispatch, track revenue — you stay in control of fulfilment, nothing else.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
]

const INCLUDED = [
  'Natural conversation — no rigid menus',
  'Automatic order confirmation messages',
  'Card & cash on delivery payments',
  'Real-time stock tracking',
  'Multiple branches, one dashboard',
  'Daily revenue summaries',
  'Zero missed orders — even at 3am',
  'No app download for your customers',
]

export default function HowItWorksPage() {
  useReveal()

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-5 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#25D366]/8 blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono text-[#25D366]/60 tracking-[.16em] uppercase mb-6 fade-in-up">How it works</p>
          <h1 className="font-display font-extrabold text-[clamp(2.5rem,7vw,5rem)] tracking-tight leading-[0.95] text-white mb-6 fade-in-up" style={{ animationDelay: '80ms' }}>
            Live in three steps.<br />
            <span className="text-white/25">Selling in four.</span>
          </h1>
          <p className="text-white/40 text-lg max-w-lg mx-auto leading-relaxed fade-in-up" style={{ animationDelay: '160ms' }}>
            No developers. No integrations. No waiting weeks.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 px-5">
        <div className="max-w-4xl mx-auto space-y-4">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="reveal group flex gap-6 border border-white/8 rounded-2xl p-8 hover:border-[#25D366]/20 hover:bg-[#0d1a11] transition-all duration-300"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="shrink-0">
                <div className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-[#25D366] group-hover:border-[#25D366]/30 transition-colors">
                  {step.icon}
                </div>
              </div>
              <div className="pt-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-xs text-white/20">{step.n}</span>
                  <h3 className="font-display font-bold text-xl text-white">{step.title}</h3>
                </div>
                <p className="text-white/40 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Video */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto reveal">
          <p className="text-xs font-mono text-[#25D366]/60 tracking-[.16em] uppercase mb-6 text-center">See it in action</p>
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-[#0d1a11]">
            {/* YouTube embed — replace VIDEO_ID with actual ID when ready */}
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/VIDEO_ID?rel=0&modestbranding=1&color=white"
              title="ShopprHQ demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {/* Placeholder overlay shown when no video ID */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1a11] pointer-events-none"
              style={{ display: 'none' }} /* remove this div once VIDEO_ID is set */ >
              <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-xs text-white/20 font-mono">Video coming soon</p>
            </div>
          </div>

          {/* Placeholder card shown until video is live */}
          <div className="mt-4 relative aspect-video rounded-2xl overflow-hidden border border-white/8 bg-[#0d1a11] flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-[#25D366]/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#25D366]/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-sm text-white/30 font-mono">Demo video dropping soon</p>
          </div>
        </div>
      </section>

      {/* Included */}
      <section className="py-16 px-5 border-t border-white/8">
        <div className="max-w-3xl mx-auto reveal">
          <p className="text-xs font-mono text-[#25D366]/60 tracking-[.16em] uppercase mb-8 text-center">Everything included</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {INCLUDED.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-white/50">
                <svg className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16">
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-5 text-center">
        <div className="max-w-xl mx-auto reveal">
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.5rem)] tracking-tight text-white leading-[0.95] mb-6">
            Seen enough?
          </h2>
          <p className="text-white/40 mb-10">Book a 20-minute demo and we'll walk you through it live.</p>
          <Link
            href="/book-demo"
            className="inline-flex items-center gap-2 bg-[#25D366] text-[#0A1F10] font-bold text-base px-10 py-4 rounded-full hover:bg-[#1fba57] transition-all hover:-translate-y-0.5 shadow-[0_0_40px_rgba(37,211,102,0.2)]"
          >
            Book a demo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-display font-extrabold text-white tracking-tight">
            Shoppr<span className="text-[#25D366]">HQ</span>
          </p>
          <div className="flex gap-6 text-xs text-white/25 font-mono">
            <Link href="/" className="hover:text-white/50 transition-colors">Home</Link>
            <Link href="/book-demo" className="hover:text-white/50 transition-colors">Book a demo</Link>
            <a href="mailto:hello@shopprhq.com" className="hover:text-white/50 transition-colors">hello@shopprhq.com</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
