// Small helpers shared by every screen.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

// Replace an element's children; accepts nested arrays and skips empty values.
export function put(el, ...nodes) {
  el.replaceChildren(...nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false && n !== ''));
}

// ---------- dates ----------
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}
export function fmtDate(iso, withYear = false) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  if (withYear || d.getUTCFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function localDay(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function howLong(fromISO, toISO) {
  const n = daysBetween(fromISO, toISO);
  if (n < 1) return 'today';
  if (n < 14) return `${n} day${n === 1 ? '' : 's'}`;
  if (n < 60) return `${Math.round(n / 7)} weeks`;
  return `${Math.round(n / 30)} months`;
}

// ---------- toast ----------
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- sheets ----------
const stack = [];
export function openSheet({ title, body, foot, full = false, onClose }) {
  const root = document.getElementById('sheetRoot');
  const close = () => {
    wrap.remove();
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
    onClose && onClose();
  };
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const footEl = foot ? h('div', { class: 'sheet-foot' }, foot) : null;
  const titleEl = h('h2', null, title || '');
  const wrap = h('div', { class: 'sheet-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Panel' },
    h('div', { class: 'scrim', onclick: close }),
    h('div', { class: 'sheet' + (full ? ' full' : '') },
      h('div', { class: 'sheet-bar' }, titleEl,
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close },
          s('svg', { viewBox: '0 0 24 24' }, s('path', { d: 'M6 6l12 12M18 6 6 18' })))),
      bodyEl, footEl));
  root.append(wrap);
  stack.push(close);
  const api = {
    close,
    setBody(...nodes) { put(bodyEl, nodes); bodyEl.scrollTop = 0; },
    setFoot(...nodes) {
      if (!footEl) return;
      put(footEl, nodes);
      footEl.style.display = footEl.children.length ? '' : 'none';
    },
    setTitle(t) { titleEl.textContent = t; },
    bodyEl,
  };
  return api;
}
export function closeAllSheets() { [...stack].reverse().forEach((c) => c()); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1](); });

export function confirmSheet(message, okLabel = 'Yes', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const sh = openSheet({
      title: 'Are you sure?',
      body: h('p', null, message),
      foot: [
        h('button', { class: 'btn block', onclick: () => { done = true; sh.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn primary block' + (danger ? ' danger' : ''), onclick: () => { done = true; sh.close(); resolve(true); } }, okLabel),
      ],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

// ---------- images ----------
export function compressImage(file, maxSide = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

export const AREAS = { face: 'Face', scalp: 'Hair & scalp', body: 'Body' };
export const SEVERITY = { 1: 'Mild', 2: 'Noticeable', 3: 'Bad' };
