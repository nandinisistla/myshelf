// Fill MyShelf with example history for a demo. Each product is looked up for real
// (ingredients + photo), exactly like adding one yourself, then dated in the past.
import { admin, enrich, findPhotos } from './store.js';

let running = null;
export const demoState = { running: false, msg: '' };
let rerender = () => {};
export const onDemoProgress = (fn) => { rerender = fn; };

export function loadDemo(key, onProgress = () => {}, fillOnly = false) {
  if (running) return running;
  const report = onProgress;
  onProgress = (msg, n, total) => { demoState.msg = total ? `Adding demo · ${n} of ${total}` : msg; report(msg, n, total); rerender(); };
  demoState.running = true; demoState.msg = 'Starting demo…'; rerender();
  running = (async () => {
    const plan = await admin(fillOnly ? 'demo.fill' : 'demo.plan', key);
    const todo = plan.demoTodo || [];
    let done = 0;
    onProgress(`Looking up ${todo.length} products…`, 0, todo.length);
    const queue = [...todo];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        try { await addOne(item); } catch { /* skip this one; it's filled in on a later visit */ }
        done++;
        onProgress(`Added ${item.brand} ${item.name}`, done, todo.length);
      }
    };
    const addOne = async (item) => {
      {
        let info = null;
        // Products with a label-based ingredient list only need a photo; the rest are looked up in full.
        if (!item.curated) {
          for (let tries = 0; tries < 2 && !info; tries++) {
            try { info = await enrich({ name: item.name, brand: item.brand }); } catch { /* retry once */ }
          }
        }
        const r = await admin('demo.product', key, { index: item.index, info });
        if (item.curated && r.demoProductId && !r.demoHasPhoto) { try { await findPhotos(r.demoProductId, true); } catch { /* photo can be found later */ } }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (!fillOnly) await admin('demo.finish', key);
    onProgress('Demo history is ready', todo.length, todo.length);
  })().finally(() => { running = null; demoState.running = false; rerender(); });
  return running;
}

export const clearDemo = (key) => admin('demo.clear', key);

// Add any demo products that never loaded, without touching anything else.
export const fillDemo = () => loadDemo('', () => {}, true);

// "Restore the demo": clear MyShelf and load the demo story again. The demo's photos are
// remembered, so it's back in a few seconds.
export async function restoreDemo(onProgress = () => {}) {
  await admin('demo.restore', '');
  await loadDemo('', onProgress);
}
