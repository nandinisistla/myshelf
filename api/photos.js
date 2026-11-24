// POST { id } or { name, brand } → find more (and better) real product photos online.
// The AI only finds the product's own web pages; the photos are read from those pages.
import { handler, today } from '../lib/http.js';
import { q } from '../lib/db.js';
import { claude, textOf, extractJSON, webSources, useQuota, WEB_SEARCH_TOOL } from '../lib/ai.js';
import { findProductImages } from '../lib/images.js';
import { rankProductImages } from '../lib/imgmeta.js';
import { searchOBF } from '../lib/obf.js';
import { getState, UserError, logEvent } from '../lib/core.js';

export const config = { maxDuration: 60 };

export default handler(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  let { id, name, brand, auto } = req.json;
  let product = null;
  if (id) {
    product = (await q(`select * from products where id = $1`, [Number(id)]))[0];
    if (!product) throw new UserError('That product no longer exists.');
    name = product.name; brand = product.brand;
  }
  if (!name) throw new UserError('Which product?');
  // Automatic upgrades: at most once a week per product, never over the user's own choice.
  if (auto && product) {
    const recent = product.photo_checked && Date.now() - new Date(product.photo_checked).getTime() < 7 * 86400000;
    if (recent || product.image_locked || product.has_photo) return res.status(200).json({ images: product.image_options || [], skipped: true });
    await q(`update products set photo_checked = now() where id = $1`, [product.id]);
  }
  await useQuota('photos');

  let images = [];
  if (process.env.MOCK_AI === '1') {
    const slug = encodeURIComponent(String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    images = [{ url: `https://example.com/mock/${slug}-b.svg`, source: 'brand-site.com' }];
  } else {
    const resp = await claude({
      max_tokens: 800,
      system: 'You find official product pages. Answer with JSON only.',
      tools: [{ type: WEB_SEARCH_TOOL(), name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: `Find web pages that show a large, clean product photo (packshot on a plain white background, current packaging) of exactly this product: ${brand ? brand + ' ' : ''}${name}.
Look in this order: 1) the brand's official online store, 2) online shops that sell it (many K-beauty and beauty shops run on Shopify), 3) Olive Young Global, YesStyle, Stylevana, Ulta, Sephora, Boots, Cult Beauty.
Only product pages for this exact product and size (not search, category or blog pages).
Return ONLY JSON: {"pages": ["https://...", ...]} with 6 to 8 URLs.` }],
    });
    const data = extractJSON(textOf(resp)) || {};
    const pages = [...(Array.isArray(data.pages) ? data.pages : []), ...webSources(resp).map((s) => s.url)];
    images = await findProductImages(pages).catch(() => []);
  }
  const obf = (await searchOBF(`${brand || ''} ${name}`.trim(), 2))[0];
  if (obf?.image) images.push({ url: obf.image, source: 'Open Beauty Facts' });
  if (process.env.MOCK_AI !== '1') images = await rankProductImages(images, brand).catch(() => images);

  if (product) {
    const seen = new Set();
    let merged = [...images, ...(product.image_options || [])].filter((o) => {
      const k = String(o.url).split('?')[0];
      if (seen.has(k)) return false; seen.add(k); return true;
    });
    if (process.env.MOCK_AI !== '1') merged = await rankProductImages(merged, brand).catch(() => merged);
    merged = merged.slice(0, 10);
    await q(`update products set image_options = $1::jsonb, photo_checked = now(), updated_at = now() where id = $2`, [JSON.stringify(merged), product.id]);
    // Automatic mode: switch to the sharpest clean photo if it beats the current one.
    const best = merged[0];
    const current = merged.find((o) => o.url === product.image_url);
    if (auto && best && best.url !== product.image_url && (!current || (best.score ?? 0) > (current.score ?? 0) + 5)) {
      const credit = best.source === 'Open Beauty Facts' ? 'Photo: Open Beauty Facts (CC BY-SA)' : `Image: ${best.source}`;
      await q(`update products set image_url = $1, image_credit = $2, updated_at = now() where id = $3`, [best.url, credit, product.id]);
      await logEvent('product.photo', `Found a sharper photo of ${product.name}`, { productId: product.id }, 'app');
    }
    return res.status(200).json({ images: merged, state: await getState(today(req)) });
  }
  res.status(200).json({ images });
});
