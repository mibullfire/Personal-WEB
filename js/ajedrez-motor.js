// Reglas del ajedrez. Lo usan el navegador, el worker de la IA y el servidor
// (que valida las jugadas online), por eso no depende de nada.
//
// Tablero 0x88: casilla = fila * 16 + columna, con a8 = 0 y h1 = 0x77.
// Una casilla es valida si (casilla & 0x88) === 0.
// Pieza = color * 8 + tipo; 0 es casilla vacia.
// Jugada = de | a << 8 | promocion << 16 | marca << 20.
(function (raiz, fabrica) {
  if (typeof module !== 'undefined' && module.exports) module.exports = fabrica();
  else raiz.AjedrezMotor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const BLANCO = 0, NEGRO = 1;
  const PEON = 1, CABALLO = 2, ALFIL = 3, TORRE = 4, DAMA = 5, REY = 6;
  const NORMAL = 0, DOBLE = 1, AL_PASO = 2, ENROQUE = 3;
  const E_K = 1, E_Q = 2, E_k = 4, E_q = 8;

  const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const LETRAS = ' pnbrqk';
  const LETRAS_SAN = { 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };

  const DIAGONALES = [-17, -15, 15, 17];
  const RECTAS = [-16, -1, 1, 16];
  const TODAS = DIAGONALES.concat(RECTAS);
  const SALTOS = [-33, -31, -18, -14, 14, 18, 31, 33];

  const A1 = 0x70, E1 = 0x74, H1 = 0x77, A8 = 0x00, E8 = 0x04, H8 = 0x07;

  // Derechos de enroque que sobreviven si una pieza sale de o llega a la casilla.
  const MASCARA_ENROQUE = new Uint8Array(128).fill(15);
  MASCARA_ENROQUE[A1] = 15 & ~E_Q;
  MASCARA_ENROQUE[H1] = 15 & ~E_K;
  MASCARA_ENROQUE[E1] = 15 & ~(E_K | E_Q);
  MASCARA_ENROQUE[A8] = 15 & ~E_q;
  MASCARA_ENROQUE[H8] = 15 & ~E_k;
  MASCARA_ENROQUE[E8] = 15 & ~(E_k | E_q);

  // Hash Zobrist de 32 bits con semilla fija: la IA lo usa para detectar
  // repeticiones y para su tabla de transposicion.
  const Z_PIEZA = new Int32Array(16 * 128);
  const Z_ENROQUE = new Int32Array(16);
  const Z_PASO = new Int32Array(128);
  let Z_TURNO = 0;
  (function () {
    let s = 0x2f6e2b1;
    const azar = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) | 0;
    };
    for (let i = 0; i < Z_PIEZA.length; i++) Z_PIEZA[i] = azar();
    for (let i = 0; i < 16; i++) Z_ENROQUE[i] = azar();
    for (let i = 0; i < 128; i++) Z_PASO[i] = azar();
    Z_TURNO = azar();
  })();

  const nombreCasilla = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const leerCasilla = (txt) => (8 - Number(txt[1])) * 16 + (txt.charCodeAt(0) - 97);
  const crearJugada = (de, a, promo, marca) => de | (a << 8) | (promo << 16) | (marca << 20);
  const jugadaDe = (m) => m & 255;
  const jugadaA = (m) => (m >> 8) & 255;
  const jugadaPromo = (m) => (m >> 16) & 15;
  const jugadaMarca = (m) => m >>> 20;

  class Tablero {
    constructor(fen = INICIAL) {
      this.cargar(fen);
    }

    cargar(fen) {
      const [filas, turno, enroque, paso, medio, numero] = fen.trim().split(/\s+/);
      this.casillas = new Int8Array(128);
      this.reyes = [-1, -1];
      this.hash = 0;
      this.pila = [];    // estado irreversible de cada jugada hecha
      this.hashes = [];  // hash de cada posicion anterior (repeticiones)

      filas.split('/').forEach((fila, r) => {
        let f = 0;
        for (const c of fila) {
          if (c >= '1' && c <= '8') { f += Number(c); continue; }
          const tipo = LETRAS.indexOf(c.toLowerCase());
          const color = c === c.toLowerCase() ? NEGRO : BLANCO;
          this.poner(r * 16 + f, color * 8 + tipo);
          f++;
        }
      });

      this.turno = turno === 'b' ? NEGRO : BLANCO;
      this.enroque = 0;
      for (const [letra, bit] of [['K', E_K], ['Q', E_Q], ['k', E_k], ['q', E_q]]) {
        if ((enroque || '').includes(letra)) this.enroque |= bit;
      }
      this.paso = paso && paso !== '-' ? leerCasilla(paso) : -1;
      this.medio = Number(medio) || 0;
      this.numero = Number(numero) || 1;

      this.hash ^= Z_ENROQUE[this.enroque];
      if (this.paso >= 0) this.hash ^= Z_PASO[this.paso];
      if (this.turno === NEGRO) this.hash ^= Z_TURNO;
    }

    poner(s, pieza) {
      this.casillas[s] = pieza;
      this.hash ^= Z_PIEZA[pieza * 128 + s];
      if ((pieza & 7) === REY) this.reyes[pieza >> 3] = s;
    }

    quitar(s) {
      this.hash ^= Z_PIEZA[this.casillas[s] * 128 + s];
      this.casillas[s] = 0;
    }

    // Posicion sin contadores: dos posiciones con la misma clave son repeticion.
    clave() {
      const filas = [];
      for (let r = 0; r < 8; r++) {
        let fila = '', vacias = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.casillas[r * 16 + f];
          if (!p) { vacias++; continue; }
          if (vacias) { fila += vacias; vacias = 0; }
          const letra = LETRAS[p & 7];
          fila += p >> 3 === BLANCO ? letra.toUpperCase() : letra;
        }
        filas.push(vacias ? fila + vacias : fila);
      }
      let enroque = '';
      if (this.enroque & E_K) enroque += 'K';
      if (this.enroque & E_Q) enroque += 'Q';
      if (this.enroque & E_k) enroque += 'k';
      if (this.enroque & E_q) enroque += 'q';
      const paso = this.paso >= 0 ? nombreCasilla(this.paso) : '-';
      return `${filas.join('/')} ${this.turno === BLANCO ? 'w' : 'b'} ${enroque || '-'} ${paso}`;
    }

    fen() {
      return `${this.clave()} ${this.medio} ${this.numero}`;
    }

    // ¿Ataca el bando "por" a la casilla s?
    atacada(s, por) {
      const c = this.casillas;
      const peon = por * 8 + PEON;
      const origen = por === BLANCO ? 16 : -16; // el peon atacante viene de ahi
      for (const lado of [-1, 1]) {
        const o = s + origen + lado;
        if (!(o & 0x88) && c[o] === peon) return true;
      }
      const caballo = por * 8 + CABALLO;
      for (const d of SALTOS) {
        const o = s + d;
        if (!(o & 0x88) && c[o] === caballo) return true;
      }
      const rey = por * 8 + REY;
      for (const d of TODAS) {
        const o = s + d;
        if (!(o & 0x88) && c[o] === rey) return true;
      }
      const dama = por * 8 + DAMA;
      const alfil = por * 8 + ALFIL, torre = por * 8 + TORRE;
      for (const d of DIAGONALES) {
        for (let o = s + d; !(o & 0x88); o += d) {
          const p = c[o];
          if (!p) continue;
          if (p === alfil || p === dama) return true;
          break;
        }
      }
      for (const d of RECTAS) {
        for (let o = s + d; !(o & 0x88); o += d) {
          const p = c[o];
          if (!p) continue;
          if (p === torre || p === dama) return true;
          break;
        }
      }
      return false;
    }

    enJaque(color = this.turno) {
      return this.atacada(this.reyes[color], color ^ 1);
    }

    // Jugadas pseudolegales: pueden dejar al propio rey en jaque.
    generar(soloCapturas = false) {
      const lista = [];
      const c = this.casillas, yo = this.turno, rival = yo ^ 1;
      for (let s = 0; s < 120; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = c[s];
        if (!p || p >> 3 !== yo) continue;
        const tipo = p & 7;

        if (tipo === PEON) {
          this.generarPeon(lista, s, yo, soloCapturas);
        } else if (tipo === CABALLO || tipo === REY) {
          for (const d of tipo === REY ? TODAS : SALTOS) {
            const a = s + d;
            if (a & 0x88) continue;
            const q = c[a];
            if (q ? q >> 3 === rival : !soloCapturas) lista.push(crearJugada(s, a, 0, NORMAL));
          }
        } else {
          const dirs = tipo === ALFIL ? DIAGONALES : tipo === TORRE ? RECTAS : TODAS;
          for (const d of dirs) {
            for (let a = s + d; !(a & 0x88); a += d) {
              const q = c[a];
              if (!q) {
                if (!soloCapturas) lista.push(crearJugada(s, a, 0, NORMAL));
                continue;
              }
              if (q >> 3 === rival) lista.push(crearJugada(s, a, 0, NORMAL));
              break;
            }
          }
        }
      }
      if (!soloCapturas) this.generarEnroques(lista, yo, rival);
      return lista;
    }

    generarPeon(lista, s, yo, soloCapturas) {
      const c = this.casillas;
      const paso = yo === BLANCO ? -16 : 16;
      const inicial = yo === BLANCO ? 6 : 1;
      const ultima = yo === BLANCO ? 0 : 7;

      const empujar = (a, marca) => {
        if (a >> 4 === ultima) {
          lista.push(crearJugada(s, a, DAMA, marca));
          if (soloCapturas) return;
          lista.push(crearJugada(s, a, TORRE, marca), crearJugada(s, a, ALFIL, marca), crearJugada(s, a, CABALLO, marca));
        } else {
          lista.push(crearJugada(s, a, 0, marca));
        }
      };

      const delante = s + paso;
      if (!c[delante]) {
        if (!soloCapturas || delante >> 4 === ultima) empujar(delante, NORMAL);
        if (!soloCapturas && s >> 4 === inicial && !c[delante + paso]) {
          lista.push(crearJugada(s, delante + paso, 0, DOBLE));
        }
      }
      for (const lado of [-1, 1]) {
        const a = delante + lado;
        if (a & 0x88) continue;
        if (a === this.paso) lista.push(crearJugada(s, a, 0, AL_PASO));
        else if (c[a] && c[a] >> 3 !== yo) empujar(a, NORMAL);
      }
    }

    generarEnroques(lista, yo, rival) {
      const c = this.casillas;
      const e = yo === BLANCO ? E1 : E8;
      const corto = yo === BLANCO ? E_K : E_k;
      const largo = yo === BLANCO ? E_Q : E_q;
      if (!(this.enroque & (corto | largo)) || this.atacada(e, rival)) return;
      if (this.enroque & corto && !c[e + 1] && !c[e + 2]
        && !this.atacada(e + 1, rival) && !this.atacada(e + 2, rival)) {
        lista.push(crearJugada(e, e + 2, 0, ENROQUE));
      }
      if (this.enroque & largo && !c[e - 1] && !c[e - 2] && !c[e - 3]
        && !this.atacada(e - 1, rival) && !this.atacada(e - 2, rival)) {
        lista.push(crearJugada(e, e - 2, 0, ENROQUE));
      }
    }

    hacer(m) {
      const c = this.casillas;
      const de = jugadaDe(m), a = jugadaA(m), promo = jugadaPromo(m), marca = jugadaMarca(m);
      const yo = this.turno, rival = yo ^ 1;
      const pieza = c[de], capturada = c[a];

      this.pila.push(capturada | (this.enroque << 4) | ((this.paso + 1) << 8) | (this.medio << 16));
      this.hashes.push(this.hash);

      if (this.paso >= 0) this.hash ^= Z_PASO[this.paso];
      this.paso = -1;
      this.hash ^= Z_ENROQUE[this.enroque];
      this.enroque &= MASCARA_ENROQUE[de] & MASCARA_ENROQUE[a];
      this.hash ^= Z_ENROQUE[this.enroque];

      if (capturada) this.quitar(a);
      this.quitar(de);
      this.poner(a, promo ? yo * 8 + promo : pieza);

      if (marca === AL_PASO) {
        this.quitar(a + (yo === BLANCO ? 16 : -16));
      } else if (marca === ENROQUE) {
        const corto = a > de;
        const desde = corto ? a + 1 : a - 2;
        const hasta = corto ? a - 1 : a + 1;
        const torre = c[desde];
        this.quitar(desde);
        this.poner(hasta, torre);
      } else if (marca === DOBLE) {
        // Solo cuenta si un peon rival puede capturar: si no, seria otra
        // posicion a efectos de repeticion sin serlo en realidad.
        const peon = rival * 8 + PEON;
        const izq = a - 1, der = a + 1;
        if ((!(izq & 0x88) && c[izq] === peon) || (!(der & 0x88) && c[der] === peon)) {
          this.paso = (de + a) >> 1;
          this.hash ^= Z_PASO[this.paso];
        }
      }

      this.medio = (pieza & 7) === PEON || capturada || marca === AL_PASO ? 0 : this.medio + 1;
      if (yo === NEGRO) this.numero++;
      this.turno = rival;
      this.hash ^= Z_TURNO;
    }

    deshacer(m) {
      const c = this.casillas;
      const de = jugadaDe(m), a = jugadaA(m), promo = jugadaPromo(m), marca = jugadaMarca(m);
      const rival = this.turno, yo = rival ^ 1;
      const previo = this.pila.pop();

      const pieza = promo ? yo * 8 + PEON : c[a];
      c[a] = previo & 15;
      c[de] = pieza;
      if ((pieza & 7) === REY) this.reyes[yo] = de;

      if (marca === AL_PASO) {
        c[a + (yo === BLANCO ? 16 : -16)] = rival * 8 + PEON;
      } else if (marca === ENROQUE) {
        const corto = a > de;
        const desde = corto ? a + 1 : a - 2;
        const hasta = corto ? a - 1 : a + 1;
        c[desde] = c[hasta];
        c[hasta] = 0;
      }

      this.enroque = (previo >> 4) & 15;
      this.paso = ((previo >> 8) & 255) - 1;
      this.medio = previo >>> 16;
      if (yo === NEGRO) this.numero--;
      this.turno = yo;
      this.hash = this.hashes.pop();
    }

    legales() {
      const yo = this.turno;
      return this.generar().filter((m) => {
        this.hacer(m);
        const valida = !this.atacada(this.reyes[yo], yo ^ 1);
        this.deshacer(m);
        return valida;
      });
    }

    materialInsuficiente() {
      let caballos = 0;
      const alfiles = [0, 0]; // por color de casilla
      for (let s = 0; s < 120; s++) {
        if (s & 0x88) { s += 7; continue; }
        const tipo = this.casillas[s] & 7;
        if (tipo === PEON || tipo === TORRE || tipo === DAMA) return false;
        if (tipo === CABALLO) caballos++;
        if (tipo === ALFIL) alfiles[((s >> 4) + (s & 7)) & 1]++;
      }
      const menores = caballos + alfiles[0] + alfiles[1];
      if (menores <= 1) return true;
      return caballos === 0 && (alfiles[0] === 0 || alfiles[1] === 0);
    }
  }

  // Partida completa: tablero mas historial, SAN y reglas de final.
  class Partida {
    constructor() {
      this.tablero = new Tablero();
      this.historial = []; // { uci, san, m, pieza, capturada, alPaso, promocion }
      this.claves = [this.tablero.clave()];
    }

    static desde(jugadas) {
      const partida = new Partida();
      for (const uci of jugadas) {
        if (!partida.mover(uci)) throw new Error(`Jugada ilegal: ${uci}`);
      }
      return partida;
    }

    get turno() {
      return this.tablero.turno === BLANCO ? 'w' : 'b';
    }

    uci(m) {
      const promo = jugadaPromo(m);
      return nombreCasilla(jugadaDe(m)) + nombreCasilla(jugadaA(m)) + (promo ? LETRAS[promo] : '');
    }

    // Jugadas legales como texto: [{ de: 'e2', a: 'e4', promo: '', uci: 'e2e4' }]
    legales() {
      return this.tablero.legales().map((m) => ({
        de: nombreCasilla(jugadaDe(m)),
        a: nombreCasilla(jugadaA(m)),
        promo: jugadaPromo(m) ? LETRAS[jugadaPromo(m)] : '',
        uci: this.uci(m),
      }));
    }

    san(m, legales) {
      const t = this.tablero;
      const de = jugadaDe(m), a = jugadaA(m), promo = jugadaPromo(m), marca = jugadaMarca(m);
      const tipo = t.casillas[de] & 7;
      const destino = nombreCasilla(a);
      const captura = t.casillas[a] !== 0 || marca === AL_PASO;
      let txt;

      if (marca === ENROQUE) {
        txt = a > de ? 'O-O' : 'O-O-O';
      } else if (tipo === PEON) {
        txt = (captura ? `${nombreCasilla(de)[0]}x` : '') + destino;
        if (promo) txt += `=${LETRAS_SAN[promo]}`;
      } else {
        const rivales = legales.filter((o) => jugadaA(o) === a
          && jugadaDe(o) !== de && (t.casillas[jugadaDe(o)] & 7) === tipo);
        let desambiguar = '';
        if (rivales.length) {
          const casilla = nombreCasilla(de);
          const mismaColumna = rivales.some((o) => (jugadaDe(o) & 7) === (de & 7));
          const mismaFila = rivales.some((o) => jugadaDe(o) >> 4 === de >> 4);
          if (!mismaColumna) desambiguar = casilla[0];
          else if (!mismaFila) desambiguar = casilla[1];
          else desambiguar = casilla;
        }
        txt = LETRAS_SAN[tipo] + desambiguar + (captura ? 'x' : '') + destino;
      }
      return txt;
    }

    // Aplica una jugada en UCI ('e2e4', 'e7e8q'). Devuelve su SAN, o null si es ilegal.
    mover(uci) {
      const t = this.tablero;
      const legales = t.legales();
      const m = legales.find((o) => this.uci(o) === uci);
      if (m === undefined) return null;
      let san = this.san(m, legales);
      const pieza = LETRAS[t.casillas[jugadaDe(m)] & 7];
      const alPaso = jugadaMarca(m) === AL_PASO;
      const capturada = alPaso ? 'p' : t.casillas[jugadaA(m)] ? LETRAS[t.casillas[jugadaA(m)] & 7] : '';
      t.hacer(m);
      this.historial.push({
        uci, san, m, pieza, capturada, alPaso,
        promocion: jugadaPromo(m) ? LETRAS[jugadaPromo(m)] : '',
      });
      this.claves.push(t.clave());
      if (t.enJaque()) san += t.legales().length ? '+' : '#';
      this.historial[this.historial.length - 1].san = san;
      return san;
    }

    deshacer() {
      const ultima = this.historial.pop();
      if (!ultima) return false;
      this.tablero.deshacer(ultima.m);
      this.claves.pop();
      return true;
    }

    // Final de la partida segun el tablero: null si sigue.
    // ganador: 'w', 'b' o null en tablas.
    final() {
      const t = this.tablero;
      if (!t.legales().length) {
        if (t.enJaque()) return { ganador: t.turno === BLANCO ? 'b' : 'w', motivo: 'jaque mate' };
        return { ganador: null, motivo: 'rey ahogado' };
      }
      if (t.materialInsuficiente()) return { ganador: null, motivo: 'material insuficiente' };
      const actual = this.claves[this.claves.length - 1];
      if (this.claves.filter((c) => c === actual).length >= 3) {
        return { ganador: null, motivo: 'triple repetición' };
      }
      if (t.medio >= 100) return { ganador: null, motivo: 'regla de las 50 jugadas' };
      return null;
    }

    // Piezas para pintar: [{ casilla: 'e4', color: 'w', tipo: 'p' }]
    piezas() {
      const lista = [];
      const c = this.tablero.casillas;
      for (let s = 0; s < 120; s++) {
        if (s & 0x88) { s += 7; continue; }
        if (c[s]) {
          lista.push({ casilla: nombreCasilla(s), color: c[s] >> 3 === BLANCO ? 'w' : 'b', tipo: LETRAS[c[s] & 7] });
        }
      }
      return lista;
    }
  }

  return {
    Tablero, Partida, nombreCasilla,
    jugadaDe, jugadaA, jugadaPromo, jugadaMarca,
    BLANCO, NEGRO, PEON, CABALLO, ALFIL, TORRE, DAMA, REY, AL_PASO,
  };
});
