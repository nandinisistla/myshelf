// "Rough skin day?": the only thing you ever need to log.
import { h, toast, openSheet, AREAS, SEVERITY, todayISO, fmtDate } from './ui.js';
import { mutate, store } from './store.js';

export function openBadDay(existing = null) {
  const d = existing ? { ...existing } : { date: todayISO(), area: 'face', severity: 2, note: '' };
  const err = h('div', { class: 'err' });
  const date = h('input', { class: 'input', type: 'date', value: d.date, max: store.state.today, onchange: (e) => { d.date = e.target.value; } });
  const chipGroup = (opts, key, label) => {
    const wrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label });
    const draw = () => wrap.replaceChildren(...Object.entries(opts).map(([k, v]) =>
      h('button', { class: 'chip' + (String(d[key]) === String(k) ? ' on' : ''), role: 'radio', 'aria-checked': String(String(d[key]) === String(k)),
        onclick: () => { d[key] = key === 'severity' ? Number(k) : k; draw(); warn(); } }, v)));
    draw();
    return wrap;
  };
  const warning = h('div');
  const warn = () => warning.replaceChildren(d.severity === 3
    ? h('div', { class: 'callout' }, 'If you have swelling, blistering or trouble breathing, get medical help right away.') : '');
  const note = h('textarea', { class: 'input', placeholder: 'If you’d like, how is it feeling? (itchy, red, bumpy, a breakout…)', value: d.note || '', oninput: (e) => { d.note = e.target.value; } });

  const save = async () => {
    if (!d.date) { err.textContent = 'Pick a date.'; return; }
    try {
      if (existing) await mutate('reaction.update', { id: existing.id, patch: d });
      else await mutate('reaction.add', d);
      sh.close();
      toast(existing ? 'Saved' : 'Got it. Be gentle with your skin today.');
    } catch (e) { err.textContent = e.message; }
  };
  const sh = openSheet({
    title: existing ? 'Edit this day' : 'Rough skin day?',
    body: [
      existing ? null : h('p', { class: 'muted' }, 'Sorry it’s a rough one. Tell us what’s going on and we’ll look for what might be behind it. You don’t need to list your products, your shelf already knows.'),
      h('label', { class: 'f' }, 'When?'), date,
      h('label', { class: 'f' }, 'Where?'), chipGroup(AREAS, 'area', 'Where'),
      h('label', { class: 'f' }, 'How bad?'), chipGroup(SEVERITY, 'severity', 'How bad'),
      warning,
      h('label', { class: 'f' }, 'Note'), note, err,
    ],
    foot: [
      existing ? h('button', { class: 'btn danger block', onclick: async () => {
        try { await mutate('reaction.delete', { id: existing.id }); sh.close(); toast(`Deleted bad day · ${fmtDate(existing.date)}`); } catch (e) { err.textContent = e.message; }
      } }, 'Delete') : null,
      h('button', { class: 'btn primary block', onclick: save }, existing ? 'Save' : 'Save this day'),
    ].filter(Boolean),
  });
  warn();
}
