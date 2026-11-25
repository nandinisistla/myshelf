// A soft, see-through blob that sits behind the selected option of any pill group
// (top nav, segmented toggles, filters, single-choice chips). It slides and stretches
// to the new option, and slowly morphs while it rests.
const GROUPS = '.nav-links, .seg, .hs-filter, .chips[role="radiogroup"], .fm-ask';
const ACTIVE = '.on, [aria-current="page"]';
const last = new Map();          // where each group's blob was, so re-drawn pages glide on
let queued = false;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function keyFor(group, i) { return `${group.className.split(' ')[0]}:${i}`; }

function update() {
  queued = false;
  const seen = new Map();
  document.querySelectorAll(GROUPS).forEach((group) => {
    const cls = group.className.split(' ')[0];
    const n = seen.get(cls) || 0; seen.set(cls, n + 1);
    const key = keyFor(group, n);
    if (!group.classList.contains('has-blob')) group.classList.add('has-blob');
    let blob = group.querySelector(':scope > .blob');
    const fresh = !blob;
    if (fresh) { blob = document.createElement('span'); blob.className = 'blob'; blob.setAttribute('aria-hidden', 'true'); group.prepend(blob); }
    const on = group.querySelector(`:scope > ${ACTIVE.split(', ').join(', :scope > ')}`);
    if (!on || !on.offsetWidth) { blob.style.opacity = '0'; return; }
    const pos = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
    const prev = last.get(key);
    const place = (p) => { blob.style.transform = `translate(${p.x}px, ${p.y}px)`; blob.style.width = `${p.w}px`; blob.style.height = `${p.h}px`; };
    if (fresh && prev) {           // a re-drawn group: start where the old blob was
      blob.style.transition = 'none'; place(prev); void blob.offsetWidth; blob.style.transition = '';
    }
    const moved = !prev || prev.x !== pos.x || prev.y !== pos.y || prev.w !== pos.w;
    if (fresh && !prev) { blob.style.transition = 'none'; place(pos); void blob.offsetWidth; blob.style.transition = ''; }
    else place(pos);
    blob.style.opacity = '1';
    if (moved && prev && !reduce) {
      // a little jelly squash while it travels
      blob.animate([{ scale: '1 1' }, { scale: '1.16 0.84' }, { scale: '0.96 1.04' }, { scale: '1 1' }],
        { duration: 620, easing: 'cubic-bezier(.3,.7,.3,1)' });
    }
    last.set(key, pos);
  });
}

export function startBlobs() {
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
}
