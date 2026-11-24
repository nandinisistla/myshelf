// Product page: the bottle, when you used it, and every ingredient in plain words.
import { h, toast, confirmSheet, openSheet, fmtDate, howLong, AREAS, compressImage } from './ui.js';
import { store, mutate, S, onChange } from './store.js';
import { renderBottle } from './bottle.js';

export function openProduct(prod) {
  let mode = 'plain';
  let editing = false;
  const sh = openSheet({ title: '', body: [], full: true, onClose: () => off() });
  const off = onChange(() => { if (!editing) render(); });

  function render() {
    const p = S.product(prod.id);
    if (!p) { sh.close(); return; }
    sh.setTitle(p.brand || 'Product');
    sh.setBody(editing ? editView(p) : mainView(p));
  }

  function mainView(p) {
    const st = store.state;
    const sus = S.suspects();
    const hasSuspect = (p.ingredients || []).filter((i) => sus.has(i.family));
    const susFamilies = [...new Set(hasSuspect.map((i) => i.family))];
    const fine = st.insights.fineProductIds.includes(p.id);

    const status = p.stopped
      ? h('span', { class: 'pill' }, `Used ${fmtDate(p.started)} – ${fmtDate(p.stopped)}`)
      : h('span', { class: 'pill dark' }, `On your shelf · ${howLong(p.started, st.today)}`);

    const routineSel = h('select', { class: 'input', 'aria-label': 'Shelf', onchange: (e) => save({ routine_id: e.target.value ? Number(e.target.value) : null }, 'Moved') },
      h('option', { value: '' }, 'Unsorted'),
      st.routines.map((r) => h('option', { value: r.id, selected: r.id === p.routine_id }, r.name)));
    const areaSel = h('select', { class: 'input', 'aria-label': 'Where you use it', onchange: (e) => save({ area: e.target.value }, 'Updated') },
      Object.entries(AREAS).map(([k, v]) => h('option', { value: k, selected: k === p.area }, v)));
    const startInput = h('input', { class: 'input', type: 'date', value: p.started || '', max: st.today, 'aria-label': 'Started using',
      onchange: (e) => e.target.value && save({ started: e.target.value }, 'Start date saved') });
    const stopInput = p.stopped ? h('input', { class: 'input', type: 'date', value: p.stopped, max: st.today, min: p.started, 'aria-label': 'Stopped using',
      onchange: (e) => e.target.value && save({ stopped: e.target.value }, 'Stop date saved') }) : null;

    const fileInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none', onchange: (e) => uploadPhoto(p, e.target.files[0]) });

    const controls = h('div', { class: 'p-controls' },
      h('div', { class: 'row' },
        h('div', null, h('label', { class: 'f' }, 'Shelf'), routineSel),
        h('div', null, h('label', { class: 'f' }, 'Used on'), areaSel)),
      h('div', { class: 'row' },
        h('div', null, h('label', { class: 'f' }, 'Started using'), startInput),
        stopInput ? h('div', null, h('label', { class: 'f' }, 'Stopped'), stopInput) : h('div')),
      h('div', { class: 'p-actions' },
        p.stopped
          ? h('button', { class: 'btn', onclick: () => act('product.restart', 'Back on your shelf') }, 'Put back on shelf')
          : h('button', { class: 'btn', onclick: () => act('product.stop', 'Moved off your shelf · kept in history') }, 'Stop using'),
        h('button', { class: 'btn', onclick: () => pickPicture(p, fileInput) }, 'Change picture'),
        h('button', { class: 'btn ghost danger', onclick: () => remove(p) }, 'Delete'),
        fileInput));

    const list = p.ingredients || [];
    const ingList = mode === 'plain'
      ? list.map((i) => h('div', { class: `ing ${sus.has(i.family) ? 'suspect' : i.flag}` },
          h('span', { class: 'mark', 'aria-hidden': 'true' }),
          h('div', null,
            h('div', { class: 'pn' }, i.plain || i.inci),
            i.plain && i.plain !== i.inci ? h('div', { class: 'inci' }, i.inci) : null,
            i.does ? h('div', { class: 'does' }, i.does) : null,
            i.for_you ? h('div', { class: 'foryou' }, h('b', null, 'For you: '), i.for_you) : null,
            h('div', { class: 'fam' }, h('span', { class: 'pill' + (sus.has(i.family) ? ' amber' : '') }, i.family),
              sus.has(i.family) ? h('span', { class: 'pill amber', style: 'margin-left:6px' }, 'possible trigger') : null))))
      : h('p', { class: 'label-view' }, list.map((i, n) => [h('span', { class: sus.has(i.family) ? 'w' : '' }, i.inci), n < list.length - 1 ? ', ' : '']));

    return [
      h('div', { class: 'p-hero' },
        h('div', { class: 'p-tile' }, h('span', { class: 'floor', 'aria-hidden': 'true' }), renderBottle(p, { big: true, showName: false })),
        h('div', { class: 'hint' }, 'Tap or drag the bottle to turn it'),
        h('div', { class: 'p-name' }, p.name),
        h('div', { class: 'p-meta' }, [p.brand, AREAS[p.area]].filter(Boolean).join(' · ')),
        h('div', { class: 'p-status' }, status,
          fine ? h('span', { class: 'pill ok' }, 'Seems fine for you') : null,
          susFamilies.length ? h('span', { class: 'pill amber' }, 'Has a possible trigger') : null)),
      controls,
      h('div', { class: 'easier' }, h('h3', null, "Let's make it easier"),
        h('div', { class: 'seg', role: 'tablist' },
          h('button', { class: mode === 'plain' ? 'on' : '', onclick: () => { mode = 'plain'; render(); } }, 'Plain words'),
          h('button', { class: mode === 'label' ? 'on' : '', onclick: () => { mode = 'label'; render(); } }, 'Label'))),
      p.summary ? h('p', { class: 'summary' }, p.summary) : null,
      susFamilies.length ? h('div', { class: 'callout' }, `Contains ${susFamilies.slice(0, 2).join(' and ').toLowerCase()}${susFamilies.length > 2 ? ` (+${susFamilies.length - 2} more)` : ''}, which keeps showing up before your bad days. See “For me” for the evidence.`) : null,
      list.length ? ingList : h('div', { class: 'ai-note' }, 'No ingredient list yet. Tap “Edit list” to paste one.'),
      h('div', { class: 'sources' },
        h('div', null, `Found by AI${p.confidence ? ` · confidence: ${p.confidence}` : ''}. AI can make mistakes, so check anything important.`),
        p.ai_note ? h('div', { style: 'margin-top:4px' }, p.ai_note) : null,
        (p.sources || []).map((src) => h('a', { href: src.url, target: '_blank', rel: 'noopener' }, src.title || src.url)),
        p.image_credit ? h('div', { style: 'margin-top:6px' }, p.image_credit) : null,
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn small', onclick: () => { editing = true; render(); } }, 'Edit list'))),
    ];
  }

  function editView(p) {
    const rows = (p.ingredients || []).map((i) => ({ ...i }));
    const listEl = h('div');
    const paste = h('textarea', { class: 'input', placeholder: 'Or paste the whole ingredient list here, separated by commas' });
    const draw = () => listEl.replaceChildren(...rows.map((r, n) => h('div', { class: 'edit-row' },
      h('input', { class: 'input', value: r.inci, 'aria-label': 'Label name', oninput: (e) => { r.inci = e.target.value; } }),
      h('input', { class: 'input', value: r.plain, 'aria-label': 'Plain name', oninput: (e) => { r.plain = e.target.value; } }),
      h('button', { class: 'x', 'aria-label': `Remove ${r.inci}`, onclick: () => { rows.splice(n, 1); draw(); } }, '✕'))));
    draw();
    const saveEdit = async () => {
      let ingredients = rows.filter((r) => r.inci.trim());
      if (paste.value.trim()) {
        ingredients = paste.value.split(/,(?![^()]*\))|\n|;/).map((t) => t.trim()).filter(Boolean)
          .map((inci) => ({ inci, plain: inci, family: 'Other', does: '', for_you: '', flag: 'neutral' }));
      }
      try { await mutate('product.update', { id: p.id, patch: { ingredients } }); editing = false; render(); toast('Ingredient list saved'); }
      catch (e) { toast(e.message); }
    };
    return [
      h('p', { class: 'muted' }, 'Fix anything the AI got wrong. Left: name on the label. Right: plain name.'),
      h('div', { class: 'edit-row muted small' }, h('div', null, 'Label name'), h('div', null, 'Plain name'), h('div')),
      listEl,
      h('button', { class: 'btn small', onclick: () => { rows.push({ inci: '', plain: '', family: 'Other', does: '', for_you: '', flag: 'neutral' }); draw(); } }, '+ Add ingredient'),
      h('label', { class: 'f' }, 'Replace the whole list'), paste,
      h('div', { class: 'p-actions' },
        h('button', { class: 'btn primary', onclick: saveEdit }, 'Save list'),
        h('button', { class: 'btn', onclick: () => { editing = false; render(); } }, 'Cancel')),
    ];
  }

  function pickPicture(p, fileInput) {
    const opts = p.image_options || [];
    const credit = (o) => (o.source === 'Open Beauty Facts' ? 'Photo: Open Beauty Facts (CC BY-SA)' : `Image: ${o.source}`);
    const choose = async (o) => {
      try {
        if (p.has_photo) await mutate('product.photo', { id: p.id, data: null });
        await mutate('product.update', { id: p.id, patch: { image_url: o ? o.url : null, image_credit: o ? credit(o) : null } });
        pk.close(); toast('Picture updated');
      } catch (e) { toast(e.message); }
    };
    const pk = openSheet({
      title: 'Change picture',
      body: [
        opts.length ? h('p', { class: 'muted' }, 'Pictures found online for this product:') : h('p', { class: 'muted' }, 'No pictures were found online for this product. Add your own photo.'),
        h('div', { class: 'picker' },
          opts.map((o) => h('button', { class: 'pick' + (!p.has_photo && p.image_url === o.url ? ' on' : ''), onclick: () => choose(o) },
            h('img', { src: `/api/lookup?img=${encodeURIComponent(o.url)}`, alt: '', loading: 'lazy', onerror: (e) => e.target.closest('.pick').remove() }),
            h('span', null, o.source))),
          h('button', { class: 'pick' + (p.has_photo ? ' on' : ''), onclick: () => { pk.close(); fileInput.click(); } },
            h('div', { class: 'pick-icon' }, '+'), h('span', null, p.has_photo ? 'New photo' : 'My photo'))),
        h('div', { style: 'margin-top:16px' }, h('button', { class: 'link', onclick: () => choose(null) }, 'Use the simple placeholder instead')),
      ],
    });
  }

  async function save(patch, msg) {
    try { await mutate('product.update', { id: prod.id, patch }); toast(msg); } catch (e) { toast(e.message); }
  }
  async function act(action, msg) {
    try { await mutate(action, { id: prod.id }); toast(msg); } catch (e) { toast(e.message); }
  }
  async function remove(p) {
    const ok = await confirmSheet(`Delete ${p.name} for good? If you just stopped using it, use “Stop using” instead so it stays in your history.`, 'Delete', true);
    if (!ok) return;
    try { await mutate('product.delete', { id: p.id }); sh.close(); toast('Deleted'); } catch (e) { toast(e.message); }
  }
  async function uploadPhoto(p, file) {
    if (!file) return;
    try {
      toast('Saving photo…');
      const data = await compressImage(file, 900, 0.8);
      await mutate('product.photo', { id: p.id, data });
      toast('Photo saved');
    } catch (e) { toast(e.message); }
  }

  render();
}
