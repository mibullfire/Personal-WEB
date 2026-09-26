const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const db = require('./db');

const PER_PAGE = 8;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGES * MAX_IMAGE_BYTES + 1024 * 1024;
const MAX_BODY_CHARS = 10000;
const MAX_FIELD_CHARS = 200;
const MAX_TAGS = 10;

// Fotos en el volumen de Railway (RAILWAY_VOLUME_MOUNT_PATH lo pone Railway
// al conectar un volumen). En local, carpeta uploads/ del proyecto.
const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', 'uploads'));

const UPLOAD_NAME = /^[0-9a-f-]{36}\.(jpg|png|gif|webp)$/;
const IMAGE_MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function sendJson(res, status, data) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(data));
}

// ── Contraseña del panel ──────────────────────────────────

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failsByIp = new Map();

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest();
}

// Comprueba la cabecera X-Admin-Password. Tras 5 fallos bloquea la IP 15 min.
// Devuelve true si esta autorizado; si no, ya ha respondido al cliente.
function checkAdmin(req, res) {
  if (!ADMIN_PASSWORD) {
    sendJson(res, 503, { error: 'ADMIN_PASSWORD no esta configurada en el servidor' });
    return false;
  }

  const ip = clientIp(req);
  const entry = failsByIp.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    sendJson(res, 429, { error: 'Demasiados intentos. Prueba en 15 minutos.' });
    return false;
  }

  const given = req.headers['x-admin-password'] || '';
  if (crypto.timingSafeEqual(sha256(given), sha256(ADMIN_PASSWORD))) {
    failsByIp.delete(ip);
    return true;
  }

  // Si habia un bloqueo ya caducado, se empieza a contar de cero.
  const fails = (entry && entry.lockedUntil === 0 ? entry.fails : 0) + 1;
  failsByIp.set(ip, { fails, lockedUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
  sendJson(res, 401, { error: 'Contraseña incorrecta' });
  return false;
}

// ── Subida de fotos ───────────────────────────────────────

// Tipo real segun los primeros bytes, no segun lo que diga el navegador.
function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function readForm(req) {
  const request = new Request('http://localhost' + req.url, {
    method: req.method,
    headers: req.headers,
    body: Readable.toWeb(req),
    duplex: 'half',
  });
  return request.formData();
}

function cleanText(value, max) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function parseTags(value) {
  const tags = String(value ?? '')
    .split(',')
    .map((t) => t.trim().replace(/^#/, '').slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

async function handleCreatePost(req, res) {
  const length = Number(req.headers['content-length']);
  if (!length || length > MAX_REQUEST_BYTES) {
    return sendJson(res, 413, { error: 'La publicacion es demasiado grande (maximo 4 fotos de 8 MB)' });
  }

  let form;
  try {
    form = await readForm(req);
  } catch {
    return sendJson(res, 400, { error: 'Formulario no valido' });
  }

  const body = cleanText(form.get('body'), MAX_BODY_CHARS);
  const files = form.getAll('images').filter((f) => typeof f === 'object' && f.size > 0);
  if (!body && files.length === 0) {
    return sendJson(res, 400, { error: 'El post necesita texto o alguna foto' });
  }
  if (files.length > MAX_IMAGES) {
    return sendJson(res, 400, { error: `Maximo ${MAX_IMAGES} fotos por post` });
  }

  const images = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return sendJson(res, 400, { error: `"${file.name}" pesa mas de 8 MB` });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = detectImageType(buf);
    if (!ext) {
      return sendJson(res, 400, { error: `"${file.name}" no es una imagen JPG, PNG, GIF o WebP` });
    }
    images.push({ name: `${crypto.randomUUID()}.${ext}`, buf });
  }

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  for (const img of images) {
    await fs.promises.writeFile(path.join(UPLOAD_DIR, img.name), img.buf);
  }

  try {
    const post = await db.createPost({
      title: cleanText(form.get('title'), MAX_FIELD_CHARS),
      body,
      mood: cleanText(form.get('mood'), MAX_FIELD_CHARS),
      music: cleanText(form.get('music'), MAX_FIELD_CHARS),
      tags: parseTags(form.get('tags')),
      images: images.map((i) => i.name),
    });
    sendJson(res, 201, { post });
  } catch (err) {
    await removeUploads(images.map((i) => i.name));
    throw err;
  }
}

async function removeUploads(names) {
  for (const name of names) {
    if (!UPLOAD_NAME.test(name)) continue;
    await fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
  }
}

function serveUpload(req, res, name) {
  if (!UPLOAD_NAME.test(name)) return sendJson(res, 404, { error: 'No encontrado' });
  const filePath = path.join(UPLOAD_DIR, name);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return sendJson(res, 404, { error: 'No encontrado' });
    res.writeHead(200, {
      'Content-Type': IMAGE_MIME[name.split('.').pop()],
      'Content-Length': stats.size,
      // El nombre es un UUID nuevo en cada subida: se puede cachear para siempre.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

// ── Router ────────────────────────────────────────────────

function positiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Atiende /api/* y /uploads/*. Devuelve false si la ruta no es suya.
async function handle(req, res, pathname, searchParams) {
  if (pathname.startsWith('/uploads/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method Not Allowed' });
    serveUpload(req, res, pathname.slice('/uploads/'.length));
    return true;
  }
  if (!pathname.startsWith('/api/')) return false;

  if (!db.enabled()) {
    sendJson(res, 503, { error: 'Base de datos no configurada (falta DATABASE_URL)' });
    return true;
  }

  try {
    await db.ready();
    const postMatch = pathname.match(/^\/api\/posts\/(\d+)$/);

    if (pathname === '/api/posts' && req.method === 'GET') {
      const result = await db.listPosts({
        page: positiveInt(searchParams.get('page'), 1),
        perPage: PER_PAGE,
        q: cleanText(searchParams.get('q'), 100),
        tag: cleanText(searchParams.get('tag'), 40),
        photos: searchParams.get('photos') === '1',
      });
      sendJson(res, 200, result);
    } else if (pathname === '/api/posts' && req.method === 'POST') {
      if (checkAdmin(req, res)) await handleCreatePost(req, res);
    } else if (postMatch && req.method === 'GET') {
      const post = await db.getPost(Number(postMatch[1]));
      if (post) sendJson(res, 200, { post });
      else sendJson(res, 404, { error: 'Post no encontrado' });
    } else if (postMatch && req.method === 'DELETE') {
      if (!checkAdmin(req, res)) return true;
      const deleted = await db.deletePost(Number(postMatch[1]));
      if (!deleted) return sendJson(res, 404, { error: 'Post no encontrado' }), true;
      await removeUploads(deleted.images);
      sendJson(res, 200, { ok: true });
    } else if (pathname === '/api/tags' && req.method === 'GET') {
      sendJson(res, 200, { tags: await db.listTags() });
    } else if (pathname === '/api/admin/check' && req.method === 'POST') {
      if (checkAdmin(req, res)) sendJson(res, 200, { ok: true });
    } else {
      sendJson(res, 404, { error: 'Ruta no encontrada' });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Error interno del servidor' });
  }
  return true;
}

module.exports = { handle, UPLOAD_DIR };
