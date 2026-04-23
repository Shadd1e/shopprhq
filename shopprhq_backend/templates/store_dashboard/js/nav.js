/**
 * store_dashboard/js/nav.js
 * Navigation for the store dashboard.
 * No "Add Store", no merchant-only settings tab.
 * Auto-refresh mirrors the merchant dashboard pattern.
 */

let _currentPage     = 'overview';
let _pollTimer       = null;
let _lastFingerprint = null;

const POLL_INTERVAL = 30000; // 30 seconds

// ── NAVIGATION ────────────────────────────────────────────────────────────────

function nav(pageName, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('on'));

  const pageEl = document.getElementById('pg-' + pageName);
  if (pageEl) pageEl.classList.add('on');
  if (btn) btn.classList.add('on');

  _currentPage = pageName;

  const loaders = {
    overview:  loadOverview,
    products:  loadProducts,
    inventory: loadInventory,
    orders:    loadOrders,
  };

  if (loaders[pageName]) loaders[pageName]();
}

// ── FINGERPRINT ───────────────────────────────────────────────────────────────

function _fingerprint(orders) {
  if (!orders || !orders.length) return 'empty';
  const count   = orders.length;
  const statuses = orders.slice(0, 5).map(o => o.status).join(',');
  const latest  = orders[0]?.created_at || '';
  return `${count}|${statuses}|${latest}`;
}

// ── BACKGROUND POLLING ────────────────────────────────────────────────────────

async function _poll() {
  try {
    const cid = localStorage.getItem('cid') || '';
    const res = await call(`/api/v1/orders/?client_id=${cid}&limit=20`);
    if (!res || !res.ok) return;
    const orders = await res.json();
    const fp = _fingerprint(orders);
    if (_lastFingerprint !== null && fp !== _lastFingerprint) {
      _silentRefresh();
    }
    _lastFingerprint = fp;
  } catch (_) {}
}

function _silentRefresh() {
  const loaders = {
    overview:  loadOverview,
    products:  loadProducts,
    inventory: loadInventory,
    orders:    loadOrders,
  };
  if (loaders[_currentPage]) loaders[_currentPage]();
  if (typeof toast === 'function') toast('New activity — refreshed', 'ok');
}

function _startPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(_poll, POLL_INTERVAL);
}

function _stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _stopPolling();
  } else {
    _poll();
    _startPolling();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  _startPolling();
});
