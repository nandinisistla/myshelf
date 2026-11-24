// History: a drawing-sheet timeline of what you used and when your skin reacted,
// plus a log of every change (by you or the AI).
import { h, put, fmtDate, fmtTime, localDay, addDays, daysBetween, howLong, AREAS, SEVERITY } from './ui.js';
import { store, S } from './store.js';
import { openProduct } from './product.js';
import { openBadDay } from './reaction.js';

let range = 90;
let selected = null;
const pad = (n) => String(n).padStart(2, '0');
const MON = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
const DD = (iso) => iso.slice(8, 10);
const short = (iso) => `${DD(iso)} ${MON(iso)}`;

export function renderHistory(view) {
  const st = store.state;
  if (selected && !st.reactions.some((r) => r.id === selected)) selected = null;
  const [start, end] = bounds();
  const inRange = st.reactions.filter((r) => r.date >= start && r.date <= end);

  put(view,
    h('div', { class: 'sheet-label mono' }, 'History · Section A–A'),
    h('section', { class: 'drawing' }, rail(inRange.length), main(start, end, inRange)),
    h('div', { class: 'under mono' }, h('span', null, `Timeline · ${range ? range + '-day' : 'full'} chart`), h('span', null, 'Tap an amber dot to see the 7 days before')),
    selectedCard(),
    h('div', { class: 'sheet-label mono' }, 'Log · Everything that happened'),
    log());
}

function bounds() {
  const st = store.state;
  const end = st.today;
  if (range) return [addDays(end, -range + 1), end];
  const dates = [...st.products.map((p) => p.started).filter(Boolean), ...st.reactions.map((r) => r.date)].sort();
  const first = dates[0] && dates[0] < addDays(end, -30) ? dates[0] : addDays(end, -30);
  return [addDays(first, -4), end];
}

function rail(badCount) {
  const st = store.state;
  const inUse = st.products.filter((p) => !p.stopped).length;
  const item = (n, k, extra = {}) => h(extra.onclick ? 'button' : 'div', { class: 'rail-item' + (extra.on ? ' on' : '') + (extra.last ? ' last' : ''), onclick: extra.onclick, 'aria-pressed': extra.onclick ? String(Boolean(extra.on)) : null },
    h('div', { class: 'n' }, n), h('div', { class: 'k' }, k));
  const setRange = (v) => () => { range = v; renderHistory(document.getElementById('view')); };
  return h('aside', { class: 'rail' },
    h('div', { class: 'logo' }, 'My', 'S', h('span', { class: 'h' }, 'h'), 'elf'),
    item(pad(inUse), 'In use'),
    item(pad(badCount), 'Bad days'),
    item(pad(st.insights.suspectFamilies.length), 'Triggers', { last: true }),
    h('div', { class: 'spacer' }),
    item('30', 'Days', { onclick: setRange(30), on: range === 30 }),
    item('90', 'Days', { onclick: setRange(90), on: range === 90 }),
    item('All', 'Time', { onclick: setRange(0), on: range === 0, last: true }),
    h('div', { class: 'gap' }),
    h('div', { class: 'foot' }, h('div', { class: 'k' }, 'Today'), h('div', { class: 'n' }, short(st.today))));
}

function ticks(start, end) {
  const span = daysBetween(start, end);
  const out = [];
  for (let i = 0; i <= span; i++) {
    const d = addDays(start, i);
    const day = Number(DD(d));
    const dow = new Date(d + 'T12:00:00Z').getUTCDay();
    const keep = span <= 40 ? dow === 1 : span <= 120 ? (day === 1 || day === 15) : (day === 1 && (span <= 240 || Number(d.slice(5, 7)) % 2 === 1));
    if (keep) out.push(d);
  }
  return out;
}

function main(start, end, reactions) {
  const st = store.state;
  const span = Math.max(1, daysBetween(start, end));
  const x = (d) => (Math.max(0, Math.min(span, daysBetween(start, d))) / span) * 100;
  const sus = S.suspects();
  const sel = st.reactions.find((r) => r.id === selected);
  const win = sel ? st.insights.windows.find((w) => w.reaction.id === sel.id) : null;
  const inWin = new Set(win ? win.productIds : []);

  const products = st.products
    .filter((p) => (p.started || st.today) <= end && (!p.stopped || p.stopped >= start))
    .sort((a, b) => (a.started || '').localeCompare(b.started || '') || a.id - b.id);

  const select = (id) => { selected = selected === id ? null : id; renderHistory(document.getElementById('view')); };
  const tickDates = ticks(start, end).filter((d) => x(d) > 2 && x(d) < 96);

  // Header: dates and bad days on one axis
  const axis = h('div', { class: 'g-axis' },
    h('div', { class: 'g-lane' }),
    h('div', { class: 'g-line' }),
    tickDates.map((d) => h('div', { class: 'tick', style: `left:${x(d)}%` }, h('i'), h('div', { class: 'd' }, DD(d)), h('div', { class: 'm' }, MON(d)))),
    reactions.map((r) => h('button', { class: `badday sev${r.severity}` + (r.id === selected ? ' on' : ''), style: `left:${x(r.date)}%`,
      title: `${fmtDate(r.date)} · ${AREAS[r.area]} · ${SEVERITY[r.severity]}`, 'aria-label': `Bad day ${fmtDate(r.date)}, ${AREAS[r.area]}`, onclick: () => select(r.id) })));

  // Guides drawn behind the rows
  const overlay = h('div', { class: 'g-overlay', 'aria-hidden': 'true' },
    tickDates.map((d) => h('div', { class: 'vline', style: `left:${x(d)}%` })),
    reactions.map((r) => h('div', { class: 'badday-line', style: `left:${x(r.date)}%` })),
    win ? h('div', { class: 'window', style: `left:${x(win.from)}%;width:${Math.max(0.6, x(win.to) - x(win.from))}%` }) : null);

  const rows = products.map((p) => {
    const s0 = p.started && p.started > start ? p.started : start;
    const e0 = p.stopped && p.stopped < end ? p.stopped : end;
    const left = x(s0), right = x(e0);
    const width = right - left;
    const hasSus = (p.ingredients || []).some((i) => sus.has(i.family));
    const state = sel ? (inWin.has(p.id) ? ' hot' : ' dim') : '';
    const since = p.started === st.today ? 'Added today' : `${short(p.started || st.today)} → ${p.stopped ? short(p.stopped) : 'now'}`;
    const dur = p.started === st.today ? '' : ` · ${howLong(p.started || st.today, p.stopped || st.today)}`;
    const tagRight = left > 62;
    return h('div', { class: 'g-row' + state },
      h('div', { class: 'g-lab' },
        h('div', { class: 'mono' }, [p.brand, AREAS[p.area]].filter(Boolean).join(' · ')),
        h('button', { class: 'nm', onclick: () => openProduct(p), title: p.name }, p.name)),
      h('div', { class: 'g-track' },
        width < 1.2
          ? h('span', { class: 'g-dot' + (hasSus ? ' sus' : ''), style: `left:${left}%` })
          : h('div', { class: 'g-bar' + (p.stopped ? '' : ' open') + (hasSus ? ' sus' : ''), style: `left:${left}%;width:${width}%` }),
        h('div', { class: 'g-tag mono' + (tagRight ? ' r' : ''), style: tagRight ? `right:${100 - left + 1.2}%` : `left:${left}%` },
          since + dur, sel && inWin.has(p.id) ? h('span', { class: 'inwin' }, ' · in window') : null)));
  });

  return h('div', { class: 'sheet-main' },
    h('div', { class: 'eyebrow mono' }, 'Section A–A'),
    h('h1', null, 'What you used, and when your skin reacted'),
    h('div', { class: 'thick' }),
    products.length || reactions.length
      ? h('div', { class: 'gantt' },
          h('div', { class: 'g-head' }, h('div', { class: 'g-lab' }, h('div', { class: 'mono g-lane-l' }, 'Bad days'), h('div', { class: 'mono' }, 'Product')), axis),
          h('div', { class: 'g-body' }, overlay, rows))
      : h('div', { class: 'empty' }, h('h3', null, 'Nothing here yet'), h('p', null, 'Add products to your shelf. The timeline draws itself from there.')),
    h('div', { class: 'sheet-foot-row mono' }, h('span', null, `Process · ${pad(products.length)} products`), h('span', null, `${short(start)} — ${short(end)}`)));
}

function selectedCard() {
  const st = store.state;
  const r = st.reactions.find((x) => x.id === selected);
  if (!r) return null;
  const win = st.insights.windows.find((w) => w.reaction.id === r.id);
  const used = (win?.productIds || []).map((id) => S.product(id)).filter(Boolean);
  return h('div', { class: 'selected-card' },
    h('div', null, h('div', { class: 'mono' }, `Bad day · ${SEVERITY[r.severity]}`), h('h3', null, `${fmtDate(r.date, true)} · ${AREAS[r.area]}`)),
    h('div', null, h('button', { class: 'btn small', onclick: () => openBadDay(r) }, 'Edit')),
    r.note ? h('div', { class: 'note' }, `“${r.note}”`) : null,
    h('div', { class: 'used' },
      h('span', { class: 'mono', style: 'align-self:center;margin-right:6px' }, used.length ? 'Used in the 7 days before:' : 'Nothing used on this area in the 7 days before'),
      used.map((p) => h('button', { class: 'chip', onclick: () => openProduct(p) }, p.name))));
}

function log() {
  const ev = store.state.events;
  if (!ev.length) return h('p', { class: 'muted' }, 'Changes you make show up here.');
  return h('div', { class: 'log' }, ev.map((e) => {
    const day = localDay(e.at);
    return h('div', { class: 'log-row' },
      h('span', { class: 'when' }, `${short(day)} · ${fmtTime(e.at)}`),
      h('span', { class: 'what' + (e.kind.startsWith('reaction') ? ' bad' : '') }, e.summary),
      h('span', { class: 'src' }, e.source === 'chat' ? 'AI chat' : 'You'));
  }));
}
