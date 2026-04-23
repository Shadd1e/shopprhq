/**
 * api.js
 * Central fetch wrapper. All API calls go through `call()`.
 * Handles auth headers, BASE URL switching, and 401 logout.
 */

// When running on localhost, point to Railway.
// When deployed on Railway, use same origin.
const BASE = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
) ? 'http://localhost:8000' : '';

async function call(path, opts = {}) {
  const tok = localStorage.getItem('tok') || '';

  const headers = {
    'Authorization': `Bearer ${tok}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  const config = {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  };

  try {
    const res = await fetch(`${BASE}${path}`, config);
    if (res.status === 401) {
      // Only logout if we actually sent a token (genuine expiry)
      // Not on endpoints that just happen to return 401
      const tok = localStorage.getItem('tok');
      if (tok) {
        console.warn(`401 on ${path} — token may be expired`);
        logout();
      }
      return null;
    }
    return res;
  } catch (err) {
    console.error(`API call failed [${path}]:`, err);
    toast('Network error — check your connection', 'err');
    return null;
  }
}
