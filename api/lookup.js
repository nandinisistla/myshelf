// GET ?q=name        → search Open Beauty Facts (free, openly licensed product data)
// GET ?img=<url>     → same-origin copy of an Open Beauty Facts image (so the app can cut out the background)
// GET ?photo=<id>    → the user's own photo of a product, from the database
import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';
import { searchOBF, OBF_UA } from '../lib/obf.js';
import { isSafeUrl, bigger } from '../lib/images.js';

const MAX_BYTES = 6 * 1024 * 1024;

export default handler(async (req, res) => {
  const { q: query, img, photo } = req.query || {};

  if (photo) {
    const r = await q(`select data from photos where product_id = $1`, [Number(photo)]);
    if (!r[0]) return res.status(404).json({ error: 'No photo' });
    const m = r[0].data.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(Buffer.from(m[2], 'base64'));
  }

  if (img) {
    // Same-origin copy of a product photo, so the app can remove its background.
    if (!isSafeUrl(img)) return res.status(400).json({ error: 'Image address not allowed' });
    if (process.env.MOCK_AI === '1' && img.startsWith('https://example.com/mock/')) {
      const { mockBottleSvg } = await import('../lib/mock.js');
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.status(200).send(mockBottleSvg(img));
    }
    const get = async (u) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(u, { headers: { 'User-Agent': OBF_UA, Accept: 'image/*' }, signal: ctrl.signal, redirect: 'follow' }).catch(() => null);
      clearTimeout(timer);
      return r && r.ok && /^image\//.test(r.headers.get('content-type') || '') ? r : null;
    };
    // Always try the large version of the photo first.
    const big = bigger(img);
    const r = (big !== img && await get(big)) || await get(img);
    const type = r?.headers.get('content-type') || '';
    if (!r || !r.ok || !/^image\/(jpeg|png|webp|gif|avif)/.test(type)) return res.status(404).json({ error: 'Image not found' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Image too large' });
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');
    return res.status(200).send(buf);
  }

  const term = String(query || '').trim();
  if (term.length < 2) return res.status(200).json({ results: [] });
  const results = await searchOBF(term);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ results });
});
