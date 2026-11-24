// For me: what works for your skin and what might not.
// The counts are exact (code). The AI writes the explanation. You decide.
import { h, put, s, toast, AREAS } from './ui.js';
import { store, mutate, refreshInsights, S } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';

let askedFor = '';

const LEVEL = {
  strong: ['Strong suspect', 'amber'], possible: ['Possible', 'amber'], unlikely: ['Unlikely', ''],
  'too-common': ['Too common to tell', ''], fine: ['Seems fine', 'ok'], 'not-enough': ['Not enough data', ''],
};
const WHO = { ai: 'AI suggested', agree: 'You agreed', reject: 'You said: not this', unsure: 'You’re not sure' };

export function renderForMe(view) {
  const st = store.state;
  const ins = st.insights;
  const head = [
    h('div', { class: 'top' }, h('h1', { class: 'title' }, 'What works for me')),
    h('p', { class: 'sub' }, `Based on ${ins.reactionCount} bad day${ins.reactionCount === 1 ? '' : 's'} and ${ins.productCount} product${ins.productCount === 1 ? '' : 's'}. I compare what you used in the ${ins.windowDays} days before each bad day.`),
  ];

  if (ins.reactionCount < 2) {
    put(view, ...head, h('div', { class: 'empty' },
      dotsArt(),
      h('h3', null, ins.reactionCount ? 'One more bad day and I can start' : 'Nothing to connect yet'),
      h('p', null, 'When your skin, scalp or body acts up, log it. After 2 or more, I connect the dots between your products, ingredients and those days.'),
      h('button', { class: 'btn primary', onclick: () => openBadDay() }, "Log a bad day")),
    fineSection(), disclaimer());
    return;
  }

  // Ask the AI to write fresh explanations when the pattern changed.
  const worth = ins.families.some((f) => ['strong', 'possible', 'too-common'].includes(f.level));
  if (st.aiEnabled && worth && !ins.explanationsFresh && askedFor !== ins.signature) {
    askedFor = ins.signature;
    refreshInsights().catch(() => {});
  }

  const suspects = ins.families.filter((f) => f.status === 'agree' || ['strong', 'possible'].includes(f.level));
  const rejected = ins.families.filter((f) => f.status === 'reject' && !['strong', 'possible'].includes(f.level));
  const common = ins.families.filter((f) => f.level === 'too-common');

  put(view, ...head,
    network(),
    ins.overall ? h('p', { class: 'callout' }, ins.overall) : null,
    h('div', { class: 'section-h' }, suspects.length ? 'Possible triggers' : 'Possible triggers'),
    suspects.length ? suspects.map(card) : h('p', { class: 'muted' }, 'No clear pattern yet. That’s good news, or it needs a few more bad days to show.'),
    rejected.length ? [h('div', { class: 'section-h' }, 'You ruled out'), rejected.map(card)] : null,
    fineSection(),
    common.length ? [h('div', { class: 'section-h' }, 'Too common to tell'),
      h('p', { class: 'muted small' }, `${common.map((f) => f.family).join(', ')}: in almost everything you use, so they can’t be separated from the rest.`)] : null,
    h('div', { style: 'margin-top:18px' }, h('button', { class: 'btn small', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { askedFor = ''; await refreshInsights(); toast('Re-checked'); } catch (err) { toast(err.message); }
    } }, 'Ask AI to re-check')),
    disclaimer());
}

function card(f) {
  const st = store.state;
  const [label, tone] = LEVEL[f.level] || ['', ''];
  const prods = f.productIds.map((id) => S.product(id)).filter(Boolean);
  const choose = async (status) => {
    try { await mutate('insight.status', { family: f.family, status: f.status === status ? 'ai' : status }); }
    catch (e) { toast(e.message); }
  };
  return h('article', { class: 'finding' + (f.status !== 'reject' && tone === 'amber' ? ' amber' : '') },
    h('div', { class: 'fh' }, h('div', { class: 'fn' }, f.family), h('span', { class: 'pill ' + (f.status === 'reject' ? '' : tone) }, f.status === 'reject' ? 'Ruled out' : label)),
    h('ul', { class: 'ev' },
      h('li', null, 'Before ', h('b', null, `${f.hits} of ${f.relevant}`), ` bad days (${f.areas.join(', ').toLowerCase()})`),
      h('li', null, 'In ', h('b', null, `${f.fineWith} of ${f.fineTotal}`), ' products that were fine'),
      h('li', null, 'Found in: ', prods.map((p, i) => [i ? ', ' : '', h('button', { class: 'link', style: 'color:inherit', onclick: () => openProduct(p) }, p.name)]))),
    f.together && f.together.length ? h('div', { class: 'muted small', style: 'margin-top:6px' },
      `Always comes with ${f.together.join(', ').toLowerCase()} in the same products, so they can’t be told apart yet.`) : null,
    f.explanation ? h('div', { class: 'ex' }, f.explanation) : null,
    h('div', { class: 'who' }, WHO[f.status] || 'AI suggested', f.status === 'ai' && f.aiWritten ? ' · explanation written by AI' : ''),
    h('div', { class: 'choices', role: 'group', 'aria-label': `Your view on ${f.family}` },
      h('button', { class: 'chip' + (f.status === 'agree' ? ' on' : ''), onclick: () => choose('agree') }, 'Agree'),
      h('button', { class: 'chip' + (f.status === 'reject' ? ' on' : ''), onclick: () => choose('reject') }, 'Not this'),
      h('button', { class: 'chip' + (f.status === 'unsure' ? ' on' : ''), onclick: () => choose('unsure') }, 'Not sure')));
}

function fineSection() {
  const st = store.state;
  const fine = st.insights.fineProductIds.map((id) => S.product(id)).filter(Boolean);
  if (!fine.length) return null;
  return [h('div', { class: 'section-h' }, 'Seems fine for you'),
    h('p', { class: 'muted small', style: 'margin-top:-4px' }, 'Used for 2+ weeks with no bad day after.'),
    h('div', { class: 'fine-list' }, fine.map((p) => h('button', { class: 'chip', onclick: () => openProduct(p) }, p.name)))];
}

function disclaimer() {
  return h('p', { class: 'disclaimer' }, 'These are patterns, not a diagnosis. For allergies, a dermatologist can do a patch test to confirm.');
}

// Products on the left, ingredient families on the right. Suspects glow amber.
function network() {
  const st = store.state;
  const ins = st.insights;
  const sus = new Set(ins.suspectFamilies);
  const fams = ins.families
    .filter((f) => f.level !== 'too-common' && f.level !== 'not-enough')
    .sort((a, b) => (sus.has(b.family) - sus.has(a.family)) || b.productIds.length - a.productIds.length)
    .slice(0, 8);
  const prods = st.products.filter((p) => fams.some((f) => f.productIds.includes(p.id))).slice(0, 9);
  if (!fams.length || !prods.length) return null;
  const W = 390, rowH = 26;
  const H = Math.max(prods.length, fams.length) * rowH + 20;
  const py = (i) => 16 + i * ((H - 32) / Math.max(1, prods.length - 1 || 1));
  const fy = (i) => 16 + i * ((H - 32) / Math.max(1, fams.length - 1 || 1));
  const lines = [];
  prods.forEach((p, i) => fams.forEach((f, j) => {
    if (!f.productIds.includes(p.id)) return;
    const hot = sus.has(f.family);
    lines.push(s('path', { d: `M128 ${py(i)} C 200 ${py(i)}, 200 ${fy(j)}, 262 ${fy(j)}`, fill: 'none', stroke: hot ? '#d4a24c' : '#cfcfcf', 'stroke-width': hot ? 1.4 : 0.8, opacity: hot ? 0.9 : 0.7 }));
  }));
  return h('div', { class: 'net' }, s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'How your products connect to ingredient families' },
    lines,
    prods.map((p, i) => [s('circle', { cx: 128, cy: py(i), r: 4, fill: '#9a9a9a' }),
      s('text', { x: 120, y: py(i) + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#2b2b2b', style: 'cursor:pointer', onclick: () => openProduct(p) }, p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name)]),
    fams.map((f, j) => {
      const hot = sus.has(f.family);
      return [s('circle', { cx: 262, cy: fy(j), r: hot ? 6 : 4, fill: hot ? '#d4a24c' : '#9a9a9a' }),
        s('text', { x: 272, y: fy(j) + 4, 'font-size': 12, fill: hot ? '#8a6420' : '#6b6b6b', 'font-weight': hot ? 700 : 400 }, f.family.length > 17 ? f.family.slice(0, 16) + '…' : f.family)];
    })));
}

function dotsArt() {
  return s('svg', { viewBox: '0 0 120 60', width: 120, style: 'margin:0 auto', 'aria-hidden': 'true' },
    s('path', { d: 'M15 40 L45 18 L75 38 L105 16', fill: 'none', stroke: '#cfcfcf', 'stroke-width': 1.2 }),
    [[15, 40], [45, 18], [75, 38], [105, 16]].map(([x, y], i) => s('circle', { cx: x, cy: y, r: i === 2 ? 6 : 4, fill: i === 2 ? '#d4a24c' : '#9a9a9a' })));
}
