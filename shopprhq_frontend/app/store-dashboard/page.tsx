'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import {
  getMyStore, getStoreOrders, getStoreOrderDetail,
  storeConfirmCashOrder, storeDispatchOrder,
  getRevenueSummary, storeUpdateDelivery,
  type Client, type Order, type OrderDetail, type RevenueSummary,
} from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(iso?: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const INPUT = cn(
  'w-full px-3.5 py-2.5 rounded-[13px]',
  'bg-bg border-[1.5px] border-border',
  'text-sm font-sans text-ink placeholder:text-ink-4/50',
  'outline-none transition-all',
  'focus:border-wa focus:bg-white focus:ring-2 focus:ring-wa/10',
)

type Tab = 'orders' | 'revenue' | 'settings'

interface StoreInfo {
  tok: string
  cid: string
  mid: string
}

// ── Shared components ─────────────────────────────────────────────────────────

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

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-14 h-14 bg-bg border border-border rounded-2xl
        flex items-center justify-center mx-auto mb-4 text-2xl">
        {icon}
      </div>
      <p className="font-semibold text-sm text-ink mb-1">{title}</p>
      <p className="text-xs text-ink-4 leading-relaxed">{desc}</p>
    </div>
  )
}

function LockedSettings({ field }: { field: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
      <p className="text-sm font-semibold text-amber-800 mb-1">
        {field} is locked
      </p>
      <p className="text-xs text-amber-700 leading-relaxed">
        Contact your merchant to change these settings.
      </p>
    </div>
  )
}

// ── Receipt print styles (injected into a new window) ─────────────────────────

function buildReceiptHtml(detail: OrderDetail, storeName: string) {
  const rows = detail.items.map(i =>
    `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee">${i.product_name}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">₦${i.subtotal.toLocaleString('en-NG')}</td>
    </tr>`
  ).join('')

  const deliveryRow = detail.delivery_fee
    ? `<tr><td colspan="2" style="padding:6px 0;color:#555">Delivery fee</td><td style="padding:6px 0;text-align:right">₦${(detail.delivery_fee ?? 0).toLocaleString('en-NG')}</td></tr>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Receipt ${detail.order_code}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:380px;margin:24px auto;font-size:13px;color:#111}
    h1{font-size:18px;margin:0 0 2px}
    .sub{color:#888;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font-size:11px;color:#888;text-transform:uppercase;padding:0 0 8px;border-bottom:2px solid #111}
    th:nth-child(2){text-align:center}
    th:last-child{text-align:right}
    .total{font-weight:700;font-size:15px;padding:10px 0 0}
    @media print{body{margin:8px}}
  </style></head><body>
  <h1>${storeName}</h1>
  <div class="sub">Order #${detail.order_code} · ${new Date(detail.created_at ?? '').toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</div>
  ${detail.customer_name ? `<p style="margin:0 0 4px"><strong>Customer:</strong> ${detail.customer_name}</p>` : ''}
  ${detail.store_address ? `<p style="margin:0 0 12px;color:#555;font-size:12px">${detail.store_address}</p>` : ''}
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>${rows}${deliveryRow}</tbody>
    <tfoot><tr><td colspan="2" class="total">Total</td><td class="total" style="text-align:right">₦${(detail.effective_total ?? detail.total_amount).toLocaleString('en-NG')}</td></tr></tfoot>
  </table>
  <p style="margin:16px 0 0;font-size:11px;color:#aaa;text-align:center">ShopprHQ · ${detail.payment_method?.toUpperCase() ?? 'CASH'}</p>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
  </body></html>`
}

function printReceipt(detail: OrderDetail, storeName: string) {
  const w = window.open('', '_blank', 'width=440,height=600')
  if (!w) return
  w.document.write(buildReceiptHtml(detail, storeName))
  w.document.close()
}

// ── Order detail modal ────────────────────────────────────────────────────────

function OrderDetailModal({
  orderId, info, storeName, onClose, onRefresh,
}: {
  orderId: string
  info: StoreInfo
  storeName: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [detail, setDetail]       = useState<OrderDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setAL]    = useState<string | null>(null)
  const [err, setErr]             = useState('')

  useEffect(() => {
    setLoading(true)
    getStoreOrderDetail(info.tok, orderId, info.mid)
      .then(setDetail)
      .catch(e => setErr(e?.detail ?? 'Could not load order.'))
      .finally(() => setLoading(false))
  }, [orderId, info.tok, info.mid])

  async function confirmCash() {
    if (!detail) return
    setAL('confirm'); setErr('')
    try {
      await storeConfirmCashOrder(info.tok, detail.id, info.mid)
      onRefresh()
      onClose()
    } catch (e: any) { setErr(e?.detail ?? 'Could not confirm order.') }
    finally { setAL(null) }
  }

  async function dispatch() {
    if (!detail) return
    setAL('dispatch'); setErr('')
    try {
      await storeDispatchOrder(info.tok, detail.id, info.mid)
      onRefresh()
      onClose()
    } catch (e: any) { setErr(e?.detail ?? 'Could not dispatch order.') }
    finally { setAL(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="font-display font-bold text-base text-ink">Order detail</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink text-xl leading-none px-1">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-5 rounded-lg" />)}
            </div>
          ) : !detail ? (
            <p className="text-sm text-red-600 text-center py-8">{err || 'Order not found.'}</p>
          ) : (
            <>
              {/* Status + code */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-lg text-ink">#{detail.order_code}</p>
                  <p className="text-xs text-ink-4 mt-0.5">{fmtDate(detail.created_at)}</p>
                </div>
                <StatusBadge status={detail.status} />
              </div>

              {/* Customer */}
              {detail.customer_name && (
                <div className="bg-bg border border-border rounded-xl px-4 py-3">
                  <p className="text-xs text-ink-4 mb-0.5">Customer</p>
                  <p className="text-sm font-semibold text-ink">{detail.customer_name}</p>
                </div>
              )}

              {/* Delivery info */}
              {detail.delivery_type === 'delivery' && (
                <div className="bg-bg border border-border rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs text-ink-4">Delivery</p>
                  {detail.delivery_address && <p className="text-sm text-ink">{detail.delivery_address}</p>}
                  {detail.delivery_contact_number && (
                    <p className="text-xs text-ink-3">Contact: {detail.delivery_contact_number}</p>
                  )}
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-2">Items</p>
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {detail.items.map((item, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-ink">{item.product_name}</p>
                        <p className="text-xs text-ink-4">× {item.quantity} @ {fmt(item.price)}</p>
                      </div>
                      <p className="text-sm font-semibold text-ink">{fmt(item.subtotal)}</p>
                    </div>
                  ))}
                  {detail.delivery_fee ? (
                    <div className="px-4 py-3 flex justify-between items-center bg-bg">
                      <p className="text-sm text-ink-3">Delivery fee</p>
                      <p className="text-sm font-semibold text-ink">{fmt(detail.delivery_fee)}</p>
                    </div>
                  ) : null}
                  <div className="px-4 py-3 flex justify-between items-center bg-ink/[0.03]">
                    <p className="text-sm font-bold text-ink">Total</p>
                    <p className="text-base font-extrabold text-ink">
                      {fmt(detail.effective_total ?? detail.total_amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment method */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-4">Payment:</span>
                <span className="text-xs font-semibold text-ink uppercase">{detail.payment_method}</span>
              </div>

              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{err}</p>}

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                {/* Print receipt — always available */}
                <button
                  onClick={() => printReceipt(detail, storeName)}
                  className="w-full border border-border text-sm font-semibold text-ink-3 py-3 rounded-xl
                    hover:bg-bg transition-all flex items-center justify-center gap-2">
                  🖨 Print receipt
                </button>

                {/* Confirm cash — only for cash orders that are not yet fulfilled */}
                {detail.payment_method === 'cash' &&
                  ['AWAITING_PICKUP', 'OUT_FOR_DELIVERY'].includes(detail.status) && (
                  <button onClick={confirmCash} disabled={!!actionLoading}
                    className="w-full bg-wa text-white font-semibold text-sm py-3 rounded-xl
                      shadow-wa hover:bg-wa-dark transition-all disabled:opacity-50">
                    {actionLoading === 'confirm' ? 'Confirming…' : '✓ Confirm cash received'}
                  </button>
                )}

                {/* Dispatch — for delivery orders awaiting dispatch */}
                {detail.delivery_type === 'delivery' && detail.status === 'PAID' && (
                  <button onClick={dispatch} disabled={!!actionLoading}
                    className="w-full bg-indigo-600 text-white font-semibold text-sm py-3 rounded-xl
                      hover:bg-indigo-700 transition-all disabled:opacity-50">
                    {actionLoading === 'dispatch' ? 'Dispatching…' : '🚴 Mark out for delivery'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Orders tab ────────────────────────────────────────────────────────────────

type OrderFilter = 'all' | 'pending' | 'fulfilled' | 'cancelled'

function OrdersTab({ info, storeName }: { info: StoreInfo; storeName: string }) {
  const [orders,    setOrders]    = useState<Order[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [filter,    setFilter]    = useState<OrderFilter>('all')
  const [detailId,  setDetailId]  = useState<string | null>(null)
  const [tick,      setTick]      = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    getStoreOrders(info.tok, info.mid, info.cid)
      .then(data => { if (!cancelled) setOrders(data) })
      .catch(e  => { if (!cancelled) setError(e?.detail ?? 'Could not load orders.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [info.tok, info.mid, info.cid, tick])

  const filtered = orders.filter(o => {
    if (filter === 'pending')   return ['AWAITING_PICKUP','PENDING_PAYMENT','PAID','CREATED','OUT_FOR_DELIVERY'].includes(o.status)
    if (filter === 'fulfilled') return o.status === 'FULFILLED'
    if (filter === 'cancelled') return o.status === 'CANCELLED'
    return true
  })

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )

  const today = new Date().toDateString()
  const todayCount     = orders.filter(o => o.created_at && new Date(o.created_at).toDateString() === today).length
  const pendingCount   = orders.filter(o => ['AWAITING_PICKUP','PENDING_PAYMENT','CREATED'].includes(o.status)).length
  const fulfilledCount = orders.filter(o => o.status === 'FULFILLED').length

  const stats = [
    { label: 'Today',     value: loading ? null : String(todayCount) },
    { label: 'Pending',   value: loading ? null : String(pendingCount) },
    { label: 'Fulfilled', value: loading ? null : String(fulfilledCount) },
  ]

  const FILTERS: { id: OrderFilter; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'pending',   label: 'Active' },
    { id: 'fulfilled', label: 'Fulfilled' },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-border rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-4 mb-2">
              {s.label}
            </p>
            {s.value === null
              ? <div className="skeleton h-8 w-16 rounded-lg" />
              : <p className="font-display font-extrabold text-2xl text-ink">{s.value}</p>
            }
          </div>
        ))}
      </div>

      {/* Filter bar + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                filter === f.id ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink hover:bg-bg',
              )}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={refresh}
          className="text-xs font-semibold text-ink-3 hover:text-ink px-3 py-2
            rounded-xl hover:bg-white border border-transparent hover:border-border transition-all">
          ↻ Refresh
        </button>
      </div>

      {/* Orders list */}
      <div className="bg-white border border-border rounded-3xl overflow-hidden">
        {error ? (
          <p className="text-sm text-red-600 px-6 py-8 text-center">{error}</p>
        ) : loading ? (
          <div className="divide-y divide-border px-6">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4 py-4">
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-4 w-32 rounded flex-1" />
                <div className="skeleton h-4 w-16 rounded" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon="🧾" title="No orders here"
            desc={filter === 'all' ? 'Orders placed through WhatsApp will appear here.' : 'No orders match this filter.'} />
        ) : (
          <div className="divide-y divide-border">
            {sorted.map(o => (
              <button key={o.id} onClick={() => setDetailId(o.id)}
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-bg/60 transition-colors text-left">
                <span className="font-mono text-xs font-semibold text-ink bg-bg border border-border
                  px-2.5 py-1 rounded-lg shrink-0">
                  {o.order_code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {o.customer_name || o.user_id}
                  </p>
                  <p className="text-xs text-ink-4 mt-0.5">{timeAgo(o.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-ink shrink-0">{fmt(o.total_amount)}</span>
                <StatusBadge status={o.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {detailId && (
        <OrderDetailModal
          orderId={detailId}
          info={info}
          storeName={storeName}
          onClose={() => setDetailId(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}

// ── Revenue tab ───────────────────────────────────────────────────────────────

type RevPeriod = 'weekly' | 'monthly'

const STATUS_GROUPS = [
  { key: 'FULFILLED',        label: 'Fulfilled',        color: 'text-emerald-700' },
  { key: 'AWAITING_PICKUP',  label: 'Awaiting Pickup',  color: 'text-amber-700' },
  { key: 'PENDING_PAYMENT',  label: 'Pending Payment',  color: 'text-blue-600' },
  { key: 'CANCELLED',        label: 'Cancelled',        color: 'text-red-600' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'text-indigo-600' },
]

function RevenueChart({ data }: { data: RevenueSummary }) {
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

function RevenueTab({ info }: { info: StoreInfo }) {
  const [data,    setData]    = useState<RevenueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [period,  setPeriod]  = useState<RevPeriod>('weekly')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    getRevenueSummary(info.tok, info.mid, info.cid, period)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e?.detail ?? 'Could not load revenue data.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [info.tok, info.mid, info.cid, period])

  const periodLabel = period === 'weekly' ? 'last 8 weeks' : 'last 12 months'

  return (
    <div className="space-y-5">

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

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-8">{error}</p>
      ) : data ? (
        <>
          {/* Total revenue for the period */}
          <div className="bg-ink text-white rounded-3xl p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
              Revenue · {periodLabel}
            </p>
            <p className="font-display font-extrabold text-4xl">{fmt(data.total_revenue)}</p>
          </div>

          {/* Bar chart */}
          {data.daily.length > 0
            ? <RevenueChart data={data} />
            : <EmptyState icon="📊" title="No revenue yet"
                desc="Revenue will appear here once fulfilled orders come in." />
          }

          {/* Order counts by status */}
          <div className="bg-white border border-border rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-4">
              Order breakdown · {periodLabel}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STATUS_GROUPS.map(s => (
                <div key={s.key} className="bg-bg border border-border rounded-2xl p-4">
                  <p className="text-[11px] font-semibold text-ink-4 mb-1">{s.label}</p>
                  <p className={cn('font-display font-extrabold text-2xl', s.color)}>
                    {data.counts_by_status[s.key] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

// ── Confirm dialog (store dashboard) ──────────────────────────────────────────

function StoreConfirmDialog({
  open, title, message, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string
  onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-border shadow-xl w-full max-w-sm p-7 space-y-4">
        <div>
          <p className="font-display font-bold text-base text-ink">{title}</p>
          <p className="text-sm text-ink-4 mt-1 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border border-border text-sm font-semibold text-ink-3 py-2.5
              rounded-xl hover:bg-bg transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-wa text-white text-sm font-semibold py-2.5 rounded-xl
              shadow-wa hover:bg-wa-dark transition-all">
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsTab({ info, store, onStoreRefresh }: {
  info: StoreInfo
  store: Client | null
  onStoreRefresh: () => void
}) {
  const canEdit = !!store?.client_changes_enabled

  // Delivery form
  const [deliveryForm,    setDeliveryForm]    = useState({
    enabled: store?.delivery_enabled ?? false,
    fee:     String(store?.delivery_fee ?? ''),
  })
  const [deliverySaving,  setDeliverySaving]  = useState(false)
  const [deliveryMsg,     setDeliveryMsg]     = useState('')
  const [deliveryErr,     setDeliveryErr]     = useState('')

  // Confirm dialog
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // Sync form when store loads
  useEffect(() => {
    if (store) {
      setDeliveryForm({
        enabled: store.delivery_enabled ?? false,
        fee:     String(store.delivery_fee ?? ''),
      })
    }
  }, [store])

  async function doSaveDelivery() {
    setDeliverySaving(true); setDeliveryMsg(''); setDeliveryErr('')
    try {
      await storeUpdateDelivery(info.tok, info.cid, {
        delivery_enabled: deliveryForm.enabled,
        delivery_fee: deliveryForm.enabled ? +deliveryForm.fee : 0,
      })
      setDeliveryMsg('Saved ✓')
      onStoreRefresh()
    } catch (e: any) { setDeliveryErr(e?.detail ?? 'Could not save.') }
    finally { setDeliverySaving(false) }
  }

  function handleSaveDelivery(e: React.FormEvent) {
    e.preventDefault()
    if (deliveryForm.enabled && !deliveryForm.fee) return setDeliveryErr('Enter a delivery fee.')
    setConfirm({
      title:     'Save delivery settings?',
      message:   `Delivery will be ${deliveryForm.enabled ? `enabled with a ₦${deliveryForm.fee} fee` : 'disabled'} for this store.`,
      onConfirm: () => { setConfirm(null); doSaveDelivery() },
    })
  }

  return (
    <>
    {confirm && (
      <StoreConfirmDialog
        open
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}

    <div className="space-y-6">

      {/* Store info */}
      <div className="bg-white border border-border rounded-3xl p-7">
        <h3 className="font-display font-bold text-base text-ink mb-4 tracking-tight">Store info</h3>
        <div className="divide-y divide-border">
          {[
            { label: 'Store name',          value: store?.name ?? info.cid },
            { label: 'Store ID',            value: info.cid,  mono: true },
            { label: 'Merchant ID',         value: info.mid,  mono: true },
            { label: 'Operator number',     value: store?.store_contact_number ?? 'Not set', dim: !store?.store_contact_number },
            { label: 'Customer WhatsApp',   value: store?.whatsapp_number ?? 'Not connected' },
            { label: 'Notification number', value: store?.operator_notify_phone
                ? `+${store.operator_notify_phone}` : 'Not set — configure in merchant dashboard',
              dim: !store?.operator_notify_phone },
          ].map(row => (
            <div key={row.label} className="py-3.5 flex items-center justify-between gap-4">
              <span className="text-sm text-ink-3 shrink-0">{row.label}</span>
              <span className={cn(
                'text-sm font-semibold text-ink text-right',
                row.mono && 'font-mono text-[13px]',
                row.dim && 'text-ink-4 font-normal text-xs',
              )}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery settings */}
      <div className="bg-white border border-border rounded-3xl p-7">
        <h3 className="font-display font-bold text-base text-ink mb-2 tracking-tight">Delivery settings</h3>
        <p className="text-xs text-ink-4 mb-5 leading-relaxed">
          Control whether your store offers delivery and the flat delivery fee.
        </p>

        {canEdit ? (
          <form onSubmit={handleSaveDelivery} className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={deliveryForm.enabled}
                onChange={e => { setDeliveryForm(p => ({ ...p, enabled: e.target.checked })); setDeliveryMsg(''); setDeliveryErr('') }}
                className="w-4 h-4 accent-wa rounded" />
              <span className="text-sm font-semibold text-ink">Delivery enabled</span>
            </label>
            {deliveryForm.enabled && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                  Delivery fee (₦)
                </label>
                <input type="number" min="0" step="any" placeholder="e.g. 1500"
                  value={deliveryForm.fee}
                  onChange={e => { setDeliveryForm(p => ({ ...p, fee: e.target.value })); setDeliveryMsg(''); setDeliveryErr('') }}
                  className={INPUT} />
              </div>
            )}
            {deliveryErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{deliveryErr}</p>}
            {deliveryMsg && <p className="text-sm text-emerald-700">{deliveryMsg}</p>}
            <button type="submit" disabled={deliverySaving}
              className="bg-wa text-white font-semibold text-sm px-6 py-2.5 rounded-xl
                shadow-wa hover:bg-wa-dark transition-all disabled:opacity-50">
              {deliverySaving ? 'Saving…' : 'Save delivery settings'}
            </button>
          </form>
        ) : (
          <>
            <div className="divide-y divide-border mb-4">
              <div className="py-3.5 flex justify-between">
                <span className="text-sm text-ink-3">Delivery enabled</span>
                <span className="text-sm font-semibold text-ink">{store?.delivery_enabled ? 'Yes' : 'No'}</span>
              </div>
              <div className="py-3.5 flex justify-between">
                <span className="text-sm text-ink-3">Delivery fee</span>
                <span className="text-sm font-semibold text-ink">
                  {store?.delivery_fee != null ? fmt(store.delivery_fee) : '—'}
                </span>
              </div>
            </div>
            <LockedSettings field="Delivery settings" />
          </>
        )}
      </div>

      {/* Support */}
      <div className="bg-bg border border-border rounded-2xl px-5 py-4">
        <p className="text-sm font-semibold text-ink mb-1">Need help with ShopprHQ?</p>
        <p className="text-xs text-ink-4 leading-relaxed">
          Reach us at{' '}
          <a href="mailto:hello@shopprhq.com" className="text-wa-dark font-semibold hover:underline">
            hello@shopprhq.com
          </a>
        </p>
      </div>
    </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function StoreDashboardPage() {
  const router = useRouter()
  const [info,    setInfo]    = useState<StoreInfo | null>(null)
  const [store,   setStore]   = useState<Client | null>(null)
  const [checked, setChecked] = useState(false)
  const [tab,     setTab]     = useState<Tab>('orders')
  const [storeTick, setStoreTick] = useState(0)

  useEffect(() => {
    const tok = sessionStorage.getItem('tok')
    const cid = sessionStorage.getItem('cid')
    const mid = sessionStorage.getItem('mid') ?? ''
    if (!tok || !cid) { router.replace('/store-login'); return }
    setInfo({ tok, cid, mid })
    setChecked(true)
  }, [router])

  // Fetch store details (for settings tab + store name)
  useEffect(() => {
    if (!info) return
    getMyStore(info.tok)
      .then(setStore)
      .catch(() => {})
  }, [info, storeTick])

  function logout() {
    sessionStorage.removeItem('tok')
    sessionStorage.removeItem('cid')
    sessionStorage.removeItem('cname')
    sessionStorage.removeItem('mid')
    router.replace('/store-login')
  }

  if (!checked || !info) return null

  const storeName = store?.name ?? sessionStorage.getItem('cname') ?? info.cid

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders',   label: 'Orders' },
    { id: 'revenue',  label: 'Revenue' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-[#F5F4F0]">

      {/* Top bar */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="hidden sm:block text-xs font-semibold text-ink-4
              bg-bg border border-border px-2.5 py-1 rounded-full">
              {storeName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block font-mono text-xs text-ink-4 bg-bg border border-border
              px-2.5 py-1 rounded-lg">
              {info.cid}
            </span>
            <button onClick={logout}
              className="text-xs font-semibold text-ink-3 hover:text-ink px-3 py-2
                rounded-xl hover:bg-bg transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">

        {/* Page title */}
        <div className="mb-7">
          <h1 className="font-display font-extrabold text-2xl text-ink tracking-tight">
            {storeName}
          </h1>
          <p className="text-sm text-ink-4 mt-1">
            Store ID: <span className="font-mono font-semibold text-ink-3">{info.cid}</span>
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-2xl
          p-1 mb-8 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                tab === t.id
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-ink-3 hover:text-ink hover:bg-bg',
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'orders'   && <OrdersTab  info={info} storeName={storeName} />}
        {tab === 'revenue'  && <RevenueTab info={info} />}
        {tab === 'settings' && (
          <SettingsTab
            info={info}
            store={store}
            onStoreRefresh={() => setStoreTick(t => t + 1)}
          />
        )}
      </main>
    </div>
  )
}
