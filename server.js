const http = require('http');
const fs = require('fs');
const path = require('path');

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

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const host = normalizeHost(req.headers.host);
  const blog = isBlogHost(host);

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (pathname.includes('\0')) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // Raiz: index.html o blog.html segun el dominio.
  if (pathname === '/' || pathname === '') {
    const home = HOME_BY_HOST[host] || DEFAULT_HOME;
    return serveFile(req, res, home, { 'X-Served-Site': blog ? 'blog' : 'main' });
  }

  if (blog) {
    // En el blog, /blog.html es la home: se canonicaliza a "/".
    if (pathname === '/blog.html') return redirect(res, '/');
    // Enlaces internos del blog hacia la web principal.
    if (MAIN_ONLY.has(pathname)) return redirect(res, `https://${MAIN_HOST}${pathname}`);
  } else if (pathname === '/blog.html') {
    // En el dominio principal, el blog vive en su subdominio.
    return redirect(res, `https://${BLOG_HOST}/`);
  }

  // Resto de ficheros estaticos (css, js, img, apps/...) en ambos dominios.
  serveFile(req, res, path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, ''));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
});
