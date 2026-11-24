// Quick setup check: open /api/health in the browser.
import { q, databaseUrl } from '../lib/db.js';

export default async function handler(req, res) {
  const out = {
    database_configured: Boolean(databaseUrl()),
    database_ok: false,
    ai_key_set: Boolean(process.env.ANTHROPIC_API_KEY),
    owner_key_set: Boolean(process.env.OWNER_KEY),
    node: process.version,
  };
  try {
    const r = await q('select count(*)::int as n from products');
    out.database_ok = true;
    out.products = r[0].n;
  } catch (e) {
    out.database_error = String(e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, '[hidden]').slice(0, 300);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
