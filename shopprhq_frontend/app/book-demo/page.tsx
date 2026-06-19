'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { submitMerchantApplication, MerchantApplicationPayload } from '@/lib/api'

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

const businessTypes = [
  'Food & Beverages', 'Fashion & Clothing', 'Electronics & Gadgets',
  'Pharmacy & Health', 'Beauty & Cosmetics', 'Agriculture & Food Production',
  'Home & Furniture', 'Books & Stationery', 'Auto Parts & Accessories', 'Other',
]

const volumeOptions = [
  { value: 'under-50',  label: 'Under 50 orders/month' },
  { value: '50-200',    label: '50–200 orders/month' },
  { value: '200-500',   label: '200–500 orders/month' },
  { value: '500-1000',  label: '500–1,000 orders/month' },
  { value: 'over-1000', label: 'Over 1,000 orders/month' },
]

const heardOptions = [
  'Instagram', 'Twitter / X', 'Facebook', 'WhatsApp / Word of mouth',
  'Google Search', 'TechCabal / Techpoint', 'A friend or colleague', 'Other',
]

type FormData = {
  business_name: string; business_type: string; city_state: string
  full_name: string; email: string; phone_number: string; whatsapp_number: string
  num_branches: string; monthly_order_volume: string; uses_whatsapp_manual: string
  uses_delivery_service: string; heard_about_us: string; comments: string; website: string
}

const EMPTY: FormData = {
  business_name: '', business_type: '', city_state: '', full_name: '', email: '',
  phone_number: '', whatsapp_number: '', num_branches: '1', monthly_order_volume: '',
  uses_whatsapp_manual: '', uses_delivery_service: '', heard_about_us: '', comments: '', website: '',
}

function inputCls(err?: string) {
  return [
    'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all bg-[#0d1a11] text-white placeholder:text-white/20',
    err
      ? 'border-red-500/50 focus:ring-1 focus:ring-red-500/30'
      : 'border-white/10 focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/20',
  ].join(' ')
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-mono uppercase tracking-wider text-white/30 mb-2">
      {children}
    </label>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1.5 text-xs text-red-400/80 font-mono">{msg}</p>
}

export default function BookDemoPage() {
  useReveal()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const topRef = useRef<HTMLDivElement>(null)

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  function validateStep1() {
    const e: Partial<FormData> = {}
    if (!form.business_name.trim())   e.business_name   = 'Required'
    if (!form.business_type)          e.business_type   = 'Required'
    if (!form.city_state.trim())      e.city_state      = 'Required'
    if (!form.full_name.trim())       e.full_name       = 'Required'
    if (!form.email.includes('@'))    e.email           = 'Enter a valid email'
    if (!form.phone_number.trim())    e.phone_number    = 'Required'
    if (!form.whatsapp_number.trim()) e.whatsapp_number = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e: Partial<FormData> = {}
    if (!form.num_branches || isNaN(Number(form.num_branches)) || Number(form.num_branches) < 1)
      e.num_branches = 'Enter a valid number'
    if (!form.monthly_order_volume)  e.monthly_order_volume  = 'Required'
    if (!form.uses_whatsapp_manual)  e.uses_whatsapp_manual  = 'Required'
    if (!form.uses_delivery_service) e.uses_delivery_service = 'Required'
    if (!form.heard_about_us)        e.heard_about_us        = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function nextStep() {
    if (validateStep1()) {
      setStep(2)
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function handleSubmit() {
    if (!validateStep2()) return
    setSubmitting(true)
    setServerError('')
    try {
      const payload: MerchantApplicationPayload = {
        business_name:         form.business_name.trim(),
        business_type:         form.business_type,
        city_state:            form.city_state.trim(),
        full_name:             form.full_name.trim(),
        email:                 form.email.trim(),
        phone_number:          form.phone_number.trim(),
        whatsapp_number:       form.whatsapp_number.trim(),
        num_branches:          Number(form.num_branches),
        monthly_order_volume:  form.monthly_order_volume,
        uses_whatsapp_manual:  form.uses_whatsapp_manual === 'yes',
        uses_delivery_service: form.uses_delivery_service === 'yes',
        heard_about_us:        form.heard_about_us,
        comments:              form.comments.trim() || undefined,
        website:               form.website,
      }
      await submitMerchantApplication(payload)
      setSubmitted(true)
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err: any) {
      setServerError(err?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="relative pt-36 pb-24 px-5 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[#25D366]/8 blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left — copy */}
            <div className="fade-in-up">
              <p className="text-xs font-mono text-[#25D366]/60 tracking-[.16em] uppercase mb-6">Book a demo</p>
              <h1 className="font-display font-extrabold text-[clamp(2.5rem,5vw,4rem)] tracking-tight leading-[0.95] text-white mb-6">
                Let's show you<br />
                <span className="text-[#25D366]">what it does.</span>
              </h1>
              <p className="text-white/40 leading-relaxed mb-10">
                Fill this in and we'll reach out within 1–2 business days to schedule a live walkthrough. No payment. No card. Just a conversation.
              </p>

              <div className="space-y-5">
                {[
                  { icon: '⏱', text: '20-minute live demo' },
                  { icon: '👀', text: 'We show it working for your business type' },
                  { icon: '✅', text: 'Approved merchants are set up within 48 hours' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-white/50">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — form */}
            <div ref={topRef} className="bg-[#0d1a11] border border-white/8 rounded-2xl p-8 fade-in-up" style={{ animationDelay: '120ms' }}>

              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full border border-[#25D366]/30 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-7 h-7 text-[#25D366]" fill="none" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="font-display font-bold text-2xl text-white mb-3">We've got you.</h3>
                  <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
                    We'll review your details and reach out within <strong className="text-white/60">1–2 business days</strong>. Check your inbox.
                  </p>
                </div>
              ) : (
                <>
                  {/* Step indicator */}
                  <div className="flex items-center gap-0 mb-8">
                    {['Your business', 'Operations'].map((label, i) => {
                      const n = i + 1
                      const active = n === step
                      const done = n < step
                      return (
                        <div key={n} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center gap-1">
                            <div className={[
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                              done   ? 'bg-[#25D366] text-[#0A1F10]'
                              : active ? 'bg-white text-[#0A1F10]'
                              :          'bg-white/10 text-white/30',
                            ].join(' ')}>
                              {done ? '✓' : n}
                            </div>
                            <span className={[
                              'text-[10px] font-mono whitespace-nowrap',
                              active ? 'text-white/60' : 'text-white/20',
                            ].join(' ')}>{label}</span>
                          </div>
                          {i < 1 && (
                            <div className={[
                              'flex-1 h-px mx-2 mt-[-14px] transition-colors',
                              done ? 'bg-[#25D366]/40' : 'bg-white/10',
                            ].join(' ')} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Business name *</Label>
                          <input className={inputCls(errors.business_name)} placeholder="e.g. Mama Tee Foods"
                            value={form.business_name} onChange={e => set('business_name', e.target.value)} />
                          <FieldErr msg={errors.business_name} />
                        </div>
                        <div>
                          <Label>Business type *</Label>
                          <select className={inputCls(errors.business_type)}
                            value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                            <option value="">Select…</option>
                            {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <FieldErr msg={errors.business_type} />
                        </div>
                      </div>
                      <div>
                        <Label>City / State *</Label>
                        <input className={inputCls(errors.city_state)} placeholder="e.g. Lagos"
                          value={form.city_state} onChange={e => set('city_state', e.target.value)} />
                        <FieldErr msg={errors.city_state} />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Your name *</Label>
                          <input className={inputCls(errors.full_name)} placeholder="e.g. Temi Adeyemi"
                            value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                          <FieldErr msg={errors.full_name} />
                        </div>
                        <div>
                          <Label>Email *</Label>
                          <input type="email" className={inputCls(errors.email)} placeholder="you@business.com"
                            value={form.email} onChange={e => set('email', e.target.value)} />
                          <FieldErr msg={errors.email} />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Phone *</Label>
                          <input type="tel" className={inputCls(errors.phone_number)} placeholder="+2348012345678"
                            value={form.phone_number} onChange={e => set('phone_number', e.target.value)} />
                          <FieldErr msg={errors.phone_number} />
                        </div>
                        <div>
                          <Label>WhatsApp to connect *</Label>
                          <input type="tel" className={inputCls(errors.whatsapp_number)} placeholder="+2348012345678"
                            value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} />
                          <p className="mt-1.5 text-[10px] text-white/20 font-mono">The number customers order from</p>
                          <FieldErr msg={errors.whatsapp_number} />
                        </div>
                      </div>
                      <input type="text" name="website" value={form.website} onChange={e => set('website', e.target.value)}
                        tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                      <button onClick={nextStep}
                        className="w-full mt-2 bg-[#25D366] text-[#0A1F10] font-bold py-3.5 rounded-xl hover:bg-[#1fba57] transition-colors flex items-center justify-center gap-2 text-sm">
                        Continue
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Branches *</Label>
                          <input type="number" min="1" className={inputCls(errors.num_branches)} placeholder="1"
                            value={form.num_branches} onChange={e => set('num_branches', e.target.value)} />
                          <FieldErr msg={errors.num_branches} />
                        </div>
                        <div>
                          <Label>Monthly order volume *</Label>
                          <select className={inputCls(errors.monthly_order_volume)}
                            value={form.monthly_order_volume} onChange={e => set('monthly_order_volume', e.target.value)}>
                            <option value="">Select…</option>
                            {volumeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <FieldErr msg={errors.monthly_order_volume} />
                        </div>
                      </div>
                      <div>
                        <Label>Do you take orders on WhatsApp manually today? *</Label>
                        <div className="flex gap-2">
                          {['yes', 'no'].map(v => (
                            <button key={v} onClick={() => set('uses_whatsapp_manual', v)}
                              className={[
                                'flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all capitalize',
                                form.uses_whatsapp_manual === v
                                  ? 'border-[#25D366]/50 bg-[#25D366]/10 text-[#25D366]'
                                  : 'border-white/10 text-white/30 hover:border-white/20',
                              ].join(' ')}>
                              {v === 'yes' ? 'Yes' : 'Not yet'}
                            </button>
                          ))}
                        </div>
                        <FieldErr msg={errors.uses_whatsapp_manual} />
                      </div>
                      <div>
                        <Label>Do you use a delivery service? *</Label>
                        <div className="flex gap-2">
                          {['yes', 'no'].map(v => (
                            <button key={v} onClick={() => set('uses_delivery_service', v)}
                              className={[
                                'flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                                form.uses_delivery_service === v
                                  ? 'border-[#25D366]/50 bg-[#25D366]/10 text-[#25D366]'
                                  : 'border-white/10 text-white/30 hover:border-white/20',
                              ].join(' ')}>
                              {v === 'yes' ? 'Yes' : 'No'}
                            </button>
                          ))}
                        </div>
                        <FieldErr msg={errors.uses_delivery_service} />
                      </div>
                      <div>
                        <Label>How did you hear about us? *</Label>
                        <select className={inputCls(errors.heard_about_us)}
                          value={form.heard_about_us} onChange={e => set('heard_about_us', e.target.value)}>
                          <option value="">Select…</option>
                          {heardOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <FieldErr msg={errors.heard_about_us} />
                      </div>
                      <div>
                        <Label>Anything else? <span className="normal-case text-white/15">(optional)</span></Label>
                        <textarea className={inputCls()} rows={3}
                          placeholder="Tell us about your business or any specific needs…"
                          value={form.comments} onChange={e => set('comments', e.target.value)} />
                      </div>

                      {serverError && (
                        <div className="border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3">
                          <p className="text-sm text-red-400 font-mono">{serverError}</p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setStep(1)}
                          className="px-5 py-3.5 rounded-xl border border-white/10 text-white/40 text-sm font-semibold hover:border-white/20 hover:text-white/60 transition-colors">
                          Back
                        </button>
                        <button onClick={handleSubmit} disabled={submitting}
                          className="flex-1 bg-[#25D366] text-[#0A1F10] font-bold py-3.5 rounded-xl hover:bg-[#1fba57] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                          {submitting ? 'Sending…' : 'Book my demo'}
                          {!submitting && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-display font-extrabold text-white tracking-tight">
            Shoppr<span className="text-[#25D366]">HQ</span>
          </p>
          <div className="flex gap-6 text-xs text-white/25 font-mono">
            <Link href="/" className="hover:text-white/50 transition-colors">Home</Link>
            <Link href="/how-it-works" className="hover:text-white/50 transition-colors">How it works</Link>
            <a href="mailto:hello@shopprhq.com" className="hover:text-white/50 transition-colors">hello@shopprhq.com</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
