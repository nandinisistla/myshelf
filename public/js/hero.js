// Opening screen: "MyShelf" drawn as a grid of dots. The dots swirl in and settle
// into the letters (left to right), the "h" in grey. Move the mouse or a finger
// over them and they scatter, then spring back.
import { h } from './ui.js';

const INK = '#161615';
const GREY = '#b9b7b1';
let heroEl = null;

export function getHero() {
  if (heroEl) return heroEl;
  const canvas = h('canvas', { class: 'hero-canvas', 'aria-hidden': 'true' });
  const cue = h('button', { class: 'scroll-cue', onclick: () => document.getElementById('shelf-start')?.scrollIntoView({ behavior: 'smooth' }) },
    h('span', null, 'Scroll'), h('i', { 'aria-hidden': 'true' }, h('b')));
  heroEl = h('section', { class: 'hero', 'aria-label': 'MyShelf' },
    h('h1', { class: 'sr-only' }, 'MyShelf'),
    h('div', { class: 'hero-corner l mono' }, 'Skincare, connected'),
    h('div', { class: 'hero-corner r mono' }, '© 2026'),
    canvas, cue);
  requestAnimationFrame(() => start(canvas));
  return heroEl;
}

function start(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, dot = 3, parts = [], t0 = 0, running = false, intro = true;
  const mouse = { x: -1e4, y: -1e4, active: false };

  async function build() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const family = 'Calibri, Carlito, "Segoe UI", sans-serif';
    try { await document.fonts.load(`700 120px Carlito`); } catch { /* fall back */ }
    const text = 'MyShelf';
    // Fit the word to ~88% of the width.
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.font = `700 100px ${family}`;
    const w100 = octx.measureText(text).width;
    const size = Math.min((W * 0.88) / w100 * 100, H * 0.62);
    octx.font = `700 ${size}px ${family}`;
    const tw = octx.measureText(text).width;
    const startX = octx.measureText('MyS').width;
    const endX = octx.measureText('MySh').width;
    off.width = Math.ceil(W); off.height = Math.ceil(H);
    octx.font = `700 ${size}px ${family}`;
    octx.textBaseline = 'middle';
    const ox = (W - tw) / 2, oy = H * 0.47;
    octx.fillStyle = '#000';
    octx.fillText(text, ox, oy);
    const img = octx.getImageData(0, 0, off.width, off.height).data;

    const step = Math.max(3.2, size / 46);
    dot = step * 0.36;
    const next = [];
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const a = img[((Math.floor(y) * off.width) + Math.floor(x)) * 4 + 3];
        if (a > 140) {
          const grey = x >= ox + startX && x < ox + endX;
          // Start somewhere off to the right in a loose swirl, like the reference.
          const ang = Math.random() * Math.PI * 2;
          const rad = 80 + Math.random() * Math.max(W, H) * 0.45;
          next.push({
            tx: x, ty: y, grey,
            x: x + Math.cos(ang) * rad + W * 0.25, y: y + Math.sin(ang) * rad * 0.6,
            sx: 0, sy: 0, vx: 0, vy: 0,
            delay: ((x - ox) / tw) * 1.1 + Math.random() * 0.35,
            spin: (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 2.5),
          });
        }
      }
    }
    for (const p of next) { p.sx = p.x - p.tx; p.sy = p.y - p.ty; }
    parts = next;
    if (reduce || !intro) {
      for (const p of parts) { p.x = p.tx; p.y = p.ty; }
      intro = false;
      draw();
    } else {
      t0 = performance.now();
      kick();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const grey of [false, true]) {
      ctx.fillStyle = grey ? GREY : INK;
      ctx.beginPath();
      for (const p of parts) {
        if (p.grey !== grey) continue;
        ctx.moveTo(p.x + dot, p.y);
        ctx.arc(p.x, p.y, dot, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function frame(now) {
    let moving = false;
    if (intro) {
      const t = (now - t0) / 1000;
      let done = true;
      for (const p of parts) {
        const k = Math.max(0, Math.min(1, (t - p.delay) / 1.5));
        if (k < 1) done = false;
        const e = ease(k);
        const r = 1 - e;
        const a = r * p.spin;
        const c = Math.cos(a), s = Math.sin(a);
        p.x = p.tx + (p.sx * c - p.sy * s) * r;
        p.y = p.ty + (p.sx * s + p.sy * c) * r;
      }
      if (done) intro = false;
      moving = true;
    } else {
      const R = Math.max(60, Math.min(130, W * 0.08));
      for (const p of parts) {
        let ax = (p.tx - p.x) * 0.06, ay = (p.ty - p.y) * 0.06;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / R) * 7;
            ax += (dx / d) * f; ay += (dy / d) * f;
          }
        }
        p.vx = (p.vx + ax) * 0.82; p.vy = (p.vy + ay) * 0.82;
        p.x += p.vx; p.y += p.vy;
        if (!moving && (Math.abs(p.vx) > 0.02 || Math.abs(p.vy) > 0.02 || Math.abs(p.tx - p.x) > 0.3)) moving = true;
      }
    }
    draw();
    if (moving || mouse.active) requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    if (running || reduce) return;
    running = true;
    requestAnimationFrame(frame);
  }

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    mouse.active = true;
    kick();
  };
  canvas.addEventListener('pointermove', point);
  canvas.addEventListener('pointerdown', point);
  canvas.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = mouse.y = -1e4; kick(); });
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { mouse.active = false; kick(); } });

  let rt;
  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || (Math.abs(r.width - W) < 2 && Math.abs(r.height - H) < 2)) return;
    clearTimeout(rt);
    rt = setTimeout(() => { intro = intro && !parts.length; build(); }, 150);
  }).observe(canvas);
  build();
}
