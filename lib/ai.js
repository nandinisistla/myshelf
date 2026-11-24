// Talking to Claude (Anthropic API). The key lives only in Vercel's
// environment variables (ANTHROPIC_API_KEY) and never reaches the browser.

import { q } from './db.js';
import { UserError } from './core.js';

export const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const WEB_SEARCH_TOOL = () => process.env.WEB_SEARCH_TOOL || 'web_search_20250305';

export class AIUnavailable extends Error {}

// Simple daily cap so strangers with the public link can't run up the bill.
export async function useQuota(kind) {
  const limit = Number(process.env.DAILY_AI_LIMIT || 120);
  const day = new Date().toISOString().slice(0, 10);
  const r = await q(`insert into usage (day, kind, n) values ($1, 'all', 1)
                     on conflict (day, kind) do update set n = usage.n + 1 returning n`, [day]);
  if (r[0].n > limit) throw new UserError(`The AI has reached today's limit (${limit} requests). Try again tomorrow.`);
}

export async function claude(body) {
  if (process.env.MOCK_AI === '1') {
    const { mockClaude } = await import('./mock.js');
    return mockClaude(body);
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AIUnavailable('AI is not set up yet. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL(), ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `AI request failed (${res.status})`;
    const err = new AIUnavailable(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

export function textOf(resp) {
  return (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export function webSources(resp) {
  const out = [];
  for (const b of resp.content || []) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) out.push({ title: r.title || r.url, url: r.url });
    }
  }
  return out;
}
