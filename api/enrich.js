// POST { name, brand, ingredientsText } → AI finds and explains the ingredient list.
// Nothing is saved here: the user reviews it first, then the app saves via /api/mutate.
import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';
import { useQuota } from '../lib/ai.js';
import { enrichProduct } from '../lib/enrich.js';
import { UserError } from '../lib/core.js';

export const config = { maxDuration: 60 };

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { name, brand, ingredientsText } = req.json;
  if (!name || String(name).trim().length < 2) throw new UserError('Type a product name first.');
  await useQuota('enrich');
  const profile = (await q(`select skin_type, goals, avoid from profile where id = 1`))[0];
  const result = await enrichProduct({
    name: String(name).slice(0, 120),
    brand: brand ? String(brand).slice(0, 80) : '',
    ingredientsText: ingredientsText ? String(ingredientsText).slice(0, 4000) : '',
    profile,
  });
  res.status(200).json(result);
});
