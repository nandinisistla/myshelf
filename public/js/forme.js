// For me: one clear sentence per card, backed by the dots and the product pictures.
// A row of dots = your bad days on that area, oldest first. Filled = it was in use
// the week before that bad day. The counts are exact (code).
import { h, put, toast, fmtDate, daysBetween } from './ui.js';
import { store, mutate, S } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';
import { thumb } from './bottle.js';
import { whyFor, whyShort } from './why.js';
import { openSettings, initials } from './settings.js';
import { productHelps, FAMILY_TO_ALLERGEN, allergenMatcher, matches, isWorking, WATCH_LIST, WATCH_SOURCES } from './rules.js';

const AREA_WORD = { face: 'face', scalp: 'scalp', body: 'body' };
const AREA_KEY = { Face: 'face', 'Hair & scalp': 'scalp', Body: 'body' };
const joinWords = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// "all 8 of your face bad days" / "5 of your 8 face bad days"
const countOf = (n, total, area) => n === total ? `all ${total} of your ${area} bad days` : `${n} of your ${total} ${area} bad days`;
const plural = (n, one, many) => (n === 1 ? one : many);

export function renderForMe(view) {
  stepNo = 0;
  const st = store.state;
  const ins = st.insights;
  const head = h('section', { class: 'page-head' },
    h('h1', { class: 'display' }, 'What your skin is telling you', h('span', { class: 'soft' }, '.')),
    profileStrip());

  if (ins.reactionCount < 2) {
    put(view,
      slide(head, problemsSection(), h('div', { class: 'fm-empty' },
        h('h3', null, ins.reactionCount ? 'One more rough day and the dots start connecting' : 'Nothing to connect yet'),
        h('button', { class: 'btn primary', onclick: () => openBadDay() }, 'Rough skin day?'))),
      slide(avoidSection(), safeSection(), disclaimer()));
    return;
  }
  put(view,
    slide(head, problemsSection()),
    slide(productsSection(), ingredientsSection()),
    slide(avoidSection()),
    slide(safeSection(), leftovers(), disclaimer()));
}

// ---------- your profile, at the top ----------
function profileStrip() {
  const pr = store.state.profile || {};
  return h('div', { class: 'fm-profile' },
    h('span', { class: 'pf-avatar', 'aria-hidden': 'true' }, initials(pr.name) || '·'),
    h('div', { class: 'fm-profile-txt' },
      h('div', { class: 'pf-name' }, pr.name || 'Your skin profile'),
      h('div', { class: 'fm-tags' },
        pr.skin_type ? h('span', { class: 'tag' }, pr.skin_type) : null,
        (pr.problems || []).map((x) => h('span', { class: 'tag' }, x)),
        (pr.allergens || []).map((x) => h('span', { class: 'tag no' }, `Avoids ${x.toLowerCase()}`)))),
    h('button', { class: 'btn small', onclick: () => openSettings() }, 'Edit'));
}

// ---------- your skin problems: what's working on each ----------
const LOOK_FOR = {
  'Redness': 'azelaic acid, centella, niacinamide', 'Dark spots': 'niacinamide, TXA, vitamin C, sunscreen',
  'Breakouts': 'salicylic acid, azelaic acid', 'Sensitivity': 'fragrance-free, ceramides',
  'Dryness': 'hyaluronic acid, ceramides', 'Oiliness': 'niacinamide, salicylic acid', 'Uneven texture': 'gentle acids, retinoid',
  'Itchy skin': 'oat, ceramides, panthenol', 'Dandruff': 'zinc pyrithione, ketoconazole', 'Hair thinning': 'peptides, caffeine, rosemary',
};
function problemsSection() {
  const st = store.state;
  const probs = st.profile?.problems || [];
  if (!probs.length) return null;
  const live = st.products.filter((p) => !p.stopped);
  return h('section', { class: 'fm-step' },
    stepHead('Your skin problems'),
    h('div', { class: 'fm-probs' }, probs.map((pr) => {
      const helpers = live.map((p) => ({ p, ings: productHelps(p).get(pr) })).filter((x) => x.ings);
      return h('article', { class: 'fm-prob' + (helpers.length ? '' : ' gap') },
        h('div', { class: 'fm-prob-head' }, h('h3', null, pr),
          helpers.length
            ? h('span', { class: 'sym-badge ok' }, `${helpers.length} ${plural(helpers.length, 'product helps', 'products help')}`)
            : h('span', { class: 'sym-badge' }, 'Nothing yet')),
        helpers.length
          ? h('div', { class: 'fm-thumbs' }, helpers.map(({ p, ings }) => h('button', {
              class: 'fm-thumb', title: `${p.name}: ${ings.join(', ').toLowerCase()}`, 'aria-label': `${p.name}, via ${ings.join(', ')}`, onclick: () => openProduct(p) }, thumb(p, 'lg'))))
          : h('p', { class: 'fm-look' }, `Look for ${LOOK_FOR[pr] || 'a product made for this'}.`));
    })));
}

// ---------- products in use before bad days ----------
function windowsFor() { return store.state.insights.windows || []; }

function productsSection() {
  const st = store.state;
  const count = new Map();
  for (const w of windowsFor()) for (const id of w.productIds) count.set(id, (count.get(id) || 0) + 1);
  const list = st.products.map((p) => ({ p, n: count.get(p.id) || 0, total: st.reactions.filter((r) => r.area === p.area).length }))
    .filter((x) => x.n >= 2 && x.n / x.total >= 0.6).sort((a, b) => b.n - a.n || b.n / b.total - a.n / a.total);
  if (!list.length) return null;
  return h('section', { class: 'fm-step' },
    stepHead('Products in use before your bad days'),
    h('div', { class: 'fm-prods' }, list.map(({ p, n, total }) => {
      const area = AREA_WORD[p.area];
      const after = p.stopped ? st.reactions.filter((r) => r.area === p.area && r.date > p.stopped).length : 0;
      const calm = p.stopped && after === 0 && daysBetween(p.stopped, st.today) >= 14;
      return h('button', { class: 'fm-prod', onclick: () => openProduct(p) },
        thumb(p, 'lg'),
        h('div', { class: 'fm-prod-txt' },
          h('div', { class: 'nm' }, p.name),
          dots(st.reactions.filter((r) => r.area === p.area), (w) => w.productIds.includes(p.id)),
          h('p', { class: 'fm-line' }, `Used before ${countOf(n, total, area)}.`),
          h('p', { class: 'fm-line ' + (calm ? 'ok' : p.stopped ? '' : 'warn') },
            p.stopped ? `${calm ? '✓ ' : ''}Stopped ${fmtDate(p.stopped)}${calm ? '. No bad days since.' : '.'}` : 'Still on your shelf.')));
    })));
}

// ---------- what might be causing it ----------
function ingredientsSection() {
  const st = store.state;
  const sus = st.insights.families.filter((f) => f.status !== 'reject' && (f.status === 'agree' || ['strong', 'possible'].includes(f.level)))
    .sort((a, b) => rank(a) - rank(b) || b.hits / b.relevant - a.hits / a.relevant || a.fineWith - b.fineWith);
  if (!sus.length) return null;
  const shown = new Set();
  const cards = sus.filter((f) => {
    if (shown.has(f.family)) return false;          // ingredients that always come together = one card
    (f.together || []).forEach((g) => shown.add(g)); shown.add(f.family);
    return true;
  });
  const likely = cards.filter((f) => f.status === 'agree' || f.level === 'strong');
  const maybe = cards.filter((f) => !likely.includes(f));
  return h('section', { class: 'fm-step' },
    stepHead('What might be causing it'),
    likely.length ? h('div', { class: 'fm-ings' }, likely.map((f) => ingredientCard(f, false))) : null,
    maybe.length ? h('div', { class: 'fm-sub mono' }, 'Less likely · tap to see more') : null,
    maybe.length ? h('div', { class: 'fm-ings' }, maybe.map((f) => ingredientCard(f, true))) : null);
}
const rank = (f) => (f.status === 'agree' ? 0 : f.level === 'strong' ? 1 : 2);

function ingredientCard(f, compact) {
  const st = store.state;
  const prods = (f.areaProductIds || f.productIds).map((id) => S.product(id)).filter(Boolean);
  const fineIds = new Set(st.insights.fineProductIds);
  const fineOnes = prods.filter((p) => fineIds.has(p.id));
  const live = prods.filter((p) => !p.stopped);
  const stopped = prods.filter((p) => p.stopped);
  const elsewhere = (f.fineElsewhereIds || []).map((id) => S.product(id)).filter(Boolean);
  const areaKeys = f.areas.map((a) => AREA_KEY[a] || a);
  const area = AREA_WORD[areaKeys[0]] || areaKeys[0];
  const likely = f.status === 'agree' || f.level === 'strong';
  const names = [f.family, ...(f.together || [])];
  const sentence = likely
    ? `It was in your products before ${countOf(f.hits, f.relevant, area)}, and in nothing that works for you.`
    : fineOnes.length
      ? `It was there before ${countOf(f.hits, f.relevant, area)}, but ${joinWords(fineOnes.map((p) => p.name))} ${plural(fineOnes.length, 'has', 'have')} it too and ${plural(fineOnes.length, 'works', 'work')} for you.`
      : `It was there before ${countOf(f.hits, f.relevant, area)}, not every time.`;
  const choose = async (status) => {
    try { await mutate('insight.status', { family: f.family, status: f.status === status ? 'ai' : status }); }
    catch (e) { toast(e.message); }
  };
  const thumbs = (ps, cls) => ps.map((p) => h('button', { class: `fm-thumb ${cls}`, title: p.name, 'aria-label': p.name, onclick: () => openProduct(p) }, thumb(p, 'lg')));

  const top = [
    h('div', { class: 'fm-ing-head' },
      h('h3', null, likely ? `${joinWords(names)} is the likely trigger` : `${joinWords(names)}: less likely`),
      f.status === 'agree' ? h('span', { class: 'fm-badge on' }, '✓ You confirmed') : likely ? h('span', { class: 'fm-badge on' }, 'Likely') : h('span', { class: 'fm-badge' }, 'Maybe')),
    dots(st.reactions.filter((r) => areaKeys.includes(r.area)), (w) => w.productIds.some((id) => f.productIds.includes(id))),
    h('p', { class: 'fm-line strong' }, sentence),
    h('p', { class: 'fm-line muted' }, `Why it can irritate: ${whyShort(f.family)}`)];
  const where = h('div', { class: 'fm-where-row' },
    stopped.length ? h('div', { class: 'fm-group' }, h('span', { class: 'lbl' }, 'You stopped'), thumbs(stopped, 'past')) : null,
    live.length ? h('div', { class: 'fm-group' }, h('span', { class: 'lbl warn' }, 'Still using'), thumbs(live, '')) : null,
    elsewhere.length ? h('div', { class: 'fm-group' }, h('span', { class: 'lbl ok' }, `✓ Fine on your ${joinWords([...new Set(elsewhere.map((p) => AREA_WORD[p.area]))])}`), thumbs(elsewhere, '')) : null);
  const ask = h('div', { class: 'fm-ask' },
    h('span', null, 'Does this sound right?'),
    h('button', { class: 'chip' + (f.status === 'agree' ? ' on' : ''), onclick: () => choose('agree') }, 'Yes'),
    h('button', { class: 'chip' + (f.status === 'reject' ? ' on' : ''), onclick: () => choose('reject') }, 'No'));

  if (compact) return h('details', { class: 'fm-ing maybe' }, h('summary', null, top), where, ask);
  return h('article', { class: 'fm-ing' + (likely ? ' likely' : '') }, top, where, ask);
}

// One dot per bad day, oldest first. Filled = in use the week before.
function dots(reactions, hit) {
  const ws = windowsFor();
  const list = [...reactions].sort((a, b) => a.date.localeCompare(b.date));
  return h('div', { class: 'fm-dots', 'aria-hidden': 'true' }, list.map((r, idx) => {
    const w = ws.find((x) => x.reaction.id === r.id);
    const on = w && hit(w);
    return h('span', { class: 'fm-dot' + (on ? ' on' : ''), style: `--i:${idx}`, title: `${fmtDate(r.date)}: ${on ? 'in use the week before' : 'not in use'}` });
  }));
}

// ---------- try to avoid ----------
function avoidSection() {
  const st = store.state;
  const ins = st.insights;
  const items = new Map();
  for (const a of st.profile?.allergens || []) items.set(a, { label: a, match: allergenMatcher(a), listed: true, finding: null });
  for (const f of ins.families) {
    if (f.status === 'reject' || !(f.status === 'agree' || f.level === 'strong')) continue;
    const key = FAMILY_TO_ALLERGEN[f.family] || f.family;
    const it = items.get(key) || { label: key, match: { family: f.family }, listed: false };
    it.finding = f;
    items.set(key, it);
  }
  const probs = st.profile?.problems || [];
  const sensitive = probs.some((p) => ['Redness', 'Sensitivity', 'Itchy skin'].includes(p));
  if (!items.size && !sensitive) return null;
  const contains = (p, test) => (p.ingredients || []).some(test);
  const thumbs = (ps, cls) => ps.map((p) => h('button', { class: `fm-thumb ${cls}`, title: p.name, 'aria-label': p.name, onclick: () => openProduct(p) }, thumb(p, 'lg')));

  const cards = [...items.values()].map((it) => {
    const f = it.finding;
    const test = (i) => matches(i, it.match);
    const withIt = st.products.filter((p) => contains(p, test));
    const area = f ? f.area : null;
    const stillIn = withIt.filter((p) => !p.stopped && !isWorking(p) && (!area || p.area === area));
    const keep = withIt.filter((p) => !p.stopped && isWorking(p));
    const stopped = withIt.filter((p) => p.stopped && (!area || p.area === area));
    const where = area ? AREA_WORD[area] : 'shelf';
    const reason = [
      f ? `It was in your products before ${countOf(f.hits, f.relevant, AREA_WORD[area])}.` : null,
      f?.status === 'agree' ? 'You confirmed it.' : null,
      it.listed ? 'It’s on your allergen list.' : null].filter(Boolean).join(' ');
    const status = stillIn.length
      ? `It’s still in ${joinWords(stillIn.map((p) => p.name))}. Try a version without it.`
      : keep.length
        ? `✓ You’ve stopped it${area ? ` on your ${where}` : ''}. It’s only left in products that work for you.`
        : `✓ Nothing you use${area ? ` on your ${where}` : ''} has it any more.`;
    return h('article', { class: 'fm-avoid-item' },
      h('h3', null, it.label, area ? h('span', { class: 'fm-area' }, ` on your ${where}`) : null),
      h('p', { class: 'fm-line strong ' + (stillIn.length ? 'warn' : 'ok') }, status),
      h('p', { class: 'fm-line muted' }, reason),
      h('div', { class: 'fm-where-row' },
        stillIn.length ? h('div', { class: 'fm-group' }, h('span', { class: 'lbl warn' }, 'Swap'), thumbs(stillIn, '')) : null,
        stopped.length ? h('div', { class: 'fm-group' }, h('span', { class: 'lbl' }, 'You stopped'), thumbs(stopped, 'past')) : null,
        keep.length ? h('div', { class: 'fm-group' }, h('span', { class: 'lbl ok' }, `✓ Keep: your ${joinWords([...new Set(keep.map((p) => AREA_WORD[p.area]))])} is fine with ${plural(keep.length, 'it', 'them')}`), thumbs(keep, '')) : null));
  });

  let watch = null;
  if (sensitive) {
    const face = st.products.filter((p) => p.area === 'face');
    const chips = [];
    const cleared = [];
    for (const w of WATCH_LIST) {
      const inWorking = face.filter((p) => !p.stopped && isWorking(p) && contains(p, w.test));
      if (inWorking.length) { cleared.push(`${w.label.toLowerCase()} (in your ${joinWords(inWorking.map((p) => p.name))})`); continue; }
      const past = face.filter((p) => p.stopped && contains(p, w.test));
      chips.push(h('li', null, h('b', null, w.label), ' ', h('span', { class: 'muted' }, w.why),
        past.length ? h('span', { class: 'was' }, ` It was in your ${joinWords(past.map((p) => p.name))}.`) : null));
    }
    watch = h('div', { class: 'fm-watch' },
      h('h3', null, 'When you buy something new for your face, skip these'),
      h('ul', null, chips),
      cleared.length ? h('p', { class: 'fm-line ok' }, `✓ No need to skip ${joinWords(cleared)}: it works for you.`) : null,
      h('p', { class: 'fm-src' }, 'Based on dermatologist advice for redness-prone skin: ',
        WATCH_SOURCES.map((x, n) => [n ? ' · ' : '', h('a', { href: x.url, target: '_blank', rel: 'noopener' }, x.title.split(':')[0])])));
  }
  return h('section', { class: 'fm-step' },
    stepHead('Try to avoid'),
    cards.length ? h('div', { class: 'fm-avoid' }, cards) : null,
    watch);
}

// ---------- safe so far ----------
function safeSection() {
  const fine = store.state.insights.fineProductIds.map((id) => S.product(id)).filter(Boolean);
  if (!fine.length) return null;
  return h('section', { class: 'fm-step' },
    stepHead('Safe for you'),
    h('p', { class: 'fm-line muted', style: 'margin:-6px 0 16px' }, 'You’ve used these for at least two weeks with no bad days.'),
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
      h('button', { class: 'link', title: 'Tap to undo', onclick: () => mutate('insight.status', { family: f.family, status: 'ai' }) }, f.family)])) : null,
    common.length ? h('p', { class: 'muted' }, `${joinWords(common.map((f) => f.family))} ${plural(common.length, 'is', 'are')} in almost everything you use, so ${plural(common.length, 'it', 'they')} can’t be blamed or cleared.`) : null);
}

let stepNo = 0;
const stepHead = (text, extra) => h('div', { class: 'fm-step-head' }, h('span', { class: 'mono' }, String(++stepNo).padStart(2, '0')), h('h2', null, text), extra || null);

function disclaimer() {
  return h('p', { class: 'disclaimer' }, 'Patterns, not a diagnosis. A dermatologist can confirm an allergy with a patch test.');
}

// One screen of For me. Empty parts are skipped.
function slide(...parts) {
  const kids = parts.flat().filter(Boolean);
  return kids.length ? h('div', { class: 'slide' }, kids) : null;
}
