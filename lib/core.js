// All reads and writes go through here, so the app and the AI chat
// behave the same way and every change is written to the history.

import { q } from './db.js';
import { normalizeIngredients, AREAS, KINDS } from './families.js';
import { computeInsights, templateExplanation } from './insights.js';

export class UserError extends Error {}

export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};
const SEVERITY = { 1: 'mild', 2: 'noticeable', 3: 'bad' };
const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null);

export async function logEvent(kind, summary, data = {}, source = 'app') {
  await q(`insert into events (kind, summary, data, source) values ($1, $2, $3::jsonb, $4)`,
    [kind, summary, JSON.stringify(data), source]);
}

async function getProduct(id) {
  const r = await q(`select * from products where id = $1`, [Number(id)]);
  if (!r[0]) throw new UserError('That product no longer exists.');
  return r[0];
}
async function routineName(id) {
  if (!id) return null;
  const r = await q(`select name from routines where id = $1`, [Number(id)]);
  return r[0]?.name || null;
}

export async function getState(today) {
  today = isoDate(today) || new Date().toISOString().slice(0, 10);
  const [profile, routines, products, reactions, statuses, events, chat, cache] = await Promise.all([
    q(`select skin_type, goals, avoid from profile where id = 1`),
    q(`select id, name, position from routines order by position, id`),
    q(`select id, name, brand, area, kind, colors, routine_id, on_shelf, started, stopped, summary, ingredients,
              sources, confidence, ai_note, image_url, image_credit, image_options, image_locked, photo_checked, has_photo, demo, created_at, updated_at
         from products order by id`),
    q(`select id, date, area, severity, note, demo, created_at from reactions order by date desc, id desc`),
    q(`select family, status from insight_status`),
    q(`select id, at, kind, summary, data, source from events order by at desc, id desc limit 400`),
    q(`select id, at, role, content, actions from chat order by id desc limit 80`),
    q(`select signature, data, updated_at from insight_cache where id = 1`),
  ]);
  const insights = computeInsights(products, reactions, statuses, today);
  const cached = cache[0];
  const aiText = cached && cached.signature === insights.signature ? cached.data || {} : {};
  for (const f of insights.families) {
    f.explanation = aiText[f.family] || templateExplanation(f);
    f.aiWritten = Boolean(aiText[f.family]);
  }
  insights.overall = aiText.__overall || '';
  insights.explanationsFresh = Boolean(cached && cached.signature === insights.signature);
  return {
    today,
    profile: profile[0] || null,
    routines,
    products,
    reactions,
    insights,
    events,
    chat: chat.reverse(),
    aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY) || process.env.MOCK_AI === '1',
  };
}

// ---------- products ----------
function cleanOptions(list) {
  return (Array.isArray(list) ? list : [])
    .filter((o) => o && /^https:\/\//.test(o.url))
    .slice(0, 10)
    .map((o) => ({ url: String(o.url).slice(0, 600), source: String(o.source || '').slice(0, 80) }));
}

export async function addProduct(d, source = 'app') {
  const name = String(d.name || '').trim();
  if (!name) throw new UserError('A product needs a name.');
  const area = AREAS[d.area] ? d.area : 'face';
  const kind = KINDS.includes(d.kind) ? d.kind : 'bottle';
  const ingredients = normalizeIngredients(d.ingredients);
  let routineId = d.routine_id ? Number(d.routine_id) : null;
  if (!routineId && d.routine) {
    const r = await q(`select id from routines where lower(name) = lower($1) limit 1`, [String(d.routine)]);
    routineId = r[0]?.id || null;
  }
  const started = isoDate(d.started) || isoDate(d.today) || new Date().toISOString().slice(0, 10);
  const rows = await q(
    `insert into products (name, brand, area, kind, colors, routine_id, started, summary, ingredients, sources,
       confidence, ai_note, image_url, image_credit, image_options, image_locked)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16) returning *`,
    [name, d.brand || null, area, kind, JSON.stringify(d.colors || null), routineId, started, d.summary || null,
      JSON.stringify(ingredients), JSON.stringify(Array.isArray(d.sources) ? d.sources.slice(0, 8) : []),
      d.confidence || null, d.ai_note || null, d.image_url || null, d.image_credit || null,
      JSON.stringify(cleanOptions(d.image_options)), Boolean(d.image_locked)]);
  const p = rows[0];
  const shelf = await routineName(routineId);
  await logEvent('product.add', `Added ${p.name}${shelf ? ` to ${shelf}` : ''} · started ${fmtDate(started)}`,
    { productId: p.id, ingredients: ingredients.length }, source);
  return p;
}

export async function updateProduct(id, patch, source = 'app') {
  const p = await getProduct(id);
  const changes = [];
  const sets = [];
  const vals = [];
  const set = (col, val, json = false) => { vals.push(json ? JSON.stringify(val) : val); sets.push(`${col} = $${vals.length}${json ? '::jsonb' : ''}`); };

  if (patch.name !== undefined && String(patch.name).trim() && patch.name !== p.name) { set('name', String(patch.name).trim()); changes.push(`renamed to ${patch.name}`); }
  if (patch.brand !== undefined && patch.brand !== p.brand) { set('brand', patch.brand || null); changes.push('brand updated'); }
  if (patch.area !== undefined && AREAS[patch.area] && patch.area !== p.area) { set('area', patch.area); changes.push(`area: ${AREAS[patch.area]}`); }
  if (patch.kind !== undefined && KINDS.includes(patch.kind) && patch.kind !== p.kind) { set('kind', patch.kind); }
  if (patch.routine_id !== undefined) {
    const rid = patch.routine_id ? Number(patch.routine_id) : null;
    if (rid !== p.routine_id) { set('routine_id', rid); changes.push(`moved to ${(await routineName(rid)) || 'no shelf'}`); }
  }
  if (patch.started !== undefined && isoDate(patch.started) && patch.started !== p.started) { set('started', patch.started); changes.push(`start date: ${fmtDate(patch.started)}`); }
  if (patch.stopped !== undefined) {
    const s = isoDate(patch.stopped);
    if (s !== p.stopped) { set('stopped', s); set('on_shelf', !s); changes.push(s ? `stopped ${fmtDate(s)}` : 'back on shelf'); }
  }
  if (patch.ingredients !== undefined) { set('ingredients', normalizeIngredients(patch.ingredients), true); changes.push('ingredient list edited'); }
  if (patch.summary !== undefined) set('summary', patch.summary || null);
  if (patch.colors !== undefined) set('colors', patch.colors || null, true);
  if (patch.image_options !== undefined) set('image_options', cleanOptions(patch.image_options), true);
  if (patch.image_url !== undefined) {
    const url = patch.image_url && /^https:\/\//.test(patch.image_url) ? String(patch.image_url).slice(0, 600) : null;
    if (url !== p.image_url) { set('image_url', url); set('image_credit', url ? (patch.image_credit || null) : null); changes.push(url ? 'new picture' : 'picture removed'); }
  }
  if (patch.image_locked !== undefined) set('image_locked', Boolean(patch.image_locked));
  if (!sets.length) return p;
  sets.push('updated_at = now()');
  vals.push(p.id);
  const rows = await q(`update products set ${sets.join(', ')} where id = $${vals.length} returning *`, vals);
  if (changes.length) await logEvent('product.update', `${p.name}: ${changes.join(', ')}`, { productId: p.id }, source);
  return rows[0];
}

export async function stopProduct(id, date, today, source = 'app') {
  const p = await getProduct(id);
  const d = isoDate(date) || isoDate(today) || new Date().toISOString().slice(0, 10);
  await q(`update products set stopped = $1, on_shelf = false, updated_at = now() where id = $2`, [d, p.id]);
  await logEvent('product.stop', `Stopped using ${p.name} · ${fmtDate(d)}`, { productId: p.id }, source);
}

export async function restartProduct(id, date, today, source = 'app') {
  const p = await getProduct(id);
  const d = isoDate(date) || isoDate(today) || new Date().toISOString().slice(0, 10);
  // Keep the old period in history; the product's active period restarts now.
  await q(`update products set stopped = null, on_shelf = true, started = $1, updated_at = now() where id = $2`, [d, p.id]);
  await logEvent('product.restart', `Put ${p.name} back on the shelf · ${fmtDate(d)}`,
    { productId: p.id, previous: { started: p.started, stopped: p.stopped } }, source);
}

export async function deleteProduct(id, source = 'app') {
  const p = await getProduct(id);
  await q(`delete from products where id = $1`, [p.id]);
  await q(`delete from photos where product_id = $1`, [p.id]);
  await logEvent('product.delete', `Removed ${p.name} from MyShelf`, { productId: p.id, name: p.name }, source);
}

export async function setPhoto(id, dataUrl, source = 'app') {
  const p = await getProduct(id);
  if (dataUrl) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl) || dataUrl.length > 1_500_000) throw new UserError('That photo is too large or not an image.');
    await q(`insert into photos (product_id, data) values ($1, $2) on conflict (product_id) do update set data = excluded.data`, [p.id, dataUrl]);
    await q(`update products set has_photo = true, updated_at = now() where id = $1`, [p.id]);
    await logEvent('product.photo', `Added your own photo of ${p.name}`, { productId: p.id }, source);
  } else {
    await q(`delete from photos where product_id = $1`, [p.id]);
    await q(`update products set has_photo = false, updated_at = now() where id = $1`, [p.id]);
    await logEvent('product.photo', `Removed your photo of ${p.name}`, { productId: p.id }, source);
  }
}

// ---------- reactions ----------
export async function addReaction(d, source = 'app') {
  const date = isoDate(d.date);
  if (!date) throw new UserError('Pick a date for the reaction.');
  const area = AREAS[d.area] ? d.area : null;
  if (!area) throw new UserError('Pick where the reaction was: face, hair & scalp, or body.');
  const sev = [1, 2, 3].includes(Number(d.severity)) ? Number(d.severity) : 2;
  const rows = await q(`insert into reactions (date, area, severity, note) values ($1,$2,$3,$4) returning *`,
    [date, area, sev, d.note ? String(d.note).slice(0, 500) : null]);
  await logEvent('reaction.add', `Bad day logged · ${AREAS[area]} · ${SEVERITY[sev]} · ${fmtDate(date)}`,
    { reactionId: rows[0].id }, source);
  return rows[0];
}

export async function updateReaction(id, patch, source = 'app') {
  const r = (await q(`select * from reactions where id = $1`, [Number(id)]))[0];
  if (!r) throw new UserError('That entry no longer exists.');
  const date = isoDate(patch.date) || r.date;
  const area = AREAS[patch.area] ? patch.area : r.area;
  const sev = [1, 2, 3].includes(Number(patch.severity)) ? Number(patch.severity) : r.severity;
  const note = patch.note !== undefined ? (patch.note || null) : r.note;
  await q(`update reactions set date=$1, area=$2, severity=$3, note=$4 where id=$5`, [date, area, sev, note, r.id]);
  await logEvent('reaction.update', `Edited bad day · ${AREAS[area]} · ${fmtDate(date)}`, { reactionId: r.id }, source);
}

export async function deleteReaction(id, source = 'app') {
  const r = (await q(`select * from reactions where id = $1`, [Number(id)]))[0];
  if (!r) throw new UserError('That entry no longer exists.');
  await q(`delete from reactions where id = $1`, [r.id]);
  await logEvent('reaction.delete', `Deleted bad day · ${AREAS[r.area]} · ${fmtDate(r.date)}`, { reaction: r }, source);
}

// ---------- routines (shelves) ----------
export async function addRoutine(name, source = 'app') {
  name = String(name || '').trim().slice(0, 40);
  if (!name) throw new UserError('Give the shelf a name.');
  const pos = (await q(`select coalesce(max(position), -1) + 1 as p from routines`))[0].p;
  const rows = await q(`insert into routines (name, position) values ($1, $2) returning *`, [name, pos]);
  await logEvent('routine.add', `New shelf: ${name}`, { routineId: rows[0].id }, source);
  return rows[0];
}
export async function renameRoutine(id, name, source = 'app') {
  name = String(name || '').trim().slice(0, 40);
  if (!name) throw new UserError('Give the shelf a name.');
  const old = await routineName(id);
  if (!old) throw new UserError('That shelf no longer exists.');
  if (old === name) return;
  await q(`update routines set name = $1 where id = $2`, [name, Number(id)]);
  await logEvent('routine.rename', `Renamed shelf ${old} → ${name}`, { routineId: Number(id) }, source);
}
export async function deleteRoutine(id, source = 'app') {
  const old = await routineName(id);
  if (!old) throw new UserError('That shelf no longer exists.');
  await q(`update products set routine_id = null where routine_id = $1`, [Number(id)]);
  await q(`delete from routines where id = $1`, [Number(id)]);
  await logEvent('routine.delete', `Removed shelf ${old} (its products moved to Unsorted)`, { routineId: Number(id) }, source);
}

// ---------- profile & insights ----------
export async function setProfile(d, source = 'app') {
  const cur = (await q(`select * from profile where id = 1`))[0] || {};
  const v = {
    skin_type: d.skin_type !== undefined ? String(d.skin_type || '').slice(0, 60) : cur.skin_type || null,
    goals: d.goals !== undefined ? String(d.goals || '').slice(0, 200) : cur.goals || null,
    avoid: d.avoid !== undefined ? String(d.avoid || '').slice(0, 300) : cur.avoid || null,
  };
  await q(`insert into profile (id, skin_type, goals, avoid) values (1,$1,$2,$3)
           on conflict (id) do update set skin_type=$1, goals=$2, avoid=$3, updated_at=now()`, [v.skin_type, v.goals, v.avoid]);
  await logEvent('profile', `Skin profile updated`, v, source);
}

const STATUS_TEXT = { agree: 'You agreed', reject: 'You said not this', unsure: 'You marked not sure', ai: 'Back to AI suggestion' };
export async function setInsightStatus(family, status, source = 'app') {
  if (!STATUS_TEXT[status]) throw new UserError('Unknown choice.');
  family = String(family || '').slice(0, 60);
  if (status === 'ai') await q(`delete from insight_status where family = $1`, [family]);
  else await q(`insert into insight_status (family, status) values ($1,$2)
                on conflict (family) do update set status = $2, updated_at = now()`, [family, status]);
  await logEvent('insight', `${STATUS_TEXT[status]}: ${family}`, { family, status }, source);
}

export function describeProfile(p) {
  if (!p) return 'No skin profile yet.';
  return `Skin type: ${p.skin_type || 'not given'}. Goals: ${p.goals || 'not given'}. Wants to avoid / known sensitivities: ${p.avoid || 'none given'}.`;
}
