/**
 * overview.js
 * Dashboard overview: stats, email verification (code-based), revenue/orders summary,
 * and the setup badge that tracks store onboarding progress.
 */

async function initOnboarding() {
  const isStoreManager = !!localStorage.getItem('cid');

  // Fetch live email_verified status
  let emailVerified = localStorage.getItem('email_verified') === '1';
  try {
    const meRes = await call('/api/v1/merchants/me');
    if (meRes && meRes.ok) {
      const me = await meRes.json();
      emailVerified = !!me.email_verified;
      localStorage.setItem('email_verified', emailVerified ? '1' : '0');
      if (me.email) localStorage.setItem('memail', me.email);
    }
  } catch (_) {}

  const emailBanner = document.getElementById('email-verify-banner');
  if (emailBanner) {
    if (!emailVerified && !isStoreManager) {
      const emailEl = document.getElementById('ev-email-display');
      if (emailEl) emailEl.textContent = localStorage.getItem('memail') || '';
      emailBanner.style.display = 'block';
    } else {
      emailBanner.style.display = 'none';
    }
  }

  if (!isStoreManager) await _initSetupBadge();
}

// ── EMAIL VERIFICATION (CODE) ─────────────────────────────────────────────────

async function submitVerificationCode() {
  const input = document.getElementById('ev-code-input');
  const code  = (input?.value || '').trim();

  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    toast('Enter the 6-digit code from your email', 'err');
    return;
  }

  const res = await call('/api/v1/merchants/verify-email-code', {
    method: 'POST',
    body:   { code },
  });

  if (!res) return;

  if (res.ok) {
    localStorage.setItem('email_verified', '1');
    const banner = document.getElementById('email-verify-banner');
    if (banner) banner.style.display = 'none';
    toast('Email verified! Your account is now active. 🎉', 'ok');
  } else {
    const err = await res.json().catch(() => ({}));
    toast(err.detail || 'Incorrect code. Try again.', 'err');
    if (input) { input.value = ''; input.focus(); }
  }
}

async function resendVerification() {
  const btn = document.getElementById('ev-resend-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const res = await call('/api/v1/merchants/resend-verification', { method: 'POST' });
  if (btn) { btn.disabled = false; btn.textContent = 'Resend Code'; }
  if (res && res.ok) {
    toast('New code sent — check your inbox', 'ok');
    const input = document.getElementById('ev-code-input');
    if (input) { input.value = ''; input.focus(); }
  } else {
    toast('Could not send code. Try again shortly.', 'err');
  }
}

function openChangeEmail() {
  const current = localStorage.getItem('memail') || '';
  document.getElementById('cev-input').value = '';
  document.getElementById('cev-current').textContent = current;
  openModal('m-change-email');
}

async function submitChangeEmail() {
  const newEmail = document.getElementById('cev-input').value.trim();
  const btn      = document.getElementById('cev-submit');
  if (!newEmail || !newEmail.includes('@')) {
    toast('Enter a valid email address', 'err'); return;
  }
  btn.disabled = true; btn.textContent = 'Saving…';
  const res = await call('/api/v1/merchants/change-email', {
    method: 'POST',
    body:   { email: newEmail },
  });
  btn.disabled = false; btn.textContent = 'Update & Resend';
  if (res && res.ok) {
    const data = await res.json();
    localStorage.setItem('memail', data.email || newEmail);
    localStorage.setItem('email_verified', '0');
    closeModal('m-change-email');
    toast('Email updated — enter the new code when it arrives', 'ok');
    const emailEl = document.getElementById('ev-email-display');
    if (emailEl) emailEl.textContent = data.email || newEmail;
    const banner = document.getElementById('email-verify-banner');
    if (banner) banner.style.display = 'block';
    const input = document.getElementById('ev-code-input');
    if (input) input.value = '';
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to update email', 'err');
  }
}

// ── SETUP BADGE ───────────────────────────────────────────────────────────────

const _SETUP_STEPS = [
  { key: 'waba_active',  label: 'Connect WhatsApp number', target: 'settings' },
  { key: 'has_products', label: 'Add your first product',  target: 'products' },
  { key: 'has_bank',     label: 'Connect bank account',    target: 'settings' },
];

async function _initSetupBadge() {
  let status = null;
  try {
    const res = await call('/api/v1/clients/checklist-status');
    if (res && res.ok) status = await res.json();
  } catch (_) {}

  // If the API call failed entirely, default to showing all steps pending
  // so the badge is visible rather than silently broken.
  if (!status) {
    status = { waba_active: false, has_products: false, has_bank: false };
  }

  _renderSetupBadge(status);
}

// Call this after any action that may complete a setup step.
async function refreshSetupBadge() {
  await _initSetupBadge();
}

function _hideSetupBadges() {
  const top = document.getElementById('setup-trigger-top');
  const sb  = document.getElementById('setup-trigger-sb');
  if (top) top.style.display = 'none';
  if (sb)  sb.style.display  = 'none';
}

function _renderSetupBadge(status) {
  const pending = _SETUP_STEPS.filter(s => !status[s.key]);
  if (pending.length === 0) { _hideSetupBadges(); return; }

  window._setupPending = pending;

  const top    = document.getElementById('setup-trigger-top');
  const sb     = document.getElementById('setup-trigger-sb');
  const badgeT = document.getElementById('setup-badge-top');
  const badgeSB = document.getElementById('setup-badge-sb');

  if (top)    { top.style.display    = 'flex'; }
  if (sb)     { sb.style.display     = 'flex'; }
  if (badgeT)  badgeT.textContent  = pending.length;
  if (badgeSB) badgeSB.textContent = pending.length;
}

function toggleSetupDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('setup-dropdown');
  if (!dd) return;

  if (dd.style.display !== 'none') { dd.style.display = 'none'; return; }

  const pending = window._setupPending || [];

  if (pending.length === 0) {
    dd.innerHTML = '<div class="setup-dd-done">✓ Store setup complete</div>';
  } else {
    dd.innerHTML =
      `<div class="setup-dd-heading">Setup &mdash; ${pending.length} remaining</div>` +
      pending.map(s =>
        `<button class="setup-dd-item"
           onclick="nav('${s.target}',document.querySelector('[onclick*=${s.target}]'));closeSetupDropdown()">
           <span class="setup-dd-dot"></span>
           <span class="setup-dd-label">${s.label}</span>
           <span class="setup-dd-arrow">→</span>
         </button>`
      ).join('');
  }

  const rect = e.currentTarget.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 6) + 'px';
  dd.style.left = Math.max(8, rect.right - 248) + 'px';
  dd.style.display = 'block';
}

function closeSetupDropdown() {
  const dd = document.getElementById('setup-dropdown');
  if (dd) dd.style.display = 'none';
}

document.addEventListener('click', closeSetupDropdown);

// ── REVENUE CHART ─────────────────────────────────────────────────────────────

function renderRevenueChart(periodData) {
  const container = document.getElementById('rev-chart');
  if (!container) return;
  const points = (periodData || []).slice(-8);
  if (!points.length) { container.innerHTML = ''; return; }
  const maxRev = Math.max(...points.map(d => d.revenue), 1);
  const bars = points.map(d => {
    const pct = Math.max((d.revenue / maxRev) * 100, d.revenue > 0 ? 4 : 0).toFixed(1);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;
        gap:4px;flex:1;min-width:0">
        <div style="font-size:10px;color:var(--ink-4);white-space:nowrap">
          ${d.revenue > 0 ? fmtMoney(d.revenue) : ''}
        </div>
        <div style="
          height:${pct}%;min-height:${d.revenue > 0 ? '4px' : '0'};
          background:var(--wa,#25D366);border-radius:4px 4px 0 0;
          width:70%;transition:height .4s ease;opacity:.85
        "></div>
        <div style="font-size:10px;color:var(--ink-3);white-space:nowrap;
          overflow:hidden;max-width:100%;text-overflow:ellipsis;
          text-align:center">
          ${escHtml(d.label)}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;
      letter-spacing:.05em;color:var(--ink-3);margin-bottom:8px">Revenue trend</div>
    <div style="display:flex;align-items:flex-end;
      height:100px;gap:6px;border-bottom:1px solid var(--border);
      padding-bottom:0">
      ${bars}
    </div>`;
}

function _computeDailyRevenue(orders, days = 8) {
  const PAID = ['PAID', 'FULFILLED'];
  const now  = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d       = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const label   = i === days - 1
      ? 'Today'
      : d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    const revenue = orders
      .filter(o => PAID.includes(o.status) && o.created_at && o.created_at.slice(0, 10) === dateStr)
      .reduce((s, o) => s + (o.total_amount || 0), 0);
    return { label, revenue };
  });
}

// ── OVERVIEW LOAD ─────────────────────────────────────────────────────────────

async function loadOverview() {
  await initOnboarding();
  const mid = localStorage.getItem('mid') || '';

  const fullName  = localStorage.getItem('mname') || '';
  const firstName = fullName.split(' ')[0] || 'there';
  const nameEl    = document.getElementById('g-name');
  if (nameEl) nameEl.textContent = firstName;

  const res = await call(`/api/v1/orders/?merchant_id=${mid}&limit=500`);
  if (!res) return;

  const orders = await res.json();
  const list   = Array.isArray(orders) ? orders : [];

  const now        = new Date();
  const todayStr   = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function isToday(o)     { return o.created_at && o.created_at.slice(0, 10) === todayStr; }
  function isThisMonth(o) {
    if (!o.created_at) return false;
    const dt = new Date(o.created_at);
    return dt >= monthStart && dt <= now;
  }

  const PAID = ['PAID', 'FULFILLED'];

  const monthOrders = list.filter(isThisMonth);
  const monthRev    = monthOrders.filter(o => PAID.includes(o.status))
                                 .reduce((s, o) => s + (o.total_amount || 0), 0);
  const monthTotal  = monthOrders.length;

  const todayOrders = list.filter(isToday);
  const todayRev    = todayOrders.filter(o => PAID.includes(o.status))
                                 .reduce((s, o) => s + (o.total_amount || 0), 0);
  const todayTotal  = todayOrders.length;

  const pending     = list.filter(o => o.status === 'PENDING_PAYMENT').length;
  const awaitPickup = list.filter(o => o.status === 'AWAITING_PICKUP').length;

  const revNum = document.getElementById('st-rev-num');
  const revSub = document.getElementById('st-rev-sub');
  if (revNum) revNum.textContent = fmtMoney(todayRev);
  if (revSub) revSub.innerHTML   = `<strong>${fmtMoney(monthRev)}</strong> this month`;

  const ordNum = document.getElementById('st-ord-num');
  const ordSub = document.getElementById('st-ord-sub');
  if (ordNum) ordNum.textContent = todayTotal;
  if (ordSub) ordSub.innerHTML   = `<strong>${monthTotal}</strong> this month`;

  const pend = document.getElementById('st-pend');
  const cash = document.getElementById('st-cash');
  if (pend) pend.textContent = pending;
  if (cash) cash.textContent = awaitPickup;

  renderRevenueChart(_computeDailyRevenue(list));
  renderOrderRows('r-orders', list.slice(0, 8));
}
