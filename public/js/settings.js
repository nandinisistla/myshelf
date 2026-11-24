// Skin profile (used to explain ingredients "for you") and owner tools.
import { h, toast, openSheet, confirmSheet } from './ui.js';
import { store, mutate, admin } from './store.js';

const SKIN = ['Dry', 'Oily', 'Combination', 'Normal', 'Sensitive'];

function profileForm(onDone, firstTime = false) {
  const p = store.state.profile || {};
  const d = { skin_type: p.skin_type || '', goals: p.goals || '', avoid: p.avoid || '' };
  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Skin type' });
  const drawChips = () => chips.replaceChildren(...SKIN.map((t) =>
    h('button', { class: 'chip' + (d.skin_type === t ? ' on' : ''), role: 'radio', 'aria-checked': String(d.skin_type === t), onclick: () => { d.skin_type = t; drawChips(); } }, t)));
  drawChips();
  const goals = h('input', { class: 'input', value: d.goals, placeholder: 'e.g. fade dark spots, calm redness, healthy scalp', oninput: (e) => { d.goals = e.target.value; } });
  const avoid = h('input', { class: 'input', value: d.avoid, placeholder: 'e.g. fragrance, coconut oil (leave empty if unsure)', oninput: (e) => { d.avoid = e.target.value; } });
  const err = h('div', { class: 'err' });
  const save = async () => {
    try { await mutate('profile.set', d); toast('Profile saved'); onDone(); } catch (e) { err.textContent = e.message; }
  };
  return {
    body: [
      firstTime ? h('p', { class: 'muted' }, 'Three quick questions so every ingredient can be explained for your skin. You can change this anytime.') : null,
      h('label', { class: 'f' }, '1. Your skin type'), chips,
      h('label', { class: 'f' }, '2. What do you want from your skincare?'), goals,
      h('label', { class: 'f' }, '3. Anything you know you react to or want to avoid?'), avoid, err,
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
  const key = h('input', { class: 'input', type: 'password', placeholder: 'Owner passcode', autocomplete: 'off' });
  const ownerErr = h('div', { class: 'err' });
  const run = async (action, msg, warn) => {
    if (warn && !(await confirmSheet(warn, 'Reset'))) return;
    try { await admin(action, key.value); toast(msg); ownerErr.textContent = ''; } catch (e) { ownerErr.textContent = e.message; }
  };
  sh = openSheet({
    title: 'Your skin profile',
    full: true,
    body: [
      ...form.body,
      h('button', { class: 'btn primary', style: 'margin-top:14px', onclick: form.save }, 'Save profile'),
      h('div', { class: 'section-h' }, 'About the AI'),
      h('p', { class: 'muted small' }, 'MyShelf uses Claude to find ingredient lists, explain them in plain words, write pattern explanations and run the chat. The pattern counts themselves are plain math, so they’re exact. Everything the AI adds is labelled and editable.'),
      h('p', { class: 'muted small' }, store.state.aiEnabled ? 'AI is on.' : 'AI is off: add ANTHROPIC_API_KEY in Vercel to turn it on.'),
      h('div', { class: 'section-h' }, 'Owner tools'),
      h('p', { class: 'muted small' }, 'Anyone with the link can try the app. Save a backup of your shelf, and reset to it if visitors change things.'),
      key, ownerErr,
      h('div', { class: 'p-actions' },
        h('button', { class: 'btn small', onclick: () => run('save', 'Backup saved') }, 'Save backup'),
        h('button', { class: 'btn small', onclick: () => run('restore', 'Shelf reset to your backup', 'Reset the whole app to your saved backup? Changes made since then will be lost.') }, 'Reset to backup')),
    ],
  });
}
