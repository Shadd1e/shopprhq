/**
 * products.js
 * Products table, add product modal, edit product modal, and CSV bulk upload.
 *
 * Endpoints:
 *   GET    /api/v1/inventory/
 *   POST   /api/v1/products/admin/
 *   PATCH  /api/v1/products/admin/{product_id}
 */

// Module-level cache so event listeners can reference product data by index
let _prodProducts = [];

async function loadProducts() {
  const mid = localStorage.getItem('mid') || '';
  setTableLoading('t-products', 5);

  if (!clients.length) await loadClients();

  let allProducts = [];

  for (const client of clients) {
    const res = await call(`/api/v1/inventory/`);
    if (res && res.ok) {
      const prods = await res.json();
      if (Array.isArray(prods)) {
        allProducts = allProducts.concat(prods.map(p => ({ ...p, _client: client })));
      }
    }
  }

  _prodProducts = allProducts;

  const tbody = document.getElementById('t-products');
  if (!tbody) return;

  if (!allProducts.length) {
    tbody.innerHTML = emptyRow(5, '📦', 'No products yet. Add your first product above.');
    return;
  }

  tbody.innerHTML = allProducts.map((p, idx) => {
    const qty    = p.inventory?.quantity ?? 0;
    const thresh = p.inventory?.low_stock_threshold;
    return `
      <tr>
        <td style="font-weight:500">${escHtml(p.name)}</td>
        <td>${fmtMoney(p.price)}</td>
        <td>${stockBadge(qty, thresh)}</td>
        <td style="font-size:13px;color:var(--ink-3)">${escHtml(p._client?.name || p.client_id)}</td>
        <td style="display:flex;gap:6px">
          <button class="btn-xs prod-edit-btn" data-idx="${idx}">Edit</button>
          <button class="btn-xs prod-stock-btn" data-idx="${idx}">Stock</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners after rendering (avoids inline onclick issues with
  // product names containing quotes or other HTML-unsafe characters)
  tbody.querySelectorAll('.prod-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const p   = _prodProducts[idx];
      if (!p) return;
      openEditProductModal(p, p._client?.id);
    });
  });

  tbody.querySelectorAll('.prod-stock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.idx, 10);
      const p    = _prodProducts[idx];
      if (!p) return;
      const mid2   = localStorage.getItem('mid') || '';
      const qty    = p.inventory?.quantity ?? 0;
      const thresh = p.inventory?.low_stock_threshold ?? null;
      openStockModal(p.id, p._client?.id, mid2, p.name, qty, thresh);
    });
  });
}

// ── Edit Product Modal ────────────────────────────────────────────────────────

function openEditProductModal(product, clientId) {
  document.getElementById('ep-id').value    = product.id;
  document.getElementById('ep-cid').value   = clientId || '';
  document.getElementById('ep-name').value  = product.name || '';
  document.getElementById('ep-price').value = product.price || '';
  document.getElementById('ep-desc').value  = product.description || '';
  document.getElementById('ep-cat').value   = product.category || '';
  openModal('m-edit-product');
}

async function submitEditProduct() {
  const productId = document.getElementById('ep-id').value;
  const clientId  = document.getElementById('ep-cid').value;
  const mid       = localStorage.getItem('mid') || '';

  const name  = document.getElementById('ep-name').value.trim();
  const price = parseFloat(document.getElementById('ep-price').value);
  const desc  = document.getElementById('ep-desc').value.trim();
  const cat   = document.getElementById('ep-cat').value.trim();

  if (!name) { toast('Product name is required', 'err'); return; }
  if (!price || price <= 0) { toast('Enter a valid price', 'err'); return; }

  const body = { name, price };
  if (desc) body.description = desc;
  if (cat)  body.category    = cat;

  const res = await call(`/api/v1/products/admin/${productId}`, {
    method: 'PATCH',
    body,
  });

  if (res && res.ok) {
    await loadProducts();
    await loadInventory();
    closeModal('m-edit-product');
    toast('Product updated', 'ok');
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to update product', 'err');
  }
}

// ── Add Product Modal ─────────────────────────────────────────────────────────

function openAddProduct() {
  if (!clients.length) {
    loadClients().then(() => openModal('m-product'));
  } else {
    openModal('m-product');
  }
  ['p-name', 'p-price', 'p-desc', 'p-stock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

async function submitProduct() {
  const name     = document.getElementById('p-name').value.trim();
  const price    = parseFloat(document.getElementById('p-price').value);
  const desc     = document.getElementById('p-desc').value.trim();
  const clientId = document.getElementById('p-client').value;
  const stock    = parseInt(document.getElementById('p-stock').value) || 0;
  const mid      = localStorage.getItem('mid') || '';

  if (!name || !price || !clientId) {
    toast('Name, price and store are required', 'err');
    return;
  }

  const res = await call('/api/v1/products/admin/', {
    method: 'POST',
    body:   { name, price, description: desc, initial_stock: stock },
  });

  if (res && res.ok) {
    toast('Product added', 'ok');
    closeModal('m-product');
    await loadProducts();
    await loadInventory();
    loadOverview();
  } else {
    const err = res ? await res.json() : null;
    toast(err?.detail || 'Failed to add product', 'err');
  }
}

// ── CSV Bulk Upload ───────────────────────────────────────────────────────────

function openCsvUpload() {
  if (!clients.length) {
    loadClients().then(() => openModal('m-csv-upload'));
  } else {
    openModal('m-csv-upload');
  }
  document.getElementById('csv-file').value = '';
  document.getElementById('csv-preview').innerHTML = '';
  document.getElementById('csv-submit-btn').style.display = 'none';
  document.getElementById('csv-store').value = clients[0]?.id || '';
  _csvRows = [];
}

let _csvRows = [];

function downloadCsvTemplate() {
  const header  = 'name,price,description,initial_stock\n';
  const example = 'Coca-Cola 50cl,500,Chilled soft drink,24\nPepsi 50cl,450,,12\n';
  const blob    = new Blob([header + example], { type: 'text/csv' });
  const a       = document.createElement('a');
  a.href        = URL.createObjectURL(blob);
  a.download    = 'shopprhq_products_template.csv';
  a.click();
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers  = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx  = headers.indexOf('name');
  const priceIdx = headers.indexOf('price');
  const descIdx  = headers.indexOf('description');
  const stockIdx = headers.indexOf('initial_stock');

  if (nameIdx === -1 || priceIdx === -1) return null;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = [];
    let current  = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
      current += char;
    }
    cols.push(current.trim());

    const name  = cols[nameIdx]  || '';
    const price = parseFloat(cols[priceIdx] || '0');
    const desc  = descIdx  >= 0 ? (cols[descIdx]  || '') : '';
    const stock = stockIdx >= 0 ? (parseInt(cols[stockIdx] || '0') || 0) : 0;

    if (!name || !price || price <= 0) continue;
    rows.push({ name, price, description: desc, initial_stock: stock });
  }
  return rows;
}

function onCsvFileChange(input) {
  const file = input.files[0];
  if (!file) return;

  const reader  = new FileReader();
  reader.onload = (e) => {
    const rows = parseCsv(e.target.result);

    if (rows === null) {
      toast('CSV must have at least name and price columns', 'err');
      document.getElementById('csv-preview').innerHTML = '';
      document.getElementById('csv-submit-btn').style.display = 'none';
      _csvRows = [];
      return;
    }

    if (!rows.length) {
      toast('No valid rows found in CSV', 'err');
      document.getElementById('csv-preview').innerHTML = '';
      document.getElementById('csv-submit-btn').style.display = 'none';
      _csvRows = [];
      return;
    }

    _csvRows = rows;

    document.getElementById('csv-preview').innerHTML = `
      <div style="margin-top:16px">
        <div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px">
          Preview — ${rows.length} product${rows.length !== 1 ? 's' : ''} found
        </div>
        <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm)">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--milk)">
                <th style="text-align:left;padding:8px 12px;font-size:11.5px;font-weight:600;color:var(--ink-3)">Name</th>
                <th style="text-align:right;padding:8px 12px;font-size:11.5px;font-weight:600;color:var(--ink-3)">Price</th>
                <th style="text-align:center;padding:8px 12px;font-size:11.5px;font-weight:600;color:var(--ink-3)">Stock</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr style="border-top:1px solid var(--border-2)">
                  <td style="padding:7px 12px;font-size:13px">${escHtml(r.name)}</td>
                  <td style="padding:7px 12px;font-size:13px;text-align:right">${fmtMoney(r.price)}</td>
                  <td style="padding:7px 12px;font-size:13px;text-align:center">${r.initial_stock}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('csv-submit-btn').style.display = 'inline-flex';
  };
  reader.readAsText(file);
}

async function submitCsvUpload() {
  const clientId = document.getElementById('csv-store').value;
  const mid      = localStorage.getItem('mid') || '';
  const btn      = document.getElementById('csv-submit-btn');

  if (!clientId || !_csvRows.length) {
    toast('Select a store and upload a CSV first', 'err');
    return;
  }

  btn.disabled    = true;
  btn.textContent = `Uploading 0 / ${_csvRows.length}…`;

  let created = 0;
  let failed  = 0;
  const errors = [];

  for (let i = 0; i < _csvRows.length; i++) {
    const row       = _csvRows[i];
    btn.textContent = `Uploading ${i + 1} / ${_csvRows.length}…`;

    const res = await call('/api/v1/products/admin/', {
      method: 'POST',
      body:   row,
    });

    if (res && res.ok) {
      created++;
    } else {
      failed++;
      const err = res ? await res.json() : null;
      errors.push(`${row.name}: ${err?.detail || 'failed'}`);
    }
  }

  btn.disabled    = false;
  btn.textContent = 'Upload Products';

  if (failed === 0) {
    toast(`${created} product${created !== 1 ? 's' : ''} added successfully`, 'ok');
    closeModal('m-csv-upload');
    await loadProducts();
    await loadInventory();
    loadOverview();
  } else {
    toast(`${created} added, ${failed} failed. Check names for duplicates.`, 'err');
    document.getElementById('csv-preview').innerHTML += `
      <div style="margin-top:12px;padding:10px 14px;background:#FEF2F2;border-radius:var(--r-sm);font-size:12px;color:var(--red)">
        <strong>Errors:</strong><br>${errors.join('<br>')}
      </div>
    `;
  }
}
