// Fill MyShelf with example history for a demo. Each product is looked up for real
// (ingredients + photo), exactly like adding one yourself, then dated in the past.
import { admin, enrich } from './store.js';

let running = null;

export function loadDemo(key, onProgress = () => {}) {
  if (running) return running;
  running = (async () => {
    const plan = await admin('demo.plan', key);
    const todo = plan.demoTodo || [];
    let done = 0;
    onProgress(`Looking up ${todo.length} products…`, 0, todo.length);
    const queue = [...todo];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        let info = null;
        for (let tries = 0; tries < 2 && !info; tries++) {
          try { info = await enrich({ name: item.name, brand: item.brand }); } catch { /* retry once */ }
        }
        await admin('demo.product', key, { index: item.index, info });
        done++;
        onProgress(`Added ${item.brand} ${item.name}`, done, todo.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await admin('demo.finish', key);
    onProgress('Demo history is ready', todo.length, todo.length);
  })().finally(() => { running = null; });
  return running;
}

export const clearDemo = (key) => admin('demo.clear', key);
