// The app's data. Everything lives in the database; this keeps the latest copy.
import { todayISO } from './ui.js';

const listeners = new Set();
export const store = { state: null };

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(state) { store.state = state; listeners.forEach((fn) => fn(state)); }
// Redraw with the same data (e.g. after switching routine).
export function refresh() { if (store.state) set(store.state); }

async function call(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const e = new Error(data?.error || 'Something went wrong. Please try again.');
    e.ai = data?.ai;
    throw e;
  }
  return data;
}

export async function load() {
  set(await call(`/api/state?today=${todayISO()}`));
  return store.state;
}
export async function mutate(action, payload = {}) {
  set(await call('/api/mutate', { method: 'POST', body: JSON.stringify({ action, today: todayISO(), ...payload }) }));
  return store.state;
}
export async function sendChat(message, images = []) {
  set(await call('/api/chat', { method: 'POST', body: JSON.stringify({ message, images, today: todayISO() }) }));
  return store.state;
}
export async function refreshInsights() {
  set(await call('/api/insights', { method: 'POST', body: JSON.stringify({ today: todayISO() }) }));
  return store.state;
}
export async function admin(action, key, extra = {}) {
  const r = await call('/api/admin', { method: 'POST', body: JSON.stringify({ ...extra, action, key, today: todayISO() }) });
  set(r);
  return r;
}
export async function findPhotos(id, auto = false) {
  const r = await call('/api/photos', { method: 'POST', body: JSON.stringify({ id, auto, today: todayISO() }) });
  if (r.state) set(r.state);
  return r.images || [];
}
export const searchProducts = (q) => call(`/api/lookup?q=${encodeURIComponent(q)}`);
export const enrich = (body) => call('/api/enrich', { method: 'POST', body: JSON.stringify(body) });

// Helpers over the current state
export const S = {
  product: (id) => store.state.products.find((p) => p.id === Number(id)),
  routine: (id) => store.state.routines.find((r) => r.id === Number(id)),
  suspects: () => new Set(store.state.insights.suspectFamilies),
  // Suspect ingredient types for this product's area (fragrance may bother your face but not your body).
  suspectsFor(p) {
    const pairs = store.state.insights.suspectPairs || [];
    return new Set(pairs.filter((x) => x.area === p.area).map((x) => x.family));
  },
  isSuspectProduct(p) {
    const sus = this.suspectsFor(p);
    return (p.ingredients || []).some((i) => sus.has(i.family));
  },

  // ---------- routines: each holds its own shelves ----------
  sets: () => store.state.sets || [],
  // The routine you're looking at (remembered on this device).
  activeSet() {
    const sets = this.sets();
    let id = null;
    try { id = Number(localStorage.getItem('myshelf.set')); } catch { /* private mode */ }
    return (sets.find((x) => x.id === id) || sets[0])?.id ?? null;
  },
  setActive(id) { try { localStorage.setItem('myshelf.set', String(id)); } catch { /* private mode */ } },
  setOf(r) { return r.set_id ?? this.sets()[0]?.id ?? null; },
  shelvesIn(setId) { return store.state.routines.filter((r) => this.setOf(r) === setId); },
  // <option>s for a shelf picker, grouped by routine when there's more than one.
  shelfOptions(h, selectedId) {
    const sets = this.sets();
    const opt = (r) => h('option', { value: r.id, selected: r.id === selectedId }, r.name);
    if (sets.length < 2) return store.state.routines.map(opt);
    return sets.map((x) => h('optgroup', { label: x.name }, this.shelvesIn(x.id).map(opt)));
  },
  // "Morning", or "Summer · Morning" once you have more than one routine.
  shelfLabel(routineId) {
    const r = this.routine(routineId);
    if (!r) return null;
    const sets = this.sets();
    return sets.length > 1 ? `${sets.find((x) => x.id === this.setOf(r))?.name || ''} · ${r.name}` : r.name;
  },
};
