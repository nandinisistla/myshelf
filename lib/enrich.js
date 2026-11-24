// Find a product's real ingredient list online and explain it for this user.

import { claude, textOf, extractJSON, webSources, WEB_SEARCH_TOOL, AIUnavailable } from './ai.js';
import { FAMILIES, KINDS, normalizeIngredients, parseIngredientText } from './families.js';
import { describeProfile } from './core.js';
import { findProductImages } from './images.js';
import { rankProductImages } from './imgmeta.js';

const SYSTEM = `You are the label-reading assistant inside MyShelf, a personal skincare app.
You find a product's real, current ingredient list (INCI) and explain each ingredient in plain, friendly words.
Rules:
- Never invent ingredients. Only use a list you actually found or that the user provided.
- Keep the ingredients in label order.
- Plain names are 1-4 everyday words (e.g. "Glycerin" -> "Moisture magnet").
- "does" says why it's in the product (max 12 words). "for_you" relates it to this user's skin profile (max 16 words).
- flag is "good" if it helps the user's goals, "watch" if it could bother them given their profile or is a common irritant, else "neutral".
- You give information, not medical advice.`;

function schemaText() {
  return `Return ONLY one JSON object, no other text:
{
  "name": "product name without the brand",
  "brand": "brand",
  "area": "face" | "scalp" | "body",
  "kind": one of ${JSON.stringify(KINDS)} (the packaging shape),
  "colors": {"body": "#hex main packaging color", "cap": "#hex cap/pump color", "label": "#hex label or text color"},
  "summary": "one plain sentence on what this product does",
  "ingredients": [{"inci": "exact INCI name", "plain": "plain name", "family": one of ${JSON.stringify(FAMILIES)}, "does": "...", "for_you": "...", "flag": "good" | "neutral" | "watch"}],
  "sources": [{"title": "page title", "url": "https://..."}],
  "product_pages": ["https://... the brand's official store page for this exact product", "https://... 3-5 online shop pages selling it (Shopify beauty shops, Olive Young Global, YesStyle, Ulta, Sephora)"],
  "confidence": "high" | "medium" | "low",
  "note": "anything the user should double-check, or empty"
}`;
}

export async function enrichProduct({ name, brand, ingredientsText, profile, useWeb = true }) {
  const known = ingredientsText ? `\nAn ingredient list from an open product database (may be outdated or incomplete):\n${ingredientsText}\n` : '';
  const task = useWeb
    ? `Search the web for the current full ingredient list of this exact product. Prefer the brand's official site, then INCIDecoder or SkinSort, then major retailers. Use at most 3 searches. Also give the URL of the brand's official store page for this exact product plus 3-5 online shop pages selling it, so the app can find a large, clean product photo. Then explain it.`
    : `Explain the ingredient list given. If no list is given, return an empty ingredients array and confidence "low".`;
  const userMsg = `Product: ${name}${brand ? ` by ${brand}` : ''}.${known}
User's skin profile: ${describeProfile(profile)}

${task}
${schemaText()}`;

  const body = {
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  };
  if (useWeb) body.tools = [{ type: WEB_SEARCH_TOOL(), name: 'web_search', max_uses: 3 }];

  let resp;
  try {
    resp = await claude(body);
    // Long server-side searches can pause; continue the same turn.
    for (let i = 0; i < 3 && resp.stop_reason === 'pause_turn'; i++) {
      body.messages = [...body.messages.slice(0, 1), { role: 'assistant', content: resp.content }];
      resp = await claude(body);
    }
  } catch (e) {
    // If web search isn't available on this account, fall back to no-web mode.
    if (useWeb && e instanceof AIUnavailable && /tool|web_search/i.test(e.message)) {
      return enrichProduct({ name, brand, ingredientsText, profile, useWeb: false });
    }
    throw e;
  }

  const data = extractJSON(textOf(resp));
  if (!data) throw new AIUnavailable('The AI answered in an unexpected format. Please try again.');

  let ingredients = normalizeIngredients(data.ingredients);
  if (!ingredients.length && ingredientsText) ingredients = parseIngredientText(ingredientsText);
  let sources = Array.isArray(data.sources) ? data.sources.filter((s) => s && /^https?:\/\//.test(s.url)) : [];
  if (!sources.length) sources = webSources(resp).slice(0, 4);

  const pages = [
    ...(Array.isArray(data.product_pages) ? data.product_pages : []),
    ...sources.map((s) => s.url),
  ].filter((u) => typeof u === 'string');
  let images = [];
  if (process.env.MOCK_AI === '1') {
    const slug = encodeURIComponent(String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    images = [{ url: `https://example.com/mock/${slug}-a.svg`, source: 'brand-site.com' }, { url: `https://example.com/mock/${slug}-b.svg`, source: 'retailer.com' }];
  } else if (useWeb) {
    images = await findProductImages(pages).catch(() => []);
    images = await rankProductImages(images, data.brand || brand).catch(() => images);
  }

  return {
    images,
    name: data.name || name,
    brand: data.brand || brand || '',
    area: ['face', 'scalp', 'body'].includes(data.area) ? data.area : 'face',
    kind: KINDS.includes(data.kind) ? data.kind : 'bottle',
    colors: data.colors && typeof data.colors === 'object' ? data.colors : null,
    summary: data.summary || '',
    ingredients,
    sources: sources.slice(0, 5),
    confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
    ai_note: data.note || '',
  };
}
