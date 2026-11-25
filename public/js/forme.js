// For me: what your skin is telling you, in three plain steps.
// 1) which products were in use before your bad days, 2) what they have in common,
// 3) what's been safe. The counts are exact (code); the AI only adds a short note.
import { h, put, toast, fmtDate, daysBetween } from './ui.js';
import { store, mutate, S } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';
import { thumb } from './bottle.js';
import { whyFor } from './why.js';

const AREA_WORD = { face: 'face', scalp: 'scalp', body: 'body' };
const AREA_KEY = { Face: 'face', 'Hair & scalp': 'scalp', Body: 'body' };
const joinWords = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function renderForMe(view) {
  const st = store.state;
  const ins = st.insights;
  const head = h('section', { class: 'page-head' },
    h('div', { class: 'eyebrow mono' }, `For me · ${ins.reactionCount} bad day${ins.reactionCount === 1 ? '' : 's'} · ${ins.productCount} products`),
    h('h1', { class: 'display' }, 'What your skin is telling you', h('span', { class: 'soft' }, '.')),
    h('p', { class: 'lede' }, 'Each bad day is checked against what you used the week before.'));

  if (ins.reactionCount < 2) {
    put(view, head, h('div', { class: 'fm-empty' },
      h('h3', null, ins.reactionCount ? 'One more bad day and the dots start connecting' : 'Nothing to connect yet'),
      h('p', null, 'When your skin, scalp or body acts up, log it. After two, MyShelf starts comparing what you used before each one.'),
      h('button', { class: 'btn primary', onclick: () => openBadDay() }, 'Log a bad day')),
    avoidSection(), safeSection(), disclaimer());
    return;
  }

  put(view, head, productsSection(), ingredientsSection(), avoidSection(), safeSection(), leftovers(), disclaimer());
}

// ---------- 1. products in use before bad days ----------
function windowsFor() { return store.state.insights.windows || []; }

function productsSection() {
  const st = store.state;
  const count = new Map();
  for (const w of windowsFor()) for (const id of w.productIds) count.set(id, (count.get(id) || 0) + 1);
  const list = st.products.map((p) => {
    const total = st.reactions.filter((r) => r.area === p.area).length;
    return { p, n: count.get(p.id) || 0, total };
  }).filter((x) => x.n >= 2 && x.n / x.total >= 0.6).sort((a, b) => b.n - a.n || b.n / b.total - a.n / a.total);

  return h('section', { class: 'fm-step' },
    stepHead('1', 'Products in use before your bad days'),
    list.length
      ? h('div', { class: 'fm-prods' }, list.map(({ p, n, total }) => {
          const area = AREA_WORD[p.area];
          const after = p.stopped ? st.reactions.filter((r) => r.area === p.area && r.date > p.stopped).length : 0;
          const status = p.stopped
            ? (after === 0 && daysBetween(p.stopped, st.today) >= 14 ? `Stopped ${fmtDate(p.stopped)}. No ${area} bad days since.` : `Stopped ${fmtDate(p.stopped)}.`)
            : 'Still on your shelf.';
          return h('button', { class: 'fm-prod', onclick: () => openProduct(p) },
            thumb(p, 'lg'),
            h('div', { class: 'fm-prod-txt' },
              h('div', { class: 'nm' }, p.name),
              h('div', { class: 'fm-count' }, `Before ${n === total ? `all ${total}` : `${n} of ${total}`} ${area} bad days`),
              dots(st.reactions.filter((r) => r.area === p.area), (w) => w.productIds.includes(p.id)),
              h('div', { class: 'fm-status' + (p.stopped ? '' : ' live') }, status)));
        }))
      : h('p', { class: 'muted' }, 'No single product lines up with your bad days yet. That’s good news, or it needs a few more bad days to show.'));
}

// ---------- 2. what they have in common ----------
function ingredientsSection() {
  const st = store.state;
  const ins = st.insights;
  const sus = ins.families.filter((f) => f.status !== 'reject' && (f.status === 'agree' || ['strong', 'possible'].includes(f.level)))
    .sort((a, b) => rank(a) - rank(b) || b.hits / b.relevant - a.hits / a.relevant || a.fineWith - b.fineWith);
  if (!sus.length) return null;
  const shown = new Set();
  return h('section', { class: 'fm-step' },
    stepHead('2', 'What might be causing it'),
    (() => {
      const cards = sus.filter((f) => {
        // Ingredients that always come together are shown as one card.
        if (shown.has(f.family)) return false;
        (f.together || []).forEach((g) => shown.add(g));
        shown.add(f.family);
        return true;
      });
      const likely = cards.filter((f) => f.status === 'agree' || f.level === 'strong');
      const maybe = cards.filter((f) => !likely.includes(f));
      return [
        likely.length ? h('div', { class: 'fm-ings' }, likely.map((f) => ingredientCard(f, false))) : null,
        maybe.length ? h('div', { class: 'fm-sub mono' }, likely.length ? 'Less likely · tap to open' : 'Nothing clear yet · tap to open') : null,
        maybe.length ? h('div', { class: 'fm-ings' }, maybe.map((f) => ingredientCard(f, true))) : null,
      ];
    })());
}
const rank = (f) => (f.status === 'agree' ? 0 : f.level === 'strong' ? 1 : 2);

function ingredientCard(f, compact) {
  const st = store.state;
  const prods = (f.areaProductIds || f.productIds).map((id) => S.product(id)).filter(Boolean);
  const fineIds = new Set(st.insights.fineProductIds);
  const fineOnes = prods.filter((p) => fineIds.has(p.id));
  const live = prods.filter((p) => !p.stopped);
  const areaKeys = f.areas.map((a) => AREA_KEY[a] || a);
  const areaWords = joinWords(areaKeys.map((a) => AREA_WORD[a] || a));
  const likely = f.status === 'agree' || f.level === 'strong';
  const names = [f.family, ...(f.together || [])];

  const before = `Before ${f.hits === f.relevant ? `all ${f.relevant}` : `${f.hits} of ${f.relevant}`} ${areaWords} bad days`;
  const doubt = fineOnes.length
    ? `But ${joinWords(fineOnes.map((p) => p.name))} ${fineOnes.length > 1 ? 'have' : 'has'} it too and ${fineOnes.length > 1 ? 'have' : 'has'} been fine.`
    : f.hits === f.relevant ? 'Not in anything that’s been fine for you.' : 'Not every time, so it may not be the cause.';
  const tryThis = live.length
    ? `Skip ${live.length > 1 ? 'these' : 'it'} for two weeks. If the bad days stop, you’ve found it.`
    : 'You’ve already stopped everything with it. Watch for it in new products.';
  const choose = async (status) => {
    try { await mutate('insight.status', { family: f.family, status: f.status === status ? 'ai' : status }); }
    catch (e) { toast(e.message); }
  };

  const top = [
    h('div', { class: 'fm-ing-head' },
      h('h3', null, joinWords(names)),
      h('span', { class: 'fm-badge' + (likely ? ' on' : '') }, f.status === 'agree' ? 'You said yes' : likely ? 'Likely' : 'Maybe')),
    h('div', { class: 'fm-evidence' },
      dots(st.reactions.filter((r) => areaKeys.includes(r.area)), (w) => w.productIds.some((id) => f.productIds.includes(id))),
      h('span', null, before, h('span', { class: 'muted' }, ` · ${doubt}`)))];
  const rows = [
    ['Why it can irritate', h('span', null, whyFor(f.family), names.length > 1 ? h('span', { class: 'muted' }, ` Always comes with ${joinWords(names.slice(1).map((x) => x.toLowerCase()))}, so they can’t be told apart yet.`) : null)],
    f.fineElsewhereIds?.length ? ['Elsewhere', elsewhere(f)] : null,
    [live.length ? 'Still in' : 'Was in', h('div', { class: 'fm-chips' }, (live.length ? live : prods).map((p) => h('button', { class: 'hs-chip', onclick: () => openProduct(p) }, thumb(p), h('span', null, p.name))))],
    ['Try this', tryThis],
  ];
  const rest = [
    h('dl', { class: 'fm-rows' }, rows.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
    h('div', { class: 'fm-ask' },
      h('span', null, 'Sound right to you?'),
      h('button', { class: 'chip' + (f.status === 'agree' ? ' on' : ''), onclick: () => choose('agree') }, 'Yes'),
      h('button', { class: 'chip' + (f.status === 'reject' ? ' on' : ''), onclick: () => choose('reject') }, 'No'))];
  if (compact) return h('details', { class: 'fm-ing maybe' }, h('summary', null, top), rest);
  return h('article', { class: 'fm-ing' + (likely ? ' likely' : '') }, top, rest);
}

// One dot per bad day, oldest first. Filled = this was in use the week before it.
function dots(reactions, hit) {
  const ws = windowsFor();
  const list = [...reactions].sort((a, b) => a.date.localeCompare(b.date));
  return h('div', { class: 'fm-dots', 'aria-hidden': 'true' }, list.map((r) => {
    const w = ws.find((x) => x.reaction.id === r.id);
    const on = w && hit(w);
    return h('span', { class: 'fm-dot' + (on ? ' on' : ''), title: `${fmtDate(r.date)}: ${on ? 'in use the week before' : 'not in use'}` });
  }));
}

// ---------- 3. safe so far ----------
function safeSection() {
  const st = store.state;
  const fine = st.insights.fineProductIds.map((id) => S.product(id)).filter(Boolean);
  if (!fine.length) return null;
  return h('section', { class: 'fm-step' },
    stepHead('4', 'Safe for you so far'),
    h('p', { class: 'fm-intro' }, 'Used for at least two weeks, with no bad day on that area while you were using them.'),
    h('div', { class: 'fm-safe' }, fine.map((p) => h('button', { class: 'fm-safe-item', onclick: () => openProduct(p) },
      thumb(p, 'lg'), h('span', null, p.name)))));
}

function leftovers() {
  const ins = store.state.insights;
  const ruled = ins.families.filter((f) => f.status === 'reject');
  const common = ins.families.filter((f) => f.level === 'too-common');
  if (!ruled.length && !common.length) return null;
  return h('div', { class: 'fm-leftovers' },
    ruled.length ? h('p', null, h('b', null, 'You ruled out: '), ruled.map((f, i) => [i ? ', ' : '',
      h('button', { class: 'link', onclick: () => mutate('insight.status', { family: f.family, status: 'ai' }) }, f.family)]), h('span', { class: 'muted' }, ' (tap to undo)')) : null,
    common.length ? h('p', { class: 'muted' }, `${joinWords(common.map((f) => f.family))} ${common.length > 1 ? 'are' : 'is'} in almost everything you use, so ${common.length > 1 ? 'they' : 'it'} can’t be blamed or cleared.`) : null,
  );
}

const stepHead = (n, text) => h('div', { class: 'fm-step-head' }, h('span', { class: 'mono' }, n.padStart(2, '0')), h('h2', null, text));

function disclaimer() {
  return h('p', { class: 'disclaimer' }, 'These are patterns, not a diagnosis. For allergies, a dermatologist can do a patch test to confirm.');
}

// "Your body is fine with it": the same ingredient in products for other areas that caused no trouble.
function elsewhere(f) {
  const ps = f.fineElsewhereIds.map((id) => S.product(id)).filter(Boolean);
  const areas = joinWords([...new Set(ps.map((p) => AREA_WORD[p.area]))]);
  return `Your ${areas} ${areas.includes(' and ') ? 'seem' : 'seems'} fine with it: ${joinWords(ps.map((p) => p.name))}.`;
}

// ---------- 3. better to avoid ----------
// From your profile (allergens you listed) and from what your skin confirmed.
const ALLERGEN_MATCH = {
  'Fragrance': { family: 'Fragrance' },
  'Essential oils': { family: 'Essential oils & plant extracts' },
  'Drying alcohol': { family: 'Drying alcohol' },
  'Sulfates': { name: /sulfate/i },
  'Parabens': { name: /paraben/i },
  'Coconut oil': { family: 'Coconut-derived', name: /coco/i },
  'Silicones': { family: 'Silicones' },
  'Lanolin': { name: /lanolin/i },
};
const FAMILY_TO_ALLERGEN = Object.fromEntries(Object.entries(ALLERGEN_MATCH).filter(([, m]) => m.family).map(([k, m]) => [m.family, k]));

function avoidSection() {
  const st = store.state;
  const ins = st.insights;
  const items = new Map();
  for (const a of st.profile?.allergens || []) {
    const m = ALLERGEN_MATCH[a] || { name: new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
    items.set(a, { label: a, match: m, listed: true, finding: null });
  }
  for (const f of ins.families) {
    if (f.status === 'reject' || !(f.status === 'agree' || f.level === 'strong')) continue;
    const key = FAMILY_TO_ALLERGEN[f.family] || f.family;
    const it = items.get(key) || { label: key, match: { family: f.family }, listed: false };
    it.finding = f;
    items.set(key, it);
  }
  if (!items.size) return null;

  const has = (p, m) => (p.ingredients || []).some((i) => (m.family && i.family === m.family) || (m.name && m.name.test(`${i.inci} ${i.plain}`)));
  const fineIds = new Set(ins.fineProductIds);
  return h('section', { class: 'fm-step' },
    stepHead('3', 'Better to avoid'),
    h('p', { class: 'fm-intro' }, 'From the allergens in your profile and what your skin has shown. MyShelf flags these when you add something new.'),
    h('div', { class: 'fm-avoid' }, [...items.values()].map((it) => {
      const f = it.finding;
      const live = st.products.filter((p) => !p.stopped && has(p, it.match));
      const reasons = [
        it.listed ? 'You listed it as an allergen.' : null,
        f ? `Before ${f.hits === f.relevant ? `all ${f.relevant}` : `${f.hits} of ${f.relevant}`} of your ${AREA_WORD[f.area]} bad days${f.status === 'agree' ? ', and you confirmed it' : ''}.` : null,
      ].filter(Boolean).join(' ');
      // Products for other areas that have been fine with it are worth keeping.
      const ok = live.filter((p) => f && p.area !== f.area && fineIds.has(p.id));
      const watch = live.filter((p) => !ok.includes(p));
      return h('article', { class: 'fm-avoid-item' },
        h('div', { class: 'fm-avoid-head' }, h('h3', null, it.label), h('span', { class: 'fm-badge on' }, 'Avoid')),
        h('p', { class: 'fm-why' }, reasons, ' ', h('span', { class: 'muted' }, whyFor(it.match.family || it.label))),
        watch.length
          ? h('div', { class: 'fm-where' }, h('div', { class: 'mono warn' }, f ? `Still on your ${AREA_WORD[f.area]} shelf` : 'Still on your shelf'),
              h('div', { class: 'fm-chips' }, watch.map((p) => h('button', { class: 'hs-chip', onclick: () => openProduct(p) }, thumb(p), h('span', null, p.name)))))
          : h('p', { class: 'fm-clear' }, f ? `Nothing you use on your ${AREA_WORD[f.area]} has it any more.` : 'Nothing on your shelf has it.'),
        ok.length ? h('p', { class: 'fm-why muted' }, `It’s also in ${joinWords(ok.map((p) => p.name))}, but your ${joinWords([...new Set(ok.map((p) => AREA_WORD[p.area]))])} ${new Set(ok.map((p) => p.area)).size > 1 ? 'have' : 'has'} been fine with ${ok.length > 1 ? 'them' : 'it'}, so no need to swap.`) : null);
    })));
}
