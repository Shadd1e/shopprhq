/**
 * utils.js
 * Shared helpers: formatters, toast notifications, badge builders.
 * No API calls here — pure UI utilities.
 */

// ── XSS ESCAPING ─────────────────────────────────────────────────────────────

function escHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}
window.escHtml = escHtml;

// ── FORMATTERS ───────────────────────────────────────────────────────────────

function fmtMoney(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── BADGE BUILDERS ───────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    PAID:             ['g-badge',  'Paid'],
    FULFILLED:        ['g-badge',  'Fulfilled'],
    PENDING_PAYMENT:  ['a-badge',  'Pending Payment'],
    AWAITING_PICKUP:  ['b-badge',  'Awaiting Pickup'],
    OUT_FOR_DELIVERY: ['d-badge',  '🛵 Out for Delivery'],
    CANCELLED:        ['r-badge',  'Cancelled'],
    CREATED:          ['n-badge',  'Created'],
    REFUNDED:         ['n-badge',  'Refunded'],
  };
  const [cls, label] = map[status] || ['n-badge', status || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function stockBadge(qty, thresh) {
  if (qty === 0)                         return `<span class="sq sq-out">Out</span>`;
  if (thresh != null && qty <= thresh)   return `<span class="sq sq-lo">${qty}</span>`;
  return                                        `<span class="sq sq-ok">${qty}</span>`;
}

function codeChip(text) {
  return `<code style="background:var(--milk-2,#F0EFEB);padding:2px 8px;border-radius:4px;font-size:12px;font-family:monospace;letter-spacing:.02em">${escHtml(text)}</code>`;
}

// ── MODAL HELPERS ────────────────────────────────────────────────────────────

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Close modal when clicking the dark overlay behind it
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
  });
});

// ── TOAST ────────────────────────────────────────────────────────────────────

let _toastTimer;

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  // Safely convert anything to a string
  let text = msg;
  if (Array.isArray(msg))                          text = msg.map(e => e?.msg || JSON.stringify(e)).join(', ');
  else if (typeof msg === 'object' && msg !== null) text = msg?.detail || msg?.message || JSON.stringify(msg);
  el.textContent = String(text || 'Something went wrong');
  el.className   = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3200);
}
