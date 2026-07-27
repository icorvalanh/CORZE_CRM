// consignaciones.js — VTA Web

let allRows = [], selectedId = null, editingId = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f_fingreso').value = today();
  loadRows();
});

async function loadRows() {
  allRows = await api('/api/consignaciones');
  renderTable(allRows);
  renderStats(allRows);
}

function renderTable(rows) {
  const tbody = document.getElementById('tableBody');
  document.getElementById('rowCount').textContent = rows.length + ' consignación' + (rows.length!==1?'es':'');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--gray3)">Sin consignaciones registradas</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr class="${selectedId===r.id?'selected':''}"
        onclick="selectRow('${r.id}',this)"
        ondblclick="openEdit('${r.id}')">
      <td style="font-weight:600">${r.nombre_propietario||'—'}</td>
      <td style="color:var(--gray2)">${r.contacto_propietario||'—'}</td>
      <td style="color:var(--blue)">${r.patente||'—'}</td>
      <td>${r.marca||'—'}</td>
      <td>${r.modelo||'—'}</td>
      <td>${r.anio||'—'}</td>
      <td>${(r.km||0).toLocaleString('es-CL')}</td>
      <td>${clp(r.precio_pedido)}</td>
      <td>${clp(r.precio_minimo)}</td>
      <td>${r.comision_porcentaje||0}%</td>
      <td style="color:var(--green)">${clp(r.comision_monto)}</td>
      <td style="color:${r.precio_venta_final?'var(--green)':'var(--gray3)'}">${clp(r.precio_venta_final)}</td>
      <td>${badgeHTML(r.estado)}</td>
      <td style="color:var(--gray3)">${formatDate(r.fecha_ingreso)}</td>
    </tr>`).join('');
}

function selectRow(id, tr) {
  document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
  tr.classList.add('selected');
  selectedId = id;
  renderDetail(allRows.find(r => r.id === id));
}

function renderDetail(r) {
  if (!r) return;
  const dp = document.getElementById('detailPanel');
  dp.innerHTML = `
    <div style="padding:12px">${badgeHTML(r.estado)}</div>
    <div class="detail-header">
      <div class="detail-title">${r.marca} ${r.modelo}</div>
      <div class="detail-sub">${r.anio} · ${r.color||''}</div>
    </div>
    <div class="detail-section">PROPIETARIO</div>
    ${dr('Nombre', r.nombre_propietario)}
    ${dr('Contacto', r.contacto_propietario)}
    <div class="detail-section">VEHÍCULO</div>
    ${dr('Patente', r.patente, 'var(--blue)')}
    ${dr('KM', (r.km||0).toLocaleString('es-CL') + ' km')}
    ${dr('Transmisión', r.transmision)}
    ${dr('Combustible', r.combustible)}
    <div class="detail-section">PRECIOS</div>
    ${dr('P. Pedido', clp(r.precio_pedido))}
    ${dr('P. Mínimo', clp(r.precio_minimo))}
    ${dr('Comisión %', (r.comision_porcentaje||0) + '%')}
    ${dr('Comisión $', clp(r.comision_monto), 'var(--green)')}
    ${dr('P. Venta Final', clp(r.precio_venta_final), r.precio_venta_final?'var(--green)':null)}
    <div class="detail-section">GESTIÓN</div>
    ${dr('F. Ingreso', formatDate(r.fecha_ingreso))}
    ${dr('F. Publicación', formatDate(r.fecha_publicacion)||'—')}
    ${dr('F. Venta', formatDate(r.fecha_venta)||'—')}
    ${dr('Creado por', r.usuario_creacion||'—')}
    ${r.notas?`<div class="detail-section">NOTAS</div><div style="padding:6px 14px 12px;color:var(--gray2);font-size:10px">${r.notas}</div>`:''}
  `;
}

function dr(label, value, color) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value"${color?` style="color:${color}"`:''}>${value||'—'}</span>
  </div>`;
}

function renderStats(rows) {
  const p = (e) => rows.filter(r=>r.estado===e).length;
  const comis = rows.filter(r=>r.estado==='Vendido').reduce((s,r)=>s+parseInt(r.comision_monto||0),0);
  document.getElementById('statsStrip').innerHTML = `
    <span style="color:var(--blue)">🔄 En Proceso: ${p('En Proceso')}</span>
    <span style="color:var(--yellow)">📢 Publicadas: ${p('Publicado')}</span>
    <span style="color:var(--green)">✅ Vendidas: ${p('Vendido')}</span>
    <span style="color:var(--red)">↩️ Devueltas: ${p('Devuelto')}</span>
    <span style="color:var(--green)">💰 Comisiones: ${clp(comis)}</span>`;
}

function searchRows(q) {
  if (!q) { renderTable(allRows); return; }
  const ql = q.toLowerCase();
  renderTable(allRows.filter(r =>
    (r.patente||'').toLowerCase().includes(ql) ||
    (r.marca||'').toLowerCase().includes(ql) ||
    (r.modelo||'').toLowerCase().includes(ql) ||
    (r.nombre_propietario||'').toLowerCase().includes(ql)
  ));
}
function filterRows(e) { renderTable(e ? allRows.filter(r=>r.estado===e) : allRows); }

function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = '➕ Nueva Consignación';
  clearForm();
  document.getElementById('f_fingreso').value = today();
  document.getElementById('f_cpct').value = '5.0';
  document.getElementById('modal').classList.add('open');
}
function openEdit(id) {
  const row = allRows.find(r=>r.id===id);
  if (!row) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = '✏️ Editar Consignación';
  fillForm(row);
  document.getElementById('modal').classList.add('open');
}
function closeModal(e) {
  if (!e || e.target===document.getElementById('modal'))
    document.getElementById('modal').classList.remove('open');
}
function clearForm() {
  ['f_nombre','f_contacto','f_patente','f_modelo','f_km','f_color',
   'f_pedido','f_minimo','f_pventa','f_notas','f_fpub','f_fventa'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('f_estado').value = 'En Proceso';
}
function fillForm(r) {
  const sv=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  sv('f_nombre',r.nombre_propietario); sv('f_contacto',r.contacto_propietario);
  sv('f_patente',r.patente); sv('f_marca',r.marca); sv('f_modelo',r.modelo);
  sv('f_anio',r.anio); sv('f_km',r.km); sv('f_color',r.color);
  sv('f_transmision',r.transmision);
  sv('f_pedido',r.precio_pedido); sv('f_minimo',r.precio_minimo);
  sv('f_cpct',r.comision_porcentaje||5); sv('f_pventa',r.precio_venta_final);
  sv('f_estado',r.estado); sv('f_fingreso',r.fecha_ingreso);
  sv('f_fpub',r.fecha_publicacion); sv('f_fventa',r.fecha_venta);
  sv('f_notas',r.notas);
}
function getFormData() {
  const g=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
  return {
    nombre_propietario: g('f_nombre'), contacto_propietario: g('f_contacto'),
    patente: g('f_patente').toUpperCase(), marca: g('f_marca'), modelo: g('f_modelo'),
    anio: parseInt(g('f_anio')), km: parseInt(g('f_km'))||0, color: g('f_color'),
    transmision: g('f_transmision'), combustible: 'Bencina',
    precio_pedido: parseInt(g('f_pedido'))||0, precio_minimo: parseInt(g('f_minimo'))||0,
    comision_porcentaje: parseFloat(g('f_cpct'))||5,
    precio_venta_final: parseInt(g('f_pventa'))||0,
    estado: g('f_estado'), fecha_ingreso: g('f_fingreso'),
    fecha_publicacion: g('f_fpub'), fecha_venta: g('f_fventa'), notas: g('f_notas'),
  };
}
async function saveConsig() {
  const data = getFormData();
  if (!data.nombre_propietario) { toast('El nombre del propietario es obligatorio','error'); return; }
  if (!data.modelo) { toast('El modelo es obligatorio','error'); return; }
  const result = editingId
    ? await api(`/api/consignaciones/${editingId}`,'PUT',data)
    : await api('/api/consignaciones','POST',data);
  if (result.ok) {
    closeModal(); await loadRows();
    toast(editingId?'✅ Consignación actualizada':'✅ Consignación agregada','success');
  } else toast('Error: '+(result.error||'desconocido'),'error');
}
function editSelected() {
  if (!selectedId) { toast('Selecciona una consignación','warning'); return; }
  openEdit(selectedId);
}
async function deleteSelected() {
  if (!selectedId) { toast('Selecciona una consignación','warning'); return; }
  const row = allRows.find(r=>r.id===selectedId);
  if (!confirm(`¿Eliminar consignación de ${row?.nombre_propietario||''}?\n\nNo se puede deshacer.`)) return;
  const result = await api(`/api/consignaciones/${selectedId}`,'DELETE');
  if (result.ok) {
    selectedId=null;
    document.getElementById('detailPanel').innerHTML='<div class="detail-empty">Selecciona una consignación<br>para ver los detalles</div>';
    await loadRows(); toast('🗑️ Consignación eliminada','warning');
  } else toast('Error al eliminar','error');
}
