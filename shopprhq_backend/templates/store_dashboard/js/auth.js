/**
 * store_dashboard/js/auth.js
 * Client-scoped auth for the store dashboard.
 * Mirrors dashboard/js/auth.js but uses cid/cname keys and redirects to /store-login.
 */

function storeDashLogout() {
  localStorage.removeItem('tok');
  localStorage.removeItem('cid');
  localStorage.removeItem('cname');
  localStorage.removeItem('mid');

  window.location.replace('/store-login');
}

function confirmStoreDashLogout() {
  closeModal('m-logout');
  storeDashLogout();
}

function showStoreDash() {
  const cname = localStorage.getItem('cname') || 'Store';
  const cid   = localStorage.getItem('cid')   || '—';

  document.getElementById('auth').style.display = 'none';
  document.getElementById('app').style.display  = 'block';

  const avEl   = document.getElementById('s-av');
  const nameEl = document.getElementById('s-name');
  const idEl   = document.getElementById('s-id');

  if (avEl)   avEl.textContent   = cname.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = cname;
  if (idEl)   idEl.textContent   = cid;

  // Kick off initial data loads
  if (typeof loadOverview  === 'function') loadOverview();
  if (typeof loadProducts  === 'function') loadProducts();
  if (typeof loadOrders    === 'function') loadOrders();
  if (typeof loadInventory === 'function') loadInventory();
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const tok = localStorage.getItem('tok');
  const cid = localStorage.getItem('cid');

  if (!tok || !cid) {
    // Not logged in — kick to login page
    window.location.replace('/store-login');
    return;
  }

  showStoreDash();
});
