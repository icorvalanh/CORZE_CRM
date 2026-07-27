// config.js — VTA Configuración

// ── Tabs ──────────────────────────────────────────────────────────────────────
const PANELS = { metas:'Metas', costos:'Costos', wa:'WA', ia:'Ia' };
function switchTab(tab, btn) {
  Object.keys(PANELS).forEach(t => {
    document.getElementById('panel' + PANELS[t]).style.display = t === tab ? '' : 'none';
    document.getElementById('tab_' + t).classList.toggle('active', t === tab);
  });
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  document.getElementById('meta_mes').value =
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  cargarMetaProgress();
  cargarCostosFijos();
  cargarWATemplates();
  cargarClaudeStatus();
});

// ════════════════════════════════════════════════════════════════════════════
//  METAS
// ════════════════════════════════════════════════════════════════════════════
function fmtMetaIngresos(el) {
  const raw = el.value.replace(/\D/g,'');
  document.getElementById('meta_ingresos_val').value = raw;
  el.value = raw ? new Intl.NumberFormat('es-CL').format(parseInt(raw)) : '';
}

async function guardarMeta() {
  const mes       = document.getElementById('meta_mes').value;
  const unidades  = parseInt(document.getElementById('meta_unidades').value) || 0;
  const ingresos  = parseInt(document.getElementById('meta_ingresos_val').value) || 0;
  if (!mes) { showToast('Selecciona un mes', 'error'); return; }
  const r = await fetch('/api/config/meta', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({mes, unidades, ingresos}),
  });
  const d = await r.json();
  if (d.ok) { showToast('Meta guardada'); cargarMetaProgress(); }
  else showToast('Error al guardar', 'error');
}

async function cargarMetaProgress() {
  const now = new Date();
  const mes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('metaMesLabel').textContent =
    now.toLocaleDateString('es-CL', {month:'long', year:'numeric'});

  const [metaRes, statsRes] = await Promise.all([
    fetch(`/api/config/meta?mes=${mes}`).then(r => r.json()),
    fetch('/api/stats').then(r => r.json()).catch(() => ({})),
  ]);

  const panel = document.getElementById('metaProgressPanel');
  const metaU = metaRes.unidades || 0;
  const metaI = metaRes.ingresos || 0;
  const actU  = statsRes.vendidos_mes || 0;

  if (!metaU && !metaI) {
    panel.innerHTML = `<div style="text-align:center;padding:24px;color:var(--gray3);font-size:12px">
      Sin meta definida para este mes.<br>Completa el formulario para establecerla.</div>`;
    return;
  }

  const pctU = metaU > 0 ? Math.min(100, (actU / metaU * 100)).toFixed(2) : 0;
  const pctUI = metaU > 0 ? (actU / metaU * 100).toFixed(2) : '—';
  const colU  = parseFloat(pctU) >= 100 ? '#27ae60' : parseFloat(pctU) >= 60 ? '#F1C40F' : '#e74c3c';

  const diasMes = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const diasPasados = now.getDate();
  const diasRest = diasMes - diasPasados;
  const ritmo = diasPasados > 0 ? (actU / diasPasados * diasMes).toFixed(1) : 0;

  panel.innerHTML = `
    <!-- Unidades -->
    <div style="margin-bottom:20px">
      <div class="meta-stat">
        <span class="meta-label">Unidades vendidas</span>
        <span class="meta-pct" style="color:${colU}">${pctUI}%</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
        <span class="meta-val" style="color:${colU}">${actU}</span>
        <span style="font-size:12px;color:var(--gray3)">/ ${metaU} objetivo</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pctU}%;background:${colU}"></div>
      </div>
      <div style="font-size:10px;color:var(--gray3);margin-top:4px">
        Ritmo proyectado: <strong style="color:${colU}">${ritmo}</strong> unidades al cierre del mes ·
        Quedan <strong>${diasRest}</strong> días
      </div>
    </div>

    ${metaI > 0 ? `
    <!-- Ingresos desde finanzas -->
    <div id="metaIngresosBlock">
      <div class="meta-stat">
        <span class="meta-label">Meta de ingresos</span>
        <span style="font-size:10px;color:var(--gray3)">${clpFmt(metaI)} objetivo</span>
      </div>
      <div style="font-size:11px;color:var(--gray2);margin-top:4px">
        Comparar con ingresos reales en <a href="/admin/finanzas" style="color:var(--blue)">Finanzas</a>
      </div>
    </div>` : ''}

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border1);
                display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--gray3)">Días transcurridos</div>
        <div style="font-size:20px;font-weight:700;color:var(--blue)">${diasPasados}</div>
        <div style="font-size:10px;color:var(--gray3)">de ${diasMes}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--gray3)">Quedan</div>
        <div style="font-size:20px;font-weight:700;color:${diasRest < 7 ? '#e74c3c':'var(--text1)'}">${diasRest}</div>
        <div style="font-size:10px;color:var(--gray3)">días</div>
      </div>
    </div>`;
}

function clpFmt(n) {
  if (!n) return '$0';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
  return '$' + n.toLocaleString('es-CL');
}

// ════════════════════════════════════════════════════════════════════════════
//  COSTOS FIJOS
// ════════════════════════════════════════════════════════════════════════════
let costosFijos = [];

function fmtCf(el) {
  const raw = el.value.replace(/\D/g,'');
  el.value = raw ? new Intl.NumberFormat('es-CL').format(parseInt(raw)) : '';
  el.dataset.val = raw;
}

async function cargarCostosFijos() {
  const r = await fetch('/api/config/costos-fijos');
  costosFijos = await r.json();
  renderCostos();
}

function renderCostos() {
  const lista = document.getElementById('cfLista');
  const total = costosFijos.reduce((s,c) => s + (c.monto||0), 0);
  document.getElementById('cfTotal').textContent = clpFmt(total);

  if (!costosFijos.length) {
    lista.innerHTML = `<div style="color:var(--gray3);font-size:12px;text-align:center;padding:24px">
      Sin costos fijos registrados.</div>`;
    return;
  }

  const cats = { 'Arriendo / Oficina':'#00AEEF','Servicios básicos':'#F1C40F','Sueldo / Personal':'#2ECC71',
    'Publicidad':'#9B59B6','Software / Herramientas':'#3498DB','Contabilidad / Legal':'#E67E22',
    'Combustible':'#E74C3C','Otro':'#4A5568' };

  lista.innerHTML = costosFijos.map((c, i) => {
    const col = cats[c.categoria] || '#4A5568';
    return `<div class="cf-item">
      <div style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text1)">${escHtml(c.nombre)}</div>
        <div style="font-size:10px;color:var(--gray3)">${escHtml(c.categoria)}</div>
      </div>
      <div style="font-size:15px;font-weight:700;color:${col}">${clpFmt(c.monto)}</div>
      <button onclick="eliminarCosto(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 4px">🗑️</button>
    </div>`;
  }).join('');
}

function agregarCosto() {
  const nombre = document.getElementById('cf_nombre').value.trim();
  const cat    = document.getElementById('cf_cat').value;
  const montoEl = document.getElementById('cf_monto');
  const monto  = parseInt(montoEl.dataset.val || montoEl.value.replace(/\D/g,'')) || 0;
  if (!nombre || !monto) { showToast('Completa nombre y monto', 'error'); return; }
  costosFijos.push({ nombre, categoria: cat, monto });
  guardarCostos();
  document.getElementById('cf_nombre').value = '';
  montoEl.value = '';
  montoEl.dataset.val = '';
}

function eliminarCosto(i) {
  if (!confirm('¿Eliminar este costo fijo?')) return;
  costosFijos.splice(i, 1);
  guardarCostos();
}

async function guardarCostos() {
  const r = await fetch('/api/config/costos-fijos', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ items: costosFijos }),
  });
  const d = await r.json();
  if (d.ok) { renderCostos(); showToast('Costos fijos actualizados'); }
  else showToast('Error al guardar', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  WHATSAPP TEMPLATES
// ════════════════════════════════════════════════════════════════════════════
let waTemplates = [];

const WA_BASES = [
  {
    nombre: 'Seguimiento inicial',
    categoria: 'Seguimiento',
    mensaje: `Hola {{nombre}} 👋, te contacto de *VTA Automotora*.

Vi que te interesó el *{{marca}} {{modelo}} {{anio}}* que tenemos disponible por *{{precio}}*.

¿Tienes alguna consulta o te gustaría coordinar una visita para verlo personalmente?

Quedamos atentos 🚗`,
  },
  {
    nombre: 'Confirmación de visita',
    categoria: 'Confirmación de visita',
    mensaje: `Hola {{nombre}} ✅, confirmamos tu visita para ver el *{{marca}} {{modelo}} {{anio}}*.

📅 Fecha: *{{fecha}}*
🕐 Hora: *{{hora}}*
📍 Av. [dirección VTA]

Si necesitas cambiar la hora, avísanos con anticipación. ¡Te esperamos!`,
  },
  {
    nombre: 'Seguimiento post-visita',
    categoria: 'Seguimiento',
    mensaje: `Hola {{nombre}}, fue un gusto recibirte hoy en VTA 🚗

¿Quedaste con alguna duda sobre el *{{marca}} {{modelo}}*? Estamos disponibles para resolver cualquier consulta o explorar opciones de financiamiento.`,
  },
  {
    nombre: 'Felicitación post-venta',
    categoria: 'Post-venta',
    mensaje: `Hola {{nombre}} 🎉, muchas gracias por tu confianza en *VTA Automotora*.

Esperamos que disfrutes mucho tu *{{marca}} {{modelo}} {{anio}}*. Recuerda que ante cualquier duda o necesidad, estamos aquí.

¡Buen viaje! 🚗💨`,
  },
  {
    nombre: 'Oferta especial',
    categoria: 'Oferta especial',
    mensaje: `Hola {{nombre}} 👋, te escribo de *VTA Automotora* con una oferta especial.

Tenemos el *{{marca}} {{modelo}} {{anio}}* disponible a *{{precio}}*, con posibilidad de conversarlo 😊

¿Te interesa coordinamos una visita esta semana?`,
  },
];

function cargarBase(i) {
  const b = WA_BASES[i];
  document.getElementById('wa_nombre').value   = b.nombre;
  document.getElementById('wa_cat').value      = b.categoria;
  document.getElementById('wa_mensaje').value  = b.mensaje;
}

async function cargarWATemplates() {
  const r = await fetch('/api/config/wa-templates');
  waTemplates = await r.json();
  renderWA();
}

function renderWA() {
  const lista = document.getElementById('waLista');
  if (!waTemplates.length) {
    lista.innerHTML = `<div style="color:var(--gray3);font-size:12px;text-align:center;padding:24px">
      Sin templates guardados. Crea uno o carga una plantilla base.</div>`;
    return;
  }
  lista.innerHTML = waTemplates.map((t, i) => `
    <div class="wa-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text1)">${escHtml(t.nombre)}</div>
          <span class="wa-badge" style="margin-top:3px">${escHtml(t.categoria)}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary" style="font-size:10px;padding:3px 10px"
            onclick="copiarTemplate(${i})" title="Copiar mensaje">📋 Copiar</button>
          <button onclick="eliminarTemplate(${i})"
            style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">🗑️</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--gray2);white-space:pre-wrap;max-height:120px;overflow-y:auto;
                  background:var(--card3);padding:8px 10px;border-radius:8px;line-height:1.5">
        ${escHtml(t.mensaje)}
      </div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-secondary" style="font-size:10px;padding:3px 10px"
          onclick="abrirWA(${i})" title="Abrir en WhatsApp Web">
          📱 Abrir WhatsApp
        </button>
        <span style="font-size:9px;color:var(--gray3);margin-left:4px;align-self:center">
          Sin rellenar variables — editar antes de enviar
        </span>
      </div>
    </div>`).join('');
}

function copiarTemplate(i) {
  const t = waTemplates[i];
  navigator.clipboard.writeText(t.mensaje).then(() => showToast('Mensaje copiado al portapapeles'));
}

function abrirWA(i) {
  const msg = encodeURIComponent(waTemplates[i].mensaje);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function agregarTemplate() {
  const nombre   = document.getElementById('wa_nombre').value.trim();
  const categoria = document.getElementById('wa_cat').value;
  const mensaje  = document.getElementById('wa_mensaje').value.trim();
  if (!nombre || !mensaje) { showToast('Completa nombre y mensaje', 'error'); return; }
  waTemplates.push({ nombre, categoria, mensaje });
  guardarWA();
  document.getElementById('wa_nombre').value  = '';
  document.getElementById('wa_mensaje').value = '';
}

function eliminarTemplate(i) {
  if (!confirm('¿Eliminar este template?')) return;
  waTemplates.splice(i, 1);
  guardarWA();
}

async function guardarWA() {
  const r = await fetch('/api/config/wa-templates', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ templates: waTemplates }),
  });
  const d = await r.json();
  if (d.ok) { renderWA(); showToast('Templates actualizados'); }
  else showToast('Error al guardar', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  GEMINI IA
// ════════════════════════════════════════════════════════════════════════════
async function cargarClaudeStatus() {
  try {
    const r = await fetch('/api/config/claude');
    const d = await r.json();
    const el = document.getElementById('iaKeyStatus');
    if (!el) return;
    if (d.has_key) {
      el.innerHTML = `✅ API key configurada: <code style="font-size:10px;opacity:.7">${d.masked}</code>`;
      el.style.color = 'var(--green)';
    } else {
      el.textContent = '⚠️ Sin API key — configura tu key de Anthropic para usar las funciones de IA';
      el.style.color = 'var(--yellow)';
    }
  } catch(e) {}
}

function toggleKeyVisibility() {
  const inp = document.getElementById('claudeKeyInput');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function guardarClaudeKey() {
  const key = document.getElementById('claudeKeyInput')?.value.trim();
  if (!key) { showToast('Ingresa una API key', 'error'); return; }
  if (!key.startsWith('sk-ant-')) { showToast('La key debe empezar con sk-ant-...', 'error'); return; }
  const r = await fetch('/api/config/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key }),
  });
  const d = await r.json();
  if (d.ok) {
    showToast('API key guardada');
    document.getElementById('claudeKeyInput').value = '';
    cargarClaudeStatus();
  } else {
    showToast('Error al guardar', 'error');
  }
}

async function testClaude() {
  const res = document.getElementById('iaTestResult');
  if (!res) return;
  res.style.display = 'block';
  res.textContent   = '🔌 Probando conexión con Claude...';
  res.style.color   = 'var(--blue)';
  try {
    const r = await fetch('/api/config/claude/test', { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      res.textContent = '✅ ' + d.respuesta;
      res.style.color = 'var(--green)';
    } else {
      res.textContent = '❌ ' + d.error;
      res.style.color = 'var(--red)';
    }
  } catch(e) {
    res.textContent = '❌ Error de red';
    res.style.color = 'var(--red)';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
