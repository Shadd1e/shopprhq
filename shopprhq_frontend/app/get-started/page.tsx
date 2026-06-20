'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import DoodleBackground from '@/components/DoodleBackground'
import { submitMerchantApplication } from '@/lib/api'

const BUSINESS_TYPES = [
  'Food & Restaurant', 'Fashion & Clothing', 'Pharmacy', 'Electronics',
  'Hair & Beauty', 'Bakery & Confectionery', 'Supermarket & Grocery',
  'Catering', 'Laundry', 'Tailoring', 'Stationery', 'Furniture & Home',
  'Sportswear', 'Auto Parts', 'Printing', 'Books & Education',
  'Skincare & Cosmetics', 'Pet Supplies', 'Mobile Accessories', 'Other',
]

const VOLUMES = [
  'Less than 20 orders/month',
  '20 – 50 orders/month',
  '50 – 200 orders/month',
  '200 – 500 orders/month',
  'More than 500 orders/month',
]

const SOURCES = [
  'Instagram', 'Twitter / X', 'Facebook', 'WhatsApp',
  'Google', 'A friend or colleague', 'An event or workshop', 'Other',
]

type Field =
  | 'full_name' | 'business_name' | 'business_type' | 'city_state'
  | 'email' | 'phone_number' | 'num_branches' | 'monthly_order_volume'
  | 'uses_whatsapp_manual' | 'uses_delivery_service' | 'heard_about_us' | 'comments'

type FormState = Record<Field, string> & { website: string }

const EMPTY: FormState = {
  full_name: '', business_name: '', business_type: '', city_state: '',
  email: '', phone_number: '', num_branches: '1', monthly_order_volume: '',
  uses_whatsapp_manual: '', uses_delivery_service: '', heard_about_us: '',
  comments: '', website: '',
}

/* ── WhatsApp confirmation preview ── */
function WAConfirmationPreview({ name, bizName }: { name: string; bizName: string }) {
  const first = name.split(' ')[0] || 'there'
  return (
    <div style={{ width: 220 }} className="mx-auto">
      <div className="rounded-[28px] bg-[#1a1a1a] p-[6px] shadow-xl">
        <div className="rounded-[22px] overflow-hidden">
          <div className="bg-[#0d1b0f] px-3 pt-2 pb-1 flex justify-between items-center">
            <span className="text-white text-[8px] font-medium">9:41</span>
            <div className="w-12 h-2 bg-[#333] rounded-full" />
            <span className="text-white text-[7px]">●●●</span>
          </div>
          <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2">
            <span className="text-white/70 text-[9px]">←</span>
            <div className="w-6 h-6 rounded-full bg-[#25D366]/40 flex items-center justify-center text-[7px] font-bold text-[#25D366]">SQ</div>
            <div>
              <p className="text-white text-[9px] font-semibold leading-none">ShopprHQ</p>
              <p className="text-green-300 text-[7px]">Business Account</p>
            </div>
          </div>
          <div className="bg-[#0d1b0f] p-3 min-h-[140px]">
            <div className="bg-[#1e2e20] border border-white/5 rounded-xl rounded-bl-none px-2.5 py-2 text-[8px] text-white/80 leading-relaxed whitespace-pre-line max-w-[90%]">
              {`Hi ${first} 👋\n\nWe've received your application for *${bizName || 'your business'}*.\n\nOur team will reach out to you here within 1–2 business days to kick off your setup.\n\nHave a question? Just reply.\n\n— ShopprHQ`}
              <span className="block text-right text-[6px] text-white/25 mt-1">✓✓</span>
            </div>
          </div>
          <div className="bg-[#111] px-2.5 py-1.5 flex items-center gap-1.5">
            <div className="flex-1 bg-[#1e1e1e] rounded-full px-2 py-1 text-[7px] text-white/20">Message</div>
            <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[8px]">↑</div>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex justify-center">
        <div className="w-12 h-0.5 bg-black/15 rounded-full" />
      </div>
    </div>
  )
}

export default function GetStartedPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field | 'agreed', string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')

  function set(field: Field, val: string) {
    setForm(f => ({ ...f, [field]: val }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.full_name.trim())          e.full_name = 'Enter your full name.'
    if (!form.business_name.trim())      e.business_name = 'Enter your business name.'
    if (!form.business_type)             e.business_type = 'Select a business type.'
    if (!form.city_state.trim())         e.city_state = 'Enter your city and state.'
    if (!form.email.trim() || !form.email.includes('@'))
                                         e.email = 'Enter a valid email address.'
    if (!form.phone_number.trim() || form.phone_number.replace(/\D/g, '').length < 10)
                                         e.phone_number = 'Enter a valid WhatsApp number.'
    if (!form.monthly_order_volume)      e.monthly_order_volume = 'Select an approximate order volume.'
    if (!form.uses_whatsapp_manual)      e.uses_whatsapp_manual = 'Please answer this.'
    if (!form.uses_delivery_service)     e.uses_delivery_service = 'Please answer this.'
    if (!form.heard_about_us)            e.heard_about_us = 'Let us know how you found us.'
    if (!agreed)                         e.agreed = 'Please agree to continue.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.website) return  // honeypot
    if (!validate()) return

    setLoading(true)
    setServerError('')
    try {
      await submitMerchantApplication({
        full_name:             form.full_name.trim(),
        business_name:         form.business_name.trim(),
        business_type:         form.business_type,
        city_state:            form.city_state.trim(),
        email:                 form.email.trim().toLowerCase(),
        phone_number:          form.phone_number.trim().replace(/\D/g, ''),
        whatsapp_number:       '',   // not collected — set during onboarding
        num_branches:          Number(form.num_branches) || 1,
        monthly_order_volume:  form.monthly_order_volume,
        uses_whatsapp_manual:  form.uses_whatsapp_manual === 'yes',
        uses_delivery_service: form.uses_delivery_service === 'yes',
        heard_about_us:        form.heard_about_us,
        comments:              form.comments.trim() || undefined,
        website:               form.website,
      })
      setSubmitted(true)
    } catch (err: any) {
      setServerError(err?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Success state ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <DoodleBackground />
        <Navbar />
        <section className="pt-32 pb-24 px-5">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in-up">
              <div className="inline-flex items-center gap-2 bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] inline-block" />
                Application received
              </div>
              <h1 className="font-display font-extrabold text-[clamp(2.2rem,5vw,3.8rem)] tracking-tight leading-[1.0] text-ink mb-6">
                You're in.<br />
                <span className="text-ink-3">We'll be in touch.</span>
              </h1>
              <p className="text-ink-3 text-base leading-relaxed mb-4 max-w-md">
                We've received your application for <strong className="text-ink">{form.business_name}</strong>. Our team will reach out to you on WhatsApp within 1–2 business days to schedule your setup session.
              </p>
              <p className="text-ink-3 text-sm leading-relaxed max-w-md">
                In the meantime, if you have any questions, send us a message at{' '}
                <a href="mailto:hello@shopprhq.com" className="text-ink underline underline-offset-2">hello@shopprhq.com</a>.
              </p>
            </div>
            <div className="flex flex-col items-center gap-6 fade-in-up" style={{ animationDelay: '150ms' }}>
              <p className="text-xs font-mono text-ink-4 uppercase tracking-widest">You'll receive this on WhatsApp</p>
              <WAConfirmationPreview name={form.full_name} bizName={form.business_name} />
              <p className="text-xs text-ink-4 text-center max-w-[220px] leading-relaxed">
                This message is sent to the WhatsApp number you provided. Reply anytime.
              </p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  /* ── Field helpers ── */
  function Err({ field }: { field: Field | 'agreed' }) {
    return errors[field] ? <p className="text-xs text-red-500 mt-1">{errors[field]}</p> : null
  }

  function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-semibold text-ink-3 uppercase tracking-[.05em] mb-1.5">{children}</label>
  }

  const inputCls = (f: Field) =>
    `w-full border rounded-xl px-4 py-3 text-sm font-medium text-ink bg-bg focus:outline-none focus:border-wa focus:bg-white transition-all ${errors[f] ? 'border-red-400' : 'border-border'}`

  const selectCls = (f: Field) =>
    `w-full border rounded-xl px-4 py-3 text-sm font-medium text-ink bg-bg focus:outline-none focus:border-wa focus:bg-white transition-all appearance-none ${errors[f] ? 'border-red-400' : 'border-border'}`

  return (
    <div className="min-h-screen bg-white">
      <DoodleBackground />
      <Navbar />

      <section className="pt-32 pb-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 items-start">

            {/* ── Form ── */}
            <div>
              <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-4 fade-in-up">Get started</p>
              <h1 className="font-display font-extrabold text-[clamp(2.2rem,5vw,3.8rem)] tracking-tight leading-[1.0] text-ink mb-4 fade-in-up" style={{ animationDelay: '60ms' }}>
                Tell us about<br />your business.
              </h1>
              <p className="text-ink-3 text-base leading-relaxed mb-10 max-w-md fade-in-up" style={{ animationDelay: '120ms' }}>
                Fill this in and we'll reach out on WhatsApp to schedule your setup session. Takes 2 minutes.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5 fade-in-up" style={{ animationDelay: '180ms' }} noValidate>

                {/* Honeypot */}
                <input type="text" name="website" value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />

                {/* Personal info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Your full name</Label>
                    <input className={inputCls('full_name')} placeholder="Ada Okonkwo"
                      value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                    <Err field="full_name" />
                  </div>
                  <div>
                    <Label>Business name</Label>
                    <input className={inputCls('business_name')} placeholder="Mama Ada's Kitchen"
                      value={form.business_name} onChange={e => set('business_name', e.target.value)} />
                    <Err field="business_name" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Business type</Label>
                    <div className="relative">
                      <select className={selectCls('business_type')}
                        value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                        <option value="">Select…</option>
                        {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-xs">▾</span>
                    </div>
                    <Err field="business_type" />
                  </div>
                  <div>
                    <Label>City & state</Label>
                    <input className={inputCls('city_state')} placeholder="Lagos, Lagos State"
                      value={form.city_state} onChange={e => set('city_state', e.target.value)} />
                    <Err field="city_state" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Email address</Label>
                    <input className={inputCls('email')} type="email" placeholder="ada@example.com"
                      value={form.email} onChange={e => set('email', e.target.value)} />
                    <Err field="email" />
                  </div>
                  <div>
                    <Label>Your personal WhatsApp number</Label>
                    <input className={inputCls('phone_number')} type="tel" placeholder="08012345678"
                      value={form.phone_number} onChange={e => set('phone_number', e.target.value)} />
                    <p className="text-xs text-ink-4 mt-1 leading-snug">
                      This is where we'll contact you to set up your business WhatsApp with Meta. Not your store number.
                    </p>
                    <Err field="phone_number" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Number of branches</Label>
                    <input className={inputCls('num_branches')} type="number" min="1" max="500" placeholder="1"
                      value={form.num_branches} onChange={e => set('num_branches', e.target.value)} />
                    <Err field="num_branches" />
                  </div>
                  <div>
                    <Label>Approximate monthly orders</Label>
                    <div className="relative">
                      <select className={selectCls('monthly_order_volume')}
                        value={form.monthly_order_volume} onChange={e => set('monthly_order_volume', e.target.value)}>
                        <option value="">Select…</option>
                        {VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-xs">▾</span>
                    </div>
                    <Err field="monthly_order_volume" />
                  </div>
                </div>

                {/* Yes/no questions */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Do you currently take orders on WhatsApp manually?</Label>
                    <div className="flex gap-3 mt-1">
                      {['yes', 'no'].map(v => (
                        <button key={v} type="button"
                          onClick={() => set('uses_whatsapp_manual', v)}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.uses_whatsapp_manual === v ? 'bg-ink text-white border-ink' : 'bg-bg border-border text-ink-3 hover:border-ink-3'}`}>
                          {v === 'yes' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                    <Err field="uses_whatsapp_manual" />
                  </div>
                  <div>
                    <Label>Do you use a delivery or logistics service?</Label>
                    <div className="flex gap-3 mt-1">
                      {['yes', 'no'].map(v => (
                        <button key={v} type="button"
                          onClick={() => set('uses_delivery_service', v)}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.uses_delivery_service === v ? 'bg-ink text-white border-ink' : 'bg-bg border-border text-ink-3 hover:border-ink-3'}`}>
                          {v === 'yes' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                    <Err field="uses_delivery_service" />
                  </div>
                </div>

                <div>
                  <Label>How did you hear about ShopprHQ?</Label>
                  <div className="relative">
                    <select className={selectCls('heard_about_us')}
                      value={form.heard_about_us} onChange={e => set('heard_about_us', e.target.value)}>
                      <option value="">Select…</option>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-xs">▾</span>
                  </div>
                  <Err field="heard_about_us" />
                </div>

                <div>
                  <Label>Anything else we should know? <span className="text-ink-4 normal-case tracking-normal font-normal">(optional)</span></Label>
                  <textarea className={`${inputCls('comments')} resize-none`} rows={3}
                    placeholder="Special requirements, questions, or anything relevant about how you sell…"
                    value={form.comments} onChange={e => set('comments', e.target.value)} />
                </div>

                {/* Agreement */}
                <div className={`border rounded-xl p-5 ${errors.agreed ? 'border-red-300 bg-red-50' : 'border-border bg-bg'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-0.5 shrink-0">
                      <input type="checkbox" className="sr-only" checked={agreed}
                        onChange={e => { setAgreed(e.target.checked); setErrors(er => ({ ...er, agreed: '' })) }} />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${agreed ? 'bg-ink border-ink' : 'bg-white border-border'}`}>
                        {agreed && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-ink-2 leading-relaxed">
                      I confirm that all information I have provided above is accurate and truthful to the best of my knowledge. I understand that ShopprHQ will use this information to evaluate my application and contact me to set up my store. I agree to ShopprHQ's{' '}
                      <Link href="/terms" className="text-ink underline underline-offset-2 hover:text-wa transition-colors">Terms of Use</Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-ink underline underline-offset-2 hover:text-wa transition-colors">Privacy Policy</Link>.
                    </span>
                  </label>
                  {errors.agreed && <p className="text-xs text-red-500 mt-2 ml-8">{errors.agreed}</p>}
                </div>

                {serverError && (
                  <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-600">{serverError}</p>
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-ink text-white font-bold py-4 rounded-xl hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base"
                >
                  {loading ? 'Submitting…' : 'Submit application →'}
                </button>

                <p className="text-xs text-ink-4 text-center font-mono">
                  Zero setup fee · less than 1% per transaction · we only get paid when you do
                </p>
              </form>
            </div>

            {/* ── Right panel ── */}
            <div className="lg:sticky lg:top-24 space-y-6 fade-in-up" style={{ animationDelay: '240ms' }}>

              {/* WhatsApp note */}
              <div className="bg-bg border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-[#25D366]" />
                  <p className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">About the WhatsApp number</p>
                </div>
                <p className="text-sm text-ink-3 leading-relaxed mb-3">
                  The number you enter in this form is <strong className="text-ink">your personal WhatsApp</strong> — the one we'll message to reach you.
                </p>
                <p className="text-sm text-ink-3 leading-relaxed">
                  Your <strong className="text-ink">business WhatsApp</strong> — the one your customers will use to place orders — is set up separately with Meta during your onboarding session. You don't need to provide it here.
                </p>
              </div>

              {/* What happens next */}
              <div className="bg-bg border border-border rounded-2xl p-6">
                <p className="text-xs font-semibold text-ink uppercase tracking-wider font-mono mb-5">What happens next</p>
                <div className="space-y-5">
                  {[
                    { n: '1', title: 'We review your application', body: 'Usually within 1–2 business days.' },
                    { n: '2', title: 'We message you on WhatsApp', body: 'From the ShopprHQ number, to your personal WhatsApp.' },
                    { n: '3', title: 'We schedule your setup session', body: 'A short call where we build your catalog and go live.' },
                    { n: '4', title: 'You start taking orders', body: 'Your customers message. Orders come in. You fulfil.' },
                  ].map(step => (
                    <div key={step.n} className="flex gap-4">
                      <span className="font-mono font-extrabold text-lg text-wa leading-none shrink-0">{step.n}</span>
                      <div>
                        <p className="font-semibold text-sm text-ink mb-0.5">{step.title}</p>
                        <p className="text-xs text-ink-3 leading-relaxed">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message preview */}
              <div className="bg-bg border border-border rounded-2xl p-6">
                <p className="text-xs font-semibold text-ink uppercase tracking-wider font-mono mb-4">You'll receive this once approved</p>
                <WAConfirmationPreview
                  name={form.full_name || 'Ada'}
                  bizName={form.business_name || 'your business'}
                />
                <p className="text-xs text-ink-4 mt-4 text-center leading-relaxed">
                  Sent automatically to your WhatsApp when your application is confirmed.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-12 px-5 bg-bg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display font-extrabold text-ink text-lg tracking-tight">Shoppr<span className="text-wa">HQ</span></p>
            <p className="text-xs text-ink-4 mt-1 font-mono">WhatsApp commerce · Nigeria</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-3 font-mono">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <Link href="/how-it-works" className="hover:text-ink transition-colors">How it works</Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of use</Link>
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
