/**
 * overview.js
 * Dashboard overview: stats, email verification (code-based), revenue/orders summary.
 *
 * ONBOARDING (checklist, guide modal, WABA banner) — commented out for MVP.
 * Search for "MVP-COMMENTED" to find and restore when needed.
 */

// MVP-COMMENTED: const SUPPORT_WHATSAPP = '';
// MVP-COMMENTED: function openOnboardingGuide() { openModal('m-guide'); }

async function initOnboarding() {
  // Store managers (cid in localStorage) share this dashboard but shouldn't
  // see merchant-specific banners like email verification.
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

  // Hide banner by default, show only if unverified and not a store manager
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

  await renderChecklist();
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
    const data = await res.json();
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

function dismissChecklist() {
  localStorage.setItem('checklist_dismissed', '1');
  const container = document.getElementById('setup-checklist');
  if (container) container.style.display = 'none';
}

async function renderChecklist() {
  const container = document.getElementById('setup-checklist');
  const itemsEl   = document.getElementById('checklist-items');
  if (!container || !itemsEl) return;

  // Respect the merchant's manual dismissal — don't re-show on every data reload.
  if (localStorage.getItem('checklist_dismissed') === '1') {
    container.style.display = 'none';
    return;
  }

  let status = null;
  try {
    const res = await call('/api/v1/clients/checklist-status');
    if (res && res.ok) status = await res.json();
  } catch (_) {}

  if (!status) return;

  const { has_products, has_operator, has_bank, waba_active } = status;

  // Show or hide the WABA pending banner
  const banner = document.getElementById('waba-banner');
  if (banner) banner.style.display = waba_active ? 'none' : 'flex';

  const allDone = has_products && has_operator && has_bank && waba_active;
  if (allDone) {
    // All steps complete — auto-dismiss permanently and hide.
    localStorage.setItem('checklist_dismissed', '1');
    container.style.display = 'none';
    return;
  }

  const items = [
    {
      label:  'Add at least one product',
      done:   has_products,
      action: "nav('products', document.querySelector('[onclick*=products]'))",
      hint:   'Products tab',
    },
    {
      label:  'Set operator phone number',
      done:   has_operator,
      action: "nav('settings', document.querySelector('[onclick*=settings]'))",
      hint:   'Settings — triggers your onboarding specialist',
    },
    {
      label:  'Connect bank account',
      done:   has_bank,
      action: "nav('settings', document.querySelector('[onclick*=settings]'))",
      hint:   'Settings → Connect Bank',
    },
    {
      label:  'WhatsApp number activated',
      done:   waba_active,
      action: null,
      hint:   'Your specialist handles this after you set your operator number',
    },
  ];

  const pending = items.filter(i => !i.done);
  const done    = items.filter(i =>  i.done);

  itemsEl.innerHTML = `
    <div style="font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
      color:var(--ink-3);margin-bottom:8px">Setup checklist</div>
    <div style="display:grid;gap:6px">
      ${pending.map(item => `
        <div style="display:flex;align-items:center;gap:10px;padding:11px 14px;
          background:var(--bg);border:1.5px solid var(--border);border-radius:8px;
          ${item.action ? 'cursor:pointer' : ''}"
          ${item.action ? `onclick="${item.action}"` : ''}>
          <div style="width:20px;height:20px;border-radius:50%;border:2px solid #ccc;
            background:#fff;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--ink)">${item.label}</div>
            <div style="font-size:11px;color:var(--ink-3);margin-top:1px">${item.hint}</div>
          </div>
          ${item.action ? '<div style="font-size:12px;color:var(--ink-3)">→</div>' : ''}
        </div>`).join('')}
      ${done.map(item => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
          background:#F0FAF5;border:1.5px solid var(--wa);border-radius:8px;opacity:.7">
          <div style="width:20px;height:20px;border-radius:50%;background:var(--wa);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;color:#fff;font-weight:700;flex-shrink:0">✓</div>
          <div style="font-size:13px;color:var(--ink-3);text-decoration:line-through;flex:1">${item.label}</div>
        </div>`).join('')}
    </div>`;
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

  renderOrderRows('r-orders', list.slice(0, 8));
}
