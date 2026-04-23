/**
 * nav.js
 * Handles sidebar navigation, page switching, and background auto-refresh.
 *
 * AUTO-REFRESH:
 * - Polls GET /api/v1/orders/ every 30 seconds in the background.
 * - Compares a lightweight fingerprint (order count + recent statuses + latest timestamp).
 * - If anything changed, silently reloads only the active page's data.
 * - Pauses when the tab is hidden, resumes + polls immediately when it returns.
 * - Stopped cleanly on logout.
 */

let _currentPage     = 'overview';
let _pollTimer       = null;
let _lastFingerprint = null;

const POLL_INTERVAL = 30000; // 30 seconds

// ── NAVIGATION ────────────────────────────────────────────────────────────────

function nav(pageName, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('on'));

  document.getElementById('pg-' + pageName).classList.add('on');
  if (btn) btn.classList.add('on');

  _currentPage = pageName;

  // Re-run checklist whenever merchant comes back to overview
  if (pageName === 'overview' && typeof renderChecklist === 'function') {
    renderChecklist();
  }

  const loaders = {
    overview:  loadOverview,
    products:  loadProducts,
    inventory: loadInventory,
    orders:    loadOrders,
    settings:  loadSettings,
  };

  if (loaders[pageName]) loaders[pageName]();
}

// ── FINGERPRINT ───────────────────────────────────────────────────────────────
// A cheap string that changes whenever orders are added, confirmed, cancelled,
// or paid — without doing a full data diff.

function _fingerprint(orders) {
  if (!Array.isArray(orders) || !orders.length) return 'empty';
  const count    = orders.length;
  const statuses = orders.slice(0, 20).map(function(o) { return o.status[0]; }).join('');
  const latest   = (orders[0] && (orders[0].updated_at || orders[0].created_at)) || '';
  return count + ':' + statuses + ':' + latest;
}

// ── POLL ──────────────────────────────────────────────────────────────────────

async function _pollForChanges() {
  const mid = localStorage.getItem('mid');
  if (!mid || !localStorage.getItem('tok')) return;

  try {
    const res = await call('/api/v1/orders/?merchant_id=' + mid + '&limit=50');
    if (!res || !res.ok) return;

    const orders = await res.json();
    const fp     = _fingerprint(Array.isArray(orders) ? orders : []);

    if (_lastFingerprint === null) {
      _lastFingerprint = fp; // baseline — don't trigger a reload on first check
      return;
    }

    if (fp !== _lastFingerprint) {
      _lastFingerprint = fp;
      _refreshCurrentPage();
    }
  } catch (e) {
    // Swallow — a poll failure should never surface to the user
  }
}

function _refreshCurrentPage() {
  var loaders = {
    overview:  typeof loadOverview  === 'function' ? loadOverview  : null,
    products:  typeof loadProducts  === 'function' ? loadProducts  : null,
    inventory: typeof loadInventory === 'function' ? loadInventory : null,
    orders:    typeof loadOrders    === 'function' ? loadOrders    : null,
    settings:  typeof loadSettings  === 'function' ? loadSettings  : null,
  };
  if (loaders[_currentPage]) loaders[_currentPage]();
}

// ── POLL LIFECYCLE ────────────────────────────────────────────────────────────

function startPolling() {
  stopPolling();
  _lastFingerprint = null;
  // First check after 5 seconds (let the page fully load first)
  setTimeout(_pollForChanges, 5000);
  _pollTimer = setInterval(_pollForChanges, POLL_INTERVAL);
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

function stopPolling() {
  clearInterval(_pollTimer);
  _pollTimer = null;
  _lastFingerprint = null;
  document.removeEventListener('visibilitychange', _onVisibilityChange);
}

function _onVisibilityChange() {
  if (document.hidden) {
    clearInterval(_pollTimer);
  } else {
    // Tab came back — poll immediately, then restart the regular interval
    _pollForChanges();
    _pollTimer = setInterval(_pollForChanges, POLL_INTERVAL);
  }
}
