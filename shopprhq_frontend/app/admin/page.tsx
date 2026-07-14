'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════

type OnboardingStatus =
  | 'pending'
  | 'added_to_waba'
  | 'otp_requested'
  | 'otp_submitted'
  | 'otp_failed'
  | 'number_in_use'
  | 'number_personal'
  | 'number_invalid'
  | 'active'

interface StoreRecord {
  id:                    string
  store_name:            string
  merchant_name:         string
  merchant_id:           string
  merchant_email:        string
  whatsapp_number:       string
  operator_notify_phone: string
  onboarding_status:     OnboardingStatus
  pending_otp_code:      string | null
}

// ══════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ap.shopprhq.com'}/admin/whatsapp-setup`

// ══════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════════════════

const INPUT = cn(
  'w-full px-3.5 py-2.5 rounded-xl',
  'bg-white border border-gray-200',
  'text-sm text-gray-900 placeholder:text-gray-400',
  'outline-none transition-all',
  'focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10',
)

const BTN = cn(
  'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
  'disabled:opacity-50 disabled:cursor-not-allowed',
)

const STATUS_BADGE: Record<OnboardingStatus, string> = {
  pending:          'bg-gray-100 text-gray-600',
  added_to_waba:    'bg-blue-100 text-blue-700',
  otp_requested:    'bg-indigo-100 text-indigo-700',
  otp_submitted:    'bg-amber-100 text-amber-700',
  otp_failed:       'bg-red-100 text-red-700',
  number_in_use:    'bg-red-100 text-red-700',
  number_personal:  'bg-orange-100 text-orange-700',
  number_invalid:   'bg-red-100 text-red-700',
  active:           'bg-emerald-100 text-emerald-700',
}

const STATUS_LABEL: Record<OnboardingStatus, string> = {
  pending:          'Pending',
  added_to_waba:    'Added to WABA',
  otp_requested:    'OTP Sent',
  otp_submitted:    '⚡ Code Submitted',
  otp_failed:       'OTP Failed',
  number_in_use:    'Number In Use',
  number_personal:  'Personal WhatsApp',
  number_invalid:   'Invalid Number',
  active:           '✓ Active',
}

// ══════════════════════════════════════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function adminReq<T>(
  path: string,
  token: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
      ...(opts.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail ?? 'Request failed')
  return data as T
}

// ══════════════════════════════════════════════════════════════════════════
// STEP PANEL — per-store onboarding stepper
// ══════════════════════════════════════════════════════════════════════════

function StepPanel({ store, token, onDone }: {
  store: StoreRecord
  token: string
  onDone: () => void
}) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [displayName,   setDisplayName]   = useState(store.store_name)
  const [method,        setMethod]        = useState<'SMS' | 'VOICE'>('SMS')
  const [manualCode,    setManualCode]    = useState(store.pending_otp_code ?? '')

  const [step1Loading,  setStep1Loading]  = useState(false)
  const [step2Loading,  setStep2Loading]  = useState(false)
  const [step3Loading,  setStep3Loading]  = useState(false)
  const [step4Loading,  setStep4Loading]  = useState(false)
  const [step5Loading,  setStep5Loading]  = useState(false)

  const [step1Msg,      setStep1Msg]      = useState('')
  const [step2Msg,      setStep2Msg]      = useState('')
  const [step3Msg,      setStep3Msg]      = useState('')
  const [step4Msg,      setStep4Msg]      = useState('')
  const [step5Msg,      setStep5Msg]      = useState('')

  const [step1Done,     setStep1Done]     = useState(
    ['added_to_waba','otp_requested','otp_submitted','otp_failed','active'].includes(store.onboarding_status)
  )
  const [step2Done,     setStep2Done]     = useState(
    ['otp_requested','otp_submitted','otp_failed','active'].includes(store.onboarding_status)
  )
  const [step3Done,     setStep3Done]     = useState(
    ['active'].includes(store.onboarding_status)
  )

  // Pre-fill code from merchant submission
  useEffect(() => {
    if (store.pending_otp_code) setManualCode(store.pending_otp_code)
  }, [store.pending_otp_code])

  async function handleAddNumber() {
    setStep1Loading(true); setStep1Msg('')
    try {
      const data = await adminReq<{ phone_number_id: string }>('/add-number', token, {
        method: 'POST',
        body: JSON.stringify({
          phone:        store.whatsapp_number,
          display_name: displayName,
          client_id:    store.id,
        }),
      })
      setPhoneNumberId(data.phone_number_id)
      setStep1Done(true)
      setStep1Msg(`✓ Phone Number ID: ${data.phone_number_id}`)
    } catch (err: any) {
      setStep1Msg(`✗ ${err.message}`)
    } finally { setStep1Loading(false) }
  }

  async function handleRequestOtp() {
    setStep2Loading(true); setStep2Msg('')
    try {
      await adminReq('/request-otp', token, {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          method,
          client_id: store.id,
        }),
      })
      setStep2Done(true)
      setStep2Msg(`✓ OTP sent via ${method}. Merchant has been emailed.`)
    } catch (err: any) {
      setStep2Msg(`✗ ${err.message}`)
    } finally { setStep2Loading(false) }
  }

  async function handleVerifyOtp() {
    setStep3Loading(true); setStep3Msg('')
    try {
      await adminReq('/verify-otp', token, {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          client_id:       store.id,
          code:            manualCode,
        }),
      })
      setStep3Done(true)
      setStep3Msg('✓ Code verified successfully.')
    } catch (err: any) {
      setStep3Msg(`✗ ${err.message}`)
    } finally { setStep3Loading(false) }
  }

  async function handleActivate() {
    setStep4Loading(true); setStep4Msg('')
    try {
      await adminReq('/activate', token, {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          client_id:       store.id,
        }),
      })
      setStep4Msg('✓ Registered on Cloud API. Webhook subscribed.')
    } catch (err: any) {
      setStep4Msg(`✗ ${err.message}`)
    } finally { setStep4Loading(false) }
  }

  async function handleSave() {
    setStep5Loading(true); setStep5Msg('')
    try {
      await adminReq('/save', token, {
        method: 'POST',
        body: JSON.stringify({
          client_id:       store.id,
          phone_number_id: phoneNumberId,
          whatsapp_number: store.whatsapp_number,
        }),
      })
      setStep5Msg('✓ Store is live. Merchant notified.')
      setTimeout(onDone, 1500)
    } catch (err: any) {
      setStep5Msg(`✗ ${err.message}`)
    } finally { setStep5Loading(false) }
  }

  const hasCode = !!store.pending_otp_code || !!manualCode

  return (
    <div className="space-y-4">

      {/* Store info */}
      <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1">
        <p><span className="text-gray-500">Store:</span> <strong>{store.store_name}</strong></p>
        <p><span className="text-gray-500">Merchant:</span> {store.merchant_name} ({store.merchant_email})</p>
        <p><span className="text-gray-500">Number:</span> <code className="font-mono bg-white border border-gray-200 px-2 py-0.5 rounded-lg">+{store.whatsapp_number}</code></p>
        <p><span className="text-gray-500">Status:</span>{' '}
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_BADGE[store.onboarding_status])}>
            {STATUS_LABEL[store.onboarding_status]}
          </span>
        </p>
        {store.pending_otp_code && (
          <p className="font-semibold text-amber-700">
            ⚡ Merchant submitted code: <code className="font-mono bg-amber-100 px-2 py-0.5 rounded-lg tracking-widest">{store.pending_otp_code}</code>
          </p>
        )}
      </div>

      {/* Step 1 */}
      <StepCard n={1} title="Add number to WABA" done={step1Done}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Display name</label>
            <input type="text" value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className={INPUT} placeholder="Store display name" />
            <p className="text-xs text-gray-400 mt-1">This is the name Meta shows on the WhatsApp profile.</p>
          </div>
          <button onClick={handleAddNumber} disabled={step1Loading || !displayName.trim()}
            className={cn(BTN, 'bg-gray-900 text-white hover:bg-gray-700')}>
            {step1Loading ? 'Adding…' : 'Add number to WABA'}
          </button>
          {step1Msg && (
            <p className={cn('text-xs font-mono', step1Msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600')}>
              {step1Msg}
            </p>
          )}
          {phoneNumberId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Phone Number ID (for next steps)</label>
              <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
                className={INPUT} placeholder="Paste phone_number_id if already known" />
            </div>
          )}
          {!step1Done && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Already added manually? Paste the phone_number_id:</p>
              <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
                className={INPUT} placeholder="e.g. 1234567890" />
            </div>
          )}
        </div>
      </StepCard>

      {/* Step 2 — only after step 1 done or phone_number_id is filled */}
      <StepCard n={2} title="Request OTP (merchant will receive SMS/call)" done={step2Done}
        disabled={!step1Done && !phoneNumberId}>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['SMS', 'VOICE'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-semibold border transition-all',
                  method === m
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                )}>
                {m}
              </button>
            ))}
          </div>
          <button onClick={handleRequestOtp} disabled={step2Loading || !phoneNumberId}
            className={cn(BTN, 'bg-gray-900 text-white hover:bg-gray-700 w-full')}>
            {step2Loading ? 'Sending…' : `Send OTP via ${method}`}
          </button>
          {step2Msg && (
            <p className={cn('text-xs font-mono', step2Msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600')}>
              {step2Msg}
            </p>
          )}
        </div>
      </StepCard>

      {/* Step 3 — verify OTP */}
      <StepCard n={3} title={hasCode ? '⚡ Verify OTP — code ready' : 'Verify OTP (waiting for merchant)'} done={step3Done}
        disabled={!step2Done && !phoneNumberId} highlight={hasCode}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              6-digit code {store.pending_otp_code ? '(auto-filled from merchant)' : ''}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
              className={cn(INPUT, 'font-mono tracking-widest text-center text-lg')}
            />
          </div>
          <button onClick={handleVerifyOtp} disabled={step3Loading || !manualCode || manualCode.length !== 6}
            className={cn(BTN, 'bg-gray-900 text-white hover:bg-gray-700 w-full')}>
            {step3Loading ? 'Verifying…' : 'Verify code with Meta'}
          </button>
          {step3Msg && (
            <p className={cn('text-xs font-mono', step3Msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600')}>
              {step3Msg}
            </p>
          )}
        </div>
      </StepCard>

      {/* Step 4 — activate */}
      <StepCard n={4} title="Register on Cloud API + subscribe webhook" disabled={!step3Done}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            This registers the number on Meta's Cloud API and subscribes it to your webhook.
            A random 6-digit PIN is generated automatically.
          </p>
          <button onClick={handleActivate} disabled={step4Loading}
            className={cn(BTN, 'bg-gray-900 text-white hover:bg-gray-700 w-full')}>
            {step4Loading ? 'Activating…' : 'Activate'}
          </button>
          {step4Msg && (
            <p className={cn('text-xs font-mono', step4Msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600')}>
              {step4Msg}
            </p>
          )}
        </div>
      </StepCard>

      {/* Step 5 — save & go live */}
      <StepCard n={5} title="Save to database — store goes live" disabled={!step4Msg.startsWith('✓')}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            This saves the <code>phone_number_id</code> to Postgres, marks the merchant as live,
            and sends them the "you're live" email with setup instructions.
          </p>
          <button onClick={handleSave} disabled={step5Loading}
            className={cn(BTN, 'bg-emerald-600 text-white hover:bg-emerald-700 w-full')}>
            {step5Loading ? 'Saving…' : '🚀 Complete onboarding'}
          </button>
          {step5Msg && (
            <p className={cn('text-xs font-mono', step5Msg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600')}>
              {step5Msg}
            </p>
          )}
        </div>
      </StepCard>
    </div>
  )
}

function StepCard({ n, title, children, done, disabled, highlight }: {
  n: number
  title: string
  children: React.ReactNode
  done?: boolean
  disabled?: boolean
  highlight?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn(
      'border rounded-2xl overflow-hidden transition-all',
      done           ? 'border-emerald-200 bg-emerald-50/40'
        : highlight  ? 'border-amber-300 bg-amber-50/50 ring-2 ring-amber-200'
        : disabled   ? 'border-gray-100 bg-gray-50 opacity-60'
        : 'border-gray-200 bg-white',
    )}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
        disabled={disabled}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
            done     ? 'bg-emerald-500 text-white'
              : highlight ? 'bg-amber-400 text-white'
              : 'bg-gray-200 text-gray-600',
          )}>
            {done ? '✓' : n}
          </span>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        <span className={cn('text-gray-400 transition-transform text-xs', open && 'rotate-180')}>▼</span>
      </button>
      {open && !disabled && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// STORE LIST
// ══════════════════════════════════════════════════════════════════════════

function StoreList({ token }: { token: string }) {
  const [stores,   setStores]   = useState<StoreRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<StoreRecord | null>(null)
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'action_needed' | 'active'>('all')
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await adminReq<{ clients: StoreRecord[] }>('/clients', token)
      setStores(data.clients)
    } catch (err: any) {
      setError(err.message)
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const filtered = stores.filter(s => {
    if (filter === 'pending')       return !['active'].includes(s.onboarding_status)
    if (filter === 'action_needed') return s.pending_otp_code !== null
    if (filter === 'active')        return s.onboarding_status === 'active'
    return true
  }).filter(s =>
    !search ||
    s.store_name.toLowerCase().includes(search.toLowerCase()) ||
    s.merchant_name.toLowerCase().includes(search.toLowerCase()) ||
    s.whatsapp_number.includes(search)
  )

  const actionCount = stores.filter(s => s.pending_otp_code !== null).length

  if (selected) {
    return (
      <div>
        <button onClick={() => { setSelected(null); load() }}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          ← Back to stores
        </button>
        <h2 className="font-bold text-lg text-gray-900 mb-6">
          Onboarding: {selected.store_name}
        </h2>
        <StepPanel store={selected} token={token} onDone={() => { setSelected(null); load() }} />
      </div>
    )
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by store, merchant, or number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={cn(INPUT, 'flex-1')}
        />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { id: 'all',            label: 'All' },
            { id: 'pending',        label: 'Pending' },
            { id: 'action_needed',  label: `⚡ Action needed${actionCount > 0 ? ` (${actionCount})` : ''}` },
            { id: 'active',         label: '✓ Active' },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                filter === f.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900',
              )}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load}
          className={cn(BTN, 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400 shrink-0')}>
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={load} className="mt-2 text-xs font-semibold text-red-700 underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No stores found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id}
              className={cn(
                'bg-white border rounded-2xl px-5 py-4 flex items-center gap-4',
                'hover:border-gray-400 cursor-pointer transition-all',
                s.pending_otp_code ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200',
              )}
              onClick={() => setSelected(s)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{s.store_name}</p>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', STATUS_BADGE[s.onboarding_status])}>
                    {STATUS_LABEL[s.onboarding_status]}
                  </span>
                  {s.pending_otp_code && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 animate-pulse">
                      ⚡ Code ready
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.merchant_name} · {s.merchant_email}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-xs font-semibold text-gray-600">
                  {s.whatsapp_number ? `+${s.whatsapp_number}` : '— no number —'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{s.id}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════

function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${BASE}/verify-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.ok) { setError('Incorrect password.'); return }
      sessionStorage.setItem('_adm_tok', data.token)
      onSuccess(data.token)
    } catch {
      setError('Could not reach server.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-9">
          <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-white text-lg">🔐</span>
          </div>
          <h1 className="font-bold text-xl text-gray-900 mb-1 tracking-tight">ShopprHQ Admin</h1>
          <p className="text-sm text-gray-500 mb-7">WhatsApp onboarding panel</p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoFocus
              className={INPUT}
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading || !password}
              className={cn(BTN, 'w-full bg-gray-900 text-white hover:bg-gray-700 py-3')}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [token,   setToken]   = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const t = sessionStorage.getItem('_adm_tok')
    setToken(t)
    setChecked(true)
  }, [])

  if (!checked) return null

  if (!token) {
    return <AdminLogin onSuccess={t => { sessionStorage.setItem('_adm_tok', t); setToken(t) }} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs">S</span>
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">ShopprHQ Admin</span>
            <span className="text-xs text-gray-400 font-medium hidden sm:block">WhatsApp Onboarding</span>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('_adm_tok'); setToken(null) }}
            className="text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8">
        <StoreList token={token} />
      </main>
    </div>
  )
}
