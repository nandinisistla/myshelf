// The app's data. Everything lives in the database; this keeps the latest copy.
import { todayISO } from './ui.js';

const listeners = new Set();
export const store = { state: null };

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(state) { store.state = state; listeners.forEach((fn) => fn(state)); }

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
export async function admin(action, key) {
  set(await call('/api/admin', { method: 'POST', body: JSON.stringify({ action, key, today: todayISO() }) }));
  return store.state;
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
  isSuspectProduct(p) {
    const sus = this.suspects();
    return (p.ingredients || []).some((i) => sus.has(i.family));
  },
};
