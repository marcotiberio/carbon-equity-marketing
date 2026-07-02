// Tiny zero-dependency dev server for the live copy editor.
//   npm run dev  ->  http://localhost:4000/editor/
// It serves the repo statically and, crucially, accepts `PUT /content.json`
// from the editor so "Save" writes copy straight back to disk. On static
// hosting (GitHub Pages) that PUT isn't available and the editor falls back to
// downloading the file instead.
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
};

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);

    // Persist copy edits from the editor.
    if (req.method === 'PUT' && pathname === '/content.json') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString('utf8');
      JSON.parse(body); // reject malformed writes
      await writeFile(join(ROOT, 'content.json'), body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }

    if (pathname === '/') pathname = '/editor/';
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Contain requests to the repo root.
    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, {
      'content-type': TYPES[extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Carbon Equity copy editor`);
  console.log(`  → http://localhost:${PORT}/editor/\n`);
});
