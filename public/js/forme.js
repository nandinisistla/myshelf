// For me: what your skin is telling you, in three plain steps.
// 1) which products were in use before your bad days, 2) what they have in common,
// 3) what's been safe. The counts are exact (code); the AI only adds a short note.
import { h, put, toast, fmtDate, daysBetween } from './ui.js';
import { store, mutate, S } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';
import { thumb } from './bottle.js';
import { whyFor } from './why.js';
import { openSettings, initials } from './settings.js';
import { productHelps, FAMILY_TO_ALLERGEN, allergenMatcher, matches, isWorking, WATCH_LIST, WATCH_SOURCES } from './rules.js';

const AREA_WORD = { face: 'face', scalp: 'scalp', body: 'body' };
const AREA_KEY = { Face: 'face', 'Hair & scalp': 'scalp', Body: 'body' };
const joinWords = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function renderForMe(view) {
  stepNo = 0;
  const st = store.state;
  const ins = st.insights;
  const head = h('section', { class: 'page-head' },
    h('h1', { class: 'display' }, 'What your skin is telling you', h('span', { class: 'soft' }, '.')),
    profileStrip());

  if (ins.reactionCount < 2) {
    put(view, head, problemsSection(), h('div', { class: 'fm-empty' },
      h('h3', null, ins.reactionCount ? 'One more bad day and the dots start connecting' : 'Nothing to connect yet'),
      h('p', null, 'When your skin, scalp or body acts up, log it. After two, MyShelf starts comparing what you used before each one.'),
      h('button', { class: 'btn primary', onclick: () => openBadDay() }, 'Log a bad day')),
    avoidSection(), safeSection(), disclaimer());
    return;
  }

  put(view, head, problemsSection(), productsSection(), ingredientsSection(), avoidSection(), safeSection(), leftovers(), disclaimer());
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
            ? (after === 0 && daysBetween(p.stopped, st.today) >= 14 ? `Stopped ${fmtDate(p.stopped)}. You’ve been doing good since.` : `Stopped ${fmtDate(p.stopped)}.`)
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

let stepNo = 0;
const stepHead = (_n, text) => h('div', { class: 'fm-step-head' }, h('span', { class: 'mono' }, String(++stepNo).padStart(2, '0')), h('h2', null, text));

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
  const chip = (p) => h('button', { class: 'hs-chip', onclick: () => openProduct(p) }, thumb(p), h('span', null, p.name));

  // A. What to stay away from, and where you stand with each one right now.
  const bothering = [...items.values()].map((it) => {
    const f = it.finding;
    const test = (i) => matches(i, it.match);
    const withIt = st.products.filter((p) => contains(p, test));
    const area = f ? f.area : null;
    const stillIn = withIt.filter((p) => !p.stopped && !isWorking(p) && (!area || p.area === area));
    const keep = withIt.filter((p) => !p.stopped && isWorking(p));
    const stopped = withIt.filter((p) => p.stopped && (!area || p.area === area));
    const n = f ? (f.hits === f.relevant ? `all ${f.relevant}` : `${f.hits} of ${f.relevant}`) : '';
    const lead = f
      ? `It was in what you used before ${n} of your ${AREA_WORD[area]} flare-ups${it.listed ? ', and you’ve listed it as something you react to' : ''}.`
      : 'You listed it as something you react to.';
    const rows = [
      stillIn.length ? ['Still using', h('div', null,
        h('div', { class: 'fm-chips' }, stillIn.map(chip)),
        h('p', { class: 'fm-row-note' }, 'Try a version without it.'))] : null,
      !stillIn.length ? ['Right now', h('p', { class: 'fm-clear' }, keep.length
        ? (area ? `It’s off your ${AREA_WORD[area]}. It’s only left in products your skin is fine with.` : 'It’s only in products your skin is fine with.')
        : (area ? `You’re not using it on your ${AREA_WORD[area]} any more.` : 'Nothing you’re using has it.'))] : null,
      stopped.length ? ['Already stopped', joinWords(stopped.map((p) => p.name))] : null,
      keep.length ? ['Fine to keep', h('div', null,
        h('div', { class: 'fm-chips' }, keep.map(chip)),
        h('p', { class: 'fm-row-note' }, `${keep.length > 1 ? 'These have' : 'This has'} it too, but your skin has been fine with ${keep.length > 1 ? 'them' : 'it'}.`))] : null,
    ].filter(Boolean);
    return h('article', { class: 'fm-avoid-item' },
      h('h3', null, it.label, area ? h('span', { class: 'fm-area' }, ` on your ${AREA_WORD[area]}`) : null),
      h('p', { class: 'fm-why' }, lead),
      h('dl', { class: 'fm-rows tight' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
  });

  // B. What dermatologists say to watch for, minus anything your skin has already cleared.
  let watch = null;
  if (sensitive) {
    const face = st.products.filter((p) => p.area === 'face');
    const cleared = [];
    const rows = [];
    for (const w of WATCH_LIST) {
      const inWorking = face.filter((p) => !p.stopped && isWorking(p) && contains(p, w.test));
      if (inWorking.length) { cleared.push(`${w.label.toLowerCase()} (in your ${joinWords(inWorking.map((p) => p.name))})`); continue; }
      const past = face.filter((p) => p.stopped && contains(p, w.test));
      const newish = face.filter((p) => !p.stopped && !isWorking(p) && contains(p, w.test));
      rows.push(h('li', null, h('b', null, w.label), ' ', h('span', { class: 'muted' }, w.why),
        past.length ? h('span', { class: 'fm-note' }, ` (It was in ${joinWords(past.map((p) => p.name))}, which you’ve stopped.)`) : null,
        newish.length ? h('span', { class: 'fm-note warn' }, ` It’s in ${joinWords(newish.map((p) => p.name))}, which you started recently, so keep an eye on your skin.`) : null));
    }
    watch = h('div', { class: 'fm-watch' },
      h('h3', null, 'When you buy something new for your face'),
      h('p', { class: 'fm-why muted' }, `Dermatologists say these often bother skin with ${joinWords(probs.filter((p) => ['Redness', 'Sensitivity', 'Itchy skin'].includes(p)).map((x) => x.toLowerCase()))}, so check the label for them. MyShelf will point them out when you add a product.`),
      h('ul', null, rows),
      cleared.length ? h('p', { class: 'fm-clear' }, `No need to skip ${joinWords(cleared)}: it’s in products that work for you.`) : null,
      h('p', { class: 'fm-src' }, 'Sources: ', WATCH_SOURCES.map((x, n) => [n ? ' · ' : '', h('a', { href: x.url, target: '_blank', rel: 'noopener' }, x.title)])));
  }

  return h('section', { class: 'fm-step' },
    stepHead('', 'Try to avoid'),
    bothering.length ? h('div', { class: 'fm-avoid' }, bothering) : null,
    watch);
}

// ---------- your profile, at the top ----------
function profileStrip() {
  const pr = store.state.profile || {};
  return h('div', { class: 'fm-profile' },
    h('span', { class: 'pf-avatar', 'aria-hidden': 'true' }, initials(pr.name) || '·'),
    h('div', { class: 'fm-profile-txt' },
      h('div', { class: 'pf-name' }, pr.name || 'Your skin profile'),
      h('div', { class: 'fm-profile-rows' },
        h('span', null, h('b', null, 'Skin '), pr.skin_type || 'not set'),
        h('span', null, h('b', null, 'Problems '), (pr.problems || []).join(', ') || 'none yet'),
        h('span', null, h('b', null, 'Avoid '), (pr.allergens || []).join(', ') || 'nothing yet'))),
    h('button', { class: 'btn small', onclick: () => openSettings() }, 'Edit profile'));
}

// ---------- your skin problems: what on your shelf is working on each ----------
const LOOK_FOR = {
  'Redness': 'azelaic acid, centella, panthenol or niacinamide',
  'Dark spots': 'niacinamide, tranexamic acid, arbutin, vitamin C, azelaic acid, and daily sunscreen',
  'Breakouts': 'salicylic acid, azelaic acid or niacinamide',
  'Sensitivity': 'short, fragrance-free formulas with ceramides or centella',
  'Dryness': 'hyaluronic acid, glycerin, ceramides or squalane',
  'Oiliness': 'niacinamide, salicylic acid or zinc',
  'Uneven texture': 'gentle exfoliating acids or a retinoid',
  'Itchy skin': 'colloidal oat, ceramides or panthenol',
  'Dandruff': 'zinc pyrithione, ketoconazole or salicylic acid',
  'Hair thinning': 'peptides, caffeine or rosemary',
};
function problemsSection() {
  const st = store.state;
  const probs = st.profile?.problems || [];
  if (!probs.length) {
    return h('section', { class: 'fm-step' }, stepHead('', 'Your skin problems'),
      h('p', { class: 'muted' }, 'Add your skin problems to your profile and MyShelf shows what on your shelf is working on each one.'),
      h('button', { class: 'btn small', onclick: () => openSettings() }, 'Add to profile'));
  }
  const live = st.products.filter((p) => !p.stopped);
  return h('section', { class: 'fm-step' },
    stepHead('', 'Your skin problems, and what’s working on them'),
    h('div', { class: 'fm-probs' }, probs.map((pr) => {
      const helpers = live.map((p) => ({ p, ings: productHelps(p).get(pr) })).filter((x) => x.ings);
      return h('article', { class: 'fm-prob' + (helpers.length ? '' : ' gap') },
        h('div', { class: 'fm-prob-head' }, h('h3', null, pr),
          h('span', { class: 'fm-badge' + (helpers.length ? ' ok' : '') }, helpers.length ? `${helpers.length} product${helpers.length > 1 ? 's' : ''}` : 'Not covered')),
        helpers.length
          ? h('div', { class: 'fm-helpers' }, helpers.map(({ p, ings }) => h('button', { class: 'fm-helper', onclick: () => openProduct(p) },
              thumb(p), h('span', null, h('span', { class: 'nm' }, p.name), h('span', { class: 'via' }, `via ${ings.join(', ').toLowerCase()}`)))))
          : h('p', { class: 'fm-why' }, 'Nothing on your shelf targets this yet.'),
        LOOK_FOR[pr] ? h('p', { class: 'fm-look' }, h('span', { class: 'mono' }, 'Look for '), LOOK_FOR[pr]) : null);
    })));
}
