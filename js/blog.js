// Feed del blog: carga los posts de /api/posts con busqueda, filtro por tag,
// "solo con fotos" y paginacion. El estado vive en la URL (?q=&tag=&photos=1&page=2
// o ?post=ID para un post suelto), asi que los enlaces se pueden compartir.
(function () {
  const { renderPost, escapeHtml } = window.PostRender;

  const $posts = document.getElementById('posts');
  const $status = document.getElementById('feed-status');
  const $pagination = document.getElementById('pagination');
  const $form = document.getElementById('filters');
  const $q = document.getElementById('filter-q');
  const $tag = document.getElementById('filter-tag');
  const $photos = document.getElementById('filter-photos');
  const $clear = document.getElementById('filter-clear');
  const $tagCloud = document.getElementById('tag-cloud');

  let state = readUrl();
  let requestId = 0;

  function readUrl() {
    const p = new URLSearchParams(location.search);
    return {
      q: p.get('q') || '',
      tag: p.get('tag') || '',
      photos: p.get('photos') === '1',
      page: Math.max(1, parseInt(p.get('page'), 10) || 1),
      post: parseInt(p.get('post'), 10) || null,
    };
  }

  function toQuery(s) {
    const p = new URLSearchParams();
    if (s.post) {
      p.set('post', s.post);
    } else {
      if (s.q) p.set('q', s.q);
      if (s.tag) p.set('tag', s.tag);
      if (s.photos) p.set('photos', '1');
      if (s.page > 1) p.set('page', s.page);
    }
    const str = p.toString();
    return str ? `?${str}` : '';
  }

  function navigate(changes, { replace = false, scroll = true } = {}) {
    state = { ...state, post: null, ...changes };
    const url = location.pathname + toQuery(state);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    syncInputs();
    load();
    if (scroll) document.querySelector('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncInputs() {
    if (document.activeElement !== $q) $q.value = state.q;
    $tag.value = state.tag;
    $photos.checked = state.photos;
    $clear.hidden = !(state.q || state.tag || state.photos || state.post);
    $form.hidden = Boolean(state.post);
  }

  async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function showPosts(posts) {
    $posts.replaceChildren();
    for (const post of posts) {
      $posts.appendChild(renderPost(post));
      const divider = document.createElement('div');
      divider.className = 'divider';
      divider.textContent = '· · · ✦ · · ·';
      $posts.appendChild(divider);
    }
  }

  async function load() {
    const id = ++requestId;
    $status.textContent = 'cargando posts...';
    $pagination.replaceChildren();

    try {
      if (state.post) {
        const { post } = await getJson(`/api/posts/${state.post}`);
        if (id !== requestId) return;
        showPosts([post]);
        $status.innerHTML = '<a href="/" data-nav="home">← ver todos los posts</a>';
        document.title = `${post.title || 'post'} · mibullfire's blog ~ ✦`;
        return;
      }

      const params = new URLSearchParams({ page: state.page });
      if (state.q) params.set('q', state.q);
      if (state.tag) params.set('tag', state.tag);
      if (state.photos) params.set('photos', '1');
      const data = await getJson(`/api/posts?${params}`);
      if (id !== requestId) return;

      document.title = "mibullfire's blog ~ ✦";
      showPosts(data.posts);
      const filtering = state.q || state.tag || state.photos;
      if (data.total === 0) {
        $status.textContent = filtering ? 'no hay posts que coincidan con la búsqueda :(' : 'todavía no hay posts';
      } else if (filtering) {
        $status.textContent = `${data.total} post${data.total === 1 ? '' : 's'} encontrado${data.total === 1 ? '' : 's'}`;
      } else {
        $status.textContent = '';
      }
      renderPagination(data.page, data.totalPages);
    } catch (err) {
      if (id !== requestId) return;
      $posts.replaceChildren();
      $status.textContent = `no se pudieron cargar los posts (${err.message})`;
    }
  }

  // « anterior  1 … 4 [5] 6 … 12  siguiente »
  function renderPagination(page, totalPages) {
    if (totalPages <= 1) return;
    const items = [];
    const link = (p, label, extra = '') =>
      `<a href="${toQuery({ ...state, page: p }) || '/'}" data-page="${p}" ${extra}>${label}</a>`;

    items.push(page > 1 ? link(page - 1, '« anterior', 'rel="prev"') : '<span class="disabled">« anterior</span>');
    let last = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) continue;
      if (p - last > 1) items.push('<span class="gap">…</span>');
      items.push(p === page ? `<span class="current" aria-current="page">${p}</span>` : link(p, p));
      last = p;
    }
    items.push(page < totalPages ? link(page + 1, 'siguiente »', 'rel="next"') : '<span class="disabled">siguiente »</span>');
    $pagination.innerHTML = items.join('');
  }

  async function loadTags() {
    try {
      const { tags } = await getJson('/api/tags');
      for (const { tag, count } of tags) {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = `#${tag} (${count})`;
        $tag.appendChild(opt);
      }
      $tag.value = state.tag;
      $tagCloud.innerHTML = tags.length
        ? tags.map(({ tag, count }) =>
            `<a class="tag" href="/?tag=${encodeURIComponent(tag)}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)} <small>${count}</small></a>`
          ).join('')
        : '<span class="muted">sin tags todavía</span>';
    } catch {
      $tagCloud.innerHTML = '<span class="muted">no se pudieron cargar</span>';
    }
  }

  // ── Eventos ──

  let typingTimer;
  $q.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => navigate({ q: $q.value.trim(), page: 1 }, { replace: true, scroll: false }), 350);
  });
  $form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(typingTimer);
    navigate({ q: $q.value.trim(), page: 1 }, { scroll: false });
  });
  $tag.addEventListener('change', () => navigate({ tag: $tag.value, page: 1 }, { scroll: false }));
  $photos.addEventListener('change', () => navigate({ photos: $photos.checked, page: 1 }, { scroll: false }));
  $clear.addEventListener('click', () => navigate({ q: '', tag: '', photos: false, page: 1 }, { scroll: false }));

  // Enlaces internos (tags, paginas, permalinks) sin recargar la pagina.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest('a');
    if (!a) return;

    if (a.dataset.tag !== undefined) {
      e.preventDefault();
      navigate({ tag: a.dataset.tag, q: '', photos: false, page: 1 });
    } else if (a.dataset.page) {
      e.preventDefault();
      navigate({ page: Number(a.dataset.page) });
    } else if (a.dataset.nav === 'home') {
      e.preventDefault();
      navigate({ page: 1 });
    } else if (a.closest('.post-header') || a.classList.contains('post-comments-link')) {
      const id = new URL(a.href).searchParams.get('post');
      if (!id) return;
      e.preventDefault();
      navigate({ post: Number(id) });
    } else if (a.closest('.post-images')) {
      e.preventDefault();
      openLightbox(a.href);
    }
  });

  window.addEventListener('popstate', () => {
    state = readUrl();
    syncInputs();
    load();
  });

  // ── Visor de fotos ──

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.hidden = true;
  lightbox.innerHTML = '<img alt="foto del post" />';
  lightbox.addEventListener('click', () => { lightbox.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox.hidden = true; });
  document.body.appendChild(lightbox);

  function openLightbox(src) {
    lightbox.querySelector('img').src = src;
    lightbox.hidden = false;
  }

  syncInputs();
  load();
  loadTags();
})();
