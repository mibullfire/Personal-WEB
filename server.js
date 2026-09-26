const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./lib/api');
const db = require('./lib/db');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Dominio -> fichero que se sirve en "/"
const BLOG_HOST = 'blog.mibullfire.com';
const MAIN_HOST = 'mibullfire.com';

const HOME_BY_HOST = {
  [BLOG_HOST]: 'blog.html',
};
const DEFAULT_HOME = 'index.html';

// Paginas que pertenecen a la web principal: si se piden desde el blog,
// se redirigen al dominio principal (y al reves con blog.html).
const MAIN_ONLY = new Set(['/index.html', '/aplicaciones.html']);

// Codigo del servidor y ficheros internos: nunca se sirven como estaticos.
const PRIVATE_ROOT_FILES = new Set([
  'server.js', 'package.json', 'package-lock.json', 'desktop.ini', 'README.md', 'instalacion.md',
]);
const PRIVATE_DIRS = new Set(['lib', 'node_modules', 'uploads']);

function isPrivatePath(relPath) {
  const parts = relPath.split(/[\\/]/);
  if (parts.some((p) => p.startsWith('.'))) return true;
  if (PRIVATE_DIRS.has(parts[0])) return true;
  return parts.length === 1 && PRIVATE_ROOT_FILES.has(parts[0]);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// "Blog.MiBullfire.com:443" -> "blog.mibullfire.com"; quita el www.
function normalizeHost(rawHost) {
  const host = String(rawHost || '').toLowerCase().split(',')[0].trim();
  const withoutPort = host.replace(/:\d+$/, '');
  return withoutPort.replace(/^www\./, '');
}

function isBlogHost(host) {
  return host === BLOG_HOST;
}

// En local no se redirige entre dominios, para poder probar todo en localhost.
function isLocalHost(host) {
  return host === 'localhost' || host === '127.0.0.1';
}

function redirect(res, location, permanent = false) {
  res.writeHead(permanent ? 301 : 302, { Location: location });
  res.end();
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(req, res, relPath, extraHeaders = {}) {
  const filePath = path.join(ROOT, relPath);

  // Path traversal: nunca salir de la carpeta del proyecto.
  if (!filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      ...extraHeaders,
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const host = normalizeHost(req.headers.host);
  const blog = isBlogHost(host);
  const local = isLocalHost(host);

  let url;
  let pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (pathname.includes('\0')) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // API del blog y fotos subidas (GET, POST y DELETE).
  if (await api.handle(req, res, pathname, url.searchParams)) return;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  // Raiz: index.html o blog.html segun el dominio.
  if (pathname === '/' || pathname === '') {
    const home = HOME_BY_HOST[host] || DEFAULT_HOME;
    return serveFile(req, res, home, { 'X-Served-Site': blog ? 'blog' : 'main' });
  }

  // Panel para publicar posts: vive en el blog.
  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
    if (!blog && !local) return redirect(res, `https://${BLOG_HOST}/admin`);
    return serveFile(req, res, 'admin.html', { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  if (blog) {
    // En el blog, /blog.html es la home: se canonicaliza a "/".
    if (pathname === '/blog.html') return redirect(res, '/' + url.search);
    // Enlaces internos del blog hacia la web principal.
    if (MAIN_ONLY.has(pathname)) return redirect(res, `https://${MAIN_HOST}${pathname}`);
  } else if (pathname === '/blog.html' && !local) {
    // En el dominio principal, el blog vive en su subdominio.
    return redirect(res, `https://${BLOG_HOST}/` + url.search);
  }

  // Resto de ficheros estaticos (css, js, img, apps/...) en ambos dominios.
  const relPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
  if (isPrivatePath(relPath)) {
    return send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  serveFile(req, res, relPath);
});

if (db.enabled()) {
  // Si la base de datos aun no responde, la web estatica sigue funcionando
  // y se reintenta al llegar la primera peticion a la API.
  db.ready().catch((err) => console.error('No se pudo inicializar la base de datos:', err.message));
} else {
  console.warn('DATABASE_URL no definida: el blog no tendra posts.');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  console.log(`Fotos del blog en ${api.UPLOAD_DIR}`);
});
