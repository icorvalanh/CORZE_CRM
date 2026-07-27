// crm.js — VTA CRM v2 · Corregido

'use strict';

// CRM_USERS se inyecta desde crm.html via <script>
let allConvs     = [];
let activeConvId = null;
let filterEstado = '';
let filterQuery  = '';
let pollTimer    = null;

// ════════════════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadConversaciones();
  // Polling cada 4 segundos
  pollTimer = setInterval(poll, 4000);
});

async function poll() {
  await loadConversaciones(true);
  if (activeConvId) await loadMensajes(activeConvId, true);
}

// ════════════════════════════════════════════════════════════════════════════
//  CONVERSACIONES
// ════════════════════════════════════════════════════════════════════════════
async function loadConversaciones(silent = false) {
  try {
    const data = await api('/api/crm/conversaciones');
    allConvs = data;
    applyConvFilter();
    renderConvStats(data);
  } catch(e) {
    if (!silent) {
      document.getElementById('convList').innerHTML =
        `<div class="conv-empty">Error cargando: ${e}</div>`;
    }
  }
}

function applyConvFilter() {
  let convs = [...allConvs];
  if (filterEstado) convs = convs.filter(c => c.estado === filterEstado);
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    convs = convs.filter(c =>
      (c.nombre_cliente||'').toLowerCase().includes(q) ||
      (c.telefono||'').toLowerCase().includes(q) ||
      (c.ultimo_mensaje||'').toLowerCase().includes(q)
    );
  }
  renderConvList(convs);
}

function filterConvs(estado, btn) {
  filterEstado = estado;
  document.querySelectorAll('.cf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyConvFilter();
}

function searchConvs(q) { filterQuery = q; applyConvFilter(); }

function renderConvStats(convs) {
  const nuevos    = convs.filter(c => c.estado === 'nuevo').length;
  const atencion  = convs.filter(c => c.estado === 'en_atencion').length;
  const resueltos = convs.filter(c => c.estado === 'resuelto').length;
  const el = document.getElementById('convStats');
  if (el) el.innerHTML = `
    <span class="cstat red">🔴 ${nuevos}</span>
    <span class="cstat yellow">🟡 ${atencion}</span>
    <span class="cstat green">✅ ${resueltos}</span>`;
}

function renderConvList(convs) {
  const el = document.getElementById('convList');
  if (!el) return;

  if (!convs.length) {
    el.innerHTML = `<div class="conv-empty">
      Sin conversaciones aún.<br>
      <small style="color:var(--gray3)">Los mensajes de WhatsApp y Facebook aparecerán aquí automáticamente</small>
    </div>`;
    return;
  }

  el.innerHTML = convs.map(c => {
    const canalIcon = c.canal === 'whatsapp' ? '📱' : '💬';
    const isActive  = activeConvId === c.id ? ' active' : '';
    const hora      = c.ultima_hora ? formatHora(c.ultima_hora) : '';
    const noLeidos  = parseInt(c.no_leidos || 0) > 0
      ? `<span class="badge-unread">${c.no_leidos}</span>` : '';
    const estadoBorder = {
      nuevo: 'conv-new', en_atencion: 'conv-att', resuelto: 'conv-res'
    }[c.estado] || '';

    return `<div class="conv-item${isActive} ${estadoBorder}" data-conv="${c.id}" onclick="openConv('${c.id}')">
      <div class="conv-avatar" style="background:${canalColor(c.canal)}">
        ${c.nombre_cliente ? c.nombre_cliente[0].toUpperCase() : (c.canal === 'whatsapp' ? '📱' : '💬')}
      </div>
      <div class="conv-info">
        <div class="conv-name-row">
          <span class="conv-name">${escapeHTML(c.nombre_cliente || c.telefono || 'Desconocido')}</span>
          <span class="conv-time">${hora}</span>
        </div>
        <div class="conv-preview-row">
          <span class="conv-canal">${canalIcon}</span>
          <span class="conv-preview">${escapeHTML(c.ultimo_mensaje || '...')}</span>
          ${noLeidos}
        </div>
        ${c.asignado_a ? `<div class="conv-assigned">👤 ${escapeHTML(c.asignado_a)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function canalColor(canal) {
  return canal === 'whatsapp' ? '#25D366' : '#0866FF';
}

// ════════════════════════════════════════════════════════════════════════════
//  ABRIR CONVERSACIÓN
// ════════════════════════════════════════════════════════════════════════════
async function openConv(convId) {
  activeConvId = convId;
  applyConvFilter();

  const conv = allConvs.find(c => c.id === convId);
  if (!conv) return;

  await api(`/api/crm/conversaciones/${convId}/leer`, 'POST');
  renderChatPanel(conv);
  renderClientPanel(conv);
  await loadMensajes(convId);
}

// ════════════════════════════════════════════════════════════════════════════
//  CHAT PANEL
// ════════════════════════════════════════════════════════════════════════════
function renderChatPanel(conv) {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;

  const color = canalColor(conv.canal);

  // Opciones de usuario — CRM_USERS viene inyectado desde el template
  const userOpts = (window.CRM_USERS || []).map(u =>
    `<option value="${u}" ${conv.asignado_a === u ? 'selected' : ''}>${u}</option>`
  ).join('');

  panel.innerHTML = `
    <div class="chat-header">
      <div class="conv-avatar" style="background:${color};width:38px;height:38px;font-size:15px">
        ${conv.nombre_cliente ? conv.nombre_cliente[0].toUpperCase() : '?'}
      </div>
      <div class="chat-header-info">
        <div class="chat-header-name">${escapeHTML(conv.nombre_cliente || conv.telefono || 'Desconocido')}</div>
        <div class="chat-header-sub">
          <span style="color:${color}">${conv.canal === 'whatsapp' ? '📱 WhatsApp' : '💬 Messenger'}</span>
          ${conv.telefono ? ` · ${conv.telefono}` : ''}
        </div>
      </div>
      <div class="chat-header-actions">
        <select class="chat-estado-sel" onchange="cambiarEstado('${conv.id}', this.value)">
          <option value="nuevo"       ${conv.estado==='nuevo'       ?'selected':''}>🔴 Nuevo</option>
          <option value="en_atencion" ${conv.estado==='en_atencion' ?'selected':''}>🟡 En atención</option>
          <option value="resuelto"    ${conv.estado==='resuelto'    ?'selected':''}>✅ Resuelto</option>
        </select>
        <select class="chat-asign-sel" onchange="asignar('${conv.id}', this.value)">
          <option value="">👤 Sin asignar</option>
          ${userOpts}
        </select>
      </div>
    </div>

    <div class="chat-messages" id="chatMessages">
      <div style="text-align:center;padding:20px;color:var(--gray3);font-size:12px">
        Cargando mensajes...
      </div>
    </div>

    <div class="chat-input-area">
      <textarea id="msgInput" class="chat-input"
        placeholder="Escribir mensaje... (Enter para enviar, Shift+Enter nueva línea)"
        onkeydown="handleMsgKey(event,'${conv.id}')"></textarea>
      <button class="chat-send-btn" onclick="enviarMensaje('${conv.id}')">➤</button>
    </div>`;

  setTimeout(() => document.getElementById('msgInput')?.focus(), 100);
}

async function loadMensajes(convId, silent = false) {
  try {
    const msgs = await api(`/api/crm/conversaciones/${convId}/mensajes`);
    renderMensajes(msgs);
  } catch(e) {
    if (!silent) {
      const el = document.getElementById('chatMessages');
      if (el) el.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center">Error: ${e}</div>`;
    }
  }
}

function renderMensajes(msgs) {
  const el = document.getElementById('chatMessages');
  if (!el) return;

  if (!msgs.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray3);font-size:12px">
      Sin mensajes aún — escribe el primero 👇</div>`;
    return;
  }

  let lastDate = '';
  el.innerHTML = msgs.map(m => {
    const esVTA  = m.direccion === 'saliente';
    const fecha  = (m.timestamp || '').slice(0, 10);
    let dateSep  = '';

    if (fecha && fecha !== lastDate) {
      lastDate = fecha;
      dateSep  = `<div class="msg-date-sep"><span>${formatFecha(fecha)}</span></div>`;
    }

    const hora   = m.timestamp ? formatHora(m.timestamp) : '';
    const checks = esVTA ? (m.leido ? ' ✓✓' : ' ✓') : '';

    return `${dateSep}
    <div class="msg-row ${esVTA ? 'msg-out' : 'msg-in'}">
      <div class="msg-bubble ${esVTA ? 'bubble-out' : 'bubble-in'}">
        ${!esVTA && m.nombre_remitente
          ? `<div class="msg-sender">${escapeHTML(m.nombre_remitente)}</div>` : ''}
        <div class="msg-text">${escapeHTML(m.contenido || '')}</div>
        <div class="msg-meta">${hora}${checks}</div>
      </div>
    </div>`;
  }).join('');

  el.scrollTop = el.scrollHeight;
}

function handleMsgKey(e, convId) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarMensaje(convId);
  }
}

async function enviarMensaje(convId) {
  const input = document.getElementById('msgInput');
  if (!input) return;
  const texto = input.value.trim();
  if (!texto) return;

  input.value    = '';
  input.disabled = true;

  try {
    const result = await api(`/api/crm/conversaciones/${convId}/enviar`, 'POST',
      { mensaje: texto });
    if (result.ok) {
      await loadMensajes(convId);
    } else {
      toast('Error enviando: ' + (result.error || ''), 'error');
      input.value = texto;
    }
  } catch(e) {
    toast('Error de red al enviar', 'error');
    input.value = texto;
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  PANEL CLIENTE
// ════════════════════════════════════════════════════════════════════════════
function renderClientPanel(conv) {
  const panel = document.getElementById('clientPanel');
  if (!panel) return;

  const color = canalColor(conv.canal);

  panel.innerHTML = `
    <div class="client-header">
      <div class="client-avatar" style="background:${color}">
        ${conv.nombre_cliente ? conv.nombre_cliente[0].toUpperCase() : '?'}
      </div>
      <div class="client-name">${escapeHTML(conv.nombre_cliente || 'Desconocido')}</div>
      <div class="client-sub">${escapeHTML(conv.telefono || conv.sender_id || '')}</div>
    </div>

    <div class="client-section">INFO</div>
    ${cdr('Canal',       conv.canal === 'whatsapp' ? '📱 WhatsApp' : '💬 Messenger')}
    ${cdr('Teléfono',    conv.telefono || '—')}
    ${cdr('Desde',       formatFecha((conv.fecha_inicio||'').slice(0,10)))}
    ${cdr('Mensajes',    conv.total_mensajes || 0)}
    ${cdr('Asignado a',  conv.asignado_a || 'Sin asignar')}

    <div class="client-section">NOMBRE DEL CLIENTE</div>
    <div style="padding:8px 12px">
      <input type="text" id="clientNombre" class="client-input"
             value="${escapeHTML(conv.nombre_cliente || '')}"
             placeholder="Nombre del cliente">
      <button class="btn btn-primary" style="width:100%;margin-top:6px;font-size:11px"
              onclick="guardarNombre('${conv.id}')">💾 Guardar</button>
    </div>

    <div class="client-section">VINCULAR VEHÍCULO</div>
    <div style="padding:8px 12px">
      <input type="text" id="vehiculoSearch" class="client-input"
             placeholder="Buscar patente o modelo..."
             oninput="buscarVehiculo(this.value,'${conv.id}')">
      <div id="vehiculoResults"></div>
      ${conv.vehiculo_vinculado ? `
        <div class="vehiculo-vinculado">
          🚗 ${escapeHTML(conv.vehiculo_vinculado.patente||'')} · ${escapeHTML(conv.vehiculo_vinculado.marca||'')} ${escapeHTML(conv.vehiculo_vinculado.modelo||'')}
          <button onclick="desvincularVehiculo('${conv.id}')"
                  style="color:var(--red);background:none;border:none;cursor:pointer;font-size:11px">✕</button>
        </div>` : '<div style="font-size:10px;color:var(--gray3);padding:4px 0">Sin vehículo vinculado</div>'}
    </div>

    <div class="client-section">ETAPA PIPELINE</div>
    <div style="padding:6px 12px 10px">
      <select id="clientEtapa" class="client-input" style="width:100%;font-size:11px"
              onchange="cambiarEtapa('${conv.id}', this.value)">
        ${['Nuevo','Contactado','Agendado','Fotografiado','En Venta','Vendido','Descartado'].map(e =>
          `<option value="${e}" ${(conv.etapa_crm||'Nuevo')===e?'selected':''}>${e}</option>`
        ).join('')}
      </select>
    </div>

    <div class="client-section">NOTAS</div>
    <div style="padding:8px 12px">
      <textarea id="clientNotas" class="client-input" rows="4"
                placeholder="Notas sobre el cliente...">${escapeHTML(conv.notas || '')}</textarea>
    </div>
    <div style="padding:4px 12px 16px;display:flex;gap:6px">
      <button class="btn btn-secondary" style="font-size:10px;padding:5px 10px;flex:1"
              onclick="guardarNotas('${conv.id}')">💾 Guardar notas</button>
      <button class="btn" style="font-size:10px;padding:5px 10px;flex:1;background:#0D3B22;color:#2ECC71;font-weight:600"
              onclick="if(window.openCalModal) openCalModal('${conv.id}')">📅 Agendar visita</button>
    </div>`;
}

function cdr(label, value) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value || '—'}</span>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  ACCIONES
// ════════════════════════════════════════════════════════════════════════════
async function cambiarEstado(convId, estado) {
  await api(`/api/crm/conversaciones/${convId}`, 'PUT', { estado });
  await loadConversaciones();
}

async function asignar(convId, usuario) {
  await api(`/api/crm/conversaciones/${convId}`, 'PUT', { asignado_a: usuario });
  await loadConversaciones(true);
  toast(usuario ? `Asignado a ${usuario}` : 'Asignación removida', 'info');
}

async function guardarNombre(convId) {
  const nombre = document.getElementById('clientNombre')?.value.trim();
  if (!nombre) return;
  await api(`/api/crm/conversaciones/${convId}`, 'PUT', { nombre_cliente: nombre });
  await loadConversaciones(true);
  toast('Nombre guardado', 'success');
}

async function guardarNotas(convId) {
  const notas = document.getElementById('clientNotas')?.value || '';
  await api(`/api/crm/conversaciones/${convId}`, 'PUT', { notas });
  toast('Notas guardadas', 'success');
}

async function buscarVehiculo(q, convId) {
  const el = document.getElementById('vehiculoResults');
  if (!el) return;
  if (!q || q.length < 2) { el.innerHTML = ''; return; }
  const rows = await api(`/api/inventario?q=${encodeURIComponent(q)}`);
  el.innerHTML = rows.slice(0, 5).map(r =>
    `<div class="vehiculo-result"
          onclick="vincularVehiculo('${convId}','${r.id}','${r.patente}','${r.marca}','${r.modelo}')">
       🚗 ${r.patente} · ${r.marca} ${r.modelo} · ${r.anio}
     </div>`
  ).join('') || '<div style="color:var(--gray3);font-size:11px;padding:6px">Sin resultados</div>';
}

async function vincularVehiculo(convId, vId, patente, marca, modelo) {
  await api(`/api/crm/conversaciones/${convId}`, 'PUT', {
    vehiculo_id: vId,
    vehiculo_vinculado: { patente, marca, modelo }
  });
  document.getElementById('vehiculoResults').innerHTML = '';
  document.getElementById('vehiculoSearch').value = '';
  const conv = allConvs.find(c => c.id === convId);
  if (conv) { conv.vehiculo_vinculado = { patente, marca, modelo }; renderClientPanel(conv); }
  toast(`Vehículo ${patente} vinculado`, 'success');
}

async function desvincularVehiculo(convId) {
  await api(`/api/crm/conversaciones/${convId}`, 'PUT',
    { vehiculo_id: '', vehiculo_vinculado: {} });
  const conv = allConvs.find(c => c.id === convId);
  if (conv) { conv.vehiculo_vinculado = null; renderClientPanel(conv); }
  toast('Vehículo desvinculado', 'info');
}

// ════════════════════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════════════════════
function formatHora(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
  } catch { return ts.slice(11,16) || ''; }
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  try {
    const hoy  = new Date().toISOString().slice(0,10);
    const ayer = new Date(Date.now()-86400000).toISOString().slice(0,10);
    if (fecha === hoy)  return 'Hoy';
    if (fecha === ayer) return 'Ayer';
    return new Date(fecha+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short'});
  } catch { return fecha; }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

// ── Cambiar etapa desde panel de cliente ──────────────────────────────────────
async function cambiarEtapa(convId, etapa) {
  const r = await api(`/api/crm/conversacion/${convId}/etapa`, 'PUT', { etapa });
  if (r.ok) {
    toast(`📋 Movido a ${etapa}`, 'success');
  } else {
    toast('Error cambiando etapa', 'error');
  }
}

// ── Modal Nuevo Lead ──────────────────────────────────────────────────────────
function abrirNuevoLead() {
  ['nl_nombre','nl_telefono','nl_email','nl_vehiculo','nl_notas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('nlStatus').textContent = '';
  const m = document.getElementById('modalNuevoLead');
  if (m) m.style.display = 'flex';
}

function cerrarNuevoLead() {
  const m = document.getElementById('modalNuevoLead');
  if (m) m.style.display = 'none';
}

async function guardarNuevoLead() {
  const nombre   = document.getElementById('nl_nombre')?.value.trim();
  const telefono = document.getElementById('nl_telefono')?.value.trim();
  const status   = document.getElementById('nlStatus');

  if (!nombre && !telefono) {
    status.style.color = 'var(--red)';
    status.textContent = '⚠️ Ingresa al menos nombre o teléfono';
    return;
  }

  status.style.color   = 'var(--gray2)';
  status.textContent   = 'Creando lead...';

  const r = await api('/api/crm/leads', 'POST', {
    nombre,
    telefono,
    email:            document.getElementById('nl_email')?.value.trim(),
    vehiculo_interes: document.getElementById('nl_vehiculo')?.value.trim(),
    notas:            document.getElementById('nl_notas')?.value.trim(),
    canal:            document.getElementById('nl_canal')?.value,
    etapa:            document.getElementById('nl_etapa')?.value,
  });

  if (r.ok) {
    status.style.color = 'var(--green)';
    status.textContent = '✅ Lead creado correctamente';
    setTimeout(() => {
      cerrarNuevoLead();
      loadConversaciones();
    }, 1000);
  } else {
    status.style.color = 'var(--red)';
    status.textContent = '❌ Error: ' + (r.error || 'desconocido');
  }
}
