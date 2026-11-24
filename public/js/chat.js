// Ask AI: tell it what happened and it updates your shelf for you.
import { h, put, s, toast, compressImage } from './ui.js';
import { store, sendChat } from './store.js';

let pending = null;      // the message being sent
let attachments = [];    // data URLs
let draft = '';

const SUGGESTIONS = [
  'Add my SKIN1004 Madagascar Centella sunscreen to my morning shelf',
  'My scalp was itchy yesterday',
  'I stopped using the azelaic acid last week',
  'Does anything on my shelf have fragrance?',
];

export function renderChat(view) {
  const st = store.state;
  const msgs = h('div', { class: 'msgs', role: 'log', 'aria-label': 'Conversation' },
    st.chat.map((m) => bubble(m.role, m.content, m.actions)),
    pending ? [bubble('user', pending.text, pending.photos ? [{ label: `${pending.photos} photo${pending.photos > 1 ? 's' : ''} attached` }] : []),
      h('div', { class: 'msg assistant typing' }, h('span', { class: 'spinner', style: 'width:14px;height:14px;margin-right:8px' }), 'Working on it…')] : null);

  const intro = !st.chat.length && !pending ? [
    h('p', { class: 'sub', style: 'margin-top:4px' }, 'Tell me what happened and I’ll update your shelf, history and patterns. You can also send a photo of a label.'),
    st.aiEnabled ? null : h('div', { class: 'callout' }, 'AI isn’t set up yet: add ANTHROPIC_API_KEY in Vercel.'),
    h('div', { class: 'suggest' }, SUGGESTIONS.map((t) => h('button', { class: 'chip', onclick: () => send(t) }, t))),
  ] : null;

  put(view, h('div', { class: 'top' }, h('h1', { class: 'title' }, 'Ask AI')), intro, msgs);
  renderComposer();
  requestAnimationFrame(() => { view.scrollTop = view.scrollHeight; });
}

function bubble(role, text, actions) {
  return h('div', { class: 'msg ' + role },
    text,
    actions && actions.length ? h('div', { class: 'acts' }, actions.map((a) => h('span', { class: 'pill' }, (role === 'assistant' ? '✓ ' : '') + a.label))) : null);
}

function renderComposer() {
  document.querySelector('.composer')?.remove();
  const ta = h('textarea', { rows: 1, placeholder: 'Message MyShelf…', 'aria-label': 'Message', value: draft });
  ta.addEventListener('input', () => { draft = ta.value; ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', onchange: async (e) => {
    for (const f of [...e.target.files].slice(0, 3 - attachments.length)) {
      try { attachments.push(await compressImage(f, 1400, 0.82)); } catch (err) { toast(err.message); }
    }
    renderComposer();
  } });
  const preview = attachments.length ? h('div', { class: 'attach-preview' },
    attachments.map((d, i) => h('img', { src: d, alt: `Attached photo ${i + 1}`, title: 'Tap to remove', onclick: () => { attachments.splice(i, 1); renderComposer(); } }))) : null;
  const comp = h('div', { class: 'composer' }, preview,
    h('form', { onsubmit: (e) => { e.preventDefault(); send(ta.value); } },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Attach a photo', onclick: () => file.click() },
        s('svg', { viewBox: '0 0 24 24' }, s('rect', { x: 3.5, y: 6, width: 17, height: 13, rx: 2.5 }), s('circle', { cx: 12, cy: 12.5, r: 3.3 }), s('path', { d: 'M8.5 6l1.3-2h4.4l1.3 2' }))),
      ta,
      h('button', { type: 'submit', class: 'icon-btn send', 'aria-label': 'Send', disabled: Boolean(pending) },
        s('svg', { viewBox: '0 0 24 24' }, s('path', { d: 'M5 12h13M13 6l6 6-6 6' })))),
    file);
  document.getElementById('frame').append(comp);
  if (!pending) setTimeout(() => ta.focus({ preventScroll: true }), 30);
}

async function send(text) {
  text = String(text || '').trim();
  if (pending || (!text && !attachments.length)) return;
  const images = attachments;
  pending = { text: text || '(photo)', photos: images.length };
  attachments = [];
  draft = '';
  renderChat(document.getElementById('view'));
  try {
    await sendChat(text, images);
    pending = null;
    renderChat(document.getElementById('view'));
  } catch (e) {
    pending = null;
    draft = text;
    attachments = images;
    renderChat(document.getElementById('view'));
    toast(e.message);
  }
}

export function leaveChat() { document.querySelector('.composer')?.remove(); }
