/**
 * Serve the crawled snapshots as a website, so visual diffs compare against a
 * FIXED reference instead of the moving live site.
 *
 * The live site reorders its homepage blog cards between requests (observed
 * three times during this build), which makes it useless as a diff target: a
 * passing page can fail an hour later for reasons that have nothing to do with
 * the port. The snapshot in data/raw/ is the contract.
 *
 * Static assets are served from public/, which was mirrored byte-identically, so
 * the only thing being compared is the markup.
 *
 * Usage: node scripts/snapshot-server.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeName } from './lib/common.mjs';

const PORT = parseInt(process.argv[2] ?? '3200', 10);
const RAW_DIR = fileURLToPath(new URL('../data/raw/', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

/**
 * Point the snapshot at this server for same-origin assets. Without this the
 * snapshot would fetch from the live host, reintroducing network variance and
 * defeating the purpose.
 */
function rewriteOrigin(html, origin) {
  return html.replace(/https?:\/\/(?:www\.)?srmflexilearn\.com/g, origin);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);
  const origin = `http://localhost:${PORT}`;

  // Static asset?
  if (extname(pathname)) {
    const file = join(PUBLIC_DIR, pathname);
    if (file.startsWith(PUBLIC_DIR)) {
      try {
        const body = await readFile(file);
        res.writeHead(200, {
          'Content-Type': MIME[extname(pathname).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(body);
        return;
      } catch {
        // fall through to 404
      }
    }
  }

  // Page snapshot
  const name = `${safeName(pathname)}.html`;
  try {
    const file = join(RAW_DIR, name);
    await stat(file);
    const html = await readFile(file, 'utf8');
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(rewriteOrigin(html, origin));
    return;
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`no snapshot for ${pathname} (looked for ${name})`);
  }
});

server.listen(PORT, () => {
  console.log(`snapshot server on http://localhost:${PORT}`);
  console.log(`  pages  <- ${RAW_DIR}`);
  console.log(`  assets <- ${PUBLIC_DIR}`);
});
