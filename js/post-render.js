// Pinta un post del blog. Lo usan blog.html y admin.html.
//
// Formato del texto (tipo Twitter, sin HTML):
//   linea en blanco   -> parrafo nuevo
//   **texto**         -> negrita
//   *texto*           -> cursiva
//   > texto           -> cita
//   https://...       -> enlace
(function () {
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }

  // Los enlaces se separan antes de aplicar negrita/cursiva para no romperlos.
  function formatInline(text) {
    return text
      .split(URL_RE)
      .map((part, i) => {
        if (i % 2 === 0) return formatText(part);
        const url = escapeHtml(part);
        return `<a href="${url}" target="_blank" rel="noopener nofollow">${url}</a>`;
      })
      .join('');
  }

  function formatBody(body) {
    return String(body || '')
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('>'))) {
          const inner = lines.map((l) => formatInline(l.replace(/^>\s?/, ''))).join('<br>');
          return `<blockquote>${inner}</blockquote>`;
        }
        return `<p>${lines.map(formatInline).join('<br>')}</p>`;
      })
      .join('');
  }

  // "17 de julio 2026 · 13:15", siempre en hora de Madrid.
  function formatDate(iso) {
    const parts = {};
    new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .forEach((p) => { parts[p.type] = p.value; });
    return `${parts.day} de ${MONTHS[parts.month - 1]} ${parts.year} · ${Number(parts.hour)}:${parts.minute}`;
  }

  // opts.onDelete(post): si se pasa, muestra el boton de borrar (panel admin).
  function renderPost(post, opts = {}) {
    const el = document.createElement('article');
    el.className = 'panel post';
    el.id = `post-${post.id}`;

    const permalink = `/?post=${post.id}`;
    const title = post.title ? escapeHtml(post.title) : '✦';
    const meta = [];
    if (post.mood) meta.push(`<span class="mood">mood: <em>${escapeHtml(post.mood)}</em></span>`);
    if (post.music) meta.push(`<span class="music">🎵 ${escapeHtml(post.music)}</span>`);

    const images = post.images || [];
    const imagesHtml = images.length
      ? `<div class="post-images n-${images.length}">${images
          .map((name) => `<a href="/uploads/${encodeURIComponent(name)}" target="_blank" rel="noopener">`
            + `<img src="/uploads/${encodeURIComponent(name)}" alt="foto del post" loading="lazy" /></a>`)
          .join('')}</div>`
      : '';

    const tags = (post.tags || [])
      .map((t) => `<a class="tag" href="/?tag=${encodeURIComponent(t)}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</a>`)
      .join('');

    el.innerHTML = `
      <div class="post-header">
        <span class="post-title"><a href="${permalink}">${title}</a></span>
        <a class="post-date" href="${permalink}">${formatDate(post.created_at)}</a>
      </div>
      ${meta.length ? `<div class="post-meta">${meta.join('')}</div>` : ''}
      <div class="post-body">${formatBody(post.body)}${imagesHtml}</div>
      <div class="post-footer">
        <div class="post-tags">${tags}</div>
        <span class="post-actions">
          <a class="post-comments-link" href="${permalink}">enlace ✦</a>
        </span>
      </div>`;

    if (opts.onDelete) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'danger-btn';
      btn.textContent = 'borrar';
      btn.addEventListener('click', () => opts.onDelete(post, el));
      el.querySelector('.post-actions').appendChild(btn);
    }
    return el;
  }

  window.PostRender = { renderPost, formatBody, formatDate, escapeHtml };
})();
