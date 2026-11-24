// Ingredient families. The AI picks a family for each ingredient, but a few
// well-known groups are fixed here in code so the AI can't get them wrong.

export const FAMILIES = [
  'Fragrance', 'Essential oils & plant extracts', 'Preservatives', 'Drying alcohol',
  'Exfoliating acids', 'Retinoids', 'Vitamin C', 'Niacinamide', 'Azelaic acid',
  'Soothing ingredients', 'Humectants', 'Oils & emollients', 'Silicones', 'Sunscreen filters',
  'Cleansers (surfactants)', 'Peptides', 'Antioxidants', 'Thickeners & texture',
  'pH adjusters', 'Water & base', 'Colorants', 'Coconut-derived', 'Deodorant actives', 'Other',
];

// Families too basic to ever be called a trigger.
export const NEVER_SUSPECT = new Set(['Water & base', 'pH adjusters', 'Thickeners & texture', 'Other']);

// The 26 fragrance allergens EU labels must list, plus the generic names.
const FRAGRANCE = [
  'parfum', 'fragrance', 'aroma', 'perfume', 'linalool', 'limonene', 'citronellol', 'geraniol', 'citral',
  'eugenol', 'isoeugenol', 'coumarin', 'hexyl cinnamal', 'benzyl benzoate', 'benzyl salicylate',
  'benzyl cinnamate', 'alpha-isomethyl ionone', 'amyl cinnamal', 'amylcinnamyl alcohol', 'cinnamal',
  'cinnamyl alcohol', 'farnesol', 'hydroxycitronellal', 'anise alcohol', 'butylphenyl methylpropional',
  'evernia prunastri', 'evernia furfuracea', 'methyl 2-octynoate', 'hydroxyisohexyl 3-cyclohexene carboxaldehyde',
];
const DRYING_ALCOHOL = ['alcohol', 'alcohol denat', 'alcohol denat.', 'sd alcohol', 'ethanol', 'denatured alcohol', 'isopropyl alcohol'];
const PRESERVATIVES = [
  'phenoxyethanol', 'methylisothiazolinone', 'methylchloroisothiazolinone', 'sodium benzoate',
  'potassium sorbate', 'benzyl alcohol', 'chlorphenesin', 'dmdm hydantoin', 'imidazolidinyl urea',
  'diazolidinyl urea', 'benzoic acid', 'sorbic acid', 'dehydroacetic acid', 'sodium dehydroacetate',
];

function clean(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[*†]/g, '').trim();
}

export function fixedFamily(inci) {
  const n = clean(inci);
  if (!n) return null;
  if (FRAGRANCE.some((f) => n === f || n.startsWith(f + ' ') || n.includes('(' + f) || n.includes(f + ')'))) return 'Fragrance';
  if (DRYING_ALCOHOL.includes(n)) return 'Drying alcohol';
  if (PRESERVATIVES.includes(n) || /paraben$/.test(n)) return 'Preservatives';
  if (n === 'aqua' || n === 'water' || n.startsWith('water (') || n.startsWith('aqua (')) return 'Water & base';
  return null;
}

export function normalizeIngredients(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((i) => i && (i.inci || i.plain))
    .slice(0, 80)
    .map((i) => {
      const forced = fixedFamily(i.inci);
      let family = forced || (FAMILIES.includes(i.family) ? i.family : 'Other');
      return {
        inci: String(i.inci || i.plain).trim().slice(0, 120),
        plain: String(i.plain || i.inci).trim().slice(0, 80),
        family,
        does: String(i.does || '').trim().slice(0, 200),
        for_you: String(i.for_you || '').trim().slice(0, 240),
        flag: ['good', 'neutral', 'watch'].includes(i.flag) ? i.flag : 'neutral',
      };
    });
}

// Turn a pasted ingredient list ("Water, Glycerin, Parfum...") into rows.
export function parseIngredientText(text) {
  return String(text || '')
    .replace(/^ingredients?\s*[:\-]/i, '')
    .split(/,(?![^()]*\))|\n|;/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s && s.length < 120)
    .map((inci) => ({ inci, plain: inci, family: fixedFamily(inci) || 'Other', does: '', for_you: '', flag: 'neutral' }));
}

export const AREAS = { face: 'Face', scalp: 'Hair & scalp', body: 'Body' };
export const KINDS = ['dropper', 'tube', 'pump', 'jar', 'stick', 'bottle', 'spray'];
