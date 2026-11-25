// Slide-by-slide scrolling. On the Shelf (dotted MyShelf screen → your shelf) and on
// For me (each step), one scroll shows the next part instead of a continuous scroll.
// A part taller than the screen scrolls normally inside, then the next scroll moves on.
const NAV = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav')) || 64;
const SECTIONS = {
  shelf: () => [document.querySelector('.hero'), document.getElementById('shelf-start')],
  forme: () => [...document.querySelectorAll('#view .slide')],
};
let sliding = false;
let lastInput = 0;

function sections() {
  const tab = (location.hash.replace('#', '') || 'shelf');
  const els = (SECTIONS[tab]?.() || []).filter((el) => el && el.isConnected);
  if (els.length < 2) return null;
  const doc = document.documentElement.scrollHeight;
  const tops = els.map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY - NAV()));
  // each part runs until the next one starts (the last one to the end of the page)
  return tops.map((top, i) => ({ top: Math.max(0, top), bottom: (i < tops.length - 1 ? tops[i + 1] : doc - NAV()) }));
}

// Hold still until the move is done and trackpad momentum has died down, so one
// gesture never carries you past the end of a part into the next one.
function hold(min = 750) {
  sliding = true;
  const started = performance.now();
  const release = () => {
    const now = performance.now();
    if (now - started > min && now - lastInput > 220) { sliding = false; return; }
    setTimeout(release, 60);
  };
  setTimeout(release, 120);
}
// The move to the next part: one steady, eased glide (the same pace every time,
// whatever the browser's own smooth scrolling does).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let anim = 0;
function glide(to) {
  cancelAnimationFrame(anim);
  const from = window.scrollY, dist = to - from;
  if (reduce || Math.abs(dist) < 2) { window.scrollTo({ top: to, behavior: 'instant' }); return 0; }
  const ms = Math.min(820, Math.max(480, Math.abs(dist) * 0.55));
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    window.scrollTo({ top: from + dist * ease(t), behavior: 'instant' });
    if (t < 1) anim = requestAnimationFrame(tick);
  };
  anim = requestAnimationFrame(tick);
  return ms;
}
function go(top) {
  const ms = glide(top);
  hold(ms + 120);
}

// Returns true when it handled the move (so the browser shouldn't scroll by itself).
function step(delta, canMove = true) {
  const s = sections();
  if (!s) return false;
  const y = window.scrollY;
  const view = window.innerHeight - NAV();
  let i = s.findIndex((p) => y >= p.top - 2 && y < p.bottom - 2);
  if (i < 0) i = y < s[0].top ? 0 : s.length - 1;
  const cur = s[i];
  if (delta > 0) {
    const left = cur.bottom - (y + view);          // how much of this part is still below
    if (left > 4) {
      if (left < delta) { hold(glide(y + left) + 80); return true; }   // stop at its end
      return false;                                                          // scroll inside it
    }
    if (i < s.length - 1) { if (canMove) go(s[i + 1].top); return true; }
    return false;
  }
  const above = y - cur.top;                       // how much of this part is above the screen
  if (above > 4) {
    if (above < -delta) { hold(glide(cur.top) + 80); return true; }
    return false;
  }
  if (i > 0) {
    const prev = s[i - 1];
    if (canMove) go(Math.max(prev.top, prev.bottom - view));    // show the end of the part above
    return true;
  }
  return false;
}

export function startSlides() {
  window.addEventListener('wheel', (e) => {
    if (document.querySelector('.sheet-wrap') || e.ctrlKey) return;
    const now = performance.now();
    // Only a new scroll gesture can move to the next part. The tail of a gesture that
    // just reached the end of a part stops there.
    const fresh = now - lastInput > 200;
    lastInput = now;
    if (!sections()) return;
    if (sliding) { e.preventDefault(); return; }
    if (Math.abs(e.deltaY) < 1) return;
    if (step(e.deltaY, fresh)) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('.sheet-wrap')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName) && e.key === ' ') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const page = window.innerHeight * 0.85;
    const d = { ArrowDown: 80, ArrowUp: -80, PageDown: page, PageUp: -page, ' ': e.shiftKey ? -page : page }[e.key];
    if (!d || !sections()) return;
    if (sliding || step(d)) e.preventDefault();
  });

  // Touch: scroll normally; a swipe past the end (or start) of a part moves to the next one.
  let y0 = null, sy0 = 0;
  window.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; sy0 = window.scrollY; }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (y0 == null || document.querySelector('.sheet-wrap')) return;
    const dy = y0 - e.changedTouches[0].clientY; y0 = null;
    if (Math.abs(dy) < 40 || sliding) return;
    const s = sections(); if (!s) return;
    const y = window.scrollY, view = window.innerHeight - NAV();
    let i = s.findIndex((p) => sy0 >= p.top - 2 && sy0 < p.bottom - 2); if (i < 0) return;
    if (dy > 0 && y + view >= s[i].bottom - 40 && i < s.length - 1) go(s[i + 1].top);
    else if (dy < 0 && y <= s[i].top + 40 && i > 0) go(Math.max(s[i - 1].top, s[i - 1].bottom - view));
  }, { passive: true });
}
