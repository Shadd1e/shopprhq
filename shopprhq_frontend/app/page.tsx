'use client'

import { useEffect, useState, useRef } from 'react'
import Logo from '@/components/Logo'
import { submitMerchantApplication, MerchantApplicationPayload } from '@/lib/api'

// ── Scroll-reveal hook ─────────────────────────────────────────────────────
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

// ── Icons ──────────────────────────────────────────────────────────────────
function ArrowRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 16 16">
      <path d="M3 8l3.5 3.5L13 5" stroke="#25D366" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Static data ────────────────────────────────────────────────────────────
const stats = [
  { value: '60s',  label: 'to go live' },
  { value: '₦0',   label: 'zero setup fee' },
  { value: '<1%',  label: 'per transaction' },
  { value: '24/7', label: 'AI handles orders' },
]

const steps = [
  {
    n: '01',
    title: 'Add your products',
    body: 'Build your catalogue in minutes — names, prices, descriptions. Your store is ready before your next order.',
  },
  {
    n: '02',
    title: 'Connect your WhatsApp',
    body: 'Customers message your number like they always have. ShopprHQ runs the conversation — taking orders, answering questions, collecting payments.',
  },
  {
    n: '03',
    title: 'Manage from your dashboard',
    body: 'Every order appears live. Confirm, dispatch, track revenue — all from one clean screen. You stay in control.',
  },
]

const benefits = [
  'No missed orders from DMs',
  'Automatic order confirmation messages',
  'Card and cash on delivery payments',
  'Real-time stock tracking',
  'Multiple branches, one dashboard',
  'Daily revenue summaries',
]

const businessTypes = [
  'Food & Beverages',
  'Fashion & Clothing',
  'Electronics & Gadgets',
  'Pharmacy & Health',
  'Beauty & Cosmetics',
  'Agriculture & Food Production',
  'Home & Furniture',
  'Books & Stationery',
  'Auto Parts & Accessories',
  'Other',
]

const volumeOptions = [
  { value: 'under-50',   label: 'Under 50 orders/month' },
  { value: '50-200',     label: '50–200 orders/month' },
  { value: '200-500',    label: '200–500 orders/month' },
  { value: '500-1000',   label: '500–1,000 orders/month' },
  { value: 'over-1000',  label: 'Over 1,000 orders/month' },
]

const heardOptions = [
  'Instagram',
  'Twitter / X',
  'Facebook',
  'WhatsApp / Word of mouth',
  'Google Search',
  'TechCabal / Techpoint',
  'A friend or colleague',
  'Other',
]

// ── Application Form ───────────────────────────────────────────────────────
type FormData = {
  business_name:         string
  business_type:         string
  city_state:            string
  full_name:             string
  email:                 string
  phone_number:          string
  whatsapp_number:       string
  num_branches:          string
  monthly_order_volume:  string
  uses_whatsapp_manual:  string
  uses_delivery_service: string
  heard_about_us:        string
  comments:              string
  website:               string  // honeypot — always empty for real users
}

const EMPTY_FORM: FormData = {
  business_name:         '',
  business_type:         '',
  city_state:            '',
  full_name:             '',
  email:                 '',
  phone_number:          '',
  whatsapp_number:       '',
  num_branches:          '1',
  monthly_order_volume:  '',
  uses_whatsapp_manual:  '',
  uses_delivery_service: '',
  heard_about_us:        '',
  comments:              '',
  website:               '',
}

function inputCls(err?: string) {
  return [
    'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all bg-white',
    err
      ? 'border-red-400 focus:ring-2 focus:ring-red-200'
      : 'border-gray-200 focus:border-green-400 focus:ring-2 focus:ring-green-100',
  ].join(' ')
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
      {children}
    </label>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1.5 text-xs text-red-500">{msg}</p>
}

function ApplicationForm() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
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

  function validateStep1(): boolean {
    const e: Partial<FormData> = {}
    if (!form.business_name.trim())  e.business_name  = 'Required'
    if (!form.business_type)         e.business_type  = 'Required'
    if (!form.city_state.trim())     e.city_state     = 'Required'
    if (!form.full_name.trim())      e.full_name      = 'Required'
    if (!form.email.includes('@'))   e.email          = 'Enter a valid email'
    if (!form.phone_number.trim())   e.phone_number   = 'Required'
    if (!form.whatsapp_number.trim())e.whatsapp_number= 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Partial<FormData> = {}
    if (!form.num_branches || isNaN(Number(form.num_branches)) || Number(form.num_branches) < 1)
      e.num_branches = 'Enter a valid number'
    if (!form.monthly_order_volume)   e.monthly_order_volume  = 'Required'
    if (!form.uses_whatsapp_manual)   e.uses_whatsapp_manual  = 'Required'
    if (!form.uses_delivery_service)  e.uses_delivery_service = 'Required'
    if (!form.heard_about_us)         e.heard_about_us        = 'Required'
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
        website:               form.website,  // honeypot — always '' for real users
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

  if (submitted) {
    return (
      <div className="text-center py-16 px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-3">Application received!</h3>
        <p className="text-gray-500 text-base leading-relaxed max-w-sm mx-auto">
          We'll review your details and reach out within <strong>1–2 business days</strong>.
          Check your inbox for a confirmation email.
        </p>
      </div>
    )
  }

  return (
    <div ref={topRef}>
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {['Business details', 'Operations & submit'].map((label, i) => {
          const n = i + 1
          const active = n === step
          const done = n < step
          return (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  done   ? 'bg-green-500 text-white'
                  : active ? 'bg-gray-900 text-white ring-4 ring-gray-900/10'
                  :          'bg-gray-100 text-gray-400 border-2 border-gray-200',
                ].join(' ')}>
                  {done ? '✓' : n}
                </div>
                <span className={[
                  'text-[10px] font-semibold whitespace-nowrap',
                  active ? 'text-gray-800' : 'text-gray-400',
                ].join(' ')}>{label}</span>
              </div>
              {i < 1 && (
                <div className={[
                  'flex-1 h-0.5 mx-2 mt-[-14px] rounded transition-colors',
                  done ? 'bg-green-400' : 'bg-gray-200',
                ].join(' ')} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1 */}
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
                <option value="">Select type…</option>
                {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <FieldErr msg={errors.business_type} />
            </div>
          </div>
          <div>
            <Label>City / State *</Label>
            <input className={inputCls(errors.city_state)} placeholder="e.g. Lagos, Nigeria"
              value={form.city_state} onChange={e => set('city_state', e.target.value)} />
            <FieldErr msg={errors.city_state} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Your full name *</Label>
              <input className={inputCls(errors.full_name)} placeholder="e.g. Temi Adeyemi"
                value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              <FieldErr msg={errors.full_name} />
            </div>
            <div>
              <Label>Email address *</Label>
              <input type="email" className={inputCls(errors.email)} placeholder="you@business.com"
                value={form.email} onChange={e => set('email', e.target.value)} />
              <FieldErr msg={errors.email} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Phone number *</Label>
              <input type="tel" className={inputCls(errors.phone_number)} placeholder="+2348012345678"
                value={form.phone_number} onChange={e => set('phone_number', e.target.value)} />
              <FieldErr msg={errors.phone_number} />
            </div>
            <div>
              <Label>WhatsApp number to connect *</Label>
              <input type="tel" className={inputCls(errors.whatsapp_number)}
                placeholder="+2348012345678"
                value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} />
              <p className="mt-1.5 text-xs text-gray-400">The number your customers will order from</p>
              <FieldErr msg={errors.whatsapp_number} />
            </div>
          </div>
          <button onClick={nextStep}
            className="w-full mt-2 bg-gray-900 text-white font-semibold py-3.5 rounded-xl
              hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
            Continue <ArrowRight />
          </button>
          {/* Honeypot — invisible to real users; bots fill every field they see.
              Backend silently no-ops any submission where this has a value. */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={e => set('website', e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Number of stores / branches *</Label>
              <input type="number" min="1" className={inputCls(errors.num_branches)}
                placeholder="1"
                value={form.num_branches} onChange={e => set('num_branches', e.target.value)} />
              <FieldErr msg={errors.num_branches} />
            </div>
            <div>
              <Label>Current monthly order volume *</Label>
              <select className={inputCls(errors.monthly_order_volume)}
                value={form.monthly_order_volume}
                onChange={e => set('monthly_order_volume', e.target.value)}>
                <option value="">Select…</option>
                {volumeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <FieldErr msg={errors.monthly_order_volume} />
            </div>
          </div>
          <div>
            <Label>Do you currently take orders on WhatsApp manually? *</Label>
            <div className="flex gap-3">
              {['yes', 'no'].map(v => (
                <button key={v} onClick={() => set('uses_whatsapp_manual', v)}
                  className={[
                    'flex-1 py-3 rounded-xl border font-semibold text-sm transition-all capitalize',
                    form.uses_whatsapp_manual === v
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400',
                  ].join(' ')}>
                  {v === 'yes' ? 'Yes, we do' : 'No, not yet'}
                </button>
              ))}
            </div>
            <FieldErr msg={errors.uses_whatsapp_manual} />
          </div>
          <div>
            <Label>Do you use a delivery / logistics service? *</Label>
            <div className="flex gap-3">
              {['yes', 'no'].map(v => (
                <button key={v} onClick={() => set('uses_delivery_service', v)}
                  className={[
                    'flex-1 py-3 rounded-xl border font-semibold text-sm transition-all capitalize',
                    form.uses_delivery_service === v
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400',
                  ].join(' ')}>
                  {v === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
            <FieldErr msg={errors.uses_delivery_service} />
          </div>
          <div>
            <Label>How did you hear about ShopprHQ? *</Label>
            <select className={inputCls(errors.heard_about_us)}
              value={form.heard_about_us} onChange={e => set('heard_about_us', e.target.value)}>
              <option value="">Select…</option>
              {heardOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <FieldErr msg={errors.heard_about_us} />
          </div>
          <div>
            <Label>Anything else you'd like us to know? <span className="normal-case text-gray-400">(optional)</span></Label>
            <textarea className={inputCls()} rows={3}
              placeholder="Tell us about your business, any specific needs, questions…"
              value={form.comments} onChange={e => set('comments', e.target.value)} />
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button onClick={() => setStep(1)}
              className="px-6 py-3.5 rounded-xl border border-gray-200 text-gray-600
                font-semibold text-sm hover:border-gray-400 transition-colors">
              Back
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 bg-green-600 text-white font-semibold py-3.5 rounded-xl
                hover:bg-green-700 transition-colors disabled:opacity-60
                flex items-center justify-center gap-2">
              {submitting ? 'Submitting…' : 'Submit application'}
              {!submitting && <ArrowRight />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard mockup (simplified SVG placeholder) ─────────────────────────
function DashboardMockup() {
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
      <div className="bg-gray-900 px-4 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-gray-400 font-mono">ShopprHQ Dashboard</span>
      </div>
      <div className="p-5 space-y-3 bg-gray-50">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          {[['₦142,500', 'Today\'s revenue'], ['23', 'Orders today'], ['8', 'Pending']].map(([v, l]) => (
            <div key={l} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <p className="font-bold text-gray-900 text-sm">{v}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{l}</p>
            </div>
          ))}
        </div>
        {/* Order rows */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-50 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-700">Recent Orders</span>
            <span className="text-[10px] text-green-600 font-semibold">Live</span>
          </div>
          {[
            ['ORD-8812', 'Jollof rice x2, Chicken', '₦8,500', 'Confirmed'],
            ['ORD-8811', 'Ankara blouse (Size M)', '₦12,000', 'Paid'],
            ['ORD-8810', 'iPhone charger x3',       '₦7,200',  'Dispatched'],
          ].map(([id, item, price, status]) => (
            <div key={id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-gray-800">{id}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">{item}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-900">{price}</p>
                <span className={[
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                  status === 'Confirmed' ? 'bg-blue-50 text-blue-600'
                  : status === 'Paid' ? 'bg-green-50 text-green-600'
                  : 'bg-orange-50 text-orange-600',
                ].join(' ')}>{status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WhatsAppMockup() {
  const messages = [
    { from: 'customer', text: 'Hi, I want to order jollof rice please' },
    { from: 'bot',      text: 'Hey! 👋 Welcome to Mama Tee Foods.\n\nWe have:\n• Jollof Rice — ₦2,500\n• Fried Rice — ₦2,800\n• Chicken — ₦1,800\n\nHow many portions of Jollof Rice?' },
    { from: 'customer', text: '2 portions please. And 1 chicken' },
    { from: 'bot',      text: '✅ Got it!\n\n2× Jollof Rice — ₦5,000\n1× Chicken — ₦1,800\n\nTotal: ₦6,800\n\nPay with card or cash on delivery?' },
    { from: 'customer', text: 'Card please' },
    { from: 'bot',      text: '💳 Here\'s your payment link:\nhttps://pay.shopprhq.com/abc123\n\nYour order is confirmed once payment is received. 🎉' },
  ]

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
      {/* WhatsApp header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-300 flex items-center justify-center text-sm font-bold text-green-900">MT</div>
        <div>
          <p className="text-white text-sm font-semibold">Mama Tee Foods</p>
          <p className="text-green-200 text-[10px]">Online</p>
        </div>
      </div>
      {/* Chat */}
      <div className="bg-[#ECE5DD] p-3 space-y-2 min-h-[280px]">
        {messages.map((m, i) => (
          <div key={i} className={['flex', m.from === 'customer' ? 'justify-end' : 'justify-start'].join(' ')}>
            <div className={[
              'max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed shadow-sm whitespace-pre-line',
              m.from === 'customer'
                ? 'bg-[#DCF8C6] text-gray-900 rounded-br-sm'
                : 'bg-white text-gray-900 rounded-bl-sm',
            ].join(' ')}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useReveal()

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAF8]">

      {/* ════ NAV ════ */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF8]/90 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Logo />
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
            <a href="#screenshots" className="hover:text-gray-900 transition-colors">See it in action</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#apply" className="hover:text-gray-900 transition-colors">Apply</a>
          </div>
          {/* No login or signup button — intentional */}
        </div>
      </nav>

      {/* ════ HERO ════ */}
      <section className="pt-20 pb-28 px-5 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200
            text-green-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Now accepting applications for Nigerian SMEs
          </div>

          <h1 className="font-extrabold text-[clamp(2.6rem,7vw,4.8rem)]
            tracking-tight leading-[1.04] text-gray-900 mb-6">
            Your customers are already<br />
            <span className="text-[#25D366]">on WhatsApp.</span><br />
            Meet them there.
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl mx-auto mb-10">
            ShopprHQ turns your WhatsApp number into a fully automated storefront.
            AI handles orders and payments. You focus on the business.
          </p>

          <a href="#apply"
            className="inline-flex items-center gap-2 bg-gray-900 text-white
              font-semibold text-base px-8 py-4 rounded-2xl shadow-lg
              hover:bg-gray-800 hover:-translate-y-0.5 transition-all duration-200">
            Apply to use ShopprHQ
            <ArrowRight />
          </a>

          <p className="text-sm text-gray-400 mt-4">
            We review every application — approved merchants get set up within 48 hours.
          </p>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200
            rounded-2xl overflow-hidden border border-gray-200 shadow-sm max-w-xl mx-auto">
            {stats.map((s) => (
              <div key={s.value} className="bg-white px-4 py-5 text-center">
                <p className="font-extrabold text-[1.7rem] tracking-tight text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SCREENSHOTS ════ */}
      <section id="screenshots" className="py-24 px-5 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-green-400 mb-4">
              See it in action
            </p>
            <h2 className="font-extrabold text-[clamp(2rem,5vw,3rem)]
              tracking-tight text-white leading-tight">
              The dashboard you manage.<br />
              The chat your customers love.
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Laptop mockup wrapping dashboard */}
            <div className="reveal">
              <p className="text-sm font-semibold text-gray-400 mb-4 text-center">
                🖥 Merchant Dashboard — your command centre
              </p>
              <DashboardMockup />
              <ul className="mt-6 space-y-2">
                {['Live order feed across all your branches', 'Revenue tracking and daily summaries', 'Manage products, stock, and store settings'].map(b => (
                  <li key={b} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckIcon /> {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Phone mockup wrapping WhatsApp chat */}
            <div className="reveal" style={{ transitionDelay: '120ms' }}>
              <p className="text-sm font-semibold text-gray-400 mb-4 text-center">
                📱 Customer experience — just WhatsApp
              </p>
              <WhatsAppMockup />
              <ul className="mt-6 space-y-2">
                {['No app download, no link to click', 'AI reads and confirms orders automatically', 'Secure payment link sent in-chat'].map(b => (
                  <li key={b} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckIcon /> {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section id="how-it-works" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-green-600 mb-4">
              How it works
            </p>
            <h2 className="font-extrabold text-[clamp(2rem,5vw,3rem)]
              tracking-tight text-gray-900 leading-tight">
              You're live in three steps.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.n}
                className="reveal bg-white border border-gray-200 rounded-3xl p-8
                  hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                style={{ transitionDelay: `${i * 90}ms` }}>
                <p className="font-extrabold text-[3rem] leading-none text-gray-100
                  mb-6 tracking-tight select-none">
                  {step.n}
                </p>
                <h3 className="font-bold text-[1.05rem] text-gray-900 mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div className="mt-16 bg-white border border-gray-200 rounded-3xl p-8 reveal">
            <h3 className="font-bold text-lg text-gray-900 mb-6 text-center">
              Everything included, no extras
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-gray-700">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ APPLICATION FORM ════ */}
      <section id="apply" className="py-24 px-5 bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 reveal">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-green-400 mb-4">
              Apply to use ShopprHQ
            </p>
            <h2 className="font-extrabold text-[clamp(2rem,5vw,3rem)]
              tracking-tight text-white leading-tight mb-4">
              Let's get your store ready.
            </h2>
            <p className="text-gray-400 text-base leading-relaxed">
              Fill in the form below. We review every application personally and
              respond within 1–2 business days. No payment or card needed yet.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl">
            <ApplicationForm />
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer className="bg-gray-950 py-12 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center
            justify-between gap-6 pb-8 border-b border-white/10">
            <div>
              <Logo dark />
              <p className="text-sm text-white/30 mt-2 max-w-xs leading-relaxed">
                WhatsApp commerce for Nigerian businesses.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/40">
              <a href="#screenshots"  className="hover:text-white/70 transition-colors">See it in action</a>
              <a href="#how-it-works" className="hover:text-white/70 transition-colors">How it works</a>
              <a href="#apply"        className="hover:text-white/70 transition-colors">Apply</a>
              <a href="mailto:hello@shopprhq.com" className="hover:text-white/70 transition-colors">Contact</a>
            </div>
          </div>
          <p className="text-xs text-white/20 mt-6">© 2025 ShopprHQ · WhatsApp Commerce · Nigeria</p>
        </div>
      </footer>

    </div>
  )
}
