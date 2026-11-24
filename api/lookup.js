// GET ?q=name        → search Open Beauty Facts (free, openly licensed product data)
// GET ?img=<url>     → same-origin copy of an Open Beauty Facts image (so the app can cut out the background)
// GET ?photo=<id>    → the user's own photo of a product, from the database
import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';
import { searchOBF, OBF_UA } from '../lib/obf.js';

const OBF_HOSTS = /^https:\/\/(images|static)\.openbeautyfacts\.org\//;

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
    if (!OBF_HOSTS.test(img)) return res.status(400).json({ error: 'Image host not allowed' });
    const r = await fetch(img, { headers: { 'User-Agent': OBF_UA } }).catch(() => null);
    if (!r || !r.ok) return res.status(404).json({ error: 'Image not found' });
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  }

  const term = String(query || '').trim();
  if (term.length < 2) return res.status(200).json({ results: [] });
  const results = await searchOBF(term);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ results });
});
