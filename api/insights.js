// POST → recompute patterns and have the AI write plain-language explanations.
// The counts come from code (lib/insights.js); the AI only explains them.
import { handler, today } from '../lib/http.js';
import { q } from '../lib/db.js';
import { getState, describeProfile } from '../lib/core.js';
import { claude, textOf, extractJSON, useQuota } from '../lib/ai.js';

export const config = { maxDuration: 60 };

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const t = today(req);
  const state = await getState(t);
  const ins = state.insights;
  const worth = ins.families.filter((f) => ['strong', 'possible', 'too-common'].includes(f.level));
  if (!worth.length || ins.explanationsFresh) return res.status(200).json(state);

  await useQuota('insights');
  const name = (id) => state.products.find((p) => p.id === id)?.name || '';
  const facts = worth.map((f) => ({
    family: f.family, level: f.level, in_bad_days: `${f.hits} of ${f.relevant}`,
    in_products_that_were_fine: `${f.fineWith} of ${f.fineTotal}`,
    found_in: f.productIds.map(name), areas: f.areas,
  }));
  const resp = await claude({
    max_tokens: 1500,
    system: `You write short, plain, calm explanations for MyShelf, a personal skincare pattern finder.
Use ONLY the numbers given. Never claim certainty or diagnose; say "pattern", "suspect", "worth testing".
Suggest a simple next step when useful (e.g. "try 2 weeks without it"). Max 2 sentences per family.`,
    messages: [{ role: 'user', content:
`User profile: ${describeProfile(state.profile)}
Bad days logged: ${ins.reactionCount}. Window checked: ${ins.windowDays} days before each bad day, same body area.
Findings: ${JSON.stringify(facts)}

Return ONLY JSON: {"<family>": "explanation", ..., "__overall": "one-sentence summary of what stands out"}` }],
  });
  const data = extractJSON(textOf(resp)) || {};
  const clean = {};
  for (const f of worth) if (typeof data[f.family] === 'string') clean[f.family] = data[f.family].slice(0, 400);
  if (typeof data.__overall === 'string') clean.__overall = data.__overall.slice(0, 300);
  await q(`insert into insight_cache (id, signature, data) values (1, $1, $2::jsonb)
           on conflict (id) do update set signature = $1, data = $2::jsonb, updated_at = now()`,
    [ins.signature, JSON.stringify(clean)]);
  res.status(200).json(await getState(t));
});
