// Real product photos: read the main product image from the product's own web page
// (brand site first). Works with og:image / twitter:image / JSON-LD, and Shopify stores.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export function isSafeUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return false; // no raw IPs
    return true;
  } catch { return false; }
}

async function fetchText(url, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) return null;
    const type = r.headers.get('content-type') || '';
    if (!/html|json|text/.test(type)) return null;
    return (await r.text()).slice(0, 600_000);
  } catch { return null; } finally { clearTimeout(t); }
}

function decode(s) { return s.replace(/&amp;/g, '&').replace(/&#x2F;/g, '/').replace(/\\\//g, '/'); }
function abs(src, base) {
  try { const u = new URL(decode(src).startsWith('//') ? 'https:' + decode(src) : decode(src), base); u.protocol = 'https:'; return u.href; } catch { return null; }
}

function imagesFromHtml(html, base) {
  const out = [];
  const meta = (prop) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'gi');
    for (const tag of html.match(re) || []) {
      const m = tag.match(/content=["']([^"']+)["']/i);
      if (m) out.push(m[1]);
    }
  };
  meta('og:image:secure_url'); meta('og:image'); meta('twitter:image'); meta('twitter:image:src');
  for (const block of html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    try {
      const json = JSON.parse(block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, ''));
      const nodes = [].concat(json['@graph'] || json);
      for (const n of nodes) {
        if (!n || !/Product/i.test([].concat(n['@type']).join(' '))) continue;
        for (const img of [].concat(n.image || [])) out.push(typeof img === 'string' ? img : img?.url || img?.contentUrl);
      }
    } catch { /* ignore broken JSON-LD */ }
  }
  return out.filter(Boolean).map((s) => abs(s, base)).filter(Boolean);
}

async function shopifyImages(pageUrl) {
  const m = pageUrl.match(/^(https:\/\/[^/]+)(?:\/[a-z]{2}(?:-[a-z]{2})?)?(?:\/collections\/[^/]+)?\/products\/([^/?#]+)/i);
  if (!m) return [];
  const txt = await fetchText(`${m[1]}/products/${m[2]}.json`, 4000);
  if (!txt) return [];
  try {
    const j = JSON.parse(txt);
    return (j.product?.images || []).slice(0, 2).map((i) => abs(i.src, m[1])).filter(Boolean);
  } catch { return []; }
}

// Strip CDN size suffixes so we get a reasonably large image.
function bigger(url) {
  return url.replace(/_(\d{2,4}x\d{0,4}|small|medium|thumb|compact)(?=\.(jpe?g|png|webp))/i, '_800x');
}

export async function findProductImages(pageUrls = []) {
  const pages = [...new Set(pageUrls.filter(isSafeUrl))].slice(0, 4);
  const results = await Promise.all(pages.map(async (url) => {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const shop = await shopifyImages(url);
    if (shop.length) return shop.map((src) => ({ url: bigger(src), source: host, page: url }));
    const html = await fetchText(url);
    if (!html) return [];
    return imagesFromHtml(html, url).slice(0, 2).map((src) => ({ url: bigger(src), source: host, page: url }));
  }));
  const seen = new Set();
  return results.flat()
    .filter((i) => isSafeUrl(i.url) && !/logo|icon|sprite|favicon|placeholder|banner/i.test(i.url))
    .filter((i) => { const k = i.url.split('?')[0]; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 5);
}
