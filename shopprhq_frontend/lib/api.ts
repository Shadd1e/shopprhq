function normaliseBase(url: string) {
  const u = url.replace(/\/$/, '')
  return u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`
}

const BASE = normaliseBase(
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.shopprhq.com'
)

// ── Core fetch ─────────────────────────────────────────────────────────────

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: optHeaders, ...restOptions } = options ?? {}
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions,
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, detail: data.detail ?? 'Something went wrong' }
  return data as T
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface MerchantLoginResponse {
  access_token: string
  merchant_id: string
  name: string
  email: string
}

export interface RegisterResponse {
  id: string
  name: string
  email: string
}

export interface ClientLoginResponse {
  access_token: string
  client_id: string
  store_name: string
  merchant_id: string
}

export interface MerchantProfile {
  id: string
  name: string
  email: string
  email_verified: boolean
  whatsapp_number?: string
}

export interface Client {
  id: string
  name: string
  merchant_id: string
  whatsapp_number?: string
  store_contact_number?: string
  operator_notify_phone?: string
  assistant_name?: string
  assistant_personality?: string
  delivery_enabled?: boolean
  delivery_fee?: number
  has_login?: boolean
  client_changes_enabled?: boolean
}

export interface InventoryInfo {
  quantity: number
  low_stock_threshold?: number
}

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  category?: string
  merchant_id?: string
  client_id?: string
  inventory?: InventoryInfo
  _client?: Client   // enriched client-side
}

export interface Order {
  id: string
  order_code: string
  merchant_id: string
  client_id: string
  user_id: string
  customer_name?: string
  payment_method: string
  total_amount: number
  status: string
  created_at?: string
  confirmed_at?: string
  fulfilled_at?: string
  cancelled_at?: string
}

export interface OrderDetail extends Order {
  store_name?: string
  store_address?: string
  delivery_type?: string
  delivery_address?: string
  delivery_contact_number?: string
  delivery_fee?: number
  effective_total?: number
  dispatched_at?: string
  items: {
    product_id: string
    product_name: string
    quantity: number
    price: number
    subtotal: number
  }[]
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function merchantLogin(merchant_id: string, password: string) {
  return req<MerchantLoginResponse>('/api/v1/merchants/login', {
    method: 'POST',
    body: JSON.stringify({ merchant_id, password }),
  })
}

export async function registerMerchant(payload: {
  name: string
  email: string
  password: string
  whatsapp_number: string | null
}) {
  return req<RegisterResponse>('/api/v1/merchants/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function storeLogin(client_id: string, password: string) {
  return req<ClientLoginResponse>('/api/v1/clients/login', {
    method: 'POST',
    body: JSON.stringify({ client_id, password }),
  })
}

export async function forgotPassword(email: string) {
  return req<{ detail: string }>('/api/v1/merchants/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(email: string, code: string, new_password: string) {
  return req<{ detail: string }>('/api/v1/merchants/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password }),
  })
}

// ── Merchant profile ───────────────────────────────────────────────────────

export async function getMerchantProfile(token: string) {
  return req<MerchantProfile>('/api/v1/merchants/me', {
    headers: bearer(token),
  })
}

export async function resendVerification(token: string) {
  return req<{ message: string }>('/api/v1/merchants/resend-verification', {
    method: 'POST',
    headers: bearer(token),
  })
}

// ── Clients (stores) ───────────────────────────────────────────────────────

export async function getClients(token: string) {
  return req<Client[]>('/api/v1/clients/', {
    headers: bearer(token),
  })
}

export async function createClient(
  token: string,
  data: { name: string; password: string; whatsapp_number?: string | null },
) {
  return req<Client>('/api/v1/clients/with-password/', {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify(data),
  })
}

export async function updatePersona(
  token: string,
  clientId: string,
  data: { assistant_name: string; assistant_personality: string },
) {
  return req<Client>(`/api/v1/clients/${clientId}/persona`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify(data),
  })
}

export async function updateDelivery(
  token: string,
  clientId: string,
  data: { delivery_enabled: boolean; delivery_fee: number },
) {
  return req<Client>(`/api/v1/clients/${clientId}/delivery`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify(data),
  })
}

export async function setupStorePassword(token: string, clientId: string, password: string) {
  return req<{ detail: string; client_id: string }>(`/api/v1/clients/${clientId}/password`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify({ password }),
  })
}

export async function updateOperatorNumber(
  token: string,
  clientId: string,
  operator_notify_phone: string,
) {
  return req<Client>(`/api/v1/clients/${clientId}/operator-phone`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify({ operator_notify_phone }),
  })
}

export async function toggleClientPermissions(token: string, clientId: string, enabled: boolean) {
  return req<{ detail: string; client_id: string; client_changes_enabled: boolean }>(
    `/api/v1/clients/${clientId}/client-permissions`,
    {
      method: 'PATCH',
      headers: bearer(token),
      body: JSON.stringify({ client_changes_enabled: enabled }),
    },
  )
}

// ── Store-scoped (client JWT) ──────────────────────────────────────────────

export interface RevenueSummary {
  total_revenue: number
  counts_by_status: Record<string, number>
  daily: { date: string; label: string; revenue: number }[]
  period: 'daily' | 'weekly' | 'monthly'
  count: number
}

export async function getMyStore(token: string) {
  return req<Client>('/api/v1/clients/me', { headers: bearer(token) })
}

export async function getStoreOrders(token: string, merchantId: string, clientId: string, status?: string) {
  const qs = new URLSearchParams({ merchant_id: merchantId, client_id: clientId, limit: '200' })
  if (status) qs.set('status', status)
  return req<Order[]>(`/api/v1/orders/?${qs}`, { headers: bearer(token) })
}

export async function getStoreOrderDetail(token: string, orderId: string, merchantId: string) {
  return req<OrderDetail>(`/api/v1/orders/${orderId}/detail?merchant_id=${merchantId}`, {
    headers: bearer(token),
  })
}

export async function storeConfirmCashOrder(token: string, orderId: string, merchantId: string) {
  return req(`/api/v1/orders/${orderId}/confirm-cash?merchant_id=${merchantId}`, {
    method: 'POST',
    headers: bearer(token),
  })
}

export async function storeDispatchOrder(token: string, orderId: string, merchantId: string) {
  return req(`/api/v1/orders/${orderId}/mark-out-for-delivery?merchant_id=${merchantId}`, {
    method: 'POST',
    headers: bearer(token),
  })
}

export async function getRevenueSummary(
  token: string,
  merchantId: string,
  clientId: string | undefined,
  period: 'daily' | 'weekly' | 'monthly' = 'weekly',
  count = 0,
) {
  const qs = new URLSearchParams({ merchant_id: merchantId, period, count: String(count) })
  if (clientId) qs.set('client_id', clientId)
  return req<RevenueSummary>(`/api/v1/orders/revenue-summary?${qs}`, { headers: bearer(token) })
}

export async function storeUpdateDelivery(
  token: string,
  clientId: string,
  data: { delivery_enabled: boolean; delivery_fee: number },
) {
  return req<Client>(`/api/v1/clients/${clientId}/delivery`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify(data),
  })
}

// ── Subaccounts (payout accounts, per store) ──────────────────────────────

export interface Subaccount {
  client_id: string
  merchant_id: string
  subaccount_id: string
  account_bank: string
  account_number: string
  business_name: string
  split_value: string | null
  split_type: string | null
  active: boolean
  created_at: string
}

export async function getSubaccountBanks(token: string) {
  return req<{ banks: { code: string; name: string }[] }>('/api/v1/subaccounts/banks', {
    headers: bearer(token),
  })
}

export async function verifyBankAccount(
  token: string,
  account_number: string,
  account_bank: string,
) {
  return req<{ account_name: string; account_number: string; account_bank: string }>(
    '/api/v1/subaccounts/verify-account',
    {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify({ account_number, account_bank }),
    },
  )
}

export async function registerSubaccount(
  token: string,
  clientId: string,
  data: { account_bank: string; account_number: string; business_name: string },
) {
  return req<Subaccount>(`/api/v1/subaccounts/${clientId}`, {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify(data),
  })
}

export async function getSubaccount(token: string, clientId: string) {
  return req<Subaccount>(`/api/v1/subaccounts/${clientId}`, {
    headers: bearer(token),
  })
}

export async function deactivateSubaccount(token: string, clientId: string) {
  return req<{ detail: string }>(`/api/v1/subaccounts/${clientId}`, {
    method: 'DELETE',
    headers: bearer(token),
  })
}

// ── Products (inventory endpoint — requires X-headers) ────────────────────

export async function getInventory(token: string, merchantId: string, clientId: string) {
  return req<Product[]>('/api/v1/inventory/', {
    headers: { ...bearer(token), 'X-Merchant-ID': merchantId, 'X-Client-ID': clientId },
  })
}

export async function createProduct(
  token: string,
  merchantId: string,
  clientId: string,
  data: { name: string; price: number; description?: string; category?: string; initial_stock?: number },
) {
  return req<Product>('/api/v1/products/admin/', {
    method: 'POST',
    headers: { ...bearer(token), 'X-Merchant-ID': merchantId, 'X-Client-ID': clientId },
    body: JSON.stringify({ ...data, merchant_id: merchantId, client_id: clientId }),
  })
}

export async function updateProduct(
  token: string,
  merchantId: string,
  clientId: string,
  productId: string,
  data: { name?: string; price?: number; description?: string; category?: string },
) {
  return req<Product>(`/api/v1/products/admin/${productId}`, {
    method: 'PATCH',
    headers: { ...bearer(token), 'X-Merchant-ID': merchantId, 'X-Client-ID': clientId },
    body: JSON.stringify(data),
  })
}

export async function updateStock(
  token: string,
  merchantId: string,
  clientId: string,
  productId: string,
  quantity: number,
) {
  return req(`/api/v1/inventory/${productId}/stock`, {
    method: 'PATCH',
    headers: { ...bearer(token), 'X-Merchant-ID': merchantId, 'X-Client-ID': clientId },
    body: JSON.stringify({ quantity }),
  })
}

// ── Orders ─────────────────────────────────────────────────────────────────

export async function getOrders(token: string, merchantId: string, status?: string) {
  const qs = new URLSearchParams({ merchant_id: merchantId, limit: '200' })
  if (status) qs.set('status', status)
  return req<Order[]>(`/api/v1/orders/?${qs}`, {
    headers: bearer(token),
  })
}

export async function getOrderDetail(token: string, orderId: string, merchantId: string) {
  return req<OrderDetail>(`/api/v1/orders/${orderId}/detail?merchant_id=${merchantId}`, {
    headers: bearer(token),
  })
}

export async function confirmCashOrder(token: string, orderId: string, merchantId: string) {
  return req(`/api/v1/orders/${orderId}/confirm-cash?merchant_id=${merchantId}`, {
    method: 'POST',
    headers: bearer(token),
  })
}

export async function dispatchOrder(token: string, orderId: string, merchantId: string) {
  return req(`/api/v1/orders/${orderId}/mark-out-for-delivery?merchant_id=${merchantId}`, {
    method: 'POST',
    headers: bearer(token),
  })
}
