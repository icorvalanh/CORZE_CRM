// calendario.js — CORZE Calendario module

let allEventos  = [];
let currentDate = new Date();
let vista       = 'semana';
let editingId   = null;
let gcalConnected = false;

const TIPO_COLORS = {
  visita:  'ev-visita',
  tarea:   'ev-tarea',
  reunion: 'ev-reunion',
  llamada: 'ev-llamada',
  otro:    'ev-otro',
};
const TIPO_LABELS = {
  visita:  '🤝 Visita',
  tarea:   '📋 Tarea',
  reunion: '👥 Reunión',
  llamada: '📞 Llamada',
  otro:    '📌 Evento',
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

document.addEventListener('DOMContentLoaded', () => {
  setDefaultFecha();
  loadWorkers();
  checkGcalStatus();
  cargarEventos();
});

// ── Workers ───────────────────────────────────────────────────────────────────
async function loadWorkers() {
  try {
    const res = await fetch('/api/trabajadores');
    const workers = await res.json();
    const sel = document.getElementById('e_asignado');
    workers.forEach(w => {
      const name = w.nombre || w.name || '';
      if (!name) return;
      sel.innerHTML += `<option value="${escHtml(name)}">${escHtml(name)}</option>`;
    });
  } catch(e) {
    console.error('Error cargando trabajadores', e);
  }
}

// ── Google Calendar status ────────────────────────────────────────────────────
async function checkGcalStatus() {
  try {
    const res  = await fetch('/api/calendar/status');
    const data = await res.json();
    gcalConnected = data.connected;
    renderGcalChip();
  } catch(e) {}
}

function renderGcalChip() {
  const el = document.getElementById('gcalStatus');
  if (!el) return;
  if (gcalConnected) {
    el.innerHTML = `<button class="gcal-chip gcal-connected" onclick="desconectarGcal()">
      ✅ Google Calendar conectado</button>`;
  } else {
    el.innerHTML = `<button class="gcal-chip gcal-disconnected" onclick="conectarGcal()">
      🔗 Conectar Google Calendar</button>`;
  }
}

function conectarGcal() {
  window.location.href = '/oauth/google';
}

async function desconectarGcal() {
  if (!confirm('¿Desconectar Google Calendar?')) return;
  try {
    await fetch('/api/calendar/disconnect', { method: 'POST' });
  } catch(e) {}
  gcalConnected = false;
  renderGcalChip();
  showToast('Google Calendar desconectado');
}

// ── API ───────────────────────────────────────────────────────────────────────
async function cargarEventos() {
  try {
    const year  = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const res   = await fetch(`/api/calendario?mes=${year}-${month}`);
    allEventos  = await res.json();
    renderVista();
    actualizarLabel();
  } catch(e) {
    showToast('Error cargando calendario', 'error');
  }
}

// ── Navegación ────────────────────────────────────────────────────────────────
function navMes(dir) {
  if (vista === 'semana') {
    currentDate.setDate(currentDate.getDate() + dir * 7);
  } else {
    currentDate.setMonth(currentDate.getMonth() + dir);
  }
  cargarEventos();
}

function irHoy() {
  currentDate = new Date();
  cargarEventos();
}

function setVista(v, btn) {
  vista = v;
  document.querySelectorAll('#tabMes,#tabSemana,#tabAgenda').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('vistaMes').style.display    = v === 'mes'    ? 'block' : 'none';
  document.getElementById('vistaSemana').style.display = v === 'semana' ? 'block' : 'none';
  document.getElementById('vistaAgenda').style.display = v === 'agenda' ? 'block' : 'none';
  actualizarLabel();
  renderVista();
}

function actualizarLabel() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const el = document.getElementById('mesLabel');
  if (vista === 'semana') {
    const { lun, dom } = semanaRange(currentDate);
    el.textContent = `${fmtShort(lun)} – ${fmtShort(dom)} ${y}`;
  } else {
    el.textContent = `${MESES[m]} ${y}`;
  }
}

function fmtShort(d) {
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0,3)}`;
}

function semanaRange(d) {
  const day = d.getDay();
  const lun = new Date(d); lun.setDate(d.getDate() - ((day + 6) % 7));
  const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
  return { lun, dom };
}

// ── Render principal ──────────────────────────────────────────────────────────
function renderVista() {
  if (vista === 'mes')    renderMes();
  if (vista === 'semana') renderSemana();
  if (vista === 'agenda') renderAgenda();
}

// ── Vista Mes ─────────────────────────────────────────────────────────────────
function renderMes() {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().slice(0, 10);

  const primerDia = new Date(year, month, 1).getDay();
  const diasMes   = new Date(year, month + 1, 0).getDate();
  const offset    = (primerDia + 6) % 7;

  const grid = document.getElementById('calGrid');
  let html = '';

  const totalCells = Math.ceil((offset + diasMes) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1;
    let date = null, dateStr = '', otroMes = false;

    if (dayNum < 1) {
      const prev = new Date(year, month, dayNum);
      date = prev; otroMes = true;
      dateStr = prev.toISOString().slice(0, 10);
    } else if (dayNum > diasMes) {
      const next = new Date(year, month, dayNum);
      date = next; otroMes = true;
      dateStr = next.toISOString().slice(0, 10);
    } else {
      dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    }

    const isHoy   = dateStr === today;
    const evs     = allEventos.filter(e => (e.fecha || '').slice(0,10) === dateStr);
    const visible = evs.slice(0, 3);
    const mas     = evs.length - 3;

    html += `<div class="cal-cell${otroMes?' otro-mes':''}${isHoy?' hoy':''}" onclick="clickDia('${dateStr}')">
      <div class="cal-num">${(date || new Date(dateStr)).getDate()}</div>
      ${visible.map(e => evRow(e)).join('')}
      ${mas > 0 ? `<div class="cal-mas" onclick="event.stopPropagation();clickDia('${dateStr}')">+${mas} más</div>` : ''}
    </div>`;
  }
  grid.innerHTML = html;
}

function evRow(e) {
  const cls = e._tipo_ext === 'tarea' ? 'ev-tarea' : (TIPO_COLORS[e.tipo] || 'ev-otro');
  const esc = escHtml(e.titulo || '');
  return `<div class="cal-ev ${cls}" onclick="event.stopPropagation();${e._tipo_ext==='tarea'?'':(`openModal('${e.id}')`)}">
    ${esc}</div>`;
}

function clickDia(dateStr) {
  openModal(null, dateStr);
}

// ── Vista Semana ──────────────────────────────────────────────────────────────
function renderSemana() {
  const { lun } = semanaRange(currentDate);
  const today   = new Date().toISOString().slice(0, 10);
  const dias    = Array.from({length:7}, (_, i) => {
    const d = new Date(lun); d.setDate(lun.getDate() + i); return d;
  });

  const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

  let html = '<div class="semana-cabecera" style="border-right:1px solid var(--border2)"></div>';
  dias.forEach(d => {
    const ds  = d.toISOString().slice(0, 10);
    const hoy = ds === today;
    html += `<div class="semana-cabecera${hoy?' hoy':''}" onclick="clickDia('${ds}')" style="cursor:pointer">
      ${DIAS[d.getDay()]}<br><span style="font-size:16px;font-weight:800">${d.getDate()}</span>
    </div>`;
  });

  HORAS.forEach(hora => {
    html += `<div class="semana-hora">${hora}</div>`;
    dias.forEach(d => {
      const ds  = d.toISOString().slice(0, 10);
      const evs = allEventos.filter(e => {
        if ((e.fecha || '').slice(0, 10) !== ds) return false;
        const hi = e.hora_inicio || '00:00';
        return hi.slice(0, 2) === hora.slice(0, 2);
      });
      html += `<div class="semana-celda" onclick="clickDia('${ds}')">
        ${evs.map(e => {
          const cls = e._tipo_ext === 'tarea' ? 'ev-tarea' : (TIPO_COLORS[e.tipo] || 'ev-otro');
          return `<div class="cal-ev ${cls}" style="font-size:10px;margin:1px 2px"
            onclick="event.stopPropagation();${e._tipo_ext!=='tarea'?`openModal('${e.id}')`:''}">${escHtml(e.titulo||'')}</div>`;
        }).join('')}
      </div>`;
    });
  });

  document.getElementById('semanaGrid').innerHTML = html;
}

// ── Vista Agenda ──────────────────────────────────────────────────────────────
function renderAgenda() {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...allEventos].sort((a, b) => (a.fecha||'').localeCompare(b.fecha||''));

  if (!sorted.length) {
    document.getElementById('agendaList').innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray3)">Sin eventos este mes</div>`;
    return;
  }

  let html = '';
  let lastDate = null;

  sorted.forEach(e => {
    const ds = (e.fecha || '').slice(0, 10);
    if (ds !== lastDate) {
      const d = new Date(ds + 'T12:00');
      const isHoy = ds === today;
      html += `<div class="agenda-dia-header${isHoy?' hoy-label':''}">
        ${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}${isHoy?' — Hoy':''}
      </div>`;
      lastDate = ds;
    }
    const cls    = e._tipo_ext === 'tarea' ? 'ev-tarea-ext' : '';
    const bcls   = e._tipo_ext === 'tarea' ? 'ev-tarea' : (TIPO_COLORS[e.tipo] || 'ev-otro');
    const hora   = e.todo_dia ? 'Todo el día' : `${e.hora_inicio||''} – ${e.hora_fin||''}`;
    const label  = e._tipo_ext === 'tarea' ? '⏳ Tarea' : (TIPO_LABELS[e.tipo] || 'Evento');
    const click  = e._tipo_ext === 'tarea' ? '' : `onclick="openModal('${e.id}')"`;

    html += `<div class="agenda-ev-row ${cls}" ${click}>
      <span class="agenda-ev-hora">${hora}</span>
      <span class="agenda-ev-titulo">${escHtml(e.titulo||'')}</span>
      <span class="agenda-ev-badge ${bcls}">${label}</span>
      ${e.asignado_a ? `<span class="agenda-ev-asig">${escHtml(e.asignado_a)}</span>` : ''}
    </div>`;
  });

  document.getElementById('agendaList').innerHTML = html;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id = null, fechaDefault = null) {
  editingId = id;
  document.getElementById('modalTitle').textContent = id ? 'Editar evento' : 'Nuevo evento';
  document.getElementById('btnEliminarEvento').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('btnGcalExport').style.display     = (id && gcalConnected) ? 'inline-flex' : 'none';
  resetForm();

  if (fechaDefault) {
    document.getElementById('e_fecha').value = fechaDefault;
  }

  if (id) {
    const e = allEventos.find(x => x.id === id);
    if (!e) return;
    document.getElementById('e_titulo').value       = e.titulo       || '';
    document.getElementById('e_tipo').value         = e.tipo         || 'visita';
    document.getElementById('e_asignado').value     = e.asignado_a   || 'Todos';
    document.getElementById('e_fecha').value        = (e.fecha       || '').slice(0, 10);
    document.getElementById('e_hora_inicio').value  = e.hora_inicio  || '09:00';
    document.getElementById('e_hora_fin').value     = e.hora_fin     || '10:00';
    document.getElementById('e_todo_dia').value     = e.todo_dia ? '1' : '0';
    document.getElementById('e_descripcion').value  = e.descripcion  || '';
    document.getElementById('e_ubicacion').value    = e.ubicacion    || '';
    if (e.cliente_id) {
      document.getElementById('e_cliente_id').value           = e.cliente_id;
      document.getElementById('e_cliente_nombre_hidden').value = e.cliente_nombre || '';
      document.getElementById('e_cliente_email_hidden').value  = e.cliente_email  || '';
      document.getElementById('eClienteDesc').textContent     = e.cliente_nombre  || '';
      document.getElementById('eClienteSeleccionado').style.display = 'flex';
    }
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

function resetForm() {
  document.getElementById('e_titulo').value      = '';
  document.getElementById('e_tipo').value        = 'visita';
  document.getElementById('e_asignado').value    = 'Todos';
  document.getElementById('e_hora_inicio').value = '09:00';
  document.getElementById('e_hora_fin').value    = '10:00';
  document.getElementById('e_todo_dia').value    = '0';
  document.getElementById('e_descripcion').value = '';
  document.getElementById('e_ubicacion').value   = '';
  limpiarClienteCal();
  setDefaultFecha();
}

function setDefaultFecha() {
  const el = document.getElementById('e_fecha');
  if (!el || el.value) return;
  el.value = new Date().toISOString().slice(0, 10);
}

// ── Guardar ───────────────────────────────────────────────────────────────────
async function guardarEvento() {
  const titulo      = document.getElementById('e_titulo').value.trim();
  const fecha       = document.getElementById('e_fecha').value;
  if (!titulo || !fecha) {
    showToast('Título y fecha son requeridos', 'error'); return;
  }

  const payload = {
    titulo,
    tipo:           document.getElementById('e_tipo').value,
    asignado_a:     document.getElementById('e_asignado').value,
    fecha,
    hora_inicio:    document.getElementById('e_hora_inicio').value,
    hora_fin:       document.getElementById('e_hora_fin').value,
    todo_dia:       document.getElementById('e_todo_dia').value === '1',
    descripcion:    document.getElementById('e_descripcion').value.trim(),
    ubicacion:      document.getElementById('e_ubicacion').value.trim(),
    cliente_id:     document.getElementById('e_cliente_id').value     || null,
    cliente_nombre: document.getElementById('e_cliente_nombre_hidden').value || null,
    cliente_email:  document.getElementById('e_cliente_email_hidden').value  || null,
  };

  try {
    const url    = editingId ? `/api/calendario/${editingId}` : '/api/calendario';
    const method = editingId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method, headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.error || 'Error al guardar', 'error'); return; }
    const savedId = data.id || editingId;
    closeModal();
    await cargarEventos();
    showToast(editingId ? 'Evento actualizado' : 'Evento creado');
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

async function eliminarEvento() {
  const e = allEventos.find(x => x.id === editingId);
  if (!confirm(`¿Eliminar "${e?.titulo || editingId}"?`)) return;
  try {
    const res  = await fetch(`/api/calendario/${editingId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.ok) { showToast('Error al eliminar', 'error'); return; }
    closeModal();
    await cargarEventos();
    showToast('Evento eliminado');
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

// ── Exportar a Google Calendar ────────────────────────────────────────────────
async function exportarGcal() {
  if (!editingId) return;
  const e = allEventos.find(x => x.id === editingId);
  if (!e) return;

  const payload = {
    titulo:       e.titulo || '',
    fecha:        (e.fecha || '').slice(0, 10),
    hora_ini:     e.hora_inicio || '09:00',
    hora_fin:     e.hora_fin    || '10:00',
    descripcion:  e.descripcion || '',
    email_cliente: e.cliente_email || '',
    ubicacion:    e.ubicacion || 'Corze, Santiago, Chile',
  };

  try {
    const res  = await fetch('/api/calendar/agendar', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('✅ Evento creado en Google Calendar');
      if (data.link) window.open(data.link, '_blank');
    } else if (data.auth_url) {
      if (confirm('Google Calendar no está conectado. ¿Conectar ahora?')) {
        window.location.href = data.auth_url;
      }
    } else {
      showToast(data.error || 'Error al exportar', 'error');
    }
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

// ── Cliente search ────────────────────────────────────────────────────────────
let _calClienteTimeout = null;
async function buscarClienteCal(q) {
  clearTimeout(_calClienteTimeout);
  const box = document.getElementById('eClienteSuggestions');
  if (q.length < 2) { box.style.display = 'none'; return; }
  _calClienteTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(`/api/leads?q=${encodeURIComponent(q)}`);
      const rows = await res.json();
      if (!rows.length) { box.style.display = 'none'; return; }
      box.innerHTML = rows.slice(0, 8).map(r => {
        const nombre  = `${r.nombre || ''} ${r.apellido || ''}`.trim();
        const empresa = r.empresa ? ` — ${r.empresa}` : '';
        const label   = nombre + empresa;
        const email   = r.email || '';
        return `<div style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border2)"
                     onmousedown="seleccionarClienteCal('${r.id}','${escJs(nombre + empresa)}','${escJs(email)}')">${escHtml(label)}${email ? `<span style='color:var(--gray3);margin-left:6px'>${escHtml(email)}</span>` : ''}</div>`;
      }).join('');
      box.style.display = 'block';
    } catch(e) { console.error(e); }
  }, 250);
}

function seleccionarClienteCal(id, desc, email) {
  document.getElementById('e_cliente_id').value            = id;
  document.getElementById('e_cliente_nombre_hidden').value = desc;
  document.getElementById('e_cliente_email_hidden').value  = email;
  document.getElementById('eClienteDesc').textContent      = desc;
  document.getElementById('eClienteSeleccionado').style.display = 'flex';
  document.getElementById('eClienteSuggestions').style.display  = 'none';
  document.getElementById('e_cliente_search').value = '';
}

function limpiarClienteCal() {
  document.getElementById('e_cliente_id').value            = '';
  document.getElementById('e_cliente_nombre_hidden').value = '';
  document.getElementById('e_cliente_email_hidden').value  = '';
  document.getElementById('eClienteSeleccionado').style.display = 'none';
  const s = document.getElementById('e_cliente_search');
  if (s) s.value = '';
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
