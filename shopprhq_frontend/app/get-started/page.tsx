'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import DoodleBackground from '@/components/DoodleBackground'
import {
  applyStepOne, applyStepTwo, applyStepThree, applyStepFour, applyResume,
} from '@/lib/api'

const TERMS_VERSION = '2026-06-23' // bump this whenever the terms/indemnity copy below changes

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

const RESUME_KEY = 'shopprhq_resume_token'

const STEP_LABELS = ['You', 'Business', 'Verification', 'Terms']

/* ── WhatsApp confirmation preview (used on final success screen) ── */
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

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${done ? 'bg-wa text-white' : active ? 'bg-ink text-white' : 'bg-bg border border-border text-ink-4'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs font-semibold hidden sm:inline ${active ? 'text-ink' : 'text-ink-4'}`}>{label}</span>
            </div>
            {n < STEP_LABELS.length && <div className={`h-px flex-1 ${done ? 'bg-wa' : 'bg-border'}`} />}
          </div>
        )
      })}
    </div>
  )
}

type Errors = Partial<Record<string, string>>

export default function GetStartedPage() {
  const [step, setStep] = useState(1)
  const [resumeToken, setResumeToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [transactionLimit, setTransactionLimit] = useState<number | null>(null)
  const [verificationStatus, setVerificationStatus] = useState('')

  // Step 1
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  // Step 2
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [cityState, setCityState] = useState('')
  const [registrationStatus, setRegistrationStatus] = useState<'registered' | 'unregistered' | ''>('')
  const [numBranches, setNumBranches] = useState('1')
  const [monthlyOrderVolume, setMonthlyOrderVolume] = useState('')
  const [usesWhatsappManual, setUsesWhatsappManual] = useState('')
  const [usesDeliveryService, setUsesDeliveryService] = useState('')
  const [heardAboutUs, setHeardAboutUs] = useState('')
  const [comments, setComments] = useState('')

  // Step 3
  const [cacNumber, setCacNumber] = useState('')
  const [verificationMethod, setVerificationMethod] = useState<'bvn' | 'nin' | ''>('')
  const [idNumber, setIdNumber] = useState('') // holds either BVN or NIN, depending on verificationMethod

  // Step 4
  const [agreed, setAgreed] = useState(false)

  // ── Resume on load: ?resume=TOKEN in the URL, or a saved token from last visit ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('resume')
    const fromStorage = window.localStorage.getItem(RESUME_KEY)
    const token = fromUrl || fromStorage

    if (!token) { setHydrating(false); return }

    applyResume(token)
      .then(state => {
        setResumeToken(token)
        window.localStorage.setItem(RESUME_KEY, token)
        setFullName(state.full_name || '')
        setEmail(state.email || '')
        setPhoneNumber(state.phone_number || '')
        setBusinessName(state.business_name || '')
        setBusinessType(state.business_type || '')
        setCityState(state.city_state || '')
        setRegistrationStatus((state.registration_status as any) || '')
        setNumBranches(String(state.num_branches || 1))
        setMonthlyOrderVolume(state.monthly_order_volume || '')
        setUsesWhatsappManual(state.uses_whatsapp_manual === true ? 'yes' : state.uses_whatsapp_manual === false ? 'no' : '')
        setUsesDeliveryService(state.uses_delivery_service === true ? 'yes' : state.uses_delivery_service === false ? 'no' : '')
        setHeardAboutUs(state.heard_about_us || '')
        setComments(state.comments || '')
        setVerificationMethod((state.verification_method as any) || '')
        setStep(state.current_step || 1)
      })
      .catch(() => {
        // Expired or invalid — drop it silently and start fresh at step 1.
        window.localStorage.removeItem(RESUME_KEY)
      })
      .finally(() => setHydrating(false))
  }, [])

  function clearError(field: string) {
    setErrors(e => ({ ...e, [field]: '' }))
  }

  /* ── Step 1 submit ── */
  async function submitStepOne(e: React.FormEvent) {
    e.preventDefault()
    const e1: Errors = {}
    if (!fullName.trim()) e1.fullName = 'Enter your full name.'
    if (!email.trim() || !email.includes('@')) e1.email = 'Enter a valid email address.'
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 10) e1.phoneNumber = 'Enter a valid WhatsApp number.'
    setErrors(e1)
    if (Object.keys(e1).length) return

    setLoading(true); setServerError('')
    try {
      const digits = phoneNumber.trim().replace(/\D/g, '')
      const res = await applyStepOne({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone_number: digits,
        whatsapp_number: digits, // this field IS their personal WhatsApp number, per the label below
      })
      if (!res.resume_token) {
        // Already submitted and under review — nothing more to do here.
        setServerError(res.message || 'We already have an application from you under review.')
        return
      }
      setResumeToken(res.resume_token)
      window.localStorage.setItem(RESUME_KEY, res.resume_token)
      setStep(2)
    } catch (err: any) {
      setServerError(err?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2 submit ── */
  async function submitStepTwo(e: React.FormEvent) {
    e.preventDefault()
    const e2: Errors = {}
    if (!businessName.trim()) e2.businessName = 'Enter your business name.'
    if (!businessType) e2.businessType = 'Select a business type.'
    if (!cityState.trim()) e2.cityState = 'Enter your city and state.'
    if (!registrationStatus) e2.registrationStatus = 'Let us know if your business is registered.'
    if (!monthlyOrderVolume) e2.monthlyOrderVolume = 'Select an approximate order volume.'
    if (!usesWhatsappManual) e2.usesWhatsappManual = 'Please answer this.'
    if (!usesDeliveryService) e2.usesDeliveryService = 'Please answer this.'
    if (!heardAboutUs) e2.heardAboutUs = 'Let us know how you found us.'
    setErrors(e2)
    if (Object.keys(e2).length) return

    setLoading(true); setServerError('')
    try {
      await applyStepTwo(resumeToken, {
        business_name: businessName.trim(),
        business_type: businessType,
        city_state: cityState.trim(),
        registration_status: registrationStatus as 'registered' | 'unregistered',
        num_branches: Number(numBranches) || 1,
        monthly_order_volume: monthlyOrderVolume,
        uses_whatsapp_manual: usesWhatsappManual === 'yes',
        uses_delivery_service: usesDeliveryService === 'yes',
        heard_about_us: heardAboutUs,
        comments: comments.trim() || undefined,
      })
      setStep(3)
    } catch (err: any) {
      setServerError(err?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 3 submit ── */
  async function submitStepThree(e: React.FormEvent) {
    e.preventDefault()
    const e3: Errors = {}
    if (registrationStatus === 'registered') {
      if (!cacNumber.trim()) e3.cacNumber = 'Enter your CAC registration number.'
    } else {
      if (!verificationMethod) e3.verificationMethod = 'Choose BVN or NIN.'
      if (!idNumber.trim() || idNumber.trim().length !== 11) e3.idNumber = 'Enter your 11-digit number.'
    }
    setErrors(e3)
    if (Object.keys(e3).length) return

    setLoading(true); setServerError('')
    try {
      const payload = registrationStatus === 'registered'
        ? { cac_number: cacNumber.trim() }
        : {
            verification_method: verificationMethod as 'bvn' | 'nin',
            bvn: verificationMethod === 'bvn' ? idNumber.trim() : undefined,
            nin: verificationMethod === 'nin' ? idNumber.trim() : undefined,
          }
      const res = await applyStepThree(resumeToken, payload)
      setTransactionLimit(res.transaction_limit)
      setVerificationStatus(res.verification_status)
      setStep(4)
    } catch (err: any) {
      setServerError(err?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 4 submit ── */
  async function submitStepFour(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) { setErrors({ agreed: 'Please agree to continue.' }); return }

    setLoading(true); setServerError('')
    try {
      await applyStepFour(resumeToken, { terms_version: TERMS_VERSION, accept: true })
      window.localStorage.removeItem(RESUME_KEY)
      setSubmitted(true)
    } catch (err: any) {
      setServerError(err?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resumeUrl = resumeToken && typeof window !== 'undefined'
    ? `${window.location.origin}/get-started?resume=${resumeToken}`
    : ''

  /* ── Loading / hydrating ── */
  if (hydrating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-ink-4 font-mono">Loading…</p>
      </div>
    )
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
                We've received your application for <strong className="text-ink">{businessName}</strong>. Our team will reach out to you on WhatsApp within 1–2 business days to schedule your setup session.
              </p>
              {transactionLimit != null && (
                <p className="text-ink-3 text-sm leading-relaxed max-w-md mb-4">
                  Based on the verification you provided, your starting transaction limit is{' '}
                  <strong className="text-ink">₦{transactionLimit.toLocaleString()}</strong> per month
                  {verificationStatus === 'pending_manual_review' && ' — this can increase once our team manually confirms your details'}.
                </p>
              )}
              <p className="text-ink-3 text-sm leading-relaxed max-w-md">
                In the meantime, if you have any questions, send us a message at{' '}
                <a href="mailto:hello@shopprhq.com" className="text-ink underline underline-offset-2">hello@shopprhq.com</a>.
              </p>
            </div>
            <div className="flex flex-col items-center gap-6 fade-in-up" style={{ animationDelay: '150ms' }}>
              <p className="text-xs font-mono text-ink-4 uppercase tracking-widest">You'll receive this on WhatsApp</p>
              <WAConfirmationPreview name={fullName} bizName={businessName} />
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
  function Err({ field }: { field: string }) {
    return errors[field] ? <p className="text-xs text-red-500 mt-1">{errors[field]}</p> : null
  }
  function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-semibold text-ink-3 uppercase tracking-[.05em] mb-1.5">{children}</label>
  }
  const inputCls = (f: string) =>
    `w-full border rounded-xl px-4 py-3 text-sm font-medium text-ink bg-bg focus:outline-none focus:border-wa focus:bg-white transition-all ${errors[f] ? 'border-red-400' : 'border-border'}`
  const selectCls = (f: string) =>
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
              <p className="text-xs font-mono text-wa tracking-[.16em] uppercase mb-4">Get started</p>
              <h1 className="font-display font-extrabold text-[clamp(2.2rem,5vw,3.8rem)] tracking-tight leading-[1.0] text-ink mb-4">
                Tell us about<br />your business.
              </h1>
              <p className="text-ink-3 text-base leading-relaxed mb-8 max-w-md">
                Four short steps. Your progress is saved automatically, so you can finish later if you get interrupted.
              </p>

              <Stepper step={step} />

              {resumeToken && step > 1 && (
                <div className="bg-bg border border-border rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-ink-3">Need to finish later? Bookmark this link to resume.</p>
                  <button type="button"
                    onClick={() => navigator.clipboard.writeText(resumeUrl)}
                    className="text-xs font-semibold text-ink underline underline-offset-2 hover:text-wa transition-colors shrink-0">
                    Copy resume link
                  </button>
                </div>
              )}

              {serverError && (
                <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 mb-6">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              {/* ── STEP 1: You ── */}
              {step === 1 && (
                <form onSubmit={submitStepOne} className="space-y-5" noValidate>
                  <div>
                    <Label>Your full name</Label>
                    <input className={inputCls('fullName')} placeholder="Ada Okonkwo"
                      value={fullName} onChange={e => { setFullName(e.target.value); clearError('fullName') }} />
                    <Err field="fullName" />
                  </div>
                  <div>
                    <Label>Email address</Label>
                    <input className={inputCls('email')} type="email" placeholder="ada@example.com"
                      value={email} onChange={e => { setEmail(e.target.value); clearError('email') }} />
                    <Err field="email" />
                  </div>
                  <div>
                    <Label>Your personal WhatsApp number</Label>
                    <input className={inputCls('phoneNumber')} type="tel" placeholder="08012345678"
                      value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); clearError('phoneNumber') }} />
                    <p className="text-xs text-ink-4 mt-1 leading-snug">
                      This is where we'll contact you to set up your business WhatsApp with Meta. Not your store number.
                    </p>
                    <Err field="phoneNumber" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-ink text-white font-bold py-4 rounded-xl hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base">
                    {loading ? 'Continuing…' : 'Continue →'}
                  </button>
                </form>
              )}

              {/* ── STEP 2: Business ── */}
              {step === 2 && (
                <form onSubmit={submitStepTwo} className="space-y-5" noValidate>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Business name</Label>
                      <input className={inputCls('businessName')} placeholder="Mama Ada's Kitchen"
                        value={businessName} onChange={e => { setBusinessName(e.target.value); clearError('businessName') }} />
                      <Err field="businessName" />
                    </div>
                    <div>
                      <Label>Business type</Label>
                      <div className="relative">
                        <select className={selectCls('businessType')}
                          value={businessType} onChange={e => { setBusinessType(e.target.value); clearError('businessType') }}>
                          <option value="">Select…</option>
                          {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-xs">▾</span>
                      </div>
                      <Err field="businessType" />
                    </div>
                  </div>

                  <div>
                    <Label>City & state</Label>
                    <input className={inputCls('cityState')} placeholder="Lagos, Lagos State"
                      value={cityState} onChange={e => { setCityState(e.target.value); clearError('cityState') }} />
                    <Err field="cityState" />
                  </div>

                  <div>
                    <Label>Is your business registered with the CAC?</Label>
                    <div className="grid sm:grid-cols-2 gap-3 mt-1">
                      {([
                        ['registered', 'Yes, it\u2019s registered'],
                        ['unregistered', 'Not yet registered'],
                      ] as const).map(([v, text]) => (
                        <button key={v} type="button"
                          onClick={() => { setRegistrationStatus(v); clearError('registrationStatus') }}
                          className={`py-3 px-4 rounded-xl border text-sm font-semibold text-left transition-all ${registrationStatus === v ? 'bg-ink text-white border-ink' : 'bg-bg border-border text-ink-3 hover:border-ink-3'}`}>
                          {text}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-4 mt-2 leading-snug">
                      Either is fine — this just determines which quick verification step comes next, and your starting transaction limit.
                    </p>
                    <Err field="registrationStatus" />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Number of branches</Label>
                      <input className={inputCls('numBranches')} type="number" min="1" max="500" placeholder="1"
                        value={numBranches} onChange={e => setNumBranches(e.target.value)} />
                    </div>
                    <div>
                      <Label>Approximate monthly orders</Label>
                      <div className="relative">
                        <select className={selectCls('monthlyOrderVolume')}
                          value={monthlyOrderVolume} onChange={e => { setMonthlyOrderVolume(e.target.value); clearError('monthlyOrderVolume') }}>
                          <option value="">Select…</option>
                          {VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-xs">▾</span>
                      </div>
                      <Err field="monthlyOrderVolume" />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Do you currently take orders on WhatsApp manually?</Label>
                      <div className="flex gap-3 mt-1">
                        {['yes', 'no'].map(v => (
                          <button key={v} type="button"
                            onClick={() => { setUsesWhatsappManual(v); clearError('usesWhatsappManual') }}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${usesWhatsappManual === v ? 'bg-ink text-white border-ink' : 'bg-bg border-border text-ink-3 hover:border-ink-3'}`}>
                            {v === 'yes' ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                      <Err field="usesWhatsappManual" />
                    </div>
                    <div>
                      <Label>Do you use a delivery or logistics service?</Label>
                      <div className="flex gap-3 mt-1">
                        {['yes', 'no'].map(v => (
                          <button key={v} type="button"
                            onClick={() => { setUsesDeliveryService(v); clearError('usesDeliveryService') }}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${usesDeliveryService === v ? 'bg-ink text-white border-ink' : 'bg-bg border-border text-ink-3 hover:border-ink-3'}`}>
                            {v === 'yes' ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                      <Err field="usesDeliveryService" />
                    </div>
                  </div>

                  <div>
                    <Label>How did you hear about ShopprHQ?</Label>
                    <div className="relative">
                      <select className={selectCls('heardAboutUs')}
                        value={heardAboutUs} onChange={e => { setHeardAboutUs(e.target.value); clearError('heardAboutUs') }}>
                        <option value="">Select…</option>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-xs">▾</span>
                    </div>
                    <Err field="heardAboutUs" />
                  </div>

                  <div>
                    <Label>Anything else we should know? <span className="text-ink-4 normal-case tracking-normal font-normal">(optional)</span></Label>
                    <textarea className={`${inputCls('comments')} resize-none`} rows={3}
                      placeholder="Special requirements, questions, or anything relevant about how you sell…"
                      value={comments} onChange={e => setComments(e.target.value)} />
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)}
                      className="px-6 py-4 rounded-xl border border-border text-ink-3 font-semibold hover:border-ink-3 transition-all">
                      Back
                    </button>
                    <button type="submit" disabled={loading}
                      className="flex-1 bg-ink text-white font-bold py-4 rounded-xl hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base">
                      {loading ? 'Continuing…' : 'Continue →'}
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 3: Verification ── */}
              {step === 3 && (
                <form onSubmit={submitStepThree} className="space-y-5" noValidate>
                  {registrationStatus === 'registered' ? (
                    <div>
                      <Label>CAC registration number (RC / BN)</Label>
                      <input className={inputCls('cacNumber')} placeholder="RC1234567"
                        value={cacNumber} onChange={e => { setCacNumber(e.target.value); clearError('cacNumber') }} />
                      <Err field="cacNumber" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Verify with</Label>
                        <div className="grid sm:grid-cols-2 gap-3 mt-1">
                          {(['bvn', 'nin'] as const).map(v => (
                            <button key={v} type="button"
                              onClick={() => { setVerificationMethod(v); setIdNumber(''); clearError('verificationMethod') }}
                              className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${verificationMethod === v ? 'bg-ink text-white border-ink' : 'bg-bg border-border text-ink-3 hover:border-ink-3'}`}>
                              {v.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <Err field="verificationMethod" />
                      </div>
                      {verificationMethod && (
                        <div>
                          <Label>{verificationMethod.toUpperCase()} (11 digits)</Label>
                          <input className={inputCls('idNumber')} inputMode="numeric" maxLength={11}
                            placeholder="12345678901"
                            value={idNumber} onChange={e => { setIdNumber(e.target.value.replace(/\D/g, '')); clearError('idNumber') }} />
                          <Err field="idNumber" />
                        </div>
                      )}
                    </>
                  )}

                  <div className="bg-bg border border-border rounded-xl px-4 py-3">
                    <p className="text-xs text-ink-4 leading-relaxed">
                      🔒 Your details are encrypted and stored securely with us, and used only to verify your business.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(2)}
                      className="px-6 py-4 rounded-xl border border-border text-ink-3 font-semibold hover:border-ink-3 transition-all">
                      Back
                    </button>
                    <button type="submit" disabled={loading}
                      className="flex-1 bg-ink text-white font-bold py-4 rounded-xl hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base">
                      {loading ? 'Verifying…' : 'Continue →'}
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 4: Terms & indemnity ── */}
              {step === 4 && (
                <form onSubmit={submitStepFour} className="space-y-5" noValidate>
                  {transactionLimit != null && (
                    <div className="bg-bg border border-border rounded-xl px-4 py-3">
                      <p className="text-sm text-ink">
                        Your starting monthly transaction limit: <strong>₦{transactionLimit.toLocaleString()}</strong>
                      </p>
                      {verificationStatus === 'pending_manual_review' && (
                        <p className="text-xs text-ink-4 mt-1">This may increase once our team confirms your details.</p>
                      )}
                    </div>
                  )}

                  <div className="border border-border rounded-xl p-5 bg-bg max-h-64 overflow-y-auto text-sm text-ink-2 leading-relaxed space-y-3">
                    <p className="font-semibold text-ink">Indemnity & important caveats</p>
                    <p>By submitting this application, you confirm and agree that:</p>
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li>All products you list are genuine, legally sellable, and accurately described — no counterfeit, stolen, or prohibited goods.</li>
                      <li>You are legally entitled to sell every product you list, and the business details you've provided are accurate.</li>
                      <li>You, the seller, are responsible for resolving issues with the goods themselves — wrong item, damage, quality, or non-delivery. ShopprHQ facilitates the connection between you and your customers but does not warehouse, inspect, or ship your products.</li>
                      <li>For payment-related issues — failed transactions, chargebacks, or disputed charges — ShopprHQ works alongside the customer's bank and our payment processor to resolve them, since that's where the funds are actually held.</li>
                      <li>ShopprHQ may suspend, limit, or close your account at our discretion if we reasonably suspect fraud, misuse, or a breach of these terms — without needing to prove it first.</li>
                      <li>Your transaction limit is not permanent. It can increase with a good track record, and we may ask you to re-verify your details periodically or if your sales volume changes significantly.</li>
                      <li>Being verified by ShopprHQ is not an endorsement of you or your products — it only confirms the identity/registration check passed.</li>
                    </ul>
                    <p className="text-xs text-ink-4">Terms version: {TERMS_VERSION}</p>
                  </div>

                  <div className={`border rounded-xl p-5 ${errors.agreed ? 'border-red-300 bg-red-50' : 'border-border bg-bg'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="relative mt-0.5 shrink-0">
                        <input type="checkbox" className="sr-only" checked={agreed}
                          onChange={e => { setAgreed(e.target.checked); clearError('agreed') }} />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${agreed ? 'bg-ink border-ink' : 'bg-white border-border'}`}>
                          {agreed && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-ink-2 leading-relaxed">
                        I have read and agree to the indemnity statement above, and to ShopprHQ's{' '}
                        <Link href="/terms" className="text-ink underline underline-offset-2 hover:text-wa transition-colors">Terms of Use</Link>
                        {' '}and{' '}
                        <Link href="/privacy" className="text-ink underline underline-offset-2 hover:text-wa transition-colors">Privacy Policy</Link>.
                        I confirm everything I've provided is accurate and truthful.
                      </span>
                    </label>
                    {errors.agreed && <p className="text-xs text-red-500 mt-2 ml-8">{errors.agreed}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(3)}
                      className="px-6 py-4 rounded-xl border border-border text-ink-3 font-semibold hover:border-ink-3 transition-all">
                      Back
                    </button>
                    <button type="submit" disabled={loading}
                      className="flex-1 bg-ink text-white font-bold py-4 rounded-xl hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base">
                      {loading ? 'Submitting…' : 'Submit application →'}
                    </button>
                  </div>

                  <p className="text-xs text-ink-4 text-center font-mono">
                    Zero setup fee · less than 1% per transaction · we only get paid when you do
                  </p>
                </form>
              )}
            </div>

            {/* ── Right panel ── */}
            <div className="lg:sticky lg:top-24 space-y-6">

              <div className="bg-bg border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-[#25D366]" />
                  <p className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">About the WhatsApp number</p>
                </div>
                <p className="text-sm text-ink-3 leading-relaxed mb-3">
                  The number you enter in step 1 is <strong className="text-ink">your personal WhatsApp</strong> — the one we'll message to reach you.
                </p>
                <p className="text-sm text-ink-3 leading-relaxed">
                  Your <strong className="text-ink">business WhatsApp</strong> — the one your customers will use to place orders — is set up separately with Meta during your onboarding session. You don't need to provide it here.
                </p>
              </div>

              <div className="bg-bg border border-border rounded-2xl p-6">
                <p className="text-xs font-semibold text-ink uppercase tracking-wider font-mono mb-5">What happens next</p>
                <div className="space-y-5">
                  {[
                    { n: '1', title: 'We review your application', body: 'Usually within 1–2 business days.' },
                    { n: '2', title: 'We message you on WhatsApp', body: 'From the ShopprHQ number, to your personal WhatsApp.' },
                    { n: '3', title: 'We schedule your setup session', body: 'A short call where we build your catalog and go live.' },
                    { n: '4', title: 'You start taking orders', body: 'Your customers message. Orders come in. You fulfil.' },
                  ].map(s => (
                    <div key={s.n} className="flex gap-4">
                      <span className="font-mono font-extrabold text-lg text-wa leading-none shrink-0">{s.n}</span>
                      <div>
                        <p className="font-semibold text-sm text-ink mb-0.5">{s.title}</p>
                        <p className="text-xs text-ink-3 leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-bg border border-border rounded-2xl p-6">
                <p className="text-xs font-semibold text-ink uppercase tracking-wider font-mono mb-4">You'll receive this once approved</p>
                <WAConfirmationPreview name={fullName || 'Ada'} bizName={businessName || 'your business'} />
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
          <p className="text-[11px] text-ink-4 font-mono">© 2026 ShopprHQ</p>
        </div>
      </footer>
    </div>
  )
}
