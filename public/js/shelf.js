// Shelf: your products as clean cards, grouped by routine (your "shelves").
import { h, put, toast, confirmSheet, openSheet, howLong, AREAS } from './ui.js';
import { store, mutate, S } from './store.js';
import { renderBottle } from './bottle.js';
import { openProduct } from './product.js';
import { openAdd } from './add.js';
import { getHero } from './hero.js';
import { productAllergens, productHelps, isWorking } from './rules.js';

const pad = (n) => String(n).padStart(2, '0');

export function renderShelf(view) {
  const st = store.state;
  const numberOf = new Map([...st.products].sort((a, b) => a.id - b.id).map((p, i) => [p.id, i + 1]));
  const onShelf = st.products.filter((p) => !p.stopped);
  const past = st.products.filter((p) => p.stopped).sort((a, b) => (b.stopped || '').localeCompare(a.stopped || ''));

  const head = h('section', { class: 'page-head', id: 'shelf-start' },
    h('h1', { class: 'display' }, 'Your shelf', h('span', { class: 'soft' }, '.')),
    tagline(),
    h('div', { style: 'display:flex;gap:10px;margin-top:22px;flex-wrap:wrap' },
      h('button', { class: 'btn primary', onclick: () => openAdd() }, 'Add a product'),
      h('button', { class: 'btn', onclick: newShelf }, 'New shelf')));

  const groups = st.routines.map((r, i) => group(r, i + 1, onShelf.filter((p) => p.routine_id === r.id), numberOf));
  const unsorted = onShelf.filter((p) => !p.routine_id || !st.routines.some((r) => r.id === p.routine_id));
  if (unsorted.length) groups.push(group({ id: null, name: 'Unsorted' }, st.routines.length + 1, unsorted, numberOf));

  const pastBlock = past.length ? h('details', { class: 'past-toggle' },
    h('summary', { class: 'mono', style: 'cursor:pointer;list-style:none' }, 'No longer using', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↓')),
    h('div', { class: 'grid', style: 'margin-top:18px' }, past.map((p) => card(p, numberOf)))) : null;

  put(view, getHero(), head, groups, pastBlock);
}

function group(r, n, products, numberOf) {
  const nameEl = r.id
    ? h('h2', null, h('button', { title: 'Rename', onclick: (e) => renameInline(e.currentTarget.parentElement, r) }, r.name))
    : h('h2', null, r.name);
  return h('section', { class: 'shelf-group', 'aria-label': `${r.name} shelf` },
    h('div', { class: 'group-head' },
      nameEl,
      h('span', { class: 'rule' }),
      h('span', { class: 'mono' }, `${pad(products.length)} item${products.length === 1 ? '' : 's'}`),
      r.id ? h('button', { class: 'mono-btn', onclick: () => removeShelf(r) }, 'Remove') : h('span')),
    h('div', { class: 'grid' },
      products.map((p) => card(p, numberOf)),
      h('button', { class: 'add-tile', 'aria-label': `Add a product to ${r.name}`, onclick: () => openAdd({ routineId: r.id }) },
        h('div', null, h('b', null, '+'), h('span', null, 'Add product')))));
}

function card(p, numberOf) {
  const st = store.state;
  const suspect = S.isSuspectProduct(p);
  const tile = h('div', { class: 'tile' + (p.stopped ? ' stopped' : '') },
    h('span', { class: 'corner l' }, `Nº ${pad(numberOf.get(p.id) || 0)}`),
    suspect ? h('span', { class: 'tdot', title: 'Contains a likely trigger' }) : null,
    h('span', { class: 'corner r' }, AREAS[p.area] || ''),
    h('span', { class: 'floor', 'aria-hidden': 'true' }),
    renderBottle(p, { onOpen: openProduct, showName: false }));
  const right = p.stopped ? `Until ${shortDate(p.stopped)}` : howLong(p.started, st.today);
  const desc = [p.brand, p.summary].filter(Boolean).join(' · ') || p.brand || '';
  return h('article', { class: 'pcard' },
    tile,
    h('div', { class: 'pmeta' },
      h('button', { class: 'pname', onclick: () => openProduct(p) }, p.name),
      h('span', { class: 'pright' }, right)),
    h('div', { class: 'pdesc', title: desc }, desc),
    tags(p));
}

// From your skin profile: what it helps with, and anything on your avoid list.
function tags(p) {
  const al = isWorking(p) ? [] : productAllergens(p);
  const helps = [...productHelps(p).keys()];
  if (!al.length && !helps.length) return null;
  return h('div', { class: 'ptags' },
    al.map((a) => h('span', { class: 'ptag avoid' }, `Has ${a.toLowerCase()}`)),
    helps.slice(0, 2).map((pr) => h('span', { class: 'ptag' }, pr)));
}

function shortDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function renameInline(h2, r) {
  const input = h('input', { value: r.name, 'aria-label': 'Shelf name', maxlength: 40 });
  const old = [...h2.childNodes];
  h2.replaceChildren(input);
  input.focus(); input.select();
  let done = false;
  const restore = () => h2.replaceChildren(...old);
  const save = async () => {
    if (done) return; done = true;
    const name = input.value.trim();
    if (name && name !== r.name) {
      try { await mutate('routine.rename', { id: r.id, name }); toast('Shelf renamed'); }
      catch (e) { toast(e.message); restore(); }
    } else restore();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { done = true; restore(); } });
  input.addEventListener('blur', save);
}

function newShelf() {
  const input = h('input', { class: 'input', placeholder: 'Weekend, Travel, Gym bag…', maxlength: 40, 'aria-label': 'Shelf name' });
  const err = h('div', { class: 'err' });
  const save = async () => {
    if (!input.value.trim()) { err.textContent = 'Give the shelf a name.'; return; }
    try { await mutate('routine.add', { name: input.value }); sh.close(); toast('New shelf added'); }
    catch (e) { err.textContent = e.message; }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  input.addEventListener('input', () => { err.textContent = ''; });
  const sh = openSheet({
    title: 'New shelf',
    body: [h('p', { class: 'muted' }, 'Shelves are your routines. Name it however you like.'), input, err],
    foot: [h('button', { class: 'btn primary block', onclick: save }, 'Add shelf')],
  });
  setTimeout(() => input.focus(), 50);
}

async function removeShelf(r) {
  if (!(await confirmSheet(`Remove the "${r.name}" shelf? Its products move to Unsorted. Nothing is deleted.`, 'Remove shelf'))) return;
  try { await mutate('routine.delete', { id: r.id }); toast('Shelf removed'); } catch (e) { toast(e.message); }
}



// "For your shelf." — every time it comes into view, the grey h melts away and drips
// off, and the letters slide together into "For your self."
let taglineSeen = false;      // already played while on screen (so a re-draw doesn't replay it)
function tagline() {
  const hEl = h('span', { class: 'h melt', 'aria-hidden': 'true' }, 'h', h('i', { class: 'drip' }));
  const el = h('p', { class: 'lede tagline', 'aria-label': 'For your shelf, for yourself.' }, 'For your s', hEl, 'elf.');
  const reset = () => { el.classList.remove('melting', 'melted'); hEl.style.width = ''; };
  const play = () => {
    reset();
    hEl.style.width = `${hEl.getBoundingClientRect().width}px`;
    void hEl.offsetWidth;
    el.classList.add('melting');
    hEl.style.width = '0px';
  };
  const io = new IntersectionObserver(([e]) => {
    if (!el.isConnected) { io.disconnect(); return; }
    if (e.isIntersecting) {
      if (taglineSeen) { el.classList.add('melted'); hEl.style.width = '0px'; return; }
      taglineSeen = true;
      setTimeout(() => { if (el.isConnected) play(); }, 700);
    } else { taglineSeen = false; reset(); }
  }, { threshold: 0.9 });
  requestAnimationFrame(() => io.observe(el));
  return el;
}
