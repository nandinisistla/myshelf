// Your skin profile drives everything: which ingredients get flagged, what counts as
// helping, and what goes on "Better to avoid". It's all worked out here, live, so the
// whole app updates the moment you save your profile.
import { store } from './store.js';

// Allergens you can pick, and how to spot them in an ingredient list.
export const ALLERGEN_MATCH = {
  'Fragrance': { family: 'Fragrance' },
  'Essential oils': { family: 'Essential oils & plant extracts' },
  'Drying alcohol': { family: 'Drying alcohol' },
  'Sulfates': { name: /sulfate/i },
  'Parabens': { name: /paraben/i },
  'Coconut oil': { family: 'Coconut-derived', name: /cocos nucifera|coconut/i },
  'Silicones': { family: 'Silicones', name: /cone\b|siloxane/i },
  'Lanolin': { name: /lanolin/i },
};
export const FAMILY_TO_ALLERGEN = Object.fromEntries(
  Object.entries(ALLERGEN_MATCH).filter(([, m]) => m.family).map(([k, m]) => [m.family, k]));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const allergenMatcher = (a) => ALLERGEN_MATCH[a] || { name: new RegExp(esc(a), 'i') };
export const matches = (i, m) => Boolean((m.family && i.family === m.family) || (m.name && m.name.test(`${i.inci} ${i.plain || ''}`)));

// What helps each skin problem, and what can make it worse.
export const PROBLEM_RULES = {
  'Redness': { helps: ['Azelaic acid', 'Soothing ingredients', 'Niacinamide'], worse: ['Fragrance', 'Drying alcohol'] },
  'Dark spots': { helps: ['Niacinamide', 'Vitamin C', 'Azelaic acid', 'Retinoids', 'Exfoliating acids', 'Sunscreen filters'], names: /tranexamic|arbutin|kojic|licorice|glycyrrhiz/i, worse: [] },
  'Breakouts': { helps: ['Azelaic acid', 'Niacinamide', 'Retinoids'], names: /salicyl|benzoyl/i, worse: ['Coconut-derived'] },
  'Sensitivity': { helps: ['Soothing ingredients'], names: /ceramide/i, worse: ['Fragrance', 'Drying alcohol'] },
  'Dryness': { helps: ['Humectants', 'Oils & emollients'], names: /ceramide|squalane/i, worse: ['Drying alcohol', 'Cleansers (surfactants)'] },
  'Oiliness': { helps: ['Niacinamide'], names: /salicyl|zinc/i, worse: ['Coconut-derived'] },
  'Uneven texture': { helps: ['Exfoliating acids', 'Retinoids'], worse: [] },
  'Itchy skin': { helps: ['Soothing ingredients'], names: /oat|colloidal|ceramide/i, worse: ['Fragrance', 'Drying alcohol'] },
  'Dandruff': { helps: [], names: /zinc pyrithione|ketoconazole|salicyl|piroctone|selenium/i, worse: ['Fragrance'] },
  'Hair thinning': { helps: ['Peptides'], names: /caffeine|rosemary|redensyl|procapil|biotin/i, worse: [] },
};
// Which areas each problem is about.
const PROBLEM_AREAS = { 'Dandruff': ['scalp'], 'Hair thinning': ['scalp'] };
const problemAreas = (pr) => PROBLEM_AREAS[pr] || ['face', 'body'];

const profile = () => store.state?.profile || {};
const problems = () => profile().problems || [];
export const allergens = () => profile().allergens || [];

// Does this ingredient help one of your problems? Returns the problem names.
export function helpsWith(i, area) {
  return problems().filter((pr) => {
    const r = PROBLEM_RULES[pr];
    if (!r || !problemAreas(pr).includes(area)) return false;
    return r.helps.includes(i.family) || (r.names && r.names.test(`${i.inci} ${i.plain || ''}`));
  });
}
// Could this ingredient make one of your problems worse?
export function worseFor(i, area) {
  return problems().filter((pr) => PROBLEM_RULES[pr] && problemAreas(pr).includes(area) && PROBLEM_RULES[pr].worse.includes(i.family));
}
// Which of your allergens is this ingredient?
export function allergenOf(i) {
  return allergens().find((a) => matches(i, allergenMatcher(a))) || null;
}

// One verdict per ingredient, from your profile. Falls back to the AI's flag.
export function verdict(i, p) {
  const al = allergenOf(i);
  if (al) return { flag: 'avoid', note: `${al} is on your avoid list.` };
  const worse = worseFor(i, p.area);
  if (worse.length) return { flag: 'watch', note: `Can make ${lower(worse)} worse.` };
  const helps = helpsWith(i, p.area);
  if (helps.length) return { flag: 'good', note: `Helps with ${lower(helps)}.` };
  return { flag: i.flag === 'good' ? 'good' : 'neutral', note: '' };
}

// Product level: which allergens it contains, and which of your problems it helps.
export function productAllergens(p) {
  const out = new Set();
  for (const i of p.ingredients || []) { const a = allergenOf(i); if (a) out.add(a); }
  return [...out];
}
export function productHelps(p) {
  const out = new Map();
  for (const i of p.ingredients || []) for (const pr of helpsWith(i, p.area)) {
    if (!out.has(pr)) out.set(pr, []);
    if (out.get(pr).length < 3) out.get(pr).push(i.plain || i.inci);
  }
  return out; // problem -> a few ingredient names
}

const lower = (xs) => {
  const w = xs.map((x) => x.toLowerCase());
  return w.length < 2 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
};
