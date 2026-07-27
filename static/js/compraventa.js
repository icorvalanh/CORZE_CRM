// compraventa.js — VTA Web

let allRows = [], selectedId = null, editingId = null, sellId = null;

// ── Carga inicial ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f_fingreso').value = today();
  loadRows();
});

async function loadRows() {
  allRows = await api('/api/compraventa');
  renderTable(allRows);
  renderStats(allRows);
  renderAlerts(allRows);
}

// ── Tabla ────────────────────────────────────────────────────────────────────
function renderTable(rows) {
  const tbody = document.getElementById('tableBody');
  document.getElementById('rowCount').textContent = rows.length + ' vehículo' + (rows.length!==1?'s':'');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--gray3)">Sin vehículos registrados</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const dias = parseInt(r.dias_en_stock || 0);
    const alertCls = r.estado !== 'Vendido'
      ? (dias >= 60 ? 'alert-critical' : dias >= 30 ? 'alert-warning' : '') : '';
    const diasColor = r.estado === 'Vendido' ? 'var(--gray3)' :
      dias >= 60 ? 'var(--red)' : dias >= 30 ? 'var(--yellow)' : 'var(--gray2)';
    return `<tr class="${alertCls}${selectedId===r.id?' selected':''}"
               onclick="selectRow('${r.id}',this)"
               ondblclick="openEdit('${r.id}')">
      <td style="color:var(--blue);font-weight:600">${r.patente||'—'}</td>
      <td>${r.marca||'—'}</td>
      <td>${r.anio||'—'}</td>
      <td>${r.modelo||'—'}</td>
      <td>${(r.km_aprox||0).toLocaleString('es-CL')}</td>
      <td>${r.color||'—'}</td>
      <td>${clp(r.precio_compra)}</td>
      <td>${clp(r.precio_venta_colaboradores)}</td>
      <td>${clp(r.valor_mercado)}</td>
      <td>${clp(r.precio_venta_final)}</td>
      <td style="color:${parseInt(r.ganancia||0)>0?'var(--green)':'var(--gray3)'};font-weight:600">${clp(r.ganancia)}</td>
      <td>${badgeHTML(r.estado)}</td>
      <td style="color:${diasColor};font-weight:${dias>=30?'700':'400'}">${dias||'—'}</td>
      <td style="color:var(--gray3)">${formatDate(r.fecha_ingreso)}</td>
    </tr>`;
  }).join('');
}

function selectRow(id, tr) {
  document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
  tr.classList.add('selected');
  selectedId = id;
  const row = allRows.find(r => r.id === id);
  if (row) renderDetail(row);
}

// ── Panel de detalle ─────────────────────────────────────────────────────────
function renderDetail(r) {
  const dp = document.getElementById('detailPanel');
  const dias = parseInt(r.dias_en_stock || 0);
  const diasColor = r.estado==='Vendido'?'var(--gray3)':dias>=60?'var(--red)':dias>=30?'var(--yellow)':'var(--gray2)';
  dp.innerHTML = `
    <div style="padding:12px">
      ${badgeHTML(r.estado)}
      ${dias>0?`<span style="float:right;font-size:9px;color:${diasColor};font-weight:700">${dias} días en stock</span>`:''}
    </div>
    <div class="detail-header">
      <div class="detail-title">${r.marca} ${r.modelo}</div>
      <div class="detail-sub">${r.anio} · ${r.tipo_vehiculo||''}</div>
    </div>
    <div class="detail-section">IDENTIFICACIÓN</div>
    ${dr('Patente', r.patente, 'var(--blue)')}
    ${dr('Chasis', r.chasis)}
    ${dr('Color', r.color)}
    ${dr('Motor', r.motor)}
    <div class="detail-section">TÉCNICO</div>
    ${dr('Transmisión', r.transmision)}
    ${dr('Combustible', r.combustible)}
    ${dr('KM', (r.km_aprox||0).toLocaleString('es-CL') + ' km')}
    ${dr('N° Dueños', r.cantidad_duenos)}
    <div class="detail-section">PRECIOS</div>
    ${dr('P. Compra', clp(r.precio_compra))}
    ${dr('P. Colaboradores', clp(r.precio_venta_colaboradores), 'var(--blue)')}
    ${dr('V. Mercado', clp(r.valor_mercado))}
    ${dr('P. Venta Final', clp(r.precio_venta_final), r.precio_venta_final?'var(--green)':null)}
    ${dr('Ganancia', clp(r.ganancia), parseInt(r.ganancia||0)>0?'var(--green)':'var(--gray3)')}
    <div class="detail-section">GESTIÓN</div>
    ${dr('F. Ingreso', formatDate(r.fecha_ingreso))}
    ${dr('F. Publicación', formatDate(r.fecha_publicacion)||'—')}
    ${dr('F. Venta', formatDate(r.fecha_venta)||'—')}
    ${dr('Creado por', r.usuario_creacion||'—')}
    ${dr('Editado por', r.usuario_ultima_edicion||'—')}
    ${r.notas?`<div class="detail-section">NOTAS</div><div style="padding:6px 14px 12px;color:var(--gray2);font-size:10px;line-height:1.5">${r.notas}</div>`:''}
  `;
}

function dr(label, value, color) {
  const v = value||'—';
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value"${color?` style="color:${color}"`:''}>${v}</span>
  </div>`;
}

// ── Stats strip ──────────────────────────────────────────────────────────────
function renderStats(rows) {
  const stock = rows.filter(r=>r.estado==='En Stock').length;
  const pub   = rows.filter(r=>r.estado==='Publicado').length;
  const res   = rows.filter(r=>r.estado==='Reservado').length;
  const vend  = rows.filter(r=>r.estado==='Vendido').length;
  const gan   = rows.filter(r=>r.estado==='Vendido').reduce((s,r)=>s+parseInt(r.ganancia||0),0);
  document.getElementById('statsStrip').innerHTML = `
    <span style="color:var(--blue)">📦 Stock: ${stock}</span>
    <span style="color:var(--yellow)">📢 Publicados: ${pub}</span>
    <span style="color:var(--purple)">🔒 Reservados: ${res}</span>
    <span style="color:var(--green)">✅ Vendidos: ${vend}</span>
    <span style="color:var(--green)">💰 Ganancia: ${clp(gan)}</span>`;
}

// ── Alertas ──────────────────────────────────────────────────────────────────
function renderAlerts(rows) {
  const strip = document.getElementById('alertStrip');
  const criticos = rows.filter(r=>r.estado!=='Vendido'&&parseInt(r.dias_en_stock||0)>=60).length;
  const warnings = rows.filter(r=>r.estado!=='Vendido'&&parseInt(r.dias_en_stock||0)>=30&&parseInt(r.dias_en_stock||0)<60).length;
  strip.innerHTML = '';
  if (criticos) strip.innerHTML += `<div class="alert-strip alert-critical">🔴 ${criticos} vehículo${criticos>1?'s':''} con más de 60 días en stock</div>`;
  if (warnings) strip.innerHTML += `<div class="alert-strip alert-warning">🟡 ${warnings} vehículo${warnings>1?'s':''} con más de 30 días sin vender</div>`;
}

// ── Búsqueda y filtros ───────────────────────────────────────────────────────
function searchRows(q) {
  if (!q) { renderTable(allRows); return; }
  const ql = q.toLowerCase();
  renderTable(allRows.filter(r =>
    (r.patente||'').toLowerCase().includes(ql) ||
    (r.marca||'').toLowerCase().includes(ql) ||
    (r.modelo||'').toLowerCase().includes(ql) ||
    (r.chasis||'').toLowerCase().includes(ql) ||
    (r.color||'').toLowerCase().includes(ql)
  ));
}

function filterRows(estado) {
  renderTable(estado ? allRows.filter(r=>r.estado===estado) : allRows);
}

// ── MODAL ────────────────────────────────────────────────────────────────────
function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = '➕ Nuevo Vehículo';
  clearForm();
  document.getElementById('f_fingreso').value = today();
  document.getElementById('modal').classList.add('open');
}

function openEdit(id) {
  const row = allRows.find(r => r.id === id);
  if (!row) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = '✏️ Editar Vehículo';
  fillForm(row);
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('open');
}

function clearForm() {
  ['f_patente','f_chasis','f_motor','f_color','f_km',
   'f_compra','f_colab','f_mercado','f_pventa','f_notas',
   'f_fpub','f_fventa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f_estado').value = 'En Stock';
  document.getElementById('f_duenos').value = '1';
}

function fillForm(r) {
  const sv = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  sv('f_patente', r.patente); sv('f_chasis', r.chasis);
  sv('f_marca',   r.marca);   sv('f_anio', r.anio);
  sv('f_tipo',    r.tipo_vehiculo); sv('f_modelo', r.modelo);
  sv('f_color',   r.color);   sv('f_motor', r.motor);
  sv('f_transmision', r.transmision); sv('f_combustible', r.combustible);
  sv('f_km',      r.km_aprox); sv('f_duenos', r.cantidad_duenos||'1');
  sv('f_compra',  r.precio_compra); sv('f_colab', r.precio_venta_colaboradores);
  sv('f_mercado', r.valor_mercado); sv('f_pventa', r.precio_venta_final);
  sv('f_estado',  r.estado); sv('f_fingreso', r.fecha_ingreso);
  sv('f_fpub',    r.fecha_publicacion); sv('f_fventa', r.fecha_venta);
  sv('f_notas',   r.notas);
}

function getFormData() {
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const gn = id => parseInt(g(id).replace(/\D/g,'')) || 0;
  return {
    patente: g('f_patente').toUpperCase(), chasis: g('f_chasis').toUpperCase(),
    marca: g('f_marca'), anio: parseInt(g('f_anio')), tipo_vehiculo: g('f_tipo'),
    modelo: g('f_modelo'), color: g('f_color'), motor: g('f_motor'),
    transmision: g('f_transmision'), combustible: g('f_combustible'),
    km_aprox: gn('f_km'), cantidad_duenos: parseInt(g('f_duenos')) || 1,
    precio_compra: gn('f_compra'), precio_venta_colaboradores: gn('f_colab'),
    valor_mercado: gn('f_mercado'), precio_venta_final: gn('f_pventa'),
    estado: g('f_estado'), fecha_ingreso: g('f_fingreso'),
    fecha_publicacion: g('f_fpub'), fecha_venta: g('f_fventa'),
    notas: g('f_notas'),
  };
}

async function saveVehicle() {
  const data = getFormData();
  if (!data.patente) { toast('La patente es obligatoria', 'error'); return; }
  if (!data.modelo)  { toast('El modelo es obligatorio', 'error'); return; }

  let result;
  if (editingId) {
    result = await api(`/api/compraventa/${editingId}`, 'PUT', data);
  } else {
    result = await api('/api/compraventa', 'POST', data);
  }

  if (result.ok) {
    closeModal();
    await loadRows();
    toast(editingId ? '✅ Vehículo actualizado' : '✅ Vehículo agregado', 'success');
  } else {
    toast('Error: ' + (result.error||'desconocido'), 'error');
  }
}

// ── Acciones ─────────────────────────────────────────────────────────────────
function editSelected() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  openEdit(selectedId);
}

async function deleteSelected() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const row = allRows.find(r=>r.id===selectedId);
  if (!confirm(`¿Eliminar ${row?.patente||''} — ${row?.marca||''} ${row?.modelo||('')}?\n\nEsta acción no se puede deshacer.`)) return;
  const result = await api(`/api/compraventa/${selectedId}`, 'DELETE');
  if (result.ok) {
    selectedId = null;
    document.getElementById('detailPanel').innerHTML = '<div class="detail-empty">Selecciona un vehículo<br>para ver los detalles</div>';
    await loadRows();
    toast('🗑️ Vehículo eliminado', 'warning');
  } else {
    toast('Error al eliminar', 'error');
  }
}

async function duplicateSelected() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const result = await api(`/api/compraventa/${selectedId}/duplicate`, 'POST');
  if (result.ok) { await loadRows(); toast('⊕ Vehículo duplicado', 'info'); }
  else toast('Error al duplicar', 'error');
}

// ── Venta rápida ──────────────────────────────────────────────────────────────
function quickSell() {
  if (!selectedId) { toast('Selecciona un vehículo primero', 'warning'); return; }
  const row = allRows.find(r=>r.id===selectedId);
  if (!row) return;
  if (row.estado === 'Vendido') { toast('Este vehículo ya fue vendido', 'warning'); return; }
  sellId = selectedId;
  document.getElementById('sellRef').innerHTML =
    `<strong>${row.patente}</strong> · ${row.marca} ${row.modelo}<br>
     P. Compra: ${clp(row.precio_compra)} &nbsp;|&nbsp; V. Mercado: ${clp(row.valor_mercado)} &nbsp;|&nbsp; P. Colab.: ${clp(row.precio_venta_colaboradores)}`;
  document.getElementById('s_precio').value = row.precio_venta_colaboradores || '';
  document.getElementById('s_fecha').value  = today();
  document.getElementById('sellGanancia').textContent = '';
  calcGanancia();
  document.getElementById('modalSell').classList.add('open');
}

function calcGanancia() {
  const row = allRows.find(r=>r.id===sellId);
  if (!row) return;
  const pv  = parseInt(document.getElementById('s_precio').value) || 0;
  const pc  = parseInt(row.precio_compra) || 0;
  const gan = pv - pc;
  const el  = document.getElementById('sellGanancia');
  el.style.color = gan >= 0 ? 'var(--green)' : 'var(--red)';
  el.textContent = pv > 0 ? `Ganancia estimada: ${gan>=0?'+':''}${clp(gan)}` : '';
}

function closeSell(e) {
  if (!e || e.target === document.getElementById('modalSell'))
    document.getElementById('modalSell').classList.remove('open');
}

async function confirmSell() {
  const precio = parseInt(document.getElementById('s_precio').value) || 0;
  const fecha  = document.getElementById('s_fecha').value;
  if (precio <= 0) { toast('Ingresa un precio válido', 'error'); return; }
  const result = await api(`/api/compraventa/${sellId}/sell`, 'POST', { precio_venta: precio, fecha_venta: fecha });
  if (result.ok) {
    closeSell();
    await loadRows();
    toast('🎉 ¡Venta registrada exitosamente!', 'success');
  } else {
    toast('Error: ' + result.error, 'error');
  }
}
