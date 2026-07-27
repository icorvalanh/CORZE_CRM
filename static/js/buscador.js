// buscador.js — VTA Buscador (Facebook Marketplace + MercadoLibre)

let fuente       = 'fb';       // 'fb' | 'ml'
let tabActual    = 'resultados';
let resultados   = [];
let guardados    = [];
let currentItem  = null;
let currentOffset = 0;
let totalResults  = 0;
const PAGE_SIZE   = 24;

document.addEventListener('DOMContentLoaded', () => {
  cargarGuardados();
  checkFbSession();
});

// ── Fuente (FB / ML) ──────────────────────────────────────────────────────────
function setFuente(f, btn) {
  fuente = f;
  document.querySelectorAll('#tabFB,#tabML').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('labelFuente').textContent =
    f === 'fb' ? 'Facebook Marketplace' : 'MercadoLibre Chile';
  document.getElementById('fbStatusBar').style.display = f === 'fb' ? 'flex' : 'none';
  document.getElementById('rowCiudad').style.display   = f === 'fb' ? 'flex' : 'none';
  resultados = [];
  totalResults = 0;
  document.getElementById('resultadosGrid').style.display = 'none';
  document.getElementById('busquedaEstado').style.display = 'block';
  document.getElementById('busquedaEstado').textContent   = 'Ingresa un término y presiona Buscar';
  document.getElementById('paginador').style.display      = 'none';
  if (tabActual !== 'guardados') setTab('resultados');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setTab(tab) {
  tabActual = tab;
  document.getElementById('tabResultadosBtn').classList.toggle('active', tab === 'resultados');
  document.getElementById('tabGuardadosBtn').classList.toggle('active', tab === 'guardados');
  document.getElementById('btnGuardadosTab').classList.toggle('active', tab === 'guardados');

  const esResultados = tab === 'resultados';
  document.getElementById('guardadosList').style.display  = esResultados ? 'none' : 'block';
  document.getElementById('panelBusqueda').style.display  = 'block';
  document.getElementById('toolbarTabs').style.display    = 'flex';

  if (esResultados) {
    document.getElementById('busquedaEstado').style.display =
      resultados.length ? 'none' : 'block';
    document.getElementById('resultadosGrid').style.display =
      resultados.length ? 'grid' : 'none';
    document.getElementById('paginador').style.display =
      (fuente === 'ml' && totalResults > PAGE_SIZE) ? 'flex' : 'none';
  } else {
    document.getElementById('busquedaEstado').style.display = 'none';
    document.getElementById('resultadosGrid').style.display = 'none';
    document.getElementById('paginador').style.display      = 'none';
    renderGuardados();
  }
}

// ── FB sesión ─────────────────────────────────────────────────────────────────
async function checkFbSession() {
  try {
    const d = await fetch('/api/buscador/fb/config').then(r => r.json());
    const el = document.getElementById('fbSessionStatus');
    if (d.has_cookies) {
      el.innerHTML = '🟢 Sesión FB configurada' +
        (d.updated_at ? ` <span style="color:var(--gray3)">(${d.updated_at.slice(0,10)})</span>` : '');
      el.style.color = 'var(--green)';
    } else {
      el.textContent = '🔴 Sin sesión — las búsquedas serán limitadas o bloqueadas';
      el.style.color = 'var(--red)';
    }
  } catch(e) {}
}

function toggleCookiesPanel() {
  const p = document.getElementById('panelCookies');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

async function guardarCookies() {
  const cookies = document.getElementById('fbCookiesInput').value.trim();
  const st      = document.getElementById('cookiesStatus');
  if (!cookies) { st.textContent = 'Pega las cookies primero'; st.style.color='var(--red)'; return; }
  st.textContent = 'Guardando...'; st.style.color = 'var(--gray2)';
  try {
    const r = await fetch('/api/buscador/fb/config', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ cookies }),
    }).then(r => r.json());
    if (r.ok) {
      st.textContent = '✅ Cookies guardadas correctamente';
      st.style.color = 'var(--green)';
      document.getElementById('fbCookiesInput').value = '';
      await checkFbSession();
    } else {
      st.textContent = '❌ Error al guardar'; st.style.color = 'var(--red)';
    }
  } catch(e) {
    st.textContent = 'Error de red'; st.style.color = 'var(--red)';
  }
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────
async function buscar(offset = 0) {
  const q         = document.getElementById('b_query').value.trim();
  const anioMin   = document.getElementById('b_anio_min').value.trim();
  const anioMax   = document.getElementById('b_anio_max').value.trim();
  const precioMin = document.getElementById('b_precio_min').value.trim();
  const precioMax = document.getElementById('b_precio_max').value.trim();

  if (!q && !precioMin && !precioMax && fuente === 'ml') {
    showEstado('⚠️ Ingresa al menos una marca o modelo para buscar');
    return;
  }

  currentOffset = offset;
  setTab('resultados');

  const btn = document.getElementById('btnBuscar');
  btn.disabled    = true;
  btn.textContent = fuente === 'fb' ? '⏳ Scrapeando FB...' : '🔍 Buscando ML...';

  showEstado(fuente === 'fb'
    ? '🔵 Abriendo Facebook Marketplace... puede tardar 15-30 segundos'
    : '🟡 Buscando en MercadoLibre...');

  document.getElementById('resultadosGrid').style.display = 'none';
  document.getElementById('paginador').style.display      = 'none';

  try {
    const params = new URLSearchParams();
    if (q)         params.set('q', q);
    if (anioMin)   params.set('anio_min', anioMin);
    if (anioMax)   params.set('anio_max', anioMax);
    if (precioMin) params.set('precio_min', precioMin);
    if (precioMax) params.set('precio_max', precioMax);
    if (fuente === 'ml') params.set('offset', String(offset));
    if (fuente === 'fb') {
      const ciudad = document.getElementById('b_ciudad')?.value || 'santiago';
      params.set('ciudad', ciudad);
    }

    const endpoint = fuente === 'fb' ? '/api/buscador/fb' : '/api/buscador/ml';
    const res  = await fetch(`${endpoint}?${params}`, { signal: AbortSignal.timeout(90000) });
    const data = await res.json();

    if (data.error) {
      const isCookies = data.error.includes('sesión') || data.error.includes('cookies') || data.error.includes('sin_cookies');
      showEstado(`⚠️ ${data.error}`);
      if (isCookies) {
        // Abrir panel cookies automáticamente
        document.getElementById('panelCookies').style.display = 'block';
        document.getElementById('panelCookies').scrollIntoView({behavior:'smooth'});
      }
      return;
    }

    // Normalizar shape de ML vs FB
    resultados = fuente === 'fb'
      ? (data.items || [])
      : (data.results || []).map(r => ({
          id:         r.id,
          titulo:     r.titulo,
          precio:     r.precio,
          precio_txt: r.precio ? `$${Number(r.precio).toLocaleString('es-CL')}` : 'Consultar',
          thumbnail:  r.thumbnail,
          url:        r.link,
          subtitulo:  [r.año, r.km, r.condicion].filter(Boolean).join(' · '),
          ciudad:     r.ubicacion || '',
          fuente:     'ml',
        }));

    totalResults = data.total || resultados.length;

    if (!resultados.length) {
      showEstado(fuente === 'fb'
        ? '🔵 Sin resultados en Facebook Marketplace. Prueba con otros términos o configura la sesión.'
        : '🟡 Sin resultados en MercadoLibre para esos filtros.');
      return;
    }

    document.getElementById('busquedaEstado').style.display = 'none';
    document.getElementById('resultadosGrid').style.display = 'grid';
    renderResultados();

    if (fuente === 'ml' && totalResults > PAGE_SIZE) {
      const pg  = Math.floor(offset / PAGE_SIZE) + 1;
      const tot = Math.ceil(totalResults / PAGE_SIZE);
      document.getElementById('pagLabel').textContent = `Pág ${pg}/${tot} (${totalResults})`;
      document.getElementById('paginador').style.display = 'flex';
    }

  } catch(e) {
    showEstado(`⚠️ Error de conexión: ${e.message || e}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = '🔍 Buscar';
  }
}

function cambiarPag(dir) {
  const next = currentOffset + dir * PAGE_SIZE;
  if (next < 0 || (totalResults && next >= totalResults)) return;
  buscar(next);
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function showEstado(msg) {
  const el = document.getElementById('busquedaEstado');
  el.textContent    = msg;
  el.style.display  = 'block';
}

// ── Render resultados ─────────────────────────────────────────────────────────
function renderResultados() {
  const savedIds = new Set(guardados.map(g => g.ml_id || g.fb_id));
  document.getElementById('resultadosGrid').innerHTML =
    resultados.map(it => cardHtml(it, savedIds.has(it.id))).join('');
}

function cardHtml(it, saved = false) {
  const precio  = it.precio_txt || (it.precio ? `$${Number(it.precio).toLocaleString('es-CL')}` : 'Consultar');
  const imgHtml = it.thumbnail
    ? `<img class="b-card-img" src="${escHtml(it.thumbnail)}" loading="lazy" alt=""
            onerror="this.style.display='none'">`
    : `<div class="b-card-placeholder">🚗</div>`;
  const srcLabel = it.fuente === 'fb' ? 'Facebook' : 'MercadoLibre';
  const srcCls   = it.fuente === 'fb' ? 'fuente-fb' : 'fuente-ml';

  return `
    <div class="b-card" onclick="openDetalle('${escJs(it.id)}')">
      ${saved ? '<span class="saved-badge">⭐</span>' : ''}
      ${imgHtml}
      <div class="b-card-body">
        <span class="b-card-fuente ${srcCls}">${srcLabel}</span>
        <div class="b-card-titulo">${escHtml(it.titulo || '')}</div>
        <div class="b-card-precio">${precio}</div>
        ${it.subtitulo ? `<div class="b-card-sub">${escHtml(it.subtitulo)}</div>` : ''}
        ${it.ciudad ? `<div class="b-card-sub" style="margin-bottom:6px">📍 ${escHtml(it.ciudad)}</div>` : ''}
        <div class="b-card-footer">
          <button class="btn btn-secondary" style="font-size:10px;padding:3px 8px;flex:1"
                  onclick="event.stopPropagation();guardarDirecto('${escJs(it.id)}')">
            ${saved ? '⭐' : '☆'} Guardar
          </button>
          <a href="${escHtml(it.url||'#')}" target="_blank" rel="noopener"
             class="btn btn-primary" style="font-size:10px;padding:3px 8px;flex:1;text-align:center"
             onclick="event.stopPropagation()">Ver →</a>
        </div>
      </div>
    </div>`;
}

// ── Modal detalle ─────────────────────────────────────────────────────────────
function openDetalle(id) {
  currentItem = resultados.find(r => r.id === id) ||
                guardados.find(g => (g.fb_id || g.ml_id) === id);
  if (!currentItem) return;
  const it = currentItem;

  const savedIds = new Set(guardados.map(g => g.fb_id || g.ml_id));
  const saved    = savedIds.has(it.id);

  document.getElementById('detalleTitle').textContent = it.titulo || 'Detalle';
  document.getElementById('btnVerOrigen').href        = it.url || '#';
  const btnG = document.getElementById('btnGuardarDetalle');
  btnG.textContent = saved ? '⭐ Guardado' : '☆ Guardar';
  btnG.disabled    = saved;

  const precio = it.precio_txt || (it.precio ? `$${Number(it.precio).toLocaleString('es-CL')}` : 'Consultar');
  const filas  = [
    it.subtitulo ? ['Detalles', it.subtitulo]    : null,
    it.ciudad    ? ['Ubicación', '📍 ' + it.ciudad] : null,
    it.fuente    ? ['Fuente',   it.fuente === 'fb' ? 'Facebook Marketplace' : 'MercadoLibre'] : null,
  ].filter(Boolean);

  document.getElementById('detalleBody').innerHTML = `
    ${it.thumbnail ? `<img class="det-img" src="${escHtml(it.thumbnail)}" onerror="this.style.display='none'">` : ''}
    <div class="det-body">
      <div class="det-precio">${precio}</div>
      <div class="det-titulo">${escHtml(it.titulo || '')}</div>
      ${filas.length ? `
      <table class="det-table">
        ${filas.map(([k,v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join('')}
      </table>` : ''}
    </div>`;

  document.getElementById('modalDetalle').classList.add('open');
}

function closeDetalle() {
  document.getElementById('modalDetalle').classList.remove('open');
  currentItem = null;
}

async function guardarDesdeDetalle() {
  if (!currentItem) return;
  await guardarDirecto(currentItem.id);
  closeDetalle();
}

// ── Guardados ─────────────────────────────────────────────────────────────────
async function cargarGuardados() {
  try {
    guardados = await fetch('/api/buscador/guardados').then(r => r.json());
    actualizarBadgeGuardados();
  } catch(e) {}
}

function actualizarBadgeGuardados() {
  const n = guardados.length;
  ['guardadosBadge','guardadosBadge2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent   = n;
    el.style.display = n > 0 ? 'inline' : 'none';
  });
}

function renderGuardados() {
  const inner = document.getElementById('guardadosInner');
  if (!guardados.length) {
    inner.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray3)">
      Sin vehículos guardados aún.</div>`;
    return;
  }
  const savedIds = new Set(guardados.map(g => g.fb_id || g.ml_id));
  inner.innerHTML = guardados.map(g => {
    const it = {
      id:         g.fb_id || g.ml_id,
      titulo:     g.titulo,
      precio:     g.precio,
      precio_txt: g.precio ? `$${Number(g.precio).toLocaleString('es-CL')}` : 'Consultar',
      thumbnail:  g.thumbnail,
      url:        g.url,
      subtitulo:  g.subtitulo || '',
      ciudad:     g.ciudad || '',
      fuente:     g.fuente || 'fb',
    };
    const card = cardHtml(it, true);
    // Reemplazar guardar btn por eliminar
    return card.replace(
      /☆.*?Guardar<\/button>/s,
      `🗑️ Eliminar</button>`
    ).replace(
      `onclick="event.stopPropagation();guardarDirecto('${escJs(it.id)}')"`,
      `onclick="event.stopPropagation();eliminarGuardado('${g.id}')"`
    );
  }).join('');
}

async function guardarDirecto(itemId) {
  const it = resultados.find(r => r.id === itemId) || currentItem;
  if (!it) return;

  const savedIds = new Set(guardados.map(g => g.fb_id || g.ml_id));
  if (savedIds.has(itemId)) { showToast('Ya está guardado', 'error'); return; }

  try {
    const payload = {
      [it.fuente === 'fb' ? 'fb_id' : 'ml_id']: it.id,
      titulo:    it.titulo,
      precio:    it.precio,
      thumbnail: it.thumbnail,
      url:       it.url,
      subtitulo: it.subtitulo,
      ciudad:    it.ciudad,
      fuente:    it.fuente || 'fb',
    };
    const r = await fetch('/api/buscador/guardados', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    }).then(r => r.json());
    if (!r.ok) { showToast(r.error || 'Error al guardar', 'error'); return; }
    await cargarGuardados();
    renderResultados();
    showToast('⭐ Guardado');
  } catch(e) {
    showToast('Error de red', 'error');
  }
}

async function eliminarGuardado(docId) {
  if (!confirm('¿Eliminar de guardados?')) return;
  try {
    const r = await fetch(`/api/buscador/guardados/${docId}`, { method: 'DELETE' }).then(r => r.json());
    if (!r.ok) { showToast('Error al eliminar', 'error'); return; }
    await cargarGuardados();
    renderGuardados();
    showToast('Eliminado de guardados');
  } catch(e) {
    showToast('Error de red', 'error');
  }
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
  el.className   = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}
