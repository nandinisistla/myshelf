// MyShelf: app shell and navigation.
import { h, put } from './ui.js';
import { store, load, onChange } from './store.js';
import { renderShelf } from './shelf.js';
import { renderHistory } from './history.js';
import { renderForMe } from './forme.js';
import { renderChat, leaveChat } from './chat.js';
import { openBadDay } from './reaction.js';
import { openOnboarding, openSettings, initials } from './settings.js';
import { findPhotos, admin } from './store.js';
import { loadDemo } from './demo.js';
import { startBlobs } from './blob.js';
import { startSlides } from './slides.js';
import { startEffects, newView } from './effects.js';
import { imageSrc, scoreImage } from './bottle.js';

const view = document.getElementById('view');
const frame = document.getElementById('frame');
const TABS = { shelf: renderShelf, history: renderHistory, forme: renderForMe, chat: renderChat };
let current = null;

function tabFromHash() {
  const t = location.hash.replace('#', '');
  return TABS[t] ? t : 'shelf';
}

function render(keepScroll = true) {
  if (!store.state) return;
  const tab = tabFromHash();
  const changed = tab !== current;
  const y = window.scrollY;
  if (changed && current === 'chat') leaveChat();
  current = tab;
  frame.classList.toggle('chat-mode', tab === 'chat');
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (changed) newView();
  TABS[tab](view);
  if (!changed && keepScroll && tab !== 'chat') window.scrollTo({ top: y, behavior: 'instant' });
  if (changed && tab !== 'chat') window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', () => render(false));
onChange(() => render(true));
document.getElementById('badDayBtn').addEventListener('click', () => openBadDay());
document.getElementById('profileBtn').addEventListener('click', () => openSettings());
startBlobs();
startSlides();
startEffects();
// Show your initials on the profile button once you have a name.
onChange((st) => {
  const btn = document.getElementById('profileBtn');
  const ini = initials(st?.profile?.name);
  btn.classList.toggle('has-name', Boolean(ini));
  btn.setAttribute('aria-label', ini ? `${st.profile.name}: skin profile and settings` : 'Skin profile and settings');
  let tag = btn.querySelector('.ini');
  if (ini) { if (!tag) { tag = document.createElement('span'); tag.className = 'ini'; btn.append(tag); } tag.textContent = ini; }
  else if (tag) tag.remove();
});

async function start() {
  put(view, h('div', { class: 'loading' }, h('div', null, h('span', { class: 'spinner' }), '  Opening your shelf…')));
  try {
    await load();
    // A fresh MyShelf starts with Nandini's demo story already on it.
    if (store.state.demoOutdated) {
      admin('demo.reset', '').then(() => loadDemo('', () => {})).then(() => upgradePhotos()).catch(() => {});
    } else if (!store.state.demo && !store.state.reactions.length) {
      loadDemo('', () => {}).then(() => upgradePhotos()).catch(() => {});
    } else {
      if (!store.state.profile) openOnboarding();
      upgradePhotos();
    }
  } catch (e) {
    put(view, h('div', { class: 'empty' },
      h('h3', null, 'Couldn’t open your shelf'),
      h('p', null, e.message),
      h('button', { class: 'btn primary', onclick: start }, 'Try again')));
  }
}
start();

// Always look for a sharper photo: in the background, products whose photo is small
// (or missing) get a fresh search. Never touches photos you chose or took yourself.
async function upgradePhotos() {
  if (!store.state?.aiEnabled) return;
  const day = 86400000, week = 7 * day;
  const missing = [];   // no photo at all: always fetch these (past products too)
  const small = [];     // a photo that's too small: up to 3 per visit
  for (const p of store.state.products) {
    if (p.has_photo || p.image_locked) continue;
    const since = p.photo_checked ? Date.now() - new Date(p.photo_checked).getTime() : Infinity;
    const src = imageSrc(p);
    if (!src) { if (since > day) missing.push(p.id); continue; }
    if (p.stopped || since < week) continue;
    const r = await scoreImage(src);
    if (!r.width || Math.min(r.width, r.height) < 900) small.push(p.id);
  }
  for (const id of [...missing, ...small.slice(0, 3)]) {
    try { await findPhotos(id, true); } catch { /* try again another day */ }
  }
}
