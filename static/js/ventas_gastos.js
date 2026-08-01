// ventas_gastos.js — Ventas Solar & Gastos CORZE

// ── State ────────────────────────────────────────────────────────────────────
let allVentas      = [];
let allGastos      = [];
let editingVentaId = null;
let editingGastoId = null;
let currentMainTab = 'tx';

// ── Helpers ──────────────────────────────────────────────────────────────────
const clp = n => n ? '$' + Math.round(Number(n)).toLocaleString('es-CL') : '$0';

function parseCLP(str) {
  return parseInt((str || '0').replace(/[^0-9]/g, '')) || 0;
}

function fmtInput(el) {
  const v = parseCLP(el.value);
  el.value = v ? '$' + v.toLocaleString('es-CL') : '';
}

// ── Main Tab Switcher ─────────────────────────────────────────────────────────
function switchMainTab(tab, btn) {
  currentMainTab = tab;
  document.querySelectorAll('[id^="mainTab_"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.getElementById('panelTx').style.display     = tab === 'tx'     ? '' : 'none';
  document.getElementById('panelVentas').style.display = tab === 'ventas' ? '' : 'none';
  document.getElementById('panelGastos').style.display = tab === 'gastos' ? '' : 'none';

  if (tab === 'ventas') loadVentas();
  if (tab === 'gastos') loadGastos();
}

// ══════════════════════════════════════════════════════════════════════════════
//  VENTAS SOLAR
// ══════════════════════════════════════════════════════════════════════════════

async function loadVentas() {
  const res = await fetch('/api/ventas-corze');
  allVentas = await res.json();
  renderVentas();
  renderVentasKpis();
}

function renderVentasKpis() {
  const total     = allVentas.reduce((s, v) => s + (v.monto_venta || 0), 0);
  const comision  = allVentas.reduce((s, v) => s + (v.comision_monto || 0), 0);
  const pendiente = allVentas.filter(v => (v.estado_instalacion || '').startsWith('Pendiente')).length;
  const instalado = allVentas.filter(v => v.estado_instalacion === 'Entregado al cliente').length;

  document.getElementById('ventasKpis').innerHTML = `
    <div class="kpi-strip">
      <div class="kv" style="color:var(--blue)">${allVentas.length}</div>
      <div class="kl">Total ventas</div>
    </div>
    <div class="kpi-strip">
      <div class="kv" style="color:#27ae60">${clp(total)}</div>
      <div class="kl">Facturación total</div>
    </div>
    <div class="kpi-strip">
      <div class="kv" style="color:#F5A623">${pendiente}</div>
      <div class="kl">Pendiente instalación</div>
    </div>
    <div class="kpi-strip">
      <div class="kv" style="color:#2ecc71">${instalado}</div>
      <div class="kl">Entregados al cliente</div>
    </div>`;
}

function filtrarVentas() {
  renderVentas();
}

function renderVentas() {
  const q       = (document.getElementById('searchVentas')?.value || '').toLowerCase();
  const estado  = document.getElementById('filtEstadoVenta')?.value || '';
  const tbody   = document.getElementById('ventasBody');

  let rows = allVentas;
  if (q)      rows = rows.filter(v => [v.cliente, v.num_cotizacion, v.vendedor, v.id_venta].join(' ').toLowerCase().includes(q));
  if (estado) rows = rows.filter(v => v.estado_instalacion === estado);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--gray3);padding:24px">Sin ventas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(v => {
    const badge = estadoBadge(v.estado_instalacion);
    return `<tr>
      <td style="font-weight:700;color:var(--blue)">${v.id_venta || '—'}</td>
      <td>${(v.fecha_venta || '').slice(0, 10)}</td>
      <td style="color:var(--gray2)">${v.num_cotizacion || '—'}</td>
      <td style="font-weight:600">${v.cliente || '—'}</td>
      <td>${v.vendedor || '—'}</td>
      <td class="fin-monto-pos">${clp(v.monto_venta)}</td>
      <td style="color:var(--gray2)">${v.forma_pago || '—'}</td>
      <td>${badge}</td>
      <td>${v.comision_pct ? v.comision_pct + '% · ' + clp(v.comision_monto) : '—'}</td>
      <td>
        <button class="btn-icon" title="Editar" onclick="editVenta('${v.id}')">✏️</button>
        <button class="btn-icon" title="Eliminar" onclick="deleteVenta('${v.id}','${v.id_venta || 'esta venta'}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function estadoBadge(est) {
  const map = {
    'Pendiente instalación': 'badge-pendiente',
    'En instalación':        'badge-instalacion',
    'Instalado':             'badge-instalado',
    'Entregado al cliente':  'badge-entregado',
    'Cancelado':             'badge-cancelado',
  };
  const cls = map[est] || 'badge-pendiente';
  return `<span class="vg-badge ${cls}">${est || '—'}</span>`;
}

// ── Modal Venta ───────────────────────────────────────────────────────────────
function openModalVenta(data = null) {
  editingVentaId = data ? data.id : null;
  document.getElementById('modalVentaTitle').textContent = data ? 'Editar venta' : 'Nueva venta solar';
  document.getElementById('vf_id_venta').value           = data?.id_venta || '';
  document.getElementById('vf_fecha_venta').value        = (data?.fecha_venta || '').slice(0, 10);
  document.getElementById('vf_num_cotizacion').value     = data?.num_cotizacion || '';
  document.getElementById('vf_cliente').value            = data?.cliente || '';
  document.getElementById('vf_proyecto').value           = data?.proyecto || '';
  setSelectVal('vf_vendedor',           data?.vendedor || '');
  setSelectVal('vf_forma_pago',         data?.forma_pago || '');
  setSelectVal('vf_estado_instalacion', data?.estado_instalacion || 'Pendiente instalación');
  document.getElementById('vf_fecha_entrega').value      = (data?.fecha_entrega || '').slice(0, 10);
  document.getElementById('vf_monto_venta').value        = data?.monto_venta ? clp(data.monto_venta) : '';
  document.getElementById('vf_comision_pct').value       = data?.comision_pct || '';
  document.getElementById('vf_comision_monto').value     = data?.comision_monto ? clp(data.comision_monto) : '';
  document.getElementById('vf_notas').value              = data?.notas || '';
  if (!data) document.getElementById('vf_fecha_venta').value = today();
  document.getElementById('modalVenta').classList.add('open');
}

function closeModalVenta() {
  document.getElementById('modalVenta').classList.remove('open');
  editingVentaId = null;
}

function editVenta(id) {
  const v = allVentas.find(x => x.id === id);
  if (v) openModalVenta(v);
}

async function deleteVenta(id, label) {
  if (!confirm(`¿Eliminar ${label}?`)) return;
  const res  = await fetch(`/api/ventas-corze/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) { toast('Venta eliminada'); loadVentas(); }
  else toast('Error al eliminar', 'error');
}

function fmtVentaMonto(el) { fmtInput(el); calcVentaComision(); }

function calcVentaComision() {
  const monto = parseCLP(document.getElementById('vf_monto_venta').value);
  const pct   = parseFloat(document.getElementById('vf_comision_pct').value) || 0;
  document.getElementById('vf_comision_monto').value = pct > 0 ? clp(monto * pct / 100) : '';
}

async function guardarVenta() {
  const monto = parseCLP(document.getElementById('vf_monto_venta').value);
  if (!document.getElementById('vf_fecha_venta').value) return toast('Fecha requerida', 'error');
  if (!document.getElementById('vf_cliente').value.trim()) return toast('Cliente requerido', 'error');
  if (!monto) return toast('Monto requerido', 'error');

  const pct = parseFloat(document.getElementById('vf_comision_pct').value) || 0;
  const payload = {
    id_venta:           document.getElementById('vf_id_venta').value || undefined,
    fecha_venta:        document.getElementById('vf_fecha_venta').value,
    num_cotizacion:     document.getElementById('vf_num_cotizacion').value.trim(),
    cliente:            document.getElementById('vf_cliente').value.trim(),
    proyecto:           document.getElementById('vf_proyecto').value.trim(),
    vendedor:           document.getElementById('vf_vendedor').value,
    monto_venta:        monto,
    forma_pago:         document.getElementById('vf_forma_pago').value,
    estado_instalacion: document.getElementById('vf_estado_instalacion').value,
    fecha_entrega:      document.getElementById('vf_fecha_entrega').value,
    comision_pct:       pct,
    comision_monto:     pct > 0 ? Math.round(monto * pct / 100) : 0,
    notas:              document.getElementById('vf_notas').value.trim(),
  };

  const url    = editingVentaId ? `/api/ventas-corze/${editingVentaId}` : '/api/ventas-corze';
  const method = editingVentaId ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data   = await res.json();

  if (data.ok) {
    toast(editingVentaId ? 'Venta actualizada' : 'Venta guardada');
    closeModalVenta();
    loadVentas();
  } else {
    toast('Error: ' + (data.error || 'desconocido'), 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GASTOS CORZE
// ══════════════════════════════════════════════════════════════════════════════

async function loadGastos() {
  const res = await fetch('/api/gastos-corze');
  allGastos = await res.json();
  renderGastos();
  renderGastosKpis();
}

function renderGastosKpis() {
  const totalNeto  = allGastos.reduce((s, g) => s + (g.monto_neto   || 0), 0);
  const totalIva   = allGastos.reduce((s, g) => s + (g.iva           || 0), 0);
  const totalTotal = allGastos.reduce((s, g) => s + (g.monto_total   || 0), 0);

  const cats = {};
  allGastos.forEach(g => { if (g.categoria) cats[g.categoria] = (cats[g.categoria] || 0) + (g.monto_total || 0); });
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('gastosKpis').innerHTML = `
    <div class="kpi-strip">
      <div class="kv" style="color:var(--blue)">${allGastos.length}</div>
      <div class="kl">Total registros</div>
    </div>
    <div class="kpi-strip">
      <div class="kv" style="color:#e74c3c">${clp(totalNeto)}</div>
      <div class="kl">Total neto</div>
    </div>
    <div class="kpi-strip">
      <div class="kv" style="color:#F5A623">${clp(totalIva)}</div>
      <div class="kl">IVA total</div>
    </div>
    <div class="kpi-strip">
      <div class="kv" style="color:#e74c3c">${clp(totalTotal)}</div>
      <div class="kl">Total con IVA</div>
    </div>`;
}

function filtrarGastos() {
  renderGastos();
}

function renderGastos() {
  const q    = (document.getElementById('searchGastos')?.value || '').toLowerCase();
  const cat  = document.getElementById('filtCatGasto')?.value || '';
  const tbody = document.getElementById('gastosBody');

  let rows = allGastos;
  if (q)   rows = rows.filter(g => [g.descripcion, g.empresa, g.responsable, g.id_gasto].join(' ').toLowerCase().includes(q));
  if (cat) rows = rows.filter(g => g.categoria === cat);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--gray3);padding:24px">Sin gastos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(g => `<tr>
    <td style="font-weight:700;color:var(--red)">${g.id_gasto || '—'}</td>
    <td>${(g.fecha || '').slice(0, 10)}</td>
    <td><span class="vg-badge" style="background:var(--card3);color:var(--text2)">${g.categoria || '—'}</span></td>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${g.descripcion || ''}">${g.descripcion || '—'}</td>
    <td class="fin-monto-neg">${clp(g.monto_neto)}</td>
    <td style="color:var(--gray3)">${g.iva ? clp(g.iva) : '—'}</td>
    <td class="fin-monto-neg" style="font-weight:800">${clp(g.monto_total)}</td>
    <td style="color:var(--gray2)">${g.metodo_pago || '—'}</td>
    <td>${g.responsable || '—'}</td>
    <td style="color:var(--gray2)">${g.empresa || '—'}</td>
    <td>
      <button class="btn-icon" title="Editar" onclick="editGasto('${g.id}')">✏️</button>
      <button class="btn-icon" title="Eliminar" onclick="deleteGasto('${g.id}','${g.id_gasto || 'este gasto'}')">🗑️</button>
    </td>
  </tr>`).join('');
}

// ── Modal Gasto ───────────────────────────────────────────────────────────────
function openModalGasto(data = null) {
  editingGastoId = data ? data.id : null;
  document.getElementById('modalGastoTitle').textContent = data ? 'Editar gasto' : 'Nuevo gasto CORZE';
  document.getElementById('gf_id_gasto').value    = data?.id_gasto || '';
  document.getElementById('gf_fecha').value        = (data?.fecha || '').slice(0, 10);
  setSelectVal('gf_categoria',   data?.categoria   || '');
  document.getElementById('gf_descripcion').value  = data?.descripcion || '';
  document.getElementById('gf_monto_neto').value   = data?.monto_neto  ? clp(data.monto_neto)  : '';
  document.getElementById('gf_iva').value          = data?.iva          ? clp(data.iva)          : '';
  document.getElementById('gf_monto_total').value  = data?.monto_total  ? clp(data.monto_total)  : '';
  setSelectVal('gf_metodo_pago', data?.metodo_pago || '');
  setSelectVal('gf_responsable', data?.responsable  || '');
  document.getElementById('gf_empresa').value      = data?.empresa      || '';
  document.getElementById('gf_num_documento').value= data?.num_documento || '';
  document.getElementById('gf_iva_19').checked     = false;
  if (!data) document.getElementById('gf_fecha').value = today();
  document.getElementById('modalGasto').classList.add('open');
}

function closeModalGasto() {
  document.getElementById('modalGasto').classList.remove('open');
  editingGastoId = null;
}

function editGasto(id) {
  const g = allGastos.find(x => x.id === id);
  if (g) openModalGasto(g);
}

async function deleteGasto(id, label) {
  if (!confirm(`¿Eliminar ${label}?`)) return;
  const res  = await fetch(`/api/gastos-corze/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) { toast('Gasto eliminado'); loadGastos(); }
  else toast('Error al eliminar', 'error');
}

function fmtGastoNeto(el)  { fmtInput(el); }
function fmtGastoIva(el)   { fmtInput(el); }

function calcGastoTotal() {
  const neto = parseCLP(document.getElementById('gf_monto_neto').value);
  const iva  = parseCLP(document.getElementById('gf_iva').value);
  document.getElementById('gf_monto_total').value = (neto || iva) ? clp(neto + iva) : '';
}

function aplicarIva19() {
  const checked = document.getElementById('gf_iva_19').checked;
  if (!checked) return;
  const neto = parseCLP(document.getElementById('gf_monto_neto').value);
  const iva  = Math.round(neto * 0.19);
  document.getElementById('gf_iva').value = iva ? clp(iva) : '';
  calcGastoTotal();
}

async function guardarGasto() {
  const neto = parseCLP(document.getElementById('gf_monto_neto').value);
  const iva  = parseCLP(document.getElementById('gf_iva').value);
  if (!document.getElementById('gf_fecha').value)     return toast('Fecha requerida', 'error');
  if (!document.getElementById('gf_categoria').value) return toast('Categoría requerida', 'error');
  if (!document.getElementById('gf_descripcion').value.trim()) return toast('Descripción requerida', 'error');
  if (!neto) return toast('Monto neto requerido', 'error');

  const payload = {
    id_gasto:      document.getElementById('gf_id_gasto').value || undefined,
    fecha:         document.getElementById('gf_fecha').value,
    categoria:     document.getElementById('gf_categoria').value,
    descripcion:   document.getElementById('gf_descripcion').value.trim(),
    monto_neto:    neto,
    iva:           iva,
    monto_total:   neto + iva,
    metodo_pago:   document.getElementById('gf_metodo_pago').value,
    responsable:   document.getElementById('gf_responsable').value,
    empresa:       document.getElementById('gf_empresa').value.trim(),
    num_documento: document.getElementById('gf_num_documento').value.trim(),
  };

  const url    = editingGastoId ? `/api/gastos-corze/${editingGastoId}` : '/api/gastos-corze';
  const method = editingGastoId ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data   = await res.json();

  if (data.ok) {
    toast(editingGastoId ? 'Gasto actualizado' : 'Gasto guardado');
    closeModalGasto();
    loadGastos();
  } else {
    toast('Error: ' + (data.error || 'desconocido'), 'error');
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function setSelectVal(id, val) {
  const sel = document.getElementById(id);
  if (!sel) return;
  for (let opt of sel.options) { if (opt.value === val || opt.text === val) { sel.value = opt.value; return; } }
  sel.value = '';
}
