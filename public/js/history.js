// History: your skin story as a simple diary, newest first.
// Bad days show what you were using in the week before, so the link explains itself.
import { h, put, fmtDate, fmtTime, localDay, addDays, daysBetween, howLong, AREAS, SEVERITY } from './ui.js';
import { store } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';
import { thumb } from './bottle.js';
import { initials } from './settings.js';

const AREA_WORD = { face: 'face', scalp: 'scalp', body: 'body' };
const MONTH = (key) => new Date(key + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
const WEEKDAY = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

let onlyBad = false;

export function renderHistory(view) {
  const st = store.state;
  const R = st.reactions;
  const inUse = st.products.filter((p) => !p.stopped).length;
  const first = [...st.products.map((p) => p.started), ...R.map((r) => r.date)].filter(Boolean).sort()[0];

  put(view,
    h('section', { class: 'page-head' },
      h('div', { class: 'eyebrow mono' }, `History · since ${first ? fmtDate(first, true) : 'today'}`),
      h('h1', { class: 'display' }, 'Your skin story', h('span', { class: 'soft' }, '.')),
      h('p', { class: 'lede' }, R.length
        ? `${R.length} bad day${R.length === 1 ? '' : 's'}, ${inUse} product${inUse === 1 ? '' : 's'} in use. Every bad day shows what you were using the week before.`
        : 'Every product you start or stop shows up here. Log a bad day and you’ll see what you were using the week before.')),
    headline(st),
    h('div', { class: 'hs-filter' },
      h('button', { class: 'chip' + (onlyBad ? '' : ' on'), onclick: () => { onlyBad = false; renderHistory(view); } }, 'Everything'),
      h('button', { class: 'chip' + (onlyBad ? ' on' : ''), onclick: () => { onlyBad = true; renderHistory(view); } }, 'Bad days only')),
    feed(st),
    h('details', { class: 'hs-log' },
      h('summary', { class: 'mono' }, 'Every change, including edits and the AI chat'),
      log()));
}

// The one thing worth knowing, in a sentence: the clearest ingredient pattern if there is
// one, otherwise the product that keeps showing up.
function headline(st) {
  const R = st.reactions;
  if (R.length < 2) return null;
  const fam = st.insights.families.find((f) => f.status !== 'reject' && (f.status === 'agree' || f.level === 'strong'));
  if (fam) {
    const area = AREA_WORD[fam.area];
    const ps = (fam.areaProductIds || []).map((id) => st.products.find((p) => p.id === id)).filter(Boolean);
    const stillUsing = ps.some((p) => !p.stopped);
    const lastStop = ps.map((p) => p.stopped).filter(Boolean).sort().pop();
    const after = lastStop ? R.filter((r) => r.area === fam.area && r.date > lastStop).length : 1;
    const calm = !stillUsing && lastStop && after === 0 && daysBetween(lastStop, st.today) >= 14;
    const top = ps[0];
    return h('button', { class: 'hs-headline', onclick: () => { location.hash = '#forme'; } },
      top ? thumb(top, 'lg') : null,
      h('div', null,
        h('div', { class: 'mono' }, fam.status === 'agree' ? 'Pattern · you confirmed it' : 'Pattern'),
        h('p', null,
          h('b', null, fam.family), ` was in what you used before ${fam.hits === fam.relevant ? 'every one' : fam.hits} of your ${fam.relevant} ${area} bad days.`,
          calm ? ` Since you cut it out on ${fmtDate(lastStop)}, your ${area} hasn’t acted up once.` : '')));
  }
  const count = new Map();
  for (const w of st.insights.windows || []) for (const id of w.productIds) count.set(id, (count.get(id) || 0) + 1);
  let best = null;
  for (const p of st.products) {
    const n = count.get(p.id) || 0;
    const total = R.filter((r) => r.area === p.area).length;
    if (n < 2 || n / total < 0.6) continue;
    if (!best || n > best.n || (n === best.n && n / total > best.n / best.total)) best = { p, n, total };
  }
  if (!best) return null;
  const { p, n, total } = best;
  const area = AREA_WORD[p.area];
  const after = R.filter((r) => r.area === p.area && p.stopped && r.date > p.stopped).length;
  const calm = p.stopped && after === 0 && daysBetween(p.stopped, st.today) >= 14;
  return h('button', { class: 'hs-headline', onclick: () => openProduct(p) },
    thumb(p, 'lg'),
    h('div', null,
      h('div', { class: 'mono' }, 'Pattern'),
      h('p', null,
        h('b', null, p.name), ` was in use before ${n === total ? 'every one' : n} of your ${total} ${area} bad days.`,
        calm ? ` Since you stopped it on ${fmtDate(p.stopped)}, your ${area} hasn’t acted up once.` : '')));
}

function feed(st) {
  const items = [];
  for (const r of st.reactions) items.push({ date: r.date, kind: 'bad', order: 0, r });
  if (!onlyBad) items.push(...profileItems(st));
  if (!onlyBad) for (const p of st.products) {
    if (p.stopped) items.push({ date: p.stopped, kind: 'stop', order: 1, p });
    if (p.started) items.push({ date: p.started, kind: 'start', order: 2, p });
  }
  if (!items.length) return h('div', { class: 'empty' }, h('h3', null, 'Nothing here yet'), h('p', null, 'Add products to your shelf and your story starts here.'));
  items.sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order);

  const months = [];
  for (const it of items) {
    const key = it.date.slice(0, 7);
    if (!months.length || months[months.length - 1].key !== key) months.push({ key, items: [] });
    months[months.length - 1].items.push(it);
  }
  return h('div', { class: 'hs-feed' }, months.map((m) => {
    const bad = m.items.filter((i) => i.kind === 'bad').length;
    return h('section', { class: 'hs-month' },
      h('header', null,
        h('h2', null, MONTH(m.key), ' ', h('span', { class: 'yr' }, m.key.slice(0, 4))),
        h('span', { class: 'mono' }, bad ? `${bad} bad day${bad === 1 ? '' : 's'}` : 'No bad days')),
      m.items.map((it) => entry(it, st)));
  }));
}

// Your skin profile is part of the story: when you made it, and each time it changed.
function profileItems(st) {
  const evs = st.events.filter((e) => e.kind === 'profile' && Array.isArray(e.data?.problems) && Array.isArray(e.data?.allergens))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const out = [];
  let prev = null;
  for (const e of evs) {
    const d = e.data;
    const lines = [];
    if (!prev) lines.push(`${d.skin_type || 'Skin type not set'} skin`, d.problems.length ? `Problems: ${d.problems.join(', ')}` : null, d.allergens.length ? `Avoid: ${d.allergens.join(', ')}` : null);
    else {
      const added = (k) => d[k].filter((x) => !prev[k].includes(x));
      const removed = (k) => prev[k].filter((x) => !d[k].includes(x));
      if (d.skin_type !== prev.skin_type) lines.push(`Skin type: ${d.skin_type}`);
      if (added('allergens').length) lines.push(`Now avoiding ${added('allergens').join(', ').toLowerCase()}`);
      if (removed('allergens').length) lines.push(`No longer avoiding ${removed('allergens').join(', ').toLowerCase()}`);
      if (added('problems').length) lines.push(`Added ${added('problems').join(', ').toLowerCase()}`);
      if (removed('problems').length) lines.push(`Removed ${removed('problems').join(', ').toLowerCase()}`);
    }
    if (prev && !lines.length) { prev = d; continue; }
    out.push({ date: localDay(e.at), kind: 'profile', order: prev ? 0.5 : 3, first: !prev, lines: lines.filter(Boolean) });
    prev = d;
  }
  for (const e of st.events.filter((x) => x.kind === 'insight' && x.data?.status === 'agree')) {
    out.push({ date: localDay(e.at), kind: 'confirm', order: 0.6, family: e.data.family });
  }
  return out;
}

function entry(it, st) {
  const when = h('div', { class: 'hs-when' }, h('div', { class: 'd' }, it.date.slice(8, 10)), h('div', { class: 'mono' }, WEEKDAY(it.date)));
  const shelf = (p) => st.routines.find((r) => r.id === p.routine_id)?.name;

  if (it.kind === 'bad') {
    const r = it.r;
    const win = (st.insights.windows || []).find((w) => w.reaction.id === r.id);
    const used = (win?.productIds || []).map((id) => st.products.find((p) => p.id === id)).filter(Boolean);
    const area = AREA_WORD[r.area];
    return h('article', { class: `hs-row bad sev${r.severity}` }, when,
      h('span', { class: 'hs-mark', 'aria-hidden': 'true' }),
      h('div', { class: 'hs-body' },
        h('button', { class: 'hs-title', onclick: () => openBadDay(r) },
          `Your ${area} acted up`, h('span', { class: 'sev' }, SEVERITY[r.severity])),
        r.note ? h('p', { class: 'hs-note' }, `“${r.note}”`) : null,
        h('div', { class: 'hs-used' },
          h('div', { class: 'mono' }, used.length ? `On your ${area}, the week before` : `Nothing on your ${area} the week before`),
          used.length ? h('div', { class: 'hs-chips' }, used.map((p) => h('button', { class: 'hs-chip', onclick: () => openProduct(p) }, thumb(p), h('span', null, p.name)))) : null)));
  }

  if (it.kind === 'profile' || it.kind === 'confirm') {
    return h('article', { class: 'hs-row profile' }, when,
      h('span', { class: 'hs-mark', 'aria-hidden': 'true' }),
      h('button', { class: 'hs-body hs-product', onclick: () => { location.hash = it.kind === 'confirm' ? '#forme' : '#forme'; } },
        h('span', { class: 'hs-thumb hs-icon', 'aria-hidden': 'true' }, it.kind === 'confirm' ? '✓' : initials(st.profile?.name) || '·'),
        h('div', null,
          h('div', { class: 'hs-line' }, it.kind === 'confirm'
            ? ['You confirmed ', h('b', null, it.family.toLowerCase()), ' as a trigger']
            : it.first ? h('b', null, 'Created your skin profile') : ['Updated your ', h('b', null, 'skin profile')]),
          h('div', { class: 'mono' }, it.kind === 'confirm' ? 'Added to Better to avoid' : it.lines.join(' · ')))));
  }

  const p = it.p;
  const stop = it.kind === 'stop';
  const today = p.started === st.today && !stop;
  return h('article', { class: 'hs-row ' + it.kind }, when,
    h('span', { class: 'hs-mark', 'aria-hidden': 'true' }),
    h('button', { class: 'hs-body hs-product', onclick: () => openProduct(p) },
      thumb(p),
      h('div', null,
        h('div', { class: 'hs-line' }, stop ? 'Stopped ' : today ? 'Added ' : 'Started ', h('b', null, p.name)),
        h('div', { class: 'mono' }, [p.brand, shelf(p) ? `${shelf(p)} shelf` : AREAS[p.area],
          stop && p.started ? `used ${howLong(p.started, p.stopped)}` : null].filter(Boolean).join(' · ')))));
}

function log() {
  const ev = store.state.events;
  if (!ev.length) return h('p', { class: 'muted' }, 'Changes you make show up here.');
  return h('div', { class: 'log' }, ev.map((e) => {
    const day = localDay(e.at);
    return h('div', { class: 'log-row' },
      h('span', { class: 'when' }, `${fmtDate(day, true)} · ${fmtTime(e.at)}`),
      h('span', { class: 'what' + (e.kind.startsWith('reaction') ? ' bad' : '') }, e.summary),
      h('span', { class: 'src' }, e.source === 'chat' ? 'AI chat' : 'You'));
  }));
}
