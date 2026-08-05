'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { StoreList, ApplicationsList, adminReq, INPUT, BTN } from '../_shared'

// ══════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════

const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? 'https://ap.shopprhq.com'
const AUTH_BASE = `${API_ROOT}/admin`

const ALL_PERMISSIONS = [
  { key: 'view_clients',                 label: 'View clients' },
  { key: 'manage_whatsapp_onboarding',   label: 'Manage WhatsApp onboarding' },
  { key: 'manage_merchant_applications', label: 'Manage merchant applications' },
] as const

type PermissionKey = typeof ALL_PERMISSIONS[number]['key']

interface Session {
  token: string
  adminId: string
  name: string
  isSuperadmin: boolean
  permissions: PermissionKey[]
  mustChangePassword: boolean
}

interface Worker {
  id: string
  name: string
  email: string
  is_superadmin: boolean
  permissions: PermissionKey[]
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
  created_at: string
}

// ══════════════════════════════════════════════════════════════════════════
// API HELPER — for /admin/auth/* and /admin/workers* (JWT-only, no legacy path)
// ══════════════════════════════════════════════════════════════════════════

async function authReq<T>(path: string, token: string | null, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.detail ?? 'Request failed')
  return data as T
}

function saveSession(s: Session) {
  sessionStorage.setItem('_adm_acct', JSON.stringify(s))
}
function loadSession(): Session | null {
  const raw = sessionStorage.getItem('_adm_acct')
  return raw ? JSON.parse(raw) : null
}
function clearSession() {
  sessionStorage.removeItem('_adm_acct')
}

// ══════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════

function LoginForm({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await authReq<{
        access_token: string; admin_id: string; name: string
        is_superadmin: boolean; permissions: PermissionKey[]; must_change_password: boolean
      }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      const session: Session = {
        token: data.access_token,
        adminId: data.admin_id,
        name: data.name,
        isSuperadmin: data.is_superadmin,
        permissions: data.permissions,
        mustChangePassword: data.must_change_password,
      }
      saveSession(session)
      onSuccess(session)
    } catch (err: any) {
      setError(err.message ?? 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-9">
          <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-white text-lg">👤</span>
          </div>
          <h1 className="font-bold text-xl text-gray-900 mb-1 tracking-tight">ShopprHQ Admin</h1>
          <p className="text-sm text-gray-500 mb-7">Sign in with your admin account</p>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoFocus
              className={INPUT}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              className={INPUT}
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading || !email || !password}
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
// FORCE PASSWORD CHANGE (first login after being created by a superadmin)
// ══════════════════════════════════════════════════════════════════════════

function ChangePasswordForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm,      setConfirm]     = useState('')
  const [loading,       setLoading]     = useState(false)
  const [error,         setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirm) { setError("Passwords don't match."); return }
    setLoading(true)
    try {
      await authReq('/auth/change-password', session.token, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      })
      const updated = { ...session, mustChangePassword: false }
      saveSession(updated)
      onDone()
    } catch (err: any) {
      setError(err.message ?? 'Could not change password')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-9">
          <h1 className="font-bold text-xl text-gray-900 mb-1 tracking-tight">Set a new password</h1>
          <p className="text-sm text-gray-500 mb-7">
            You're signing in with a temporary password — choose your own before continuing.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError('') }}
              autoFocus
              className={INPUT}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              className={INPUT}
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}
              className={cn(BTN, 'w-full bg-gray-900 text-white hover:bg-gray-700 py-3')}>
              {loading ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// CREATE WORKER (superadmin only)
// ══════════════════════════════════════════════════════════════════════════

function CreateWorkerForm({ session, onCreated }: { session: Session; onCreated: () => void }) {
  const [name,        setName]        = useState('')
  const [email,        setEmail]        = useState('')
  const [permissions,  setPermissions]  = useState<PermissionKey[]>([])
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [result,       setResult]       = useState<{ email: string; password: string } | null>(null)

  function togglePermission(key: PermissionKey) {
    setPermissions(p => p.includes(key) ? p.filter(x => x !== key) : [...p, key])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setResult(null); setLoading(true)
    try {
      const data = await authReq<{ email: string; temporary_password: string }>(
        '/workers', session.token, {
          method: 'POST',
          body: JSON.stringify({ name, email, permissions, confirm_password: confirmPassword }),
        }
      )
      setResult({ email: data.email, password: data.temporary_password })
      setName(''); setEmail(''); setPermissions([]); setConfirmPassword('')
      onCreated()
    } catch (err: any) {
      setError(err.message ?? 'Could not create worker')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
      <h2 className="font-bold text-gray-900 mb-1">Create a worker</h2>
      <p className="text-sm text-gray-500 mb-5">
        Pick exactly what this person can do. They'll get an email with a temporary password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid sm:grid-cols-2 gap-3">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className={INPUT} />
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Permissions</p>
          <div className="space-y-2">
            {ALL_PERMISSIONS.map(p => (
              <label key={p.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.includes(p.key)}
                  onChange={() => togglePermission(p.key)}
                  className="rounded border-gray-300"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <input
            type="password"
            placeholder="Your password (step-up confirmation)"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className={INPUT}
          />
          <p className="text-xs text-gray-400 mt-1">
            Your own account password — re-entered here so a stolen session token alone
            can't be used to create backdoor accounts.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        {result && (
          <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800">
            <p className="font-semibold mb-1">✓ Worker created — {result.email}</p>
            <p>Temporary password (also emailed to them, shown here once):</p>
            <code className="block mt-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 font-mono text-xs">
              {result.password}
            </code>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name || !email || !confirmPassword || permissions.length === 0}
          className={cn(BTN, 'bg-gray-900 text-white hover:bg-gray-700')}
        >
          {loading ? 'Creating…' : 'Create worker'}
        </button>
      </form>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// WORKERS LIST (superadmin only)
// ══════════════════════════════════════════════════════════════════════════

function WorkersList({ session, refreshKey }: { session: Session; refreshKey: number }) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading,  setLoading] = useState(true)
  const [error,    setError]   = useState('')
  const [resetResult, setResetResult] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await authReq<Worker[]>('/workers', session.token)
      setWorkers(data.filter(w => !w.is_superadmin))
    } catch (err: any) {
      setError(err.message ?? 'Could not load workers')
    } finally { setLoading(false) }
  }, [session.token])

  useEffect(() => { load() }, [load, refreshKey])

  async function toggleActive(w: Worker) {
    try {
      await authReq(`/workers/${w.id}`, session.token, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !w.is_active }),
      })
      load()
    } catch (err: any) {
      alert(err.message ?? 'Could not update worker')
    }
  }

  async function resetPassword(w: Worker) {
    try {
      const data = await authReq<{ temporary_password: string }>(
        `/workers/${w.id}/reset-password`, session.token, { method: 'POST' }
      )
      setResetResult(r => ({ ...r, [w.id]: data.temporary_password }))
    } catch (err: any) {
      alert(err.message ?? 'Could not reset password')
    }
  }

  if (loading) return <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (workers.length === 0) return <p className="text-sm text-gray-400">No workers yet.</p>

  return (
    <div className="space-y-3">
      {workers.map(w => (
        <div key={w.id} className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-gray-900">{w.name}</p>
              <p className="text-sm text-gray-500">{w.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {w.permissions.map(p => (
                  <span key={p} className="text-xs bg-gray-100 text-gray-600 rounded-lg px-2 py-1">
                    {ALL_PERMISSIONS.find(a => a.key === p)?.label ?? p}
                  </span>
                ))}
                <span className={cn(
                  'text-xs rounded-lg px-2 py-1 font-semibold',
                  w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                )}>
                  {w.is_active ? 'Active' : 'Disabled'}
                </span>
                {w.must_change_password && (
                  <span className="text-xs bg-amber-100 text-amber-700 rounded-lg px-2 py-1">
                    Hasn't logged in yet
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => resetPassword(w)}
                className={cn(BTN, 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400 text-xs px-3 py-1.5')}>
                Reset password
              </button>
              <button onClick={() => toggleActive(w)}
                className={cn(
                  BTN, 'text-xs px-3 py-1.5',
                  w.is_active
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                )}>
                {w.is_active ? 'Disable' : 'Re-enable'}
              </button>
            </div>
          </div>
          {resetResult[w.id] && (
            <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800 mt-3">
              <p>New temporary password (they'll need to set their own on next login):</p>
              <code className="block mt-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 font-mono text-xs">
                {resetResult[w.id]}
              </code>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// READ-ONLY CLIENTS TABLE — for workers who only have view_clients
// ══════════════════════════════════════════════════════════════════════════

function ClientsTable({ session }: { session: Session }) {
  const [clients, setClients] = useState<any[]>([])
  const [loading,  setLoading] = useState(true)
  const [error,    setError]   = useState('')

  useEffect(() => {
    (async () => {
      try {
        const data = await adminReq<{ clients: any[] }>('/clients', session.token)
        setClients(data.clients)
      } catch (err: any) {
        setError(err.message ?? 'Could not load clients')
      } finally { setLoading(false) }
    })()
  }, [session.token])

  if (loading) return <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="text-left px-4 py-2.5">Store</th>
            <th className="text-left px-4 py-2.5">Merchant</th>
            <th className="text-left px-4 py-2.5">WhatsApp</th>
            <th className="text-left px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map(c => (
            <tr key={c.id}>
              <td className="px-4 py-2.5 font-medium text-gray-900">{c.store_name}</td>
              <td className="px-4 py-2.5 text-gray-600">{c.merchant_name}</td>
              <td className="px-4 py-2.5 text-gray-600">{c.whatsapp_number || '—'}</td>
              <td className="px-4 py-2.5 text-gray-600">{c.onboarding_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<'workers' | 'onboarding' | 'applications' | 'clients'>(
    session.isSuperadmin ? 'workers' : (
      session.permissions.includes('manage_whatsapp_onboarding') ? 'onboarding' :
      session.permissions.includes('manage_merchant_applications') ? 'applications' :
      'clients'
    )
  )

  const tabs: { id: typeof tab; label: string; show: boolean }[] = [
    { id: 'workers',      label: 'Workers',      show: session.isSuperadmin },
    { id: 'onboarding',   label: 'WhatsApp Onboarding', show: session.isSuperadmin || session.permissions.includes('manage_whatsapp_onboarding') },
    { id: 'applications', label: 'Applications', show: session.isSuperadmin || session.permissions.includes('manage_merchant_applications') },
    { id: 'clients',      label: 'Clients',      show: !session.isSuperadmin && session.permissions.includes('view_clients') && !session.permissions.includes('manage_whatsapp_onboarding') },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs">S</span>
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">
              {session.name} {session.isSuperadmin && <span className="text-gray-400 font-normal">· Superadmin</span>}
            </span>
          </div>
          <button onClick={onSignOut} className="text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors">
            Sign out
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-5 flex gap-1 pb-2">
          {tabs.filter(t => t.show).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8">
        {tab === 'workers' && (
          <>
            <CreateWorkerForm session={session} onCreated={() => setRefreshKey(k => k + 1)} />
            <WorkersList session={session} refreshKey={refreshKey} />
          </>
        )}
        {tab === 'onboarding'   && <StoreList token={session.token} />}
        {tab === 'applications' && <ApplicationsList token={session.token} />}
        {tab === 'clients'      && <ClientsTable session={session} />}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

export default function AdminAccountsPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setSession(loadSession())
    setChecked(true)
  }, [])

  if (!checked) return null

  if (!session) {
    return <LoginForm onSuccess={setSession} />
  }

  if (session.mustChangePassword) {
    return <ChangePasswordForm session={session} onDone={() => setSession({ ...session, mustChangePassword: false })} />
  }

  return (
    <Dashboard
      session={session}
      onSignOut={() => { clearSession(); setSession(null) }}
    />
  )
}
