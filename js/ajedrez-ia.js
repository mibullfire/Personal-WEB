// IA del ajedrez: alfa-beta con profundizacion iterativa. Corre en un Web Worker
// para no congelar la pagina mientras piensa.
//
// Mensaje de entrada:  { id, jugadas: ['e2e4', ...], nivel: 'facil'|'medio'|'dificil' }
// Mensaje de salida:   { id, jugada: 'e7e5' }
(function (raiz) {
  const enWorker = typeof importScripts === 'function';
  if (enWorker) importScripts('ajedrez-motor.js');
  const Motor = enWorker ? raiz.AjedrezMotor : require('./ajedrez-motor.js');
  const {
    Partida, jugadaDe, jugadaA, jugadaPromo, jugadaMarca,
    BLANCO, PEON, CABALLO, ALFIL, TORRE, DAMA, REY, AL_PASO,
  } = Motor;

  // ruido: centipeones de azar en cada jugada raiz; hace fallar a los niveles bajos.
  const NIVELES = {
    facil: { profundidad: 1, tiempo: 400, ruido: 160 },
    medio: { profundidad: 3, tiempo: 1200, ruido: 35 },
    dificil: { profundidad: 32, tiempo: 1800, ruido: 0 },
  };
  const RUIDO_APERTURA = 12; // para que dos partidas no sean iguales
  const JUGADAS_APERTURA = 6;

  const INFINITO = 1000000;
  const MATE = 100000;
  const VALOR = [0, 100, 320, 330, 500, 900, 0];
  const FASE = [0, 0, 1, 1, 2, 4, 0]; // 24 = todas las piezas en el tablero

  // Tablas desde el punto de vista de las blancas, con a8 como primer valor.
  const T_PEON = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ];
  const T_CABALLO = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ];
  const T_ALFIL = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ];
  const T_TORRE = [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ];
  const T_DAMA = [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ];
  const T_REY_MEDIO = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ];
  const T_REY_FINAL = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
  ];
  const TABLAS = [null, T_PEON, T_CABALLO, T_ALFIL, T_TORRE, T_DAMA, T_REY_MEDIO];

  // Tabla de transposicion: 4 enteros por entrada (hash, valor, jugada, prof*4+tipo).
  const TT_ENTRADAS = 1 << 18;
  const TT_MASCARA = TT_ENTRADAS - 1;
  const tt = new Int32Array(TT_ENTRADAS * 4);
  const EXACTO = 0, COTA_INF = 1, COTA_SUP = 2;

  class TiempoAgotado extends Error {}

  function evaluar(t) {
    const c = t.casillas;
    let medio = 0, final = 0, fase = 0;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = c[s];
      if (!p) continue;
      const tipo = p & 7, blanca = p >> 3 === BLANCO;
      // Para las negras la tabla se lee con las filas en espejo.
      const i = (blanca ? s >> 4 : 7 - (s >> 4)) * 8 + (s & 7);
      const signo = blanca ? 1 : -1;
      fase += FASE[tipo];
      if (tipo === REY) {
        medio += signo * T_REY_MEDIO[i];
        final += signo * T_REY_FINAL[i];
      } else {
        const v = signo * (VALOR[tipo] + TABLAS[tipo][i]);
        medio += v;
        final += v;
      }
    }
    fase = Math.min(fase, 24);
    const valor = (medio * fase + final * (24 - fase)) / 24;
    return Math.round(t.turno === BLANCO ? valor : -valor);
  }

  function buscarJugada(jugadas, nivel, ahora = Date.now) {
    const config = NIVELES[nivel] || NIVELES.medio;
    const t = Partida.desde(jugadas).tablero;
    const limite = ahora() + config.tiempo;
    const killers = [];
    const historia = new Int32Array(128 * 128);
    let nodos = 0;

    const comprobarTiempo = () => {
      if ((++nodos & 1023) === 0 && ahora() > limite) throw new TiempoAgotado();
    };

    function repetida() {
      const h = t.hashes, n = h.length;
      const desde = Math.max(0, n - t.medio);
      for (let i = n - 2; i >= desde; i -= 2) {
        if (h[i] === t.hash) return true;
      }
      return false;
    }

    function puntuar(m, ttJugada, ply) {
      if (m === ttJugada) return 2000000;
      const c = t.casillas;
      const victima = c[jugadaA(m)] & 7;
      const promo = jugadaPromo(m);
      if (victima || promo || jugadaMarca(m) === AL_PASO) {
        return 1000000 + VALOR[victima || PEON] * 16 - VALOR[c[jugadaDe(m)] & 7] + VALOR[promo];
      }
      const k = killers[ply];
      if (k && (k[0] === m || k[1] === m)) return 900000;
      return historia[jugadaDe(m) * 128 + jugadaA(m)];
    }

    // Ordena en el sitio de mayor a menor: probar antes lo mejor poda mas.
    function ordenar(lista, ttJugada, ply) {
      const notas = lista.map((m) => puntuar(m, ttJugada, ply));
      for (let i = 1; i < lista.length; i++) {
        const m = lista[i], n = notas[i];
        let j = i - 1;
        while (j >= 0 && notas[j] < n) {
          lista[j + 1] = lista[j];
          notas[j + 1] = notas[j];
          j--;
        }
        lista[j + 1] = m;
        notas[j + 1] = n;
      }
    }

    function quietud(alfa, beta, ply) {
      comprobarTiempo();
      const base = evaluar(t);
      if (base >= beta) return base;
      if (base > alfa) alfa = base;
      if (ply > 64) return alfa;

      const lista = t.generar(true);
      ordenar(lista, 0, ply);
      const yo = t.turno;
      for (const m of lista) {
        t.hacer(m);
        if (t.enJaque(yo)) { t.deshacer(m); continue; }
        const v = -quietud(-beta, -alfa, ply + 1);
        t.deshacer(m);
        if (v >= beta) return v;
        if (v > alfa) alfa = v;
      }
      return alfa;
    }

    function tieneMaterial(color) {
      const c = t.casillas;
      for (let s = 0; s < 120; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = c[s];
        if (p && p >> 3 === color && (p & 7) !== PEON && (p & 7) !== REY) return true;
      }
      return false;
    }

    function buscar(prof, alfa, beta, ply, nuloPermitido) {
      comprobarTiempo();
      if (t.medio >= 100 || repetida()) return 0;
      const jaque = t.enJaque();
      if (jaque) prof++;
      if (prof <= 0) return quietud(alfa, beta, ply);

      const alfaInicial = alfa;
      const i = (t.hash & TT_MASCARA) * 4;
      let ttJugada = 0;
      if (tt[i] === t.hash) {
        ttJugada = tt[i + 2];
        const info = tt[i + 3];
        if (info >> 2 >= prof) {
          const v = tt[i + 1], tipo = info & 3;
          if (tipo === EXACTO || (tipo === COTA_INF && v >= beta) || (tipo === COTA_SUP && v <= alfa)) return v;
        }
      }

      // Si aun pasando el turno se supera beta, la rama no merece la pena.
      if (nuloPermitido && prof >= 3 && !jaque && tieneMaterial(t.turno)) {
        const pasoGuardado = t.paso;
        const hashGuardado = t.hash;
        t.turno ^= 1;
        t.paso = -1;
        t.hash = ~t.hash;
        const v = -buscar(prof - 3, -beta, -beta + 1, ply + 1, false);
        t.turno ^= 1;
        t.paso = pasoGuardado;
        t.hash = hashGuardado;
        if (v >= beta) return beta;
      }

      const lista = t.generar();
      ordenar(lista, ttJugada, ply);
      const yo = t.turno;
      let mejor = -INFINITO, mejorJugada = 0, legales = 0;

      for (const m of lista) {
        t.hacer(m);
        if (t.enJaque(yo)) { t.deshacer(m); continue; }
        legales++;
        const v = -buscar(prof - 1, -beta, -alfa, ply + 1, true);
        t.deshacer(m);
        if (v > mejor) { mejor = v; mejorJugada = m; }
        if (v > alfa) alfa = v;
        if (alfa >= beta) {
          if (!t.casillas[jugadaA(m)] && !jugadaPromo(m)) {
            killers[ply] = [m, killers[ply] ? killers[ply][0] : 0];
            historia[jugadaDe(m) * 128 + jugadaA(m)] += prof * prof;
          }
          break;
        }
      }

      if (!legales) return jaque ? -MATE + ply : 0;

      // Los mates dependen de la distancia a la raiz: no se pueden reutilizar.
      if (Math.abs(mejor) < MATE - 1000) {
        const tipo = mejor <= alfaInicial ? COTA_SUP : mejor >= beta ? COTA_INF : EXACTO;
        tt[i] = t.hash;
        tt[i + 1] = mejor;
        tt[i + 2] = mejorJugada;
        tt[i + 3] = prof * 4 + tipo;
      }
      return mejor;
    }

    const ruido = Math.max(config.ruido, jugadas.length < JUGADAS_APERTURA ? RUIDO_APERTURA : 0);
    const raiz = t.legales();
    if (!raiz.length) return null;
    const notasRaiz = new Map(raiz.map((m) => [m, 0]));
    let mejorRaiz = raiz[0];

    try {
      for (let prof = 1; prof <= config.profundidad; prof++) {
        let mejorIteracion = -INFINITO, jugadaIteracion = raiz[0];
        const azar = new Map(raiz.map((m) => [m, Math.random() * ruido]));
        for (const m of raiz) {
          // Con ruido hay que conocer el valor real de todas: sin poda en la raiz.
          const alfa = ruido ? -INFINITO : mejorIteracion;
          t.hacer(m);
          const v = -buscar(prof - 1, -INFINITO, -alfa, 1, true);
          t.deshacer(m);
          notasRaiz.set(m, v);
          const nota = v + azar.get(m);
          if (nota > mejorIteracion) { mejorIteracion = nota; jugadaIteracion = m; }
        }
        mejorRaiz = jugadaIteracion;
        raiz.sort((a, b) => notasRaiz.get(b) - notasRaiz.get(a));
        if (Math.abs(mejorIteracion) > MATE - 1000) break;
      }
    } catch (err) {
      // El tablero queda a medias, pero ya no se usa: vale la ultima iteracion completa.
      if (!(err instanceof TiempoAgotado)) throw err;
    }

    return new Partida().uci(mejorRaiz);
  }

  if (enWorker) {
    raiz.onmessage = (e) => {
      const { id, jugadas, nivel } = e.data;
      raiz.postMessage({ id, jugada: buscarJugada(jugadas, nivel) });
    };
  } else {
    module.exports = { buscarJugada };
  }
})(typeof self !== 'undefined' ? self : this);
