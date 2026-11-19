// Local preview: serves site/ and a fake Apps Script endpoint at /exec backed by
// the real apps-script/Code.gs running against an in-memory sheet.
//   node tests/dev-server.mjs            → http://localhost:8080
//   then set REG_CONFIG.endpoint = '/exec', token = 'dev-token' (or use ?dev in the URL)
// GET /__sheet shows what was "written". POST /exec?fail=1 simulates a server error.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEnv } from './gas-mock.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const env = makeEnv({ token: 'dev-token' });
const port = +process.env.PORT || 8080;
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      const delay = +(url.searchParams.get('delay') || 600);
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
        if (url.searchParams.get('fail')) return res.end('{"ok":false,"error":"server_error","message":"x"}');
        res.end(JSON.stringify(env.post(body)));
      }, delay);
    });
    return;
  }
  if (url.pathname === '/__sheet') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ Enugu: env.sheets.Enugu.rows, Bayelsa: env.sheets.Bayelsa.rows }, null, 1));
  }
  // Emulate site/vercel.json host rules. Locally, enugu-ev-registration.localhost
  // stands in for enugu-ev-registration.vercel.app (first host label must match).
  const label = h => String(h || '').split(':')[0].split('.')[0];
  const hostIs = r => (r.has || []).some(c => c.type === 'host' && label(c.value) === label(req.headers.host));
  for (const r of vercel.redirects || []) {
    const m = new RegExp('^/(enugu|bayelsa)(/|$)').test(url.pathname);
    if (m && hostIs(r)) { res.writeHead(307, { location: r.destination }); return res.end(); }
  }
  for (const r of vercel.rewrites || []) {
    if (url.pathname === r.source && hostIs(r)) { url.pathname = r.destination; break; }
  }
  let p = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' }); return res.end(); }
    p = path.join(p, 'index.html');
  }
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  let data = fs.readFileSync(p);
  // dev only: point the config at the mock endpoint without editing app.js
  if (p.endsWith('app.js')) data = Buffer.from(String(data).replace("endpoint: '',", "endpoint: '/exec',").replace("token: '',", "token: 'dev-token',"));
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  res.end(data);
}).listen(port, () => console.log(`http://localhost:${port}`));
