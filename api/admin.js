// Owner tools: save a backup of the whole shelf, or reset to that backup.
// Protected by OWNER_KEY (set it in Vercel → Settings → Environment Variables).
import { handler, today } from '../lib/http.js';
import { q, TABLES } from '../lib/db.js';
import { getState, logEvent, addProduct, stopProduct, addReaction, UserError } from '../lib/core.js';
import { DEMO_PRODUCTS, DEMO_REACTIONS } from '../lib/demo.js';

export const config = { maxDuration: 60 };

const SERIAL = ['routines', 'products', 'reactions', 'events', 'chat'];

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { action, key } = req.json;
  const isDemo = String(action || '').startsWith('demo.');
  // Demo data can be added without a passcode when no OWNER_KEY is set; backups always need one.
  if (!process.env.OWNER_KEY && !isDemo) throw new UserError('Owner tools are off. Set OWNER_KEY in Vercel to turn them on.');
  if (process.env.OWNER_KEY && key !== process.env.OWNER_KEY) throw new UserError('Wrong passcode.');

  if (isDemo) return res.status(200).json(await demo(action, req.json, today(req)));

  if (action === 'save') {
    const data = {};
    for (const t of TABLES) data[t] = await q(`select * from ${t}`);
    await q(`insert into snapshots (id, data) values (1, $1::jsonb) on conflict (id) do update set data = $1::jsonb, at = now()`, [JSON.stringify(data)]);
    await logEvent('admin', 'Owner saved a backup of the shelf', {});
  } else if (action === 'restore') {
    const snap = (await q(`select data from snapshots where id = 1`))[0];
    if (!snap) throw new UserError('No backup saved yet.');
    for (const t of TABLES) {
      await q(`delete from ${t}`);
      for (const row of snap.data[t] || []) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => (row[c] !== null && typeof row[c] === 'object' && !(row[c] instanceof Date) ? JSON.stringify(row[c]) : row[c]));
        await q(`insert into ${t} (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`, vals);
      }
      if (SERIAL.includes(t)) await q(`select setval(pg_get_serial_sequence('${t}', 'id'), coalesce((select max(id) from ${t}), 0) + 1, false)`);
    }
    await logEvent('admin', 'Shelf reset to the owner\'s backup', {});
  } else throw new UserError('Unknown action.');
  res.status(200).json(await getState(today(req)));
});

// ---------- demo history ----------
const at = (date, time) => `${date}T${time}:00Z`;

async function demo(action, body, todayISO) {
  if (action === 'demo.plan') {
    // Which demo products aren't on MyShelf yet (so nothing is added twice).
    const have = await q(`select lower(name) as name, lower(coalesce(brand, '')) as brand from products`);
    const todo = DEMO_PRODUCTS.map((d, index) => ({ index, name: d.name, brand: d.brand }))
      .filter((d) => !have.some((p) => p.name.includes(DEMO_PRODUCTS[d.index].match) && p.brand.includes(d.brand.toLowerCase())));
    return { ...(await getState(todayISO)), demoTodo: todo };
  }

  if (action === 'demo.product') {
    const item = DEMO_PRODUCTS[Number(body.index)];
    if (!item) throw new UserError('Unknown demo product.');
    const info = body.info && typeof body.info === 'object' ? body.info : {};
    const images = Array.isArray(info.images) ? info.images : [];
    const routine = (await q(`select id from routines where lower(name) = lower($1) limit 1`, [item.routine]))[0];
    const first = images[0];
    const p = await addProduct({
      ...info,
      name: item.name, brand: item.brand, area: item.area,
      routine_id: routine?.id || null, started: item.started,
      image_url: first?.url || null,
      image_credit: first ? (first.source === 'Open Beauty Facts' ? 'Photo: Open Beauty Facts (CC BY-SA)' : `Image: ${first.source}`) : null,
      image_options: images,
    }, 'demo');
    await q(`update products set demo = true where id = $1`, [p.id]);
    await q(`update events set at = $1 where kind = 'product.add' and data->>'productId' = $2`, [at(item.started, '09:14'), String(p.id)]);
    if (item.stopped) {
      await stopProduct(p.id, item.stopped, todayISO, 'demo');
      await q(`update events set at = $1 where kind = 'product.stop' and data->>'productId' = $2`, [at(item.stopped, '21:40'), String(p.id)]);
    }
    return getState(todayISO);
  }

  if (action === 'demo.finish') {
    const have = await q(`select date, area from reactions`);
    for (const r of DEMO_REACTIONS) {
      if (have.some((x) => x.date === r.date && x.area === r.area)) continue;
      const row = await addReaction(r, 'demo');
      await q(`update reactions set demo = true, created_at = $1 where id = $2`, [at(r.date, '20:30'), row.id]);
      await q(`update events set at = $1 where kind = 'reaction.add' and data->>'reactionId' = $2`, [at(r.date, '20:30'), String(row.id)]);
    }
    return getState(todayISO);
  }

  if (action === 'demo.clear') {
    const prods = (await q(`select id from products where demo = true`)).map((r) => String(r.id));
    const reacts = (await q(`select id from reactions where demo = true`)).map((r) => String(r.id));
    if (prods.length) {
      await q(`delete from events where data->>'productId' = any($1::text[])`, [prods]);
      await q(`delete from photos where product_id = any($1::int[])`, [prods.map(Number)]);
      await q(`delete from products where demo = true`);
    }
    if (reacts.length) {
      await q(`delete from events where data->>'reactionId' = any($1::text[])`, [reacts]);
      await q(`delete from reactions where demo = true`);
    }
    return getState(todayISO);
  }
  throw new UserError('Unknown action.');
}
