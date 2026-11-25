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

// A product is "working" when you've used it for 2+ weeks with no bad day on that area.
// If it's working, nothing in it gets flagged: your skin has already answered the question.
export const isWorking = (p) => (store.state?.insights?.fineProductIds || []).includes(p.id);

// One verdict per ingredient, from your profile. Falls back to the AI's flag.
export function verdict(i, p) {
  const al = allergenOf(i);
  if ((al || worseFor(i, p.area).length) && isWorking(p)) {
    return { flag: 'neutral', note: `${al ? `${al} is on your avoid list` : 'Can bother some skin like yours'}, but your ${p.area} has been fine with this product, so it’s working for you.` };
  }
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

// What dermatologists say to avoid on the face when you're prone to redness or
// sensitivity (AAD, National Rosacea Society). Used for "Watch for in new products".
export const WATCH_LIST = [
  { label: 'Drying alcohol', test: (i) => i.family === 'Drying alcohol' || /^(alcohol|alcohol denat\.?|sd alcohol.*|ethanol|isopropyl alcohol)$/i.test(i.inci.trim()),
    why: 'Dries out and irritates redness-prone skin. In a National Rosacea Society survey, 66% said alcohol irritated their skin.' },
  { label: 'Witch hazel', test: (i) => /hamamelis|witch hazel/i.test(`${i.inci} ${i.plain}`),
    why: 'An astringent often found in toners. People with redness-prone skin often report it as a trigger.' },
  { label: 'Menthol, peppermint and eucalyptus', test: (i) => /menthol|menthyl|mentha piperita|peppermint|eucalyptus/i.test(`${i.inci} ${i.plain}`),
    why: 'They create a cooling tingle, but that tingle is irritation. Common triggers for redness.' },
  { label: 'Camphor', test: (i) => /camphor/i.test(i.inci),
    why: 'A cooling ingredient that dermatologists say to keep off redness-prone skin.' },
  { label: 'Glycolic and lactic acid', test: (i) => /glycolic|lactic acid/i.test(i.inci),
    why: 'Strong exfoliating acids that can sting and redden sensitive skin.' },
  { label: 'Sodium lauryl sulfate', test: (i) => /sodium lauryl sulfate/i.test(i.inci),
    why: 'A harsh foaming cleanser that strips the skin’s barrier.' },
  { label: 'Urea', test: (i) => /^urea$/i.test(i.inci.trim()),
    why: 'Helps dry skin elsewhere, but dermatologists list it as an irritant for redness-prone faces.' },
  { label: 'Propylene glycol', test: (i) => /^propylene glycol$/i.test(i.inci.trim()),
    why: 'Can dry or irritate very sensitive skin.' },
];
export const WATCH_SOURCES = [
  { title: 'AAD: Rosacea skin care tips', url: 'https://www.aad.org/public/diseases/rosacea/triggers/tips' },
  { title: 'WebMD: Rosacea skin care tips', url: 'https://www.webmd.com/skin-problems-and-treatments/features/rosacea-skin-care-tips' },
];
