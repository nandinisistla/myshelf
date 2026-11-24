// Owner tools: save a backup of the whole shelf, or reset to that backup.
// Protected by OWNER_KEY (set it in Vercel → Settings → Environment Variables).
import { handler, today } from '../lib/http.js';
import { q, TABLES } from '../lib/db.js';
import { getState, logEvent, UserError } from '../lib/core.js';

const SERIAL = ['routines', 'products', 'reactions', 'events', 'chat'];

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { action, key } = req.json;
  if (!process.env.OWNER_KEY) throw new UserError('Owner tools are off. Set OWNER_KEY in Vercel to turn them on.');
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
