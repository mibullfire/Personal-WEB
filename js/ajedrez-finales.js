// Pantallas de final del ajedrez: rey con confeti al ganar, bufon riendose al perder.
// Ilustraciones propias en SVG: sus partes se animan desde ajedrez-finales.css.
window.AjedrezFinales = (function () {
  const DURACION_CONFETI = 6000; // ms

  const rayos = Array.from({ length: 14 }, (_, i) => `<path d="M180 170 L168 -130 L192 -130 Z" transform="rotate(${(i * 360) / 14} 180 170)"/>`).join('');

  const motas = (puntos) => puntos.map(([x, y]) => `<path d="M${x} ${y}c-2 3-2 6 0 8 2-2 2-5 0-8z" fill="#17120f"/>`).join('');

  const REY = `
  <svg class="final-escena" viewBox="0 0 360 400" role="img" aria-label="Un rey victorioso alza su espada">
    <defs>
      <linearGradient id="reyOro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#f0bd34"/><stop offset="1" stop-color="#a86f10"/></linearGradient>
      <linearGradient id="reyCapa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c81e38"/><stop offset="1" stop-color="#650a1c"/></linearGradient>
      <linearGradient id="reyTunica" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e4fb0"/><stop offset="1" stop-color="#14235f"/></linearGradient>
      <linearGradient id="reyHoja" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f7fbff"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".5" stop-color="#a9b8cc"/><stop offset="1" stop-color="#d7e1ee"/></linearGradient>
      <radialGradient id="reyPiel" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#ffdfbd"/><stop offset="1" stop-color="#e2a878"/></radialGradient>
      <radialGradient id="reyHalo"><stop offset="0" stop-color="#ffe9a3" stop-opacity=".95"/><stop offset=".6" stop-color="#f4b93a" stop-opacity=".35"/><stop offset="1" stop-color="#f4b93a" stop-opacity="0"/></radialGradient>
    </defs>

    <g class="rey-rayos" fill="#ffd978" opacity=".2">${rayos}</g>
    <circle cx="180" cy="160" r="170" fill="url(#reyHalo)"/>

    <!-- Castillo -->
    <path fill="#2b1a10" d="M0 400V262h12v-12h12v12h12v-12h12v12h12v-12h12v12h12V310h28v-16h12v16h144v-16h12v16h28V262h12v-12h12v12h12v-12h12v12h12v-12h12v12h12v138z"/>
    <path fill="#ffcf60" d="M26 290a8 12 0 0 1 16 0v18H26zM318 290a8 12 0 0 1 16 0v18h-16z"/>
    <path stroke="#2b1a10" stroke-width="3" d="M36 250V198M324 250V198"/>
    <path class="rey-estandarte" fill="#a51c30" stroke="#f0bd34" stroke-width="2" d="M36 200h44l-12 11 12 11H36z"/>
    <path class="rey-estandarte rey-estandarte--2" fill="#27408b" stroke="#f0bd34" stroke-width="2" d="M324 200h-44l12 11-12 11h44z"/>

    <g class="rey-figura">
      <!-- Capa -->
      <path fill="url(#reyCapa)" stroke="#3f0612" stroke-width="3" d="M122 172C84 226 64 320 50 386h260c-14-66-34-160-72-214z"/>
      <path fill="#fbf7ee" stroke="#b8ae9b" stroke-width="2" d="M50 386c5-16 8-26 12-38 80 14 156 14 236 0 4 12 7 22 12 38z"/>
      ${motas([[78, 360], [108, 366], [138, 370], [170, 372], [202, 370], [232, 367], [262, 362], [286, 356]])}
      <!-- Túnica -->
      <path fill="url(#reyTunica)" stroke="#0d1740" stroke-width="3" d="M146 178h68l18 182q-52 10-104 0z"/>
      <path fill="none" stroke="#e8b02e" stroke-width="6" d="M180 190v168"/>
      <path fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2" d="M136 262h88l2 16h-92z"/>
      <circle cx="180" cy="270" r="11" fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2"/>
      <circle cx="180" cy="270" r="5" fill="#b3172e"/>

      <!-- Brazo con cetro -->
      <path fill="none" stroke="#7d1020" stroke-width="30" stroke-linecap="round" d="M126 196c-18 22-30 40-36 66"/>
      <path fill="none" stroke="#7b4f0b" stroke-width="10" d="M80 300V168"/><path fill="none" stroke="#e8b02e" stroke-width="6" d="M80 300V168"/>
      <circle cx="80" cy="160" r="13" fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2"/>
      <path fill="#fff" opacity=".7" d="M76 153a6 4 0 0 1 8 0 7 7 0 0 0-8 0z"/>
      <circle cx="88" cy="272" r="14" fill="url(#reyPiel)" stroke="#a66a3c" stroke-width="2"/>

      <!-- Brazo con espada -->
      <g class="rey-espada">
        <path fill="url(#reyHoja)" stroke="#6d7c92" stroke-width="2" d="M298 112V30l6-20 6 20v82z"/>
        <path fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2" d="M280 110h48a4 4 0 0 1 0 12h-48a4 4 0 0 1 0-12z"/>
        <path fill="#5b3213" stroke="#2f1909" stroke-width="2" d="M298 122h12v26h-12z"/>
        <circle cx="304" cy="154" r="8" fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2"/>
        <path fill="none" stroke="#7d1020" stroke-width="30" stroke-linecap="round" d="M236 196c28-8 50-24 64-56"/>
        <circle cx="303" cy="136" r="14" fill="url(#reyPiel)" stroke="#a66a3c" stroke-width="2"/>
        <path class="rey-destello" fill="#fff" d="M304 2l4 20 20 4-20 4-4 20-4-20-20-4 20-4z"/>
      </g>

      <!-- Cuello de armiño -->
      <path fill="#fbf7ee" stroke="#b8ae9b" stroke-width="2" d="M112 176c20-20 116-20 136 0-4 22-34 32-68 32s-64-10-68-32z"/>
      ${motas([[130, 180], [150, 190], [172, 196], [196, 195], [216, 190], [234, 180]])}

      <!-- Cabeza -->
      <path fill="#efece4" stroke="#b9b3a6" stroke-width="2" d="M134 104c-6 26-6 40 0 52 6 2 10 0 12-4l-4-48z"/>
      <path fill="#efece4" stroke="#b9b3a6" stroke-width="2" d="M226 104c6 26 6 40 0 52-6 2-10 0-12-4l4-48z"/>
      <ellipse cx="180" cy="118" rx="44" ry="46" fill="url(#reyPiel)" stroke="#a66a3c" stroke-width="2"/>
      <path fill="#fbf8f0" stroke="#b9b3a6" stroke-width="2" d="M136 124c-4 44 22 92 44 100 22-8 48-56 44-100-8 16-24 26-44 26s-36-10-44-26z"/>
      <path fill="#fbf8f0" stroke="#b9b3a6" stroke-width="2" d="M180 136c-10-6-26-4-34 6 12 6 26 6 34 0 8 6 22 6 34 0-8-10-24-12-34-6z"/>
      <path fill="#a8413a" d="M168 150q12 10 24 0-12 4-24 0z"/>
      <circle cx="152" cy="126" r="9" fill="#f08f7b" opacity=".45"/>
      <circle cx="208" cy="126" r="9" fill="#f08f7b" opacity=".45"/>
      <path fill="#e2a878" stroke="#a66a3c" stroke-width="1.5" d="M180 110c-6 8-8 16-8 20q8 5 16 0c0-4-2-12-8-20z"/>
      <path fill="none" stroke="#3b2413" stroke-width="3.5" stroke-linecap="round" d="M150 112q9-9 18 0M192 112q9-9 18 0"/>
      <path fill="none" stroke="#efece4" stroke-width="6" stroke-linecap="round" d="M148 100q10-6 20-2M192 98q10-4 20 2"/>

      <!-- Corona -->
      <path fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2.5" stroke-linejoin="round" d="M134 92 124 34l28 28 28-46 28 46 28-28-10 58q-46-12-92 0z"/>
      <path fill="#a51c30" d="M136 80q44-10 88 0l-2 12q-42-10-84 0z"/>
      <circle cx="124" cy="32" r="6" fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2"/>
      <circle cx="180" cy="14" r="7" fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2"/>
      <circle cx="236" cy="32" r="6" fill="url(#reyOro)" stroke="#7b4f0b" stroke-width="2"/>
      <path fill="#2bb3a3" stroke="#0e5e55" stroke-width="1.5" d="M180 44l9 12-9 12-9-12z"/>
      <circle cx="150" cy="72" r="5" fill="#2e6be0" stroke="#10306f" stroke-width="1.5"/>
      <circle cx="210" cy="72" r="5" fill="#2e6be0" stroke="#10306f" stroke-width="1.5"/>
    </g>
  </svg>`;

  const cascabel = (x, y) => `<circle cx="${x}" cy="${y}" r="10" fill="url(#bufonOro)" stroke="#7b4f0b" stroke-width="2"/><path d="M${x - 5} ${y + 3}h10" stroke="#5a3908" stroke-width="2.5" stroke-linecap="round"/>`;

  const BUFON = `
  <svg class="final-escena" viewBox="0 0 360 400" role="img" aria-label="Un bufón medieval se ríe de ti a carcajadas">
    <defs>
      <linearGradient id="bufonOro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".55" stop-color="#eeb92f"/><stop offset="1" stop-color="#a86f10"/></linearGradient>
      <radialGradient id="bufonPiel" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="#fff0dc"/><stop offset="1" stop-color="#e6bd97"/></radialGradient>
      <radialGradient id="bufonFondo"><stop offset="0" stop-color="#8f3fc2" stop-opacity=".75"/><stop offset="1" stop-color="#8f3fc2" stop-opacity="0"/></radialGradient>
      <pattern id="bufonRombos" width="44" height="56" patternUnits="userSpaceOnUse">
        <rect width="44" height="56" fill="#5a1f8c"/>
        <path fill="#d9a521" d="M22 0 44 28 22 56 0 28z"/>
        <path fill="#b3172e" d="M22 14 33 28 22 42 11 28z"/>
      </pattern>
    </defs>

    <circle cx="180" cy="190" r="175" fill="url(#bufonFondo)"/>
    <!-- Arco de piedra -->
    <path fill="none" stroke="#2a1a3a" stroke-width="20" d="M20 400V170C20 50 340 50 340 170v230"/>
    <path fill="none" stroke="#4c3562" stroke-width="3" stroke-dasharray="26 8" d="M20 400V170C20 50 340 50 340 170v230"/>

    <g transform="rotate(-12 44 176)"><text class="bufon-ja" x="14" y="176" font-size="36">¡JA!</text></g>
    <g transform="rotate(10 312 180)"><text class="bufon-ja bufon-ja--2" x="270" y="180" font-size="36">¡JA!</text></g>
    <g transform="rotate(-8 60 262)"><text class="bufon-ja bufon-ja--3" x="26" y="262" font-size="28">¡JA!</text></g>

    <g class="bufon-figura">
      <!-- Cuerpo -->
      <path fill="url(#bufonRombos)" stroke="#23093a" stroke-width="3" d="M92 396c2-90 34-152 88-152s86 62 88 152z"/>

      <!-- Brazo a la barriga -->
      <path fill="none" stroke="#23093a" stroke-width="34" stroke-linecap="round" d="M112 296c-8 30 4 48 44 50"/>
      <path fill="none" stroke="#b3172e" stroke-width="27" stroke-linecap="round" d="M112 296c-8 30 4 48 44 50"/>
      <circle cx="164" cy="346" r="14" fill="url(#bufonPiel)" stroke="#a7784f" stroke-width="2"/>

      <!-- Brazo que señala -->
      <g class="bufon-dedo">
        <path fill="none" stroke="#23093a" stroke-width="34" stroke-linecap="round" d="M246 294c24 8 40 2 56-18"/>
        <path fill="none" stroke="#1d7a4a" stroke-width="27" stroke-linecap="round" d="M246 294c24 8 40 2 56-18"/>
        <circle cx="310" cy="266" r="14" fill="url(#bufonPiel)" stroke="#a7784f" stroke-width="2"/>
        <path fill="none" stroke="#a7784f" stroke-width="12" stroke-linecap="round" d="M316 260l18-22"/>
        <path fill="none" stroke="#f5d8b8" stroke-width="8.5" stroke-linecap="round" d="M316 260l18-22"/>
      </g>

      <g class="bufon-cabeza">
        <!-- Cuernos del gorro -->
        <g class="bufon-cuerno">
          <path fill="#5a1f8c" stroke="#23093a" stroke-width="3" stroke-linejoin="round" d="M126 126C104 74 66 50 26 88c34-4 56 22 86 50z"/>
          ${cascabel(24, 94)}
        </g>
        <g class="bufon-cuerno bufon-cuerno--der">
          <path fill="#1d7a4a" stroke="#0b3d24" stroke-width="3" stroke-linejoin="round" d="M234 126c22-52 60-76 100-38-34-4-56 22-86 50z"/>
          ${cascabel(336, 94)}
        </g>
        <g class="bufon-cuerno">
          <path fill="#b3172e" stroke="#4b0b13" stroke-width="3" stroke-linejoin="round" d="M142 112c-8-50 12-92 66-102-18 26 2 62 10 102z"/>
          ${cascabel(210, 12)}
        </g>

        <!-- Cara -->
        <path fill="url(#bufonPiel)" stroke="#a7784f" stroke-width="2.5" d="M122 136c-2 58 22 112 58 114 36-2 60-56 58-114-10-24-106-24-116 0z"/>
        <circle cx="136" cy="168" r="13" fill="#ec6f6a" opacity=".6"/>
        <circle cx="224" cy="168" r="13" fill="#ec6f6a" opacity=".6"/>

        <!-- Rombos y ojos entornados de la risa -->
        <path fill="#23093a" d="M152 116l14 20-14 20-14-20z"/>
        <path fill="#23093a" d="M208 116l14 20-14 20-14-20z"/>
        <path fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" d="M142 140q10-13 20 0M198 140q10-13 20 0"/>
        <path fill="none" stroke="#23093a" stroke-width="5" stroke-linecap="round" d="M134 110l28 8M226 110l-28 8"/>

        <!-- Nariz -->
        <path fill="#f3c8a2" stroke="#a7784f" stroke-width="2" stroke-linejoin="round" d="M172 140h16l-2 24q-6 5-12 0z"/>

        <!-- Boca -->
        <g class="bufon-boca">
          <path fill="#4a0a16" stroke="#23093a" stroke-width="3" d="M132 174c30 8 66 8 96 0-2 42-26 66-48 66s-46-24-48-66z"/>
          <path fill="#fff" d="M138 179c26 6 58 6 84 0l-3 13c-24 5-54 5-78 0z"/>
          <path fill="none" stroke="#c9c2b4" stroke-width="1.5" d="M155 183v11M168 184v12M180 185v12M192 184v12M205 183v11"/>
          <path fill="#d9485f" d="M156 222c8-14 40-14 48 0-6 14-14 18-24 18s-18-4-24-18z"/>
        </g>

        <!-- Lágrimas de risa -->
        <path class="bufon-lagrima" fill="#7fd4ff" d="M120 150c-6 8-8 12-8 15a8 8 0 0 0 16 0c0-3-2-7-8-15z"/>
        <path class="bufon-lagrima bufon-lagrima--2" fill="#7fd4ff" d="M240 150c-6 8-8 12-8 15a8 8 0 0 0 16 0c0-3-2-7-8-15z"/>

        <!-- Banda del gorro -->
        <path fill="url(#bufonOro)" stroke="#7b4f0b" stroke-width="2.5" d="M116 134c8-34 120-34 128 0-30-14-98-14-128 0z"/>
      </g>

      <!-- Cuello de puntas con cascabeles -->
      <path fill="#b3172e" stroke="#4b0b13" stroke-width="3" stroke-linejoin="round" d="M124 238l-14 44 34-16 8 34 28-26 28 26 8-34 34 16-14-44c-30 16-82 16-112 0z"/>
      ${cascabel(110, 284)}${cascabel(152, 302)}${cascabel(208, 302)}${cascabel(250, 284)}
    </g>
  </svg>`;

  const TEXTOS = {
    victoria: { escena: REY, titulo: '¡Victoria!', lema: '¡Larga vida al rey!' },
    derrota: { escena: BUFON, titulo: '¡Derrota!', lema: 'El bufón de la corte se ríe de ti' },
  };

  let abierta = null;
  let pararConfeti = null;
  let focoPrevio = null;

  // Confeti de corte: monedas de oro, rombos y banderines heráldicos.
  function lanzarConfeti(contenedor) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
    const lienzo = document.createElement('canvas');
    lienzo.className = 'final-confeti';
    lienzo.setAttribute('aria-hidden', 'true');
    contenedor.append(lienzo);
    const ctx = lienzo.getContext('2d');
    const colores = ['#f0bd34', '#ffe08a', '#a51c30', '#27408b', '#1f7a4d', '#f4ead0'];
    let ancho = 0, alto = 0;

    function ajustar() {
      const escala = Math.min(window.devicePixelRatio || 1, 2);
      ancho = window.innerWidth;
      alto = window.innerHeight;
      lienzo.width = ancho * escala;
      lienzo.height = alto * escala;
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
    }
    ajustar();
    window.addEventListener('resize', ajustar);

    const azar = (a, b) => a + Math.random() * (b - a);
    const particula = (x, y, vx, vy) => ({
      x, y, vx, vy,
      forma: Math.floor(azar(0, 3)),
      color: colores[Math.floor(azar(0, colores.length))],
      lado: azar(6, 12),
      giro: azar(0, 6.28),
      velGiro: azar(-0.14, 0.14),
      fase: azar(0, 6.28),
    });

    const piezas = [];
    for (let i = 0; i < 70; i++) {
      piezas.push(particula(0, alto * 0.75, azar(4, 15), azar(-20, -9)));
      piezas.push(particula(ancho, alto * 0.75, azar(-15, -4), azar(-20, -9)));
    }
    for (let i = 0; i < 90; i++) piezas.push(particula(azar(0, ancho), azar(-alto, -10), azar(-1, 1), azar(1, 3)));

    function dibujar(p) {
      const voltear = Math.cos(p.fase);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.scale(1, voltear);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.forma === 0) {
        ctx.fillStyle = voltear > 0 ? '#f0bd34' : '#c78e18';
        ctx.arc(0, 0, p.lado * 0.7, 0, Math.PI * 2);
      } else if (p.forma === 1) {
        ctx.moveTo(0, -p.lado);
        ctx.lineTo(p.lado * 0.65, 0);
        ctx.lineTo(0, p.lado);
        ctx.lineTo(-p.lado * 0.65, 0);
      } else {
        ctx.moveTo(-p.lado, -p.lado * 0.6);
        ctx.lineTo(p.lado * 1.2, 0);
        ctx.lineTo(-p.lado, p.lado * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const fin = performance.now() + DURACION_CONFETI;
    let marco = requestAnimationFrame(function paso(ahora) {
      ctx.clearRect(0, 0, ancho, alto);
      for (const p of piezas) {
        p.vy = Math.min(p.vy + 0.22, 4.5);
        p.vx *= 0.985;
        p.x += p.vx + Math.sin(p.fase) * 0.6;
        p.y += p.vy;
        p.giro += p.velGiro;
        p.fase += 0.12;
        // Reaparecen arriba mientras dure; despues caen y se acaba.
        if (p.y > alto + 20 && ahora < fin) { p.y = -20; p.x = azar(0, ancho); }
        dibujar(p);
      }
      if (ahora < fin + 3000) marco = requestAnimationFrame(paso);
      else lienzo.remove();
    });

    return () => {
      cancelAnimationFrame(marco);
      window.removeEventListener('resize', ajustar);
      lienzo.remove();
    };
  }

  function alPulsarTecla(e) {
    if (e.key === 'Escape') cerrar();
  }

  function cerrar() {
    if (!abierta) return;
    if (pararConfeti) pararConfeti();
    pararConfeti = null;
    abierta.remove();
    abierta = null;
    document.removeEventListener('keydown', alPulsarTecla);
    if (focoPrevio) focoPrevio.focus?.();
  }

  // tipo: 'victoria' | 'derrota'; accion: { texto, alPulsar }
  function mostrar(tipo, motivo, accion) {
    cerrar();
    const { escena, titulo, lema } = TEXTOS[tipo];
    focoPrevio = document.activeElement;

    abierta = document.createElement('div');
    abierta.className = `final final--${tipo}`;
    abierta.setAttribute('role', 'dialog');
    abierta.setAttribute('aria-modal', 'true');
    abierta.setAttribute('aria-label', titulo);
    abierta.innerHTML = `
      <div class="final-caja">
        ${escena}
        <div class="final-pergamino">
          <h2 class="final-titulo">${titulo}</h2>
          <p class="final-lema">${lema}</p>
          <p class="final-motivo">Por ${motivo}</p>
          <div class="final-botones">
            <button type="button" class="final-boton" data-accion="principal">${accion.texto}</button>
            <button type="button" class="final-boton final-boton--sec" data-accion="cerrar">Ver el tablero</button>
          </div>
        </div>
      </div>`;

    abierta.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-accion]');
      if (!boton) return;
      cerrar();
      if (boton.dataset.accion === 'principal') accion.alPulsar();
    });

    document.body.append(abierta);
    document.addEventListener('keydown', alPulsarTecla);
    abierta.querySelector('[data-accion="principal"]').focus();
    if (tipo === 'victoria') pararConfeti = lanzarConfeti(abierta);
  }

  return { mostrar, cerrar, abierto: () => Boolean(abierta) };
})();
