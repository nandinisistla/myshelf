// Product page: the bottle, when you used it, and every ingredient in plain words.
import { verdict, productAllergens, productHelps, isWorking } from './rules.js';
import { h, put, toast, confirmSheet, openSheet, fmtDate, howLong, daysBetween, AREAS, compressImage } from './ui.js';
import { store, mutate, S, onChange, findPhotos } from './store.js';
import { renderBottle, rankImages, imageSrc, scoreImage } from './bottle.js';
import { answerCard, buildAnswer, isLikely } from './answer.js';

const AREA_WORD = { face: 'face', scalp: 'scalp', body: 'body' };
const listWords = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// Two or three plain sentences: is it working for you, what it helps with, anything to watch.
function summaryLines(p, { fine, susFamilies, covered, allergensIn, helps }) {
  const st = store.state;
  const area = AREA_WORD[p.area];
  const out = [];
  if (p.stopped) {
    const after = st.reactions.filter((r) => r.area === p.area && r.date > p.stopped).length;
    const calm = susFamilies.length && after === 0 && daysBetween(p.stopped, st.today) >= 14;
    out.push(['', `You used this from ${fmtDate(p.started)} to ${fmtDate(p.stopped)}.`]);
    if (susFamilies.length) out.push(['warn', `It has ${listWords(susFamilies.map((f) => f.toLowerCase()))}, which was probably bothering your ${area}.`]);
    if (calm && !covered) out.push(['ok', `✓ Your ${area} has been fine since you stopped.`]);
  } else if (susFamilies.length) {
    out.push(['warn', `It has ${listWords(susFamilies.map((f) => f.toLowerCase()))}, which may be what’s bothering your ${area}.`]);
  } else if (covered) {
    // the answer card below says it
  } else if (fine) {
    out.push(['ok', `✓ This works for you. You’ve used it for ${howLong(p.started, st.today)} with no bad days.`]);
  } else {
    out.push(['', `You started this ${p.started === st.today ? 'today' : `${howLong(p.started, st.today)} ago`}. After two weeks with no bad days, MyShelf will mark it safe.`]);
  }
  if (helps.size && !p.stopped) out.push(['', `It helps with your ${listWords([...helps.keys()].map((x) => x.toLowerCase()))}.`]);
  if (allergensIn.length && !susFamilies.length && !covered) {
    out.push(fine
      ? ['', `It has ${listWords(allergensIn.map((x) => x.toLowerCase()))}, which you avoid, but your ${area} is fine with it.`]
      : ['warn', `It has ${listWords(allergensIn.map((x) => x.toLowerCase()))}, which is on your allergen list.`]);
  }
  return out.map(([tone, text]) => h('p', { class: 'p-line ' + tone }, text));
}

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
    const sus = S.suspectsFor(p);
    const hasSuspect = (p.ingredients || []).filter((i) => sus.has(i.family));
    const susFamilies = [...new Set(hasSuspect.map((i) => i.family))];
    const fine = st.insights.fineProductIds.includes(p.id);
    // From your skin profile: allergens in it, and which of your skin problems it helps.
    const allergensIn = productAllergens(p);
    const helps = productHelps(p);
    // If this product is part of your pattern, show the same answer card as For me.
    const fam = st.insights.families.find((f) => isLikely(f) && (f.areaProductIds || f.productIds).includes(p.id));
    const ans = fam ? buildAnswer(fam) : null;
    const covered = new Set(ans ? ans.names : []);


    const routineSel = h('select', { class: 'input', 'aria-label': 'Shelf', onchange: (e) => save({ routine_id: e.target.value ? Number(e.target.value) : null }, 'Moved') },
      h('option', { value: '' }, 'Unsorted'),
      S.shelfOptions(h, p.routine_id));
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
      ? list.map((i) => {
          const v = verdict(i, p);
          const trig = sus.has(i.family);
          const cls = trig || v.flag === 'avoid' ? 'suspect' : v.flag === 'watch' ? 'watch' : v.flag;
          return h('div', { class: `ing ${cls}` },
            h('span', { class: 'mark', 'aria-hidden': 'true' }),
            h('div', null,
              h('div', { class: 'pn' }, i.plain || i.inci),
              i.plain && i.plain !== i.inci ? h('div', { class: 'inci' }, i.inci) : null,
              i.does ? h('div', { class: 'does' }, i.does) : null,
              trig ? h('div', { class: 'note warn' }, `This may be what’s bothering your ${AREA_WORD[p.area]}.`)
                : v.note ? h('div', { class: 'note ' + (v.flag === 'good' ? 'ok' : v.flag === 'avoid' || v.flag === 'watch' ? 'warn' : '') }, (v.flag === 'good' ? '✓ ' : '') + v.note) : null));
        })
      : h('p', { class: 'label-view' }, list.map((i, n) => [h('span', { class: sus.has(i.family) ? 'w' : '' }, i.inci), n < list.length - 1 ? ', ' : '']));

    // Warn when the photo is too small to look sharp.
    const lowRes = h('div');
    const src = imageSrc(p);
    if (src && !p.has_photo) scoreImage(src).then((r) => {
      if (r.width && Math.min(r.width, r.height) < 600) {
        lowRes.replaceChildren(h('div', { class: 'callout', style: 'display:flex;justify-content:space-between;align-items:center;gap:10px' },
          h('span', null, 'This photo is a bit blurry.'),
          h('button', { class: 'btn small', onclick: () => pickPicture(p, fileInput) }, 'Find a sharper one')));
      }
    });

    return [
      h('div', { class: 'p-hero' },
        h('div', { class: 'p-tile' }, h('span', { class: 'floor', 'aria-hidden': 'true' }), renderBottle(p, { big: true, showName: false })),
        h('div', { class: 'p-name' }, p.name),
        h('div', { class: 'p-meta' }, [p.brand, AREAS[p.area]].filter(Boolean).join(' · ')),
        h('div', { class: 'p-lines' }, summaryLines(p, { fine, susFamilies: susFamilies.filter((x) => !covered.has(x)), covered: covered.size > 0, allergensIn, helps }))),
      ans ? answerCard(ans, { variant: 'product' }) : null,
      lowRes,
      controls,
      h('div', { class: 'easier' }, h('h3', null, 'What’s inside'),
        h('div', { class: 'seg', role: 'tablist' },
          h('button', { class: mode === 'plain' ? 'on' : '', onclick: () => { mode = 'plain'; render(); } }, 'Plain words'),
          h('button', { class: mode === 'label' ? 'on' : '', onclick: () => { mode = 'label'; render(); } }, 'Label'))),
      list.length ? ingList : h('div', { class: 'ai-note' }, 'No ingredient list yet. Tap “Edit list” to paste one.'),
      h('div', { class: 'sources' },
        h('div', null, p.confidence === 'high' && !(p.sources || []).length ? 'Ingredients from the product label.' : 'Ingredients found online by AI. It can make mistakes, so check the label if something matters.'),
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
    const credit = (o) => (o.source === 'Open Beauty Facts' ? 'Photo: Open Beauty Facts (CC BY-SA)' : `Image: ${o.source}`);
    let opts = [...(p.image_options || [])];
    const choose = async (o) => {
      try {
        if (p.has_photo) await mutate('product.photo', { id: p.id, data: null });
        await mutate('product.update', { id: p.id, patch: { image_url: o ? o.url : null, image_credit: o ? credit(o) : null, image_locked: true } });
        pk.close(); toast('Picture updated');
      } catch (e) { toast(e.message); }
    };
    const grid = h('div', { class: 'picker wrap' });
    const status = h('p', { class: 'muted small' });
    const draw = () => put(grid,
      opts.map((o, i) => h('button', { class: 'pick' + (!p.has_photo && p.image_url === o.url ? ' on' : ''), onclick: () => choose(o) },
        h('img', { src: `/api/lookup?img=${encodeURIComponent(o.url)}`, alt: '', loading: 'lazy', onerror: (e) => e.target.closest('.pick').remove() }),
        h('span', null, i === 0 && o.score !== undefined ? 'Best match' : o.source))),
      h('button', { class: 'pick' + (p.has_photo ? ' on' : ''), onclick: () => { pk.close(); fileInput.click(); } },
        h('div', { class: 'pick-icon' }, '+'), h('span', null, p.has_photo ? 'New photo' : 'My photo')));
    const rank = async () => { opts = await rankImages(opts); draw(); };
    const more = h('button', { class: 'btn small', onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      status.textContent = 'Looking for cleaner photos on the brand’s site and big retailers…';
      try {
        opts = await findPhotos(p.id);
        status.textContent = opts.length ? 'Sorted with the cleanest, sharpest photo first.' : 'No other photos found. Try your own photo.';
        await rank();
      } catch (err) { status.textContent = err.message; }
      btn.disabled = false;
    } }, 'Find better photos');
    const pk = openSheet({
      title: 'Change picture',
      body: [
        h('p', { class: 'muted' }, opts.length ? 'Pick the cleanest photo. The best match is first.' : 'No photos yet for this product.'),
        grid, h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap' }, more), status,
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'link', onclick: () => choose(null) }, 'Use the simple placeholder instead')),
      ],
    });
    draw();
    rank();
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
