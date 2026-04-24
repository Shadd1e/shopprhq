/**
 * nav.js
 * Handles sidebar navigation and one-shot page data loading.
 *
 * Each page is loaded once per session. No background polling.
 * After a data-mutating action (add product, save settings), call
 * markPageStale('pageName') so the next visit re-fetches fresh data.
 */

let _currentPage = 'overview';
const _loadedPages = new Set();

// ── NAVIGATION ────────────────────────────────────────────────────────────────

function nav(pageName, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('on'));

  document.getElementById('pg-' + pageName).classList.add('on');
  if (btn) btn.classList.add('on');

  _currentPage = pageName;

  const loaders = {
    overview:  loadOverview,
    products:  loadProducts,
    inventory: loadInventory,
    orders:    loadOrders,
    settings:  loadSettings,
  };

  // Only fetch data once per session per page; re-fetch only when explicitly staled.
  if (!_loadedPages.has(pageName) && loaders[pageName]) {
    _loadedPages.add(pageName);
    loaders[pageName]();
  }
}

// ── STALE HELPERS ─────────────────────────────────────────────────────────────

/**
 * Mark pages as needing a fresh fetch on their next visit.
 * Call after any user action that mutates data.
 *
 * Examples:
 *   markPageStale('inventory', 'overview');   // after adding a product
 *   markPageStale('settings');                // after saving store settings
 *   markPageStale('orders');                  // after confirming an order
 */
function markPageStale(...pages) {
  pages.forEach(p => _loadedPages.delete(p));
}

/**
 * Reload the currently visible page right now (e.g. after a successful save
 * where you want instant feedback without a tab switch).
 */
function refreshCurrentPage() {
  markPageStale(_currentPage);
  nav(_currentPage, document.querySelector('.sb-link.on'));
}

// ── SESSION RESET ─────────────────────────────────────────────────────────────

/**
 * Clear all nav state on logout so the next login always fetches fresh data.
 */
function resetNavState() {
  _loadedPages.clear();
  _currentPage = 'overview';
}
