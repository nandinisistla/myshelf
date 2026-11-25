// Owner tools: save a backup of the whole shelf, or reset to that backup.
// Protected by OWNER_KEY (set it in Vercel → Settings → Environment Variables).
import { handler, today } from '../lib/http.js';
import { q, TABLES } from '../lib/db.js';
import { getState, logEvent, addProduct, stopProduct, addReaction, setProfile, setInsightStatus, fmtDate, UserError } from '../lib/core.js';
import { DEMO_PRODUCTS, DEMO_REACTIONS, DEMO_PROFILE, DEMO_STATUSES, DEMO_OWN_DATES } from '../lib/demo.js';

export const config = { maxDuration: 60 };

const SERIAL = ['routines', 'products', 'reactions', 'events', 'chat'];

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { action, key } = req.json;
  const isDemo = String(action || '').startsWith('demo.') || action === 'data.wipe';
  if (!process.env.OWNER_KEY && !isDemo) throw new UserError('Owner tools are off. Set OWNER_KEY in Vercel to turn them on.');
  // Demo data is harmless (marked, removable in one click), so it never needs the passcode.
  if (isDemo) return res.status(200).json(await demo(action, req.json, today(req)));
  if (key !== process.env.OWNER_KEY) throw new UserError('Wrong passcode.');

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
  if (action === 'data.wipe') {
    for (const t of ['products', 'photos', 'reactions', 'events', 'chat', 'insight_status', 'insight_cache', 'snapshots', 'profile', 'routines']) await q(`delete from ${t}`);
    const names = ['Morning', 'Night', 'Hair', 'Body'];
    for (let i = 0; i < names.length; i++) await q(`insert into routines (name, position) values ($1, $2)`, [names[i], i]);
    await setFlag('demo', 'removed');   // stays empty: the demo doesn't come back by itself
    return getState(todayISO);
  }

  if (action === 'demo.plan') {
    // The demo loads once, by itself, on a fresh MyShelf. Only one visitor can start it.
    const flag = (await q(`select value, at from app_flags where key = 'demo'`))[0];
    const busy = flag?.value === 'seeding' && Date.now() - new Date(flag.at).getTime() < 5 * 60000;
    if (flag?.value === 'done' || flag?.value === 'removed' || busy) return { ...(await getState(todayISO)), demoTodo: [] };
    await setFlag('demo', 'seeding');
    // Which demo products aren't on MyShelf yet (so nothing is added twice).
    const have = await q(`select lower(name) as name, lower(coalesce(brand, '')) as brand from products`);
    const todo = DEMO_PRODUCTS.map((d, index) => ({ index, name: d.name, brand: d.brand, curated: Boolean(d.ingredients) }))
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
    const curated = item.ingredients ? { ingredients: item.ingredients, summary: item.summary, kind: item.kind,
      confidence: 'high', ai_note: 'Ingredients from the product label.', sources: [] } : {};
    const p = await addProduct({
      ...info, ...curated,
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
    return { ...(await getState(todayISO)), demoProductId: p.id };
  }

  if (action === 'demo.finish') {
    const flag = (await q(`select value from app_flags where key = 'demo'`))[0];
    if (flag?.value === 'done' || flag?.value === 'removed') return getState(todayISO);
    // The story starts with her skin profile (June 1, no known allergens yet). On Oct 9, after
    // MyShelf showed the pattern, she confirmed fragrance and added it to her allergens.
    const backdateLast = async (kind, when) =>
      q(`update events set at = $1 where id = (select max(id) from events where kind = $2)`, [when, kind]);
    await setProfile({ ...DEMO_PROFILE, allergens: [] }, 'demo');
    await backdateLast('profile', at('2026-06-01', '08:05'));
    for (const st of DEMO_STATUSES) {
      await setInsightStatus(st.family, st.status, 'demo');
      await backdateLast('insight', at('2026-10-09', '19:30'));
    }
    await setProfile(DEMO_PROFILE, 'demo');
    await backdateLast('profile', at('2026-10-09', '19:35'));
    // Her own products: give them start dates that fit the story, if they still have the default.
    for (const o of DEMO_OWN_DATES) {
      const rows = await q(`select id, name, started, routine_id from products where demo = false and lower(name) like $1`, [`%${o.match}%`]);
      for (const p of rows) {
        if (p.started && p.started < '2026-11-01') continue;
        await q(`update products set started = $1, updated_at = now() where id = $2`, [o.started, p.id]);
        const shelf = (await q(`select name from routines where id = $1`, [p.routine_id]))[0]?.name;
        await q(`update events set at = $1, summary = $2 where kind = 'product.add' and data->>'productId' = $3`,
          [at(o.started, '08:40'), `Added ${p.name}${shelf ? ` to ${shelf}` : ''} · started ${fmtDate(o.started)}`, String(p.id)]);
      }
    }
    const have = await q(`select date, area from reactions`);
    for (const r of DEMO_REACTIONS) {
      if (have.some((x) => x.date === r.date && x.area === r.area)) continue;
      const row = await addReaction(r, 'demo');
      await q(`update reactions set demo = true, created_at = $1 where id = $2`, [at(r.date, '20:30'), row.id]);
      await q(`update events set at = $1 where kind = 'reaction.add' and data->>'reactionId' = $2`, [at(r.date, '20:30'), String(row.id)]);
    }
    await setFlag('demo', 'done');
    return getState(todayISO);
  }

  if (action === 'demo.reset') {
    // An older version of the demo is on MyShelf: swap it for the current story (once).
    const flag = (await q(`select value, at from app_flags where key = 'demo'`))[0];
    if (flag?.value === 'removed') return getState(todayISO);
    if (flag?.value === 'seeding' && Date.now() - new Date(flag.at).getTime() < 5 * 60000) return getState(todayISO);
    await clearDemo();
    await q(`delete from insight_status`);
    await q(`delete from app_flags where key = 'demo'`);
    return getState(todayISO);
  }

  if (action === 'demo.clear') {
    await clearDemo();
    return getState(todayISO);
  }
  throw new UserError('Unknown action.');
}

async function clearDemo() {
  {
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
    await q(`delete from events where source = 'demo' and kind in ('profile', 'insight')`);
  }
}

async function setFlag(key, value) {
  await q(`insert into app_flags (key, value) values ($1, $2) on conflict (key) do update set value = $2, at = now()`, [key, value]);
}
