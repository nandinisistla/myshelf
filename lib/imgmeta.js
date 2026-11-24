// Rank product photos on the server: read each image's real size from its first
// bytes (no full download), prefer the brand's own store (newest packaging),
// drop small or blurry images, and push lifestyle shots down.
import { isSafeUrl } from './images.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function sizeFromBytes(b) {
  const u32 = (o) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50) return { w: u32(16), h: u32(20) };
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49) return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
  // WebP
  if (b[0] === 0x52 && b[8] === 0x57) {
    const fmt = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (fmt === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (fmt === 'VP8 ') return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
    if (fmt === 'VP8L') { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  }
  // JPEG: walk the markers to a Start Of Frame
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[o + 5] << 8) | b[o + 6], w: (b[o + 7] << 8) | b[o + 8] };
      o += 2 + ((b[o + 2] << 8) | b[o + 3]);
    }
  }
  return null;
}

async function imageSize(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*', Range: 'bytes=0-131071' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok && r.status !== 206) return null;
    if (!/^image\//.test(r.headers.get('content-type') || '')) return null;
    const reader = r.body.getReader();
    const chunks = [];
    let got = 0;
    while (got < 131072) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
    }
    ctrl.abort();
    const buf = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.length, got - o)), o); o += c.length; }
    return sizeFromBytes(buf);
  } catch { return null; } finally { clearTimeout(t); }
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BAD_HINTS = /(^|[\/_\-.])(lifestyle|model|banner|swatch|texture|before|after|howto|how-to|routine|campaign|editorial|hand|hands|review|award|gift|bundle|kit|duo|trio|collection|benefits|infographic)([\/_\-.]|$)/i;
const GOOD_HINTS = /(^|[\/_\-.])(front|main|packshot|primary|01|1)([\/_\-.]|$)/i;

export async function rankProductImages(images, brand) {
  const b = slug(brand);
  const seen = new Set();
  const list = images.filter((i) => i && isSafeUrl(i.url) && !seen.has(i.url.split('?')[0]) && seen.add(i.url.split('?')[0]));
  const scored = await Promise.all(list.map(async (i, idx) => {
    const size = await imageSize(i.url);
    const host = (() => { try { return new URL(i.page || i.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    let score = 0;
    if (b && slug(host).includes(b)) score += 45;            // brand's own store = newest packaging
    if (i.source === 'Open Beauty Facts') score -= 35;        // user-taken photos, often old or blurry
    if (size) {
      const m = Math.min(size.w, size.h);
      if (m < 380) return null;                              // too small to look sharp
      score += m >= 1000 ? 35 : m >= 700 ? 25 : m >= 500 ? 12 : 0;
      const r = size.h / size.w;
      score += r >= 0.9 && r <= 1.6 ? 8 : r > 2.5 || r < 0.5 ? -15 : 0;
    } else score -= 10;
    const path = decodeURIComponent(i.url.split('?')[0]);
    if (BAD_HINTS.test(path)) score -= 30;
    if (GOOD_HINTS.test(path)) score += 6;
    score -= idx * 0.5;                                       // keep the page's own order as a tie-breaker
    return { ...i, w: size?.w, h: size?.h, score };
  }));
  return scored.filter(Boolean).sort((a, b2) => b2.score - a.score);
}
