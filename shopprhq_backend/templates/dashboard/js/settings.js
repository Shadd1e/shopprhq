/**
 * settings.js
 * Store settings: card list view → click to open store detail modal.
 */

let clients = [];
let _subaccounts = {};
let _activeStoreData = null; // the client object currently open in the detail modal

async function loadClients() {
  const res = await call('/api/v1/clients/');
  if (!res) return;
  const data = await res.json();
  clients = Array.isArray(data) ? data : [];

  const opts = clients
    .map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`)
    .join('');
  ['p-client', 'csv-store'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = opts;
  });
}

async function loadSettings() {
  await loadClients();

  // Fetch subaccount status for each client in parallel
  _subaccounts = {};
  await Promise.all(clients.map(async c => {
    try {
      const r = await call(`/api/v1/subaccounts/${c.id}`);
      if (r && r.ok) _subaccounts[c.id] = await r.json();
    } catch (_) {}
  }));

  renderStoreCards();
}

function renderStoreCards() {
  const list = document.getElementById('stores-list');
  if (!list) return;

  // "Add Store" is only available once the merchant's first store has an operator
  // number set — that signals they're through initial onboarding and ready to expand.
  const addStoreBtn = document.getElementById('add-store-btn');
  if (addStoreBtn) {
    const readyForSecondStore = clients.some(c => c.operator_notify_phone);
    addStoreBtn.style.display = readyForSecondStore ? '' : 'none';
  }

  if (!clients.length) {
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--ink-3);font-size:14px">🏪 No stores found</div>`;
    return;
  }

  list.innerHTML = clients.map((c, i) => {
    const sub = _subaccounts[c.id];
    const isLast = i === clients.length - 1;

    const bankStatus = sub
      ? `<span style="color:var(--wa-dark);font-size:12px;font-weight:500">✓ Bank connected</span>`
      : `<span style="color:var(--ink-4);font-size:12px">No bank</span>`;

    const opStatus = c.operator_notify_phone
      ? `<span style="font-size:12px;color:var(--ink-3)">+${c.operator_notify_phone}</span>`
      : `<span style="font-size:12px;color:var(--ink-4)">No operator</span>`;

    const personaStatus = c.assistant_name
      ? `<span style="font-size:12px;color:var(--ink-3)">${c.assistant_name}</span>`
      : ``;

    const deliveryStatus = c.delivery_enabled
      ? `<span style="font-size:12px;color:var(--wa-dark);font-weight:500">🛵 Delivery on</span>`
      : ``;

    return `
      <button onclick="openStoreDetail('${c.id}')" style="
        display:flex;align-items:center;gap:14px;
        padding:16px 20px;
        background:none;border:none;cursor:pointer;
        text-align:left;width:100%;
        border-bottom:${isLast ? 'none' : '1px solid var(--border)'};
        transition:background .12s;
      " onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">
        <div style="
          width:42px;height:42px;flex-shrink:0;
          background:var(--wa-pale);border-radius:10px;
          display:flex;align-items:center;justify-content:center;
          font-size:17px;font-weight:700;color:var(--wa-dark);
          font-family:'Bricolage Grotesque',sans-serif;
        ">${c.name.charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-family:monospace;font-size:11px;color:var(--ink-4);background:var(--border-2);padding:1px 6px;border-radius:4px">${c.id}</span>
            ${opStatus}
            ${bankStatus}
            ${personaStatus}
            ${deliveryStatus}
          </div>
        </div>
        <svg width="16" height="16" fill="none" stroke="var(--ink-4)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="6,4 12,10 6,16"/></svg>
      </button>`;
  }).join('');
}

// ── Store Detail Modal ────────────────────────────────────────────────────────

function openStoreDetail(clientId) {
  const c   = clients.find(x => x.id === clientId);
  const sub = _subaccounts[clientId];
  if (!c) return;

  _activeStoreData = c;

  document.getElementById('sd-cid').value   = clientId;
  document.getElementById('sd-title').textContent = c.name;
  document.getElementById('sd-id').textContent    = c.id;
  document.getElementById('sd-wa').textContent    = c.whatsapp_number || '—';

  // Operator phone
  const opVal = document.getElementById('sd-op-val');
  const opBtn = document.getElementById('sd-op-btn');
  if (c.operator_notify_phone) {
    opVal.innerHTML = `<span style="color:var(--wa-dark);font-weight:500">+${c.operator_notify_phone}</span>`;
    opBtn.textContent = 'Change';
  } else {
    opVal.textContent = 'Not set';
    opBtn.textContent = 'Set';
  }

  // Address
  const addrVal = document.getElementById('sd-addr-val');
  const addrBtn = document.getElementById('sd-addr-btn');
  if (c.address) {
    addrVal.innerHTML = `<span style="color:var(--ink)">${c.address}</span>`;
    addrBtn.textContent = 'Edit';
  } else {
    addrVal.textContent = 'Not set';
    addrBtn.textContent = 'Set';
  }

  // Persona
  const personaName  = document.getElementById('sd-persona-name');
  const personaStyle = document.getElementById('sd-persona-style');
  const personaBtn   = document.getElementById('sd-persona-btn');
  if (c.assistant_name) {
    personaName.innerHTML = `<span style="color:var(--ink);font-weight:500">${c.assistant_name}</span>`;
    personaStyle.textContent = _formatPersonality(c.assistant_personality);
    personaBtn.textContent = 'Edit';
  } else {
    personaName.textContent  = 'Default';
    personaStyle.textContent = '';
    personaBtn.textContent   = 'Set';
  }

  // Bank
  const bankVal     = document.getElementById('sd-bank-val');
  const bankBtnWrap = document.getElementById('sd-bank-btn-wrap');
  if (sub) {
    bankVal.innerHTML = `<span style="color:var(--wa-dark);font-weight:500">✓ ${sub.business_name}</span>
      <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${sub.account_number}</div>`;
    bankBtnWrap.innerHTML = `<button class="btn-xs" style="color:var(--red);border-color:var(--red)"
      onclick="removeSubaccountFromDetail('${clientId}')">Remove</button>`;
  } else {
    bankVal.textContent = 'Not connected';
    bankBtnWrap.innerHTML = `<button class="btn-xs" style="border-color:var(--wa);color:var(--wa-dark)"
      onclick="openBankModalFromDetail('${clientId}', '${c.name.replace(/'/g, "\\'")}')">Connect Bank</button>`;
  }

  // Delivery
  const dlvVal = document.getElementById('sd-delivery-val');
  const dlvBtn = document.getElementById('sd-delivery-btn');
  if (c.delivery_enabled && c.delivery_fee != null) {
    dlvVal.innerHTML = `<span style="color:var(--wa-dark);font-weight:500">Enabled</span>
      <span style="font-size:12px;color:var(--ink-3);margin-left:6px">— Flat fee: ₦${Number(c.delivery_fee).toLocaleString()}</span>`;
    dlvBtn.textContent = 'Edit';
  } else if (c.delivery_enabled) {
    dlvVal.innerHTML = `<span style="color:#F59E0B;font-weight:500">Enabled — fee not set</span>`;
    dlvBtn.textContent = 'Edit';
  } else {
    dlvVal.textContent = 'Disabled';
    dlvBtn.textContent = 'Configure';
  }

  openModal('m-store-detail');
}

function openOpPhoneFromDetail() {
  const c = _activeStoreData;
  if (!c) return;
  closeModal('m-store-detail');
  document.getElementById('op-cid').value   = c.id;
  document.getElementById('op-phone').value = c.operator_notify_phone || '';
  openModal('m-opphone');
}

function openAddressFromDetail() {
  const c = _activeStoreData;
  if (!c) return;
  closeModal('m-store-detail');
  document.getElementById('addr-cid').value = c.id;
  document.getElementById('addr-val').value = c.address || '';
  openModal('m-address');
}

function openPersonaFromDetail() {
  const c = _activeStoreData;
  if (!c) return;
  closeModal('m-store-detail');
  openPersonaModal(c.id, c.assistant_name || '', c.assistant_personality || '');
}

function openDeliveryFromDetail() {
  const c = _activeStoreData;
  if (!c) return;
  closeModal('m-store-detail');
  openDeliveryModal(c.id, c.delivery_enabled, c.delivery_fee);
}

function openBankModalFromDetail(clientId, storeName) {
  closeModal('m-store-detail');
  openBankModal(clientId, storeName);
}

async function removeSubaccountFromDetail(clientId) {
  if (!confirm('Remove this bank account?\n\nCard payments will fall back to the platform account until a new one is added.')) return;
  closeModal('m-store-detail');
  await removeSubaccount(clientId);
}

// ── Operator Phone Modal ──────────────────────────────────────────────────────

function openOpPhoneModal(clientId, current) {
  document.getElementById('op-cid').value   = clientId;
  document.getElementById('op-phone').value = current || '';
  // Track whether this is a first-time set so we can show the right toast
  document.getElementById('op-cid').dataset.wasEmpty = current ? '0' : '1';
  openModal('m-opphone');
}

async function submitOpPhone() {
  const clientId   = document.getElementById('op-cid').value;
  const raw        = document.getElementById('op-phone').value.trim();
  const phone      = raw.replace(/^\+/, '').replace(/\s+/g, '') || null;
  const isFirstSet = document.getElementById('op-cid').dataset.wasEmpty === '1' && !!phone;

  const res = await call(`/api/v1/clients/${clientId}/operator-phone`, {
    method: 'PATCH',
    body:   { operator_notify_phone: phone },
  });

  if (res && res.ok) {
    if (isFirstSet) {
      toast('Saved! Your onboarding specialist will reach out on this number shortly.', 'ok');
    } else {
      toast('Operator number updated', 'ok');
    }
    closeModal('m-opphone');
    await loadSettings();
    openStoreDetail(clientId);
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to save', 'err');
  }
}

// ── Bank Account (Subaccount) Modal ──────────────────────────────────────────

let _cachedBanks = null;

async function _loadBanks() {
  if (_cachedBanks) return _cachedBanks;
  const res = await call('/api/v1/subaccounts/banks');
  if (res && res.ok) {
    const data = await res.json();
    _cachedBanks = data.banks || [];
  } else {
    _cachedBanks = [
      { code: '044', name: 'Access Bank' },
      { code: '011', name: 'First Bank of Nigeria' },
      { code: '058', name: 'GTBank' },
      { code: '033', name: 'United Bank for Africa (UBA)' },
      { code: '057', name: 'Zenith Bank' },
      { code: '000014', name: 'Kuda Bank' },
      { code: '999992', name: 'OPay' },
      { code: '999991', name: 'PalmPay' },
      { code: '000019', name: 'Moniepoint MFB' },
    ];
  }
  return _cachedBanks;
}

function openBankModal(clientId, storeName) {
  document.getElementById('bk-cid').value         = clientId;
  document.getElementById('bk-account-num').value = '';
  document.getElementById('bk-verified-name').style.display = 'none';
  document.getElementById('bk-submit').style.display = 'none';

  const sel = document.getElementById('bk-bank');
  sel.innerHTML = '<option value="">Loading banks…</option>';
  openModal('m-bank');

  _loadBanks().then(banks => {
    sel.innerHTML = '<option value="">Select bank…</option>' +
      banks.map(b => `<option value="${b.code}">${b.name}</option>`).join('');
  });
}

async function verifyBankAccount() {
  const accountNumber = document.getElementById('bk-account-num').value.trim();
  const accountBank   = document.getElementById('bk-bank').value;
  const verifiedEl    = document.getElementById('bk-verified-name');
  const submitBtn     = document.getElementById('bk-submit');
  const verifyBtn     = document.getElementById('bk-verify-btn');

  if (!accountNumber || accountNumber.length < 10) { toast('Enter a valid 10-digit account number', 'err'); return; }
  if (!accountBank) { toast('Select a bank first', 'err'); return; }

  verifyBtn.disabled    = true;
  verifyBtn.textContent = 'Verifying…';
  verifiedEl.style.display = 'none';
  submitBtn.style.display  = 'none';

  const res = await call('/api/v1/subaccounts/verify-account', {
    method: 'POST',
    body:   { account_number: accountNumber, account_bank: accountBank },
  });

  verifyBtn.disabled    = false;
  verifyBtn.textContent = 'Verify Account';

  if (!res) { toast('Could not reach the server. Please try again.', 'err'); return; }

  let data;
  try { data = await res.json(); } catch (_) { data = {}; }

  if (res.ok) {
    const accountName = data.account_name || '';
    document.getElementById('bk-verified-acct-name').value = accountName;
    verifiedEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;
        background:var(--wa-pale);border:1.5px solid var(--wa);border-radius:8px;margin-top:4px">
        <span style="color:var(--wa-dark);font-size:18px">✓</span>
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin-bottom:2px">Account Name</div>
          <div style="font-weight:700;font-size:15px;color:var(--ink)">${accountName}</div>
          <div style="font-size:12px;color:var(--ink-3);margin-top:2px">Is this the right account? If yes, tap Connect below.</div>
        </div>
      </div>`;
    verifiedEl.style.display = 'block';
    submitBtn.style.display  = 'inline-flex';
  } else {
    let msg = data?.detail || data?.message || 'Could not verify account. Check the number and bank.';
    if (Array.isArray(msg)) msg = msg.map(e => e?.msg || String(e)).join(', ');
    toast(String(msg), 'err');
  }
}

async function submitBankAccount() {
  const clientId      = document.getElementById('bk-cid').value;
  const accountNumber = document.getElementById('bk-account-num').value.trim();
  const accountBank   = document.getElementById('bk-bank').value;
  const businessName  = document.getElementById('bk-verified-acct-name').value.trim();
  const submitBtn     = document.getElementById('bk-submit');

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Connecting…';

  const res = await call(`/api/v1/subaccounts/${clientId}`, {
    method: 'POST',
    body: { account_number: accountNumber, account_bank: accountBank, business_name: businessName },
  });

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Connect Bank Account';

  if (res && res.ok) {
    toast('Bank account connected! Card payments will now settle directly.', 'ok');
    closeModal('m-bank');
    await loadSettings();
    openStoreDetail(clientId);
    if (typeof refreshSetupBadge === 'function') refreshSetupBadge();
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to connect bank account', 'err');
  }
}

async function removeSubaccount(clientId) {
  const res = await call(`/api/v1/subaccounts/${clientId}`, { method: 'DELETE' });
  if (res && res.ok) {
    toast('Bank account removed', 'ok');
    loadSettings();
  } else {
    toast('Failed to remove', 'err');
  }
}

// ── Store Address Modal ───────────────────────────────────────────────────────

function openAddressModal(clientId, current) {
  document.getElementById('addr-cid').value = clientId;
  document.getElementById('addr-val').value = current || '';
  openModal('m-address');
}

async function submitAddress() {
  const clientId = document.getElementById('addr-cid').value;
  const address  = document.getElementById('addr-val').value.trim() || null;

  const res = await call(`/api/v1/clients/${clientId}/address`, {
    method: 'PATCH',
    body:   { address },
  });

  if (res && res.ok) {
    toast('Address saved', 'ok');
    closeModal('m-address');
    await loadSettings();
    openStoreDetail(clientId);
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to save address', 'err');
  }
}

// ── Persona helpers ───────────────────────────────────────────────────────────

function _formatPersonality(val) {
  const labels = {
    friendly_casual:   'Friendly & Casual',
    professional:      'Professional',
    warm_enthusiastic: 'Warm & Enthusiastic',
  };
  return labels[val] || val || '—';
}

// ── Persona Modal ─────────────────────────────────────────────────────────────

function openPersonaModal(clientId, currentName, currentStyle) {
  document.getElementById('persona-cid').value   = clientId;
  document.getElementById('persona-name').value  = currentName || '';
  document.getElementById('persona-style').value = currentStyle || 'friendly_casual';
  _updatePersonaPreview();
  openModal('m-persona');
}

function _updatePersonaPreview() {
  const name  = document.getElementById('persona-name').value.trim() || 'Assistant';
  const style = document.getElementById('persona-style').value;
  const styleDesc = {
    friendly_casual:   'Warm, casual, uses emojis naturally — like a helpful friend.',
    professional:      'Polished and precise — no slang, no emojis, complete sentences.',
    warm_enthusiastic: 'Upbeat and genuinely excited to help — positive energy every message.',
  };
  document.getElementById('persona-preview-name').textContent  = name;
  document.getElementById('persona-preview-style').textContent = styleDesc[style] || '';
}

async function submitPersona() {
  const clientId  = document.getElementById('persona-cid').value;
  const name      = document.getElementById('persona-name').value.trim() || null;
  const style     = document.getElementById('persona-style').value || null;
  const submitBtn = document.getElementById('persona-submit');

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Saving…';

  const res = await call(`/api/v1/clients/${clientId}/persona`, {
    method: 'PATCH',
    body:   { assistant_name: name, assistant_personality: style },
  });

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Save Persona';

  if (res && res.ok) {
    toast('Persona saved — takes effect on next customer message', 'ok');
    closeModal('m-persona');
    await loadSettings();
    openStoreDetail(clientId);
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to save persona', 'err');
  }
}

async function clearPersona() {
  const clientId = document.getElementById('persona-cid').value;
  if (!confirm('Remove the custom persona? The assistant will use the default tone.')) return;

  const res = await call(`/api/v1/clients/${clientId}/persona`, {
    method: 'PATCH',
    body:   { assistant_name: null, assistant_personality: null },
  });

  if (res && res.ok) {
    toast('Persona cleared', 'ok');
    closeModal('m-persona');
    await loadSettings();
    openStoreDetail(clientId);
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to clear persona', 'err');
  }
}

// ── Delivery Settings Modal ───────────────────────────────────────────────────

function openDeliveryModal(clientId, deliveryEnabled, deliveryFee) {
  document.getElementById('dlv-cid').value = clientId;
  document.getElementById('dlv-fee').value = deliveryFee != null ? deliveryFee : '';
  document.getElementById('dlv-err').style.display = 'none';
  document.getElementById('dlv-err').textContent   = '';

  // Set toggle state
  document.getElementById('dlv-on').checked  = !!deliveryEnabled;
  document.getElementById('dlv-off').checked = !deliveryEnabled;

  // Show/hide fee row
  document.getElementById('dlv-fee-row').style.display = deliveryEnabled ? 'block' : 'none';

  openModal('m-delivery');
}

function onDeliveryToggleChange() {
  const isOn = document.getElementById('dlv-on').checked;
  document.getElementById('dlv-fee-row').style.display = isOn ? 'block' : 'none';
}

async function submitDelivery() {
  const clientId       = document.getElementById('dlv-cid').value;
  const deliveryEnabled = document.getElementById('dlv-on').checked;
  const feeRaw         = document.getElementById('dlv-fee').value.trim();
  const errEl          = document.getElementById('dlv-err');
  const btn            = document.getElementById('dlv-submit');

  errEl.style.display = 'none';

  if (deliveryEnabled) {
    if (!feeRaw || isNaN(parseFloat(feeRaw)) || parseFloat(feeRaw) < 0) {
      errEl.textContent   = 'Enter a valid delivery fee (₦0 or more).';
      errEl.style.display = 'block';
      return;
    }
  }

  btn.disabled    = true;
  btn.textContent = 'Saving…';

  const body = { delivery_enabled: deliveryEnabled };
  if (deliveryEnabled) body.delivery_fee = parseFloat(feeRaw);

  const res = await call(`/api/v1/clients/${clientId}/delivery`, {
    method: 'PATCH',
    body,
  });

  btn.disabled    = false;
  btn.textContent = 'Save';

  if (res && res.ok) {
    const msg = deliveryEnabled
      ? `Delivery enabled — flat fee ₦${parseFloat(feeRaw).toLocaleString()}`
      : 'Delivery disabled';
    toast(msg, 'ok');
    closeModal('m-delivery');
    await loadSettings();
    openStoreDetail(clientId);
  } else {
    const err = res ? await res.json() : null;
    errEl.textContent   = err?.detail || 'Failed to save delivery settings';
    errEl.style.display = 'block';
  }
}

// ── Add Store Modal ──────────────────────────────────────────────────────────

function openAddStoreModal() {
  // Clear all fields (as-id no longer exists — ID is system-assigned)
  ['as-name', 'as-wa', 'as-pass', 'as-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const errEl = document.getElementById('as-err');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  openModal('m-add-store');
}

async function submitAddStore() {
  // Note: Store ID is auto-assigned by the system — not supplied by the merchant
  const name  = (document.getElementById('as-name').value || '').trim();
  const wa    = (document.getElementById('as-wa').value || '').trim() || null;
  const pass  = document.getElementById('as-pass').value;
  const pass2 = document.getElementById('as-pass2').value;
  const errEl = document.getElementById('as-err');
  const btn   = document.getElementById('as-submit');

  errEl.style.display = 'none';

  if (!name) {
    errEl.textContent = 'Store name is required';
    errEl.style.display = 'block'; return;
  }
  if (!pass || pass.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters';
    errEl.style.display = 'block'; return;
  }
  if (pass !== pass2) {
    errEl.textContent = 'Passwords do not match';
    errEl.style.display = 'block'; return;
  }

  btn.disabled    = true;
  btn.textContent = 'Creating…';

  const res = await call('/api/v1/clients/with-password/', {
    method: 'POST',
    body:   { name, whatsapp_number: wa, password: pass },
  });

  btn.disabled    = false;
  btn.textContent = 'Create Store';

  if (res && res.ok) {
    const data = await res.json();
    closeModal('m-add-store');
    toast(
      `Store created! Your Store ID (${data.id}) has been sent to your email. A ShopprHQ agent will contact you to complete WhatsApp onboarding.`,
      'ok'
    );
    await loadSettings();
  } else {
    const err = res ? await res.json() : null;
    errEl.textContent = err?.detail || 'Failed to create store';
    errEl.style.display = 'block';
  }
}
