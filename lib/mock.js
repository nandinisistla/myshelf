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

// Photo-like test products on a white background (local testing only).
export function mockBottleSvg(url) {
  const n = decodeURIComponent(url).toLowerCase();
  const alt = n.endsWith('-b.svg');
  const W = 400, H = 600;
  const g = (id, a, b) => `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>`;
  let body;
  if (/sun|spf/.test(n)) {
    body = `<defs>${g('b', '#cfe3d6', '#f2f8f4')}${g('c', '#1f5e43', '#3c8a66')}</defs>
      <path d="M140 110 L260 110 L245 470 L155 470 Z" fill="url(#b)"/><rect x="132" y="96" width="136" height="22" rx="3" fill="#dfeee5"/>
      <rect x="150" y="468" width="100" height="70" rx="12" fill="url(#c)"/><text x="200" y="250" font-family="Arial" font-size="20" font-weight="700" text-anchor="middle" fill="#2c6b4e">SKIN1004</text>
      <text x="200" y="280" font-family="Arial" font-size="13" text-anchor="middle" fill="#2c6b4e">CENTELLA</text>`;
  } else if (/wash/.test(n)) {
    body = `<defs>${g('b', '#d9c6d2', '#f3e9ef')}${g('c', '#cfcfcf', '#ffffff')}</defs>
      <rect x="185" y="60" width="30" height="70" fill="url(#c)"/><path d="M200 70 h80 v18 h-80z" fill="#e9e9e9"/><rect x="170" y="125" width="60" height="30" rx="4" fill="url(#c)"/>
      <path d="M140 150 Q200 135 260 150 L268 520 Q200 540 132 520 Z" fill="url(#b)"/><text x="200" y="330" font-family="Georgia" font-size="30" text-anchor="middle" fill="#6b3f58">method</text>`;
  } else if (/deo/.test(n)) {
    body = `<defs>${g('b', '#e8e6e1', '#ffffff')}${g('c', '#1d3557', '#2e4c74')}</defs>
      <rect x="140" y="110" width="120" height="430" rx="22" fill="url(#b)"/><rect x="140" y="110" width="120" height="120" rx="22" fill="url(#c)"/>
      <text x="200" y="330" font-family="Arial" font-size="26" font-weight="700" text-anchor="middle" fill="#1d3557">native</text>`;
  } else if (/hair|peptide|squalane|oil/.test(n)) {
    const tall = /hair|peptide/.test(n);
    body = `<defs>${g('b', '#d8d8d8', '#fafafa')}${g('c', '#e6e6e6', '#ffffff')}</defs>
      <rect x="160" y="${tall ? 70 : 120}" width="80" height="${tall ? 90 : 70}" rx="8" fill="url(#c)"/><rect x="${tall ? 135 : 140}" y="${tall ? 155 : 185}" width="${tall ? 130 : 120}" height="${tall ? 390 : 330}" rx="10" fill="url(#b)"/>
      <rect x="150" y="${tall ? 300 : 300}" width="${tall ? 100 : 90}" height="90" fill="#fff"/><text x="200" y="${tall ? 345 : 345}" font-family="Arial" font-size="12" text-anchor="middle" fill="#222">The Ordinary.</text>`;
  } else {
    const azel = /azel/.test(n);
    body = `<defs>${g('b', azel ? '#c9d9ec' : '#e4e4e8', azel ? '#eef4fb' : '#ffffff')}${g('c', '#f0f0f0', '#ffffff')}</defs>
      <path d="M180 60 C180 20 220 20 220 60 L220 120 L180 120 Z" fill="${azel ? '#e9eef5' : '#f2f2f2'}"/><rect x="168" y="118" width="64" height="44" rx="6" fill="url(#c)"/>
      <rect x="132" y="160" width="136" height="380" rx="26" fill="url(#b)"/><text x="200" y="330" font-family="Arial" font-size="22" font-weight="700" text-anchor="middle" fill="#2a3a55">anua</text>
      <text x="200" y="358" font-family="Arial" font-size="12" text-anchor="middle" fill="#2a3a55">${azel ? 'AZELAIC ACID 10' : 'NIACINAMIDE 10'}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${alt ? '<g transform="translate(200 300) scale(.92) translate(-200 -300)">' + body + '</g>' : body}</svg>`;
}
