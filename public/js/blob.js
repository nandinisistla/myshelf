// Liquid glass behind every pill group (top nav, toggles, filters, single-choice chips).
// Two soft shapes live in a "gooey" layer: one sits under the selected option, and a
// small droplet follows your mouse. When they come close they melt into one shape with
// a stretchy neck, like liquid, then pull apart again. Everything is see-through.
const GROUPS = '.nav-links, .seg, .hs-filter, .chips[role="radiogroup"], .fm-ask';
const ACTIVE = ':scope > .on, :scope > [aria-current="page"]';
const PAD = 14;                    // room around the group so the goo isn't clipped
const last = new Map();            // where each group's blob was, so re-drawn pages glide on
let queued = false;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

// The gooey filter: blur the shapes together, cut them back to a clean edge, then make
// the inside barely tinted, the rim a little stronger and the top edge catch the light.
function ensureFilter() {
  if (document.getElementById('goo-defs')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'goo-defs';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `
    <filter id="goo" x="-30%" y="-80%" width="160%" height="260%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="goo"/>
      <feMorphology in="goo" operator="erode" radius="1.3" result="inner"/>
      <feComposite in="goo" in2="inner" operator="out" result="rim"/>
      <feComponentTransfer in="goo" result="fill"><feFuncA type="linear" slope="0.09"/></feComponentTransfer>
      <feComponentTransfer in="rim" result="edge"><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
      <feOffset in="inner" dx="0" dy="2" result="down"/>
      <feComposite in="inner" in2="down" operator="out" result="topEdge"/>
      <feColorMatrix in="topEdge" mode="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.85 0" result="shine"/>
      <feMerge><feMergeNode in="fill"/><feMergeNode in="edge"/><feMergeNode in="shine"/></feMerge>
    </filter>`;
  document.body.prepend(svg);
}

function setup(group) {
  const layer = document.createElement('span');
  layer.className = 'goo';
  layer.setAttribute('aria-hidden', 'true');
  const main = document.createElement('i'); main.className = 'goo-main';
  const drop = document.createElement('i'); drop.className = 'goo-drop';
  layer.append(main, drop);
  group.prepend(layer);
  group.classList.add('has-blob');

  if (fine && !reduce) {
    // The droplet chases the mouse with a little lag, and stretches the way it moves.
    const s = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, raf: 0 };
    const tick = () => {
      s.x += (s.tx - s.x) * 0.22; s.y += (s.ty - s.y) * 0.22; s.r += (s.tr - s.r) * 0.18;
      const vx = s.tx - s.x, vy = s.ty - s.y;
      const speed = Math.min(1, Math.hypot(vx, vy) / 60);
      const ang = Math.atan2(vy, vx);
      drop.style.width = drop.style.height = `${Math.max(0, s.r * 2)}px`;
      drop.style.transform = `translate(${s.x - s.r}px, ${s.y - s.r}px) rotate(${ang}rad) scale(${1 + speed * 0.6}, ${1 - speed * 0.3})`;
      if (Math.abs(s.tx - s.x) > 0.3 || Math.abs(s.ty - s.y) > 0.3 || Math.abs(s.tr - s.r) > 0.3) s.raf = requestAnimationFrame(tick);
      else s.raf = 0;
    };
    const kick = () => { if (!s.raf) s.raf = requestAnimationFrame(tick); };
    const centre = () => {
      const b = layer.getBoundingClientRect(); const m = main.getBoundingClientRect();
      return { x: m.left + m.width / 2 - b.left, y: m.top + m.height / 2 - b.top };
    };
    group.addEventListener('pointerenter', (e) => {
      const b = layer.getBoundingClientRect();
      const c = centre();               // pull the droplet out of the selected blob
      s.x = c.x; s.y = c.y; s.r = 4;
      s.tx = e.clientX - b.left; s.ty = e.clientY - b.top; s.tr = 13; kick();
    });
    group.addEventListener('pointermove', (e) => {
      const b = layer.getBoundingClientRect();
      s.tx = e.clientX - b.left; s.ty = e.clientY - b.top;
      // a little bigger over an option you could pick
      s.tr = e.target.closest('a, button') && !e.target.closest('.on, [aria-current="page"]') ? 16 : 11;
      kick();
    });
    group.addEventListener('pointerleave', () => {
      const c = centre();               // melt back into the selected blob
      s.tx = c.x; s.ty = c.y; s.tr = 0; kick();
    });
  }
  return main;
}

function update() {
  queued = false;
  ensureFilter();
  const seen = new Map();
  document.querySelectorAll(GROUPS).forEach((group) => {
    const cls = group.className.split(' ')[0];
    const n = seen.get(cls) || 0; seen.set(cls, n + 1);
    const key = `${cls}:${n}`;
    const existing = group.querySelector(':scope > .goo');
    const fresh = !existing;
    const main = fresh ? setup(group) : existing.querySelector('.goo-main');
    const on = group.querySelector(ACTIVE);
    if (!on || !on.offsetWidth) { main.style.opacity = '0'; return; }
    const pos = { x: on.offsetLeft + PAD, y: on.offsetTop + PAD, w: on.offsetWidth, h: on.offsetHeight };
    const prev = last.get(key);
    const place = (p) => { main.style.transform = `translate(${p.x}px, ${p.y}px)`; main.style.width = `${p.w}px`; main.style.height = `${p.h}px`; };
    if (fresh) { main.style.transition = 'none'; place(prev || pos); void main.offsetWidth; main.style.transition = ''; }
    const moved = prev && (prev.x !== pos.x || prev.y !== pos.y || prev.w !== pos.w);
    place(pos);
    main.style.opacity = '1';
    if (moved && !reduce) {
      main.animate([{ scale: '1 1' }, { scale: '1.18 0.8' }, { scale: '0.95 1.06' }, { scale: '1 1' }],
        { duration: 650, easing: 'cubic-bezier(.3,.7,.3,1)' });
    }
    last.set(key, pos);
  });
}

export function startBlobs() {
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  new MutationObserver((records) => {
    // ignore our own droplet animating
    if (records.every((r) => r.target.closest?.('.goo'))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
}
