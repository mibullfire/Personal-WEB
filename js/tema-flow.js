// Fondo Xbox Flow de las páginas de apps/ y juegos/: los colores vienen de tema-flow.css.
(function () {
  const flow = document.createElement('div');
  flow.className = 'xb-flow';
  flow.setAttribute('aria-hidden', 'true');
  flow.innerHTML = `
    <svg class="xb-flow-a" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <linearGradient id="xbRibbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style="stop-color:var(--accent)" stop-opacity="0" />
          <stop offset="0.5" style="stop-color:var(--accent)" stop-opacity="0.75" />
          <stop offset="1" style="stop-color:var(--xb-mid)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="xb-soft" d="M-100 520 C 300 300, 620 760, 960 520 S 1450 300, 1700 470" stroke="url(#xbRibbon)" stroke-width="120" opacity="0.14" />
      <path class="xb-soft" d="M-100 560 C 320 360, 620 800, 980 560 S 1450 360, 1700 520" stroke="url(#xbRibbon)" stroke-width="44" opacity="0.26" />
      <path d="M-100 540 C 310 330, 620 780, 970 540 S 1450 330, 1700 495" stroke="url(#xbRibbon)" stroke-width="2.5" />
    </svg>
    <svg class="xb-flow-b" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none">
      <path class="xb-soft" d="M-100 300 C 260 520, 640 120, 1000 340 S 1480 560, 1700 280" stroke="url(#xbRibbon)" stroke-width="90" opacity="0.12" />
      <path d="M-100 330 C 260 540, 640 160, 1000 370 S 1480 580, 1700 310" stroke="url(#xbRibbon)" stroke-width="2" opacity="0.8" />
      <path class="xb-soft" d="M-100 680 C 340 860, 700 480, 1080 700 S 1500 820, 1700 620" stroke="url(#xbRibbon)" stroke-width="30" opacity="0.2" />
      <path d="M-100 700 C 340 880, 700 500, 1080 720 S 1500 840, 1700 640" stroke="url(#xbRibbon)" stroke-width="1.5" opacity="0.7" />
    </svg>`;
  document.body.prepend(flow);
})();
