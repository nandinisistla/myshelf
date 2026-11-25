// Components: the parts MyShelf is built from, shown in one place.
// Every example here is the real, working part (not a picture of it), fed with your
// own data, so this page can never drift from the app.
import { h, put } from './ui.js';
import { store, S } from './store.js';
import { thumb } from './bottle.js';
import { productCard } from './shelf.js';
import { mainAnswer, answerCard } from './answer.js';

export function renderSystem(view) {
  const st = store.state;
  const P = st.products;
  const fine = new Set(st.insights.fineProductIds);
  const inUse = P.find((p) => !p.stopped && fine.has(p.id)) || P.find((p) => !p.stopped);
  const stopped = P.find((p) => p.stopped);
  const suspect = P.find((p) => !p.stopped && S.isSuspectProduct(p));
  const ans = mainAnswer();

  put(view,
    h('section', { class: 'page-head' },
      h('h1', { class: 'display' }, 'Components', h('span', { class: 'soft' }, '.')),
      h('p', { class: 'lede' }, 'The parts MyShelf is built from.')),

    part('Product tile', 'Shows one product. Drag it to spin, tap to open.', ['Shelf'],
      [inUse && variant('In use', productCard(inUse)),
       stopped && variant('Stopped: faded', productCard(stopped)),
       suspect && variant('Has a likely trigger: amber dot', productCard(suspect))], 'tiles'),

    part('Product picture', 'A small photo of a product, cut out so it sits on any background.', ['History', 'For me', 'Product page', '“Show me why”'],
      [inUse && variant('Small', thumb(inUse)),
       inUse && variant('Large', thumb(inUse, 'lg')),
       stopped && variant('Stopped: faded', thumb(stopped, 'lg'))], 'row'),

    part('Answer card', 'One answer: what’s probably bothering your skin, and the proof behind it. Every card has “Show me why”.', ['For me', 'History', 'Product page'],
      ans ? [variant('Full', answerCard(ans, { variant: 'full' })),
             variant('Compact', answerCard(ans, { variant: 'compact' })),
             variant('Inside a product', answerCard(ans, { variant: 'product' }))]
          : [h('p', { class: 'muted' }, 'Shows up once MyShelf finds a pattern in your bad days.')], 'stack'),

    part('Pill switch', 'Pick one option. The see-through blob melts to your choice and follows your mouse.', ['Top menu', 'History', 'Product page', 'For me'],
      [variant('Two options', seg(['Plain words', 'Label'])),
       variant('Three options', seg(['Everything', 'Bad days', 'Products'])),
       variant('Yes / No', h('div', { class: 'fm-ask sys-ask' }, h('span', null, 'Does this sound right?'), ...choice(['Yes', 'No'])))], 'row'),

    part('Bad-day dots', 'One dot per bad day, oldest first. Filled: the product was in use the week before.', ['For me', 'History'],
      [variant('Every time', dotRow(8, 8)), variant('Some of the time', dotRow(8, 3)), variant('Never', dotRow(8, 0))], 'row'),

    part('Buttons', 'Main action, normal action, and small.', ['Everywhere'],
      [variant('Main', h('button', { class: 'btn primary' }, 'Rough skin day?')),
       variant('Normal', h('button', { class: 'btn' }, 'Edit')),
       variant('Small', h('button', { class: 'btn small why-btn' }, 'Show me why', h('span', { 'aria-hidden': 'true' }, '→')))], 'row'),

    part('Colour and type', 'Colour only ever means something.', ['Everywhere'],
      [variant('Amber: a likely trigger', swatch('var(--amber)')),
       variant('Green: fine for you', swatch('var(--ok)')),
       variant('Ink: text and actions', swatch('var(--ink)')),
       variant('Paper: the page', swatch('var(--paper-2)')),
       variant('Words: Calibri', h('span', { class: 'sys-type' }, 'Aa')),
       variant('Labels: IBM Plex Mono', h('span', { class: 'sys-type', style: 'font-family:var(--mono)' }, 'Aa'))], 'row'));
}

// ---------- layout ----------
function part(name, what, usedOn, variants, layout) {
  const items = variants.filter(Boolean);
  if (!items.length) return null;
  return h('section', { class: 'sys-part' },
    h('div', { class: 'sys-info' },
      h('h2', null, name),
      h('p', null, what),
      h('div', { class: 'sys-used' }, h('span', { class: 'mono' }, 'Used on'), usedOn.map((u) => h('span', { class: 'tag' }, u)))),
    h('div', { class: `sys-stage ${layout}` }, items));
}
const variant = (label, el) => h('figure', { class: 'sys-variant' }, h('div', { class: 'sys-demo' }, el), h('figcaption', { class: 'mono' }, label));

// ---------- small working examples ----------
function seg(options) {
  const btns = options.map((o, i) => h('button', { class: i === 0 ? 'on' : '', onclick: () => btns.forEach((b) => b.classList.toggle('on', b.textContent === o)) }, o));
  return h('div', { class: 'seg', role: 'tablist' }, btns);
}
function choice(options) {
  const btns = options.map((o, i) => h('button', { class: 'chip' + (i === 0 ? ' on' : ''), onclick: () => btns.forEach((b) => b.classList.toggle('on', b.textContent === o)) }, o));
  return btns;
}
const dotRow = (n, on) => h('div', { class: 'fm-dots' }, Array.from({ length: n }, (_, i) => h('span', { class: 'fm-dot' + (i >= n - on ? ' on' : '') })));
const swatch = (c) => h('span', { class: 'sys-swatch', style: `background:${c}` });
