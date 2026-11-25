// Why each ingredient type can bother skin, in one plain sentence.
export const WHY = {
  'Fragrance': 'The most common cause of reactions to skincare. Even small amounts can cause redness, itching or a rash.',
  'Essential oils & plant extracts': 'Plants carry their own natural fragrance chemicals, which often irritate sensitive skin or cause allergic rashes.',
  'Preservatives': 'A few preservatives are well-known allergens and can cause itchy, red patches where the product goes.',
  'Drying alcohol': 'Strips the skin’s natural oils, leaving it dry, tight and easier to irritate.',
  'Exfoliating acids': 'They dissolve the top layer of skin. Too much, or too often, causes stinging, redness and peeling.',
  'Retinoids': 'They speed up skin renewal, which often means dryness, peeling and redness, especially at first.',
  'Vitamin C': 'Pure vitamin C is acidic and can sting or redden sensitive skin.',
  'Niacinamide': 'At high strengths (10% and up) it can cause redness or flushing in some people.',
  'Azelaic acid': 'Often tingles, itches or stings, especially in the first few weeks.',
  'Soothing ingredients': 'Rarely the problem, though plant-based soothers like aloe or chamomile can still bother very sensitive skin.',
  'Humectants': 'Rarely the problem. They pull water into the skin and are gentle for most people.',
  'Oils & emollients': 'Rich oils and butters can clog pores and lead to breakouts, especially on oily or acne-prone skin.',
  'Silicones': 'They leave a smooth film on the skin. Usually gentle, but for some people the film traps oil and sweat and clogs pores.',
  'Sunscreen filters': 'Some chemical sun filters can sting or cause an itchy rash on sensitive skin.',
  'Cleansers (surfactants)': 'Strong cleansers strip the skin, leaving it dry, tight or itchy.',
  'Peptides': 'Rarely irritating. If a peptide product bothers you, it’s usually something else in it.',
  'Antioxidants': 'Rarely irritating, though some plant-based ones can bother sensitive skin.',
  'Colorants': 'Dyes are added for looks, not for your skin, and some can cause allergic reactions.',
  'Coconut-derived': 'Coconut oil and some coconut-based ingredients can clog pores and cause breakouts.',
  'Deodorant actives': 'Baking soda and aluminium salts often cause underarm itching, redness or a rash.',
};
export const whyFor = (family) => WHY[family] || 'Not a common irritant, but any ingredient can bother some people.';

// The same idea in a few words, for the compact cards.
export const WHY_SHORT = {
  'Fragrance': 'The #1 cause of skincare reactions',
  'Essential oils & plant extracts': 'Natural scents that can irritate',
  'Preservatives': 'A few are common allergens',
  'Drying alcohol': 'Dries and irritates skin',
  'Exfoliating acids': 'Can sting, redden and peel',
  'Retinoids': 'Dryness and peeling at first',
  'Vitamin C': 'Acidic, can sting',
  'Niacinamide': 'Can flush at high strength',
  'Azelaic acid': 'Can tingle at first',
  'Soothing ingredients': 'Rarely a problem',
  'Humectants': 'Rarely a problem',
  'Oils & emollients': 'Rich ones can clog pores',
  'Silicones': 'The film can trap oil',
  'Sunscreen filters': 'Some can sting',
  'Cleansers (surfactants)': 'Strong ones strip skin',
  'Peptides': 'Rarely irritating',
  'Antioxidants': 'Rarely irritating',
  'Colorants': 'Added for looks; can cause allergies',
  'Coconut-derived': 'Can clog pores',
  'Deodorant actives': 'Can cause underarm rash',
};
export const whyShort = (family) => WHY_SHORT[family] || 'Not a common irritant';
