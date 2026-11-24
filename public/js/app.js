// MyShelf: app shell and navigation.
import { h, put } from './ui.js';
import { store, load, onChange } from './store.js';
import { renderShelf } from './shelf.js';
import { renderHistory } from './history.js';
import { renderForMe } from './forme.js';
import { renderChat, leaveChat } from './chat.js';
import { openBadDay } from './reaction.js';
import { openOnboarding, openSettings } from './settings.js';

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
  TABS[tab](view);
  if (!changed && keepScroll && tab !== 'chat') window.scrollTo({ top: y, behavior: 'instant' });
  if (changed && tab !== 'chat') window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', () => render(false));
onChange(() => render(true));
document.getElementById('badDayBtn').addEventListener('click', () => openBadDay());
document.getElementById('profileBtn').addEventListener('click', () => openSettings());

async function start() {
  put(view, h('div', { class: 'loading' }, h('div', null, h('span', { class: 'spinner' }), '  Opening your shelf…')));
  try {
    await load();
    if (!store.state.profile) openOnboarding();
  } catch (e) {
    put(view, h('div', { class: 'empty' },
      h('h3', null, 'Couldn’t open your shelf'),
      h('p', null, e.message),
      h('button', { class: 'btn primary', onclick: start }, 'Try again')));
  }
}
start();
