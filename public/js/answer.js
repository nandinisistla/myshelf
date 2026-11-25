// The answer card: one component for "what's probably bothering your skin".
// The same card is used on For me (full), History (compact) and the product page
// (product), so the answer always looks and reads the same. Every card has
// "Show me why", which plays back how MyShelf worked the answer out.
import { h, fmtDate, daysBetween, openSheet } from './ui.js';
import { store, S } from './store.js';
import { thumb } from './bottle.js';
import { whyShort } from './why.js';

// ---------- plain words, shared by every page ----------
export const AREA_WORD = { face: 'face', scalp: 'scalp', body: 'body' };
const AREA_KEY = { Face: 'face', 'Hair & scalp': 'scalp', Body: 'body' };
export const joinWords = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
export const plural = (n, one, many) => (n === 1 ? one : many);
// "before every bad day your face had" / "before 5 of the 8 bad days your face had"
export const beforeDays = (n, total, area) => n === total
  ? (total === 1 ? `before the one bad day your ${area} had` : total === 2 ? `before both bad days your ${area} had` : `before every bad day your ${area} had`)
  : `before ${n} of the ${total} bad days your ${area} had`;
const NICE = { 'Coconut-derived': 'Coconut-derived ingredients', 'Cleansers (surfactants)': 'Strong cleansers' };
export const nice = (fam) => NICE[fam] || fam;
const isPlural = (fam) => fam !== 'Fragrance' && /s$/.test(nice(fam));
export const words = (fam) => isPlural(fam)
  ? { it: 'they', It: 'They', was: 'were', is: 'are', has: 'have', them: 'them', its: 'they’re' }
  : { it: 'it', It: 'It', was: 'was', is: 'is', has: 'has', them: 'it', its: 'it’s' };
const shortName = (p) => p.brand || p.name;

// ---------- the answer, worked out once ----------
export const isLikely = (f) => f.status !== 'reject' && (f.status === 'agree' || f.level === 'strong');

export function buildAnswer(f) {
  const st = store.state;
  const area = f.area || AREA_KEY[(f.areas || [])[0]] || 'face';
  const has = (f.areaProductIds || f.productIds).map((id) => S.product(id)).filter(Boolean);
  const live = has.filter((p) => !p.stopped);
  const lastStop = live.length ? null : has.map((p) => p.stopped).filter(Boolean).sort().pop() || null;
  const after = lastStop ? st.reactions.filter((r) => r.area === area && r.date > lastStop).length : 0;
  const fineIds = new Set(st.insights.fineProductIds);
  const hasIds = new Set(has.map((p) => p.id));
  return {
    f, family: f.family, names: [f.family, ...(f.together || [])], area, areaWord: AREA_WORD[area],
    hits: f.hits, relevant: f.relevant, confirmed: f.status === 'agree',
    has, live, lastStop,
    calm: Boolean(lastStop) && after === 0 && daysBetween(lastStop, st.today) >= 14,
    fineOthers: st.products.filter((p) => p.area === area && !hasIds.has(p.id) && fineIds.has(p.id)),
  };
}

// The clearest answer there is, or null.
export function mainAnswer() {
  const f = store.state.insights.families.find(isLikely);
  return f ? buildAnswer(f) : null;
}

export function answerTitle(a) {
  const subject = a.names.length > 1 ? `${joinWords(a.names.map(nice))} are` : `${nice(a.family)} ${words(a.family).is}`;
  return `${subject} probably what’s bothering your ${a.areaWord}`;
}

function calmLine(a) {
  const w = words(a.family);
  if (a.calm) return h('p', { class: 'answer-line ok' }, `✓ Since you stopped using ${w.them} on ${fmtDate(a.lastStop)}, you’ve been doing good.`);
  if (a.live.length) return h('p', { class: 'answer-line warn' }, `You’re still using ${joinWords(a.live.map(shortName))}.`);
  return null;
}

// One dot per bad day, oldest first. Filled = in use the week before.
export function dots(reactions, hit) {
  const ws = store.state.insights.windows || [];
  const list = [...reactions].sort((x, y) => x.date.localeCompare(y.date));
  return h('div', { class: 'fm-dots', 'aria-hidden': 'true' }, list.map((r, idx) => {
    const w = ws.find((x) => x.reaction.id === r.id);
    const on = w && hit(w);
    return h('span', { class: 'fm-dot' + (on ? ' on' : ''), style: `--i:${idx}`, title: `${fmtDate(r.date)}: ${on ? 'in use the week before' : 'not in use'}` });
  }));
}

// ---------- the card ----------
// variant: 'full' (For me), 'compact' (History), 'product' (product page)
export function answerCard(a, { variant = 'full', extra = [] } = {}) {
  const st = store.state;
  const w = words(a.family);
  const N = nice(a.family);
  const evidence = `${N} ${w.was} in something you used ${beforeDays(a.hits, a.relevant, a.areaWord)}.`;
  const lines = variant === 'product'
    ? [h('p', { class: 'answer-line strong' }, `This has ${N.toLowerCase()}, which ${w.was} in something you used ${beforeDays(a.hits, a.relevant, a.areaWord)}.`), calmLine(a)]
    : variant === 'compact'
      ? [h('p', { class: 'answer-line strong' }, evidence), calmLine(a)]
      : [h('p', { class: 'answer-line strong' }, `${evidence} None of the products that work for you have ${w.them}.`),
         h('p', { class: 'answer-line muted' }, `Why ${N.toLowerCase()} can bother skin: ${whyShort(a.family)}`)];
  const pic = variant === 'compact' && a.has[0] ? thumb(a.has[0], 'lg') : null;
  return h('article', { class: `answer ${variant}` },
    pic ? h('div', { class: 'answer-pic' }, pic) : null,
    h('div', { class: 'answer-body' },
      h('div', { class: 'answer-top' },
        h('span', { class: 'answer-label' }, 'Your pattern'),
        h('span', { class: 'fm-badge on' }, a.confirmed ? '✓ You confirmed this' : 'Likely')),
      h('h3', { class: 'answer-title' }, answerTitle(a)),
      variant === 'product' ? null : dots(st.reactions.filter((r) => r.area === a.area), (win) => win.productIds.some((id) => a.f.productIds.includes(id))),
      lines,
      h('div', { class: 'answer-actions' },
        h('button', { class: 'btn small why-btn', onclick: (e) => { e.stopPropagation(); openWhy(a); } }, 'Show me why', h('span', { 'aria-hidden': 'true' }, '→'))),
      extra));
}

// ---------- "Show me why": the answer, worked out in front of you ----------
export function openWhy(a) {
  const st = store.state;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = nice(a.family);
  const lower = N.toLowerCase();
  const w = words(a.family);

  // Lanes: products with it first, then the rest of that area.
  const hasIds = new Set(a.has.map((p) => p.id));
  const byStart = (x, y) => (x.started || '').localeCompare(y.started || '');
  const others = st.products.filter((p) => p.area === a.area && !hasIds.has(p.id)).sort(byStart);
  const lanes = [...[...a.has].sort(byStart), ...others].slice(0, 8);
  const days = st.reactions.filter((r) => r.area === a.area).sort((x, y) => x.date.localeCompare(y.date));
  const ws = st.insights.windows || [];
  const hitDay = (r) => { const win = ws.find((x) => x.reaction.id === r.id); return win && win.productIds.some((id) => hasIds.has(id)); };

  // Time range: the first product or bad day, to today.
  const t = (iso) => new Date(iso + 'T00:00:00Z').getTime();
  const firstISO = [...lanes.map((p) => p.started), ...days.map((r) => r.date)].filter(Boolean).sort()[0] || st.today;
  const t0 = t(firstISO) - 6 * 86400000;
  const t1 = t(st.today) + 3 * 86400000;
  const x = (iso) => `${(((t(iso) - t0) / (t1 - t0)) * 100).toFixed(2)}%`;
  const months = [];
  for (let d = new Date(t0); d.getTime() <= t1; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    if (m.getTime() >= t0) months.push(m);
  }

  const fineIds = new Set(st.insights.fineProductIds);
  const span = (p) => (t(p.stopped || st.today) - t(p.started)) / (t1 - t0) * 100;   // bar width, in %
  const lane = (p) => {
    const tags = [hasIds.has(p.id) ? 'has' : 'other', fineIds.has(p.id) ? 'fine' : ''].join(' ');
    return h('div', { class: `why-lane ${tags}` },
      h('div', { class: 'why-lbl' }, thumb(p, ''), h('span', null, p.name)),
      h('div', { class: 'why-track' },
        h('span', { class: 'why-bar', style: `left:${x(p.started)};right:calc(100% - ${x(p.stopped || st.today)});--l:${lanes.indexOf(p)}` },
          h('em', null, hasIds.has(p.id) ? N : fineIds.has(p.id) ? ['✓', span(p) > 9 ? h('i', null, ' Fine') : null] : ''))));
  };

  const chart = h('div', { class: 'why-chart' },
    h('div', { class: 'why-lane days' },
      h('div', { class: 'why-lbl' }, h('span', null, 'Bad days')),
      h('div', { class: 'why-track' }, days.map((r, i) => h('span', {
        class: 'why-dot' + (hitDay(r) ? ' hit' : ''), style: `left:${x(r.date)};--i:${i}`, title: fmtDate(r.date) })))),
    lanes.map(lane),
    h('div', { class: 'why-axis' }, h('div'), h('div', { class: 'why-track' },
      months.map((m) => h('span', { style: `left:${x(m.toISOString().slice(0, 10))}` }, m.toLocaleString('en', { month: 'short', timeZone: 'UTC' }))))),
    h('div', { class: 'why-over' },
      days.map((r, i) => h('span', { class: 'why-guide' + (hitDay(r) ? ' hit' : ''), style: `left:${x(r.date)};--i:${i}` })),
      a.calm ? h('span', { class: 'why-calm', style: `left:${x(a.lastStop)}` }, h('b', null, 'No bad days since →')) : null));

  // The story, one step at a time. Each step adds one thing to the chart.
  const steps = [
    { cls: 's-days', text: `Your ${a.areaWord} had ${days.length} bad ${plural(days.length, 'day', 'days')}.` },
    { cls: 's-bars', text: `These are the ${a.areaWord} products you were using.` },
    { cls: 's-has', text: `${N} ${w.was} in ${a.has.length === 1 ? 'one of them' : a.has.length === 2 ? 'two of them' : `${a.has.length} of them`}: ${joinWords(a.has.map(shortName))}.` },
    { cls: 's-guides', text: `You were using ${a.has.length === 1 ? 'it' : 'them'} ${beforeDays(a.hits, a.relevant, a.areaWord)}.` },
  ];
  if (a.fineOthers.length) steps.push({ cls: 's-fine', text: `Your other ${a.areaWord} products don’t have ${lower}, and they work fine.` });
  if (a.calm) steps.push({ cls: 's-calm', text: `You stopped on ${fmtDate(a.lastStop)}. Your ${a.areaWord} has had no bad days since.` });
  else if (a.live.length) steps.push({ cls: 's-live', text: `You’re still using ${joinWords(a.live.map(shortName))}. Try a version without ${lower}.` });
  steps.push({ cls: 's-end', text: `So ${lower} ${w.is} probably what’s bothering your ${a.areaWord}.`, end: true });

  const cap = h('p', { class: 'why-cap', 'aria-live': 'polite' });
  const pips = h('div', { class: 'why-pips' }, steps.map((_, i) => h('button', { 'aria-label': `Step ${i + 1}`, onclick: () => { stop(); go(i); } })));
  const back = h('button', { class: 'btn small ghost', onclick: () => { stop(); go(at - 1); } }, '← Back');
  const next = h('button', { class: 'btn small', onclick: () => { stop(); at >= steps.length - 1 ? play() : go(at + 1); } }, 'Next →');
  const stage = h('div', { class: 'why-stage' }, cap, chart, h('div', { class: 'why-ctrl' }, back, pips, next));

  let at = -1, timer = null;
  function go(i) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, n) => stage.classList.toggle(s.cls, n <= at));
    stage.classList.toggle('done', Boolean(steps[at].end));
    cap.replaceChildren(h('span', { class: 'why-n' }, `${at + 1}/${steps.length}`), ' ', steps[at].text);
    cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
    [...pips.children].forEach((b, n) => b.classList.toggle('on', n <= at));
    back.disabled = at === 0;
    next.textContent = at >= steps.length - 1 ? 'Replay ↺' : 'Next →';
  }
  function stop() { clearInterval(timer); timer = null; }
  function play() {
    stop();
    steps.forEach((s) => stage.classList.remove(s.cls));
    go(0);
    if (reduce) return;
    timer = setInterval(() => { if (at >= steps.length - 1) stop(); else go(at + 1); }, 2400);
  }

  const sh = openSheet({ title: 'How MyShelf worked it out', body: [stage], full: true, onClose: stop });
  sh.bodyEl.closest('.sheet')?.classList.add('wide');
  requestAnimationFrame(play);
}
