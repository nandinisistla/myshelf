// Home: My Shelf. Each shelf is a routine you can name.
import { h, put, s, toast, confirmSheet, openSheet } from './ui.js';
import { store, mutate } from './store.js';
import { renderBottle, networkMotif } from './bottle.js';
import { openProduct } from './product.js';
import { openAdd } from './add.js';
import { openSettings } from './settings.js';

export function renderShelf(view) {
  const st = store.state;
  const onShelf = st.products.filter((p) => !p.stopped);
  const past = st.products.filter((p) => p.stopped).sort((a, b) => (b.stopped || '').localeCompare(a.stopped || ''));

  const header = h('div', { class: 'top' },
    h('h1', { class: 'wordmark' }, 'My', 'S', h('span', { class: 'h' }, 'h'), 'elf'),
    h('div', { class: 'h-row' },
      h('button', { class: 'icon-btn', 'aria-label': 'Settings and skin profile', onclick: openSettings },
        s('svg', { viewBox: '0 0 24 24' }, s('circle', { cx: 12, cy: 8, r: 3.5 }), s('path', { d: 'M5 20c1-4 4-6 7-6s6 2 7 6' }))),
      h('button', { class: 'btn primary', onclick: () => openAdd() }, '+ Add')));

  const total = onShelf.length;
  const sub = h('p', { class: 'sub' }, total
    ? `${total} product${total === 1 ? '' : 's'} on your shelf · tap one to see what's inside`
    : 'Your shelf is empty. Add your first product and the app finds its ingredients for you.');

  const shelves = st.routines.map((r) => shelfBlock(r, onShelf.filter((p) => p.routine_id === r.id)));
  const unsorted = onShelf.filter((p) => !p.routine_id || !st.routines.some((r) => r.id === p.routine_id));
  if (unsorted.length) shelves.push(shelfBlock({ id: null, name: 'Unsorted' }, unsorted));

  const addShelf = h('button', { class: 'btn ghost small', style: 'margin-top:18px', onclick: () => newShelf() }, '+ New shelf');

  const pastBlock = past.length ? h('details', { class: 'past' },
    h('summary', null, `No longer using (${past.length}) ▾`),
    h('div', { class: 'shelf-row', style: 'min-height:140px' }, past.map((p) => renderBottle(p, { onOpen: openProduct }))),
    h('div', { class: 'plank' })) : null;

  put(view, header, sub, ...shelves, addShelf, pastBlock, networkMotif());
}

function shelfBlock(r, products) {
  const nameBtn = r.id
    ? h('button', { class: 'shelf-name', title: 'Rename this shelf', onclick: (e) => renameInline(e.currentTarget, r) }, r.name)
    : h('span', { class: 'shelf-name' }, r.name);
  const menu = r.id ? h('button', { class: 'btn ghost small', 'aria-label': `Remove shelf ${r.name}`, onclick: () => removeShelf(r) }, '···') : null;
  return h('section', { class: 'shelf', 'aria-label': `${r.name} shelf` },
    h('div', { class: 'shelf-head' },
      h('div', { class: 'h-row' }, nameBtn, h('span', { class: 'shelf-count' }, products.length ? `· ${products.length}` : '')),
      menu),
    h('div', { class: 'shelf-row' },
      products.map((p) => renderBottle(p, { onOpen: openProduct })),
      h('button', { class: 'ghost-slot', 'aria-label': `Add a product to ${r.name}`, onclick: () => openAdd({ routineId: r.id }) }, '+')),
    h('div', { class: 'plank' }));
}

function renameInline(btn, r) {
  const input = h('input', { class: 'shelf-name-input', value: r.name, 'aria-label': 'Shelf name', maxlength: 40 });
  btn.replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const save = async () => {
    if (done) return; done = true;
    const name = input.value.trim();
    if (name && name !== r.name) {
      try { await mutate('routine.rename', { id: r.id, name }); toast('Shelf renamed'); }
      catch (e) { toast(e.message); }
    } else input.replaceWith(btn);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { done = true; input.replaceWith(btn); } });
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
