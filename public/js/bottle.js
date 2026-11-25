// Bottles on the shelf: a real photo (background removed) when there is one,
// otherwise a clean drawing in the product's real colours and shape.
// They turn around to show the back label: hover (mouse), press and hold (touch),
// or drag/tap on the product page.
import { h, s } from './ui.js';
import { S } from './store.js';
import { quoteFor } from './quotes.js';

// ---------- colours ----------
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, amt) {
  const c = hexToRgb(hex) || [230, 230, 230];
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
function safe(hex, fallback) { return hexToRgb(hex) ? hex : fallback; }

// ---------- drawn bottles ----------
function wrapName(name, max = 11, lines = 3) {
  const words = String(name || '').replace(/[^\w%+&'\- ]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= max) cur = (cur + ' ' + w).trim();
    else { if (cur) out.push(cur); cur = w.slice(0, max); }
    if (out.length === lines) break;
  }
  if (cur && out.length < lines) out.push(cur);
  return out;
}

export function drawBottle(p) {
  const c = p.colors || {};
  const body = safe(c.body, '#ececec');
  const cap = safe(c.cap, '#bdbdbd');
  const ink = safe(c.label, '#3a3a3a');
  const edge = shade(body, -0.16);
  const capEdge = shade(cap, -0.18);
  const kind = p.kind || 'bottle';
  const parts = [];
  let labelBox = [24, 84, 32, 38];
  const R = (x, y, w, hh, rx, fill, stroke) => s('rect', { x, y, width: w, height: hh, rx, fill, stroke, 'stroke-width': 1 });

  if (kind === 'dropper') {
    parts.push(R(17, 58, 46, 80, 9, body, edge), R(31, 49, 18, 11, 2, cap, capEdge), R(27, 40, 26, 11, 3, cap, capEdge),
      s('path', { d: 'M31 41 C31 14, 49 14, 49 41 Z', fill: shade(cap, -0.05), stroke: capEdge, 'stroke-width': 1 }));
    labelBox = [23, 80, 34, 42];
  } else if (kind === 'tube') {
    parts.push(R(27, 112, 26, 26, 5, cap, capEdge),
      s('path', { d: 'M27 113 L14 24 L66 24 L53 113 Z', fill: body, stroke: edge, 'stroke-width': 1, 'stroke-linejoin': 'round' }),
      R(13, 14, 54, 11, 2, shade(body, -0.04), edge),
      s('path', { d: 'M17 17h46M17 21h46', stroke: edge, 'stroke-width': 0.6, opacity: 0.6 }));
    labelBox = [20, 44, 40, 44];
  } else if (kind === 'pump') {
    parts.push(R(15, 52, 50, 86, 12, body, edge), R(34, 41, 12, 12, 2, cap, capEdge), R(29, 27, 22, 15, 3, cap, capEdge),
      s('path', { d: 'M50 30 h15 a3 3 0 0 1 0 6 h-15 z', fill: cap, stroke: capEdge, 'stroke-width': 1 }));
    labelBox = [21, 76, 38, 46];
  } else if (kind === 'stick') {
    parts.push(R(21, 30, 38, 108, 9, body, edge), R(21, 30, 38, 36, 9, cap, capEdge), s('path', { d: 'M21 60 h38', stroke: capEdge, 'stroke-width': 1 }));
    labelBox = [25, 74, 30, 52];
  } else if (kind === 'jar') {
    parts.push(R(11, 96, 58, 42, 9, body, edge), R(9, 80, 62, 19, 6, cap, capEdge));
    labelBox = [17, 104, 46, 26];
  } else if (kind === 'spray') {
    parts.push(R(19, 50, 42, 88, 11, body, edge), R(33, 40, 14, 12, 2, cap, capEdge), R(28, 22, 24, 19, 4, cap, capEdge),
      s('path', { d: 'M28 30 h-8 v5 h8', fill: cap, stroke: capEdge, 'stroke-width': 1 }));
    labelBox = [24, 78, 32, 44];
  } else {
    parts.push(R(19, 46, 42, 92, 11, body, edge), R(32, 34, 16, 14, 2, shade(body, -0.06), edge), R(28, 17, 24, 19, 4, cap, capEdge));
    labelBox = [24, 76, 32, 46];
  }
  const [lx, ly, lw, lh] = labelBox;
  const lines = wrapName(p.name, kind === 'tube' ? 10 : lw > 38 ? 12 : 10, lh > 40 ? 3 : 2);
  const brand = String(p.brand || '').toUpperCase().slice(0, 12);
  parts.push(
    s('rect', { x: lx, y: ly, width: lw, height: lh, rx: 2, fill: '#ffffff', opacity: 0.82 }),
    brand ? s('text', { x: 40, y: ly + 9, 'text-anchor': 'middle', 'font-size': 5.4, 'letter-spacing': 0.4, fill: ink, opacity: 0.75, 'font-family': 'Calibri, Carlito, sans-serif' }, brand) : null,
    ...lines.map((t, i) => s('text', { x: 40, y: ly + (brand ? 18 : 12) + i * 8.5, 'text-anchor': 'middle', 'font-size': 7.4, 'font-weight': 700, fill: ink, 'font-family': 'Calibri, Carlito, sans-serif' }, t)),
  );
  // soft highlight so it reads as 3D
  const hx = kind === 'tube' ? 22 : kind === 'jar' ? 16 : (labelBox[0] - 2);
  parts.push(s('rect', { x: hx, y: kind === 'jar' ? 100 : 62, width: 3, height: kind === 'jar' ? 30 : 60, rx: 1.5, fill: '#fff', opacity: 0.55 }));
  return s('svg', { viewBox: '0 0 80 140', role: 'img', 'aria-label': `${p.brand || ''} ${p.name}`.trim() }, parts);
}

// ---------- getting a product photo ready for the shelf ----------
// No cutting out: the photo is cropped to the product, its background is levelled to
// pure white, and the face is "multiplied" onto the grey tile. White then vanishes into
// the tile exactly, while the product keeps every pixel, edge and shadow it was shot with.
const prepCache = new Map();
export function prepare(src) {
  if (prepCache.has(src)) return prepCache.get(src);
  const pr = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const hh = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh);       // transparent PNGs → white
        ctx.drawImage(img, 0, 0, w, hh);
        const data = ctx.getImageData(0, 0, w, hh);
        const px = data.data;
        // background colour = median of the border
        const border = [];
        for (let x = 0; x < w; x += 2) border.push(x * 4, ((hh - 1) * w + x) * 4);
        for (let y = 0; y < hh; y += 2) border.push(y * w * 4, (y * w + w - 1) * 4);
        const med = (k) => { const v = border.map((i) => px[i + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
        const bg = [med(0), med(1), med(2)];
        const offBorder = border.filter((i) => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 30).length / border.length;
        const light = bg[0] + bg[1] + bg[2] > 660 && offBorder < 0.25;
        if (!light) return resolve({ url: src, blend: false });   // a scene, not a packshot: show it as a photo card

        // Level the background to pure white, so it disappears completely on the tile.
        const gain = bg.map((v) => 255 / Math.max(1, v));
        for (let i = 0; i < px.length; i += 4) {
          px[i] = Math.min(255, px[i] * gain[0]);
          px[i + 1] = Math.min(255, px[i + 1] * gain[1]);
          px[i + 2] = Math.min(255, px[i + 2] * gain[2]);
        }
        // Crop to the product (and its shadow) so it fills the tile.
        const rowHits = new Uint32Array(hh), colHits = new Uint32Array(w);
        for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          // low threshold: white caps and pale tubes must count as product, not background
          if (765 - px[i] - px[i + 1] - px[i + 2] > 14) { rowHits[y]++; colHits[x]++; }
        }
        const minRow = 2, minCol = 2;   // even a thin outline (a white cap's edge) counts
        let top = rowHits.findIndex((n) => n >= minRow), left = colHits.findIndex((n) => n >= minCol);
        let bottom = hh - 1 - [...rowHits].reverse().findIndex((n) => n >= minRow);
        let right = w - 1 - [...colHits].reverse().findIndex((n) => n >= minCol);
        if (top < 0 || left < 0 || bottom <= top || right <= left) { top = 0; left = 0; bottom = hh - 1; right = w - 1; }
        const pad = Math.round(Math.max(right - left, bottom - top) * 0.06);
        top = Math.max(0, top - pad); left = Math.max(0, left - pad);
        bottom = Math.min(hh - 1, bottom + pad); right = Math.min(w - 1, right + pad);
        ctx.putImageData(data, 0, 0);
        const out = document.createElement('canvas');
        out.width = right - left + 1; out.height = bottom - top + 1;
        const o = out.getContext('2d');
        o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
        o.drawImage(c, left, top, out.width, out.height, 0, 0, out.width, out.height);
        resolve({ url: out.toDataURL('image/jpeg', 0.93), blend: true });
      } catch { resolve({ url: src, blend: false }); }
    };
    img.onerror = () => resolve({ url: src, blend: false });
    img.src = src;
  });
  prepCache.set(src, pr);
  return pr;
}

export function imageSrc(p) {
  if (p.has_photo) return `/api/lookup?photo=${p.id}&v=${encodeURIComponent(p.updated_at || '')}`;
  if (p.image_url) return `/api/lookup?img=${encodeURIComponent(p.image_url)}`;
  return null;
}

function frontFace(p) {
  const src = imageSrc(p);
  if (!src) return h('div', { class: 'face front' }, drawBottle(p));
  const face = h('div', { class: 'face front loading' });
  prepare(src).then(({ url, blend }) => {
    const img = h('img', { src: url, alt: `${p.brand || ''} ${p.name}`.trim(), class: blend ? 'photo' : 'photo boxed', draggable: 'false' });
    img.onload = () => { face.classList.remove('loading'); face.classList.toggle('blend', blend); face.replaceChildren(img); };
    img.onerror = () => { face.classList.remove('loading'); face.replaceChildren(drawBottle(p)); };
  });
  return face;
}

// The back of every bottle: a little note to make you smile.
export function quoteCard(p, big = false) {
  return h('figure', { class: 'quote-card' + (big ? ' big' : '') },
    h('blockquote', { class: quoteFor(p.id).length > 30 ? 'long' : '' }, quoteFor(p.id)));
}

// How good is a photo for the shelf? Plain light background, product filling
// a sensible part of the frame, and enough resolution.
const scoreCache = new Map();
export function scoreImage(src) {
  if (scoreCache.has(src)) return scoreCache.get(src);
  const pr = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const k = 120 / Math.max(img.width, img.height);
        const w = Math.max(8, Math.round(img.width * k)), hh = Math.max(8, Math.round(img.height * k));
        const c = document.createElement('canvas'); c.width = w; c.height = hh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, hh);
        const px = ctx.getImageData(0, 0, w, hh).data;
        const border = [];
        for (let x = 0; x < w; x++) border.push(x * 4, ((hh - 1) * w + x) * 4);
        for (let y = 0; y < hh; y++) border.push(y * w * 4, (y * w + w - 1) * 4);
        const avg = [0, 1, 2].map((ch) => border.reduce((a, i) => a + px[i + ch], 0) / border.length);
        const spread = border.reduce((a, i) => a + Math.abs(px[i] - avg[0]) + Math.abs(px[i + 1] - avg[1]) + Math.abs(px[i + 2] - avg[2]), 0) / border.length;
        let fg = 0;
        for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - avg[0]) + Math.abs(px[i + 1] - avg[1]) + Math.abs(px[i + 2] - avg[2]) > 40) fg++;
        const ratio = fg / (w * hh);
        const light = avg[0] + avg[1] + avg[2] > 690;
        let score = 0;
        score += light ? 40 : avg[0] + avg[1] + avg[2] > 600 ? 15 : 0;
        score += spread < 12 ? 30 : spread < 30 ? 18 : spread < 60 ? 6 : -20;
        score += ratio > 0.1 && ratio < 0.7 ? 20 : ratio > 0.05 && ratio < 0.85 ? 8 : -10;
        score += Math.min(20, Math.max(img.width, img.height) / 60);
        score += img.height >= img.width * 0.9 ? 6 : 0; // bottles are usually upright
        resolve({ score, width: img.width, height: img.height });
      } catch { resolve({ score: 0 }); }
    };
    img.onerror = () => resolve({ score: -999 });
    img.src = src;
  });
  scoreCache.set(src, pr);
  return pr;
}

export async function rankImages(options) {
  const scored = await Promise.all(options.map(async (o) => ({ ...o, ...(await scoreImage(`/api/lookup?img=${encodeURIComponent(o.url)}`)) })));
  return scored.filter((o) => o.score > -999).sort((a, b) => b.score - a.score);
}

// ---------- the interactive bottle ----------
export function renderBottle(p, { big = false, onOpen, showName = true } = {}) {
  const front = frontFace(p);
  const back = h('div', { class: 'face back' }, quoteCard(p, big));
  const flip = h('div', { class: 'flip' }, front, back);
  const suspect = S.isSuspectProduct(p);
  const el = h('div', {
    class: 'bottle' + (big ? '' : ' can-hover') + (p.stopped ? ' stopped' : ''),
    role: 'button', tabindex: '0',
    'aria-label': `${p.brand ? p.brand + ' ' : ''}${p.name}${suspect ? ', contains a possible trigger' : ''}`,
  },
    suspect && !big ? h('span', { class: 'sdot', title: 'Contains one of your likely triggers' }) : null,
    h('div', { class: 'stage' }, flip),
    showName ? h('div', { class: 'bname' }, p.name) : null);

  let angle = 0, startX = 0, down = false, moved = false, holdTimer = null, held = false, lastDx = 0;
  const setAngle = (a, animate = true) => {
    el.classList.toggle('dragging', !animate);
    const n = ((a % 360) + 360) % 360;
    el.classList.toggle('back-side', n > 90 && n < 270);   // only one side is ever drawn
    front.style.transform = `perspective(900px) rotateY(${a}deg)`;
    back.style.transform = `perspective(900px) rotateY(${a + 180}deg)`;
  };

  el.addEventListener('pointerdown', (e) => {
    down = true; moved = false; held = false; startX = e.clientX; lastDx = 0;
    if (!big && e.pointerType !== 'mouse') {
      holdTimer = setTimeout(() => { held = true; setAngle(180); }, 320);
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    lastDx = dx;
    if (Math.abs(dx) > 6) {
      moved = true;
      clearTimeout(holdTimer);
      if (big) { el.setPointerCapture?.(e.pointerId); setAngle(angle + dx * 1.1, false); }
    }
  });
  const end = () => {
    if (!down) return;
    down = false;
    clearTimeout(holdTimer);
    if (held) { held = false; setAngle(0); return; }
    if (big) {
      if (moved) { angle = Math.round((angle + lastDx * 1.1) / 180) * 180; setAngle(angle); }
      else { angle += 180; setAngle(angle); }
      return;
    }
    if (!moved && onOpen) onOpen(p);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { down = false; clearTimeout(holdTimer); if (held) { held = false; setAngle(0); } });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && big && down) end(); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { big ? (angle += 180, setAngle(angle)) : onOpen && onOpen(p); }
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}

// A small product picture, blended onto the page like on the shelf.
export function thumb(p, size = '') {
  const box = h('span', { class: 'hs-thumb ' + size + (p.stopped ? ' past' : '') });
  const src = imageSrc(p);
  if (!src) { box.append(drawBottle(p)); return box; }
  prepare(src).then(({ url, blend }) => {
    box.classList.toggle('blend', blend);
    box.append(h('img', { src: url, alt: '', draggable: 'false' }));
  });
  return box;
}
