// Pattern finding. This part is plain code on purpose: counts must be exact,
// so the AI only writes the plain-language explanation on top of these numbers.

import { NEVER_SUSPECT, AREAS } from './families.js';

export const WINDOW_DAYS = 7;
const FINE_AFTER_DAYS = 14;

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}
function startOf(p) {
  if (p.started) return p.started;
  const c = p.created_at ? new Date(p.created_at) : new Date();
  return c.toISOString().slice(0, 10);
}
export function usedBetween(p, from, to) {
  const s = startOf(p);
  return s <= to && (!p.stopped || p.stopped >= from);
}
export function familiesOf(p) {
  const set = new Set();
  for (const i of p.ingredients || []) if (i.family && !NEVER_SUSPECT.has(i.family)) set.add(i.family);
  return set;
}

export function computeInsights(products, reactions, statuses, today) {
  const statusMap = Object.fromEntries((statuses || []).map((s) => [s.family, s.status]));
  const withIngredients = products.filter((p) => (p.ingredients || []).length);

  // Which products were in use in the 7 days before each bad day, in the same area.
  const windows = reactions.map((r) => {
    const from = addDays(r.date, -WINDOW_DAYS);
    const used = products.filter((p) => p.area === r.area && usedBetween(p, from, r.date));
    return { reaction: r, from, to: r.date, productIds: used.map((p) => p.id) };
  });
  const inAnyWindow = new Set(windows.flatMap((w) => w.productIds));

  // Products used for 2+ weeks with no bad day after them = "seems fine".
  const fine = withIngredients.filter((p) => {
    const end = p.stopped || today;
    return !inAnyWindow.has(p.id) && daysBetween(startOf(p), end) >= FINE_AFTER_DAYS;
  });
  const fineIds = new Set(fine.map((p) => p.id));

  const familyProducts = new Map();
  for (const p of withIngredients) for (const f of familiesOf(p)) {
    if (!familyProducts.has(f)) familyProducts.set(f, []);
    familyProducts.get(f).push(p);
  }

  // Each ingredient type is judged per area (face, scalp, body): fragrance can bother
  // your face while your body is perfectly fine with it. The clearest area wins.
  const RANK = { strong: 0, possible: 1, unlikely: 2, 'too-common': 3, fine: 4, 'not-enough': 5 };
  const judge = (prods, area) => {
    const inArea = prods.filter((p) => p.area === area);
    const relevant = windows.filter((w) => w.reaction.area === area);
    const hits = relevant.filter((w) => w.productIds.some((id) => inArea.some((p) => p.id === id)));
    const fineWith = inArea.filter((p) => fineIds.has(p.id));
    const areaAll = withIngredients.filter((p) => p.area === area);
    const commonness = areaAll.length ? inArea.length / areaAll.length : 0;
    let level;
    if (!inArea.length || relevant.length < 2) level = 'not-enough';
    else if (commonness > 0.8 && areaAll.length >= 4) level = 'too-common';
    else {
      const ratio = hits.length / relevant.length;
      if (ratio >= 0.75 && hits.length >= 2 && fineWith.length === 0) level = 'strong';
      else if (ratio >= 0.5 && hits.length >= 2 && fineWith.length <= 1) level = 'possible';
      else if (hits.length === 0 && fineWith.length > 0) level = 'fine';
      else level = 'unlikely';
    }
    return { area, level, inArea, relevant, hits, fineWith };
  };

  const families = [];
  for (const [family, prods] of familyProducts) {
    const areas = [...new Set(prods.map((p) => p.area))];
    const results = areas.map((a) => judge(prods, a))
      .sort((x, y) => RANK[x.level] - RANK[y.level] || y.hits.length - x.hits.length);
    const best = results[0];
    families.push({
      family, level: best.level,
      status: statusMap[family] || 'ai',
      area: best.area,
      hits: best.hits.length,
      relevant: best.relevant.length,
      fineWith: best.fineWith.length,
      fineTotal: fine.length,
      productIds: prods.map((p) => p.id),
      areaProductIds: best.inArea.map((p) => p.id),
      // products elsewhere on the body that contain it and have been fine
      fineElsewhereIds: prods.filter((p) => p.area !== best.area && fineIds.has(p.id)).map((p) => p.id),
      areas: [AREAS[best.area] || best.area],
      hitDates: best.hits.map((w) => w.reaction.date),
    });
  }

  const order = { strong: 0, possible: 1, unlikely: 2, 'too-common': 3, fine: 4, 'not-enough': 5 };
  families.sort((a, b) => order[a.level] - order[b.level] || b.hits - a.hits || a.family.localeCompare(b.family));

  // Families that always come from exactly the same products can't be told apart yet.
  const key = (f) => f.area + ':' + [...f.areaProductIds].sort((a, b) => a - b).join(',');
  for (const f of families) {
    f.together = (f.level === 'strong' || f.level === 'possible')
      ? families.filter((g) => g !== f && (g.level === 'strong' || g.level === 'possible') && key(g) === key(f)).map((g) => g.family)
      : [];
  }

  // Amber everywhere in the app = strong suspects, or ones the user agreed with.
  // "Possible" ones are shown on the For me page only, to avoid crying wolf.
  const suspects = families.filter((f) =>
    f.status === 'agree' || (f.level === 'strong' && f.status !== 'reject'));

  return {
    windowDays: WINDOW_DAYS,
    reactionCount: reactions.length,
    productCount: withIngredients.length,
    windows,
    families,
    suspectFamilies: suspects.map((f) => f.family),
    suspectPairs: suspects.map((f) => ({ family: f.family, area: f.area })),
    fineProductIds: [...fineIds],
    signature: JSON.stringify(families.filter((f) => ['strong', 'possible', 'too-common'].includes(f.level))
      .map((f) => [f.family, f.area, f.level, f.hits, f.relevant, f.fineWith])),
  };
}

// Used when the AI is unavailable.
export function templateExplanation(f) {
  if (f.level === 'strong') return `${f.family} showed up before ${f.hits} of your ${f.relevant} bad days, and in none of the products that were fine. That's a strong pattern worth testing.`;
  if (f.level === 'possible') return `${f.family} showed up before ${f.hits} of your ${f.relevant} bad days. It could be a trigger, but there isn't enough evidence to be sure yet.`;
  if (f.level === 'too-common') return `${f.family} is in almost everything you use, so it's too common to tell whether it's involved.`;
  return '';
}
