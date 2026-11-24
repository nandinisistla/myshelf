// Database access. On Vercel this uses Neon Postgres (DATABASE_URL).
// Locally (no DATABASE_URL) it uses PGlite, an in-process Postgres, for testing.

export class ConfigError extends Error {}

let clientPromise = null;
let schemaPromise = null;

// Neon on Vercel may add a prefix to its variable names (e.g. STORAGE_DATABASE_URL).
export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const key = Object.keys(process.env).find((k) => /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k) && /^postgres/.test(process.env[k] || ''));
  return key ? process.env[key] : null;
}

async function makeClient() {
  const url = databaseUrl();
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return (text, params = []) => sql.query(text, params);
  }
  const modPath = process.env.LOCAL_PGLITE_PATH;
  if (!modPath) throw new ConfigError('The database isn’t connected yet. In Vercel: Storage → Create Database → Neon → connect it to this project, then Redeploy.');
  const { PGlite } = await import(modPath);
  const db = new PGlite(process.env.LOCAL_PGLITE_DIR || undefined);
  return async (text, params = []) => (await db.query(text, params)).rows;
}

async function raw(text, params) {
  if (!clientPromise) clientPromise = makeClient().catch((e) => { clientPromise = null; throw e; });
  const run = await clientPromise;
  try {
    return await run(text, params);
  } catch (e) {
    if (/password authentication|ENOTFOUND|getaddrinfo|connect|fetch failed|endpoint/i.test(e.message || '')) {
      throw new ConfigError('Can’t reach the database. Check the Neon connection in Vercel → Storage, then Redeploy.');
    }
    throw e;
  }
}

const SCHEMA = [
  `create table if not exists profile (id int primary key, skin_type text, goals text, avoid text, updated_at timestamptz default now())`,
  `create table if not exists routines (id serial primary key, name text not null, position int default 0, created_at timestamptz default now())`,
  `create table if not exists products (
     id serial primary key, name text not null, brand text, area text default 'face', kind text default 'bottle',
     colors jsonb, routine_id int, on_shelf boolean default true, started text, stopped text, summary text,
     ingredients jsonb default '[]'::jsonb, sources jsonb default '[]'::jsonb, confidence text, ai_note text,
     image_url text, image_credit text, has_photo boolean default false,
     created_at timestamptz default now(), updated_at timestamptz default now())`,
  `alter table products add column if not exists image_options jsonb default '[]'::jsonb`,
  `alter table products add column if not exists photo_checked timestamptz`,
  `alter table products add column if not exists image_locked boolean default false`,
  `alter table products add column if not exists demo boolean default false`,
  `create table if not exists photos (product_id int primary key, data text not null)`,
  `create table if not exists reactions (id serial primary key, date text not null, area text not null, severity int default 2, note text, created_at timestamptz default now())`,
  `alter table reactions add column if not exists demo boolean default false`,
  `create table if not exists insight_status (family text primary key, status text, updated_at timestamptz default now())`,
  `create table if not exists insight_cache (id int primary key, signature text, data jsonb, updated_at timestamptz default now())`,
  `create table if not exists events (id serial primary key, at timestamptz default now(), kind text, summary text, data jsonb, source text default 'app')`,
  `create table if not exists chat (id serial primary key, at timestamptz default now(), role text not null, content text, actions jsonb)`,
  `create table if not exists usage (day text, kind text, n int default 0, primary key (day, kind))`,
  `create table if not exists snapshots (id int primary key, data jsonb, at timestamptz default now())`,
];

async function ensureSchema() {
  for (const stmt of SCHEMA) await raw(stmt);
  const r = await raw(`select count(*)::int as n from routines`);
  if (r[0].n === 0) {
    const names = ['Morning', 'Night', 'Hair', 'Body'];
    for (let i = 0; i < names.length; i++) {
      await raw(`insert into routines (name, position) values ($1, $2)`, [names[i], i]);
    }
  }
}

export async function q(text, params = []) {
  if (!schemaPromise) schemaPromise = ensureSchema().catch((e) => { schemaPromise = null; throw e; });
  await schemaPromise;
  return raw(text, params);
}

export const TABLES = ['profile', 'routines', 'products', 'photos', 'reactions', 'insight_status', 'insight_cache', 'events', 'chat'];
