// Fake AI responses, used ONLY for local testing (MOCK_AI=1). Never used on Vercel.

const SETS = {
  serum: ['Water', 'Niacinamide', 'Glycerin', 'Butylene Glycol', 'Panthenol', 'Sodium Hyaluronate', 'Carbomer', 'Tromethamine', '1,2-Hexanediol', 'Ethylhexylglycerin'],
  sunscreen: ['Water', 'Dibutyl Adipate', 'Propanediol', 'Diethylamino Hydroxybenzoyl Hexyl Benzoate', 'Ethylhexyl Triazone', 'Centella Asiatica Extract', 'Glycerin', 'Niacinamide', 'Carbomer', 'Parfum'],
  body: ['Water', 'Sodium Laureth Sulfate', 'Cocamidopropyl Betaine', 'Glycerin', 'Sodium Chloride', 'Parfum', 'Linalool', 'Limonene', 'Citric Acid', 'Sodium Benzoate'],
  deo: ['Caprylic/Capric Triglyceride', 'Tapioca Starch', 'Cocos Nucifera Oil', 'Sodium Bicarbonate', 'Butyrospermum Parkii Butter', 'Parfum', 'Magnesium Hydroxide'],
  oil: ['Squalane'],
  hair: ['Water', 'Propanediol', 'Acetyl Tetrapeptide-3', 'Caffeine', 'Biotinoyl Tripeptide-1', 'Glycerin', 'Phenoxyethanol'],
};
const FAM = {
  'Niacinamide': 'Niacinamide', 'Glycerin': 'Humectants', 'Butylene Glycol': 'Humectants', 'Panthenol': 'Soothing ingredients',
  'Sodium Hyaluronate': 'Humectants', 'Carbomer': 'Thickeners & texture', 'Tromethamine': 'pH adjusters', '1,2-Hexanediol': 'Preservatives',
  'Ethylhexylglycerin': 'Preservatives', 'Dibutyl Adipate': 'Oils & emollients', 'Propanediol': 'Humectants',
  'Diethylamino Hydroxybenzoyl Hexyl Benzoate': 'Sunscreen filters', 'Ethylhexyl Triazone': 'Sunscreen filters',
  'Centella Asiatica Extract': 'Soothing ingredients', 'Sodium Laureth Sulfate': 'Cleansers (surfactants)',
  'Cocamidopropyl Betaine': 'Coconut-derived', 'Sodium Chloride': 'Thickeners & texture', 'Citric Acid': 'pH adjusters',
  'Caprylic/Capric Triglyceride': 'Oils & emollients', 'Tapioca Starch': 'Deodorant actives', 'Cocos Nucifera Oil': 'Coconut-derived',
  'Sodium Bicarbonate': 'Deodorant actives', 'Butyrospermum Parkii Butter': 'Oils & emollients', 'Magnesium Hydroxide': 'Deodorant actives',
  'Squalane': 'Oils & emollients', 'Acetyl Tetrapeptide-3': 'Peptides', 'Caffeine': 'Antioxidants', 'Biotinoyl Tripeptide-1': 'Peptides',
};
function pick(name) {
  const n = name.toLowerCase();
  if (/sun|spf/.test(n)) return ['sunscreen', 'face', 'tube', { body: '#E9F3EC', cap: '#2E7D5B', label: '#2E7D5B' }];
  if (/wash|soap/.test(n)) return ['body', 'body', 'pump', { body: '#F4E3EC', cap: '#FFFFFF', label: '#7A3B5C' }];
  if (/deo/.test(n)) return ['deo', 'body', 'stick', { body: '#FFFFFF', cap: '#1F3A5F', label: '#1F3A5F' }];
  if (/squalane|oil/.test(n)) return ['oil', 'scalp', 'dropper', { body: '#F7F7F7', cap: '#FFFFFF', label: '#222222' }];
  if (/hair|peptide/.test(n)) return ['hair', 'scalp', 'dropper', { body: '#F2F2F2', cap: '#FFFFFF', label: '#222222' }];
  return ['serum', 'face', 'dropper', { body: '#E8EEF6', cap: '#FFFFFF', label: '#3A4D6B' }];
}
function ingredients(set) {
  return SETS[set].map((inci) => ({
    inci, plain: inci.split(' ')[0], family: FAM[inci] || 'Other',
    does: 'Test description of what this does.', for_you: 'Test note for your skin.', flag: /Parfum|Linalool|Limonene/.test(inci) ? 'watch' : 'neutral',
  }));
}

export function mockSearch(term) {
  return [
    { code: 'm1', name: term.replace(/\b\w/g, (c) => c.toUpperCase()), brand: 'Test Brand', image: null, thumb: null, ingredientsText: '' },
  ];
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return { text: m.content, isToolResult: false };
    const tr = m.content.find((c) => c.type === 'tool_result');
    if (tr) return { text: '', isToolResult: true };
    return { text: m.content.filter((c) => c.type === 'text').map((c) => c.text).join(' '), isToolResult: false };
  }
  return { text: '', isToolResult: false };
}

export async function mockClaude(body) {
  await new Promise((r) => setTimeout(r, 250));
  const sys = body.system || '';
  if (sys.includes('label-reading')) {
    const m = body.messages[0].content.match(/Product: (.*?)(?: by (.*?))?\./);
    const name = m ? m[1] : 'Product';
    const [set, area, kind, colors] = pick(name);
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({
      name, brand: m?.[2] || 'Test Brand', area, kind, colors, summary: 'Test summary (mock AI).',
      ingredients: ingredients(set), sources: [{ title: 'Mock source', url: 'https://example.com' }], confidence: 'medium', note: 'Mock data for local testing.',
    }) }] };
  }
  if (sys.includes('pattern finder')) {
    const facts = JSON.parse(body.messages[0].content.match(/Findings: (\[.*\])/s)[1]);
    const out = { __overall: 'Mock: one family stands out.' };
    for (const f of facts) out[f.family] = `Mock explanation for ${f.family}: in ${f.in_bad_days} bad days.`;
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] };
  }
  if (body.tools) {
    const { text, isToolResult } = lastUserText(body.messages);
    if (isToolResult) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done! I saved that to your shelf and history.' }] };
    const today = (sys.match(/Today is (\d{4}-\d{2}-\d{2})/) || [])[1];
    const add = text.match(/add (?:my )?(.+)/i);
    if (add) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'add_product', input: { name: add[1], routine: 'Morning' } }] };
    if (/itch|rash|broke out|bad day|red|bump/i.test(text)) {
      const area = /scalp|hair/i.test(text) ? 'scalp' : /arm|body|back|chest|leg/i.test(text) ? 'body' : 'face';
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'log_bad_day', input: { date: today, area, severity: 2, note: text.slice(0, 80) } }] };
    }
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Mock reply: I can add products or log bad days for you.' }] };
  }
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] };
}
