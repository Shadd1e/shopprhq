/**
 * orders.js
 * Orders table, order detail modal, print receipt, and cash order confirmation.
 *
 * Endpoints:
 *   GET  /api/v1/orders/?merchant_id=X&status=X&limit=200
 *   GET  /api/v1/orders/{id}/detail?merchant_id=X
 *   POST /api/v1/orders/{id}/confirm-cash?merchant_id=X
 *   POST /api/v1/orders/{id}/mark-out-for-delivery?merchant_id=X
 */

// ── Load orders table ─────────────────────────────────────────────────────────

async function loadOrders() {
  await populateOrderStoreFilter();

  const mid      = localStorage.getItem('mid') || '';
  const cid      = localStorage.getItem('cid') || '';
  const status   = document.getElementById('o-filter')?.value || '';
  const clientId = document.getElementById('o-store-filter')?.value || cid;
  let qs = `merchant_id=${mid}&limit=50`;
  if (status)   qs += `&status=${status}`;
  if (clientId) qs += `&client_id=${clientId}`;

  setTableLoading('t-orders', 7);

  const res = await call(`/api/v1/orders/?${qs}`);
  if (!res) return;

  const data = await res.json();
  renderOrderRows('t-orders', Array.isArray(data) ? data : []);
}

async function populateOrderStoreFilter() {
  if (typeof clients === 'undefined') return;
  if (!clients.length && typeof loadClients === 'function') await loadClients();
  const sel = document.getElementById('o-store-filter');
  if (!sel || clients.length <= 1) {
    if (sel) sel.style.display = 'none';
    return;
  }
  sel.innerHTML = '<option value="">All stores</option>' +
    clients.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
  sel.onchange = () => {
    markPageStale('orders');
    loadOrders();
  };
}

function renderOrderRows(tbodyId, orders) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = emptyRow(7, '🧾', 'No orders found');
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr style="cursor:pointer" data-order-id="${escHtml(o.id)}">
      <td>${codeChip(o.order_code)}</td>
      <td style="font-size:13px;color:var(--ink-3)">${escHtml(o.customer_name || (o.user_id ? '+' + o.user_id : '—'))}</td>
      <td style="font-weight:600">${fmtMoney(o.total_amount)}</td>
      <td><span class="badge n-badge" style="text-transform:capitalize">${fmtPaymentMethod(o.payment_method)}</span></td>
      <td>${statusBadge(o.status)}</td>
      <td style="font-size:13px;color:var(--ink-3)">${fmtDate(o.created_at)}</td>
      <td>
        ${o.status === 'AWAITING_PICKUP'
          ? `<button class="btn-xs" style="border-color:var(--wa);color:var(--wa-dark)"
               data-action="quick-confirm" data-order-id="${escHtml(o.id)}" data-order-code="${escHtml(o.order_code)}">
               Confirm
             </button>`
          : o.status === 'OUT_FOR_DELIVERY'
          ? `<button class="btn-xs" style="border-color:var(--wa);color:var(--wa-dark)"
               data-action="quick-confirm" data-order-id="${escHtml(o.id)}" data-order-code="${escHtml(o.order_code)}">
               Mark Delivered
             </button>`
          : ''
        }
      </td>
    </tr>
  `).join('');

  // Event delegation — one handler per render, overwrites previous
  tbody.onclick = (e) => {
    const btn = e.target.closest('button[data-action]');
    if (btn) {
      e.stopPropagation();
      if (btn.dataset.action === 'quick-confirm') {
        quickConfirm(btn.dataset.orderId, btn.dataset.orderCode);
      }
      return;
    }
    const row = e.target.closest('tr[data-order-id]');
    if (row) openOrderDetail(row.dataset.orderId);
  };
}

function fmtPaymentMethod(method) {
  if (!method) return '—';
  if (method === 'card') return 'Card';
  if (method === 'cash') return 'Cash';
  return method;
}

// ── Order detail modal ────────────────────────────────────────────────────────

// Store the currently viewed order so the print button can use it
let _currentOrder = null;

async function openOrderDetail(orderId) {
  const mid = localStorage.getItem('mid') || '';
  _currentOrder = null;

  // Show modal immediately with loading state
  document.getElementById('od-body').innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--ink-3)">Loading…</div>';
  document.getElementById('od-confirm-btn').style.display  = 'none';
  document.getElementById('od-deliver-btn') && (document.getElementById('od-deliver-btn').style.display = 'none');
  document.getElementById('od-print-btn')  && (document.getElementById('od-print-btn').style.display  = 'none');
  openModal('m-order-detail');

  const res = await call(`/api/v1/orders/${orderId}/detail?merchant_id=${mid}`);
  if (!res || !res.ok) {
    document.getElementById('od-body').innerHTML =
      '<div style="padding:24px;color:var(--red)">Failed to load order details. Please try again.</div>';
    return;
  }

  const o = await res.json();
  _currentOrder = o;

  // ── Items table ─────────────────────────────────────────────────────────────
  const subtotalsTotal = o.items && o.items.length
    ? o.items.reduce((s, i) => s + i.subtotal, 0)
    : 0;

  const itemsHtml = o.items && o.items.length
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 0;font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--border)">Product</th>
            <th style="text-align:center;padding:8px 0;font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--border)">Qty</th>
            <th style="text-align:right;padding:8px 0;font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--border)">Unit</th>
            <th style="text-align:right;padding:8px 0;font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--border)">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map(i => `
            <tr>
              <td style="padding:10px 0;font-size:13.5px;font-weight:500;border-bottom:1px solid var(--border-2)">${escHtml(i.product_name)}</td>
              <td style="padding:10px 0;font-size:13.5px;text-align:center;color:var(--ink-3);border-bottom:1px solid var(--border-2)">${i.quantity}</td>
              <td style="padding:10px 0;font-size:13.5px;text-align:right;color:var(--ink-3);border-bottom:1px solid var(--border-2)">${fmtMoney(i.price)}</td>
              <td style="padding:10px 0;font-size:13.5px;text-align:right;font-weight:600;border-bottom:1px solid var(--border-2)">${fmtMoney(i.subtotal)}</td>
            </tr>
          `).join('')}
          ${o.delivery_fee ? `
          <tr>
            <td colspan="3" style="padding:10px 0;font-size:13px;color:var(--ink-3);border-bottom:1px solid var(--border-2)">Delivery fee</td>
            <td style="padding:10px 0;font-size:13px;text-align:right;color:var(--ink-3);border-bottom:1px solid var(--border-2)">${fmtMoney(o.delivery_fee)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="3" style="padding:12px 0;font-weight:600;font-size:14px">Total</td>
            <td style="padding:12px 0;font-weight:700;font-size:15px;text-align:right;color:var(--wa-dark)">${fmtMoney(o.total_amount)}</td>
          </tr>
        </tbody>
      </table>`
    : '<div style="color:var(--ink-3);font-size:13px;padding:8px 0">No items found for this order.</div>';

  // ── Delivery block (only shown for delivery orders) ──────────────────────
  const deliveryHtml = o.delivery_type === 'delivery' ? `
    <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:4px">
      <div style="font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px">Delivery Info</div>
      <div style="display:grid;gap:10px">
        ${o.delivery_address ? `
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px">Address</div>
          <div style="font-size:13.5px">${escHtml(o.delivery_address)}</div>
        </div>` : ''}
        ${o.delivery_contact_number ? `
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px">Contact Number</div>
          <div style="font-size:13.5px">+${escHtml(o.delivery_contact_number)}</div>
        </div>` : ''}
      </div>
    </div>` : '';

  // ── Payment method label ──────────────────────────────────────────────────
  const paymentLabel = o.payment_method === 'card'
    ? 'Paid by Card'
    : o.delivery_type === 'delivery'
    ? 'Cash on Delivery'
    : 'Cash Pickup';

  // ── Render body ───────────────────────────────────────────────────────────
  document.getElementById('od-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">Order Code</div>
        <div style="font-size:15px;font-weight:700">${escHtml(o.order_code)}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">Status</div>
        <div>${statusBadge(o.status)}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">Customer</div>
        <div style="font-size:13.5px">${escHtml(o.customer_name) || (o.user_id ? '+' + escHtml(o.user_id) : '—')}</div>
        ${o.user_id && o.customer_name ? `<div style="font-size:12px;color:var(--ink-3);margin-top:2px">+${escHtml(o.user_id)}</div>` : ''}
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">Payment</div>
        <div style="font-size:13.5px">${paymentLabel}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">Placed</div>
        <div style="font-size:13.5px">${fmtDate(o.created_at)}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">Confirmed</div>
        <div style="font-size:13.5px">${o.confirmed_at ? fmtDate(o.confirmed_at) : '—'}</div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px">
      <div style="font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px">Items Ordered</div>
      ${itemsHtml}
    </div>
    ${deliveryHtml}
  `;

  // ── Action buttons ────────────────────────────────────────────────────────
  const confirmBtn = document.getElementById('od-confirm-btn');
  const deliverBtn = document.getElementById('od-deliver-btn');
  const printBtn   = document.getElementById('od-print-btn');

  // Confirm button — cash orders that are ready for confirmation
  if (
    o.payment_method === 'cash' &&
    (o.status === 'AWAITING_PICKUP' || o.status === 'OUT_FOR_DELIVERY')
  ) {
    confirmBtn.style.display = 'inline-flex';
    confirmBtn.setAttribute('data-order-id',   o.id);
    confirmBtn.setAttribute('data-order-code', o.order_code);
  } else {
    confirmBtn.style.display = 'none';
  }

  // Out-for-delivery button — cash delivery orders that are AWAITING_PICKUP
  if (deliverBtn) {
    if (o.payment_method === 'cash' && o.delivery_type === 'delivery' && o.status === 'AWAITING_PICKUP') {
      deliverBtn.style.display = 'inline-flex';
      deliverBtn.setAttribute('data-order-id',   o.id);
      deliverBtn.setAttribute('data-order-code', o.order_code);
    } else {
      deliverBtn.style.display = 'none';
    }
  }

  // Print button — always visible once order is loaded
  if (printBtn) {
    printBtn.style.display = 'inline-flex';
  }
}

// ── Print receipt ─────────────────────────────────────────────────────────────

function printOrderReceipt() {
  const o = _currentOrder;
  if (!o) return;

  // Store info comes from the order detail response (injected by backend)
  const storeName    = o.store_name    || document.getElementById('s-name')?.textContent?.trim() || '';
  const storeAddress = o.store_address || '';

  const paymentLabel = o.payment_method === 'card'
    ? 'Paid by Card'
    : o.delivery_type === 'delivery'
    ? 'Cash on Delivery'
    : 'Cash Pickup';

  // Build item rows — compact thermal style
  const itemRows = (o.items || []).map(i => `
    <tr>
      <td class="td-name">${escHtml(i.product_name)}</td>
      <td class="td-qty">${i.quantity}</td>
      <td class="td-amt">${fmtMoney(i.subtotal)}</td>
    </tr>
  `).join('');

  const deliveryRow = o.delivery_fee
    ? `<tr>
        <td class="td-name" style="color:#555">Delivery fee</td>
        <td class="td-qty"></td>
        <td class="td-amt" style="color:#555">${fmtMoney(o.delivery_fee)}</td>
       </tr>`
    : '';

  const deliveryBlock = o.delivery_type === 'delivery' && o.delivery_address
    ? `<div class="section">
        <div class="label">DELIVER TO</div>
        <div class="value">${escHtml(o.delivery_address)}</div>
        ${o.delivery_contact_number ? `<div class="value">Tel: +${escHtml(o.delivery_contact_number)}</div>` : ''}
      </div>`
    : '';

  const customerLine = escHtml(o.customer_name || (o.user_id ? '+' + o.user_id : ''));

  const win = window.open('', '_blank', 'width=340,height=600');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt — ${escHtml(o.order_code)}</title>
  <style>
    /* ── Thermal receipt: 80mm roll = ~302px usable at 96dpi ── */
    * { margin:0; padding:0; box-sizing:border-box; }

    @page {
      size: 80mm auto;
      margin: 4mm 3mm;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      width: 302px;
      margin: 0 auto;
      padding: 8px 6px 16px;
    }

    /* ── Header ── */
    .header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
      margin-bottom: 10px;
    }
    .store-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: .08em;
      line-height: 1.2;
    }
    .store-address {
      font-size: 10px;
      margin-top: 3px;
      line-height: 1.4;
      color: #333;
    }

    /* ── Section blocks ── */
    .section {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #000;
    }
    .label {
      font-size: 9px;
      font-weight: bold;
      letter-spacing: .1em;
      color: #555;
      margin-bottom: 2px;
    }
    .value {
      font-size: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }

    /* ── Items table ── */
    table { width: 100%; border-collapse: collapse; }
    .th-name { text-align: left; font-size: 9px; letter-spacing: .08em; color:#555; padding-bottom: 4px; }
    .th-qty  { text-align: center; font-size: 9px; letter-spacing: .08em; color:#555; padding-bottom: 4px; width: 28px; }
    .th-amt  { text-align: right; font-size: 9px; letter-spacing: .08em; color:#555; padding-bottom: 4px; }
    .td-name { padding: 3px 0; font-size: 12px; }
    .td-qty  { padding: 3px 0; font-size: 12px; text-align: center; width: 28px; }
    .td-amt  { padding: 3px 0; font-size: 12px; text-align: right; }

    /* ── Total ── */
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0 6px;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      margin: 6px 0 10px;
    }
    .total-label { font-size: 13px; font-weight: bold; }
    .total-amt   { font-size: 14px; font-weight: bold; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      margin-top: 12px;
      font-size: 9px;
      color: #888;
      letter-spacing: .04em;
    }

    /* ── Print-only tweaks ── */
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Store header -->
  <div class="header">
    ${storeName ? `<div class="store-name">${escHtml(storeName)}</div>` : ''}
    ${storeAddress ? `<div class="store-address">${escHtml(storeAddress)}</div>` : ''}
  </div>

  <!-- Order meta -->
  <div class="section">
    <div class="row">
      <span class="label" style="margin-bottom:0">ORDER</span>
      <span class="value" style="font-weight:bold">${escHtml(o.order_code)}</span>
    </div>
    <div class="row">
      <span class="label" style="margin-bottom:0">DATE</span>
      <span class="value">${fmtDate(o.created_at)}</span>
    </div>
    ${customerLine ? `<div class="row">
      <span class="label" style="margin-bottom:0">CUSTOMER</span>
      <span class="value">${customerLine}</span>
    </div>` : ''}
    <div class="row" style="margin-bottom:0">
      <span class="label" style="margin-bottom:0">PAYMENT</span>
      <span class="value">${paymentLabel}</span>
    </div>
  </div>

  <!-- Items -->
  <div class="section">
    <table>
      <thead>
        <tr>
          <th class="th-name">ITEM</th>
          <th class="th-qty">QTY</th>
          <th class="th-amt">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${deliveryRow}
      </tbody>
    </table>
  </div>

  <!-- Total -->
  <div class="total-row">
    <span class="total-label">TOTAL</span>
    <span class="total-amt">${fmtMoney(o.total_amount)}</span>
  </div>

  ${deliveryBlock}

  <!-- Footer -->
  <div class="footer">
    --------------------------------<br>
    Powered by ShopprHQ
  </div>

  <div class="no-print" style="margin-top:20px;text-align:center">
    <button onclick="window.print()"
      style="padding:9px 24px;background:#111;color:#fff;border:none;border-radius:6px;
        font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">
      🖨 Print Receipt
    </button>
  </div>

</body>
</html>`);

  win.document.close();
  win.focus();
  // Short delay so styles load before auto-print
  setTimeout(() => win.print(), 600);
}

// ── Confirm cash order (from detail modal) ────────────────────────────────────

async function confirmOrderFromModal() {
  const btn       = document.getElementById('od-confirm-btn');
  const orderId   = btn.getAttribute('data-order-id');
  const code      = btn.getAttribute('data-order-code');
  const mid       = localStorage.getItem('mid') || '';

  if (!confirm(`Confirm payment received for order ${code}?\n\nThis will mark the order as fulfilled and send a receipt to the customer.`)) return;

  btn.disabled    = true;
  btn.textContent = 'Confirming…';

  const res = await call(`/api/v1/orders/${orderId}/confirm-cash?merchant_id=${mid}`, {
    method: 'POST',
  });

  if (res && res.ok) {
    toast(`Order ${code} confirmed — receipt sent to customer`, 'ok');
    closeModal('m-order-detail');
    await loadOrders();
    loadOverview();
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Confirmation failed', 'err');
    btn.disabled    = false;
    btn.textContent = 'Confirm Payment Received';
  }
}

// ── Mark out for delivery (from detail modal) ─────────────────────────────────

async function markOutForDeliveryFromModal() {
  const btn     = document.getElementById('od-deliver-btn');
  const orderId = btn.getAttribute('data-order-id');
  const code    = btn.getAttribute('data-order-code');
  const mid     = localStorage.getItem('mid') || '';

  if (!confirm(`Mark order ${code} as out for delivery?\n\nThe customer will be notified via WhatsApp.`)) return;

  btn.disabled    = true;
  btn.textContent = 'Updating…';

  const res = await call(`/api/v1/orders/${orderId}/mark-out-for-delivery?merchant_id=${mid}`, {
    method: 'POST',
  });

  if (res && res.ok) {
    toast(`Order ${code} is now out for delivery`, 'ok');
    closeModal('m-order-detail');
    await loadOrders();
    loadOverview();
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to update', 'err');
    btn.disabled    = false;
    btn.textContent = 'Out for Delivery';
  }
}

// ── Quick confirm from table row ──────────────────────────────────────────────

async function quickConfirm(orderId, orderCode) {
  const mid = localStorage.getItem('mid') || '';
  if (!confirm(`Confirm payment received for order ${orderCode}?`)) return;

  const res = await call(`/api/v1/orders/${orderId}/confirm-cash?merchant_id=${mid}`, {
    method: 'POST',
  });

  if (res && res.ok) {
    toast(`Order ${orderCode} confirmed — receipt sent to customer`, 'ok');
    await loadOrders();
    loadOverview();
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Confirmation failed', 'err');
  }
}

// ── Shared helpers used by overview.js ───────────────────────────────────────

function setTableLoading(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td class="loading-cell" colspan="${cols}">Loading…</td></tr>`;
}

function emptyRow(cols, icon, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:48px;color:var(--ink-3)">
    <div style="font-size:32px;margin-bottom:10px">${icon}</div>
    <div style="font-size:13px">${msg}</div>
  </td></tr>`;
}
