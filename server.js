import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '7001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'rsvps.db');

// Initialize SQLite (Node 22 native DatabaseSync with fallback to JSON)
let db = null;
let useJsonStore = false;
const JSON_DB_FILE = path.join(__dirname, 'rsvps.json');

try {
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      attendance TEXT NOT NULL,
      pax INTEGER NOT NULL,
      wish TEXT NOT NULL,
      visible INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL,
      rate_key TEXT NOT NULL
    );
  `);
  console.log('Using SQLite database at', DB_FILE);
} catch (err) {
  console.warn('node:sqlite not available, falling back to JSON storage:', err.message);
  useJsonStore = true;
  if (!fs.existsSync(JSON_DB_FILE)) {
    fs.writeFileSync(JSON_DB_FILE, JSON.stringify([]), 'utf8');
  }
}

function getJsonRsvps() {
  try {
    return JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function saveJsonRsvps(data) {
  fs.writeFileSync(JSON_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/rsvp') {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET') {
      try {
        if (!useJsonStore && db) {
          const query = db.prepare(
            'SELECT name, attendance, wish, created_at FROM rsvps WHERE visible = 1 AND wish != ? ORDER BY created_at DESC LIMIT 100'
          );
          const results = query.all('');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messages: results }));
        } else {
          const all = getJsonRsvps();
          const visible = all
            .filter(r => r.visible === 1 && r.wish)
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, 100)
            .map(({ name, attendance, wish, created_at }) => ({ name, attendance, wish, created_at }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messages: visible }));
        }
      } catch (err) {
        console.error('Error fetching RSVPs:', err);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ucapan belum dapat dimuatkan. Sila cuba lagi.' }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 8000) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Jawapan terlalu panjang.' }));
          req.destroy();
        }
      });

      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const name = typeof data.name === 'string' ? data.name.trim() : '';
          const wish = typeof data.wish === 'string' ? data.wish.trim() : '';

          if (
            data.website ||
            !name ||
            name.length > 100 ||
            wish.length > 1000 ||
            !['Hadir', 'Tidak hadir'].includes(data.attendance) ||
            !Number.isInteger(data.pax) ||
            data.pax < 0 ||
            data.pax > 6 ||
            typeof data.id !== 'string' ||
            (data.attendance === 'Hadir' && data.pax < 1)
          ) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sila semak nama dan butiran kehadiran.' }));
            return;
          }

          const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
          const rateKey = crypto.createHash('sha256').update(String(ip)).digest('hex');
          const now = Date.now();

          if (!useJsonStore && db) {
            const checkStmt = db.prepare('SELECT id FROM rsvps WHERE id = ?');
            const existing = checkStmt.get(data.id);
            if (existing) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            const countStmt = db.prepare('SELECT COUNT(*) AS total FROM rsvps WHERE rate_key = ? AND created_at > ?');
            const count = countStmt.get(rateKey, now - 3600000);
            if (Number(count?.total) > 9) {
              res.writeHead(429, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Terlalu banyak jawapan. Sila cuba lagi kemudian atau gunakan WhatsApp.' }));
              return;
            }

            const insertStmt = db.prepare(
              'INSERT INTO rsvps (id, name, attendance, pax, wish, visible, created_at, rate_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            insertStmt.run(
              data.id,
              name,
              data.attendance,
              data.attendance === 'Hadir' ? data.pax : 0,
              wish,
              data.visible === true ? 1 : 0,
              now,
              rateKey
            );
          } else {
            const list = getJsonRsvps();
            if (list.some(r => r.id === data.id)) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            const recentCount = list.filter(r => r.rate_key === rateKey && r.created_at > now - 3600000).length;
            if (recentCount > 9) {
              res.writeHead(429, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Terlalu banyak jawapan. Sila cuba lagi kemudian atau gunakan WhatsApp.' }));
              return;
            }

            list.push({
              id: data.id,
              name,
              attendance: data.attendance,
              pax: data.attendance === 'Hadir' ? data.pax : 0,
              wish,
              visible: data.visible === true ? 1 : 0,
              created_at: now,
              rate_key: rateKey
            });
            saveJsonRsvps(list);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error('Error saving RSVP:', err);
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Jawapan belum disimpan. Sila cuba lagi atau gunakan WhatsApp.' }));
        }
      });
      return;
    }
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Handle client abort / disconnect to prevent EPIPE errors
  res.on('error', () => {});
  req.on('error', () => {});

  serveStaticFile(req, res, filePath);
});

// In-memory cache for static files
const staticCache = new Map();

function serveStaticFile(req, res, targetPath) {
  fs.stat(targetPath, (err, stats) => {
    let resolvedPath = targetPath;
    let fileStats = stats;

    if (err || !stats.isFile()) {
      resolvedPath = path.join(PUBLIC_DIR, 'index.html');
      try {
        fileStats = fs.statSync(resolvedPath);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';
    const isImmutable = !isHtml && (
      resolvedPath.includes('/assets/') ||
      ['.webp', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.woff2'].includes(ext)
    );

    const mtime = fileStats.mtime.toUTCString();
    const etag = `W/"${fileStats.size.toString(16)}-${fileStats.mtimeMs.toString(16)}"`;

    // 304 Not Modified check
    if (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === mtime) {
      res.writeHead(304);
      res.end();
      return;
    }

    const cacheControl = isImmutable
      ? 'public, max-age=31536000, immutable'
      : isHtml
        ? 'public, max-age=120, stale-while-revalidate=600'
        : 'public, max-age=86400';

    const cached = staticCache.get(resolvedPath);
    if (cached && cached.mtimeMs === fileStats.mtimeMs) {
      if (res.writableEnded) return;
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': cached.buffer.length,
        'Cache-Control': cacheControl,
        'ETag': etag,
        'Last-Modified': mtime,
      });
      res.end(cached.buffer);
      return;
    }

    fs.readFile(resolvedPath, (readErr, content) => {
      if (readErr || res.writableEnded) {
        if (!res.writableEnded) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
        return;
      }

      // Cache files smaller than 10MB in memory
      if (content.length < 10 * 1024 * 1024) {
        staticCache.set(resolvedPath, { buffer: content, mtimeMs: fileStats.mtimeMs });
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': cacheControl,
        'ETag': etag,
        'Last-Modified': mtime,
      });
      res.end(content);
    });
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Wedding Server running at http://${HOST}:${PORT}`);
});
