// Skin profile (used to explain ingredients "for you") and owner tools.
import { h, toast, openSheet, confirmSheet } from './ui.js';
import { store, mutate, admin } from './store.js';

const SKIN = ['Dry', 'Oily', 'Combination', 'Normal'];
export const PROBLEMS = ['Redness', 'Dark spots', 'Breakouts', 'Sensitivity', 'Dryness', 'Oiliness', 'Uneven texture', 'Itchy skin', 'Dandruff', 'Hair thinning'];
export const ALLERGENS = ['Fragrance', 'Essential oils', 'Drying alcohol', 'Sulfates', 'Parabens', 'Coconut oil', 'Silicones', 'Lanolin'];

export const initials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

function profileForm(onDone, firstTime = false) {
  const p = store.state.profile || {};
  const d = {
    name: p.name || '', skin_type: p.skin_type || '', goals: p.goals || '',
    problems: [...(p.problems || [])], allergens: [...(p.allergens || (p.avoid ? String(p.avoid).split(',').map((x) => x.trim()).filter(Boolean) : []))],
  };
  const name = h('input', { class: 'input', value: d.name, placeholder: 'Your name', autocomplete: 'name', oninput: (e) => { d.name = e.target.value; drawCard(); } });
  const card = h('div', { class: 'pf-card' });
  const drawCard = () => card.replaceChildren(
    h('span', { class: 'pf-avatar', 'aria-hidden': 'true' }, initials(d.name) || '·'),
    h('div', null, h('div', { class: 'pf-name' }, d.name || 'Your name'),
      h('div', { class: 'pf-sub' }, [d.skin_type ? `${d.skin_type} skin` : null, ...d.problems.slice(0, 3)].filter(Boolean).join(' · ') || 'Fill in your skin profile below')));

  const single = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Skin type' });
  const drawSingle = () => single.replaceChildren(...SKIN.map((t) =>
    h('button', { class: 'chip' + (d.skin_type === t ? ' on' : ''), role: 'radio', 'aria-checked': String(d.skin_type === t), onclick: () => { d.skin_type = t; drawSingle(); drawCard(); } }, t)));

  const multi = (key, options, label) => {
    const box = h('div', { class: 'chips', role: 'group', 'aria-label': label });
    const draw = () => box.replaceChildren(...[...new Set([...options, ...d[key]])].map((t) => {
      const on = d[key].includes(t);
      return h('button', { class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => {
        d[key] = on ? d[key].filter((x) => x !== t) : [...d[key], t]; draw(); drawCard();
      } }, t);
    }));
    draw();
    return { box, draw };
  };
  const probs = multi('problems', PROBLEMS, 'Skin problems');
  const alls = multi('allergens', ALLERGENS, 'Allergens');
  const other = h('input', { class: 'input', placeholder: 'Something else? Type it and press Enter', onkeydown: (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    d.allergens = [...new Set([...d.allergens, e.target.value.trim()])]; e.target.value = ''; alls.draw();
  } });
  const goals = h('input', { class: 'input', value: d.goals, placeholder: 'e.g. fade dark spots, calm redness, thicker hair', oninput: (e) => { d.goals = e.target.value; } });
  const err = h('div', { class: 'err' });
  const save = async () => {
    try { await mutate('profile.set', d); toast('Profile saved. Your shelf, For me and History are updated.'); onDone(); } catch (e) { err.textContent = e.message; }
  };
  drawCard(); drawSingle();
  return {
    body: [
      card,
      firstTime ? h('p', { class: 'muted' }, 'A few quick questions so every ingredient can be explained for your skin. You can change this anytime.') : null,
      h('label', { class: 'f' }, 'Name'), name,
      h('label', { class: 'f' }, 'Skin type'), single,
      h('label', { class: 'f' }, 'Skin problems'), probs.box,
      h('label', { class: 'f' }, 'Allergens and things you react to'), alls.box, other,
      h('label', { class: 'f' }, 'What you want from your skincare'), goals, err,
    ],
    save,
  };
}

export function openOnboarding() {
  let sh;
  const form = profileForm(() => sh.close(), true);
  sh = openSheet({
    title: 'Welcome to MyShelf',
    body: form.body,
    foot: [h('button', { class: 'btn block', onclick: () => sh.close() }, 'Skip'), h('button', { class: 'btn primary block', onclick: form.save }, 'Save')],
  });
}

export function openSettings() {
  let sh;
  const form = profileForm(() => {}, false);
  const err = h('div', { class: 'err' });
  sh = openSheet({
    title: 'Your skin profile',
    full: true,
    body: [
      ...form.body,
      h('button', { class: 'btn primary', style: 'margin-top:14px', onclick: form.save }, 'Save profile'),
      h('div', { class: 'section-h' }, 'About the AI'),
      h('p', { class: 'muted small' }, 'MyShelf uses Claude to find ingredient lists, explain them in plain words and run the chat. The pattern counts themselves are plain math, so they’re exact. Everything the AI adds is labelled and editable.'),
      h('p', { class: 'muted small' }, store.state.aiEnabled ? 'AI is on.' : 'AI is off: add ANTHROPIC_API_KEY in Vercel to turn it on.'),
      h('div', { class: 'section-h' }, 'Your data'),
      h('p', { class: 'muted small' }, 'Removes every product, bad day, photo, chat and your profile, and starts MyShelf empty. This can’t be undone.'),
      err,
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!(await confirmSheet('Remove all data from MyShelf? Every product, bad day, photo, chat and your profile will be deleted. This can’t be undone.', 'Remove all data', true))) return;
        try { await admin('data.wipe', ''); sh.close(); toast('All data removed'); } catch (e) { err.textContent = e.message; }
      } }, 'Remove all data'),
    ],
  });
}
