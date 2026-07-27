// finanzas.js — VTA Finanzas module

const CATEGORIAS = {
  ingreso: [
    'Venta de vehículo',
    'Comisión consignación',
    'Transferencia recibida',
    'Abono parcial',
    'Otro ingreso',
  ],
  costo: [
    'Compra de vehículo',
    'Mecánica / reparación',
    'Lavado / detailing',
    'Seguro',
    'Patente / impuesto',
    'Publicidad',
    'Arriendo / gastos fijos',
    'Combustible',
    'Comisiones pagadas',
    'Otro costo',
  ],
  transferencia: [
    'Transferencia bancaria',
    'Depósito en cuenta',
    'Retiro de fondos',
    'Pago a proveedor',
    'Otra transferencia',
  ],
};

// ── State ────────────────────────────────────────────────────────────────────
let allRows     = [];
let tipoFilter  = '';
let searchQuery = '';
let editingId   = null;

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setDefaultFecha();
  rellenarFiltroMeses();
  loadAll('');
  loadResumen('');
  cargarCostosFijosBar();
});

// ── Period helpers ───────────────────────────────────────────────────────────
function rellenarFiltroMeses() {
  const sel = document.getElementById('filtMes');
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    sel.appendChild(opt);
  }
}

function cambiarMes(val) {
  loadAll(val);
  loadResumen(val);
}

// ── API calls ────────────────────────────────────────────────────────────────
async function loadAll(mes = '') {
  try {
    const qs = mes ? `?mes=${mes}` : '';
    const res = await fetch(`/api/finanzas${qs}`);
    allRows = await res.json();
    renderTabla(allRows);
  } catch (e) {
    showToast('Error cargando transacciones', 'error');
  }
}

async function loadResumen(mes = '') {
  try {
    const qs = mes ? `?mes=${mes}` : '';
    const res = await fetch(`/api/finanzas/resumen${qs}`);
    const data = await res.json();
    renderResumen(data);
  } catch (e) {
    console.error('resumen error', e);
  }
}

// ── KPI strip ────────────────────────────────────────────────────────────────
function clpAbbrev(n) {
  if (!n || n === 0) return '$0';
  const a = Math.abs(n);
  const s = n < 0 ? '−$' : '$';
  if (a >= 1e9) return s + (a/1e9).toFixed(2) + 'B';
  if (a >= 1e6) return s + (a/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(1) + 'K';
  return s + a.toLocaleString('es-CL');
}

function renderResumen(d) {
  const strip   = document.getElementById('resumenStrip');
  const bal     = (d.ingresos || 0) - (d.costos || 0);
  const margen  = d.margen_pct != null ? d.margen_pct.toFixed(2) + '%' : '—';
  const balCol  = bal >= 0  ? '#27ae60' : '#e74c3c';
  const marCol  = (d.margen_pct || 0) >= 0 ? '#27ae60' : '#e74c3c';
  const cosRat  = d.ingresos > 0 ? ((d.costos / d.ingresos) * 100).toFixed(2) + '% de ingresos' : '—';
  const nTransf = d.total_transf || 0;

  strip.innerHTML = `
    <!-- 1. Ingresos -->
    <div class="kpi-card kpi-sm" style="--accent:#27ae60">
      <div class="kpi-top"><span class="kpi-icon">💰</span><span class="kpi-label">Ingresos</span></div>
      <div class="kpi-value kpi-value-sm" style="color:#27ae60">${clpAbbrev(d.ingresos)}</div>
      <div class="kpi-sub">${d.n_ingresos || 0} transacciones</div>
      <div class="kpi-sub" style="margin-top:3px">ticket: <strong style="color:#27ae60">${clpAbbrev(d.ticket_promedio || 0)}</strong></div>
    </div>

    <!-- 2. Costos -->
    <div class="kpi-card kpi-sm" style="--accent:#e74c3c">
      <div class="kpi-top"><span class="kpi-icon">💸</span><span class="kpi-label">Costos</span></div>
      <div class="kpi-value kpi-value-sm" style="color:#e74c3c">${clpAbbrev(d.costos)}</div>
      <div class="kpi-sub">${d.n_costos || 0} transacciones</div>
      <div class="kpi-sub" style="margin-top:3px;color:#e74c3c">${cosRat}</div>
    </div>

    <!-- 3. Balance -->
    <div class="kpi-card kpi-sm" style="--accent:${balCol}">
      <div class="kpi-top"><span class="kpi-icon">⚖️</span><span class="kpi-label">Balance Neto</span></div>
      <div class="kpi-value kpi-value-sm" style="color:${balCol}">${clpAbbrev(bal)}</div>
      <div class="kpi-sub">resultado del período</div>
      <div class="kpi-sub" style="margin-top:3px">${bal >= 0 ? '▲ positivo' : '▼ negativo'}</div>
    </div>

    <!-- 4. Margen bruto -->
    <div class="kpi-card kpi-sm" style="--accent:${marCol}">
      <div class="kpi-top"><span class="kpi-icon">📈</span><span class="kpi-label">Margen Bruto</span></div>
      <div class="kpi-value kpi-value-sm" style="color:${marCol}">${margen}</div>
      <div class="kpi-sub">(ingresos − costos) / ingresos</div>
      <div class="kpi-sub" style="margin-top:3px">
        ${(d.margen_pct||0) >= 20 ? '✅ saludable' : (d.margen_pct||0) >= 10 ? '⚠️ ajustado' : (d.ingresos > 0 ? '🔴 bajo' : '—')}
      </div>
    </div>

    <!-- 5. Ticket promedio -->
    <div class="kpi-card kpi-sm" style="--accent:#9B59B6">
      <div class="kpi-top"><span class="kpi-icon">🎟️</span><span class="kpi-label">Ticket Prom. Ingreso</span></div>
      <div class="kpi-value kpi-value-sm" style="color:#9B59B6">${clpAbbrev(d.ticket_promedio || 0)}</div>
      <div class="kpi-sub">ingreso medio por operación</div>
    </div>

    <!-- 6. Actividad -->
    <div class="kpi-card kpi-sm" style="--accent:#3498db">
      <div class="kpi-top"><span class="kpi-icon">🔢</span><span class="kpi-label">Actividad Total</span></div>
      <div class="kpi-value kpi-value-sm" style="color:#3498db">${d.n_total || 0}</div>
      <div class="kpi-sub">operaciones en período</div>
      <div class="kpi-sub" style="margin-top:3px">${d.n_ingresos||0} ing · ${d.n_costos||0} cos · ${nTransf} transf.</div>
    </div>`;
}

// ── Table rendering ──────────────────────────────────────────────────────────
function visibleRows() {
  return allRows.filter(r => {
    if (tipoFilter && r.tipo !== tipoFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = [r.id_interno, r.descripcion, r.categoria, r.usuario,
                   r.vehiculo_desc, String(r.monto)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTabla(rows) {
  const tbody = document.getElementById('tablaBody');
  const visible = rows === allRows ? visibleRows() : rows;

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--gray3)">
      Sin transacciones para mostrar</td></tr>`;
    return;
  }

  tbody.innerHTML = visible.map(r => {
    const tipoClass = { ingreso: 'fin-ingreso', costo: 'fin-costo', transferencia: 'fin-transferencia' }[r.tipo] || '';
    const tipoLabel = { ingreso: '💰 Ingreso', costo: '💸 Costo', transferencia: '🏦 Transf.' }[r.tipo] || r.tipo;
    const montoClass = { ingreso: 'fin-monto-pos', costo: 'fin-monto-neg', transferencia: 'fin-monto-neutral' }[r.tipo] || '';
    const montoPrefix = r.tipo === 'ingreso' ? '+' : r.tipo === 'costo' ? '−' : '';
    const fecha = (r.fecha || '').slice(0, 10);
    let transferInfo = '';
    if (r.tipo === 'transferencia' && r.transfer) {
      const tf = r.transfer;
      const parts = [];
      if (tf.paga_nombre)   parts.push(`De: ${tf.paga_nombre}`);
      if (tf.recibe_nombre) parts.push(`A: ${tf.recibe_nombre}`);
      if (tf.num_op)        parts.push(`Op: ${tf.num_op}`);
      if (parts.length) transferInfo = `<div style="font-size:10px;color:var(--gray3);margin-top:2px">${escHtml(parts.join(' · '))}</div>`;
    }
    const vehIcon = r.vehiculo_desc
      ? `<span title="${escHtml(r.vehiculo_desc)}" style="color:var(--blue);font-size:11px">🚗 ${escHtml(r.vehiculo_desc)}</span>`
      : '<span style="color:var(--gray3)">—</span>';
    const compBtn = r.tiene_comprobante
      ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:10px" onclick="verComprobante('${r.id}')">📎</button>`
      : '<span style="color:var(--gray3)">—</span>';
    return `
      <tr>
        <td><span style="font-family:monospace;font-size:10px;color:var(--gray3)">${escHtml(r.id_interno || r.id)}</span></td>
        <td style="white-space:nowrap">${fecha}</td>
        <td><span class="fin-badge ${tipoClass}">${tipoLabel}</span></td>
        <td style="font-size:11px">${escHtml(r.categoria || '')}</td>
        <td>${escHtml(r.descripcion || '')}${transferInfo}</td>
        <td class="${montoClass}" style="white-space:nowrap">${montoPrefix}${formatClp(r.monto)}</td>
        <td style="font-size:11px;color:var(--gray3)">${escHtml(r.usuario || '')}</td>
        <td>${vehIcon}</td>
        <td>${compBtn}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModal('${r.id}')">✏️</button>
            <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;color:var(--red)" onclick="eliminar('${r.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Filters ──────────────────────────────────────────────────────────────────
function filtrarTipo(tipo, btn) {
  tipoFilter = tipo;
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabla(allRows);
}

function buscar(q) {
  searchQuery = q;
  renderTabla(allRows);
}

// ── Modal ────────────────────────────────────────────────────────────────────
function openModal(id = null) {
  editingId = id;
  document.getElementById('modalTitle').textContent = id ? 'Editar transacción' : 'Nueva transacción';
  resetForm();

  if (id) {
    const row = allRows.find(r => r.id === id);
    if (!row) return;
    setRadio('f_tipo', row.tipo || 'ingreso');
    onTipoChange();
    document.getElementById('f_categoria').value = row.categoria || '';
    document.getElementById('f_descripcion').value = row.descripcion || '';
    document.getElementById('f_monto').value = formatClpInput(row.monto || 0);
    document.getElementById('f_fecha').value = (row.fecha || '').slice(0, 10);
    document.getElementById('f_notas').value = row.notas || '';
    if (row.vehiculo_id) {
      document.getElementById('f_vehiculo_id').value = row.vehiculo_id;
      document.getElementById('f_vehiculo_desc').value = row.vehiculo_desc || '';
      document.getElementById('vehiculoDesc').textContent = row.vehiculo_desc || '';
      document.getElementById('vehiculoSeleccionado').style.display = 'flex';
    }
    if (row.tiene_comprobante) {
      document.getElementById('compPreview').innerHTML = '✅ <span style="font-size:12px">Comprobante guardado</span>';
    }
    if (row.tipo === 'transferencia') {
      const tf = row.transfer || {};
      ['paga_nombre','paga_rut','paga_banco','paga_cuenta',
       'recibe_nombre','recibe_rut','recibe_banco','recibe_cuenta'].forEach(k => {
        const el = document.getElementById('t_' + k);
        if (el) el.value = tf[k] || '';
      });
      const opEl = document.getElementById('t_num_op');
      if (opEl) opEl.value = tf.num_op || '';
    }
  } else {
    onTipoChange();
  }

  // Fill usuario display from sidebar
  const userEl = document.querySelector('.user-name');
  if (userEl) document.getElementById('f_usuario_display').value = userEl.textContent.trim();

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

function resetForm() {
  setRadio('f_tipo', 'ingreso');
  document.getElementById('f_categoria').innerHTML = '';
  document.getElementById('f_descripcion').value = '';
  document.getElementById('f_monto').value = '';
  document.getElementById('f_notas').value = '';
  document.getElementById('f_comprobante').value = '';
  document.getElementById('compPreview').innerHTML = '📎';
  limpiarVehiculo();
  setDefaultFecha();
  limpiarTransfer();
}

function limpiarTransfer() {
  ['t_paga_nombre','t_paga_rut','t_paga_banco','t_paga_cuenta',
   't_recibe_nombre','t_recibe_rut','t_recibe_banco','t_recibe_cuenta',
   't_num_op'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function setDefaultFecha() {
  const el = document.getElementById('f_fecha');
  if (!el) return;
  el.value = new Date().toISOString().slice(0, 10);
}

function setRadio(name, val) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
    r.checked = r.value === val;
  });
}

// ── Tipo → Categoría ─────────────────────────────────────────────────────────
function onTipoChange() {
  const tipo = document.querySelector('input[name="f_tipo"]:checked')?.value || 'ingreso';
  const sel = document.getElementById('f_categoria');
  sel.innerHTML = (CATEGORIAS[tipo] || []).map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

  const showTransfer = tipo === 'transferencia';
  document.getElementById('secTransfer').style.display  = showTransfer ? '' : 'none';
  document.getElementById('transFields').style.display  = showTransfer ? '' : 'none';
}

// ── Guardar ──────────────────────────────────────────────────────────────────
async function guardarTransaccion() {
  const tipo      = document.querySelector('input[name="f_tipo"]:checked')?.value;
  const categoria = document.getElementById('f_categoria').value.trim();
  const desc      = document.getElementById('f_descripcion').value.trim();
  const montoRaw  = document.getElementById('f_monto').value.replace(/\D/g, '');
  const fecha     = document.getElementById('f_fecha').value;
  const notas     = document.getElementById('f_notas').value.trim();
  const vehId     = document.getElementById('f_vehiculo_id').value;
  const vehDesc   = document.getElementById('f_vehiculo_desc').value;
  const comp      = document.getElementById('f_comprobante').value;

  if (!tipo || !categoria || !desc || !montoRaw || !fecha) {
    showToast('Completa los campos obligatorios', 'error'); return;
  }

  const payload = {
    tipo, categoria,
    descripcion: desc,
    monto: parseInt(montoRaw, 10),
    fecha,
    notas,
    vehiculo_id:   vehId || null,
    vehiculo_desc: vehDesc || null,
  };
  if (comp) payload.comprobante = comp;

  if (tipo === 'transferencia') {
    const gv = id => (document.getElementById(id)?.value || '').trim();
    payload.transfer = {
      paga_nombre:    gv('t_paga_nombre'),
      paga_rut:       gv('t_paga_rut'),
      paga_banco:     gv('t_paga_banco'),
      paga_cuenta:    gv('t_paga_cuenta'),
      recibe_nombre:  gv('t_recibe_nombre'),
      recibe_rut:     gv('t_recibe_rut'),
      recibe_banco:   gv('t_recibe_banco'),
      recibe_cuenta:  gv('t_recibe_cuenta'),
      num_op:         gv('t_num_op'),
    };
  }

  try {
    const url    = editingId ? `/api/finanzas/${editingId}` : '/api/finanzas';
    const method = editingId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.error || 'Error al guardar', 'error'); return; }

    closeModal();
    const mes = document.getElementById('filtMes').value;
    loadAll(mes);
    loadResumen(mes);
    showToast(editingId ? 'Transacción actualizada' : `Transacción creada — ${data.id}`);
  } catch (e) {
    showToast('Error de red', 'error');
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────
async function eliminar(id) {
  const row = allRows.find(r => r.id === id);
  const label = row ? `${row.id_interno || id} — ${row.descripcion}` : id;
  if (!confirm(`¿Eliminar transacción "${label}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`/api/finanzas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.ok) { showToast('Error al eliminar', 'error'); return; }
    const mes = document.getElementById('filtMes').value;
    loadAll(mes);
    loadResumen(mes);
    showToast('Transacción eliminada');
  } catch (e) {
    showToast('Error de red', 'error');
  }
}

// ── Vehicle search ────────────────────────────────────────────────────────────
let _vehTimeout = null;
async function buscarVehiculo(q) {
  clearTimeout(_vehTimeout);
  const box = document.getElementById('vehiculoSuggestions');
  if (q.length < 2) { box.style.display = 'none'; return; }
  _vehTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(`/api/inventario?q=${encodeURIComponent(q)}`);
      const rows = await res.json();
      if (!rows.length) { box.style.display = 'none'; return; }
      box.innerHTML = rows.slice(0, 8).map(r => {
        const label = `${r.marca || ''} ${r.modelo || ''} ${r.anio || ''} — ${r.patente || ''}`.trim();
        return `<div class="sugg-item" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border2)"
                     onmousedown="seleccionarVehiculo('${r.id}', '${escJs(label)}')">${escHtml(label)}</div>`;
      }).join('');
      box.style.display = 'block';
    } catch (e) { console.error(e); }
  }, 250);
}

function seleccionarVehiculo(id, desc) {
  document.getElementById('f_vehiculo_id').value   = id;
  document.getElementById('f_vehiculo_desc').value = desc;
  document.getElementById('vehiculoDesc').textContent = desc;
  document.getElementById('vehiculoSeleccionado').style.display = 'flex';
  document.getElementById('vehiculoSuggestions').style.display  = 'none';
  document.getElementById('f_vehiculo_search').value = '';
}

function limpiarVehiculo() {
  document.getElementById('f_vehiculo_id').value   = '';
  document.getElementById('f_vehiculo_desc').value = '';
  document.getElementById('vehiculoSeleccionado').style.display = 'none';
  document.getElementById('f_vehiculo_search').value = '';
}

// ── Monto formatting ──────────────────────────────────────────────────────────
function fmtMonto(input) {
  const digits = input.value.replace(/\D/g, '');
  input.value = digits ? formatClpInput(parseInt(digits, 10)) : '';
}

function formatClpInput(n) {
  return new Intl.NumberFormat('es-CL').format(n);
}

function formatClp(n) {
  const a = Math.abs(n || 0);
  const s = (n || 0) < 0 ? '−$' : '$';
  if (a >= 1e6) return s + (a/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(1) + 'K';
  return s + new Intl.NumberFormat('es-CL').format(a);
}

// ── Comprobante upload ────────────────────────────────────────────────────────
function dropComprobante(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) processComprobante(file);
}

function uploadComprobante(input) {
  const file = input.files[0];
  if (file) processComprobante(file);
}

function processComprobante(file) {
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    showToast('Solo imágenes o PDF', 'error'); return;
  }
  const preview = document.getElementById('compPreview');
  preview.innerHTML = '<span style="font-size:12px">Cargando...</span>';

  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result;
    document.getElementById('f_comprobante').value = b64;
    if (file.type.startsWith('image/')) {
      preview.innerHTML = `<img src="${b64}" style="max-height:80px;max-width:100%;border-radius:6px;margin-bottom:4px">
        <div style="font-size:10px;color:var(--gray3)">${file.name}</div>`;
    } else {
      preview.innerHTML = `<div style="font-size:28px">📄</div><div style="font-size:10px;color:var(--gray3)">${file.name}</div>`;
    }
  };
  reader.readAsDataURL(file);
}

// ── Comprobante viewer ────────────────────────────────────────────────────────
async function verComprobante(id) {
  try {
    const res  = await fetch(`/api/finanzas/${id}/comprobante`);
    const data = await res.json();
    if (!data.comprobante) { showToast('Sin comprobante', 'error'); return; }
    const modal = document.getElementById('modalComp');
    const img   = document.getElementById('modalCompImg');
    if (data.comprobante.startsWith('data:application/pdf')) {
      window.open(data.comprobante, '_blank');
      return;
    }
    img.src = data.comprobante;
    modal.style.display = 'flex';
  } catch (e) {
    showToast('Error cargando comprobante', 'error');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJs(s) {
  return String(s ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

// ── Costos fijos en finanzas ──────────────────────────────────────────────────
async function cargarCostosFijosBar() {
  try {
    const items = await fetch('/api/config/costos-fijos').then(r => r.json());
    const bar   = document.getElementById('costosFijosBar');
    if (!items || !items.length || !bar) return;

    const total = items.reduce((s, c) => s + (c.monto || 0), 0);
    const cats  = { 'Arriendo / Oficina':'#00AEEF','Servicios básicos':'#F1C40F','Sueldo / Personal':'#2ECC71',
                    'Publicidad':'#9B59B6','Software / Herramientas':'#3498DB',
                    'Contabilidad / Legal':'#E67E22','Combustible':'#E74C3C','Otro':'#4A5568' };

    const itemsEl = document.getElementById('costosFijosItems');
    itemsEl.innerHTML = `
      <span style="font-size:10px;color:var(--gray3);font-weight:600;margin-right:4px">📋 COSTOS FIJOS / MES</span>` +
      items.map(c => {
        const col = cats[c.categoria] || '#4A5568';
        const mto = c.monto >= 1e6 ? '$'+(c.monto/1e6).toFixed(2)+'M' : '$'+Math.round(c.monto/1e3)+'K';
        return `<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:var(--card2);
                             border:1px solid ${col}33;color:var(--text1)">
                  <span style="color:${col}">●</span> ${escHtml(c.nombre)}: <strong>${mto}</strong>
                </span>`;
      }).join('') +
      `<span style="font-size:11px;font-weight:700;color:#e74c3c;margin-left:4px">
         Total: ${total >= 1e6 ? '$'+(total/1e6).toFixed(2)+'M' : '$'+Math.round(total/1e3)+'K'}
       </span>`;

    bar.style.display = 'block';

    // Calcular balance operacional (necesita el resumen cargado)
    const mes = document.getElementById('filtMes')?.value || '';
    const qs  = mes ? `?mes=${mes}` : '';
    const res = await fetch(`/api/finanzas/resumen${qs}`).then(r => r.json());
    const bal = (res.ingresos || 0) - (res.costos || 0) - total;
    const balEl = document.getElementById('balanceOp');
    if (balEl) {
      balEl.textContent = (bal >= 0 ? '+' : '') + (Math.abs(bal) >= 1e6
        ? '$'+(bal/1e6).toFixed(2)+'M' : '$'+Math.round(bal/1e3)+'K');
      balEl.style.color = bal >= 0 ? '#27ae60' : '#e74c3c';
    }
  } catch(e) {}
}

function abrirReporte() {
  const sel = document.getElementById('filtMes');
  const mes = sel ? sel.value : '';
  const url = '/admin/finanzas/reporte' + (mes ? `?mes=${mes}` : '');
  window.open(url, '_blank');
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}
