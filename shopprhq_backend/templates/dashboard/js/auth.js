/**
 * auth.js
 * Handles login, logout, and session state.
 *
 * LOGIN DETAILS:
 * - Endpoint: POST /api/v1/merchants/login
 * - Payload:  { merchant_id: "MXA1B2", password: "1234" }
 *   (password is a 4-digit PIN, not an email password)
 * - Returns:  { access_token, merchant_id, name }
 * - Token is stored in localStorage and sent as Bearer on every API call
 */

async function doLogin() {
  const merchantId = document.getElementById('l-mid').value.trim().toUpperCase();
  const pin        = document.getElementById('l-pass').value.trim();
  const btn        = document.getElementById('l-btn');
  const errEl      = document.getElementById('l-err');

  errEl.style.display = 'none';

  if (!merchantId || !pin) {
    showAuthError('Enter your Merchant ID and PIN.');
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    showAuthError('PIN must be exactly 4 digits.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  try {
    const res = await fetch(`${BASE}/api/v1/merchants/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ merchant_id: merchantId, password: pin }),
    });

    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.detail || 'Invalid credentials');
      return;
    }

    localStorage.setItem('tok',           data.access_token);
    localStorage.setItem('mid',           data.merchant_id);
    localStorage.setItem('mname',         data.name || merchantId);
    localStorage.setItem('memail',        data.email || '');
    localStorage.setItem('email_verified', data.email_verified ? '1' : '0');

    showApp();

  } catch (err) {
    console.error('Login error:', err);
    showAuthError('Connection failed. Is the server running?');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Sign in';
  }
}

function logout() {
  localStorage.removeItem('tok');
  localStorage.removeItem('mid');
  localStorage.removeItem('mname');
  localStorage.removeItem('memail');
  localStorage.removeItem('email_verified');
  localStorage.removeItem('waba_active');
  localStorage.removeItem('cid');
  localStorage.removeItem('setup_complete');

  resetNavState();

  document.getElementById('auth').style.display = 'flex';
  document.getElementById('app').style.display  = 'none';
}

function showApp() {
  const mname = localStorage.getItem('mname') || 'Merchant';
  const mid   = localStorage.getItem('mid')   || '—';

  document.getElementById('auth').style.display = 'none';
  document.getElementById('app').style.display  = 'block';

  document.getElementById('s-av').textContent   = mname.charAt(0).toUpperCase();
  document.getElementById('s-name').textContent = mname;
  document.getElementById('s-id').textContent   = mid;

  // Mark overview as loaded so nav() doesn't re-fetch when the user clicks the sidebar.
  _loadedPages.add('overview');
  loadOverview();
  loadClients();
}

function confirmLogout() {
  closeModal('m-logout');
  logout();
}

function showAuthError(msg) {
  el.textContent   = msg;
  el.style.display = 'block';
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const h  = new Date().getHours();
  const el = document.getElementById('g-time');
  if (el) el.textContent = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';

  document.getElementById('l-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  if (localStorage.getItem('tok')) showApp();
});
