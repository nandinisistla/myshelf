// POST { id } or { name, brand } → find more (and better) real product photos online.
// The AI only finds the product's own web pages; the photos are read from those pages.
import { handler, today } from '../lib/http.js';
import { q } from '../lib/db.js';
import { claude, textOf, extractJSON, webSources, useQuota, WEB_SEARCH_TOOL } from '../lib/ai.js';
import { findProductImages } from '../lib/images.js';
import { searchOBF } from '../lib/obf.js';
import { getState, UserError } from '../lib/core.js';

export const config = { maxDuration: 60 };

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  let { id, name, brand } = req.json;
  let product = null;
  if (id) {
    product = (await q(`select * from products where id = $1`, [Number(id)]))[0];
    if (!product) throw new UserError('That product no longer exists.');
    name = product.name; brand = product.brand;
  }
  if (!name) throw new UserError('Which product?');
  await useQuota('photos');

  let images = [];
  if (process.env.MOCK_AI === '1') {
    const slug = encodeURIComponent(String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    images = [{ url: `https://example.com/mock/${slug}-b.svg`, source: 'brand-site.com' }];
  } else {
    const resp = await claude({
      max_tokens: 800,
      system: 'You find official product pages. Answer with JSON only.',
      tools: [{ type: WEB_SEARCH_TOOL(), name: 'web_search', max_uses: 2 }],
      messages: [{ role: 'user', content: `Find web pages that show a clean product photo (packshot on a plain background) of exactly this product: ${brand ? brand + ' ' : ''}${name}.
Prefer the brand's official online store, then big retailers (Sephora, Ulta, YesStyle, Olive Young, Boots, Target).
Return ONLY JSON: {"pages": ["https://...", "https://..."]} with up to 5 product page URLs (not search or category pages).` }],
    });
    const data = extractJSON(textOf(resp)) || {};
    const pages = [...(Array.isArray(data.pages) ? data.pages : []), ...webSources(resp).map((s) => s.url)];
    images = await findProductImages(pages).catch(() => []);
  }
  const obf = (await searchOBF(`${brand || ''} ${name}`.trim(), 2))[0];
  if (obf?.image) images.push({ url: obf.image, source: 'Open Beauty Facts' });

  if (product) {
    const seen = new Set();
    const merged = [...images, ...(product.image_options || [])].filter((o) => {
      const k = String(o.url).split('?')[0];
      if (seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 10);
    await q(`update products set image_options = $1::jsonb, updated_at = now() where id = $2`, [JSON.stringify(merged), product.id]);
    return res.status(200).json({ images: merged, state: await getState(today(req)) });
  }
  res.status(200).json({ images });
});
