// Small touches that make the pages feel alive, without getting in the way:
// things rise in gently as they come into view, each tab fades in, dots on For me
// pop in one by one, and product tiles catch a soft light that follows the mouse.
const REVEAL = [
  '.page-head', '.shelf-group .group-head', '.pcard', '.past-toggle',
  '.hs-headline', '.hs-filter', '.hs-month > header', '.hs-row',
  '.fm-profile', '.fm-step-head', '.fm-prob', '.fm-prod', '.fm-ing', '.fm-avoid-item', '.fm-watch', '.fm-safe-item', '.fm-sub', '.fm-dots',
].join(', ');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let freshUntil = 0;     // right after switching tabs, everything on screen animates in
let io = null;

export function newView() {
  freshUntil = performance.now() + 700;
  const view = document.getElementById('view');
  if (reduce || !view) return;
  view.classList.remove('view-in'); void view.offsetWidth; view.classList.add('view-in');
}

function scan() {
  if (reduce) return;
  const fresh = performance.now() < freshUntil;
  const h = window.innerHeight;
  const counts = new Map();
  document.querySelectorAll(REVEAL).forEach((el) => {
    if (el.classList.contains('reveal')) return;
    el.classList.add('reveal');
    const r = el.getBoundingClientRect();
    const onScreen = r.top < h && r.bottom > 0;
    if (onScreen && !fresh) { el.classList.add('in', 'no-anim'); return; }   // a quiet re-draw: no replay
    // a small stagger between neighbours
    const parent = el.parentElement;
    const n = counts.get(parent) || 0; counts.set(parent, n + 1);
    el.style.setProperty('--d', `${Math.min(n * 60, 360)}ms`);
    io.observe(el);
  });
}

export function startEffects() {
  if (reduce) return;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } };
  new MutationObserver(schedule).observe(document.getElementById('view'), { childList: true, subtree: true });
  schedule();

  // soft light on product tiles that follows the mouse
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest?.('.tile');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    t.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, { passive: true });
}
