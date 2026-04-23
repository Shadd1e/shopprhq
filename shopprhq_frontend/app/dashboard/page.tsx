'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  merchantLogin, getMerchantProfile, resendVerification, forgotPassword, resetPassword,
  getClients, createClient, getInventory, createProduct, updateProduct, updateStock,
  updatePersona, updateDelivery, updateOperatorNumber, setupStorePassword, toggleClientPermissions,
  getSubaccountBanks, verifyBankAccount, registerSubaccount, getSubaccount, deactivateSubaccount,
  getOrders, getOrderDetail, confirmCashOrder, dispatchOrder,
  getRevenueSummary,
  type MerchantProfile, type Client, type Product, type Order, type OrderDetail, type Subaccount, type RevenueSummary,
} from '@/lib/api'
import { cn } from '@/lib/utils'

// ══════════════════════════════════════════════════════════════════════════
// LINE ICONS
// ══════════════════════════════════════════════════════════════════════════

const S = 'w-[18px] h-[18px]'
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function IconGrid()     { return <svg className={S} viewBox="0 0 24 24" {...P}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconBox()      { return <svg className={S} viewBox="0 0 24 24" {...P}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IconReceipt()  { return <svg className={S} viewBox="0 0 24 24" {...P}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg> }
function IconSettings() { return <svg className={S} viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function IconPlus()     { return <svg className={S} viewBox="0 0 24 24" {...P}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function IconX()        { return <svg className="w-5 h-5" viewBox="0 0 24 24" {...P}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function IconEdit()     { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function IconEye()      { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function IconTruck()    { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IconCheck()    { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><polyline points="20 6 9 17 4 12"/></svg> }
function IconUser()     { return <svg className={S} viewBox="0 0 24 24" {...P}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function IconPrint()    { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function IconChevron()  { return <svg className="w-4 h-4" viewBox="0 0 24 24" {...P}><polyline points="6 9 12 15 18 9"/></svg> }
function IconHistory()  { return <svg className={S} viewBox="0 0 24 24" {...P}><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><polyline points="3 16 3.05 11 8 11"/></svg> }
function IconMail()     { return <svg className={S} viewBox="0 0 24 24" {...P}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> }
function IconBell()     { return <svg className={S} viewBox="0 0 24 24" {...P}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function IconUpload()   { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> }
function IconDownload() { return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" {...P}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }

// ══════════════════════════════════════════════════════════════════════════
// SHARED STYLES + UTILS
// ══════════════════════════════════════════════════════════════════════════

const INPUT = cn(
  'w-full px-3.5 py-2.5 rounded-[13px]',
  'bg-bg border-[1.5px] border-border',
  'text-sm text-ink placeholder:text-ink-4/50',
  'outline-none transition-all',
  'focus:border-wa focus:bg-white focus:ring-2 focus:ring-wa/10',
)

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function timeAgo(iso?: string) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

const STATUS_STYLE: Record<string, string> = {
  AWAITING_PICKUP:  'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_PAYMENT:  'bg-blue-50 text-blue-700 border-blue-200',
  PAID:             'bg-green-50 text-green-700 border-green-200',
  OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FULFILLED:        'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED:        'bg-red-50 text-red-700 border-red-200',
  CREATED:          'bg-bg text-ink-3 border-border',
}

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PICKUP:  'Awaiting Pickup',
  PENDING_PAYMENT:  'Pending Payment',
  PAID:             'Paid',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  FULFILLED:        'Fulfilled',
  CANCELLED:        'Cancelled',
  CREATED:          'Created',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'text-[11px] font-semibold border px-2.5 py-0.5 rounded-full whitespace-nowrap',
      STATUS_STYLE[status] ?? 'bg-bg text-ink-3 border-border',
    )}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ══════════════════════════════════════════════════════════════════════════

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4
        bg-ink/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl border border-border shadow-xl w-full max-w-lg
        max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h3 className="font-display font-bold text-lg text-ink tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink transition-colors">
            <IconX />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// RECEIPT PRINTING
// ══════════════════════════════════════════════════════════════════════════

function printReceipt(detail: OrderDetail) {
  const win = window.open('', '_blank', 'width=420,height=680')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt #${detail.order_code}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:monospace;font-size:13px;padding:24px;max-width:320px;margin:0 auto}
    .c{text-align:center}.b{font-weight:bold}.lg{font-size:18px}
    .div{border-top:1px dashed #555;margin:10px 0}
    .row{display:flex;justify-content:space-between;padding:3px 0}
    .sm{font-size:11px;color:#555}
    @media print{@page{margin:8mm}}
  </style></head><body>
  <div class="c b lg">ShopprHQ</div>
  ${detail.store_name ? `<div class="c sm">${detail.store_name}</div>` : ''}
  <div class="div"></div>
  <div class="c b">ORDER #${detail.order_code}</div>
  <div class="c sm">${detail.created_at ? new Date(detail.created_at).toLocaleString('en-NG') : ''}</div>
  <div class="div"></div>
  <div class="row"><span>Customer</span><span class="b">${detail.customer_name || '—'}</span></div>
  <div class="row"><span>Phone</span><span>${detail.user_id}</span></div>
  <div class="row"><span>Payment</span><span class="b" style="text-transform:capitalize">${detail.payment_method}</span></div>
  ${detail.delivery_address ? `<div class="row"><span>Delivery</span><span>${detail.delivery_address}</span></div>` : ''}
  <div class="div"></div>
  <div class="b" style="margin-bottom:6px">Items</div>
  ${detail.items.map(i => `<div class="row"><span>${i.product_name} ×${i.quantity}</span><span>₦${i.subtotal.toLocaleString()}</span></div>`).join('')}
  <div class="div"></div>
  <div class="row b lg"><span>TOTAL</span><span>₦${detail.total_amount.toLocaleString()}</span></div>
  ${detail.delivery_fee ? `<div class="row sm"><span>incl. delivery fee</span><span>₦${detail.delivery_fee.toLocaleString()}</span></div>` : ''}
  <div class="div"></div>
  <div class="c sm">Status: ${detail.status.replace(/_/g,' ')}</div>
  <div class="c sm" style="margin-top:12px">Thank you for your order!</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
  </body></html>`)
  win.document.close()
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORY VIEW
// ══════════════════════════════════════════════════════════════════════════

type RevPeriod = 'weekly' | 'monthly'

const HISTORY_STATUS_GROUPS = [
  { key: 'FULFILLED',        label: 'Fulfilled',        color: 'text-emerald-700' },
  { key: 'AWAITING_PICKUP',  label: 'Awaiting Pickup',  color: 'text-amber-700' },
  { key: 'PENDING_PAYMENT',  label: 'Pending Payment',  color: 'text-blue-600' },
  { key: 'CANCELLED',        label: 'Cancelled',        color: 'text-red-600' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'text-indigo-600' },
]

function RevenueBarChart({ data }: { data: RevenueSummary }) {
  const maxRevenue = Math.max(...data.daily.map(d => d.revenue), 1)
  if (data.daily.length === 0) return null
  return (
    <div className="bg-white border border-border rounded-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-5">
        Revenue by {data.period === 'weekly' ? 'week' : 'month'} · fulfilled orders only
      </p>
      <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: '120px' }}>
        {data.daily.map((d, i) => {
          const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 group"
              title={`${d.label}: ${fmt(d.revenue)}`}>
              <p className="text-[10px] font-semibold text-wa opacity-0 group-hover:opacity-100
                transition-opacity whitespace-nowrap">
                {fmt(d.revenue)}
              </p>
              <div className="relative w-8 bg-bg border border-border rounded-t-lg"
                style={{ height: '80px' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 bg-wa rounded-t-lg transition-all group-hover:bg-wa-dark"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <p className="text-[10px] text-ink-4 text-center leading-tight whitespace-nowrap max-w-[56px] truncate">
                {d.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HistoryView({ orders, token, merchantId, onClose, onOrderClick }: {
  orders: Order[]
  token: string
  merchantId: string
  onClose: () => void
  onOrderClick: (id: string) => void
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [period,      setPeriod]      = useState<RevPeriod>('weekly')
  const [revData,     setRevData]     = useState<RevenueSummary | null>(null)
  const [revLoading,  setRevLoading]  = useState(true)
  const [revError,    setRevError]    = useState('')

  useEffect(() => {
    let cancelled = false
    setRevLoading(true); setRevError('')
    getRevenueSummary(token, merchantId, undefined, period)
      .then(d  => { if (!cancelled) setRevData(d) })
      .catch(e => { if (!cancelled) setRevError(e?.detail ?? 'Could not load revenue data.') })
      .finally(() => { if (!cancelled) setRevLoading(false) })
    return () => { cancelled = true }
  }, [token, merchantId, period])

  const periodLabel = period === 'weekly' ? 'last 8 weeks' : 'last 12 months'

  const days = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of orders) {
      const key = o.created_at
        ? new Date(o.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
        : 'Unknown date'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const ta = a[1][0]?.created_at ? new Date(a[1][0].created_at).getTime() : 0
        const tb = b[1][0]?.created_at ? new Date(b[1][0].created_at).getTime() : 0
        return tb - ta
      })
      .map(([label, dayOrders]) => {
        const sorted = [...dayOrders].sort((a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        )
        const revenue = dayOrders
          .filter(o => ['PAID','FULFILLED'].includes(o.status))
          .reduce((s, o) => s + o.total_amount, 0)
        return { label, orders: sorted, revenue, count: dayOrders.length }
      })
  }, [orders])

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-4">
          <button onClick={onClose}
            className="flex items-center gap-2 text-sm font-semibold text-ink-3 hover:text-ink
              px-3 py-2 rounded-xl hover:bg-bg transition-colors -ml-3">
            ← Back
          </button>
          <h1 className="font-display font-extrabold text-lg text-ink tracking-tight flex-1">
            Revenue History
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* Period toggle */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 w-fit">
          {(['weekly', 'monthly'] as RevPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                period === p ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink hover:bg-bg',
              )}>
              {p === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>

        {/* Revenue summary */}
        {revLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : revError ? (
          <p className="text-sm text-red-600 text-center py-4">{revError}</p>
        ) : revData ? (
          <>
            <div className="bg-ink text-white rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                Revenue · {periodLabel}
              </p>
              <p className="font-display font-extrabold text-4xl">{fmt(revData.total_revenue)}</p>
            </div>

            {revData.daily.length > 0
              ? <RevenueBarChart data={revData} />
              : <div className="bg-white border border-border rounded-3xl py-12 text-center">
                  <p className="text-sm text-ink-4">No revenue yet for this period.</p>
                </div>
            }

            <div className="bg-white border border-border rounded-3xl p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-4">
                Order breakdown · {periodLabel}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {HISTORY_STATUS_GROUPS.map(s => (
                  <div key={s.key} className="bg-bg border border-border rounded-2xl p-4">
                    <p className="text-[11px] font-semibold text-ink-4 mb-1">{s.label}</p>
                    <p className={cn('font-display font-extrabold text-2xl', s.color)}>
                      {revData.counts_by_status[s.key] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {/* Order list */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-3 px-1">
            All orders · by day
          </p>
          {days.length === 0 ? (
            <div className="bg-white border border-border rounded-3xl py-16 text-center">
              <p className="text-sm text-ink-4">No order history yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-3xl overflow-hidden">
              {days.map((day, i) => (
                <div key={day.label} className={cn(i > 0 && 'border-t border-border')}>
                  <button
                    onClick={() => setExpandedDay(expandedDay === day.label ? null : day.label)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-bg/50
                      transition-colors text-left">
                    <div>
                      <p className="text-sm font-semibold text-ink">{day.label}</p>
                      <p className="text-xs text-ink-4 mt-0.5">
                        {day.count} order{day.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-base text-ink">{fmt(day.revenue)}</span>
                      <span className={cn('text-ink-4 transition-transform',
                        expandedDay === day.label && 'rotate-180')}>
                        <IconChevron />
                      </span>
                    </div>
                  </button>

                  {expandedDay === day.label && (
                    <div className="border-t border-border bg-bg/40 divide-y divide-border">
                      {day.orders.map(o => (
                        <div key={o.id} onClick={() => onOrderClick(o.id)}
                          className="px-6 py-3.5 flex items-center gap-4 hover:bg-bg
                            transition-colors cursor-pointer">
                          <span className="font-mono text-xs font-semibold text-ink bg-white border
                            border-border px-2.5 py-1 rounded-lg shrink-0">
                            {o.order_code}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                              {o.customer_name || o.user_id}
                            </p>
                            <p className="text-xs text-ink-4 mt-0.5">{timeAgo(o.created_at)}</p>
                          </div>
                          <span className="text-sm font-semibold text-ink shrink-0">
                            {fmt(o.total_amount)}
                          </span>
                          <StatusBadge status={o.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════

function OverviewTab({ orders, products, profile, loading, onOrderClick }: {
  orders: Order[]; products: Product[]; profile: MerchantProfile | null
  loading: boolean; onOrderClick: (id: string) => void
}) {
  const today        = new Date().toDateString()
  const todayOrders  = orders.filter(o => o.created_at && new Date(o.created_at).toDateString() === today)
  const todayRevenue = todayOrders.filter(o => ['PAID','FULFILLED'].includes(o.status))
                         .reduce((s, o) => s + o.total_amount, 0)
  const pending      = orders.filter(o => o.status === 'AWAITING_PICKUP').length
  const recentOrders = [...orders].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  ).slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        {loading
          ? <div className="skeleton h-8 w-48 rounded-lg" />
          : <h2 className="font-display font-extrabold text-2xl text-ink tracking-tight">
              Welcome back, {profile?.name ?? 'there'}
            </h2>
        }
        <p className="text-sm text-ink-4 mt-1">Here's today's snapshot of your store.</p>
      </div>

      {/* Stats — today only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Orders",  value: loading ? null : todayOrders.length.toString() },
          { label: "Today's Revenue", value: loading ? null : fmt(todayRevenue) },
          { label: 'Pending',         value: loading ? null : pending.toString() },
          { label: 'Items',           value: loading ? null : products.length.toString() },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-4 mb-2">
              {s.label}
            </p>
            {s.value === null
              ? <div className="skeleton h-8 w-16 rounded-lg" />
              : <p className="font-display font-extrabold text-2xl text-ink tracking-tight">{s.value}</p>
            }
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-border rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="font-semibold text-sm text-ink">Recent orders</p>
        </div>
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-4 w-32 rounded flex-1" />
                <div className="skeleton h-4 w-16 rounded" />
                <div className="skeleton h-6 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-ink-4">No orders yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map(o => (
              <div key={o.id} onClick={() => onOrderClick(o.id)}
                className="px-6 py-4 flex items-center gap-4 hover:bg-bg/50 transition-colors cursor-pointer">
                <span className="font-mono text-xs font-semibold text-ink bg-bg border border-border
                  px-2.5 py-1 rounded-lg shrink-0">
                  {o.order_code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-3 truncate">{o.customer_name || o.user_id}</p>
                  <p className="text-xs text-ink-4 mt-0.5">{timeAgo(o.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-ink shrink-0">{fmt(o.total_amount)}</span>
                <StatusBadge status={o.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ORDERS TAB
// ══════════════════════════════════════════════════════════════════════════

function OrdersTab({ orders, loading, onOpenDetail }: {
  orders: Order[]; loading: boolean; onOpenDetail: (id: string) => void
}) {
  const [filter, setFilter] = useState<string>('ALL')

  const FILTERS = ['ALL','AWAITING_PICKUP','OUT_FOR_DELIVERY','PAID','FULFILLED','CANCELLED']
  const visible = filter === 'ALL' ? orders : orders.filter(o => o.status === filter)
  const sorted  = [...visible].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )

  return (
    <>
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              'text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all',
              filter === f
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-ink-3 border-border hover:border-ink-4 hover:text-ink',
            )}>
            {f === 'ALL' ? 'All orders' : (STATUS_LABEL[f] ?? f)}
          </button>
        ))}
      </div>

      <div className="bg-white border border-border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="skeleton h-4 w-16 rounded" />
                <div className="skeleton h-4 flex-1 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-6 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-ink mb-1">No orders</p>
            <p className="text-xs text-ink-4">Orders from your WhatsApp store appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map(o => (
              <div key={o.id} onClick={() => onOpenDetail(o.id)}
                className="px-6 py-4 flex items-center gap-4 hover:bg-bg/50 transition-colors cursor-pointer">
                <span className="font-mono text-xs font-semibold text-ink bg-bg border border-border
                  px-2.5 py-1 rounded-lg shrink-0">
                  {o.order_code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{o.customer_name || o.user_id}</p>
                  <p className="text-xs text-ink-4 mt-0.5">{timeAgo(o.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-ink shrink-0">{fmt(o.total_amount)}</span>
                <span className="text-xs text-ink-4 shrink-0 hidden sm:block capitalize">{o.payment_method}</span>
                <StatusBadge status={o.status} />
                <span className="shrink-0 p-2 text-ink-4"><IconEye /></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Row({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-ink-4 shrink-0">{label}</span>
      <span className={cn('text-xs font-semibold text-ink text-right', capitalize && 'capitalize')}>
        {value}
      </span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ══════════════════════════════════════════════════════════════════════════

type CsvRow = { name: string; price: string; description: string; category: string; initial_stock: string }
type CsvResult = { row: number; name: string; ok: boolean; error?: string }

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const idx = (col: string) => header.indexOf(col)
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))
    return {
      name:          cols[idx('name')]          ?? '',
      price:         cols[idx('price')]         ?? '',
      description:   cols[idx('description')]   ?? '',
      category:      cols[idx('category')]      ?? '',
      initial_stock: cols[idx('initial_stock')] ?? '0',
    }
  })
}

function downloadTemplate() {
  const csv = 'name,price,description,category,initial_stock\nJollof Rice (large),1500,Full plate with chicken,Food,50\nChilled Coke,400,,Drinks,100\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'inventory_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

function InventoryTab({ products, clients, loading, token, merchantId, onRefresh }: {
  products: Product[]; clients: Client[]; loading: boolean
  token: string; merchantId: string; onRefresh: () => void
}) {
  const [addOpen,    setAddOpen]    = useState(false)
  const [csvOpen,    setCsvOpen]    = useState(false)
  const [editProd,   setEditProd]   = useState<Product | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [addErr,     setAddErr]     = useState('')
  const [editErr,    setEditErr]    = useState('')
  const [csvResults, setCsvResults] = useState<CsvResult[] | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvClientId,  setCsvClientId]  = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [addForm, setAddForm] = useState({
    name: '', price: '', description: '', category: '', initial_stock: '0', client_id: '',
  })
  const [editForm, setEditForm] = useState({
    name: '', price: '', description: '', category: '', stock: '',
  })

  function setA(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setAddForm(p => ({ ...p, [k]: e.target.value })); setAddErr('')
    }
  }
  function setE(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setEditForm(p => ({ ...p, [k]: e.target.value })); setEditErr('')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.name.trim()) return setAddErr('Product name is required.')
    if (!addForm.price || isNaN(+addForm.price) || +addForm.price <= 0) return setAddErr('Enter a valid price.')
    const clientId = addForm.client_id || clients[0]?.id
    if (!clientId) return setAddErr('No store found. Create a store first in Settings.')
    setSaving(true)
    try {
      await createProduct(token, merchantId, clientId, {
        name: addForm.name.trim(),
        price: +addForm.price,
        description: addForm.description || undefined,
        category: addForm.category || undefined,
        initial_stock: +addForm.initial_stock || 0,
      })
      setAddOpen(false)
      setAddForm({ name: '', price: '', description: '', category: '', initial_stock: '0', client_id: '' })
      onRefresh()
    } catch (err: any) {
      setAddErr(err.detail ?? 'Could not create item.')
    } finally { setSaving(false) }
  }

  function openEdit(p: Product) {
    setEditProd(p)
    setEditErr('')
    setEditForm({
      name: p.name,
      price: String(p.price),
      description: p.description ?? '',
      category: p.category ?? '',
      stock: String(p.inventory?.quantity ?? 0),
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editProd) return
    setSaving(true)
    setEditErr('')
    const clientId = editProd.client_id ?? editProd._client?.id ?? ''
    try {
      const origStock = editProd.inventory?.quantity ?? 0
      const newStock  = +editForm.stock
      await Promise.all([
        updateProduct(token, merchantId, clientId, editProd.id, {
          name:        editForm.name        || undefined,
          price:       editForm.price       ? +editForm.price : undefined,
          description: editForm.description || undefined,
          category:    editForm.category    || undefined,
        }),
        ...(newStock !== origStock
          ? [updateStock(token, merchantId, clientId, editProd.id, newStock)]
          : []),
      ])
      setEditProd(null)
      onRefresh()
    } catch (err: any) {
      setEditErr(err.detail ?? 'Could not save changes.')
    } finally { setSaving(false) }
  }

  async function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) return
    const clientId = csvClientId || clients[0]?.id
    if (!clientId) return
    setCsvImporting(true)
    setCsvResults(null)
    const results: CsvResult[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.name.trim() || !r.price || isNaN(+r.price) || +r.price <= 0) {
        results.push({ row: i + 2, name: r.name || '(blank)', ok: false, error: 'Missing name or invalid price' })
        continue
      }
      try {
        await createProduct(token, merchantId, clientId, {
          name:          r.name.trim(),
          price:         +r.price,
          description:   r.description  || undefined,
          category:      r.category     || undefined,
          initial_stock: +r.initial_stock || 0,
        })
        results.push({ row: i + 2, name: r.name, ok: true })
      } catch (err: any) {
        results.push({ row: i + 2, name: r.name, ok: false, error: err.detail ?? 'Failed' })
      }
    }
    setCsvResults(results)
    setCsvImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    if (results.some(r => r.ok)) onRefresh()
  }

  const csvOk   = csvResults?.filter(r => r.ok).length  ?? 0
  const csvFail = csvResults?.filter(r => !r.ok).length ?? 0

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ink-4">
          {loading ? '—' : `${products.length} item${products.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCsvOpen(true)}
            className="flex items-center gap-1.5 border border-border bg-white text-ink-3 text-sm font-semibold
              px-3.5 py-2.5 rounded-xl hover:text-ink hover:border-ink-4 transition-all"
          >
            <IconUpload />
            Import CSV
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-ink text-white text-sm font-semibold
              px-4 py-2.5 rounded-xl hover:bg-ink-2 transition-all hover:-translate-y-px"
          >
            <IconPlus />
            Add item
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="skeleton h-4 flex-1 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-ink mb-1">No items yet</p>
            <p className="text-xs text-ink-4 mb-4">Add your first item to start taking orders.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 bg-wa text-white text-sm font-semibold
                px-5 py-2.5 rounded-xl shadow-wa hover:bg-wa-dark transition-all"
            >
              <IconPlus /> Add item
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3
              border-b border-border text-[11px] font-semibold uppercase tracking-wider text-ink-4">
              <span>Name</span>
              <span className="text-right">Price</span>
              <span className="text-right">Stock</span>
              <span className="hidden sm:block">Store</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {products.map(p => {
                const qty   = p.inventory?.quantity ?? 0
                const thresh = p.inventory?.low_stock_threshold
                const isLow  = thresh != null && qty > 0 && qty <= thresh
                const isOut  = qty === 0
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4
                    items-center px-6 py-4 hover:bg-bg/50 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      {p.category && <p className="text-xs text-ink-4 truncate mt-0.5">{p.category}</p>}
                    </div>
                    <span className="text-sm font-semibold text-ink text-right">{fmt(p.price)}</span>
                    <span className={cn(
                      'text-xs font-semibold border px-2.5 py-0.5 rounded-full whitespace-nowrap',
                      isOut ? 'bg-red-50 text-red-600 border-red-200' :
                      isLow ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-green-50 text-green-700 border-green-200',
                    )}>
                      {isOut ? 'Out of stock' : `${qty} in stock`}
                    </span>
                    <span className="text-xs text-ink-4 hidden sm:block">
                      {p._client?.name || p.client_id}
                    </span>
                    <button onClick={() => openEdit(p)}
                      className="p-2 rounded-xl text-ink-4 hover:text-ink hover:bg-border/60 transition-all">
                      <IconEdit />
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Add item modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add inventory item">
        <form onSubmit={handleAdd} className="space-y-4">
          <FormField label="Item name">
            <input type="text" placeholder="e.g. Jollof Rice (large)" value={addForm.name} onChange={setA('name')} className={INPUT} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Price (₦)">
              <input type="number" placeholder="1500" min="1" step="any" value={addForm.price} onChange={setA('price')} className={INPUT} />
            </FormField>
            <FormField label="Initial stock">
              <input type="number" placeholder="0" min="0" value={addForm.initial_stock} onChange={setA('initial_stock')} className={INPUT} />
            </FormField>
          </div>
          <FormField label="Category (optional)">
            <input type="text" placeholder="e.g. Food, Electronics" value={addForm.category} onChange={setA('category')} className={INPUT} />
          </FormField>
          <FormField label="Description (optional)">
            <textarea placeholder="Short description" value={addForm.description}
              onChange={setA('description') as any} rows={2} className={cn(INPUT, 'resize-none')} />
          </FormField>
          {clients.length > 1 && (
            <FormField label="Store">
              <select value={addForm.client_id} onChange={setA('client_id')} className={INPUT}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
              </select>
            </FormField>
          )}
          {addErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{addErr}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-wa text-white font-semibold text-sm py-3 rounded-xl shadow-wa
              hover:bg-wa-dark transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Add item'}
          </button>
        </form>
      </Modal>

      {/* CSV import modal */}
      <Modal open={csvOpen} onClose={() => { setCsvOpen(false); setCsvResults(null) }} title="Import inventory via CSV">
        <div className="space-y-4">
          <div className="bg-bg rounded-2xl px-4 py-3">
            <p className="text-xs text-ink-3 leading-relaxed mb-3">
              Upload a CSV file with columns: <span className="font-semibold text-ink">name, price, description, category, initial_stock</span>.
              Name and price are required. Download the template to get started.
            </p>
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs font-semibold text-wa border border-wa/30
                px-3 py-2 rounded-xl hover:bg-wa/5 transition-colors">
              <IconDownload /> Download template
            </button>
          </div>

          {clients.length > 1 && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">Import into store</label>
              <select value={csvClientId} onChange={e => setCsvClientId(e.target.value)} className={INPUT}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
              </select>
            </div>
          )}

          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={handleCsvFile} />

          {!csvResults && (
            <button
              disabled={csvImporting}
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border
                rounded-2xl py-8 text-sm font-semibold text-ink-4 hover:border-wa hover:text-wa
                transition-colors disabled:opacity-50 cursor-pointer"
            >
              {csvImporting
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-wa border-t-transparent rounded-full" /> Importing…</>
                : <><IconUpload /> Choose CSV file</>
              }
            </button>
          )}

          {csvResults && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm font-semibold">
                <span className="text-green-700">{csvOk} imported</span>
                {csvFail > 0 && <span className="text-red-600">{csvFail} failed</span>}
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-border rounded-2xl border border-border text-xs">
                {csvResults.map(r => (
                  <div key={r.row} className={cn('flex items-start gap-2 px-3 py-2', r.ok ? 'bg-green-50/50' : 'bg-red-50/50')}>
                    <span className={cn('font-semibold shrink-0', r.ok ? 'text-green-700' : 'text-red-600')}>
                      {r.ok ? '✓' : '✗'} Row {r.row}
                    </span>
                    <span className="text-ink truncate">{r.name}</span>
                    {r.error && <span className="text-red-500 ml-auto shrink-0">{r.error}</span>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs font-semibold text-ink-3 hover:text-ink underline"
              >
                Import another file
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit item modal */}
      <Modal open={!!editProd} onClose={() => setEditProd(null)} title="Edit item">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="bg-bg rounded-2xl px-4 py-3 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-4 mb-3">Stock</p>
            <FormField label="Quantity in stock">
              <input type="number" min="0" value={editForm.stock} onChange={setE('stock')} className={INPUT} />
            </FormField>
          </div>
          <div className="bg-bg rounded-2xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-4 mb-3">Product details</p>
            <div className="space-y-3">
              <FormField label="Name">
                <input type="text" value={editForm.name} onChange={setE('name')} className={INPUT} />
              </FormField>
              <FormField label="Price (₦)">
                <input type="number" min="1" step="any" value={editForm.price} onChange={setE('price')} className={INPUT} />
              </FormField>
              <FormField label="Category (optional)">
                <input type="text" value={editForm.category} onChange={setE('category')} className={INPUT} />
              </FormField>
              <FormField label="Description (optional)">
                <textarea value={editForm.description} onChange={setE('description') as any}
                  rows={2} className={cn(INPUT, 'resize-none')} />
              </FormField>
            </div>
          </div>
          {editErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{editErr}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-ink text-white font-semibold text-sm py-3 rounded-xl
              hover:bg-ink-2 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Modal>
    </>
  )
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-4 leading-relaxed">{hint}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// LOGIN VIEW
// ══════════════════════════════════════════════════════════════════════════

type LoginView_Screen = 'login' | 'forgot' | 'reset'

function LoginView({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [screen,  setScreen]  = useState<LoginView_Screen>('login')
  // Login
  const [mid,     setMid]     = useState('')
  const [pin,     setPin]     = useState('')
  // Forgot
  const [fEmail,  setFEmail]  = useState('')
  const [fCode,   setFCode]   = useState('')
  const [fPw,     setFPw]     = useState('')
  const [fPwConf, setFPwConf] = useState('')
  // Shared
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  function resetForgot() { setFEmail(''); setFCode(''); setFPw(''); setFPwConf(''); setError(''); setSuccess('') }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!mid.trim()) return setError('Enter your Merchant ID.')
    if (!pin)        return setError('Enter your PIN.')
    setLoading(true)
    try {
      const data = await merchantLogin(mid.trim().toUpperCase(), pin)
      sessionStorage.setItem('m_tok',  data.access_token)
      sessionStorage.setItem('m_id',   data.merchant_id)
      sessionStorage.setItem('m_name', data.name)
      onSuccess(data.access_token)
    } catch (err: any) {
      setError(err.detail ?? 'Invalid Merchant ID or PIN.')
    } finally { setLoading(false) }
  }

  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fEmail.trim() || !fEmail.includes('@')) return setError('Enter a valid email address.')
    setLoading(true)
    try {
      await forgotPassword(fEmail.trim().toLowerCase())
      setSuccess('Check your email — a 6-digit code has been sent.')
      setScreen('reset')
    } catch (err: any) {
      setError(err.detail ?? 'Could not send reset code. Try again.')
    } finally { setLoading(false) }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fCode.trim() || fCode.length !== 6) return setError('Enter the 6-digit code from your email.')
    if (fPw.length < 6) return setError('New password must be at least 6 characters.')
    if (fPw !== fPwConf) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await resetPassword(fEmail.trim().toLowerCase(), fCode.trim(), fPw)
      resetForgot()
      setScreen('login')
      setSuccess('Password updated — sign in with your new password.')
    } catch (err: any) {
      setError(err.detail ?? 'Could not reset password. Check the code and try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm py-8">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="bg-white rounded-3xl border border-border shadow-lg p-9">

          {screen === 'login' && (
            <>
              <h1 className="font-display font-extrabold text-[1.45rem] tracking-tight text-ink mb-1.5">
                Merchant sign in
              </h1>
              <p className="text-sm text-ink-4 mb-7 leading-relaxed">
                Sign in with your Merchant ID and password.
              </p>
              {success && (
                <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                  {success}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <FormField label="Merchant ID">
                  <input type="text" placeholder="e.g. MR1001" value={mid}
                    onChange={e => { setMid(e.target.value); setError(''); setSuccess('') }}
                    autoComplete="username" autoCapitalize="characters" spellCheck={false}
                    className={INPUT} />
                </FormField>
                <div>
                  <FormField label="Password">
                    <input type="password" placeholder="Your password" value={pin}
                      onChange={e => { setPin(e.target.value); setError(''); setSuccess('') }}
                      autoComplete="current-password" className={INPUT} />
                  </FormField>
                  <div className="text-right mt-1.5">
                    <button type="button"
                      onClick={() => { setScreen('forgot'); setError(''); setSuccess('') }}
                      className="text-xs font-semibold text-wa-dark hover:underline">
                      Forgot password?
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-ink text-white font-semibold text-sm py-3.5 rounded-2xl
                    hover:bg-ink-2 transition-all hover:-translate-y-0.5
                    disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {screen === 'forgot' && (
            <>
              <button onClick={() => { setScreen('login'); setError('') }}
                className="text-xs font-semibold text-ink-3 hover:text-ink mb-5 flex items-center gap-1">
                ← Back to sign in
              </button>
              <h1 className="font-display font-extrabold text-[1.3rem] tracking-tight text-ink mb-1.5">
                Reset your password
              </h1>
              <p className="text-sm text-ink-4 mb-7 leading-relaxed">
                Enter the email address on your merchant account. We'll send a 6-digit code.
              </p>
              <form onSubmit={handleForgotSend} className="space-y-4">
                <FormField label="Email address">
                  <input type="email" placeholder="you@example.com" value={fEmail}
                    onChange={e => { setFEmail(e.target.value); setError('') }}
                    autoComplete="email" className={INPUT} autoFocus />
                </FormField>
                {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-ink text-white font-semibold text-sm py-3.5 rounded-2xl
                    hover:bg-ink-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Sending…' : 'Send reset code'}
                </button>
              </form>
            </>
          )}

          {screen === 'reset' && (
            <>
              <button onClick={() => { setScreen('forgot'); setError('') }}
                className="text-xs font-semibold text-ink-3 hover:text-ink mb-5 flex items-center gap-1">
                ← Back
              </button>
              <h1 className="font-display font-extrabold text-[1.3rem] tracking-tight text-ink mb-1.5">
                Enter your code
              </h1>
              {success && (
                <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                  {success}
                </div>
              )}
              <p className="text-sm text-ink-4 mb-6 leading-relaxed">
                Check <strong>{fEmail}</strong> for the 6-digit code and enter your new password below.
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <FormField label="6-digit code">
                  <input type="text" placeholder="123456" inputMode="numeric" maxLength={6}
                    value={fCode} onChange={e => { setFCode(e.target.value.replace(/\D/g,'')); setError('') }}
                    autoComplete="one-time-code" className={INPUT} autoFocus />
                </FormField>
                <FormField label="New password" hint="Minimum 6 characters.">
                  <input type="password" placeholder="New password" value={fPw}
                    onChange={e => { setFPw(e.target.value); setError('') }}
                    autoComplete="new-password" className={INPUT} />
                </FormField>
                <FormField label="Confirm new password">
                  <input type="password" placeholder="Repeat password" value={fPwConf}
                    onChange={e => { setFPwConf(e.target.value); setError('') }}
                    autoComplete="new-password" className={INPUT} />
                </FormField>
                {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-wa text-white font-semibold text-sm py-3.5 rounded-2xl
                    shadow-wa hover:bg-wa-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Updating…' : 'Set new password'}
                </button>
                <button type="button" onClick={() => handleForgotSend({ preventDefault: () => {} } as any)}
                  className="w-full text-xs text-ink-4 hover:text-ink text-center py-1 transition-colors">
                  Didn't receive it? Resend code
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-5 space-y-3 text-center">
          <p className="text-sm text-ink-4">
            New here?{' '}
            <Link href="/register" className="text-wa-dark font-semibold hover:underline">Create a store →</Link>
          </p>
          <p className="text-sm text-ink-4">
            Store manager?{' '}
            <Link href="/store-login" className="text-wa-dark font-semibold hover:underline">Store sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// STORE ROW (with permission toggle)
// ══════════════════════════════════════════════════════════════════════════

function StoreRow({ c, token, onSetupPw, onRefresh }: {
  c: Client
  token: string
  onSetupPw: () => void
  onRefresh: () => void
}) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      await toggleClientPermissions(token, c.id, !c.client_changes_enabled)
      onRefresh()
    } catch {}
    finally { setToggling(false) }
  }

  return (
    <div className="py-3.5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{c.name || '—'}</p>
        {c.whatsapp_number && <p className="text-xs text-ink-4 mt-0.5">{c.whatsapp_number}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {!c.has_login && (
            <button onClick={onSetupPw}
              className="flex items-center gap-1 text-xs font-semibold text-amber-700
                bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg hover:bg-amber-100 transition-all">
              ⚠ No login — Set password
            </button>
          )}
          {/* Allow store to edit settings toggle */}
          <button onClick={handleToggle} disabled={toggling}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-lg border transition-all',
              c.client_changes_enabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-bg border-border text-ink-3 hover:text-ink hover:bg-white',
            )}>
            {toggling ? '…' : c.client_changes_enabled ? '✓ Store can edit settings' : 'Allow store to edit settings'}
          </button>
        </div>
      </div>
      <span className="font-mono text-xs font-semibold text-ink-3 bg-bg border border-border
        px-2.5 py-1 rounded-lg shrink-0">{c.id}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════════════════

function SettingsTab({ profile, clients, token, onRefresh }: {
  profile: MerchantProfile | null
  clients: Client[]
  token: string
  onRefresh: () => void
}) {
  // ── Store creation ───────────────────────────────────────────────────────
  const [addOpen,      setAddOpen]      = useState(false)
  const [storeSaving,  setStoreSaving]  = useState(false)
  const [storeErr,     setStoreErr]     = useState('')
  const [storeForm,    setStoreForm]    = useState({ name: '', password: '', wa: '' })
  const [storeStep,    setStoreStep]    = useState<1 | 2>(1)
  const [storeWaClean, setStoreWaClean] = useState<string | null>(null)
  const [confirmPw,    setConfirmPw]    = useState('')

  // ── Setup password (for stores without login) ─────────────────────────────
  const [setupPwTarget,  setSetupPwTarget]  = useState<Client | null>(null)
  const [setupPwForm,    setSetupPwForm]    = useState({ password: '', confirm: '' })
  const [setupPwSaving,  setSetupPwSaving]  = useState(false)
  const [setupPwErr,     setSetupPwErr]     = useState('')

  function setSF(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setStoreForm(p => ({ ...p, [k]: e.target.value })); setStoreErr('')
    }
  }

  function handleAddStore(e: React.FormEvent) {
    e.preventDefault()
    if (!storeForm.name.trim()) return setStoreErr('Store name is required.')
    if (!storeForm.password)    return setStoreErr('Password is required.')
    if (storeForm.password.length < 6) return setStoreErr('Password must be at least 6 characters.')
    // Normalise WhatsApp number to E.164 (+countrycode...)
    let waClean: string | null = null
    if (storeForm.wa.trim()) {
      const digits = storeForm.wa.replace(/\s+/g, '')
      waClean = digits.startsWith('+') ? digits : `+${digits}`
      if (!/^\+\d{10,15}$/.test(waClean)) {
        return setStoreErr('WhatsApp number must include country code, e.g. +2348012345678')
      }
    }
    setStoreWaClean(waClean)
    setStoreErr('')
    setConfirmPw('')
    setStoreStep(2)
  }

  async function handleConfirmCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmPw) return setStoreErr('Enter your merchant password to confirm.')
    setStoreSaving(true)
    try {
      // Verify merchant identity before creating the store
      await merchantLogin(profile?.id ?? '', confirmPw)
      await createClient(token, {
        name: storeForm.name.trim(),
        password: storeForm.password,
        whatsapp_number: storeWaClean,
      })
      setAddOpen(false)
      setStoreForm({ name: '', password: '', wa: '' })
      setConfirmPw('')
      setStoreStep(1)
      onRefresh()
    } catch (err: any) {
      setStoreErr(err.detail ?? 'Could not create store.')
    } finally { setStoreSaving(false) }
  }

  async function doSetupPassword() {
    if (!setupPwTarget) return
    setSetupPwSaving(true); setSetupPwErr('')
    try {
      await setupStorePassword(token, setupPwTarget.id, setupPwForm.password)
      setSetupPwTarget(null)
      setSetupPwForm({ password: '', confirm: '' })
      onRefresh()
    } catch (err: any) { setSetupPwErr(err.detail ?? 'Could not set password.') }
    finally { setSetupPwSaving(false) }
  }

  function handleSetupPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!setupPwTarget) return
    if (!setupPwForm.password) return setSetupPwErr('Password is required.')
    if (setupPwForm.password.length < 6) return setSetupPwErr('Password must be at least 6 characters.')
    if (setupPwForm.password !== setupPwForm.confirm) return setSetupPwErr('Passwords do not match.')
    setConfirm({
      title:     `Set password for ${setupPwTarget.name}?`,
      message:   'Store managers will use this password to sign in to the store dashboard.',
      onConfirm: () => { setConfirm(null); doSetupPassword() },
    })
  }

  // ── Store selector for persona/delivery ──────────────────────────────────
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '')
  const selected = clients.find(c => c.id === selectedId) ?? clients[0]

  // ── Persona ──────────────────────────────────────────────────────────────
  const [personaForm, setPersonaForm] = useState({
    assistant_name:        selected?.assistant_name        ?? '',
    assistant_personality: selected?.assistant_personality ?? 'friendly_casual',
  })
  const [personaSaving, setPersonaSaving] = useState(false)
  const [personaMsg,    setPersonaMsg]    = useState('')

  // ── Delivery ─────────────────────────────────────────────────────────────
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_enabled: selected?.delivery_enabled ?? false,
    delivery_fee:     String(selected?.delivery_fee ?? ''),
  })
  const [deliverySaving, setDeliverySaving] = useState(false)
  const [deliveryMsg,    setDeliveryMsg]    = useState('')
  const [deliveryErr,    setDeliveryErr]    = useState('')

  // ── Operator number ───────────────────────────────────────────────────────
  const [opNumber,     setOpNumber]     = useState(selected?.operator_notify_phone ?? '')
  const [opSaving,     setOpSaving]     = useState(false)
  const [opMsg,        setOpMsg]        = useState('')

  // ── Confirm dialog ────────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<{
    title: string; message: string; onConfirm: () => void
  } | null>(null)

  // ── Payout account (per-store subaccount) ─────────────────────────────────
  const [subaccount,        setSubaccount]        = useState<Subaccount | null>(null)
  const [subaccountLoading, setSubaccountLoading] = useState(false)
  const [banks,             setBanks]             = useState<{ code: string; name: string }[]>([])
  const [banksLoading,      setBanksLoading]      = useState(false)
  const [bankForm,          setBankForm]          = useState({ account_number: '', bank_code: '' })
  const [verifying,         setVerifying]         = useState(false)
  const [verifiedName,      setVerifiedName]      = useState('')
  const [registering,       setRegistering]       = useState(false)
  const [deactivateWarn,    setDeactivateWarn]    = useState(false)
  const [deactivating,      setDeactivating]      = useState(false)
  const [payoutMsg,         setPayoutMsg]         = useState('')
  const [payoutErr,         setPayoutErr]         = useState('')

  // Load banks list once
  useEffect(() => {
    if (!token) return
    setBanksLoading(true)
    getSubaccountBanks(token)
      .then(d => setBanks(d.banks))
      .catch(() => {})
      .finally(() => setBanksLoading(false))
  }, [token])

  // Reset forms when selected store changes
  useEffect(() => {
    const c = clients.find(x => x.id === selectedId) ?? clients[0]
    if (!c) return
    setPersonaForm({
      assistant_name:        c.assistant_name        ?? '',
      assistant_personality: c.assistant_personality ?? 'friendly_casual',
    })
    setDeliveryForm({
      delivery_enabled: c.delivery_enabled ?? false,
      delivery_fee:     String(c.delivery_fee ?? ''),
    })
    setOpNumber(c.operator_notify_phone ?? '')
    setPersonaMsg('')
    setDeliveryMsg('')
    setDeliveryErr('')
    setOpMsg('')
    // reset payout state
    setSubaccount(null)
    setBankForm({ account_number: '', bank_code: '' })
    setVerifiedName('')
    setDeactivateWarn(false)
    setPayoutMsg('')
    setPayoutErr('')
    // load subaccount for this store
    setSubaccountLoading(true)
    getSubaccount(token, c.id)
      .then(setSubaccount)
      .catch(() => setSubaccount(null))
      .finally(() => setSubaccountLoading(false))
  }, [selectedId, clients, token])

  async function doSavePersona() {
    if (!selected) return
    setPersonaSaving(true); setPersonaMsg('')
    try {
      await updatePersona(token, selected.id, {
        assistant_name:        personaForm.assistant_name,
        assistant_personality: personaForm.assistant_personality,
      })
      setPersonaMsg('Saved ✓')
      onRefresh()
    } catch (err: any) { setPersonaMsg(err.detail ?? 'Could not save.') }
    finally { setPersonaSaving(false) }
  }

  function handleSavePersona(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setConfirm({
      title:     'Save AI persona?',
      message:   `This updates the assistant name and personality for "${selected.name}".`,
      onConfirm: () => { setConfirm(null); doSavePersona() },
    })
  }

  async function doSaveDelivery() {
    if (!selected) return
    setDeliverySaving(true); setDeliveryErr(''); setDeliveryMsg('')
    try {
      await updateDelivery(token, selected.id, {
        delivery_enabled: deliveryForm.delivery_enabled,
        delivery_fee:     deliveryForm.delivery_enabled ? +deliveryForm.delivery_fee : 0,
      })
      setDeliveryMsg('Saved ✓')
      onRefresh()
    } catch (err: any) { setDeliveryErr(err.detail ?? 'Could not save.') }
    finally { setDeliverySaving(false) }
  }

  function handleSaveDelivery(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (deliveryForm.delivery_enabled && !deliveryForm.delivery_fee) {
      return setDeliveryErr('Enter a delivery fee.')
    }
    setConfirm({
      title:     'Save delivery settings?',
      message:   `Delivery will be ${deliveryForm.delivery_enabled
        ? `enabled with a ₦${deliveryForm.delivery_fee} flat fee`
        : 'disabled'} for "${selected.name}".`,
      onConfirm: () => { setConfirm(null); doSaveDelivery() },
    })
  }

  async function doSaveOperator() {
    if (!selected) return
    const clean = opNumber.replace(/^\+/, '').replace(/\s+/g, '')
    setOpSaving(true); setOpMsg('')
    try {
      await updateOperatorNumber(token, selected.id, clean)
      setOpMsg('Saved ✓')
      onRefresh()
    } catch (err: any) { setOpMsg(err.detail ?? 'Could not save.') }
    finally { setOpSaving(false) }
  }

  function handleSaveOperator(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const clean = opNumber.replace(/^\+/, '').replace(/\s+/g, '')
    if (!clean) return setOpMsg('Enter a valid WhatsApp number.')
    setConfirm({
      title:     'Save notification number?',
      message:   `+${clean} will receive order and payment alerts for "${selected.name}". Make sure this is your personal WhatsApp number, not the customer-facing store number.`,
      onConfirm: () => { setConfirm(null); doSaveOperator() },
    })
  }

  async function handleVerifyBank() {
    if (!bankForm.account_number.trim() || !bankForm.bank_code) {
      return setPayoutErr('Enter your account number and select a bank.')
    }
    setVerifying(true); setPayoutErr(''); setVerifiedName('')
    try {
      const res = await verifyBankAccount(token, bankForm.account_number.trim(), bankForm.bank_code)
      setVerifiedName(res.account_name)
    } catch (err: any) { setPayoutErr(err.detail ?? 'Could not verify account. Check the number and bank.') }
    finally { setVerifying(false) }
  }

  async function doRegisterSubaccount() {
    if (!selected || !verifiedName) return
    setRegistering(true); setPayoutErr('')
    try {
      const sa = await registerSubaccount(token, selected.id, {
        account_bank:   bankForm.bank_code,
        account_number: bankForm.account_number.trim(),
        business_name:  selected.name || selected.id,
      })
      setSubaccount(sa)
      setPayoutMsg('Payout account registered ✓')
      setBankForm({ account_number: '', bank_code: '' })
      setVerifiedName('')
    } catch (err: any) { setPayoutErr(err.detail ?? 'Could not register payout account.') }
    finally { setRegistering(false) }
  }

  function handleRegisterSubaccount() {
    if (!selected || !verifiedName) return
    setConfirm({
      title:     'Register payout account?',
      message:   `Card payments for "${selected.name}" will be settled to ${verifiedName} (••••${bankForm.account_number.slice(-4)}).`,
      onConfirm: () => { setConfirm(null); doRegisterSubaccount() },
    })
  }

  async function doDeactivateSubaccount() {
    if (!selected) return
    setDeactivating(true); setPayoutErr('')
    try {
      await deactivateSubaccount(token, selected.id)
      setSubaccount(null)
      setDeactivateWarn(false)
      setPayoutMsg('')
    } catch (err: any) { setPayoutErr(err.detail ?? 'Could not remove payout account.') }
    finally { setDeactivating(false) }
  }

  function handleDeactivateSubaccount() {
    setConfirm({
      title:     'Remove payout account?',
      message:   'This cannot be undone. You will need to set up a new payout account to receive card payments.',
      onConfirm: () => { setConfirm(null); doDeactivateSubaccount() },
    })
  }

  const PERSONALITIES = [
    { value: 'friendly_casual',    label: 'Friendly & Casual' },
    { value: 'professional',       label: 'Professional' },
    { value: 'warm_enthusiastic',  label: 'Warm & Enthusiastic' },
  ]

  return (
    <>
    {/* Confirm dialog */}
    {confirm && (
      <Modal open onClose={() => setConfirm(null)} title={confirm.title}>
        <div className="space-y-5">
          <p className="text-sm text-ink-4 leading-relaxed">{confirm.message}</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirm(null)}
              className="flex-1 border border-border text-sm font-semibold text-ink-3 py-2.5
                rounded-xl hover:bg-bg transition-all">
              Cancel
            </button>
            <button onClick={confirm.onConfirm}
              className="flex-1 bg-wa text-white text-sm font-semibold py-2.5 rounded-xl
                shadow-wa hover:bg-wa-dark transition-all">
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    )}

    <div className="space-y-6">

      {/* ── Account ── */}
      <div className="bg-white border border-border rounded-3xl p-7">
        <h3 className="font-display font-bold text-base text-ink mb-4 tracking-tight">Account</h3>
        {profile ? (
          <div className="space-y-0">
            <Row label="Merchant ID"   value={profile.id} />
            <Row label="Business name" value={profile.name} />
            <Row label="Email"         value={profile.email} />
            <Row label="Email status"  value={profile.email_verified ? 'Verified ✓' : 'Not verified'} />
            {profile.whatsapp_number && <Row label="WhatsApp" value={profile.whatsapp_number} />}
          </div>
        ) : (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-5 rounded" />)}</div>
        )}
      </div>

      {/* ── Stores ── */}
      <div className="bg-white border border-border rounded-3xl p-7">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-base text-ink tracking-tight">
            Stores ({clients.length})
          </h3>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-ink text-white
              px-3.5 py-2 rounded-xl hover:bg-ink-2 transition-all">
            <IconPlus /> New store
          </button>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-ink-4 py-6 text-center">No stores yet. Create one to start selling.</p>
        ) : (
          <div className="divide-y divide-border">
            {clients.map(c => (
              <StoreRow key={c.id} c={c} token={token}
                onSetupPw={() => { setSetupPwTarget(c); setSetupPwForm({ password: '', confirm: '' }); setSetupPwErr('') }}
                onRefresh={onRefresh} />
            ))}
          </div>
        )}
        <p className="text-xs text-ink-4 mt-4 leading-relaxed">
          Need to remove a store? Reach us at{' '}
          <a href="mailto:hello@shopprhq.com?subject=Remove%20Store%20Request"
            className="text-wa-dark font-semibold hover:underline">
            hello@shopprhq.com
          </a>{' '}
          and we'll take care of it.
        </p>
      </div>

      {/* ── Per-store config ── */}
      {clients.length > 0 && (
        <>
          {/* Store selector */}
          {clients.length > 1 && (
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-ink-3 shrink-0">Configure store:</p>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={cn(INPUT, 'flex-1')}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
              </select>
            </div>
          )}

          {/* ── Operator number ── */}
          <div className="bg-white border border-border rounded-3xl p-7">
            <div className="mb-5">
              <h3 className="font-display font-bold text-base text-ink tracking-tight">Operator notification number</h3>
              <p className="text-xs text-ink-4 mt-1 leading-relaxed">
                Your personal WhatsApp number that receives an alert for every new order and payment.
                This is <strong>not</strong> the number customers message — that is your store's WhatsApp business number set up during onboarding.
              </p>
            </div>
            <form onSubmit={handleSaveOperator} className="space-y-4">
              <FormField label="Your WhatsApp number"
                hint="Include country code without the + sign. e.g. 2348012345678">
                <input type="tel" inputMode="numeric" placeholder="2348012345678"
                  value={opNumber}
                  onChange={e => { setOpNumber(e.target.value); setOpMsg('') }}
                  className={INPUT} />
              </FormField>
              <div className="flex items-center justify-between gap-4">
                <button type="submit" disabled={opSaving}
                  className="bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                    hover:bg-ink-2 transition-all disabled:opacity-50">
                  {opSaving ? 'Saving…' : 'Save number'}
                </button>
                {opMsg && (
                  <span className={cn('text-xs font-semibold',
                    opMsg.includes('✓') ? 'text-green-700' : 'text-red-600')}>
                    {opMsg}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* ── AI Persona ── */}
          <div className="bg-white border border-border rounded-3xl p-7">
            <div className="mb-5">
              <h3 className="font-display font-bold text-base text-ink tracking-tight">AI Persona</h3>
              <p className="text-xs text-ink-4 mt-1">
                This is the identity your WhatsApp AI assistant uses when talking to customers
                {clients.length > 1 ? ` for ${selected?.name}` : ''}.
              </p>
            </div>
            <form onSubmit={handleSavePersona} className="space-y-4">
              <FormField label="Assistant name" hint="The name customers see in the chat, e.g. Adaeze, Temi, Shoppr.">
                <input type="text" placeholder="e.g. Adaeze"
                  value={personaForm.assistant_name}
                  onChange={e => { setPersonaForm(p => ({ ...p, assistant_name: e.target.value })); setPersonaMsg('') }}
                  className={INPUT} />
              </FormField>
              <FormField label="Personality style">
                <select
                  value={personaForm.assistant_personality}
                  onChange={e => { setPersonaForm(p => ({ ...p, assistant_personality: e.target.value })); setPersonaMsg('') }}
                  className={INPUT}
                >
                  {PERSONALITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </FormField>
              <div className="flex items-center justify-between gap-4">
                <button type="submit" disabled={personaSaving}
                  className="bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                    hover:bg-ink-2 transition-all disabled:opacity-50">
                  {personaSaving ? 'Saving…' : 'Save persona'}
                </button>
                {personaMsg && (
                  <span className={cn('text-xs font-semibold',
                    personaMsg.includes('✓') ? 'text-green-700' : 'text-red-600')}>
                    {personaMsg}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* ── Delivery ── */}
          <div className="bg-white border border-border rounded-3xl p-7">
            <div className="mb-5">
              <h3 className="font-display font-bold text-base text-ink tracking-tight">Delivery</h3>
              <p className="text-xs text-ink-4 mt-1">
                A flat fee will be added to the customer's order at checkout
                {clients.length > 1 ? ` — ${selected?.name}` : ''}.
              </p>
            </div>
            <form onSubmit={handleSaveDelivery} className="space-y-4">
              {/* Enable/disable toggle */}
              <div className="flex gap-3">
                {[
                  { val: true,  label: 'Delivery enabled' },
                  { val: false, label: 'Pickup only' },
                ].map(opt => (
                  <label key={String(opt.val)}
                    className={cn(
                      'flex-1 flex items-center gap-2.5 px-4 py-3 rounded-2xl border-[1.5px] cursor-pointer transition-all',
                      deliveryForm.delivery_enabled === opt.val
                        ? 'border-ink bg-ink text-white'
                        : 'border-border bg-white text-ink-3 hover:border-ink-4',
                    )}>
                    <input type="radio" className="sr-only"
                      checked={deliveryForm.delivery_enabled === opt.val}
                      onChange={() => { setDeliveryForm(p => ({ ...p, delivery_enabled: opt.val })); setDeliveryErr(''); setDeliveryMsg('') }} />
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Fee input */}
              {deliveryForm.delivery_enabled && (
                <FormField label="Delivery fee (₦)" hint="Flat fee charged per order.">
                  <input type="number" min="0" placeholder="e.g. 1500"
                    value={deliveryForm.delivery_fee}
                    onChange={e => { setDeliveryForm(p => ({ ...p, delivery_fee: e.target.value })); setDeliveryErr('') }}
                    className={INPUT} />
                </FormField>
              )}

              {deliveryErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{deliveryErr}</p>}

              <div className="flex items-center justify-between gap-4">
                <button type="submit" disabled={deliverySaving}
                  className="bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                    hover:bg-ink-2 transition-all disabled:opacity-50">
                  {deliverySaving ? 'Saving…' : 'Save delivery'}
                </button>
                {deliveryMsg && (
                  <span className="text-xs font-semibold text-green-700">{deliveryMsg}</span>
                )}
              </div>
            </form>
          </div>
          {/* ── Payout account ── */}
          <div className="bg-white border border-border rounded-3xl p-7">
            <div className="mb-5">
              <h3 className="font-display font-bold text-base text-ink tracking-tight">Payout account</h3>
              <p className="text-xs text-ink-4 mt-1 leading-relaxed">
                Card payments from this store go directly to this bank account.
                {clients.length > 1 ? ` — ${selected?.name}` : ''}
              </p>
            </div>

            {subaccountLoading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-5 rounded" />)}</div>
            ) : subaccount ? (
              <>
                <div className="space-y-0 mb-5">
                  <Row label="Bank"         value={banks.find(b => b.code === subaccount.account_bank)?.name ?? subaccount.account_bank} />
                  <Row label="Account"      value={`••••${subaccount.account_number.slice(-4)}`} />
                  <Row label="Business"     value={subaccount.business_name} />
                </div>
                {payoutMsg && <p className="text-xs font-semibold text-green-700 mb-3">{payoutMsg}</p>}
                {payoutErr && <p className="text-xs text-red-600 mb-3">{payoutErr}</p>}
                {!deactivateWarn ? (
                  <button onClick={() => setDeactivateWarn(true)}
                    className="text-xs font-semibold border border-border px-4 py-2 rounded-xl
                      hover:border-red-300 hover:text-red-600 transition-colors text-ink-4">
                    Change payout account
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
                      <p className="text-sm font-semibold text-amber-800 mb-1">This action is final</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Once removed, <strong>{banks.find(b => b.code === subaccount.account_bank)?.name ?? subaccount.account_bank}</strong> (••••{subaccount.account_number.slice(-4)}) cannot
                        be linked to this store again. You will need to set up a new payout account.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleDeactivateSubaccount} disabled={deactivating}
                        className="bg-red-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                          hover:bg-red-700 transition-all disabled:opacity-50">
                        {deactivating ? 'Removing…' : 'Yes, remove account'}
                      </button>
                      <button onClick={() => setDeactivateWarn(false)}
                        className="text-sm font-semibold text-ink-3 px-4 py-2.5 rounded-xl hover:bg-bg transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {payoutMsg && <p className="text-xs font-semibold text-green-700">{payoutMsg}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Account number">
                    <input type="text" inputMode="numeric" placeholder="0123456789" maxLength={10}
                      value={bankForm.account_number}
                      onChange={e => { setBankForm(p => ({ ...p, account_number: e.target.value })); setPayoutErr(''); setVerifiedName('') }}
                      className={INPUT} />
                  </FormField>
                  <FormField label="Bank">
                    <select value={bankForm.bank_code}
                      onChange={e => { setBankForm(p => ({ ...p, bank_code: e.target.value })); setPayoutErr(''); setVerifiedName('') }}
                      className={INPUT}>
                      <option value="">{banksLoading ? 'Loading banks…' : 'Select bank…'}</option>
                      {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  </FormField>
                </div>
                {!verifiedName ? (
                  <>
                    {payoutErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{payoutErr}</p>}
                    <button onClick={handleVerifyBank} disabled={verifying}
                      className="bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                        hover:bg-ink-2 transition-all disabled:opacity-50">
                      {verifying ? 'Verifying…' : 'Verify account'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                      <p className="text-xs text-green-700 font-medium mb-0.5">Account verified</p>
                      <p className="text-sm font-bold text-green-900">{verifiedName}</p>
                    </div>
                    {payoutErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{payoutErr}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleRegisterSubaccount} disabled={registering}
                        className="bg-wa text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                          shadow-wa hover:bg-wa-dark transition-all disabled:opacity-50">
                        {registering ? 'Registering…' : 'Confirm & register'}
                      </button>
                      <button onClick={() => { setVerifiedName(''); setPayoutErr('') }}
                        className="text-sm font-semibold text-ink-3 px-4 py-2.5 rounded-xl hover:bg-bg transition-colors">
                        Change
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add store modal — 2-step */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setStoreStep(1); setStoreErr(''); setConfirmPw('') }}
        title={storeStep === 1 ? 'Create store' : 'Confirm store creation'}>
        {storeStep === 1 ? (
          <form onSubmit={handleAddStore} className="space-y-4">
            <FormField label="Store name" hint="1–100 characters. e.g. Lagos Branch, Abuja HQ">
              <input type="text" placeholder="e.g. Lagos Branch" value={storeForm.name}
                onChange={setSF('name')} className={INPUT} />
            </FormField>
            <FormField label="Store password" hint="Minimum 6 characters. Store managers use this to sign in to their dashboard.">
              <input type="password" placeholder="Min. 6 characters" value={storeForm.password}
                onChange={setSF('password')} autoComplete="new-password" className={INPUT} />
            </FormField>
            <FormField label="WhatsApp number (optional)"
              hint="Include country code with + sign. e.g. +2348012345678 — can be added later.">
              <input type="tel" placeholder="+2348012345678" inputMode="tel"
                value={storeForm.wa} onChange={setSF('wa')} className={INPUT} />
            </FormField>
            {storeErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{storeErr}</p>}
            <button type="submit"
              className="w-full bg-ink text-white font-semibold text-sm py-3 rounded-xl
                hover:bg-ink-2 transition-all">
              Next: Confirm →
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmCreate} className="space-y-4">
            {/* Summary */}
            <div className="bg-bg border border-border rounded-xl px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-4">Store name</span><span className="font-semibold text-ink">{storeForm.name}</span></div>
              <div className="flex justify-between"><span className="text-ink-4">WhatsApp</span><span className="font-semibold text-ink">{storeWaClean ?? 'Not provided'}</span></div>
            </div>
            <FormField label="Confirm with your merchant password"
              hint="Enter your merchant account password to authorise this action.">
              <input type="password" placeholder="Your merchant password" value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setStoreErr('') }}
                autoComplete="current-password" className={INPUT} autoFocus />
            </FormField>
            {storeErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{storeErr}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setStoreStep(1); setStoreErr('') }}
                className="flex-1 border border-border text-sm font-semibold text-ink-3 py-3 rounded-xl
                  hover:bg-bg transition-all">
                ← Back
              </button>
              <button type="submit" disabled={storeSaving}
                className="flex-1 bg-wa text-white font-semibold text-sm py-3 rounded-xl shadow-wa
                  hover:bg-wa-dark transition-all disabled:opacity-50">
                {storeSaving ? 'Creating…' : 'Create store'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Setup password modal — for stores without a login */}
      <Modal open={!!setupPwTarget} onClose={() => { setSetupPwTarget(null); setSetupPwErr('') }}
        title={`Set login for ${setupPwTarget?.name ?? 'store'}`}>
        <form onSubmit={handleSetupPassword} className="space-y-4">
          <p className="text-sm text-ink-4 leading-relaxed">
            This store has no login password. Set one so it can be accessed from the store dashboard.
          </p>
          <FormField label="New password" hint="Minimum 6 characters.">
            <input type="password" placeholder="Min. 6 characters" value={setupPwForm.password}
              onChange={e => { setSetupPwForm(p => ({ ...p, password: e.target.value })); setSetupPwErr('') }}
              autoComplete="new-password" className={INPUT} />
          </FormField>
          <FormField label="Confirm password">
            <input type="password" placeholder="Repeat password" value={setupPwForm.confirm}
              onChange={e => { setSetupPwForm(p => ({ ...p, confirm: e.target.value })); setSetupPwErr('') }}
              autoComplete="new-password" className={INPUT} />
          </FormField>
          {setupPwErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{setupPwErr}</p>}
          <button type="submit" disabled={setupPwSaving}
            className="w-full bg-wa text-white font-semibold text-sm py-3 rounded-xl shadow-wa
              hover:bg-wa-dark transition-all disabled:opacity-50">
            {setupPwSaving ? 'Saving…' : 'Set password'}
          </button>
        </form>
      </Modal>
    </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL
// ══════════════════════════════════════════════════════════════════════════

function NotificationBell({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [recipient, setRecipient] = useState('all')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  function handleClose() {
    setOpen(false)
    setTimeout(() => { setMessage(''); setRecipient('all'); setSent(false) }, 300)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    // TODO: wire to notification API endpoint when available
    await new Promise(r => setTimeout(r, 700))
    setSent(true)
    setSending(false)
    setTimeout(handleClose, 1600)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-9 h-9 rounded-xl
          bg-bg border border-border text-ink-3 hover:text-ink hover:border-ink-4 transition-all"
      >
        <IconBell />
      </button>

      <Modal open={open} onClose={handleClose} title="Send notification">
        {sent ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-11 h-11 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-700">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Notification sent</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <FormField label="Send to">
              <select value={recipient} onChange={e => setRecipient(e.target.value)} className={INPUT}>
                <option value="all">All stores</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Message">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. We're restocking on Friday. Hold any pending orders."
                rows={4}
                className={cn(INPUT, 'resize-none')}
              />
            </FormField>
            <button type="submit" disabled={sending || !message.trim()}
              className="w-full bg-ink text-white font-semibold text-sm py-3 rounded-xl
                hover:bg-ink-2 transition-all disabled:opacity-50">
              {sending ? 'Sending…' : 'Send notification'}
            </button>
          </form>
        )}
      </Modal>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PROFILE DROPDOWN
// ══════════════════════════════════════════════════════════════════════════

function ProfileDropdown({ profile, resendLoading, resendDone, onResend, onHistory, onLogout }: {
  profile: MerchantProfile | null
  resendLoading: boolean
  resendDone: boolean
  onResend: () => void
  onHistory: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const needsVerification = profile && !profile.email_verified

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl
          bg-bg border border-border text-ink-3 hover:text-ink hover:border-ink-4 transition-all"
      >
        <IconUser />
        {needsVerification && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-72 bg-white border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-4 mb-3">Account</p>
            {profile ? (
              <div className="space-y-2.5">
                <Row label="Business"    value={profile.name} />
                <Row label="Merchant ID" value={profile.id} />
                <Row label="Email"       value={profile.email} />
                <Row label="Status"      value={profile.email_verified ? 'Verified ✓' : 'Not verified'} />
              </div>
            ) : (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-4 rounded" />)}</div>
            )}
          </div>

          {needsVerification && (
            <div className="px-5 py-4 border-b border-border bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 mb-1">Email not verified</p>
              <p className="text-xs text-amber-700 leading-relaxed mb-3">
                Check <strong>{profile!.email}</strong> for your 6-digit code.
              </p>
              {resendDone
                ? <span className="text-xs font-semibold text-green-700">Code sent ✓</span>
                : <button onClick={onResend} disabled={resendLoading}
                    className="text-xs font-semibold text-amber-800 border border-amber-300 px-3 py-1.5
                      rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50">
                    {resendLoading ? 'Sending…' : 'Resend code'}
                  </button>
              }
            </div>
          )}

          <button
            onClick={() => { setOpen(false); onHistory() }}
            className="w-full flex items-center gap-2.5 px-5 py-3.5 text-sm font-semibold
              text-ink-3 hover:text-ink hover:bg-bg transition-colors border-t border-border"
          >
            <IconHistory /> Revenue history
          </button>
          <a
            href="mailto:hello@shopprhq.com?subject=ShopprHQ%20Support"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-5 py-3.5 text-sm font-semibold
              text-ink-3 hover:text-ink hover:bg-bg transition-colors border-t border-border"
          >
            <IconMail /> Contact us
          </a>
          <button
            onClick={() => { setOpen(false); onLogout() }}
            className="w-full text-left px-5 py-3.5 text-sm font-semibold text-red-600
              hover:bg-red-50 transition-colors border-t border-border"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════════════════════════════

type Tab = 'overview' | 'inventory' | 'orders' | 'settings'

const TABS: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
  { id: 'overview',  label: 'Overview',   Icon: IconGrid     },
  { id: 'inventory', label: 'Inventory',  Icon: IconBox      },
  { id: 'orders',    label: 'Orders',     Icon: IconReceipt  },
  { id: 'settings',  label: 'Settings',   Icon: IconSettings },
]

function DashboardView({ token, onLogout }: { token: string; onLogout: () => void }) {
  const params     = useSearchParams()
  const isVerified = params?.get('verified') === '1'

  const [tab,     setTab]     = useState<Tab>('overview')
  const [profile, setProfile] = useState<MerchantProfile | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [orders,  setOrders]  = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]  = useState(true)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone,    setResendDone]    = useState(false)
  const [loadError,     setLoadError]     = useState('')
  const [merchantId,    setMerchantId]    = useState('')
  const [historyOpen,   setHistoryOpen]   = useState(false)
  const [detail,        setDetail]        = useState<OrderDetail | null>(null)
  const [detailOpen,    setDetailOpen]    = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const openOrderDetail = useCallback(async (orderId: string) => {
    setDetail(null)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const d = await getOrderDetail(token, orderId, merchantId)
      setDetail(d)
    } catch { setDetailOpen(false) }
    finally { setDetailLoading(false) }
  }, [token, merchantId])

  async function handleConfirm(orderId: string) {
    setActionLoading(orderId + 'confirm')
    try { await confirmCashOrder(token, orderId, merchantId); loadData(); setDetailOpen(false) } catch {}
    finally { setActionLoading(null) }
  }

  async function handleDispatch(orderId: string) {
    setActionLoading(orderId + 'dispatch')
    try { await dispatchOrder(token, orderId, merchantId); loadData(); setDetailOpen(false) } catch {}
    finally { setActionLoading(null) }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      // Get profile first — use prof.id as the authoritative merchant ID
      const prof = await getMerchantProfile(token)
      setProfile(prof)
      const mId = prof.id
      setMerchantId(mId)

      const [clientList, orderList] = await Promise.all([
        getClients(token),
        getOrders(token, mId),
      ])
      setClients(clientList)
      setOrders(orderList)

      // Load products across all stores
      const allProds: Product[] = []
      for (const c of clientList) {
        try {
          const prods = await getInventory(token, mId, c.id)
          allProds.push(...prods.map(p => ({ ...p, _client: c })))
        } catch {}
      }
      setProducts(allProds)
    } catch (err: any) {
      if (err?.status === 401) onLogout()
      else setLoadError(err?.detail ?? 'Could not load dashboard data. Check your connection and refresh.')
    } finally {
      setLoading(false)
    }
  }, [token, onLogout])

  useEffect(() => { loadData() }, [loadData])

  async function handleResend() {
    setResendLoading(true)
    try { await resendVerification(token); setResendDone(true) } catch {}
    finally { setResendLoading(false) }
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <NotificationBell clients={clients} />
            <ProfileDropdown
              profile={profile}
              resendLoading={resendLoading}
              resendDone={resendDone}
              onResend={handleResend}
              onHistory={() => setHistoryOpen(true)}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8">
        {/* Load error */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{loadError}</p>
            <button onClick={loadData} className="text-xs font-semibold text-red-700 border border-red-300
              px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors shrink-0">
              Retry
            </button>
          </div>
        )}

        {/* Banners */}
        {isVerified && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
            <span className="text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-green-800">Email verified</p>
              <p className="text-xs text-green-700 mt-0.5">Your account is fully active. Welcome to ShopprHQ!</p>
            </div>
          </div>
        )}

        {/* Tab nav — icon + label only when active */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-2xl p-1 mb-8 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                tab === t.id
                  ? 'bg-ink text-white shadow-sm pr-4'
                  : 'text-ink-3 hover:text-ink hover:bg-bg',
              )}
            >
              <t.Icon />
              {tab === t.id && <span>{t.label}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <OverviewTab orders={orders} products={products} profile={profile}
            loading={loading} onOrderClick={openOrderDetail} />
        )}
        {tab === 'inventory' && (
          <InventoryTab
            products={products} clients={clients} loading={loading}
            token={token} merchantId={merchantId} onRefresh={loadData}
          />
        )}
        {tab === 'orders' && (
          <OrdersTab orders={orders} loading={loading} onOpenDetail={openOrderDetail} />
        )}
        {tab === 'settings' && (
          <SettingsTab profile={profile} clients={clients} token={token} onRefresh={loadData} />
        )}
      </main>

      {/* Revenue history overlay */}
      {historyOpen && (
        <HistoryView
          orders={orders}
          token={token}
          merchantId={merchantId}
          onClose={() => setHistoryOpen(false)}
          onOrderClick={(id) => { openOrderDetail(id) }}
        />
      )}

      {/* Shared order detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Order detail">
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-5 rounded" />)}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xl text-ink tracking-wider">#{detail.order_code}</span>
              <StatusBadge status={detail.status} />
            </div>
            <div className="bg-bg rounded-2xl p-4 space-y-2">
              <Row label="Customer" value={detail.customer_name || '—'} />
              <Row label="Phone"    value={detail.user_id} />
              <Row label="Payment"  value={detail.payment_method} capitalize />
              <Row label="Store"    value={detail.store_name || detail.client_id} />
              {detail.delivery_address && <Row label="Delivery address" value={detail.delivery_address} />}
              {detail.delivery_contact_number && <Row label="Delivery contact" value={detail.delivery_contact_number} />}
              <Row label="Placed" value={detail.created_at ? new Date(detail.created_at).toLocaleString('en-NG') : '—'} />
            </div>
            {detail.items.length > 0 && (
              <div className="border border-border rounded-2xl overflow-hidden">
                <div className="bg-bg px-4 py-2.5 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-4">Items</p>
                </div>
                <div className="divide-y divide-border">
                  {detail.items.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{item.product_name}</p>
                        <p className="text-xs text-ink-4">× {item.quantity} @ {fmt(item.price)}</p>
                      </div>
                      <span className="text-sm font-semibold text-ink">{fmt(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-4 py-3 bg-bg border-t border-border">
                  <span className="text-sm font-bold text-ink">Total</span>
                  <span className="text-sm font-bold text-ink">{fmt(detail.total_amount)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              {detail.payment_method === 'cash' &&
                (detail.status === 'AWAITING_PICKUP' || detail.status === 'OUT_FOR_DELIVERY') && (
                <button onClick={() => handleConfirm(detail.id)} disabled={!!actionLoading}
                  className="flex items-center gap-2 bg-wa text-white text-sm font-semibold
                    px-4 py-2.5 rounded-xl shadow-wa hover:bg-wa-dark transition-all disabled:opacity-50">
                  <IconCheck />
                  {actionLoading === detail.id + 'confirm' ? 'Confirming…' : 'Confirm & send receipt'}
                </button>
              )}
              {detail.status === 'AWAITING_PICKUP' && detail.delivery_type === 'delivery' && (
                <button onClick={() => handleDispatch(detail.id)} disabled={!!actionLoading}
                  className="flex items-center gap-2 bg-ink text-white text-sm font-semibold
                    px-4 py-2.5 rounded-xl hover:bg-ink-2 transition-all disabled:opacity-50">
                  <IconTruck />
                  {actionLoading === detail.id + 'dispatch' ? 'Dispatching…' : 'Mark out for delivery'}
                </button>
              )}
              <button onClick={() => printReceipt(detail)}
                className="flex items-center gap-2 text-sm font-semibold text-ink-3 border
                  border-border px-4 py-2.5 rounded-xl hover:text-ink hover:border-ink-4
                  transition-all">
                <IconPrint /> Print receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE — auth gate + Suspense for useSearchParams
// ══════════════════════════════════════════════════════════════════════════

function DashboardPage() {
  const [token,   setToken]   = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setToken(sessionStorage.getItem('m_tok'))
    setChecked(true)
  }, [])

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('m_tok')
    sessionStorage.removeItem('m_id')
    sessionStorage.removeItem('m_name')
    setToken(null)
  }, [])

  if (!checked) return null

  if (!token) return <LoginView onSuccess={setToken} />

  return <DashboardView token={token} onLogout={handleLogout} />
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  )
}
