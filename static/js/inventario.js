// inventario.js — VTA Web v2.2 · Todo corregido

'use strict';

let allRows     = [];
let filteredRows= [];
let selectedId  = null;
let editingId   = null;
let sellId      = null;
let tipoFilter  = '';
let estadoFilter= '';
let searchQuery = '';

// ════════════════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const fi = document.getElementById('f_fingreso');
  if (fi) fi.value = today();
  loadRows();
  setupKeyboard();
  setupAutoCalc();
});

// ════════════════════════════════════════════════════════════════════════════
//  TECLADO RÁPIDO
// ════════════════════════════════════════════════════════════════════════════
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    const modal  = document.querySelector('.modal-overlay.open');
    const active = document.activeElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);

    if (modal) {
      if (e.key === 'Escape') { closeModal(); closeSell(); }
      return; // dentro de modal no disparar atajos globales
    }

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'n') { e.preventDefault(); openModal();    return; }
    if (ctrl && e.key === 'e') { e.preventDefault(); editSelected(); return; }
    if (ctrl && e.key === 'r') { e.preventDefault(); loadRows();     return; }
    if (ctrl && e.key === 'v') { e.preventDefault(); quickSell();    return; }
    if (ctrl && e.key === 'f') {
      e.preventDefault();
      const s = document.getElementById('searchInput');
      if (s) { s.focus(); s.select(); }
      return;
    }
    if (!typing && (e.key === 'Delete') && selectedId) {
      e.preventDefault(); deleteSelected();
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  AUTO-CÁLCULO COMISIÓN Y GANANCIA POSIBLE
// ════════════════════════════════════════════════════════════════════════════
function setupAutoCalc() {
  // Campos del modal principal
  ['f_pedido', 'f_cpct', 'f_compra', 'f_colab', 'f_mercado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', recalcModal);
  });
}

function recalcModal() {
  const tipo = getSelectedTipo();

  if (tipo === 'CONSIGNACIÓN') {
    const pedido = parseInt((document.getElementById('f_pedido')?.value || '0').replace(/\D/g,'')) || 0;
    const pventa = parseInt((document.getElementById('f_pventa_c')?.value || '0').replace(/\D/g,'')) || 0;
    const pct    = parseFloat(document.getElementById('f_cpct')?.value || '5') || 5;
    // Base = precio_pedido (o precio_venta si es mayor)
    const base   = Math.max(pedido, pventa) || pedido;
    const comis  = Math.round(base * pct / 100);

    // Mostrar comisión calculada
    let preview = document.getElementById('comisPreview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'comisPreview';
      preview.style.cssText = 'font-size:11px;font-weight:700;color:var(--green);margin-top:4px;padding:6px 10px;background:var(--green-dim,#0D3B22);border-radius:6px';
      const cpct = document.getElementById('f_cpct');
      if (cpct) cpct.parentElement.appendChild(preview);
    }
    preview.textContent = comis > 0 ? `Comisión estimada: $${comis.toLocaleString('es-CL')}` : '';
  } else {
    const compra  = parseInt((document.getElementById('f_compra')?.value || '0').replace(/\D/g,'')) || 0;
    const colab   = parseInt((document.getElementById('f_colab')?.value  || '0').replace(/\D/g,'')) || 0;
    const mercado = parseInt((document.getElementById('f_mercado')?.value || '0').replace(/\D/g,'')) || 0;
    const ref     = colab || mercado;
    const gan     = ref > 0 ? ref - compra : 0;

    let preview = document.getElementById('ganPreview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'ganPreview';
      preview.style.cssText = 'font-size:11px;font-weight:700;margin-top:4px;padding:6px 10px;border-radius:6px';
      const fc = document.getElementById('f_compra');
      if (fc) fc.parentElement.appendChild(preview);
    }
    if (gan > 0) {
      preview.style.background = '#0D3B22';
      preview.style.color      = 'var(--green)';
      preview.textContent      = `Ganancia estimada: +$${gan.toLocaleString('es-CL')}`;
    } else if (gan < 0) {
      preview.style.background = '#3B0D0A';
      preview.style.color      = 'var(--red)';
      preview.textContent      = `Bajo costo: $${gan.toLocaleString('es-CL')}`;
    } else {
      preview.textContent = '';
    }
  }
}

function getSelectedTipo() {
  const radio = document.querySelector('input[name="tipo_registro"]:checked');
  return radio ? radio.value : 'INTERNO';
}

// ════════════════════════════════════════════════════════════════════════════
//  DATOS
// ════════════════════════════════════════════════════════════════════════════
async function loadRows() {
  const tbody = document.getElementById('tableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;padding:40px;color:var(--gray3)">Cargando inventario…</td></tr>`;
  try {
    allRows = await api('/api/inventario');
    applyFilters();
    renderStats(allRows);
    renderAlerts(allRows);
    cargarAlertasDocs();
  } catch(e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;padding:40px;color:var(--red)">Error al cargar. Recarga la página o revisa tu conexión.</td></tr>`;
    toast('Error cargando inventario: ' + e, 'error');
  }
}

function applyFilters() {
  let rows = [...allRows];
  if (tipoFilter)    rows = rows.filter(r => r.tipo_registro === tipoFilter);
  if (estadoFilter)  rows = rows.filter(r => r.estado === estadoFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    rows = rows.filter(r =>
      (r.patente||'').toLowerCase().includes(q) ||
      (r.marca||'').toLowerCase().includes(q)   ||
      (r.modelo||'').toLowerCase().includes(q)  ||
      (r.color||'').toLowerCase().includes(q)   ||
      (r.nombre_propietario||'').toLowerCase().includes(q) ||
      (r.chasis||'').toLowerCase().includes(q)
    );
  }
  filteredRows = rows;
  renderTable(rows);
  document.getElementById('rowCount').textContent =
    rows.length + ' vehículo' + (rows.length !== 1 ? 's' : '');
}

function filterTipo(tipo) {
  tipoFilter = tipo;
  ['btnTodos','btnInterno','btnConsig'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  const map = { '': 'btnTodos', 'INTERNO': 'btnInterno', 'CONSIGNACIÓN': 'btnConsig' };
  document.getElementById(map[tipo] || 'btnTodos')?.classList.add('active');
  applyFilters();
}

function filterEstado(val) { estadoFilter = val; applyFilters(); }
function searchRows(q)     { searchQuery  = q;   applyFilters(); }

// ════════════════════════════════════════════════════════════════════════════
//  TABLA
// ════════════════════════════════════════════════════════════════════════════
function renderTable(rows) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;padding:40px;color:var(--gray3)">
      Sin vehículos registrados. Usa ➕ Agregar o Ctrl+N para comenzar.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const esConsig  = r.tipo_registro === 'CONSIGNACIÓN';
    const dias      = parseInt(r.dias_en_stock || 0);
    const eVendido  = r.estado === 'Vendido';
    const alertCls  = !eVendido && dias >= 60 ? 'alert-critical'
                    : !eVendido && dias >= 30 ? 'alert-warning' : '';
    const diasColor = eVendido ? 'var(--gray3)'
                    : dias >= 60 ? 'var(--red)'
                    : dias >= 30 ? 'var(--yellow)'
                    : 'var(--gray2)';

    const col_precio1 = esConsig ? clp(r.precio_pedido) : clp(r.precio_compra);
    const col_precio2 = esConsig ? clp(r.precio_minimo) : clp(r.precio_venta_colaboradores);
    const ganancia_val = parseInt(r.ganancia || 0);
    const comision_val = parseInt(r.comision_monto || 0);
    const pventa       = parseInt(r.precio_venta_final || 0);

    // % sobre precio de venta final
    const pct_gan   = pventa > 0 && ganancia_val > 0
      ? (ganancia_val / pventa * 100).toFixed(1) : null;
    const pct_comis = pventa > 0 && comision_val > 0
      ? (comision_val / pventa * 100).toFixed(1)
      : (r.comision_porcentaje || null);

    const col_gan = esConsig
      ? `<span style="color:var(--green);font-weight:600">${clp(comision_val)}
           <small style="color:var(--gray3);margin-left:4px">
             ${pct_comis ? pct_comis + '% de venta' : ''}
           </small></span>`
      : `<span style="color:${ganancia_val > 0 ? 'var(--green)' : 'var(--gray3)'};font-weight:600">
           ${clp(ganancia_val)}
           ${pct_gan ? `<small style="color:var(--gray3);margin-left:4px">${pct_gan}% de venta</small>` : ''}
         </span>`;

    const isSelected = selectedId === r.id ? ' selected' : '';

    return `<tr class="${alertCls}${isSelected}"
               data-id="${r.id}"
               onclick="selectRow('${r.id}', this)"
               ondblclick="editSelected()">
      <td>${tipoBadge(r.tipo_registro)}</td>
      <td style="color:var(--blue);font-weight:600">${r.patente || '—'}</td>
      <td><strong>${r.marca || '—'}</strong></td>
      <td>${r.anio || '—'}</td>
      <td>${r.modelo || '—'}</td>
      <td>${parseInt(r.km_aprox || r.km || 0).toLocaleString('es-CL')}</td>
      <td>${r.color || '—'}</td>
      <td>${col_precio1}</td>
      <td>${col_precio2}</td>
      <td>${clp(r.precio_venta_final)}</td>
      <td>${col_gan}</td>
      <td>${badgeHTML(r.estado)}</td>
      <td style="color:${diasColor}; font-weight:${dias >= 30 ? '700' : '400'}">${dias || '—'}</td>
      <td style="color:var(--gray3)">${formatDate(r.fecha_ingreso)}</td>
      <td style="color:var(--gray3);font-size:9px">${r.usuario_ultima_edicion || r.usuario_creacion || '—'}</td>
    </tr>`;
  }).join('');
}

function tipoBadge(tipo) {
  if (tipo === 'CONSIGNACIÓN')
    return '<span class="badge" style="background:#3A2E00;color:#F1C40F">🤝 CONSIG.</span>';
  return '<span class="badge" style="background:#0D2030;color:#00AEEF">🏢 INTERNO</span>';
}

// ════════════════════════════════════════════════════════════════════════════
//  SELECCIÓN Y PANEL DE DETALLE
// ════════════════════════════════════════════════════════════════════════════
function selectRow(id, tr) {
  document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
  tr.classList.add('selected');
  selectedId = id;
  const row = allRows.find(r => r.id === id);
  if (row) renderDetail(row);
}

function renderDetail(r) {
  const dp = document.getElementById('detailPanel');
  if (!dp) return;
  const esConsig  = r.tipo_registro === 'CONSIGNACIÓN';
  const dias      = parseInt(r.dias_en_stock || 0);
  const diasColor = r.estado === 'Vendido' ? 'var(--gray3)'
                  : dias >= 60 ? 'var(--red)' : dias >= 30 ? 'var(--yellow)' : 'var(--gray2)';

  dp.innerHTML = `
    <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
      ${tipoBadge(r.tipo_registro)} ${badgeHTML(r.estado)}
      ${dias > 0 ? `<span style="font-size:9px;color:${diasColor};font-weight:700">${dias}d en stock</span>` : ''}
    </div>
    <div class="detail-header">
      <div class="detail-title">${r.marca || ''} ${r.modelo || ''}</div>
      <div class="detail-sub">${r.anio || ''} · ${r.tipo_vehiculo || ''} · ${r.color || ''}</div>
    </div>
    ${esConsig ? `
      <div class="detail-section">PROPIETARIO</div>
      ${dr('Nombre',   r.nombre_propietario)}
      ${dr('RUT',      r.rut_propietario)}
      ${dr('Contacto', r.contacto_propietario)}
      ${dr('Email',    r.email_propietario)}` : ''}
    <div class="detail-section">IDENTIFICACIÓN</div>
    ${dr('Patente', r.patente, 'var(--blue)')}
    ${dr('Chasis',  r.chasis)}
    ${dr('Motor',   r.motor)}
    <div class="detail-section">TÉCNICO</div>
    ${dr('Transmisión', r.transmision)}
    ${dr('Tracción',    r.traccion)}
    ${dr('Combustible', r.combustible)}
    ${dr('KM', parseInt(r.km_aprox || r.km || 0).toLocaleString('es-CL') + ' km')}
    ${dr('N° Dueños', r.cantidad_duenos)}
    <div class="detail-section">PRECIOS</div>
    ${esConsig ? `
      ${dr('P. Pedido', clp(r.precio_pedido))}
      ${dr('P. Mínimo', clp(r.precio_minimo))}
      ${dr('Comisión',  (r.comision_porcentaje || 0) + '% → ' + clp(r.comision_monto), 'var(--green)')}
    ` : `
      ${dr('P. Compra',       clp(r.precio_compra))}
      ${dr('P. Colaboradores',clp(r.precio_venta_colaboradores), 'var(--blue)')}
      ${dr('V. Mercado',      clp(r.valor_mercado))}
      ${dr('Ganancia',        clp(r.ganancia), parseInt(r.ganancia || 0) > 0 ? 'var(--green)' : 'var(--gray3)')}
    `}
    ${dr('P. Venta Final', clp(r.precio_venta_final), r.precio_venta_final ? 'var(--green)' : null)}
    <div class="detail-section">GESTIÓN</div>
    ${dr('F. Ingreso',     formatDate(r.fecha_ingreso))}
    ${dr('F. Publicación', formatDate(r.fecha_publicacion) || '—')}
    ${dr('F. Venta',       formatDate(r.fecha_venta) || '—')}
    ${dr('Creado por',     r.usuario_creacion || '—')}
    ${dr('Editado por',    r.usuario_ultima_edicion || '—')}
    ${r.notas ? `
      <div class="detail-section">NOTAS</div>
      <div style="padding:6px 14px 12px;color:var(--gray2);font-size:10px;line-height:1.5">${r.notas}</div>` : ''}
    <div style="padding:8px 12px 12px;display:flex;gap:6px">
      <button class="btn btn-secondary" style="font-size:10px;padding:5px 10px;flex:1"
              onclick="editSelected()">✏️ Editar</button>
      ${r.estado !== 'Vendido' ? `
      <button class="btn btn-success" style="font-size:10px;padding:5px 10px;flex:1"
              onclick="quickSell()">✅ Vender</button>` : ''}
    </div>`;
}

function dr(label, value, color) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value"${color ? ` style="color:${color}"` : ''}>${value || '—'}</span>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  STATS STRIP — incluye posibles ganancias
// ════════════════════════════════════════════════════════════════════════════
function renderStats(rows) {
  const stock  = rows.filter(r => r.estado === 'En Stock').length;
  const pub    = rows.filter(r => r.estado === 'Publicado').length;
  const res    = rows.filter(r => r.estado === 'Reservado').length;
  const vend   = rows.filter(r => r.estado === 'Vendido').length;
  const int_n  = rows.filter(r => r.tipo_registro === 'INTERNO').length;
  const con_n  = rows.filter(r => r.tipo_registro === 'CONSIGNACIÓN').length;

  // Ganancias reales (vendidos)
  const ganReal = rows
    .filter(r => r.estado === 'Vendido' && r.tipo_registro === 'INTERNO')
    .reduce((s, r) => s + parseInt(r.ganancia || 0), 0);
  const comisReal = rows
    .filter(r => r.estado === 'Vendido' && r.tipo_registro === 'CONSIGNACIÓN')
    .reduce((s, r) => s + parseInt(r.comision_monto || 0), 0);

  // ── POSIBLES GANANCIAS (no vendidos) ──────────────────────────────────────
  // Internos: precio_colab - precio_compra
  const posGanInterno = rows
    .filter(r => r.estado !== 'Vendido' && r.tipo_registro === 'INTERNO')
    .reduce((s, r) => {
      const colab  = parseInt(r.precio_venta_colaboradores || 0);
      const compra = parseInt(r.precio_compra || 0);
      return s + Math.max(0, colab - compra);
    }, 0);

  // Consignaciones: precio_pedido * comision_porcentaje / 100
  const posComisConsig = rows
    .filter(r => r.estado !== 'Vendido' && r.tipo_registro === 'CONSIGNACIÓN')
    .reduce((s, r) => {
      const pedido = parseInt(r.precio_pedido || 0);
      const pct    = parseFloat(r.comision_porcentaje || 5);
      return s + Math.round(pedido * pct / 100);
    }, 0);

  const totalPosible = posGanInterno + posComisConsig;

  const strip = document.getElementById('statsStrip');
  if (!strip) return;

  strip.innerHTML = `
    <span style="color:var(--blue)">📦 Stock: ${stock}</span>
    <span style="color:var(--yellow)">📢 Pub: ${pub}</span>
    <span style="color:var(--purple)">🔒 Res: ${res}</span>
    <span style="color:var(--green)">✅ Vend: ${vend}</span>
    <span style="color:var(--border3)">│</span>
    <span style="color:#00AEEF">🏢 Int: ${int_n}</span>
    <span style="color:#F1C40F">🤝 Consig: ${con_n}</span>
    <span style="color:var(--border3)">│</span>
    <span style="color:var(--green)" title="Ganancia real de ventas cerradas">💰 Ganancia: ${clp(ganReal + comisReal)}</span>
    <span style="color:var(--border3)">│</span>
    <span style="color:#1ABC9C" title="Suma de posibles ganancias + comisiones si se vende todo el stock actual"
          style="cursor:help">
      ✨ Posible ganancia en stock: <strong>${clp(totalPosible)}</strong>
      <small style="color:var(--gray3)">(${clp(posGanInterno)} int. + ${clp(posComisConsig)} consig.)</small>
    </span>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  ALERTAS
// ════════════════════════════════════════════════════════════════════════════
function renderAlerts(rows) {
  const strip = document.getElementById('alertStrip');
  if (!strip) return;
  const crit = rows.filter(r => r.estado !== 'Vendido' && parseInt(r.dias_en_stock || 0) >= 60).length;
  const warn = rows.filter(r => r.estado !== 'Vendido' && parseInt(r.dias_en_stock || 0) >= 30 && parseInt(r.dias_en_stock || 0) < 60).length;
  strip.innerHTML = '';
  if (crit) strip.innerHTML += `<div class="alert-strip alert-critical">🔴 ${crit} vehículo${crit > 1 ? 's' : ''} con más de 60 días en stock</div>`;
  if (warn) strip.innerHTML += `<div class="alert-strip alert-warning">🟡 ${warn} vehículo${warn > 1 ? 's' : ''} con más de 30 días sin vender</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════════════════════════════════
function onTipoChange() {
  const tipo     = getSelectedTipo();
  const esConsig = tipo === 'CONSIGNACIÓN';
  document.getElementById('seccionConsig').style.display  = esConsig ? '' : 'none';
  document.getElementById('preciosInterno').style.display = esConsig ? 'none' : '';
  document.getElementById('preciosConsig').style.display  = esConsig ? '' : 'none';
  // Limpiar previews al cambiar tipo
  ['comisPreview','ganPreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  // Re-enganchar listeners al cambiar tipo
  setupAutoCalc();
}

function updateModelos() {
  const marca   = document.getElementById('f_marca')?.value || '';
  const dl      = document.getElementById('modelosList');
  const modelos = (typeof MODELOS_SUGERIDOS !== 'undefined' && MODELOS_SUGERIDOS[marca]) || [];
  if (dl) dl.innerHTML = modelos.map(m => `<option value="${m}">`).join('');
}

function openModal() {
  editingId = null;
  const title = document.getElementById('modalTitle');
  if (title) title.textContent = '➕ Nuevo Vehículo';
  clearForm();
  const fi = document.getElementById('f_fingreso');
  if (fi) fi.value = today();
  document.getElementById('modal')?.classList.add('open');
  updateModelos();
}

function closeModal(e) {
  if (!e) document.getElementById('modal')?.classList.remove('open');
}

function clearForm() {
  const radio = document.querySelector('input[value="INTERNO"]');
  if (radio) { radio.checked = true; onTipoChange(); }

  const fields = ['f_patente','f_chasis','f_motor','f_color','f_km','f_modelo',
    'f_compra','f_colab','f_mercado','f_pventa','f_pventa_c',
    'f_pedido','f_minimo','f_notas','f_fpub','f_fventa',
    'f_nombre_prop','f_contacto_prop','f_rut_prop','f_email_prop',
    'f_notas_internas','f_desc_publica','f_precio_vitrina',
    'f_permiso_circ_vence','f_soap_vence','f_revision_tec_vence',
    'cot_precio'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const estado = document.getElementById('f_estado');
  if (estado) estado.value = 'En Stock';
  const duenos = document.getElementById('f_duenos');
  if (duenos) duenos.value = '1';
  const cpct = document.getElementById('f_cpct');
  if (cpct) cpct.value = '5.0';

  switchTab('datos', document.getElementById('tab-datos'));

  ['comisPreview','ganPreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function fillForm(r) {
  // sv para texto normal; svN para inputs numéricos con formato de puntos chileno
  const sv  = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  const svN = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    const n = parseInt(v);
    el.value = (!v && v !== 0) ? '' : (isNaN(n) ? '' : n.toLocaleString('es-CL'));
  };

  const radio = document.querySelector(`input[value="${r.tipo_registro || 'INTERNO'}"]`);
  if (radio) { radio.checked = true; onTipoChange(); }

  sv('f_nombre_prop',   r.nombre_propietario);
  sv('f_contacto_prop', r.contacto_propietario);
  sv('f_rut_prop',      r.rut_propietario || '');
  sv('f_email_prop',    r.email_propietario || '');
  sv('f_patente',       r.patente);
  sv('f_chasis',        r.chasis);
  sv('f_marca',         r.marca);
  sv('f_anio',          r.anio);
  sv('f_tipo',          r.tipo_vehiculo);
  sv('f_modelo',        r.modelo);
  sv('f_color',         r.color);
  sv('f_motor',         r.motor);
  sv('f_transmision',   r.transmision);
  sv('f_traccion',      r.traccion || 'Delantera (FWD)');
  sv('f_combustible',   r.combustible);
  svN('f_km',            r.km_aprox || r.km);
  sv('f_duenos',         r.cantidad_duenos || '1');
  svN('f_compra',        r.precio_compra);
  svN('f_colab',         r.precio_venta_colaboradores);
  svN('f_mercado',       r.valor_mercado);
  svN('f_pventa',        r.precio_venta_final);
  svN('f_pedido',        r.precio_pedido);
  svN('f_minimo',        r.precio_minimo);
  sv('f_cpct',           r.comision_porcentaje || '5.0');
  svN('f_pventa_c',      r.precio_venta_final);
  sv('f_estado',        r.estado);
  sv('f_fingreso',      r.fecha_ingreso);
  sv('f_fpub',          r.fecha_publicacion);
  sv('f_fventa',        r.fecha_venta);
  sv('f_notas',         r.notas);
  sv('f_notas_internas',   r.notas_internas   || '');
  sv('f_desc_publica',     r.descripcion_publica || '');
  svN('f_precio_vitrina',  r.precio_vitrina);
  { const ta = document.getElementById('f_notas_internas'); if (ta) updateNotasCount(ta); }
  sv('f_permiso_circ_vence', r.fecha_permiso_circ || '');
  sv('f_soap_vence',         r.fecha_soap || '');
  sv('f_revision_tec_vence', r.fecha_revision_tec || '');
  showConsigAcciones(r);
  // Reset tab a Datos
  switchTab('datos', document.getElementById('tab-datos'));

  updateModelos();
  setTimeout(recalcModal, 100);
}

function getFormData() {
  const g  = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const gn = id => parseInt(g(id).replace(/\D/g, '')) || 0;
  const tipo     = getSelectedTipo();
  const esConsig = tipo === 'CONSIGNACIÓN';

  return {
    tipo_registro:               tipo,
    nombre_propietario:          g('f_nombre_prop'),
    contacto_propietario:        g('f_contacto_prop'),
    rut_propietario:             g('f_rut_prop'),
    email_propietario:           g('f_email_prop'),
    patente:                     g('f_patente').toUpperCase(),
    chasis:                      g('f_chasis').toUpperCase(),
    marca:                       g('f_marca'),
    anio:                        parseInt(g('f_anio')) || 2024,
    tipo_vehiculo:               g('f_tipo'),
    modelo:                      g('f_modelo'),
    color:                       g('f_color'),
    motor:                       g('f_motor'),
    transmision:                 g('f_transmision'),
    traccion:                    g('f_traccion'),
    combustible:                 g('f_combustible'),
    km_aprox:                    gn('f_km'),
    cantidad_duenos:             parseInt(g('f_duenos')) || 1,
    precio_compra:               esConsig ? 0 : gn('f_compra'),
    precio_venta_colaboradores:  esConsig ? 0 : gn('f_colab'),
    valor_mercado:               esConsig ? 0 : gn('f_mercado'),
    precio_venta_final:          esConsig ? gn('f_pventa_c') : gn('f_pventa'),
    precio_pedido:               esConsig ? gn('f_pedido') : 0,
    precio_minimo:               esConsig ? gn('f_minimo')  : 0,
    comision_porcentaje:         esConsig ? (parseFloat(g('f_cpct')) || 5) : 0,
    comision_monto:              0,
    estado:                      g('f_estado'),
    fecha_ingreso:               g('f_fingreso') || today(),
    fecha_publicacion:           g('f_fpub'),
    fecha_venta:                 g('f_fventa'),
    notas:                       g('f_notas'),
    notas_internas:              g('f_notas_internas'),
    descripcion_publica:         g('f_desc_publica'),
    precio_vitrina:              parseInt(g('f_precio_vitrina').replace(/\D/g,'')) || 0,
    fecha_permiso_circ:          g('f_permiso_circ_vence'),
    fecha_soap:                  g('f_soap_vence'),
    fecha_revision_tec:          g('f_revision_tec_vence'),
  };
}

async function saveVehicle() {
  const data = getFormData();
  if (!data.modelo) { toast('El modelo es obligatorio', 'error'); return; }
  if (data.tipo_registro === 'CONSIGNACIÓN' && !data.nombre_propietario) {
    toast('El nombre del propietario es obligatorio para consignaciones', 'error'); return;
  }

  const url    = editingId ? `/api/inventario/${editingId}` : '/api/inventario';
  const method = editingId ? 'PUT' : 'POST';
  const result = await api(url, method, data);

  if (result.ok) {
    closeModal();
    await loadRows();
    toast(editingId ? '✅ Vehículo actualizado' : '✅ Vehículo agregado', 'success');
    editingId = null;
  } else {
    toast('Error: ' + (result.error || 'desconocido'), 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  ACCIONES DE TOOLBAR
// ════════════════════════════════════════════════════════════════════════════
function editSelected() {
  if (!selectedId) { toast('Selecciona un vehículo primero  (Ctrl+F para buscar)', 'warning'); return; }
  const row = allRows.find(r => r.id === selectedId);
  if (!row) return;
  editingId = selectedId;
  const title = document.getElementById('modalTitle');
  if (title) title.textContent = '✏️ Editar Vehículo';
  fillForm(row);
  document.getElementById('modal')?.classList.add('open');
}

async function deleteSelected() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const row = allRows.find(r => r.id === selectedId);
  const msg = `¿Eliminar ${row?.patente || ''} — ${row?.marca || ''} ${row?.modelo || ''}?\n\nEsta acción NO se puede deshacer.`;
  if (!confirm(msg)) return;
  const result = await api(`/api/inventario/${selectedId}`, 'DELETE');
  if (result.ok) {
    selectedId = null;
    const dp = document.getElementById('detailPanel');
    if (dp) dp.innerHTML = '<div class="detail-empty">Selecciona un vehículo<br>para ver los detalles</div>';
    await loadRows();
    toast('🗑️ Vehículo eliminado', 'warning');
  } else {
    toast('Error al eliminar', 'error');
  }
}

async function duplicateSelected() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const result = await api(`/api/inventario/${selectedId}/duplicate`, 'POST');
  if (result.ok) { await loadRows(); toast('⊕ Vehículo duplicado', 'info'); }
  else toast('Error al duplicar', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  VENTA RÁPIDA
// ════════════════════════════════════════════════════════════════════════════
function quickSell() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const row = allRows.find(r => r.id === selectedId);
  if (!row) return;
  if (row.estado === 'Vendido') { toast('Este vehículo ya fue vendido', 'warning'); return; }

  sellId = selectedId;
  const esConsig   = row.tipo_registro === 'CONSIGNACIÓN';
  const refPrecio  = esConsig
    ? `P. Pedido: ${clp(row.precio_pedido)} · P. Mínimo: ${clp(row.precio_minimo)}`
    : `P. Compra: ${clp(row.precio_compra)} · P. Colab.: ${clp(row.precio_venta_colaboradores)} · V. Mercado: ${clp(row.valor_mercado)}`;

  const ref = document.getElementById('sellRef');
  if (ref) ref.innerHTML = `
    <strong>${tipoBadge(row.tipo_registro)} ${row.patente || ''}</strong> · ${row.marca || ''} ${row.modelo || ''}<br>
    <small style="color:var(--gray2)">${refPrecio}</small>`;

  const sp = document.getElementById('s_precio');
  if (sp) sp.value = esConsig ? (row.precio_pedido || '') : (row.precio_venta_colaboradores || '');

  const sf = document.getElementById('s_fecha');
  if (sf) sf.value = today();

  const sg = document.getElementById('sellGanancia');
  if (sg) sg.textContent = '';

  calcGanancia();
  document.getElementById('modalSell')?.classList.add('open');
}

function calcGanancia() {
  const row = allRows.find(r => r.id === sellId);
  if (!row) return;
  const pv  = parseInt((document.getElementById('s_precio')?.value || '0').replace(/\D/g,'')) || 0;
  const el  = document.getElementById('sellGanancia');
  if (!el || pv <= 0) { if (el) el.textContent = ''; return; }

  const esConsig = row.tipo_registro === 'CONSIGNACIÓN';
  if (esConsig) {
    const pct = parseFloat(row.comision_porcentaje || 5);
    const com = Math.round(pv * pct / 100);
    el.style.color   = 'var(--green)';
    el.textContent   = `Comisión estimada (${pct}%): ${clp(com)}`;
  } else {
    const pc  = parseInt(row.precio_compra || 0);
    const gan = pv - pc;
    el.style.color = gan >= 0 ? 'var(--green)' : 'var(--red)';
    el.textContent = `Ganancia estimada: ${gan >= 0 ? '+' : ''}${clp(gan)}`;
  }
}

function closeSell(e) {
  if (!e) document.getElementById('modalSell')?.classList.remove('open');
}

async function confirmSell() {
  const precio = parseInt((document.getElementById('s_precio')?.value || '0').replace(/\D/g,'')) || 0;
  const fecha  = document.getElementById('s_fecha')?.value || '';
  if (precio <= 0) { toast('Ingresa un precio válido', 'error'); return; }
  const result = await api(`/api/inventario/${sellId}/sell`, 'POST',
    { precio_venta: precio, fecha_venta: fecha });
  if (result.ok) {
    closeSell();
    await loadRows();
    toast('🎉 ¡Venta registrada exitosamente!', 'success');
  } else {
    toast('Error: ' + result.error, 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  NOTIFICAR PROPIETARIO
// ════════════════════════════════════════════════════════════════════════════
let notifyRow = null;

function notificarPropietario() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const row = allRows.find(r => r.id === selectedId);
  if (!row) return;
  if (row.tipo_registro !== 'CONSIGNACIÓN') {
    toast('Esta función es solo para consignaciones', 'warning'); return;
  }
  if (!row.contacto_propietario && !row.telefono) {
    toast('Este registro no tiene número de contacto del propietario', 'warning'); return;
  }

  notifyRow = row;

  // Rellenar info del vehículo
  const info = document.getElementById('notifyVehicleInfo');
  if (info) info.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div><span style="color:var(--gray3)">Propietario:</span> <strong style="color:var(--white)">${row.nombre_propietario || '—'}</strong></div>
      <div><span style="color:var(--gray3)">Contacto:</span> <strong style="color:var(--green)">${row.contacto_propietario || row.telefono || '—'}</strong></div>
      <div><span style="color:var(--gray3)">Vehículo:</span> <strong style="color:var(--white)">${row.marca || ''} ${row.modelo || ''} ${row.anio || ''}</strong></div>
      <div><span style="color:var(--gray3)">Patente:</span> <strong style="color:var(--blue)">${row.patente || '—'}</strong></div>
      <div><span style="color:var(--gray3)">P. Pedido:</span> <strong style="color:var(--yellow)">${clp(row.precio_pedido)}</strong></div>
      <div><span style="color:var(--gray3)">P. Mínimo:</span> <strong style="color:var(--yellow)">${clp(row.precio_minimo)}</strong></div>
    </div>`;

  // Pre-rellenar teléfono
  const tel = document.getElementById('n_telefono');
  if (tel) {
    let num = (row.contacto_propietario || row.telefono || '').replace(/\s/g, '');
    // Normalizar a +56XXXXXXXXX
    if (num.startsWith('9') && num.length === 9) num = '+56' + num;
    if (num.startsWith('56') && !num.startsWith('+')) num = '+' + num;
    tel.value = num;
  }

  // Limpiar campos previos
  const monto = document.getElementById('n_monto');
  if (monto) monto.value = '';
  const vendedor = document.getElementById('n_vendedor');
  if (vendedor) vendedor.value = '';

  document.getElementById('msgPreview').textContent =
    'Ingresa el monto de la oferta para previsualizar el mensaje...';
  document.getElementById('modalNotify')?.classList.add('open');
  setTimeout(() => document.getElementById('n_monto')?.focus(), 100);
}

function generarMensaje() {
  if (!notifyRow) return '';
  const monto   = parseInt((document.getElementById('n_monto')?.value || '0').replace(/\D/g,'')) || 0;
  const vendedor= document.getElementById('n_vendedor')?.value.trim() || 'el equipo de VTA';
  const nombre  = (notifyRow.nombre_propietario || 'estimado/a').split(' ')[0];
  const vehiculo= `${notifyRow.marca || ''} ${notifyRow.modelo || ''} ${notifyRow.anio || ''}`.trim();
  const patente = notifyRow.patente || '—';
  const minimo  = parseInt(notifyRow.precio_minimo || 0);

  if (!monto) return '';

  const montoFmt = '$' + monto.toLocaleString('es-CL');
  const minimoFmt= minimo ? '$' + minimo.toLocaleString('es-CL') : null;

  return `Hola ${nombre}! Te saluda ${vendedor} de *Automotora VTA* \uD83D\uDE97

Tenemos buenas noticias: un cliente ha realizado una oferta por tu vehiculo *${vehiculo}*, patente *${patente}*.

*Monto ofertado: ${montoFmt}*
${minimoFmt ? `Tu precio minimo registrado: ${minimoFmt}` : ''}

Deseas *aceptar* o *rechazar* esta oferta?

Si estas de acuerdo, responde: *ACEPTAR*
Si no te convence, responde: *RECHAZAR*

Tambien puedes incluir un *precio de contraoferta* y lo registramos para seguir negociando sin bajar de ese monto.

Quedamos atentos. Gracias por confiar en VTA!`.trim();
}

function previewMensaje() {
  const msg = generarMensaje();
  const el  = document.getElementById('msgPreview');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.style.color = '#E8F5E9';
  } else {
    el.textContent = 'Ingresa el monto de la oferta para previsualizar el mensaje...';
    el.style.color = '#4A5568';
  }
}

function copiarMensaje() {
  const msg = generarMensaje();
  if (!msg) { toast('Ingresa el monto de la oferta primero', 'warning'); return; }
  navigator.clipboard.writeText(msg).then(() => {
    toast('✅ Mensaje copiado al portapapeles', 'success');
  }).catch(() => {
    toast('No se pudo copiar automáticamente', 'error');
  });
}

async function enviarNotificacion() {
  const msg    = generarMensaje();
  const telefono = document.getElementById('n_telefono')?.value.trim();

  if (!msg)     { toast('Ingresa el monto de la oferta primero', 'warning'); return; }
  if (!telefono){ toast('Ingresa el número de WhatsApp del propietario', 'warning'); return; }

  // Normalizar número
  let num = telefono.replace(/\s|-|\(|\)/g, '');
  if (!num.startsWith('+')) num = '+' + num;

  try {
    const result = await api('/api/crm/enviar_directo', 'POST', {
      telefono: num,
      mensaje:  msg,
    });

    if (result.ok) {
      closeNotify();
      toast(`📲 Mensaje enviado a ${notifyRow.nombre_propietario}`, 'success');
    } else {
      // Si la API falla, ofrecer fallback con link de WhatsApp Web
      const encoded = encodeURIComponent(msg);
      const waLink  = `https://wa.me/${num.replace('+','')}?text=${encoded}`;
      toast('API no disponible — abriendo WhatsApp Web', 'warning');
      setTimeout(() => window.open(waLink, '_blank'), 800);
    }
  } catch(e) {
    // Fallback: abrir WhatsApp Web directamente
    const encoded = encodeURIComponent(msg);
    const waLink  = `https://wa.me/${num.replace('+','')}?text=${encoded}`;
    window.open(waLink, '_blank');
    toast('Abriendo WhatsApp Web con el mensaje preparado', 'info');
  }
}

function closeNotify() {
  document.getElementById('modalNotify')?.classList.remove('open');
  notifyRow = null;
}

// ════════════════════════════════════════════════════════════════════════════
//  VALIDACIÓN RUT — autónomo, via backend Flask
// ════════════════════════════════════════════════════════════════════════════
function onRUTInput(el) {
  // Guardar posición del cursor
  const pos = el.selectionStart;
  const prevLen = el.value.length;

  // Limpiar: solo números y K
  let clean = el.value.replace(/[^0-9kK]/g, '').toUpperCase();

  // Formatear en tiempo real si hay suficientes caracteres
  if (clean.length > 1) {
    const num = clean.slice(0, -1);
    const dv  = clean.slice(-1);
    const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = formatted + '-' + dv;
  } else {
    el.value = clean;
  }

  // Restaurar posición aproximada del cursor
  const diff = el.value.length - prevLen;
  el.setSelectionRange(pos + diff, pos + diff);

  el.style.borderColor = '';
  const msg = el.parentElement?.querySelector('.rut-msg');
  if (msg) msg.textContent = '';
  const res = document.getElementById('rut_result');
  if (res) res.textContent = '';
}

async function onRUTBlur(el) {
  const rut = el.value.trim();
  if (!rut) return;

  const msg = el.parentElement?.querySelector('.rut-msg')
    || (() => {
        const m = document.createElement('small');
        m.className = 'rut-msg';
        m.style.cssText = 'font-size:10px;margin-top:2px;display:block';
        el.parentElement?.appendChild(m);
        return m;
      })();

  msg.style.color = 'var(--gray2)';
  msg.textContent = '🔍 Validando...';

  try {
    const data = await api(`/api/validar-rut?rut=${encodeURIComponent(rut)}`);

    if (data.valid) {
      el.value             = data.rut_formateado;
      el.style.borderColor = 'var(--green)';
      msg.style.color      = 'var(--green)';
      msg.textContent      = `✓ RUT válido · ${data.tipo === 'empresa' ? '🏢 Empresa' : '👤 Persona natural'}`;

      const resEl = document.getElementById('rut_result');
      if (resEl) {
        let html = '';
        if (data.nombre) {
          html += `<div style="color:var(--green);font-weight:700;font-size:12px;margin-bottom:6px">
            ${data.tipo === 'empresa' ? '🏢' : '👤'} ${data.nombre}
          </div>`;
          // Auto-rellenar nombre
          const nombreEl = document.getElementById('f_nombre_prop');
          if (nombreEl && !nombreEl.value.trim()) nombreEl.value = data.nombre;
        }
        if (data.actividad_sii) {
          html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">`;
          if (data.giro) html += `
            <div style="background:var(--card3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--gray3)">GIRO / ACTIVIDAD</div>
              <div style="font-size:10px;color:var(--gray1)">${data.giro}</div>
            </div>`;
          if (data.actividad_sii) html += `
            <div style="background:var(--card3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--gray3)">ACTIVIDAD SII</div>
              <div style="font-size:10px;color:var(--gray1)">${data.actividad_sii}</div>
            </div>`;
          if (data.inicio_actividades) html += `
            <div style="background:var(--card3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--gray3)">INICIO ACTIVIDADES</div>
              <div style="font-size:10px;color:var(--gray1)">${data.inicio_actividades}</div>
            </div>`;
          if (data.estado_sii) html += `
            <div style="background:var(--card3);border-radius:6px;padding:5px 8px">
              <div style="font-size:9px;color:var(--gray3)">ESTADO SII</div>
              <div style="font-size:10px;color:${data.estado_sii==='ACTIVO'?'var(--green)':'var(--yellow)'}">${data.estado_sii}</div>
            </div>`;
          html += `</div>`;
        }
        if (!data.nombre && !data.actividad_sii) {
          html = `<span style="color:var(--gray3)">RUT válido · sin datos en SII (persona natural sin inicio de actividades)</span>`;
        }
        // Nota sobre DICOM
        html += `<div style="margin-top:8px;padding:6px 8px;background:var(--card2);border-radius:6px;font-size:10px;color:var(--gray3)">
          ℹ️ La consulta DICOM/morosidad requiere autorización del titular (Ley 20.575 Chile)
        </div>`;
        resEl.innerHTML = html;
      }
    } else {
      el.style.borderColor = 'var(--red)';
      msg.style.color   = 'var(--red)';
      msg.textContent   = `✕ RUT inválido — dígito esperado: ${data.dv_esperado || '?'}`;
    }
  } catch(e) {
    msg.style.color = 'var(--yellow)';
    msg.textContent = '⚠️ No se pudo validar';
  }
}

async function buscarNombreRUT(rut) {
  if (!rut?.trim()) return;
  const el = document.getElementById('f_rut_prop');
  if (el) await onRUTBlur(el);
}

// ════════════════════════════════════════════════════════════════════════════
//  TABS DEL MODAL
// ════════════════════════════════════════════════════════════════════════════
function switchTab(tab, btn) {
  ['tabDatos','tabFotos','tabPub','tabRentabilidad','tabHistorial','tabNotas','tabVoz'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
  const map = {
    datos:'tabDatos', fotos:'tabFotos', pub:'tabPub',
    rentabilidad:'tabRentabilidad', historial:'tabHistorial',
    notas:'tabNotas', voz:'tabVoz',
  };
  const el = document.getElementById(map[tab]);
  if (el) el.style.display = '';
  if (btn) btn.classList.add('active');
  if (tab === 'fotos' && editingId) loadFotos(editingId);
}

// ════════════════════════════════════════════════════════════════════════════
//  IA DESCRIPCIÓN — Gemini via Flask
// ════════════════════════════════════════════════════════════════════════════
function _readFormVehicle() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  return {
    marca:           g('f_marca'),
    modelo:          g('f_modelo'),
    anio:            g('f_anio'),
    color:           g('f_color'),
    km_aprox:        g('f_km'),
    transmision:     g('f_transmision'),
    combustible:     g('f_combustible'),
    traccion:        g('f_traccion'),
    motor:           g('f_motor'),
    cantidad_duenos: g('f_duenos'),
    notas:           g('f_notas'),
  };
}

async function generarDescripcionIA(tono) {
  const status   = document.getElementById('iaDescStatus');
  const textarea = document.getElementById('f_desc_publica');
  if (!status || !textarea) return;

  status.textContent = '🤖 Generando con Gemini...';
  status.style.color = 'var(--blue)';

  const payload = editingId
    ? { doc_id: editingId, tono }
    : { tono, ..._readFormVehicle() };

  try {
    const resp = await fetch('/api/ai/descripcion', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const r = await resp.json();

    if (r.ok) {
      textarea.value     = r.descripcion;
      status.style.color = 'var(--green)';
      status.textContent = '✅ Descripción generada — revisa y edita si quieres';
    } else {
      status.style.color = 'var(--red)';
      status.textContent = '❌ ' + (r.error || 'Sin API key — configura Gemini en ⚙️');
    }
  } catch(e) {
    status.style.color = 'var(--red)';
    status.textContent = '❌ Error de conexión';
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  DESCARGAR FOTOS EN ZIP — JSZip
// ════════════════════════════════════════════════════════════════════════════
async function downloadFotosZIP() {
  if (!editingId) return;
  toast('⏳ Preparando ZIP...', 'info');

  // Cargar JSZip dinámicamente
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const fotos = await api(`/api/inventario/${editingId}/fotos`);
  if (!fotos.length) { toast('Sin fotos para descargar', 'warning'); return; }

  const zip    = new JSZip();
  const folder = zip.folder('fotos_VTA');
  fotos.forEach((f, i) => {
    const b64  = f.foto.split(',')[1] || f.foto;
    const nombre = `foto_${String(i+1).padStart(2,'0')}.jpg`;
    folder.file(nombre, b64, { base64: true });
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `VTA_fotos_${editingId}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✅ ZIP con ${fotos.length} fotos descargado`, 'success');
}

// ════════════════════════════════════════════════════════════════════════════
//  MARCA DE AGUA — Canvas API
// ════════════════════════════════════════════════════════════════════════════
async function aplicarMarcaAgua() {
  if (!editingId) return;
  if (!confirm('¿Aplicar marca de agua VTA a TODAS las fotos de este auto?\nEsto reemplaza las fotos actuales.')) return;

  const fotos = await api(`/api/inventario/${editingId}/fotos`);
  if (!fotos.length) { toast('Sin fotos', 'warning'); return; }

  toast(`💧 Aplicando marca de agua a ${fotos.length} fotos...`, 'info');

  // Cargar logo VTA
  const logo   = await loadImage('/static/assets/logo.png').catch(() => null);
  let procesadas = 0;

  for (const f of fotos) {
    try {
      const img  = await loadImage(f.foto);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx  = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      if (logo) {
        // Logo en esquina inferior derecha, 18% del ancho
        const lw   = img.width * 0.18;
        const lh   = lw * (logo.height / logo.width);
        const lx   = img.width  - lw - img.width  * 0.02;
        const ly   = img.height - lh - img.height * 0.02;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(logo, lx, ly, lw, lh);
        ctx.globalAlpha = 1;
      } else {
        // Texto si no hay logo
        const fs = Math.max(16, img.width * 0.035);
        ctx.font      = `bold ${fs}px Arial`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'right';
        ctx.fillText('VTA Automotora', img.width * 0.97, img.height * 0.97);
      }

      const b64 = canvas.toDataURL('image/jpeg', 0.88);
      await api(`/api/inventario/${editingId}/fotos/${f.id}`, 'PUT', { foto: b64 });
      procesadas++;
    } catch(e) { console.warn('Error en foto', f.id, e); }
  }

  _fotosCache.delete(editingId);
  await loadFotos(editingId, true);
  toast(`✅ Marca de agua aplicada a ${procesadas} fotos`, 'success');
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  CONSIGNACIÓN — Regenerar contrato + Email
// ════════════════════════════════════════════════════════════════════════════
function regenerarContrato() {
  if (!editingId) return;
  const precio   = document.getElementById('regen_precio')?.value;
  const comision = document.getElementById('regen_comision')?.value;
  let url = `/admin/consignacion/contrato?id=${editingId}`;
  if (precio)   url += `&precio_pub=${precio}`;
  if (comision) url += `&comision_pct=${comision}`;
  window.open(url, '_blank');
}

async function enviarEmailContrato() {
  if (!editingId) return;
  const status = document.getElementById('emailStatus');
  status.style.color   = 'var(--gray2)';
  status.textContent   = '📧 Enviando...';
  const r = await api('/api/consignacion/enviar-email', 'POST', { id: editingId });
  if (r.ok) {
    status.style.color = 'var(--green)';
    status.textContent = '✅ Contrato enviado al email del cliente';
  } else {
    status.style.color = 'var(--red)';
    status.textContent = '❌ ' + (r.error || 'Error al enviar');
  }
}

// Mostrar sección de consignación solo si es CONSIGNACIÓN
const _origFillForm = typeof fillForm === 'function' ? fillForm : null;
function showConsigAcciones(r) {
  const el = document.getElementById('consigAcciones');
  if (el) el.style.display = r.tipo_registro === 'CONSIGNACIÓN' ? '' : 'none';
}

// ════════════════════════════════════════════════════════════════════════════
//  SISTEMA DE FOTOS — Upload, Preview, Progreso, Reorder drag&drop
// ════════════════════════════════════════════════════════════════════════════
const _fotosCache = new Map();
let   _dragSrcEl  = null;

async function loadFotos(docId, forceRefresh = false) {
  if (!docId) return;
  const grid = document.getElementById('fotosGrid');
  const msg  = document.getElementById('fotosMsg');
  const hint = document.getElementById('fotosDragHint');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray3);font-size:11px">Cargando fotos…</div>';

  if (forceRefresh) _fotosCache.delete(docId);
  let fotos = _fotosCache.get(docId);
  if (!fotos) {
    fotos = await api(`/api/inventario/${docId}/fotos`);
    _fotosCache.set(docId, fotos || []);
  }

  if (!fotos || !fotos.length) {
    grid.innerHTML = '';
    if (msg) msg.style.display = 'block';
    if (hint) hint.style.display = 'none';
    return;
  }
  if (msg)  msg.style.display  = 'none';
  if (hint) hint.style.display = fotos.length > 1 ? 'block' : 'none';

  grid.innerHTML = fotos.map((f, i) => `
    <div class="foto-item${f.portada ? ' foto-portada' : ''}"
         data-id="${f.id}" data-orden="${i}"
         draggable="true"
         ondragstart="fotoDragStart(event)"
         ondragover="fotoDragOver(event)"
         ondrop="fotoDrop(event)"
         ondragend="fotoDragEnd()">
      <img src="${f.foto}" alt="foto ${i+1}"
           style="width:100%;height:110px;object-fit:cover;border-radius:8px;display:block;object-position:${f.object_position||'center center'}">
      <div class="foto-overlay">
        <button onclick="setFotoPortada('${f.id}')" title="${f.portada ? 'Portada actual' : 'Usar como portada'}"
                style="background:${f.portada ? '#f1c40f' : 'rgba(0,0,0,.65)'};border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:13px;line-height:1">
          ${f.portada ? '⭐' : '☆'}
        </button>
        <button onclick="deleteFoto('${f.id}')" title="Eliminar"
                style="background:rgba(160,0,0,.85);border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:12px;color:#fff;line-height:1">
          🗑
        </button>
      </div>
      ${f.portada ? '<div class="foto-badge-portada">PORTADA</div>' : ''}
      <div class="foto-drag-handle" title="Arrastra para reordenar">⠿</div>
    </div>`).join('');
}

// ── Upload ─────────────────────────────────────────────────────────────────
async function handleFotoInput(input) {
  const files = Array.from(input.files);
  input.value = '';
  if (!files.length || !editingId) return;
  await _uploadFiles(files);
}

async function handleDrop(event) {
  event.preventDefault();
  if (!editingId) return;
  const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  await _uploadFiles(files);
}

async function _uploadFiles(files) {
  const grid = document.getElementById('fotosGrid');
  const msg  = document.getElementById('fotosMsg');
  if (msg) msg.style.display = 'none';

  for (const file of files) {
    const pid = 'up_' + Math.random().toString(36).slice(2);
    // Insert preview card immediately
    const card = document.createElement('div');
    card.id        = pid;
    card.className = 'foto-item foto-uploading';
    card.innerHTML = `
      <div style="height:110px;background:var(--card2);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;position:relative;overflow:hidden">
        <div style="font-size:10px;color:var(--gray2);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%">${file.name}</div>
        <div style="width:100%;height:5px;background:var(--border2);border-radius:3px;overflow:hidden">
          <div id="${pid}_bar" style="height:100%;width:0%;background:var(--blue);border-radius:3px;transition:width .25s"></div>
        </div>
        <div id="${pid}_pct" style="font-size:10px;color:var(--gray3)">Comprimiendo…</div>
      </div>`;
    grid.insertBefore(card, grid.firstChild);

    const bar = document.getElementById(`${pid}_bar`);
    const pct = document.getElementById(`${pid}_pct`);

    try {
      bar.style.width = '15%';
      const b64 = await _compressImage(file, 1400, 0.84);
      bar.style.width = '40%';
      pct.textContent = 'Subiendo…';

      // Replace inner content with actual preview + overlay bar
      card.innerHTML = `
        <div style="position:relative;border-radius:8px;overflow:hidden">
          <img src="${b64}" style="width:100%;height:110px;object-fit:cover;display:block;opacity:.55">
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:8px">
            <div style="width:100%;height:5px;background:rgba(0,0,0,.35);border-radius:3px;overflow:hidden">
              <div id="${pid}_bar2" style="height:100%;width:40%;background:#00AEEF;border-radius:3px;transition:width .3s"></div>
            </div>
            <div id="${pid}_pct2" style="font-size:10px;color:#fff;font-weight:700;margin-top:4px;text-shadow:0 1px 2px rgba(0,0,0,.8)">Subiendo…</div>
          </div>
        </div>`;

      const bar2 = document.getElementById(`${pid}_bar2`);
      const pct2 = document.getElementById(`${pid}_pct2`);
      if (bar2) bar2.style.width = '70%';

      const res = await api(`/api/inventario/${editingId}/fotos`, 'POST', { foto: b64, nombre: file.name });

      if (res && res.ok) {
        if (bar2) bar2.style.width = '100%';
        if (pct2) pct2.textContent = '✓ Listo';
        await new Promise(r => setTimeout(r, 350));
        _fotosCache.delete(editingId);
        card.remove();
        await loadFotos(editingId);
      } else {
        card.innerHTML = `<div style="height:110px;display:flex;align-items:center;justify-content:center;color:var(--red);font-size:10px;text-align:center;padding:8px">Error:<br>${res?.error || 'falló'}</div>`;
      }
    } catch (e) {
      card.remove();
      toast('Error al subir foto: ' + e.message, 'error');
    }
  }
}

function _compressImage(file, maxPx = 1400, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else                { width  = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Acciones por foto ──────────────────────────────────────────────────────
async function setFotoPortada(fotoId) {
  if (!editingId) return;
  const r = await api(`/api/inventario/${editingId}/fotos/${fotoId}/portada`, 'POST');
  if (r.ok) { _fotosCache.delete(editingId); await loadFotos(editingId); toast('Portada actualizada ⭐', 'success'); }
}

async function deleteFoto(fotoId) {
  if (!editingId || !confirm('¿Eliminar esta foto?')) return;
  const r = await api(`/api/inventario/${editingId}/fotos/${fotoId}`, 'DELETE');
  if (r.ok) { _fotosCache.delete(editingId); await loadFotos(editingId); toast('Foto eliminada', 'success'); }
}

// ── Drag & Drop reorder ────────────────────────────────────────────────────
function fotoDragStart(e) {
  _dragSrcEl = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.35';
}

function fotoDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (!target || target === _dragSrcEl || target.classList.contains('foto-uploading')) return;
  const grid  = document.getElementById('fotosGrid');
  const items = [...grid.querySelectorAll('.foto-item:not(.foto-uploading)')];
  const si    = items.indexOf(_dragSrcEl);
  const ti    = items.indexOf(target);
  if (si < ti) grid.insertBefore(_dragSrcEl, target.nextSibling);
  else          grid.insertBefore(_dragSrcEl, target);
}

function fotoDrop(e) { e.stopPropagation(); return false; }

async function fotoDragEnd() {
  if (_dragSrcEl) _dragSrcEl.style.opacity = '1';
  _dragSrcEl = null;
  const items    = [...document.querySelectorAll('#fotosGrid .foto-item:not(.foto-uploading)')];
  const newOrder = items.map(el => el.dataset.id).filter(Boolean);
  if (newOrder.length > 1) {
    await api(`/api/inventario/${editingId}/fotos/reorder`, 'POST', { order: newOrder });
    _fotosCache.delete(editingId);
    await loadFotos(editingId);
    toast('Orden guardado', 'success');
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  RENTABILIDAD (P&L)
// ════════════════════════════════════════════════════════════════════════════
async function cargarPNL() {
  if (!editingId) return;
  const loading = document.getElementById('pnlLoading');
  const content = document.getElementById('pnlContent');
  if (loading) loading.style.display = '';
  if (content) content.style.display = 'none';

  try {
    const data = await api(`/api/inventario/${editingId}/pnl`);
    if (!data.ok) { if (loading) loading.textContent = 'No disponible.'; return; }

    const fmt = n => (n || 0).toLocaleString('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0});
    const esConsig = data.tipo_registro === 'CONSIGNACIÓN';

    const resumen = document.getElementById('pnlResumen');
    if (resumen) {
      const gan    = esConsig ? data.comision_monto : data.ganancia_neta;
      const ganClr = gan > 0 ? 'var(--green)' : gan < 0 ? 'var(--red)' : 'var(--gray2)';
      resumen.innerHTML = [
        esConsig
          ? `<div class="pnl-card"><div class="pnl-label">Precio Pedido</div><div class="pnl-val">${fmt(data.precio_compra)}</div></div>`
          : `<div class="pnl-card"><div class="pnl-label">Precio Compra</div><div class="pnl-val">${fmt(data.precio_compra)}</div></div>`,
        `<div class="pnl-card"><div class="pnl-label">Precio Venta Final</div><div class="pnl-val" style="color:var(--blue)">${data.precio_venta > 0 ? fmt(data.precio_venta) : '—'}</div></div>`,
        `<div class="pnl-card"><div class="pnl-label">Gastos vinculados</div><div class="pnl-val" style="color:var(--red)">${data.gastos_vinculados > 0 ? '-'+fmt(data.gastos_vinculados) : '$0'}</div></div>`,
        esConsig
          ? `<div class="pnl-card" style="border-color:${ganClr}"><div class="pnl-label">Comisión (${data.comision_pct}%)</div><div class="pnl-val" style="color:${ganClr}">${fmt(gan)}</div></div>`
          : `<div class="pnl-card" style="border-color:${ganClr}"><div class="pnl-label">Ganancia Neta</div><div class="pnl-val" style="color:${ganClr}">${fmt(gan)}</div></div>`,
      ].join('');
    }

    const gauge = document.getElementById('pnlGauge');
    if (gauge && !esConsig && data.precio_compra > 0 && data.precio_venta > 0) {
      const margen = ((data.ganancia_neta / data.precio_venta) * 100).toFixed(1);
      const barPct = Math.min(100, Math.max(0, parseFloat(margen)));
      const barClr = barPct >= 10 ? 'var(--green)' : barPct >= 5 ? 'var(--yellow)' : 'var(--red)';
      gauge.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:700;color:var(--gray2)">Margen de ganancia</span>
          <span style="font-size:16px;font-weight:800;color:${barClr}">${margen}%</span>
        </div>
        <div style="height:6px;background:var(--card3);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${barPct}%;background:${barClr};border-radius:3px;transition:width .5s"></div>
        </div>`;
    } else if (gauge) {
      gauge.style.display = 'none';
    }

    const transDiv = document.getElementById('pnlTransacciones');
    if (transDiv) {
      if (data.transacciones && data.transacciones.length > 0) {
        transDiv.innerHTML = data.transacciones.map(t => {
          const clr = t.tipo === 'ingreso' ? 'var(--green)' : t.tipo === 'costo' ? 'var(--red)' : 'var(--blue)';
          const sign = t.tipo === 'ingreso' ? '+' : t.tipo === 'costo' ? '-' : '';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--card2);border-radius:6px;margin-bottom:5px;font-size:11px">
            <div>
              <span style="color:${clr};font-weight:700;text-transform:uppercase;font-size:9px;margin-right:6px">${t.tipo}</span>
              <span style="color:var(--text1)">${t.descripcion || '—'}</span>
              <span style="color:var(--gray3);font-size:10px;margin-left:6px">${(t.fecha||'').slice(0,10)}</span>
            </div>
            <span style="color:${clr};font-weight:700">${sign}${fmt(t.monto)}</span>
          </div>`;
        }).join('');
      } else {
        transDiv.textContent = 'Sin transacciones vinculadas.';
      }
    }

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = '';
  } catch(e) {
    if (loading) loading.textContent = 'Error cargando datos.';
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  HISTORIAL DE CAMBIOS
// ════════════════════════════════════════════════════════════════════════════
async function cargarHistorial() {
  if (!editingId) return;
  const loading = document.getElementById('historialLoading');
  const content = document.getElementById('historialContent');
  if (loading) loading.style.display = '';
  if (content) content.style.display = 'none';

  try {
    const logs = await api(`/api/inventario/${editingId}/historial`);
    const list = document.getElementById('historialList');
    if (list) {
      if (Array.isArray(logs) && logs.length > 0) {
        const iconos = { CREAR: '🟢', EDITAR: '✏️', ELIMINAR: '🔴' };
        list.innerHTML = logs.map(l => `
          <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:var(--card2);border-radius:8px;margin-bottom:6px;font-size:11px">
            <span style="font-size:16px;flex-shrink:0">${iconos[l.accion] || '📝'}</span>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="color:var(--text1)">${l.accion || '—'}</strong>
                <span style="color:var(--gray3);font-size:10px">${(l.fecha||'').slice(0,16).replace('T',' ')}</span>
              </div>
              <div style="color:var(--gray2);margin-top:2px">${l.detalle || ''}</div>
              <div style="color:var(--gray3);font-size:10px;margin-top:2px">Por: <strong>${l.usuario || '—'}</strong></div>
            </div>
          </div>`).join('');
      } else {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray3)">Sin registros de cambios</div>';
      }
    }
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = '';
  } catch(e) {
    if (loading) loading.textContent = 'Error cargando historial.';
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  COTIZADOR PDF
// ════════════════════════════════════════════════════════════════════════════
function abrirCotizacion() {
  if (!editingId) { toast('Guarda el vehículo primero', 'warning'); return; }
  const precio  = document.getElementById('cot_precio')?.value || '';
  const validez = document.getElementById('cot_validez')?.value || '7';
  const params  = new URLSearchParams();
  if (precio) params.set('precio', precio);
  params.set('validez', validez);
  window.open(`/admin/inventario/${editingId}/cotizacion?${params}`, '_blank');
}

// ════════════════════════════════════════════════════════════════════════════
//  ALERTAS DE DOCUMENTOS
// ════════════════════════════════════════════════════════════════════════════
async function cargarAlertasDocs() {
  try {
    const data = await api('/api/inventario/alertas/documentos?dias=30');
    const strip = document.getElementById('alertDocs');
    if (!strip || !data.alertas || !data.alertas.length) return;

    const labels = {
      fecha_permiso_circ:   'Permiso Circulación',
      fecha_soap:           'SOAP',
      fecha_revision_tec:   'Revisión Técnica',
    };
    const vencidos   = data.alertas.filter(a => a.estado === 'vencido');
    const porVencer  = data.alertas.filter(a => a.estado === 'por_vencer');

    let html = '';
    if (vencidos.length) {
      const lista = vencidos.slice(0,3).map(a =>
        `${a.patente} ${labels[a.campo]||a.campo}`).join(', ');
      const extra = vencidos.length > 3 ? ` +${vencidos.length-3} más` : '';
      html += `<div class="alert-strip alert-critical">🔴 Documentos VENCIDOS: ${lista}${extra}</div>`;
    }
    if (porVencer.length) {
      const lista = porVencer.slice(0,3).map(a =>
        `${a.patente} ${labels[a.campo]||a.campo} (${a.fecha})`).join(', ');
      const extra = porVencer.length > 3 ? ` +${porVencer.length-3} más` : '';
      html += `<div class="alert-strip alert-warning">⚠️ Documentos por vencer: ${lista}${extra}</div>`;
    }
    strip.innerHTML = html;
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════════════════════
//  PRECIO DE MERCADO (Chileautos scraper)
// ════════════════════════════════════════════════════════════════════════════
async function buscarPrecioMercado() {
  const row = allRows.find(r => r.id === editingId);
  const panel = document.getElementById('precioMercadoPanel');
  if (!panel) return;

  const marca  = (row?.marca  || document.getElementById('f_marca')?.value  || '').trim();
  const modelo = (row?.modelo || document.getElementById('f_modelo')?.value || '').trim();
  const anio   = (row?.anio   || document.getElementById('f_anio')?.value   || '').trim();

  if (!marca || !modelo) {
    panel.style.display = 'block';
    panel.innerHTML = `<div style="font-size:11px;color:var(--red)">
      Guarda el vehículo con marca y modelo antes de buscar precios.</div>`;
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = `<div style="font-size:11px;color:var(--gray3);padding:10px 0">
    🔍 Buscando precios de <strong>${marca} ${modelo} ${anio}</strong>...</div>`;

  try {
    const qs  = new URLSearchParams({ marca, modelo, anio });
    const res = await fetch(`/api/inventario/precio-mercado?${qs}`);
    const d   = await res.json();

    if (!d.ok) {
      panel.innerHTML = `<div style="font-size:11px;color:var(--red)">${d.error || 'Error al buscar'}</div>`;
      return;
    }

    if (d.fallback) {
      panel.innerHTML = `
        <div style="font-size:11px;color:var(--gray2);margin-bottom:8px">
          No se pudieron obtener precios automáticamente. Busca manualmente:
        </div>
        <div style="display:flex;gap:8px">
          <a href="${d.urls.chileautos}" target="_blank" class="btn btn-secondary"
             style="font-size:10px;padding:5px 12px">🌐 Chileautos</a>
          <a href="${d.urls.yapo}" target="_blank" class="btn btn-secondary"
             style="font-size:10px;padding:5px 12px">🌐 Yapo</a>
        </div>`;
      return;
    }

    const fmt = n => n >= 1e6 ? '$'+(n/1e6).toFixed(2)+'M' : '$'+Math.round(n/1e3)+'K';
    const pvRow = row ? parseInt(row.precio_venta || 0) : 0;
    const vsMed = pvRow && d.mediana
      ? `<span style="color:${pvRow <= d.mediana ? '#27ae60':'#e74c3c'};font-size:10px;font-weight:700">
           ${pvRow <= d.mediana ? '▼ bajo mercado' : '▲ sobre mercado'}
         </span>` : '';

    panel.innerHTML = `
      <div style="background:var(--card2);border-radius:10px;padding:12px 14px;border:1px solid var(--border2)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text1)">
            ${marca} ${modelo} ${anio} · ${d.count} publicaciones
          </div>
          ${d.cached ? '<span style="font-size:9px;color:var(--gray3)">caché 24h</span>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
          <div style="text-align:center">
            <div style="font-size:9px;color:var(--gray3)">MÍNIMO</div>
            <div style="font-size:15px;font-weight:700;color:#27ae60">${fmt(d.minimo)}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:9px;color:var(--gray3)">MEDIANA</div>
            <div style="font-size:15px;font-weight:700;color:#00AEEF">${fmt(d.mediana)}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:9px;color:var(--gray3)">PROMEDIO</div>
            <div style="font-size:15px;font-weight:700;color:var(--text1)">${fmt(d.promedio)}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:9px;color:var(--gray3)">MÁXIMO</div>
            <div style="font-size:15px;font-weight:700;color:#e74c3c">${fmt(d.maximo)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${pvRow ? `<span style="font-size:10px;color:var(--gray2)">Tu precio: <strong>${fmt(pvRow)}</strong> ${vsMed}</span>` : ''}
          <a href="${d.url}" target="_blank"
             style="font-size:10px;color:var(--blue);text-decoration:none">Ver en Chileautos →</a>
        </div>
      </div>`;
  } catch(e) {
    panel.innerHTML = `<div style="font-size:11px;color:var(--red)">Error de red al buscar precios</div>`;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  NOTA DE VOZ — Web Speech API (transcripción en browser) + Claude (resumen)
// ════════════════════════════════════════════════════════════════════════════
let _recognition  = null;
let _recTimer     = null;
let _recSecs      = 0;
let _finalText    = '';
let _isRecording  = false;

function toggleRecording() {
  if (_isRecording) _stopRecording();
  else               _startRecording();
}

function _startRecording() {
  if (!editingId) { toast('Guarda el vehículo primero', 'warning'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Tu navegador no soporta reconocimiento de voz. Usa Chrome.', 'error'); return;
  }

  _finalText   = '';
  _isRecording = true;
  _recognition = new SR();
  _recognition.lang            = 'es-CL';
  _recognition.continuous      = true;
  _recognition.interimResults  = true;
  _recognition.maxAlternatives = 1;

  const stat   = document.getElementById('vozStatus');
  const liveEl = document.getElementById('vozLiveText');

  _recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) _finalText += t + ' ';
      else                           interim    += t;
    }
    if (liveEl) liveEl.textContent = _finalText + interim;
  };

  _recognition.onerror = (e) => {
    if (e.error !== 'no-speech') toast('Error de micrófono: ' + e.error, 'error');
  };

  _recognition.onend = () => {
    if (_isRecording) _recognition.start(); // reiniciar si no fue stop intencional
  };

  _recognition.start();

  // Timer
  _recSecs = 0;
  clearInterval(_recTimer);
  _recTimer = setInterval(() => {
    _recSecs++;
    const mm = String(Math.floor(_recSecs / 60)).padStart(2, '0');
    const ss = String(_recSecs % 60).padStart(2, '0');
    const timerEl = document.getElementById('vozTimer');
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;
  }, 1000);

  // UI
  const btn = document.getElementById('vozBtn');
  if (btn) { btn.style.background = '#3B0D0A'; btn.style.borderColor = '#e74c3c'; }
  document.getElementById('vozIcon')?.setAttribute('data', '⏹️');
  const icon = document.getElementById('vozIcon');     if (icon) icon.textContent = '⏹️';
  const lbl  = document.getElementById('vozBtnLabel'); if (lbl)  lbl.textContent = 'DETENER';
  const timer= document.getElementById('vozTimer');    if (timer) timer.style.display = 'block';
  if (stat) stat.textContent = '🎙️ Escuchando... habla con claridad';
  if (liveEl) { liveEl.style.display = 'block'; liveEl.textContent = ''; }
}

function _stopRecording() {
  _isRecording = false;
  if (_recognition) { _recognition.onend = null; _recognition.stop(); _recognition = null; }
  clearInterval(_recTimer);

  const btn  = document.getElementById('vozBtn');
  if (btn) { btn.style.background = ''; btn.style.borderColor = ''; }
  const icon = document.getElementById('vozIcon');     if (icon) icon.textContent = '🎙️';
  const lbl  = document.getElementById('vozBtnLabel'); if (lbl)  lbl.textContent = 'GRABAR';
  const timer= document.getElementById('vozTimer');    if (timer) timer.style.display = 'none';

  const texto = _finalText.trim();
  if (!texto) {
    const stat = document.getElementById('vozStatus');
    if (stat) stat.textContent = 'Sin texto detectado — intenta de nuevo';
    return;
  }
  _processVoiceNote(texto, _recSecs);
}

async function _processVoiceNote(texto, duracion) {
  const procEl = document.getElementById('vozProcesando');
  const stat   = document.getElementById('vozStatus');
  const liveEl = document.getElementById('vozLiveText');
  if (procEl) procEl.style.display = 'block';
  if (stat)   stat.textContent = '🤖 Claude analizando la nota...';
  if (liveEl) liveEl.style.display = 'none';
  try {
    const r = await fetch(`/api/inventario/${editingId}/notas-voz`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ transcripcion: texto, duracion }),
    });
    const d = await r.json();
    if (procEl) procEl.style.display = 'none';
    if (d.ok) {
      if (stat) stat.textContent = '✅ Nota guardada con resumen de Claude';
      cargarNotasVoz();
    } else {
      if (stat) stat.textContent = '❌ ' + (d.error || 'Error al procesar');
      toast('Error: ' + (d.error || ''), 'error');
    }
  } catch(e) {
    if (procEl) procEl.style.display = 'none';
    if (stat)   stat.textContent = '❌ Error de red';
    toast('Error de red al guardar nota', 'error');
  }
}

async function cargarNotasVoz() {
  if (!editingId) return;
  const lista = document.getElementById('vozNotesList');
  if (!lista) return;
  try {
    const notas = await api(`/api/inventario/${editingId}/notas-voz`);
    if (!notas || !notas.length) {
      lista.innerHTML = `<div style="color:var(--gray3);font-size:12px;text-align:center;padding:16px">
        Sin notas de voz para este vehículo</div>`;
      return;
    }
    lista.innerHTML = notas.map(n => {
      const fecha = (n.fecha || '').slice(0, 16).replace('T', ' ');
      const dur   = n.duracion_seg ? `${Math.floor(n.duracion_seg/60)}:${String(n.duracion_seg%60).padStart(2,'0')}` : '—';
      const tareas = (n.tareas || []).filter(Boolean);
      return `
        <div style="background:var(--card2);border-radius:12px;padding:14px 16px;border:1px solid var(--border2)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">🎙️</span>
              <div>
                <div style="font-size:11px;font-weight:600;color:var(--text1)">${escHtml(n.usuario || 'Sin usuario')}</div>
                <div style="font-size:9px;color:var(--gray3)">${fecha} · ${dur}</div>
              </div>
            </div>
            <button onclick="eliminarNotaVoz('${n.id}')"
              style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">🗑️</button>
          </div>

          ${n.transcripcion ? `
          <div style="margin-bottom:10px">
            <div style="font-size:9px;color:var(--gray3);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Transcripción</div>
            <div style="font-size:11px;color:var(--gray2);background:var(--card3);padding:8px 10px;border-radius:8px;line-height:1.5;max-height:100px;overflow-y:auto">
              ${escHtml(n.transcripcion)}
            </div>
          </div>` : ''}

          ${n.resumen ? `
          <div style="margin-bottom:8px">
            <div style="font-size:9px;color:var(--blue);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🤖 Resumen IA</div>
            <div style="font-size:11px;color:var(--text1);line-height:1.5">${escHtml(n.resumen)}</div>
          </div>` : ''}

          ${tareas.length ? `
          <div>
            <div style="font-size:9px;color:var(--yellow);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">✅ Tareas detectadas</div>
            ${tareas.map(t => `<div style="font-size:11px;color:var(--text1);padding:2px 0">· ${escHtml(t)}</div>`).join('')}
          </div>` : ''}
        </div>`;
    }).join('');
  } catch(e) {
    lista.innerHTML = `<div style="color:var(--red);font-size:12px">Error cargando notas</div>`;
  }
}

async function eliminarNotaVoz(notaId) {
  if (!confirm('¿Eliminar esta nota de voz?')) return;
  try {
    await fetch(`/api/inventario/${editingId}/notas-voz/${notaId}`, { method: 'DELETE' });
    cargarNotasVoz();
  } catch(e) { toast('Error al eliminar nota', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════════
//  PRECIO RECOMENDADO POR IA
// ════════════════════════════════════════════════════════════════════════════
async function pedirPrecioIA() {
  const panel = document.getElementById('precioIAPanel');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = `<div style="font-size:11px;color:var(--blue);padding:8px 0">🤖 Analizando con Gemini...</div>`;

  const payload = editingId
    ? { doc_id: editingId }
    : _readFormVehicle();

  try {
    const r = await fetch('/api/ai/precio-recomendado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!d.ok) {
      panel.innerHTML = `<div style="font-size:11px;color:var(--red)">${d.error}</div>`; return;
    }
    if (d.raw) {
      panel.innerHTML = `<div style="font-size:11px;color:var(--gray2);white-space:pre-wrap">${escHtml(d.raw)}</div>`; return;
    }
    const fmt = n => n >= 1e6 ? '$'+(n/1e6).toFixed(2)+'M' : '$'+Math.round(n/1e3)+'K';
    const positivos = (d.factores_positivos || []).map(f => `<div style="color:#27ae60">▲ ${escHtml(f)}</div>`).join('');
    const negativos = (d.factores_negativos || []).map(f => `<div style="color:#e74c3c">▼ ${escHtml(f)}</div>`).join('');
    panel.innerHTML = `
      <div style="background:var(--card2);border-radius:10px;padding:12px 14px;border:1px solid var(--border2)">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;text-align:center">
          <div>
            <div style="font-size:9px;color:var(--gray3)">MÍNIMO</div>
            <div style="font-size:14px;font-weight:700;color:#27ae60">${fmt(d.precio_minimo||0)}</div>
          </div>
          <div style="border:2px solid var(--blue);border-radius:8px;padding:4px">
            <div style="font-size:9px;color:var(--blue)">RECOMENDADO</div>
            <div style="font-size:16px;font-weight:800;color:var(--blue)">${fmt(d.precio_recomendado||0)}</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--gray3)">MÁXIMO</div>
            <div style="font-size:14px;font-weight:700;color:#e74c3c">${fmt(d.precio_maximo||0)}</div>
          </div>
        </div>
        ${d.justificacion ? `<div style="font-size:10px;color:var(--gray2);margin-bottom:8px">${escHtml(d.justificacion)}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:10px">
          <div>${positivos}</div>
          <div>${negativos}</div>
        </div>
        <div style="margin-top:8px;font-size:9px;color:var(--gray3)">
          🤖 Análisis por Gemini — verificar con datos de mercado actuales
        </div>
      </div>`;
  } catch(e) {
    panel.innerHTML = `<div style="font-size:11px;color:var(--red)">Error de red</div>`;
  }
}
