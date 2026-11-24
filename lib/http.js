import { UserError } from './core.js';
import { AIUnavailable } from './ai.js';

export function handler(fn) {
  return async (req, res) => {
    try {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      req.json = body || {};
      await fn(req, res);
    } catch (e) {
      if (e instanceof UserError) return res.status(400).json({ error: e.message });
      if (e instanceof AIUnavailable) return res.status(503).json({ error: e.message, ai: true });
      console.error(e);
      res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
    }
  };
}

export function today(req) {
  const t = req.query?.today || req.json?.today;
  return /^\d{4}-\d{2}-\d{2}$/.test(t || '') ? t : new Date().toISOString().slice(0, 10);
}
