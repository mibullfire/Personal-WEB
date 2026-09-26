// Panel para publicar en el blog. La contraseña se manda en la cabecera
// X-Admin-Password de cada peticion; el servidor la compara con ADMIN_PASSWORD.
(function () {
  const { renderPost } = window.PostRender;

  const MAX_IMAGES = 4;
  const MAX_CHARS = 10000;
  const MAX_SIDE = 2048; // las fotos se reducen a este tamaño antes de subirlas
  const STORAGE_KEY = 'blog_admin_password';

  const $ = (id) => document.getElementById(id);
  const $login = $('login');
  const $app = $('app');
  const $composer = $('composer');
  const $body = $('body');
  const $counter = $('counter');
  const $photos = $('photos');
  const $previews = $('previews');
  const $publish = $('publish');
  const $msg = $('composer-msg');
  const $posts = $('posts');
  const $more = $('more');

  let password = '';
  let images = []; // [{ file: Blob, url: string }]
  let nextPage = 1;

  // ── Almacenamiento (puede fallar en modo privado) ──

  function storedPassword() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || '';
    } catch { return ''; }
  }
  function storePassword(value, remember) {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
      if (remember) localStorage.setItem(STORAGE_KEY, value);
    } catch { /* sin almacenamiento: habra que escribirla cada vez */ }
  }
  function forgetPassword() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* nada */ }
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'X-Admin-Password': password, Accept: 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout('La contraseña ya no es válida');
    }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  // ── Entrar / salir ──

  async function tryLogin(value, remember) {
    password = value;
    await api('/api/admin/check', { method: 'POST' });
    storePassword(value, remember);
    $login.hidden = true;
    $app.hidden = false;
    $body.focus();
    loadPosts(true);
    loadTags();
  }

  function logout(message) {
    password = '';
    forgetPassword();
    $app.hidden = true;
    $login.hidden = false;
    $('password').value = '';
    $('login-msg').textContent = message || '';
  }

  $login.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-msg').textContent = '';
    try {
      await tryLogin($('password').value, $('remember').checked);
    } catch (err) {
      $('login-msg').textContent = err.message;
    }
  });
  $('logout').addEventListener('click', () => logout());

  // ── Fotos ──

  // Reduce la foto a MAX_SIDE px y la pasa a JPEG: las del movil pesan
  // muchisimo y asi tambien se convierten las HEIC del iPhone (si el
  // navegador sabe leerlas). Los GIF se suben tal cual para no perder la animacion.
  async function prepareImage(file) {
    if (file.type === 'image/gif') return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
      if (!blob) return file;
      const alreadyFine = scale === 1 && /^image\/(jpeg|png|webp)$/.test(file.type);
      return alreadyFine && file.size <= blob.size ? file : blob;
    } catch {
      return file; // el servidor dira si no es un formato valido
    }
  }

  function renderPreviews() {
    $previews.replaceChildren();
    images.forEach((img, i) => {
      const div = document.createElement('div');
      div.className = 'preview';
      div.innerHTML = '<img alt="" /><button type="button" aria-label="quitar foto">✕</button>';
      div.querySelector('img').src = img.url;
      div.querySelector('button').addEventListener('click', () => {
        URL.revokeObjectURL(img.url);
        images.splice(i, 1);
        renderPreviews();
      });
      $previews.appendChild(div);
    });
    $('add-photos').disabled = images.length >= MAX_IMAGES;
  }

  $('add-photos').addEventListener('click', () => $photos.click());
  $photos.addEventListener('change', async () => {
    const files = [...$photos.files];
    $photos.value = '';
    const room = MAX_IMAGES - images.length;
    if (files.length > room) showMsg(`Máximo ${MAX_IMAGES} fotos por post`, 'error');
    for (const file of files.slice(0, room)) {
      const prepared = await prepareImage(file);
      images.push({ file: prepared, url: URL.createObjectURL(prepared) });
      renderPreviews();
    }
  });

  // ── Publicar ──

  function showMsg(text, kind) {
    $msg.textContent = text;
    $msg.className = `msg ${kind || ''}`;
  }

  function updateCounter() {
    const n = $body.value.length;
    $counter.textContent = `${n} / ${MAX_CHARS}`;
    $counter.classList.toggle('over', n > MAX_CHARS * 0.95);
  }
  $body.addEventListener('input', updateCounter);
  $body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $composer.requestSubmit();
  });

  $composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!$body.value.trim() && images.length === 0) {
      return showMsg('Escribe algo o añade alguna foto', 'error');
    }

    const form = new FormData();
    for (const field of ['body', 'title', 'mood', 'music', 'tags']) form.append(field, $(field).value);
    images.forEach((img, i) => {
      const ext = img.file.type === 'image/gif' ? 'gif' : 'jpg';
      form.append('images', img.file, img.file.name || `foto-${i + 1}.${ext}`);
    });

    $publish.disabled = true;
    showMsg('publicando...');
    try {
      const { post } = await api('/api/posts', { method: 'POST', body: form });
      $composer.reset();
      images.forEach((img) => URL.revokeObjectURL(img.url));
      images = [];
      renderPreviews();
      updateCounter();
      showMsg('¡publicado! ✦', 'ok');
      $posts.prepend(renderPost(post, { onDelete }));
      loadTags();
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      $publish.disabled = false;
    }
  });

  // ── Tus posts ──

  async function onDelete(post, el) {
    const name = post.title ? `"${post.title}"` : 'este post';
    if (!confirm(`¿Borrar ${name}? Se borrarán también sus fotos. No se puede deshacer.`)) return;
    const btn = el.querySelector('.danger-btn');
    btn.disabled = true;
    try {
      await api(`/api/posts/${post.id}`, { method: 'DELETE' });
      el.remove();
      loadTags();
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  }

  async function loadPosts(reset) {
    if (reset) {
      nextPage = 1;
      $posts.replaceChildren();
    }
    $more.disabled = true;
    try {
      const data = await api(`/api/posts?page=${nextPage}`);
      for (const post of data.posts) $posts.appendChild(renderPost(post, { onDelete }));
      $more.hidden = data.page >= data.totalPages;
      nextPage = data.page + 1;
    } catch (err) {
      showMsg(`No se pudieron cargar los posts: ${err.message}`, 'error');
    } finally {
      $more.disabled = false;
    }
  }
  $more.addEventListener('click', () => loadPosts(false));

  async function loadTags() {
    try {
      const { tags } = await api('/api/tags');
      $('tag-list').replaceChildren(...tags.map(({ tag }) => Object.assign(document.createElement('option'), { value: tag })));
    } catch { /* solo son sugerencias */ }
  }

  // Si ya habia contraseña guardada, se entra directamente.
  const saved = storedPassword();
  if (saved) tryLogin(saved, false).catch(() => logout());
})();
