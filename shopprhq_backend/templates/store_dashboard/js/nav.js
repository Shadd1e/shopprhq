/**
 * store_dashboard/js/nav.js
 * Navigation for the store dashboard.
 *
 * Each page is loaded once per session. No background polling.
 * After a data-mutating action, call markPageStale('pageName') so
 * the next visit re-fetches fresh data.
 */

let _currentPage = 'overview';
const _loadedPages = new Set();

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

  // Only fetch data once per session per page; re-fetch only when explicitly staled.
  if (!_loadedPages.has(pageName) && loaders[pageName]) {
    _loadedPages.add(pageName);
    loaders[pageName]();
  }
}

// ── STALE HELPERS ─────────────────────────────────────────────────────────────

function markPageStale(...pages) {
  pages.forEach(p => _loadedPages.delete(p));
}

function refreshCurrentPage() {
  markPageStale(_currentPage);
  nav(_currentPage, document.querySelector('.sb-link.on'));
}

// ── SESSION RESET ─────────────────────────────────────────────────────────────

function resetNavState() {
  _loadedPages.clear();
  _currentPage = 'overview';
}
