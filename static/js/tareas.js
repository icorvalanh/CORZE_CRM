// tareas.js — VTA Tareas module

let allTareas   = [];
let estadoFilt  = '';
let searchQuery = '';
let editingId   = null;

document.addEventListener('DOMContentLoaded', () => {
  setDefaultFecha();
  loadTareas();
  checkNotificaciones();
});

// ── API ───────────────────────────────────────────────────────────────────────
async function loadTareas() {
  try {
    const res = await fetch('/api/tareas');
    allTareas  = await res.json();
    renderTabla();
    renderAlerta();
  } catch(e) {
    showToast('Error cargando tareas', 'error');
  }
}

// ── Alerta urgentes ───────────────────────────────────────────────────────────
function renderAlerta() {
  const today  = new Date().toISOString().slice(0, 10);
  const venc   = allTareas.filter(t => t.estado === 'pendiente' && t.fecha_limite <= today);
  const strip  = document.getElementById('alertaUrgentes');
  const txt    = document.getElementById('alertaUrgentesText');
  if (!strip || !txt) return;
  if (venc.length > 0) {
    const cuantas = venc.length === 1 ? '1 tarea vencida' : `${venc.length} tareas vencidas`;
    txt.innerHTML = `⚠️ Tienes <strong>${cuantas}</strong> sin completar. Revísalas abajo.`;
    strip.style.display = 'flex';
  } else {
    strip.style.display = 'none';
  }
}

// ── Render tabla ──────────────────────────────────────────────────────────────
function visibleTareas() {
  const today = new Date().toISOString().slice(0, 10);
  return allTareas.filter(t => {
    if (estadoFilt && t.estado !== estadoFilt) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = [t.titulo, t.descripcion, t.vehiculo_desc, t.asignado_a].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    // Filtro asignado
    const selAsig = document.getElementById('filtAsignado')?.value || '';
    if (selAsig && t.asignado_a !== selAsig && t.asignado_a !== 'Todos') return false;
    return true;
  });
}

function renderTabla() {
  const tbody   = document.getElementById('tablaBody');
  const visible = visibleTareas();
  const today   = new Date().toISOString().slice(0, 10);

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--gray3)">
      Sin tareas para mostrar</td></tr>`;
    return;
  }

  tbody.innerHTML = visible.map(t => {
    const completada = t.estado === 'completada';
    const rowClass   = completada ? 'tarea-completada' : '';
    const fecha      = (t.fecha_limite || '').slice(0, 10);
    const delta      = fecha ? Math.ceil((new Date(fecha) - new Date(today)) / 86400000) : null;
    const recText    = { 0:'Sin recordatorio', 1:'1 día', 2:'2 días', 3:'3 días', 7:'1 semana', 14:'2 semanas' };

    let fechaClass = '', fechaIcon = '';
    if (!completada && fecha) {
      if (delta < 0)         { fechaClass = 'fecha-venc'; fechaIcon = '🔴 '; }
      else if (delta === 0)  { fechaClass = 'fecha-hoy';  fechaIcon = '🟠 Hoy'; }
      else if (delta <= (t.recordatorio || 1)) { fechaClass = 'fecha-prox'; fechaIcon = `⏰ ${delta}d`; }
    }

    const prioMap   = { alta: 'prio-alta', media: 'prio-media', baja: 'prio-baja' };
    const prioLabel = { alta: '🔴 Alta', media: '🟡 Media', baja: '🟢 Baja' };
    const prioClass = prioMap[t.prioridad] || 'prio-media';
    const prioText  = prioLabel[t.prioridad] || t.prioridad;

    const vehHtml = t.vehiculo_desc
      ? `<span style="color:var(--blue);font-size:11px">🚗 ${escHtml(t.vehiculo_desc)}</span>`
      : '<span style="color:var(--gray3)">—</span>';

    const recLabel = recText[t.recordatorio] || `${t.recordatorio}d`;

    return `
      <tr class="${rowClass}" style="cursor:default">
        <td style="text-align:center;padding-left:12px">
          <input type="checkbox" class="task-check" ${completada ? 'checked' : ''}
                 onchange="toggleTarea('${t.id}', this.checked)">
        </td>
        <td>
          <div class="tarea-titulo" style="font-weight:600;font-size:12px">${escHtml(t.titulo || '')}</div>
          ${t.descripcion ? `<div style="font-size:10px;color:var(--gray3);margin-top:2px">${escHtml(t.descripcion.slice(0,80))}${t.descripcion.length>80?'…':''}</div>` : ''}
        </td>
        <td>${vehHtml}</td>
        <td style="font-size:11px">${escHtml(t.asignado_a || 'Todos')}</td>
        <td>
          <span class="${fechaClass}" style="font-size:11px;white-space:nowrap">
            ${fechaIcon ? fechaIcon + ' ' : ''}${fecha}
          </span>
        </td>
        <td style="font-size:11px;color:var(--gray3)">${recLabel}</td>
        <td><span class="${prioClass}">${prioText}</span></td>
        <td><span class="${completada ? 'est-comp' : 'est-pend'}">${completada ? '✅ Completada' : '⏳ Pendiente'}</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModal('${t.id}')">✏️</button>
            <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;color:var(--red)" onclick="eliminar('${t.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function filtrarEstado(estado, btn) {
  estadoFilt = estado;
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabla();
}

function buscar(q) {
  searchQuery = q;
  renderTabla();
}

function aplicarFiltros() {
  renderTabla();
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id = null) {
  editingId = id;
  document.getElementById('modalTitle').textContent = id ? 'Editar tarea' : 'Nueva tarea';
  resetForm();

  if (id) {
    const t = allTareas.find(x => x.id === id);
    if (!t) return;
    document.getElementById('t_titulo').value       = t.titulo       || '';
    document.getElementById('t_descripcion').value  = t.descripcion  || '';
    document.getElementById('t_prioridad').value    = t.prioridad    || 'media';
    document.getElementById('t_asignado').value     = t.asignado_a   || 'Todos';
    document.getElementById('t_fecha_limite').value = (t.fecha_limite || '').slice(0, 10);
    document.getElementById('t_recordatorio').value = String(t.recordatorio ?? 1);
    if (t.vehiculo_id) {
      document.getElementById('t_vehiculo_id').value           = t.vehiculo_id;
      document.getElementById('t_vehiculo_desc_hidden').value  = t.vehiculo_desc || '';
      document.getElementById('tVehiculoDesc').textContent     = t.vehiculo_desc || '';
      document.getElementById('tVehiculoSeleccionado').style.display = 'flex';
    }
  }
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

function resetForm() {
  document.getElementById('t_titulo').value       = '';
  document.getElementById('t_descripcion').value  = '';
  document.getElementById('t_prioridad').value    = 'media';
  document.getElementById('t_asignado').value     = 'Todos';
  document.getElementById('t_recordatorio').value = '1';
  limpiarVehiculoTarea();
  setDefaultFecha();
}

function setDefaultFecha() {
  const el = document.getElementById('t_fecha_limite');
  if (!el || el.value) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  el.value = tomorrow.toISOString().slice(0, 10);
}

// ── Guardar ───────────────────────────────────────────────────────────────────
async function guardarTarea() {
  const titulo      = document.getElementById('t_titulo').value.trim();
  const fecha       = document.getElementById('t_fecha_limite').value;
  const descripcion = document.getElementById('t_descripcion').value.trim();
  const prioridad   = document.getElementById('t_prioridad').value;
  const asignado    = document.getElementById('t_asignado').value;
  const recordatorio= parseInt(document.getElementById('t_recordatorio').value, 10);
  const vehId       = document.getElementById('t_vehiculo_id').value;
  const vehDesc     = document.getElementById('t_vehiculo_desc_hidden').value;

  if (!titulo || !fecha) {
    showToast('Título y fecha límite son requeridos', 'error'); return;
  }

  const payload = { titulo, descripcion, prioridad, asignado_a: asignado,
                    fecha_limite: fecha, recordatorio,
                    vehiculo_id: vehId || null, vehiculo_desc: vehDesc || null };

  try {
    const url    = editingId ? `/api/tareas/${editingId}` : '/api/tareas';
    const method = editingId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.error || 'Error al guardar', 'error'); return; }
    closeModal();
    await loadTareas();
    // Actualizar badge en sidebar
    actualizarBadge();
    showToast(editingId ? 'Tarea actualizada' : 'Tarea creada');
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

// ── Toggle completada ─────────────────────────────────────────────────────────
async function toggleTarea(id, completada) {
  try {
    const res  = await fetch(`/api/tareas/${id}/toggle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completada }),
    });
    const data = await res.json();
    if (!data.ok) { showToast('Error', 'error'); return; }
    const t = allTareas.find(x => x.id === id);
    if (t) t.estado = completada ? 'completada' : 'pendiente';
    renderTabla();
    renderAlerta();
    actualizarBadge();
    showToast(completada ? '✅ Tarea completada' : 'Tarea reabierta');
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
async function eliminar(id) {
  const t = allTareas.find(x => x.id === id);
  if (!confirm(`¿Eliminar tarea "${t?.titulo || id}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res  = await fetch(`/api/tareas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.ok) { showToast('Error al eliminar', 'error'); return; }
    await loadTareas();
    actualizarBadge();
    showToast('Tarea eliminada');
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

// ── Vehículo search ───────────────────────────────────────────────────────────
let _vehTimeout = null;
async function buscarVehiculoTarea(q) {
  clearTimeout(_vehTimeout);
  const box = document.getElementById('tVehiculoSuggestions');
  if (q.length < 2) { box.style.display = 'none'; return; }
  _vehTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(`/api/inventario?q=${encodeURIComponent(q)}`);
      const rows = await res.json();
      if (!rows.length) { box.style.display = 'none'; return; }
      box.innerHTML = rows.slice(0, 8).map(r => {
        const label = `${r.marca||''} ${r.modelo||''} ${r.anio||''} — ${r.patente||''}`.trim();
        return `<div style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border2)"
                     onmousedown="seleccionarVehiculoTarea('${r.id}','${escJs(label)}')">${escHtml(label)}</div>`;
      }).join('');
      box.style.display = 'block';
    } catch(e) { console.error(e); }
  }, 250);
}

function seleccionarVehiculoTarea(id, desc) {
  document.getElementById('t_vehiculo_id').value          = id;
  document.getElementById('t_vehiculo_desc_hidden').value = desc;
  document.getElementById('tVehiculoDesc').textContent    = desc;
  document.getElementById('tVehiculoSeleccionado').style.display = 'flex';
  document.getElementById('tVehiculoSuggestions').style.display  = 'none';
  document.getElementById('t_vehiculo_search').value = '';
}

function limpiarVehiculoTarea() {
  document.getElementById('t_vehiculo_id').value          = '';
  document.getElementById('t_vehiculo_desc_hidden').value = '';
  document.getElementById('tVehiculoSeleccionado').style.display = 'none';
  const s = document.getElementById('t_vehiculo_search');
  if (s) s.value = '';
}

// ── Badge sidebar ─────────────────────────────────────────────────────────────
async function actualizarBadge() {
  try {
    const res   = await fetch('/api/tareas/badge');
    const data  = await res.json();
    const badge = document.getElementById('sidebarTaskBadge');
    if (!badge) return;
    if (data.urgentes > 0) {
      badge.textContent  = data.urgentes;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) {}
}

// ── Browser notifications ─────────────────────────────────────────────────────
async function checkNotificaciones() {
  if (!('Notification' in window)) return;
  const lastCheck = localStorage.getItem('vta_task_notif_date');
  const today     = new Date().toISOString().slice(0, 10);
  if (lastCheck === today) return;

  try {
    const res  = await fetch('/api/tareas/upcoming');
    const data = await res.json();
    localStorage.setItem('vta_task_notif_date', today);

    if (!data.tasks || !data.tasks.length) return;

    if (Notification.permission === 'granted') {
      data.tasks.slice(0, 3).forEach(t => {
        const titulo = t.urgencia === 'vencida' ? '🔴 Tarea vencida' : `⏰ Vence en ${t.urgencia}`;
        new Notification(titulo, { body: t.titulo, icon: '/static/assets/logo.png' });
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted' && data.tasks.length) {
          const t = data.tasks[0];
          new Notification('⏰ Tienes tareas próximas en VTA', {
            body: `${t.titulo} — vence ${t.fecha_limite}`,
            icon: '/static/assets/logo.png'
          });
        }
      });
    }
  } catch(e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escJs(s) {
  return String(s ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
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
