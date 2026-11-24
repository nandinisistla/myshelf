// Local test server: serves /public and runs /api/*.js like Vercel does.
// Usage: LOCAL_PGLITE_PATH=<path to @electric-sql/pglite> MOCK_AI=1 node dev/server.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const PORT = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
    let mod;
    try { mod = await import(pathToFileURL(join(root, 'api', name + '.js')).href); }
    catch { res.writeHead(404); return res.end('Not found'); }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.query = Object.fromEntries(url.searchParams);
    req.body = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    res.send = (b) => { res.end(b); return res; };
    return mod.default(req, res);
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const data = await readFile(join(root, 'public', p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`MyShelf dev server on http://localhost:${PORT}`));
