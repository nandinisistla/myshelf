// Open Beauty Facts: a free, open database of cosmetics (photos are openly licensed).
const UA = 'MyShelf/1.0 (personal skincare project)';

export async function searchOBF(term, limit = 6) {
  if (process.env.MOCK_AI === '1') {
    const { mockSearch } = await import('./mock.js');
    return mockSearch(term);
  }
  const url = `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}`
    + `&search_simple=1&action=process&json=1&page_size=10`
    + `&fields=code,product_name,brands,image_front_url,image_front_small_url,ingredients_text,ingredients_text_en`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.products || [])
      .filter((p) => p.product_name)
      .map((p) => ({
        code: p.code,
        name: p.product_name,
        brand: (p.brands || '').split(',')[0].trim(),
        image: p.image_front_url || null,
        thumb: p.image_front_small_url || p.image_front_url || null,
        ingredientsText: p.ingredients_text_en || p.ingredients_text || '',
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export const OBF_CREDIT = 'Photo: Open Beauty Facts (CC BY-SA)';
export const OBF_UA = UA;
