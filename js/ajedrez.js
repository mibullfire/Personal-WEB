// Interfaz del ajedrez: tablero, partida contra la IA y salas online.
(function () {
  const { Partida } = window.AjedrezMotor;
  const Finales = window.AjedrezFinales;

  const ID = (id) => document.getElementById(id);
  const CLAVE_SALA = 'ajedrez-sala';
  const ESPERA_MINIMA_IA = 350; // ms: una respuesta instantanea no se ve
  const NOMBRE_PIEZA = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };
  const NOMBRE_NIVEL = { facil: 'fácil', medio: 'media', dificil: 'difícil' };
  const COLUMNAS = 'abcdefgh';
  const DURACION_MOVIMIENTO = 260; // ms: igual que la transicion de .pieza en el CSS
  const ESPERA_FINAL = 1100;       // ms: deja ver el mate antes de la pantalla final
  const sinAnimaciones = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Piezas propias, en un viewBox de 100x100.
  const BASE = '<path d="M24 80h52a4 4 0 0 1 4 4v6H20v-6a4 4 0 0 1 4-4z"/>';
  const FORMAS = {
    p: `<circle cx="50" cy="31" r="14"/><path d="M41 44h18c0 13 5 25 13 36H28c8-11 13-23 13-36z"/>${BASE}`,
    r: `<path d="M27 16h11v9h7v-9h10v9h7v-9h11v22l-9 7v25l9 10H27l9-10V45l-9-7z"/>${BASE}`,
    b: `<circle cx="50" cy="15" r="6"/><path d="M50 21c13 10 20 21 20 31 0 9-7 15-20 15s-20-6-20-15c0-10 7-21 20-31z"/><path d="M38 66h24l10 14H28z"/>${BASE}<path class="pz-linea" d="M50 34v18M41 43h18"/>`,
    n: `<path d="M76 80H30c0-12 7-20 19-28 3-3 4-6 3-9-5 5-10 7-15 8l-5 6-10-7c1-10 9-22 21-29l2-11 9 8c15 2 26 18 26 62z"/><circle class="pz-ojo" cx="44" cy="34" r="3"/>${BASE}`,
    q: `<path d="M17 32l14 30 5-38 14 35 14-35 5 38 14-30-6 48H23z"/><circle cx="17" cy="28" r="6"/><circle cx="36" cy="20" r="6"/><circle cx="64" cy="20" r="6"/><circle cx="83" cy="28" r="6"/><circle cx="50" cy="15" r="6"/>${BASE}`,
    k: `<path d="M45 8h10v8h8v9h-8v14H45V25h-8v-9h8z"/><path d="M50 42c6-9 30-11 31 8 1 13-9 21-13 30H32c-4-9-14-17-13-30 1-19 25-17 31-8z"/>${BASE}`,
  };
  const svgPieza = (tipo, color) => `<svg viewBox="0 0 100 100" class="pz pz-${color}" aria-hidden="true">${FORMAS[tipo]}</svg>`;

  // ── Estado ────────────────────────────────────────────────
  let modo = null;            // 'ia' | 'online'
  let partida = new Partida();
  let miColor = 'w';
  let orientacion = null;     // color con el que esta construido el tablero
  let seleccion = null;
  let legales = [];
  let promocion = null;       // { de, a } mientras se elige pieza
  let arrastre = null;
  let vistaPly = null;        // jugada que se esta revisando; null = partida en directo
  let temporizadorFinal = null;
  const elementosPieza = new Map();

  // IA
  let nivel = 'medio';
  let colorElegidoIA = 'w';
  let worker = null;
  let peticionIA = 0;         // las respuestas de peticiones anteriores se ignoran
  let inicioPeticionIA = 0;
  let pensando = false;

  // Online
  let sala = null;            // { codigo, token }
  let eventos = null;
  let estadoSala = null;
  let saliendoDePagina = false;

  const tablero = ID('tablero');
  const capaPiezas = ID('piezas');

  function mostrar(seccion) {
    for (const id of ['menu', 'espera', 'juego']) ID(id).classList.toggle('hidden', id !== seccion);
    document.querySelector('.tool-main').classList.toggle('en-partida', seccion === 'juego');
  }

  let temporizadorAviso;
  function aviso(texto) {
    const t = ID('toast');
    t.textContent = texto;
    t.classList.add('show');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ── Tablero ───────────────────────────────────────────────
  function posicion(casilla) {
    let col = COLUMNAS.indexOf(casilla[0]);
    let fila = 8 - Number(casilla[1]);
    if (miColor === 'b') { col = 7 - col; fila = 7 - fila; }
    return { col, fila };
  }

  const transformar = (casilla) => {
    const { col, fila } = posicion(casilla);
    return `translate(${col * 100}%, ${fila * 100}%)`;
  };

  function construirTablero() {
    orientacion = miColor;
    tablero.querySelectorAll('.casilla').forEach((c) => c.remove());
    const filas = miColor === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const columnas = miColor === 'w' ? [...COLUMNAS] : [...COLUMNAS].reverse();
    const trozo = document.createDocumentFragment();
    filas.forEach((fila, i) => columnas.forEach((col, j) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = `casilla ${(i + j) % 2 ? 'oscura' : 'clara'}`;
      c.dataset.c = col + fila;
      if (j === 0) c.insertAdjacentHTML('beforeend', `<span class="coord coord-fila">${fila}</span>`);
      if (i === 7) c.insertAdjacentHTML('beforeend', `<span class="coord coord-col">${col}</span>`);
      trozo.append(c);
    }));
    tablero.prepend(trozo);
    capaPiezas.replaceChildren();
    elementosPieza.clear();
  }

  // Eleva la pieza mientras se desliza: el desplazamiento lo hace la transicion del CSS.
  function animarSalto(el) {
    if (sinAnimaciones()) return;
    el.classList.add('moviendose');
    el.firstElementChild.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.16) translateY(-7%)', offset: 0.45 },
      { transform: 'scale(1)' },
    ], { duration: DURACION_MOVIMIENTO, easing: 'ease-in-out' });
    setTimeout(() => el.classList.remove('moviendose'), DURACION_MOVIMIENTO);
  }

  // La pieza capturada sigue visible hasta que llega la que la captura.
  function animarSalida(el) {
    if (sinAnimaciones()) return el.remove();
    el.firstElementChild.animate([
      { transform: 'scale(1) rotate(0)', opacity: 1 },
      { transform: 'scale(1.25) rotate(-12deg)', opacity: 0.9, offset: 0.35 },
      { transform: 'scale(0.2) rotate(25deg)', opacity: 0 },
    ], { duration: 300, delay: DURACION_MOVIMIENTO * 0.6, easing: 'ease-in', fill: 'forwards' })
      .onfinish = () => el.remove();
    return undefined;
  }

  function animarAparicion(el) {
    if (sinAnimaciones()) return;
    el.firstElementChild.animate([
      { transform: 'scale(0.3)', opacity: 0, filter: 'brightness(2.2)' },
      { transform: 'scale(1.2)', opacity: 1, filter: 'brightness(1.6)', offset: 0.6 },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ], { duration: 380, easing: 'ease-out' });
  }

  function animarLlegada(casilla) {
    if (sinAnimaciones()) return;
    const el = tablero.querySelector(`.casilla[data-c="${casilla}"]`);
    if (!el) return;
    setTimeout(() => {
      el.classList.remove('aterrizaje');
      void el.offsetWidth; // reinicia la animacion si la casilla se repite
      el.classList.add('aterrizaje');
      setTimeout(() => el.classList.remove('aterrizaje'), 420);
    }, DURACION_MOVIMIENTO * 0.75);
  }

  function pintarPiezas(vista, animar) {
    const libres = new Map(elementosPieza);
    const pendientes = [];
    elementosPieza.clear();

    for (const p of vista.piezas()) {
      const clave = p.color + p.tipo;
      const el = libres.get(p.casilla);
      if (el && el.dataset.p === clave) {
        libres.delete(p.casilla);
        elementosPieza.set(p.casilla, el);
      } else {
        pendientes.push({ ...p, clave });
      }
    }

    // Las que han cambiado de casilla reutilizan su elemento: asi se animan.
    for (const p of pendientes) {
      let el = null;
      for (const [casilla, candidata] of libres) {
        if (candidata.dataset.p === p.clave) { el = candidata; libres.delete(casilla); break; }
      }
      if (el) {
        if (animar) { animarSalto(el); animarLlegada(p.casilla); }
      } else {
        el = document.createElement('div');
        el.className = 'pieza';
        el.dataset.p = p.clave;
        el.innerHTML = svgPieza(p.tipo, p.color);
        capaPiezas.append(el);
        if (animar) animarAparicion(el);
      }
      el.style.transform = transformar(p.casilla);
      elementosPieza.set(p.casilla, el);
    }
    libres.forEach((el) => (animar ? animarSalida(el) : el.remove()));
  }

  // El rey vencido cae al terminar la partida.
  function pintarReyCaido(vista) {
    const r = resultadoActual();
    const perdedor = vistaPly === null && r && r.ganador ? (r.ganador === 'w' ? 'b' : 'w') : null;
    const rey = perdedor && vista.piezas().find((p) => p.tipo === 'k' && p.color === perdedor);
    const caido = rey ? elementosPieza.get(rey.casilla) : null;
    elementosPieza.forEach((el) => el.classList.toggle('derrotado', el === caido));
  }

  function puedoMover() {
    if (vistaPly !== null || partida.turno !== miColor) return false;
    if (modo === 'ia') return !pensando && !partida.final();
    return Boolean(estadoSala) && estadoSala.fase === 'jugando';
  }

  function pintarCasillas(vista = partidaVisible()) {
    const ultima = vista.historial[vista.historial.length - 1];
    const destinos = new Set(legales.filter((j) => j.de === seleccion).map((j) => j.a));
    const lista = vista.piezas();
    const reyEnJaque = vista.tablero.enJaque()
      ? lista.find((p) => p.tipo === 'k' && p.color === vista.turno).casilla
      : null;
    const piezas = new Map(lista.map((p) => [p.casilla, p]));
    const propias = puedoMover();

    tablero.querySelectorAll('.casilla').forEach((el) => {
      const c = el.dataset.c;
      const pieza = piezas.get(c);
      el.classList.toggle('ultima', Boolean(ultima) && (ultima.uci.slice(0, 2) === c || ultima.uci.slice(2, 4) === c));
      el.classList.toggle('seleccionada', c === seleccion);
      el.classList.toggle('destino', destinos.has(c));
      el.classList.toggle('captura', destinos.has(c) && Boolean(pieza));
      el.classList.toggle('jaque', c === reyEnJaque);
      el.classList.toggle('mia', propias && Boolean(pieza) && pieza.color === miColor);
      const color = pieza && (pieza.color === 'w' ? 'blanco' : 'negro');
      el.setAttribute('aria-label', pieza ? `${c}, ${NOMBRE_PIEZA[pieza.tipo]} ${color}` : c);
    });
  }

  // Posicion que se ve en el tablero: la actual o la de la jugada que se revisa.
  function partidaVisible() {
    if (vistaPly === null) return partida;
    return Partida.desde(partida.historial.slice(0, vistaPly).map((j) => j.uci));
  }

  // Etiquetas de lo que ocurrio en una jugada, para el panel de historial.
  function etiquetasJugada(j, esUltima) {
    const etiquetas = [];
    if (j.san.startsWith('O-O-O')) etiquetas.push('enroque largo');
    else if (j.san.startsWith('O-O')) etiquetas.push('enroque corto');
    if (j.capturada) etiquetas.push(`captura ${NOMBRE_PIEZA[j.capturada]}${j.alPaso ? ' al paso' : ''}`);
    if (j.promocion) etiquetas.push(`promoción a ${NOMBRE_PIEZA[j.promocion]}`);
    if (j.san.endsWith('#')) etiquetas.push('jaque mate');
    else if (j.san.endsWith('+')) etiquetas.push('jaque');
    const r = esUltima && resultadoActual();
    if (r && r.motivo !== 'jaque mate') etiquetas.push(r.ganador ? r.motivo : `tablas: ${r.motivo}`);
    return etiquetas;
  }

  function pintarHistorial() {
    const h = partida.historial;
    const total = h.length;
    const actual = vistaPly === null ? total : vistaPly;

    const boton = (ply) => (h[ply - 1]
      ? `<button type="button" class="jugada${ply === actual ? ' actual' : ''}" data-ply="${ply}">${h[ply - 1].san}</button>`
      : '<span></span>');
    let html = '';
    for (let i = 0; i < total; i += 2) {
      html += `<li><span class="num">${i / 2 + 1}.</span>${boton(i + 1)}${boton(i + 2)}</li>`;
    }
    const lista = ID('jugadas');
    lista.innerHTML = html;

    // Solo se desplaza la lista: scrollIntoView moveria tambien la pagina.
    const marcada = lista.querySelector('.actual');
    if (vistaPly === null) lista.scrollTop = lista.scrollHeight;
    else if (marcada) lista.scrollTop = marcada.offsetTop - lista.offsetTop - lista.clientHeight / 2;

    ID('contadorJugadas').textContent = `${actual} / ${total}`;
    ID('btnPrimera').disabled = ID('btnAnterior').disabled = actual === 0;
    ID('btnSiguiente').disabled = ID('btnUltima').disabled = actual === total;

    const titulo = ID('estadoTitulo');
    const chips = ID('estadoEtiquetas');
    if (actual === 0) {
      titulo.textContent = 'Posición inicial';
      chips.innerHTML = '';
    } else {
      const j = h[actual - 1];
      const color = actual % 2 ? 'Blancas' : 'Negras';
      const numero = Math.ceil(actual / 2);
      titulo.textContent = `${numero}. ${color}: ${NOMBRE_PIEZA[j.pieza]} ${j.uci.slice(0, 2)} → ${j.uci.slice(2, 4)}`;
      chips.innerHTML = etiquetasJugada(j, actual === total)
        .map((e) => `<span class="chip">${e}</span>`).join('');
    }
    ID('marcoTablero').classList.toggle('revision', vistaPly !== null);
  }

  function irA(ply) {
    const total = partida.historial.length;
    const destino = Math.max(0, Math.min(ply, total));
    const nueva = destino === total ? null : destino;
    if (nueva === vistaPly) return;
    vistaPly = nueva;
    seleccion = null;
    cerrarPromocion();
    pintar();
  }

  const plyActual = () => (vistaPly === null ? partida.historial.length : vistaPly);

  function resultadoActual() {
    return modo === 'online' ? estadoSala && estadoSala.resultado : partida.final();
  }

  function textoResultado(r) {
    if (!r.ganador) return `Tablas: ${r.motivo}`;
    return `${r.ganador === miColor ? 'Has ganado' : 'Has perdido'} por ${r.motivo}`;
  }

  function textoEstado() {
    if (vistaPly !== null) return `Revisando la jugada ${vistaPly} de ${partida.historial.length}`;
    const r = resultadoActual();
    if (r) return textoResultado(r);
    if (partida.turno === miColor) return partida.tablero.enJaque() ? '¡Jaque! Te toca' : 'Te toca';
    if (modo === 'ia') return 'La máquina está pensando…';
    return `Turno de ${estadoSala.rival.nombre}`;
  }

  function pintarJugador(el, nombre, color, detalle) {
    el.querySelector('.jugador-nombre').textContent = nombre;
    el.querySelector('.jugador-detalle').textContent = detalle;
    el.querySelector('.jugador-color').dataset.color = color;
    el.classList.toggle('turno', !resultadoActual() && partida.turno === color);
  }

  function pintarJugadores() {
    const suyo = miColor === 'w' ? 'b' : 'w';
    pintarJugador(ID('barraAbajo'), 'Tú', miColor, '');
    if (modo === 'ia') {
      pintarJugador(ID('barraArriba'), 'Máquina', suyo, `dificultad ${NOMBRE_NIVEL[nivel]}`);
    } else {
      const rival = estadoSala.rival;
      pintarJugador(ID('barraArriba'), rival.nombre, suyo, rival.conectado ? '' : 'desconectado');
    }
  }

  function pintarAcciones() {
    const ia = modo === 'ia';
    const online = modo === 'online';
    const e = estadoSala;
    const terminada = Boolean(resultadoActual());
    const minimo = miColor === 'w' ? 1 : 2; // hay que haber hecho alguna jugada

    ID('btnDeshacer').classList.toggle('hidden', !ia);
    ID('btnDeshacer').disabled = partida.historial.length < minimo;
    ID('btnNueva').classList.toggle('hidden', !ia);
    ID('btnTablas').classList.toggle('hidden', !online || terminada);
    ID('btnRendirse').classList.toggle('hidden', !online || terminada);
    ID('btnRevancha').classList.toggle('hidden', !online || !terminada);

    if (online) {
      ID('btnTablas').disabled = e.tablasPropias;
      ID('btnTablas').textContent = e.tablasPropias ? 'Tablas ofrecidas' : 'Ofrecer tablas';
      ID('btnRevancha').disabled = e.revanchaPropia;
      ID('btnRevancha').textContent = e.revanchaPropia ? 'Esperando al rival…' : 'Revancha';
    }

    const oferta = online && !terminada && e.tablasOfrecidas;
    ID('ofertaTablas').classList.toggle('hidden', !oferta);
    const revancha = online && terminada && e.revanchaRival && !e.revanchaPropia;
    ID('ofertaRevancha').classList.toggle('hidden', !revancha);
  }

  function pintar(animar = true) {
    legales = puedoMover() ? partida.legales() : [];
    if (seleccion && !legales.some((j) => j.de === seleccion)) seleccion = null;
    const vista = partidaVisible();
    pintarPiezas(vista, animar);
    pintarReyCaido(vista);
    pintarCasillas(vista);
    pintarHistorial();
    pintarJugadores();
    pintarAcciones();
    ID('estado').textContent = textoEstado();
    ID('estado').classList.toggle('fin', vistaPly === null && Boolean(resultadoActual()));
  }

  function accionFinal() {
    if (modo === 'ia') return { texto: 'Nueva partida', alPulsar: () => ID('btnNueva').click() };
    return { texto: 'Revancha', alPulsar: () => ID('btnRevancha').click() };
  }

  // Tablas: sin pantalla, basta con el mensaje del panel.
  function anunciarFinal(r) {
    vistaPly = null;
    pintar();
    if (!r.ganador) return;
    const tipo = r.ganador === miColor ? 'victoria' : 'derrota';
    clearTimeout(temporizadorFinal);
    temporizadorFinal = setTimeout(() => Finales.mostrar(tipo, r.motivo, accionFinal()), ESPERA_FINAL);
  }

  function cancelarFinal() {
    clearTimeout(temporizadorFinal);
    Finales.cerrar();
  }

  // ── Jugar ─────────────────────────────────────────────────
  function jugar(uci) {
    seleccion = null;
    if (!partida.mover(uci)) return;
    if (modo === 'online') enviarAccion({ tipo: 'mover', jugada: uci });
    pintar();
    if (modo !== 'ia') return;
    const final = partida.final();
    if (final) anunciarFinal(final);
    else pedirJugadaIA();
  }

  function intentar(de, a) {
    const opciones = legales.filter((j) => j.de === de && j.a === a);
    if (!opciones.length) return false;
    if (opciones.length === 1) jugar(opciones[0].uci);
    else abrirPromocion(de, a);
    return true;
  }

  function abrirPromocion(de, a) {
    promocion = { de, a };
    const caja = ID('promocion');
    caja.querySelector('.promocion-opciones').innerHTML = ['q', 'r', 'b', 'n']
      .map((t) => `<button type="button" data-tipo="${t}" aria-label="${NOMBRE_PIEZA[t]}">${svgPieza(t, miColor)}</button>`)
      .join('');
    caja.classList.remove('hidden');
  }

  function cerrarPromocion() {
    promocion = null;
    ID('promocion').classList.add('hidden');
  }

  ID('promocion').addEventListener('click', (e) => {
    const boton = e.target.closest('button');
    const { de, a } = promocion;
    cerrarPromocion();
    if (boton) jugar(de + a + boton.dataset.tipo);
    else { seleccion = null; pintarCasillas(); }
  });

  // Devuelve true si el gesto ya ha quedado resuelto (no hay que arrastrar).
  function pulsarCasilla(c) {
    if (seleccion && seleccion !== c && intentar(seleccion, c)) return true;
    seleccion = legales.some((j) => j.de === c) ? c : null;
    pintarCasillas();
    return !seleccion;
  }

  function casillaBajo(x, y) {
    const el = document.elementFromPoint(x, y);
    const casilla = el && el.closest('.casilla');
    return casilla ? casilla.dataset.c : null;
  }

  function soltarArrastre() {
    if (!arrastre) return;
    const { el, casilla } = arrastre;
    el.classList.remove('arrastrada');
    el.style.transform = transformar(casilla);
    arrastre = null;
  }

  tablero.addEventListener('pointerdown', (e) => {
    const casilla = e.target.closest('.casilla');
    if (!casilla || e.button !== 0) return;
    if (vistaPly !== null) return irA(partida.historial.length);
    const c = casilla.dataset.c;
    if (pulsarCasilla(c)) return;
    arrastre = { casilla: c, el: elementosPieza.get(c), x: e.clientX, y: e.clientY, movida: false };
  });

  // Con teclado no hay pointerdown: Enter sobre la casilla llega como click sin detalle.
  tablero.addEventListener('click', (e) => {
    const casilla = e.target.closest('.casilla');
    if (!casilla || e.detail !== 0) return;
    if (vistaPly !== null) irA(partida.historial.length);
    else pulsarCasilla(casilla.dataset.c);
  });

  document.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    if (!arrastre.movida) {
      if (Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) < 5) return;
      arrastre.movida = true;
      arrastre.el.classList.add('arrastrada');
    }
    const caja = tablero.getBoundingClientRect();
    const lado = caja.width / 8;
    arrastre.el.style.transform = `translate(${e.clientX - caja.left - lado / 2}px, ${e.clientY - caja.top - lado / 2}px)`;
  });

  document.addEventListener('pointerup', (e) => {
    if (!arrastre) return;
    const { casilla, movida } = arrastre;
    soltarArrastre();
    if (!movida) return;
    const destino = casillaBajo(e.clientX, e.clientY);
    if (destino && destino !== casilla) intentar(casilla, destino);
  });

  document.addEventListener('pointercancel', soltarArrastre);

  // ── Panel de historial ────────────────────────────────────
  ID('jugadas').addEventListener('click', (e) => {
    const boton = e.target.closest('.jugada');
    if (boton) irA(Number(boton.dataset.ply));
  });
  ID('btnPrimera').addEventListener('click', () => irA(0));
  ID('btnAnterior').addEventListener('click', () => irA(plyActual() - 1));
  ID('btnSiguiente').addEventListener('click', () => irA(plyActual() + 1));
  ID('btnUltima').addEventListener('click', () => irA(partida.historial.length));

  document.addEventListener('keydown', (e) => {
    if (ID('juego').classList.contains('hidden') || Finales.abierto() || e.target.matches('input')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); irA(plyActual() - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); irA(plyActual() + 1); }
  });

  // ── Contra la máquina ─────────────────────────────────────
  function empezarIA() {
    cerrarSalaLocal();
    modo = 'ia';
    peticionIA++;
    pensando = false;
    cancelarFinal();
    partida = new Partida();
    vistaPly = null;
    miColor = colorElegidoIA === 'azar' ? (Math.random() < 0.5 ? 'w' : 'b') : colorElegidoIA;
    seleccion = null;
    cerrarPromocion();
    construirTablero();
    mostrar('juego');
    pintar(false);
    pedirJugadaIA();
  }

  function pedirJugadaIA() {
    if (partida.turno === miColor || partida.final()) return;
    if (!worker) {
      worker = new Worker('../js/ajedrez-ia.js');
      worker.onmessage = recibirJugadaIA;
      worker.onerror = () => {
        pensando = false;
        pintar();
        aviso('La máquina ha fallado. Prueba a recargar.');
      };
    }
    pensando = true;
    peticionIA++;
    inicioPeticionIA = Date.now();
    worker.postMessage({ id: peticionIA, jugadas: partida.historial.map((j) => j.uci), nivel });
    pintar();
  }

  function recibirJugadaIA(e) {
    const { id, jugada } = e.data;
    const restante = ESPERA_MINIMA_IA - (Date.now() - inicioPeticionIA);
    setTimeout(() => {
      if (id !== peticionIA || modo !== 'ia') return;
      pensando = false;
      if (jugada) partida.mover(jugada);
      const final = partida.final();
      if (final) anunciarFinal(final);
      else pintar();
    }, Math.max(0, restante));
  }

  function deshacer() {
    peticionIA++;
    pensando = false;
    cancelarFinal();
    do {
      partida.deshacer();
    } while (partida.historial.length && partida.turno !== miColor);
    vistaPly = null;
    seleccion = null;
    cerrarPromocion();
    pintar();
    pedirJugadaIA();
  }

  // ── Online ────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => { saliendoDePagina = true; });
  window.addEventListener('pagehide', () => { saliendoDePagina = true; });
  window.addEventListener('pageshow', () => { saliendoDePagina = false; });

  async function llamar(ruta, cuerpo) {
    const r = await fetch(`/api/ajedrez/salas${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error || 'No se ha podido conectar con el servidor');
    return datos;
  }

  async function enviarAccion(accion) {
    try {
      await llamar(`/${sala.codigo}/accion`, { token: sala.token, ...accion });
    } catch (err) {
      aviso(err.message);
      if (estadoSala) sincronizar(estadoSala);
    }
  }

  function guardarSala() {
    try { localStorage.setItem(CLAVE_SALA, JSON.stringify(sala)); } catch { /* modo privado */ }
  }

  function leerSala() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SALA)); } catch { return null; }
  }

  function olvidarSala() {
    try { localStorage.removeItem(CLAVE_SALA); } catch { /* modo privado */ }
    history.replaceState(null, '', location.pathname);
  }

  function cerrarSalaLocal() {
    if (eventos) eventos.close();
    eventos = null;
    sala = null;
    estadoSala = null;
    olvidarSala();
  }

  function salirDeSala(mensaje) {
    cancelarFinal();
    cerrarSalaLocal();
    modo = null;
    mostrar('menu');
    if (mensaje) aviso(mensaje);
  }

  function entrarEnSala(datos) {
    sala = { codigo: datos.codigo, token: datos.token };
    modo = 'online';
    guardarSala();
    history.replaceState(null, '', `?sala=${sala.codigo}`);

    eventos = new EventSource(`/api/ajedrez/salas/${sala.codigo}/eventos?token=${encodeURIComponent(sala.token)}`);
    eventos.onopen = () => ID('sinConexion').classList.add('hidden');
    eventos.onmessage = (e) => sincronizar(JSON.parse(e.data));
    eventos.onerror = () => {
      // Chrome corta la conexion con error al recargar: la sala sigue viva y hay que recordarla.
      if (saliendoDePagina) return;
      // CLOSED: el servidor ha rechazado la sala. CONNECTING: reintenta solo.
      if (eventos.readyState === EventSource.CLOSED) salirDeSala('La sala ya no existe');
      else ID('sinConexion').classList.remove('hidden');
    };
  }

  function sincronizar(e) {
    const previo = estadoSala;
    const nuevaPartida = !previo || previo.numeroPartida !== e.numeroPartida;
    estadoSala = e;
    miColor = e.color;

    if (e.fase === 'esperando') {
      ID('codigoSala').textContent = sala.codigo;
      mostrar('espera');
      return;
    }

    const locales = partida.historial.map((j) => j.uci);
    const iguales = !nuevaPartida && locales.join() === e.jugadas.join();
    if (!iguales) {
      partida = Partida.desde(e.jugadas);
      seleccion = null;
      cerrarPromocion();
      if (nuevaPartida || vistaPly > e.jugadas.length) vistaPly = null;
    }
    if (nuevaPartida) cancelarFinal();
    if (orientacion !== miColor) construirTablero();
    mostrar('juego');
    // Solo se anuncia el final al ocurrir, no al recargar una partida ya terminada.
    if (previo && !previo.resultado && e.resultado) anunciarFinal(e.resultado);
    else pintar(!nuevaPartida);
  }

  async function crearSala() {
    const boton = ID('btnCrear');
    boton.disabled = true;
    try {
      entrarEnSala(await llamar('', { nombre: ID('nombre').value, color: colorSala }));
    } catch (err) {
      aviso(err.message);
    } finally {
      boton.disabled = false;
    }
  }

  async function unirseASala() {
    const codigo = ID('codigo').value.trim().toUpperCase();
    if (codigo.length !== 6) return aviso('El código tiene 6 caracteres');
    const boton = ID('btnUnirse');
    boton.disabled = true;
    try {
      entrarEnSala(await llamar(`/${encodeURIComponent(codigo)}/unirse`, { nombre: ID('nombre').value }));
    } catch (err) {
      aviso(err.message);
    } finally {
      boton.disabled = false;
    }
  }

  async function copiar(texto, mensaje) {
    try {
      await navigator.clipboard.writeText(texto);
      aviso(mensaje);
    } catch {
      aviso(texto);
    }
  }

  // ── Botones ───────────────────────────────────────────────
  let colorSala = 'azar';

  function activarOpciones(id, alElegir) {
    const grupo = ID(id);
    grupo.addEventListener('click', (e) => {
      const boton = e.target.closest('button');
      if (!boton) return;
      grupo.querySelectorAll('button').forEach((b) => b.classList.toggle('activa', b === boton));
      alElegir(boton.dataset.valor);
    });
  }

  activarOpciones('opcionesNivel', (v) => { nivel = v; });
  activarOpciones('opcionesColorIA', (v) => { colorElegidoIA = v; });
  activarOpciones('opcionesColorSala', (v) => { colorSala = v; });

  ID('btnJugarIA').addEventListener('click', empezarIA);
  ID('btnCrear').addEventListener('click', crearSala);
  ID('btnUnirse').addEventListener('click', unirseASala);
  ID('codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') unirseASala(); });
  ID('btnCopiarCodigo').addEventListener('click', () => copiar(sala.codigo, 'Código copiado'));
  ID('btnCopiarEnlace').addEventListener('click', () => copiar(location.href, 'Enlace copiado'));
  ID('btnCancelar').addEventListener('click', () => {
    const { codigo, token } = sala;
    salirDeSala();
    llamar(`/${codigo}/accion`, { token, tipo: 'cancelar' }).catch(() => {});
  });

  ID('btnDeshacer').addEventListener('click', deshacer);
  ID('btnNueva').addEventListener('click', empezarIA);
  ID('btnTablas').addEventListener('click', () => enviarAccion({ tipo: 'tablas' }));
  ID('btnAceptarTablas').addEventListener('click', () => enviarAccion({ tipo: 'tablas' }));
  ID('btnRechazarTablas').addEventListener('click', () => enviarAccion({ tipo: 'rechazar' }));
  ID('btnRevancha').addEventListener('click', () => enviarAccion({ tipo: 'revancha' }));
  ID('btnRendirse').addEventListener('click', () => {
    if (confirm('¿Seguro que quieres rendirte?')) enviarAccion({ tipo: 'rendirse' });
  });

  ID('btnSalir').addEventListener('click', async () => {
    if (modo === 'online' && !resultadoActual()) {
      if (!confirm('Si sales ahora, abandonas la partida. ¿Salir?')) return;
      eventos.close(); // sin esto llegaria la pantalla de derrota al salir
      await enviarAccion({ tipo: 'rendirse' });
    }
    if (modo === 'online') return salirDeSala();
    peticionIA++;
    pensando = false;
    cancelarFinal();
    modo = null;
    mostrar('menu');
  });

  // Enlace de invitacion, o recarga en mitad de una partida.
  const codigoEnlace = new URLSearchParams(location.search).get('sala');
  if (codigoEnlace) {
    const guardada = leerSala();
    if (guardada && guardada.codigo === codigoEnlace) {
      entrarEnSala(guardada);
    } else {
      ID('codigo').value = codigoEnlace.slice(0, 6);
      ID('codigo').scrollIntoView({ block: 'center' });
    }
  }
})();
