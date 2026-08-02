// finanzas.js — CORZE Finanzas

const CATEGORIAS = {
  ingreso: [
    'Venta solar',
    'Anticipo / Abono',
    'Comisión',
    'Transferencia recibida',
    'Otro ingreso',
  ],
  egreso: [
    'Materiales proyectos',
    'Transporte y combustible',
    'Indumentaria',
    'Marketing',
    'Herramientas',
    'Arriendo / Oficina',
    'Servicios básicos',
    'Software / Herramientas',
    'Contabilidad / Legal',
    'Sueldos / Personal',
    'Otro egreso',
  ],
};

// ── State ─────────────────────────────────────────────────────────────────────
let allRows     = [];
let tipoFilter  = '';
let searchQuery = '';
let editingId   = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setDefaultFecha();
  rellenarFiltroMeses();
  loadAll('');
  loadResumen('');
  cargarCostosFijosBar();
});

// ── Period helpers ────────────────────────────────────────────────────────────
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
  cargarCostosFijosBar(val);
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function loadAll(mes = '') {
  try {
    const qs = mes ? `?mes=${mes}` : '';
    const res = await fetch(`/api/finanzas${qs}`);
    allRows = await res.json();
    renderTabla(allRows);
  } catch (e) {
    toast('Error cargando transacciones', 'error');
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

// ── KPI strip (3 cards) ───────────────────────────────────────────────────────
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
  const strip  = document.getElementById('resumenStrip');
  const ing    = d.ingresos || 0;
  const egr    = d.egresos  || 0;
  const bal    = ing - egr;
  const balCol = bal >= 0 ? '#27ae60' : '#e74c3c';

  strip.innerHTML = `
    <div class="kpi-strip">
      <div class="kl">💰 INGRESOS</div>
      <div class="kv" style="color:#27ae60">${clpAbbrev(ing)}</div>
      <div class="ks">${d.n_ingresos || 0} transacciones</div>
    </div>
    <div class="kpi-strip">
      <div class="kl">💸 EGRESOS</div>
      <div class="kv" style="color:#e74c3c">${clpAbbrev(egr)}</div>
      <div class="ks">${d.n_egresos || 0} transacciones</div>
    </div>
    <div class="kpi-strip" style="border-color:${balCol}44">
      <div class="kl">⚖️ BALANCE</div>
      <div class="kv" style="color:${balCol}">${clpAbbrev(bal)}</div>
      <div class="ks">${bal >= 0 ? '▲ positivo' : '▼ negativo'}</div>
    </div>`;
}

// ── Table rendering ───────────────────────────────────────────────────────────
function visibleRows() {
  return allRows.filter(r => {
    if (tipoFilter) {
      if (tipoFilter === 'egreso') {
        if (r.tipo !== 'egreso' && r.tipo !== 'costo') return false;
      } else if (r.tipo !== tipoFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = [r.id_interno, r.descripcion, r.categoria, r.usuario,
                   String(r.monto)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTabla(rows) {
  const tbody   = document.getElementById('tablaBody');
  const visible = rows === allRows ? visibleRows() : rows;

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--gray3)">
      Sin transacciones para mostrar</td></tr>`;
    return;
  }

  tbody.innerHTML = visible.map(r => {
    const isEgr = r.tipo === 'costo' || r.tipo === 'egreso';
    const tipoClass = r.tipo === 'ingreso' ? 'fin-ingreso' : 'fin-egreso';
    const tipoLabel = r.tipo === 'ingreso' ? '💰 Ingreso' : '💸 Egreso';
    const montoClass = r.tipo === 'ingreso' ? 'fin-monto-pos' : 'fin-monto-neg';
    const montoPrefix = r.tipo === 'ingreso' ? '+' : '−';
    const fecha = (r.fecha || '').slice(0, 10);
    const compBtn = r.tiene_comprobante
      ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:10px" onclick="verComprobante('${r.id}')">📎</button>`
      : '<span style="color:var(--gray3)">—</span>';
    return `
      <tr>
        <td><span style="font-family:monospace;font-size:10px;color:var(--gray3)">${escHtml(r.id_interno || r.id)}</span></td>
        <td style="white-space:nowrap">${fecha}</td>
        <td><span class="fin-badge ${tipoClass}">${tipoLabel}</span></td>
        <td style="font-size:11px">${escHtml(r.categoria || '')}</td>
        <td>${escHtml(r.descripcion || '')}</td>
        <td class="${montoClass}" style="white-space:nowrap">${montoPrefix}${formatClp(r.monto)}</td>
        <td style="font-size:11px;color:var(--gray3)">${escHtml(r.usuario || '')}</td>
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

// ── Filters ───────────────────────────────────────────────────────────────────
function filtrarTipo(tipo, btn) {
  tipoFilter = tipo;
  document.querySelectorAll('#panelTx .tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabla(allRows);
}

function buscar(q) {
  searchQuery = q;
  renderTabla(allRows);
}

// ── Modal transacción ─────────────────────────────────────────────────────────
function openModal(id = null) {
  try {
    editingId = id;
    document.getElementById('modalTitle').textContent = id ? 'Editar transacción' : 'Nueva transacción';
    resetForm();

    if (id) {
      const row = allRows.find(r => r.id === id);
      if (!row) return;
      const tipo = (row.tipo === 'costo') ? 'egreso' : (row.tipo || 'ingreso');
      setRadio('f_tipo', tipo);
      onTipoChange();
      document.getElementById('f_categoria').value = row.categoria || '';
      document.getElementById('f_descripcion').value = row.descripcion || '';
      document.getElementById('f_monto').value = formatClpInput(row.monto || 0);
      document.getElementById('f_fecha').value = (row.fecha || '').slice(0, 10);
      document.getElementById('f_notas').value = row.notas || '';
      if (row.tiene_comprobante) {
        document.getElementById('compPreview').innerHTML = '✅ <span style="font-size:12px">Comprobante guardado</span>';
      }
    } else {
      onTipoChange();
    }

    const userEl = document.querySelector('.user-name');
    if (userEl) document.getElementById('f_usuario_display').value = userEl.textContent.trim();
    const modal = document.getElementById('modal');
    modal.classList.add('open');
    modal.style.display = 'flex';
  } catch(e) {
    console.error('openModal error:', e);
    toast('Error abriendo formulario: ' + e.message, 'error', 5000);
  }
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('open');
  modal.style.display = '';
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
  setDefaultFecha();
}

function setDefaultFecha() {
  const el = document.getElementById('f_fecha');
  if (el) el.value = today();
}

function setRadio(name, val) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
    r.checked = r.value === val;
  });
}

function onTipoChange() {
  const tipo = document.querySelector('input[name="f_tipo"]:checked')?.value || 'ingreso';
  const sel = document.getElementById('f_categoria');
  sel.innerHTML = (CATEGORIAS[tipo] || []).map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
}

// ── Guardar transacción ───────────────────────────────────────────────────────
async function guardarTransaccion() {
  const tipo      = document.querySelector('input[name="f_tipo"]:checked')?.value;
  const categoria = document.getElementById('f_categoria').value.trim();
  const desc      = document.getElementById('f_descripcion').value.trim();
  const montoRaw  = document.getElementById('f_monto').value.replace(/\D/g, '');
  const fecha     = document.getElementById('f_fecha').value;
  const notas     = document.getElementById('f_notas').value.trim();
  const comp      = document.getElementById('f_comprobante').value;

  if (!tipo || !categoria || !desc || !montoRaw || !fecha) {
    toast('Completa los campos obligatorios', 'error'); return;
  }

  const payload = { tipo, categoria, descripcion: desc, monto: parseInt(montoRaw, 10), fecha, notas };
  if (comp) payload.comprobante = comp;

  try {
    const url    = editingId ? `/api/finanzas/${editingId}` : '/api/finanzas';
    const method = editingId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) { toast(data.error || 'Error al guardar', 'error'); return; }
    closeModal();
    const mes = document.getElementById('filtMes').value;
    loadAll(mes);
    loadResumen(mes);
    toast(editingId ? 'Transacción actualizada' : `Transacción creada — ${data.id}`);
  } catch (e) {
    toast('Error de red', 'error');
  }
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
async function eliminar(id) {
  const row = allRows.find(r => r.id === id);
  const label = row ? `${row.id_interno || id} — ${row.descripcion}` : id;
  if (!confirm(`¿Eliminar "${label}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`/api/finanzas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.ok) { toast('Error al eliminar', 'error'); return; }
    const mes = document.getElementById('filtMes').value;
    loadAll(mes);
    loadResumen(mes);
    toast('Transacción eliminada');
  } catch (e) {
    toast('Error de red', 'error');
  }
}

// ── Monto formatting ──────────────────────────────────────────────────────────
function fmtMonto(input) {
  const digits = input.value.replace(/\D/g, '');
  input.value = digits ? formatClpInput(parseInt(digits, 10)) : '';
}

function fmtCFMonto(input) {
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

// ── Comprobante ───────────────────────────────────────────────────────────────
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
    toast('Solo imágenes o PDF', 'error'); return;
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

async function verComprobante(id) {
  try {
    const res  = await fetch(`/api/finanzas/${id}/comprobante`);
    const data = await res.json();
    if (!data.comprobante) { toast('Sin comprobante', 'error'); return; }
    if (data.comprobante.startsWith('data:application/pdf')) {
      window.open(data.comprobante, '_blank'); return;
    }
    const modal = document.getElementById('modalComp');
    document.getElementById('modalCompImg').src = data.comprobante;
    modal.style.display = 'flex';
  } catch (e) {
    toast('Error cargando comprobante', 'error');
  }
}

// ── Costos fijos bar ──────────────────────────────────────────────────────────
async function cargarCostosFijosBar(mes) {
  try {
    const items = await fetch('/api/costos-fijos').then(r => r.json());
    const bar   = document.getElementById('cfMesBar');
    if (!items || !items.length || !bar) return;

    const total    = items.reduce((s, c) => s + (c.monto || 0), 0);
    const itemsEl  = document.getElementById('cfMesItems');
    const mesActual = mes || document.getElementById('filtMes')?.value || '';

    itemsEl.innerHTML =
      `<span style="font-size:10px;color:var(--gray3);font-weight:600;margin-right:6px">📋 FIJOS / MES</span>` +
      items.slice(0, 5).map(c => {
        const mto = c.monto >= 1e6 ? '$'+(c.monto/1e6).toFixed(2)+'M' : '$'+Math.round(c.monto/1e3)+'K';
        return `<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:var(--card2);border:1px solid var(--border2)">
                  ${escHtml(c.nombre)}: <strong style="color:#e74c3c">${mto}</strong></span>`;
      }).join('') +
      (items.length > 5 ? `<span style="font-size:10px;color:var(--gray3)">+${items.length-5} más</span>` : '') +
      `<span style="font-size:11px;font-weight:700;color:#e74c3c;margin-left:6px">
         Total: ${total >= 1e6 ? '$'+(total/1e6).toFixed(2)+'M' : '$'+Math.round(total/1e3)+'K'}
       </span>`;

    bar.style.display = 'block';

    // Check if already applied for current month
    if (mesActual) {
      const estado = await fetch(`/api/costos-fijos/estado?mes=${mesActual}`).then(r => r.json());
      const btn = document.getElementById('btnAplicarCF');
      if (btn) {
        if (estado.aplicado) {
          btn.textContent = '✅ Fijos ya generados';
          btn.disabled = true;
          btn.style.opacity = '0.6';
        } else {
          btn.textContent = '⚡ Generar egresos fijos del mes';
          btn.disabled = false;
          btn.style.opacity = '';
        }
      }
    }
  } catch(e) {}
}

async function aplicarCFMes() {
  const mes = document.getElementById('filtMes')?.value;
  if (!mes) { toast('Selecciona un mes primero', 'error'); return; }
  if (!confirm(`¿Generar los egresos fijos para ${mes}?`)) return;
  try {
    const res  = await fetch('/api/costos-fijos/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes }),
    });
    const data = await res.json();
    if (!data.ok) { toast(data.error || 'Error al aplicar', 'error'); return; }
    toast(`${data.count} egresos fijos generados para ${mes}`);
    loadAll(mes);
    loadResumen(mes);
    cargarCostosFijosBar(mes);
  } catch(e) {
    toast('Error de red', 'error');
  }
}

// ── Costos fijos CRUD modal ───────────────────────────────────────────────────
let cfItems = [];

async function openModalCF() {
  document.getElementById('modalCF').classList.add('open');
  await loadCF();
}

function closeModalCF() {
  document.getElementById('modalCF').classList.remove('open');
}

async function loadCF() {
  try {
    cfItems = await fetch('/api/costos-fijos').then(r => r.json());
    renderCFLista();
  } catch(e) {
    toast('Error cargando costos fijos', 'error');
  }
}

function renderCFLista() {
  const lista = document.getElementById('cfLista');
  const totalEl = document.getElementById('cfTotal');
  if (!cfItems.length) {
    lista.innerHTML = `<div style="text-align:center;padding:20px;color:var(--gray3);font-size:12px">
      Sin costos fijos configurados aún.</div>`;
    totalEl.textContent = '';
    return;
  }
  const total = cfItems.reduce((s, c) => s + (c.monto || 0), 0);
  lista.innerHTML = cfItems.map(c => `
    <div class="cf-item">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text1)">${escHtml(c.nombre)}</div>
        <div style="font-size:10px;color:var(--gray3)">${escHtml(c.categoria || '')}</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:#e74c3c;margin-right:12px">${formatClp(c.monto)}</div>
      <button class="btn btn-secondary" style="padding:2px 8px;font-size:10px;color:var(--red)"
              onclick="deleteCF('${c.id}')">🗑️</button>
    </div>`).join('');
  totalEl.textContent = `Total mensual: ${formatClp(total)}`;
}

async function agregarCF() {
  const nombre = document.getElementById('cf_nombre').value.trim();
  const montoRaw = document.getElementById('cf_monto').value.replace(/\D/g, '');
  const categoria = document.getElementById('cf_categoria').value;

  if (!nombre || !montoRaw) { toast('Nombre y monto son obligatorios', 'error'); return; }

  try {
    const res = await fetch('/api/costos-fijos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, monto: parseInt(montoRaw, 10), categoria, activo: true }),
    });
    const data = await res.json();
    if (!data.ok) { toast(data.error || 'Error al agregar', 'error'); return; }
    document.getElementById('cf_nombre').value = '';
    document.getElementById('cf_monto').value = '';
    toast('Costo fijo agregado');
    await loadCF();
    await cargarCostosFijosBar(document.getElementById('filtMes')?.value);
  } catch(e) {
    toast('Error de red', 'error');
  }
}

async function deleteCF(id) {
  if (!confirm('¿Eliminar este costo fijo?')) return;
  try {
    const res = await fetch(`/api/costos-fijos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.ok) { toast('Error al eliminar', 'error'); return; }
    toast('Costo fijo eliminado');
    await loadCF();
    await cargarCostosFijosBar(document.getElementById('filtMes')?.value);
  } catch(e) {
    toast('Error de red', 'error');
  }
}

// ── Reporte ───────────────────────────────────────────────────────────────────
function abrirReporte() {
  const mes = document.getElementById('filtMes')?.value || '';
  window.open('/admin/finanzas/reporte' + (mes ? `?mes=${mes}` : ''), '_blank');
}

// ── withBtn helper ────────────────────────────────────────────────────────────
async function withBtn(btn, fn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳';
  try { await fn(); } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJs(s) {
  return String(s ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
