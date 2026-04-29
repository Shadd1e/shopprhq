/**
 * inventory.js
 * Loads inventory table and handles stock adjustment + threshold setting.
 * Data source: GET /api/v1/inventory/ (per client, X-Merchant-ID + X-Client-ID headers)
 * Update stock: POST /api/v1/inventory/{product_id}/adjust
 * Update threshold: PATCH /api/v1/inventory/{product_id}/low-stock-threshold
 */

async function loadInventory() {
  const mid = localStorage.getItem('mid') || '';
  setTableLoading('t-inventory', 5);

  if (!clients.length) await loadClients();

  let allProducts = [];

  for (const client of clients) {
    const res = await call(`/api/v1/inventory/`, {
      headers: { 'X-Merchant-ID': mid, 'X-Client-ID': client.id },
    });
    if (res && res.ok) {
      const prods = await res.json();
      if (Array.isArray(prods)) {
        allProducts = allProducts.concat(prods.map(p => ({ ...p, _client: client })));
      }
    }
  }

  const tbody = document.getElementById('t-inventory');
  if (!tbody) return;

  if (!allProducts.length) {
    tbody.innerHTML = emptyRow(5, '🏷️', 'No inventory records found');
    return;
  }

  tbody.innerHTML = allProducts.map(p => {
    const qty    = p.inventory?.quantity ?? 0;
    const thresh = p.inventory?.low_stock_threshold;
    return `
      <tr>
        <td style="font-weight:500">${escHtml(p.name)}</td>
        <td style="font-size:13px;color:var(--ink-3)">${escHtml(p._client?.name || p.client_id)}</td>
        <td>${stockBadge(qty, thresh)}</td>
        <td style="font-size:13px;color:var(--ink-3)">${thresh != null ? thresh : '—'}</td>
        <td>
          <button class="btn-xs inv-stock-btn"
            data-prod-id="${escHtml(p.id)}"
            data-client-id="${escHtml(p._client?.id || '')}"
            data-name="${escHtml(p.name)}"
            data-qty="${qty}"
            data-thresh="${thresh ?? ''}">Edit</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.inv-stock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const thresh = btn.dataset.thresh === '' ? null : parseInt(btn.dataset.thresh);
      openStockModal(
        btn.dataset.prodId,
        btn.dataset.clientId,
        mid,
        btn.dataset.name,
        parseInt(btn.dataset.qty),
        thresh,
      );
    });
  });
}

// ── Stock Adjustment Modal ────────────────────────────────────────────────────

function openStockModal(productId, clientId, merchantId, name, currentQty, threshold) {
  document.getElementById('as-pid').value    = productId;
  document.getElementById('as-cid').value    = clientId;
  document.getElementById('as-mid').value    = merchantId;
  document.getElementById('as-name').value   = name;
  document.getElementById('as-cur').value    = currentQty;
  document.getElementById('as-new').value    = currentQty;
  document.getElementById('as-thresh').value = threshold != null ? threshold : '';
  openModal('m-stock');
}

async function submitStock() {
  const productId  = document.getElementById('as-pid').value;
  const clientId   = document.getElementById('as-cid').value;
  const merchantId = document.getElementById('as-mid').value;
  const newQty     = parseInt(document.getElementById('as-new').value);
  const currentQty = parseInt(document.getElementById('as-cur').value);
  const threshVal  = document.getElementById('as-thresh').value;

  if (isNaN(newQty) || newQty < 0) {
    toast('Enter a valid stock quantity', 'err');
    return;
  }

  const headers = { 'X-Merchant-ID': merchantId, 'X-Client-ID': clientId };
  let stockOk = true;

  // Only call adjust if quantity actually changed
  if (newQty !== currentQty) {
    const delta = newQty - currentQty;
    const res = await call(`/api/v1/inventory/${productId}/adjust`, {
      method:  'POST',
      headers,
      body:    { delta },
    });
    if (!res || !res.ok) {
      const err = res ? await res.json() : null;
      toast(err?.detail || 'Stock update failed', 'err');
      stockOk = false;
    }
  }

  if (!stockOk) return;

  // Set threshold (null = disabled)
  const threshold = threshVal === '' ? null : parseInt(threshVal);
  const tRes = await call(`/api/v1/inventory/${productId}/low-stock-threshold`, {
    method:  'PATCH',
    headers,
    body:    { threshold },
  });

  if (tRes && tRes.ok) {
    toast('Inventory saved', 'ok');
    closeModal('m-stock');
    await loadInventory();
    await loadProducts();
    loadOverview();
  } else {
    const err = tRes ? await tRes.json() : null;
    toast(err?.detail || 'Threshold save failed', 'err');
  }
}
