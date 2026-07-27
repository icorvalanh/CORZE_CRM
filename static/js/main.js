// main.js — VTA Web · Utilidades globales

function clp(n) {
  if (!n || n === 0) return '—';
  const num = parseInt(n);
  if (num >= 1e9) return '$' + (num/1e9).toFixed(1) + 'B';
  if (num >= 1e6) return '$' + (num/1e6).toFixed(1) + 'M';
  if (num >= 1e3) return '$' + Math.round(num/1e3) + 'K';
  return '$' + num.toLocaleString('es-CL');
}

function badgeHTML(estado) {
  const map = {
    'En Stock':  'badge-stock',  'Publicado': 'badge-pub',
    'Reservado': 'badge-res',    'Vendido':   'badge-vend',
    'En Proceso':'badge-proceso','Devuelto':  'badge-devuelto',
  };
  return `<span class="badge ${map[estado]||''}">${estado}</span>`;
}

function toast(msg, level = 'success', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${level}`;
  setTimeout(() => { el.className = 'toast hidden'; }, duration);
}
const showToast = toast;

async function api(url, method = 'GET', body = null, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d) {
  if (!d) return '—';
  return d.slice(0, 10);
}

// ════════════════════════════════════════════════════════════════════════════
//  VALIDACIÓN RUT CHILE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el dígito verificador de un RUT chileno
 * @param {string|number} rut — solo el número, sin dígito verificador
 */
function calcDV(rut) {
  let sum = 0;
  let mul = 2;
  const str = String(rut).replace(/\D/g, '');
  for (let i = str.length - 1; i >= 0; i--) {
    sum += parseInt(str[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return '0';
  if (res === 10) return 'K';
  return String(res);
}

/**
 * Valida un RUT chileno completo (con o sin dígito verificador)
 * @param {string} rut — ej: "12.345.678-9" o "123456789"
 * @returns {{ valid: boolean, formatted: string, numero: string, dv: string }}
 */
function validarRUT(rut) {
  if (!rut) return { valid: false, formatted: '', numero: '', dv: '' };

  // Limpiar: quitar puntos, guiones y espacios
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase();
  if (clean.length < 2) return { valid: false, formatted: rut, numero: '', dv: '' };

  const numero = clean.slice(0, -1);
  const dv     = clean.slice(-1);

  if (!/^\d+$/.test(numero)) return { valid: false, formatted: rut, numero, dv };

  const dvEsperado = calcDV(numero);
  const valid      = dv === dvEsperado;
  const formatted  = formatRUT(numero + dv);

  return { valid, formatted, numero, dv, dvEsperado };
}

/**
 * Formatea un RUT limpio a formato estándar: XX.XXX.XXX-X
 */
function formatRUT(rut) {
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase();
  const num   = clean.slice(0, -1);
  const dv    = clean.slice(-1);
  // Agregar puntos de miles
  const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}

/**
 * Formatea un input numérico con separadores de miles chilenos (puntos) mientras se escribe.
 * El input debe ser type="text". El valor leído debe hacerse con .replace(/\D/g,'').
 * Uso: <input type="text" oninput="fmtNumInput(this)">
 */
function fmtNumInput(el) {
  const caret  = el.selectionStart;
  const oldLen = el.value.length;
  const digits = el.value.replace(/\D/g, '');
  if (!digits) { el.value = ''; return; }
  const formatted = parseInt(digits, 10).toLocaleString('es-CL');
  el.value = formatted;
  // Reposicionar cursor ajustando por los puntos agregados/removidos
  const delta  = formatted.length - oldLen;
  const newPos = Math.max(0, Math.min(caret + delta, formatted.length));
  try { el.setSelectionRange(newPos, newPos); } catch(e) {}
}

/**
 * Aplica validación visual Y formato de RUT en tiempo real.
 * Mientras el usuario escribe dígitos, auto-inserta puntos y guión.
 * Uso: <input oninput="onRUTInput(this)" onblur="onRUTBlur(this)">
 */
function onRUTInput(el) {
  const caret  = el.selectionStart;
  const oldLen = el.value.length;

  // Extraer solo dígitos y K (sin puntos ni guiones ya existentes)
  const raw = el.value.replace(/[^0-9kK]/g, '').toUpperCase();

  if (!raw) { el.value = ''; return; }

  let formatted = raw;
  if (raw.length > 1) {
    // El último carácter es el dígito verificador
    const body   = raw.slice(0, -1);
    const dv     = raw.slice(-1);
    const bodyFmt = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    formatted = `${bodyFmt}-${dv}`;
  }
  el.value = formatted;

  // Reposicionar cursor
  const delta  = formatted.length - oldLen;
  const newPos = Math.max(0, Math.min(caret + delta, formatted.length));
  try { el.setSelectionRange(newPos, newPos); } catch(e) {}

  el.style.borderColor = '';
  const msg = el.parentElement?.querySelector('.rut-msg');
  if (msg) msg.textContent = '';
}

function onRUTBlur(el) {
  if (!el.value.trim()) return;
  const result = validarRUT(el.value);

  // Auto-formatear
  if (result.numero) el.value = result.formatted;

  // Feedback visual
  el.style.borderColor = result.valid ? 'var(--green)' : 'var(--red)';

  // Mensaje de error/éxito
  let msg = el.parentElement?.querySelector('.rut-msg');
  if (!msg) {
    msg = document.createElement('small');
    msg.className = 'rut-msg';
    msg.style.cssText = 'font-size:10px;margin-top:2px;display:block';
    el.parentElement?.appendChild(msg);
  }
  if (result.valid) {
    msg.style.color   = 'var(--green)';
    msg.textContent   = '✓ RUT válido';
  } else {
    msg.style.color   = 'var(--red)';
    msg.textContent   = `✕ RUT inválido — dígito esperado: ${result.dvEsperado || '?'}`;
  }

  return result.valid;
}

/**
 * Consulta nombre desde RUT via API gratuita (rutify.cl)
 * Retorna { nombre, valid } o null si falla
 */
async function consultarRUT(rut) {
  const result = validarRUT(rut);
  if (!result.valid) return null;
  try {
    const resp = await fetch(
      `https://api.rutify.cl/rut/${result.numero}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      return { nombre: data.razon_social || data.nombre || '', valid: true };
    }
  } catch(e) { /* API no disponible, ignorar */ }
  return null;
}
