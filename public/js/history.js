// History: a timeline of what you used and when your skin reacted,
// plus every change ever made (by you or the AI).
import { h, put, s, fmtDate, fmtTime, localDay, addDays, daysBetween, AREAS, SEVERITY } from './ui.js';
import { store, S } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';

let range = 90;
let selected = null;

export function renderHistory(view) {
  const st = store.state;
  const rangeSeg = h('div', { class: 'seg' }, [[30, '30 days'], [90, '90 days'], [0, 'All']].map(([v, t]) =>
    h('button', { class: range === v ? 'on' : '', onclick: () => { range = v; renderHistory(view); } }, t)));

  const head = [
    h('div', { class: 'top' }, h('h1', { class: 'title' }, 'History'), rangeSeg),
    h('p', { class: 'sub' }, 'Tap a bad day (amber dot) to see what you used in the 7 days before it.'),
  ];

  if (!st.products.length && !st.reactions.length) {
    put(view, ...head, h('div', { class: 'empty' }, h('h3', null, 'Nothing here yet'),
      h('p', null, 'Add products to your shelf. Your history builds itself from there.')), activity());
    return;
  }
  if (selected && !st.reactions.some((r) => r.id === selected)) selected = null;
  put(view, ...head, timeline(view), selectedCard(), activity());
}

function bounds() {
  const st = store.state;
  const end = st.today;
  if (range) return [addDays(end, -range + 1), end];
  const dates = [...st.products.map((p) => p.started).filter(Boolean), ...st.reactions.map((r) => r.date)].sort();
  const first = dates[0] && dates[0] < addDays(end, -30) ? dates[0] : addDays(end, -30);
  return [addDays(first, -3), end];
}

function timeline(view) {
  const st = store.state;
  const [start, end] = bounds();
  const span = Math.max(1, daysBetween(start, end));
  const W = Math.max(340, Math.min(430, (view.clientWidth || 390) + 20));
  const L = 112, R = 14, TOP = 46, ROW = 24;
  const x = (d) => L + (Math.max(0, Math.min(span, daysBetween(start, d))) / span) * (W - L - R);

  const products = st.products.filter((p) => (p.started || st.today) <= end && (!p.stopped || p.stopped >= start));
  const groups = Object.keys(AREAS).map((a) => [a, products.filter((p) => p.area === a)]).filter(([, l]) => l.length);
  const reactions = st.reactions.filter((r) => r.date >= start && r.date <= end);
  const sel = st.reactions.find((r) => r.id === selected);
  const win = sel ? st.insights.windows.find((w) => w.reaction.id === sel.id) : null;
  const inWin = new Set(win ? win.productIds : []);
  const sus = S.suspects();

  let y = TOP;
  const rows = [];
  const labels = [];
  for (const [area, list] of groups) {
    labels.push(s('text', { x: 4, y: y + 12, 'font-size': 11.5, fill: '#9a9a9a', 'font-weight': 700, 'letter-spacing': 0.5 }, AREAS[area].toUpperCase()));
    y += 18;
    for (const p of list) {
      const x1 = x(p.started || st.today), x2 = x(p.stopped || end);
      const dim = sel && !inWin.has(p.id);
      const hot = sel && inWin.has(p.id);
      const hasSus = (p.ingredients || []).some((i) => sus.has(i.family));
      labels.push(s('text', { x: 4, y: y + 14, 'font-size': 12.5, fill: dim ? '#bdbdbd' : '#2b2b2b' }, p.name.length > 17 ? p.name.slice(0, 16) + '…' : p.name));
      rows.push(s('rect', { class: 'bar', x: x1, y: y + 5, width: Math.max(4, x2 - x1), height: 12, rx: 6,
        fill: hot ? '#2b2b2b' : dim ? '#ededed' : '#cfcfcf', stroke: hasSus ? '#d4a24c' : 'none', 'stroke-width': hasSus ? 1.5 : 0,
        onclick: () => openProduct(p) }, s('title', null, `${p.name}: ${fmtDate(p.started)} – ${p.stopped ? fmtDate(p.stopped) : 'now'}`)));
      if (!p.stopped && x2 >= W - R - 1) rows.push(s('circle', { cx: x2, cy: y + 11, r: 2.5, fill: hot ? '#2b2b2b' : '#9a9a9a' }));
      y += ROW;
    }
    y += 6;
  }
  const H = Math.max(y + 8, TOP + 40);

  // month / week ticks
  const ticks = [];
  for (let i = 0; i <= span; i++) {
    const d = addDays(start, i);
    const first = d.endsWith('-01');
    if (first || (span <= 45 && new Date(d + 'T12:00:00Z').getUTCDay() === 1)) {
      ticks.push(s('line', { x1: x(d), x2: x(d), y1: 30, y2: H, stroke: '#efefef' }),
        s('text', { x: x(d) + 2, y: 40, 'font-size': 10.5, fill: '#9a9a9a' }, fmtDate(d)));
    }
  }
  const band = win ? s('rect', { x: x(win.from), y: 22, width: Math.max(4, x(win.to) - x(win.from)), height: H - 22, fill: '#fbf4e6' }) : null;
  const bandLabel = win ? s('text', { x: x(win.from) + 3, y: H - 4, 'font-size': 10.5, fill: '#8a6420' }, '7 days before') : null;

  const rx = reactions.map((r) => s('circle', {
    class: 'rx', cx: x(r.date), cy: 16, r: 4 + r.severity * 1.6, fill: '#d4a24c',
    stroke: r.id === selected ? '#2b2b2b' : '#fff', 'stroke-width': 2,
    onclick: () => { selected = selected === r.id ? null : r.id; renderHistory(document.getElementById('view')); },
  }, s('title', null, `${fmtDate(r.date)} · ${AREAS[r.area]} · ${SEVERITY[r.severity]}`)));

  return h('div', { class: 'tl' },
    s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Timeline of products and bad days' },
      band, ticks,
      s('text', { x: 4, y: 20, 'font-size': 11.5, fill: '#8a6420', 'font-weight': 700, 'letter-spacing': 0.5 }, 'BAD DAYS'),
      s('line', { x1: L, x2: W - R, y1: 16, y2: 16, stroke: '#ececec' }),
      rows, labels, rx, bandLabel,
      s('line', { x1: x(end), x2: x(end), y1: 24, y2: H, stroke: '#2b2b2b', 'stroke-dasharray': '2 3', opacity: 0.35 })));
}

function selectedCard() {
  const st = store.state;
  const r = st.reactions.find((x) => x.id === selected);
  if (!r) {
    const recent = st.reactions.slice(0, 1)[0];
    return recent ? h('div', { class: 'selected-card muted small' }, `Last bad day: ${fmtDate(recent.date)} · ${AREAS[recent.area]}. Tap its amber dot above.`) : null;
  }
  const win = st.insights.windows.find((w) => w.reaction.id === r.id);
  const used = (win?.productIds || []).map((id) => S.product(id)).filter(Boolean);
  return h('div', { class: 'selected-card' },
    h('div', { class: 'h-row', style: 'justify-content:space-between' },
      h('b', null, `${fmtDate(r.date)} · ${AREAS[r.area]} · ${SEVERITY[r.severity]}`),
      h('button', { class: 'btn small', onclick: () => openBadDay(r) }, 'Edit')),
    r.note ? h('div', { class: 'muted', style: 'margin-top:4px' }, `“${r.note}”`) : null,
    h('div', { style: 'margin-top:8px' }, used.length ? `Used on your ${AREAS[r.area].toLowerCase()} in the 7 days before:` : `Nothing logged on your ${AREAS[r.area].toLowerCase()} in the 7 days before.`),
    h('div', { class: 'used' }, used.map((p) => h('button', { class: 'chip', onclick: () => openProduct(p) }, p.name))));
}

const ICON_KIND = (k) => (k.startsWith('reaction') ? 'reaction' : k === 'product.add' ? 'add' : '');
function activity() {
  const ev = store.state.events;
  const out = [h('div', { class: 'section-h' }, 'Everything that happened')];
  if (!ev.length) { out.push(h('p', { class: 'muted' }, 'Changes you make show up here.')); return h('div', null, out); }
  let day = '';
  for (const e of ev) {
    const d = localDay(e.at);
    if (d !== day) { day = d; out.push(h('div', { class: 'act-day' }, fmtDate(d))); }
    out.push(h('div', { class: 'act ' + ICON_KIND(e.kind) },
      h('span', { class: 'd' }),
      h('div', { class: 't' }, e.summary, e.source === 'chat' ? h('span', { class: 'pill', style: 'margin-left:6px' }, 'via AI chat') : null),
      h('span', { class: 'w' }, fmtTime(e.at))));
  }
  return h('div', null, out);
}
