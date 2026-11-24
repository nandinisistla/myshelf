// Add a product: type a name, pick the match, AI finds the ingredients, you check, done.
import { h, put, s, toast, openSheet, AREAS, todayISO } from './ui.js';
import { store, mutate, searchProducts, enrich } from './store.js';
import { renderBottle } from './bottle.js';

export function openAdd({ routineId = null, prefill = '' } = {}) {
  const sh = openSheet({ title: 'Add a product', body: [], foot: [], full: true });
  let searchTimer;
  let lastQuery = '';

  // ---------- step 1: search ----------
  function stepSearch() {
    sh.setTitle('Add a product');
    sh.setFoot();
    const input = h('input', { class: 'input', placeholder: 'Type a product name, e.g. anua niacinamide', value: prefill, 'aria-label': 'Product name', autocomplete: 'off' });
    const results = h('div', { 'aria-live': 'polite' });
    const box = h('div', { class: 'search-box' },
      s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('circle', { cx: 11, cy: 11, r: 6.5 }), s('path', { d: 'M16 16l4 4' })), input);

    const showResults = (list, q) => {
      put(results,
        ...list.map((r) => h('button', { class: 'result', onclick: () => stepWorking({ name: r.name, brand: r.brand, image: r.image, ingredientsText: r.ingredientsText }) },
          h('div', { class: 'thumb' }, r.thumb ? h('img', { src: `/api/lookup?img=${encodeURIComponent(r.thumb)}`, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() }) : null),
          h('div', null, h('div', { class: 'rn' }, r.name), h('div', { class: 'rb' }, r.brand || 'Open Beauty Facts')))),
        q ? h('button', { class: 'result', onclick: () => stepWorking({ name: q }) },
          h('div', { class: 'thumb' }, '✦'),
          h('div', null, h('div', { class: 'rn' }, list.length ? 'Not the right one?' : `Find “${q}” with AI`),
            h('div', { class: 'rb' }, `Let AI search the web for “${q}”`))) : null);
    };

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      lastQuery = q;
      if (q.length < 2) { results.replaceChildren(); return; }
      results.replaceChildren(h('div', { class: 'muted small', style: 'padding:12px 2px' }, h('span', { class: 'spinner' }), '  Searching…'));
      searchTimer = setTimeout(async () => {
        try {
          const { results: list } = await searchProducts(q);
          if (lastQuery === q) showResults(list, q);
        } catch { if (lastQuery === q) showResults([], q); }
      }, 380);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim().length > 1) stepWorking({ name: input.value.trim() }); });

    sh.setBody(
      h('p', { class: 'muted', style: 'margin-top:12px' }, 'Just type the name. The app finds the picture and the full ingredient list for you.'),
      box, results,
      h('p', { class: 'muted small', style: 'margin-top:22px' }, 'Tip: you can also ask the AI chat, e.g. “add my SKIN1004 centella sunscreen”.'));
    setTimeout(() => { input.focus(); if (prefill) input.dispatchEvent(new Event('input')); }, 60);
  }

  // ---------- step 2: AI is working ----------
  async function stepWorking(pick) {
    sh.setTitle('Finding ingredients');
    const steps = ['Searching the web for the label', 'Reading the ingredient list', 'Explaining it for your skin'];
    const lis = steps.map((t) => h('li', null, h('i'), t));
    sh.setBody(h('div', { class: 'working' },
      h('div', { class: 'p-name', style: 'margin:0' }, pick.name),
      pick.brand ? h('div', { class: 'p-meta' }, pick.brand) : null,
      h('ul', { class: 'steps' }, lis)));
    let n = 0;
    lis[0].className = 'on';
    const tick = setInterval(() => {
      if (n < lis.length - 1) { lis[n].className = 'done'; n++; lis[n].className = 'on'; }
    }, 3500);
    try {
      const info = await enrich({ name: pick.name, brand: pick.brand, ingredientsText: pick.ingredientsText });
      clearInterval(tick);
      stepReview({ ...info, image_url: pick.image || null });
    } catch (e) {
      clearInterval(tick);
      stepFailed(pick, e.message);
    }
  }

  function stepFailed(pick, msg) {
    sh.setTitle('Couldn’t finish');
    const paste = h('textarea', { class: 'input', placeholder: 'Paste the ingredient list from the box or website (optional)' });
    sh.setBody(
      h('p', { class: 'err' }, msg),
      h('p', { class: 'muted' }, 'You can still add it now and fix the ingredients later.'),
      paste);
    sh.setFoot(
      h('button', { class: 'btn block', onclick: () => stepSearch() }, 'Back'),
      h('button', { class: 'btn primary block', onclick: () => {
        const ingredients = paste.value.split(/,(?![^()]*\))|\n|;/).map((t) => t.trim()).filter(Boolean)
          .map((inci) => ({ inci, plain: inci, family: 'Other', does: '', for_you: '', flag: 'neutral' }));
        stepReview({ name: pick.name, brand: pick.brand || '', area: 'face', kind: 'bottle', ingredients, sources: [], confidence: 'low', image_url: pick.image || null });
      } }, 'Continue'));
  }

  // ---------- step 3: check and save ----------
  function stepReview(info) {
    sh.setTitle('Check and add');
    const st = store.state;
    const draft = { ...info, routine_id: routineId || guessRoutine(info.area), started: todayISO() };
    const preview = h('div', { class: 'p-hero' });
    const drawPreview = () => preview.replaceChildren(
      renderBottle({ ...draft, id: -1, ingredients: draft.ingredients || [] }, { big: true, showName: false }),
      h('div', { class: 'hint' }, 'Tap the bottle to see the back'));
    drawPreview();

    const name = h('input', { class: 'input', value: draft.name, oninput: (e) => { draft.name = e.target.value; } });
    const brand = h('input', { class: 'input', value: draft.brand || '', oninput: (e) => { draft.brand = e.target.value; } });
    const area = h('select', { class: 'input', onchange: (e) => { draft.area = e.target.value; } },
      Object.entries(AREAS).map(([k, v]) => h('option', { value: k, selected: k === draft.area }, v)));
    const shelf = h('select', { class: 'input', onchange: (e) => { draft.routine_id = e.target.value ? Number(e.target.value) : null; } },
      h('option', { value: '' }, 'Unsorted'),
      st.routines.map((r) => h('option', { value: r.id, selected: r.id === draft.routine_id }, r.name)));
    const started = h('input', { class: 'input', type: 'date', value: draft.started, max: st.today, oninput: (e) => { draft.started = e.target.value; } });

    const ings = draft.ingredients || [];
    const ingList = h('div');
    const drawIngs = () => ingList.replaceChildren(...ings.map((i, n) => h('div', { class: 'ing ' + i.flag },
      h('span', { class: 'mark', 'aria-hidden': 'true' }),
      h('div', { style: 'display:flex;justify-content:space-between;gap:8px' },
        h('div', null, h('div', { class: 'pn' }, i.plain), i.plain !== i.inci ? h('div', { class: 'inci' }, i.inci) : null,
          i.does ? h('div', { class: 'does' }, i.does) : null),
        h('button', { class: 'x', style: 'height:32px;width:32px;flex:0 0 auto', 'aria-label': `Remove ${i.inci}`, onclick: () => { ings.splice(n, 1); drawIngs(); } }, '✕')))));
    drawIngs();

    const err = h('div', { class: 'err' });
    sh.setBody(
      preview,
      h('div', { class: 'ai-note' },
        h('b', null, 'Check this before saving. '),
        `AI found ${ings.length} ingredient${ings.length === 1 ? '' : 's'}${info.confidence ? ` (confidence: ${info.confidence})` : ''}. It can make mistakes, so remove anything that looks wrong.`,
        info.ai_note ? h('div', { style: 'margin-top:4px' }, info.ai_note) : null,
        (info.sources || []).length ? h('div', { class: 'sources', style: 'margin-top:6px' }, 'Sources:',
          info.sources.map((src) => h('a', { href: src.url, target: '_blank', rel: 'noopener' }, src.title || src.url))) : null),
      h('div', { class: 'row' }, h('div', null, h('label', { class: 'f' }, 'Name'), name), h('div', null, h('label', { class: 'f' }, 'Brand'), brand)),
      h('div', { class: 'row' }, h('div', null, h('label', { class: 'f' }, 'Shelf'), shelf), h('div', null, h('label', { class: 'f' }, 'Used on'), area)),
      h('label', { class: 'f' }, 'When did you start using it?'), started,
      info.summary ? h('p', { class: 'summary', style: 'margin-top:16px' }, info.summary) : null,
      h('div', { class: 'section-h' }, 'Ingredients'), ingList, err);
    sh.setFoot(
      h('button', { class: 'btn block', onclick: () => stepSearch() }, 'Back'),
      h('button', { class: 'btn primary block', onclick: async (e) => {
        if (!draft.name.trim()) { err.textContent = 'Add a name.'; return; }
        e.currentTarget.disabled = true;
        try {
          await mutate('product.add', { ...draft, ingredients: ings, image_credit: draft.image_url ? 'Photo: Open Beauty Facts (CC BY-SA)' : null });
          sh.close();
          const shelfName = store.state.routines.find((r) => r.id === draft.routine_id)?.name;
          toast(`Added to ${shelfName || 'your shelf'}`);
        } catch (ex) { err.textContent = ex.message; e.currentTarget.disabled = false; }
      } }, 'Add to shelf'));
  }

  function guessRoutine(area) {
    const rs = store.state.routines;
    const find = (re) => rs.find((r) => re.test(r.name))?.id;
    if (area === 'scalp') return find(/hair|scalp/i) || null;
    if (area === 'body') return find(/body|shower/i) || null;
    return find(/morning|am|day/i) || null;
  }

  stepSearch();
}
