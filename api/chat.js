// The AI assistant. It can read your shelf and make changes for you
// (add products, log bad days, move things between shelves...). Every
// change goes through the same code as the app, so it lands in History too.
import { handler, today } from '../lib/http.js';
import { q } from '../lib/db.js';
import * as core from '../lib/core.js';
import { claude, textOf, useQuota } from '../lib/ai.js';
import { enrichProduct } from '../lib/enrich.js';
import { searchOBF, OBF_CREDIT } from '../lib/obf.js';
import { rankProductImages } from '../lib/imgmeta.js';
import { AREAS } from '../lib/families.js';

export const config = { maxDuration: 60 };

const DATE = { type: 'string', description: 'YYYY-MM-DD' };
const AREA = { type: 'string', enum: ['face', 'scalp', 'body'] };
const TOOLS = [
  { name: 'add_product', description: 'Add a product to the shelf. Looks up its real ingredient list online automatically. If the user sent a photo of the ingredient label, pass what you read as ingredients_text.',
    input_schema: { type: 'object', properties: {
      name: { type: 'string', description: 'Product name, e.g. "Niacinamide 10% + TXA 4% Serum"' },
      brand: { type: 'string' }, routine: { type: 'string', description: 'Shelf name to put it on' },
      started: DATE, ingredients_text: { type: 'string' },
      use_photo_index: { type: 'integer', description: 'Index of an attached photo to use as the bottle picture (front of the product)' },
    }, required: ['name'] } },
  { name: 'log_bad_day', description: 'Log a skin, scalp or body reaction (a bad day).',
    input_schema: { type: 'object', properties: { date: DATE, area: AREA, severity: { type: 'integer', enum: [1, 2, 3], description: '1 mild, 2 noticeable, 3 bad' }, note: { type: 'string' } }, required: ['date', 'area'] } },
  { name: 'stop_using', description: 'Mark a product as no longer used (it moves off the shelf but stays in history).',
    input_schema: { type: 'object', properties: { product_id: { type: 'integer' }, date: DATE }, required: ['product_id'] } },
  { name: 'start_using_again', description: 'Put a stopped product back on the shelf.',
    input_schema: { type: 'object', properties: { product_id: { type: 'integer' }, date: DATE }, required: ['product_id'] } },
  { name: 'update_product', description: 'Change a product: shelf, start date, stop date, or body area.',
    input_schema: { type: 'object', properties: { product_id: { type: 'integer' }, routine: { type: 'string' }, started: DATE, stopped: DATE, area: AREA }, required: ['product_id'] } },
  { name: 'set_product_photo', description: 'Use an attached photo as the bottle picture for an existing product.',
    input_schema: { type: 'object', properties: { product_id: { type: 'integer' }, photo_index: { type: 'integer' } }, required: ['product_id', 'photo_index'] } },
  { name: 'delete_product', description: 'Permanently remove a product. Only if the user clearly asks to delete it.',
    input_schema: { type: 'object', properties: { product_id: { type: 'integer' } }, required: ['product_id'] } },
  { name: 'delete_bad_day', description: 'Delete a logged bad day.',
    input_schema: { type: 'object', properties: { reaction_id: { type: 'integer' } }, required: ['reaction_id'] } },
  { name: 'create_shelf', description: 'Create a new shelf (routine).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'rename_shelf', description: 'Rename a shelf.',
    input_schema: { type: 'object', properties: { shelf_id: { type: 'integer' }, name: { type: 'string' } }, required: ['shelf_id', 'name'] } },
  { name: 'update_profile', description: 'Update the skin profile.',
    input_schema: { type: 'object', properties: { skin_type: { type: 'string' }, goals: { type: 'string' }, avoid: { type: 'string' } } } },
  { name: 'set_finding', description: 'Record the user\'s view on a suspected trigger.',
    input_schema: { type: 'object', properties: { family: { type: 'string' }, status: { type: 'string', enum: ['agree', 'reject', 'unsure', 'ai'] } }, required: ['family', 'status'] } },
  { name: 'get_ingredients', description: 'Get the full ingredient list of a product to answer questions about it.',
    input_schema: { type: 'object', properties: { product_id: { type: 'integer' } }, required: ['product_id'] } },
];

function context(state) {
  const shelves = state.routines.map((r) => `#${r.id} ${r.name}`).join(', ') || 'none';
  const shelfName = (id) => state.routines.find((r) => r.id === id)?.name || 'Unsorted';
  const products = state.products.map((p) => {
    const fams = [...new Set((p.ingredients || []).map((i) => i.family))].filter((f) => f !== 'Other' && f !== 'Water & base').slice(0, 10);
    return `#${p.id} ${p.brand ? p.brand + ' ' : ''}${p.name} | ${AREAS[p.area]} | shelf: ${shelfName(p.routine_id)} | started ${p.started || '?'}${p.stopped ? ` | stopped ${p.stopped}` : ' | in use'} | ${fams.join(', ') || 'no ingredient list'}`;
  }).join('\n') || 'No products yet.';
  const bad = state.reactions.slice(0, 20).map((r) => `#${r.id} ${r.date} ${AREAS[r.area]} severity ${r.severity}${r.note ? ` "${r.note}"` : ''}`).join('\n') || 'None logged.';
  const sus = state.insights.families.filter((f) => ['strong', 'possible'].includes(f.level))
    .map((f) => `${f.family} (${f.level}, in ${f.hits} of ${f.relevant} bad days, user view: ${f.status})`).join('; ') || 'No clear pattern yet.';
  return `Today is ${state.today}.
Skin profile: ${core.describeProfile(state.profile)}
Shelves: ${shelves}
Products:
${products}
Bad days (newest first):
${bad}
Current patterns: ${sus}`;
}

const SYSTEM = (ctx) => `You are the assistant inside MyShelf, a personal skincare app that connects the dots between the user's products, ingredients and bad-skin days.
You can make changes with tools. Do what the user asks, then confirm in 1-2 short, friendly sentences what you changed.
- Turn relative dates ("yesterday", "last Monday", "2 weeks ago") into exact dates using today's date.
- If it's unclear which product they mean, ask a short question instead of guessing.
- Map body parts: face/cheeks/chin/forehead → face; scalp/hair/hairline → scalp; anything else (underarms, arms, back, chest, legs) → body.
- When adding a product the user describes casually ("my anua niacinamide"), use the full real product name.
- Never diagnose. For swelling, blistering, or trouble breathing, tell them to get medical help.
- Keep answers short and plain. No markdown headings.

Current data:
${ctx}`;

async function runTool(name, input, ctx) {
  const src = 'chat';
  const t = ctx.today;
  switch (name) {
    case 'add_product': {
      const obf = (await searchOBF(`${input.brand || ''} ${input.name}`.trim(), 3))[0];
      const info = await enrichProduct({
        name: input.name, brand: input.brand,
        ingredientsText: input.ingredients_text || obf?.ingredientsText || '',
        profile: ctx.state.profile, useWeb: !input.ingredients_text,
      });
      let options = [
        ...(info.images || []),
        ...(obf?.image ? [{ url: obf.image, source: 'Open Beauty Facts' }] : []),
      ];
      if (process.env.MOCK_AI !== '1') options = await rankProductImages(options, info.brand).catch(() => options);
      const first = options[0];
      const p = await core.addProduct({
        ...info, routine: input.routine, started: input.started, today: t,
        image_url: first?.url || null,
        image_credit: first ? (first.source === 'Open Beauty Facts' ? OBF_CREDIT : `Image: ${first.source}`) : null,
        image_options: options,
      }, src);
      const img = ctx.images[input.use_photo_index];
      if (img) await core.setPhoto(p.id, img, src);
      return { label: `Added ${p.name}`, result: `Added product #${p.id} "${p.name}" with ${info.ingredients.length} ingredients (confidence: ${info.confidence}).` };
    }
    case 'log_bad_day': {
      const r = await core.addReaction(input, src);
      return { label: `Logged bad day · ${AREAS[r.area]} · ${core.fmtDate(r.date)}`, result: `Logged reaction #${r.id}.` };
    }
    case 'stop_using': await core.stopProduct(input.product_id, input.date, t, src); return { label: 'Moved off the shelf', result: 'Done.' };
    case 'start_using_again': await core.restartProduct(input.product_id, input.date, t, src); return { label: 'Back on the shelf', result: 'Done.' };
    case 'update_product': {
      const patch = { started: input.started, stopped: input.stopped, area: input.area };
      if (input.routine) {
        const r = (await q(`select id from routines where lower(name) = lower($1)`, [input.routine]))[0];
        if (!r) return { result: `There is no shelf called "${input.routine}". Ask the user or create it first.` };
        patch.routine_id = r.id;
      }
      const p = await core.updateProduct(input.product_id, patch, src);
      return { label: `Updated ${p.name}`, result: 'Done.' };
    }
    case 'set_product_photo': {
      const img = ctx.images[input.photo_index];
      if (!img) return { result: 'No photo at that index.' };
      await core.setPhoto(input.product_id, img, src);
      return { label: 'Photo added', result: 'Done.' };
    }
    case 'delete_product': await core.deleteProduct(input.product_id, src); return { label: 'Product removed', result: 'Done.' };
    case 'delete_bad_day': await core.deleteReaction(input.reaction_id, src); return { label: 'Bad day deleted', result: 'Done.' };
    case 'create_shelf': { const r = await core.addRoutine(input.name, src); return { label: `New shelf: ${r.name}`, result: `Created shelf #${r.id}.` }; }
    case 'rename_shelf': await core.renameRoutine(input.shelf_id, input.name, src); return { label: `Shelf renamed to ${input.name}`, result: 'Done.' };
    case 'update_profile': await core.setProfile(input, src); return { label: 'Profile updated', result: 'Done.' };
    case 'set_finding': await core.setInsightStatus(input.family, input.status, src); return { label: `Noted: ${input.family}`, result: 'Done.' };
    case 'get_ingredients': {
      const p = ctx.state.products.find((x) => x.id === Number(input.product_id));
      if (!p) return { result: 'Not found.' };
      return { result: JSON.stringify((p.ingredients || []).map((i) => ({ inci: i.inci, plain: i.plain, family: i.family, does: i.does }))) };
    }
    default: return { result: `Unknown tool ${name}` };
  }
}

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const t = today(req);
  const message = String(req.json.message || '').trim().slice(0, 2000);
  const images = (Array.isArray(req.json.images) ? req.json.images : [])
    .filter((d) => typeof d === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(d) && d.length < 1_500_000)
    .slice(0, 3);
  if (!message && !images.length) throw new core.UserError('Type a message first.');
  await useQuota('chat');

  await q(`insert into chat (role, content, actions) values ('user', $1, $2::jsonb)`,
    [message || '(photo)', JSON.stringify(images.length ? [{ label: `${images.length} photo${images.length > 1 ? 's' : ''} attached` }] : [])]);

  let state = await core.getState(t);
  const history = (await q(`select role, content from chat order by id desc limit 13`)).reverse().slice(0, -1);
  const messages = history
    .filter((m) => m.content)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  // Anthropic needs alternating roles starting with user.
  const merged = [];
  for (const m of messages) {
    if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1].content += '\n' + m.content;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  const content = [];
  images.forEach((d, i) => {
    const [, media, data] = d.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    content.push({ type: 'text', text: `Photo ${i}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: media, data } });
  });
  content.push({ type: 'text', text: message || 'What can you tell from this photo?' });
  if (merged.length && merged[merged.length - 1].role === 'user') {
    merged[merged.length - 1] = { role: 'user', content: [{ type: 'text', text: merged[merged.length - 1].content }, ...content] };
  } else merged.push({ role: 'user', content });

  const actions = [];
  const ctx = { today: t, images, state };
  let reply = '';
  for (let round = 0; round < 6; round++) {
    const resp = await claude({ max_tokens: 1200, system: SYSTEM(context(state)), tools: TOOLS, messages: merged });
    reply = textOf(resp) || reply;
    if (resp.stop_reason !== 'tool_use') break;
    merged.push({ role: 'assistant', content: resp.content });
    const results = [];
    for (const b of resp.content.filter((x) => x.type === 'tool_use')) {
      let out;
      try { out = await runTool(b.name, b.input || {}, ctx); }
      catch (e) { out = { result: `Error: ${e.message}` }; }
      if (out.label) actions.push({ label: out.label });
      results.push({ type: 'tool_result', tool_use_id: b.id, content: out.result });
    }
    merged.push({ role: 'user', content: results });
    state = await core.getState(t);
    ctx.state = state;
  }
  reply = reply.trim() || (actions.length ? 'Done.' : "Sorry, I couldn't do that. Could you say it another way?");
  await q(`insert into chat (role, content, actions) values ('assistant', $1, $2::jsonb)`, [reply, JSON.stringify(actions)]);
  res.status(200).json(await core.getState(t));
});
