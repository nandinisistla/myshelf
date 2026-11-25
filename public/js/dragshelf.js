// Drag a product card to another shelf (Morning, Night, …).
// Mouse: just drag it. Touch: press and hold the card, then drag.
// Dropping saves the move; every page reads the same data, so the shelf name updates
// everywhere (History, the product page, Ask AI) and History records the move.
import { toast } from './ui.js';
import { store, mutate } from './store.js';

const HOLD_MS = 420;   // touch: how long to press before the card lifts
const START_PX = 8;    // mouse: how far to move before it counts as a drag

let drag = null;       // the drag in progress

export function enableShelfDrag(view) {
  if (view.dataset.dragReady) return;
  view.dataset.dragReady = '1';

  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const card = e.target.closest('.pcard[data-id]');
    if (!card || e.target.closest('.pname, .tag, button:not(.bottle)')) return;
    const start = { x: e.clientX, y: e.clientY };
    const pending = { card, start, pointerId: e.pointerId, type: e.pointerType, timer: null };
    if (e.pointerType !== 'mouse') pending.timer = setTimeout(() => lift(pending, start), HOLD_MS);

    const move = (ev) => {
      if (ev.pointerId !== pending.pointerId) return;
      const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (!drag) {
        if (pending.type === 'mouse' && dist > START_PX) lift(pending, { x: ev.clientX, y: ev.clientY });
        else if (pending.type !== 'mouse' && dist > START_PX) cleanup();   // a scroll, not a hold
        return;
      }
      follow(ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      if (ev.pointerId !== pending.pointerId) return;
      if (drag) { ev.stopPropagation(); drop(); }
      cleanup();
    };
    const cancel = (ev) => { if (!ev.isTrusted) return; if (drag) end(false); cleanup(); };   // ignore our own nudge to the bottle
    function cleanup() {
      clearTimeout(pending.timer);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
  });

  // While a card is lifted: no page scrolling by touch, no text selection, Esc cancels.
  document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', (e) => { if (drag && e.key === 'Escape') end(false); });
  // A drag never also opens the product.
  view.addEventListener('click', (e) => { if (view.dataset.justDropped) { e.stopPropagation(); e.preventDefault(); } }, true);
}

function lift(pending, at) {
  const card = pending.card;
  const r = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.removeAttribute('data-id');
  Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
  document.body.append(ghost);
  card.classList.add('drag-src');
  document.body.classList.add('dragging-card');
  const from = card.closest('.shelf-group');
  drag = { card, ghost, from, over: null, dx: at.x - r.left, dy: at.y - r.top, x: at.x, y: at.y, raf: 0 };
  // let go of the bottle's own press (so it doesn't flip or open)
  card.querySelector('.bottle')?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: false }));
  navigator.vibrate?.(12);
  follow(at.x, at.y);
  scrollLoop();
}

function follow(x, y) {
  drag.x = x; drag.y = y;
  drag.ghost.style.transform = `translate(${x - drag.dx - parseFloat(drag.ghost.style.left)}px, ${y - drag.dy - parseFloat(drag.ghost.style.top)}px) rotate(-2.5deg) scale(1.03)`;
  drag.ghost.style.visibility = 'hidden';
  const under = document.elementFromPoint(x, y);
  drag.ghost.style.visibility = '';
  const group = under?.closest('.shelf-group[data-routine]') || null;
  if (group !== drag.over) {
    drag.over?.classList.remove('drop-on');
    drag.over = group;
    if (group && group !== drag.from) group.classList.add('drop-on');
  }
}

// Near the top or bottom of the screen, the page scrolls so you can reach every shelf.
function scrollLoop() {
  if (!drag) return;
  const edge = 90, H = window.innerHeight;
  const v = drag.y < edge ? -(edge - drag.y) / 5 : drag.y > H - edge ? (drag.y - (H - edge)) / 5 : 0;
  if (v) { window.scrollBy(0, v); follow(drag.x, drag.y); }
  drag.raf = requestAnimationFrame(scrollLoop);
}

async function drop() {
  const { card, over, from } = drag;
  const id = Number(card.dataset.id);
  if (!over || over === from) { end(false); return; }
  const raw = over.dataset.routine;
  const routineId = raw ? Number(raw) : null;
  const name = store.state.routines.find((r) => r.id === routineId)?.name;
  // Move it right away, so it feels instant; the saved data then redraws every page.
  const grid = over.querySelector('.grid');
  grid.insertBefore(card, grid.querySelector('.add-tile'));
  end(true);
  try {
    await mutate('product.update', { id, patch: { routine_id: routineId } });
    toast(name ? `Moved to ${name}` : 'Moved to Unsorted');
  } catch (e) { toast(e.message); }
}

function end(dropped) {
  if (!drag) return;
  const { card, ghost, over, raf } = drag;
  cancelAnimationFrame(raf);
  over?.classList.remove('drop-on');
  document.body.classList.remove('dragging-card');
  const view = card.closest('#view');
  if (view) { view.dataset.justDropped = '1'; setTimeout(() => delete view.dataset.justDropped, 50); }
  if (dropped) {
    ghost.remove();
    card.classList.remove('drag-src');
    card.classList.add('just-dropped');
    setTimeout(() => card.classList.remove('just-dropped'), 700);
  } else {
    // fly back to where it came from
    const r = card.getBoundingClientRect();
    ghost.style.transition = 'transform .3s cubic-bezier(.3,.7,.2,1)';
    ghost.style.transform = `translate(${r.left - parseFloat(ghost.style.left)}px, ${r.top - parseFloat(ghost.style.top)}px)`;
    setTimeout(() => { ghost.remove(); card.classList.remove('drag-src'); }, 300);
  }
  drag = null;
}
