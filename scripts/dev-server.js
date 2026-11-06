// Local dev server that mirrors Vercel's static routing (cleanUrls, redirects
// and rewrites from vercel.json) and serves /api/*.js as serverless-style
// handlers, without requiring `vercel dev` / a Vercel login. Run with `npm run dev`.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

// Minimal .env loader (no dependency) so CRM_URL etc. can live in a
// gitignored .env file instead of being exported in every shell session.
const envFile = await statOrNull(path.join(ROOT, '.env'));
if (envFile) {
  const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const vercelConfig = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'));
const redirects = vercelConfig.redirects || [];
const rewrites = vercelConfig.rewrites || [];

// Rewrites with :name segments only (e.g. /p/:code -> /partner), which is all
// vercel.json uses. The address bar keeps the original path, as on Vercel.
function rewrite(pathname) {
  for (const r of rewrites) {
    const names = [];
    const pattern = r.source
      .split('/')
      .map((part) => {
        if (part.startsWith(':')) {
          names.push(part.slice(1));
          return '([^/]+)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    const m = pathname.match(new RegExp(`^${pattern}$`));
    if (m) return r.destination.replace(/:(\w+)/g, (_, n) => m[names.indexOf(n) + 1] ?? '');
  }
  return pathname;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

async function statOrNull(p) {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

async function resolveStatic(pathname) {
  const clean = decodeURIComponent(pathname);
  const candidates = [];
  const direct = path.join(ROOT, clean);
  if (path.extname(clean)) {
    candidates.push(direct);
  } else if (clean === '/') {
    candidates.push(path.join(ROOT, 'index.html'));
  } else {
    candidates.push(`${direct}.html`);
    candidates.push(path.join(direct, 'index.html'));
  }
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(ROOT)) continue; // guard against path traversal
    const s = await statOrNull(resolved);
    if (s && s.isFile()) return resolved;
  }
  return null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function withHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  const redirect = redirects.find((r) => r.source === pathname);
  if (redirect) {
    res.statusCode = redirect.permanent ? 308 : 307;
    res.setHeader('Location', redirect.destination);
    return res.end();
  }

  if (pathname.startsWith('/api/')) {
    const name = pathname.slice('/api/'.length);
    const modPath = path.join(ROOT, 'api', `${name}.js`);
    if (await statOrNull(modPath)) {
      withHelpers(res);
      req.query = Object.fromEntries(url.searchParams);
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.body = await readJsonBody(req);
      }
      try {
        const mod = await import(`${pathToFileURL(modPath).href}?t=${Date.now()}`);
        await mod.default(req, res);
      } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: 'Handler error' });
      }
      return;
    }
  }

  const file = await resolveStatic(rewrite(pathname));
  if (file) {
    const ext = path.extname(file);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(await readFile(file));
    return;
  }

  res.statusCode = 404;
  const notFoundFile = path.join(ROOT, '404.html');
  if (await statOrNull(notFoundFile)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(await readFile(notFoundFile));
    return;
  }
  res.end(`Cannot GET ${pathname}`);
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
