// Nandini's demo story. Everything is marked demo = true and can be removed in one click.
//
// The story: Nandini has combination, redness-prone skin and wants to fade dark spots.
// All summer she used a rose toner and a rose face cream, both fragranced. Her face kept
// flaring up (8 bad days, June to October). Every one of those weeks had fragrance in it.
// On Oct 10 she stopped both and rebuilt her face routine fragrance-free (Anua + SKIN1004).
// No face bad days since. Her body products also contain fragrance and have been fine,
// so the pattern is about her face, not fragrance everywhere.
//
// Face ingredient lists are taken from the products' published labels (Fresh: the main
// ingredients only), so the pattern is the same every time. Hair and body products are
// looked up live, like any product you add.

const I = (inci, plain, family, does, flag = 'neutral') => ({ inci, plain, family, does, flag });
const WATER = I('Water', 'Water', 'Water & base', 'The base of the formula.');

export const DEMO_PROFILE = {
  name: 'Nandini Sistla',
  skin_type: 'Combination',
  problems: ['Redness', 'Dark spots', 'Sensitivity', 'Hair thinning'],
  allergens: ['Fragrance'],
  goals: 'Fade dark spots, calm redness, thicker hair',
};

// Ingredient types Nandini has confirmed (she tapped "Yes" on For me).
export const DEMO_STATUSES = [{ family: 'Fragrance', status: 'agree' }];

// Her own two products get start dates that fit the story (only if they still have the default date).
export const DEMO_OWN_DATES = [
  { match: 'air-fit', started: '2026-10-14' },
  { match: 'azelaic', started: '2026-10-20' },
];

export const DEMO_PRODUCTS = [
  // ---- summer face routine: both fragranced, both stopped on Oct 10 ----
  {
    name: 'Alcohol-Free Rose Petal Witch Hazel Toner', brand: 'Thayers', routine: 'Morning', area: 'face', kind: 'bottle',
    started: '2026-06-01', stopped: '2026-10-10', match: 'rose petal',
    summary: 'A rose-scented witch hazel toner with aloe.',
    ingredients: [
      WATER,
      I('Glycerin', 'Glycerin', 'Humectants', 'Pulls water into the skin.', 'good'),
      I('Hamamelis Virginiana (Witch Hazel) Extract', 'Witch hazel', 'Essential oils & plant extracts', 'Plant extract that tightens the look of pores.'),
      I('Aloe Barbadensis Leaf Extract', 'Aloe vera', 'Soothing ingredients', 'Calms and hydrates.', 'good'),
      I('Rosa Centifolia Flower Water', 'Rose water', 'Essential oils & plant extracts', 'Rose water for scent and softness.'),
      I('Parfum/Fragrance', 'Fragrance', 'Fragrance', 'Adds the rose scent.', 'watch'),
      I('Phenoxyethanol', 'Phenoxyethanol', 'Preservatives', 'Keeps the formula free of bacteria.'),
      I('Caprylyl Glycol', 'Caprylyl glycol', 'Humectants', 'Moisturises and helps the preservative.'),
      I('Ethylhexylglycerin', 'Ethylhexylglycerin', 'Preservatives', 'Helps the preservative work.'),
      I('Citric Acid', 'Citric acid', 'pH adjusters', 'Balances the pH.'),
      I('Potassium Hydroxide', 'Potassium hydroxide', 'pH adjusters', 'Balances the pH.'),
    ],
  },
  {
    name: 'Rose Deep Hydration Face Cream', brand: 'Fresh', routine: 'Night', area: 'face', kind: 'jar',
    started: '2026-07-10', stopped: '2026-10-10', match: 'rose deep',
    summary: 'A rich rose moisturiser with hyaluronic acid. Main ingredients from the label.',
    ingredients: [
      WATER,
      I('Glycerin', 'Glycerin', 'Humectants', 'Pulls water into the skin.', 'good'),
      I('C15-19 Alkane', 'Light emollient', 'Oils & emollients', 'Makes skin feel soft and silky.'),
      I('Butylene Glycol', 'Butylene glycol', 'Humectants', 'Light hydrator that helps other ingredients dissolve.'),
      I('Propanediol', 'Propanediol', 'Humectants', 'Light hydrator.'),
      I('Isostearyl Isostearate', 'Emollient ester', 'Oils & emollients', 'Softens and smooths skin.'),
      I('Hexyl Laurate', 'Emollient ester', 'Oils & emollients', 'Gives a smooth, non-greasy feel.'),
      I('Pentylene Glycol', 'Pentylene glycol', 'Humectants', 'Hydrates and helps preserve.'),
      I('Sodium Hyaluronate', 'Hyaluronic acid', 'Humectants', 'Holds water in the skin.', 'good'),
      I('Rosa Damascena Flower Oil', 'Rose oil', 'Essential oils & plant extracts', 'Nourishing oil with a strong rose scent.', 'watch'),
      I('Serine', 'Serine (amino acid)', 'Other', 'Supports the skin’s natural moisture.'),
      I('BHT', 'BHT', 'Antioxidants', 'Stops the oils in the formula going off.'),
      I('Caramel', 'Caramel', 'Colorants', 'Gives the cream its colour.'),
      I('Phenoxyethanol', 'Phenoxyethanol', 'Preservatives', 'Keeps the formula free of bacteria.'),
      I('Fragrance', 'Fragrance', 'Fragrance', 'Adds the rose scent.', 'watch'),
      I('Citronellol', 'Citronellol', 'Fragrance', 'Rose-scented fragrance allergen.', 'watch'),
      I('Geraniol', 'Geraniol', 'Fragrance', 'Rose-scented fragrance allergen.', 'watch'),
    ],
  },
  // ---- new fragrance-free face routine from October ----
  {
    name: 'Heartleaf Pore Control Cleansing Oil Mild', brand: 'Anua', routine: 'Night', area: 'face', kind: 'pump',
    started: '2026-10-14', match: 'cleansing oil mild',
    summary: 'A fragrance-free oil cleanser that melts off sunscreen and makeup.',
    ingredients: [
      I('Ethylhexyl Stearate', 'Light oil', 'Oils & emollients', 'Dissolves makeup and sunscreen.'),
      I('Sorbeth-30 Tetraoleate', 'Emulsifier', 'Cleansers (surfactants)', 'Turns the oil milky so it rinses off.'),
      I('Cetyl Ethylhexanoate', 'Light oil', 'Oils & emollients', 'Silky, non-greasy emollient.'),
      I('Caprylic/Capric Triglyceride', 'Coconut-based oil', 'Oils & emollients', 'Light, gentle emollient.'),
      I('Triethylhexanoin', 'Light oil', 'Oils & emollients', 'Helps lift makeup.'),
      I('Rosmarinus Officinalis Leaf Oil', 'Rosemary oil', 'Essential oils & plant extracts', 'Plant oil with antioxidant benefits.'),
      I('Helianthus Annuus Seed Oil', 'Sunflower oil', 'Oils & emollients', 'Nourishing plant oil.', 'good'),
      I('Houttuynia Cordata Extract', 'Heartleaf extract', 'Soothing ingredients', 'Calms redness.', 'good'),
      I('Isododecane', 'Isododecane', 'Other', 'Light solvent that evaporates.'),
      WATER,
      I('Sorbitan Sesquioleate', 'Emulsifier', 'Other', 'Helps oil and water mix.'),
      I('Tocopherol', 'Vitamin E', 'Antioxidants', 'Protects skin and the formula.', 'good'),
    ],
  },
  {
    name: 'Niacinamide 10% + TXA 4% Serum', brand: 'Anua', routine: 'Night', area: 'face', kind: 'dropper',
    started: '2026-10-16', match: 'niacinamide',
    summary: 'A fragrance-free brightening serum for dark spots.',
    ingredients: [
      WATER,
      I('Glycerin', 'Glycerin', 'Humectants', 'Pulls water into the skin.', 'good'),
      I('Niacinamide', 'Niacinamide (vitamin B3)', 'Niacinamide', 'Fades dark spots and evens tone.', 'good'),
      I('Tranexamic Acid', 'Tranexamic acid (TXA)', 'Other', 'Fades dark spots.', 'good'),
      I('Butylene Glycol', 'Butylene glycol', 'Humectants', 'Light hydrator.'),
      I('Diethoxyethyl Succinate', 'Diethoxyethyl succinate', 'Other', 'Helps actives absorb.'),
      I('1,2-Hexanediol', '1,2-Hexanediol', 'Preservatives', 'Hydrates and helps preserve.'),
      I('Arbutin', 'Arbutin', 'Other', 'Brightens dark spots.', 'good'),
      I('Pentylene Glycol', 'Pentylene glycol', 'Humectants', 'Hydrates and helps preserve.'),
      I('Sodium Hyaluronate', 'Hyaluronic acid', 'Humectants', 'Holds water in the skin.', 'good'),
      I('Xanthan Gum', 'Xanthan gum', 'Thickeners & texture', 'Gives the serum body.'),
      I('Betaine Salicylate', 'Betaine salicylate', 'Exfoliating acids', 'Very gentle BHA for pores.'),
      I('Alpha-Arbutin', 'Alpha-arbutin', 'Other', 'Brightens dark spots.', 'good'),
      I('Coccinia Indica Fruit Extract', 'Ivy gourd extract', 'Essential oils & plant extracts', 'Plant antioxidant.'),
      I('Eclipta Prostrata Extract', 'False daisy extract', 'Essential oils & plant extracts', 'Plant antioxidant.'),
      I('Macadamia Integrifolia Seed Oil', 'Macadamia oil', 'Oils & emollients', 'Nourishing plant oil.'),
      I('Olea Europaea Fruit Oil', 'Olive oil', 'Oils & emollients', 'Nourishing plant oil.'),
      I('Simmondsia Chinensis Seed Oil', 'Jojoba oil', 'Oils & emollients', 'Light plant oil.'),
      I('Caprylic/Capric Triglyceride', 'Coconut-based oil', 'Oils & emollients', 'Light, gentle emollient.'),
      I('Panthenol', 'Panthenol (vitamin B5)', 'Soothing ingredients', 'Soothes and repairs.', 'good'),
      I('Cyanocobalamin', 'Vitamin B12', 'Other', 'Gives the serum its pink colour.'),
      I('Polyglutamic Acid', 'Polyglutamic acid', 'Humectants', 'Strong hydrator.', 'good'),
      I('3-O-Ethyl Ascorbic Acid', 'Vitamin C (gentle form)', 'Vitamin C', 'Brightens.', 'good'),
      I('Ceramide NP', 'Ceramide', 'Other', 'Strengthens the skin barrier.', 'good'),
      I('Theobroma Cacao Extract', 'Cacao extract', 'Antioxidants', 'Plant antioxidant.'),
      I('Asiaticoside', 'Centella compound', 'Soothing ingredients', 'Calms redness.', 'good'),
      I('Centella Asiatica Extract', 'Centella (cica)', 'Soothing ingredients', 'Calms redness.', 'good'),
      I('Madecassic Acid', 'Centella compound', 'Soothing ingredients', 'Calms redness.', 'good'),
      I('Hyaluronic Acid', 'Hyaluronic acid', 'Humectants', 'Holds water in the skin.', 'good'),
    ],
  },
  // ---- hair and body: looked up live ----
  { name: 'Multi-Peptide Serum for Hair Density', brand: 'The Ordinary', routine: 'Hair', area: 'scalp', started: '2026-07-08', match: 'peptide' },
  { name: '100% Plant-Derived Squalane', brand: 'The Ordinary', routine: 'Hair', area: 'scalp', started: '2026-08-12', match: 'squalane' },
  { name: 'Deodorant Coconut & Vanilla', brand: 'Native', routine: 'Body', area: 'body', started: '2026-08-01', match: 'deodorant' },
  { name: 'Pure Peace Body Wash', brand: 'Method', routine: 'Body', area: 'body', started: '2026-09-03', match: 'body wash' },
];

export const DEMO_REACTIONS = [
  { date: '2026-06-12', area: 'face', severity: 1, note: 'Small red bumps on my cheeks after toning' },
  { date: '2026-06-20', area: 'face', severity: 2, note: 'Cheeks red and itchy by the evening' },
  { date: '2026-07-04', area: 'face', severity: 2, note: 'Redness around my nose, stings a little' },
  { date: '2026-07-26', area: 'face', severity: 3, note: 'Big flare-up: red, itchy and bumpy across both cheeks' },
  { date: '2026-08-14', area: 'face', severity: 2, note: 'Itchy patches along my jaw' },
  { date: '2026-09-03', area: 'face', severity: 2, note: 'Red cheeks again the morning after the night cream' },
  { date: '2026-09-27', area: 'face', severity: 1, note: 'Mild redness, a bit itchy' },
  { date: '2026-10-08', area: 'face', severity: 2, note: 'Itchy, red cheeks. Going to try cutting out fragrance' },
];
