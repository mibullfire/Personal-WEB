// Salas del ajedrez online. Viven en memoria: un despliegue o reinicio del
// servidor termina las partidas en curso. Las jugadas llegan por POST y cada
// cambio se envia a los dos jugadores por SSE con el estado completo, asi una
// reconexion no necesita ningun tratamiento especial.
const crypto = require('crypto');
const { Partida } = require('../js/ajedrez-motor');
const { sendJson, readJson } = require('./api');

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
const LARGO_CODIGO = 6;
const MAX_SALAS = 1000;
const MAX_NOMBRE = 20;
const LATIDO_MS = 25 * 1000;
const LIMPIEZA_MS = 5 * 60 * 1000;
const CADUCA_SIN_CONEXION_MS = 60 * 60 * 1000;
const CADUCA_CONECTADA_MS = 12 * 60 * 60 * 1000;

const RUTA_SALA = /^\/api\/ajedrez\/salas\/([A-Z0-9]{6})\/(unirse|eventos|accion)$/;

const salas = new Map();

function nuevoCodigo() {
  let codigo;
  do {
    codigo = '';
    for (let i = 0; i < LARGO_CODIGO; i++) codigo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  } while (salas.has(codigo));
  return codigo;
}

function limpiarNombre(valor, porDefecto) {
  const nombre = typeof valor === 'string' ? valor.trim().slice(0, MAX_NOMBRE) : '';
  return nombre || porDefecto;
}

const conectada = (sala) => sala.jugadores.some((j) => j.conexion);

function cerrarSala(sala) {
  for (const j of sala.jugadores) {
    j.conexion?.end();
    j.conexion = null;
  }
  salas.delete(sala.codigo);
}

// Con el servidor lleno se sacrifica la sala abandonada mas antigua antes que
// impedir jugar a nadie. Devuelve false si todas tienen gente conectada.
function hacerSitio() {
  if (salas.size < MAX_SALAS) return true;
  const sinConexion = [...salas.values()].filter((s) => !conectada(s));
  if (!sinConexion.length) return false;
  cerrarSala(sinConexion.reduce((a, b) => (a.actividad < b.actividad ? a : b)));
  return true;
}

function estadoPara(sala, indice) {
  const yo = sala.jugadores[indice];
  const rival = sala.jugadores[1 - indice];
  return {
    fase: sala.fase, // esperando | jugando | final
    numeroPartida: sala.numeroPartida,
    color: yo.color,
    rival: rival ? { nombre: rival.nombre, conectado: Boolean(rival.conexion) } : null,
    jugadas: sala.partida.historial.map((j) => j.uci),
    resultado: sala.resultado,
    tablasOfrecidas: sala.tablasDe ? sala.tablasDe !== yo.color : false,
    tablasPropias: sala.tablasDe === yo.color,
    revanchaPropia: yo.revancha,
    revanchaRival: Boolean(rival?.revancha),
  };
}

function enviar(sala, indice) {
  const conexion = sala.jugadores[indice]?.conexion;
  if (conexion) conexion.write(`data: ${JSON.stringify(estadoPara(sala, indice))}\n\n`);
}

function difundir(sala) {
  sala.actividad = Date.now();
  enviar(sala, 0);
  enviar(sala, 1);
}

function terminar(sala, ganador, motivo) {
  sala.fase = 'final';
  sala.resultado = { ganador, motivo };
  sala.tablasDe = null;
}

function crearSala(cuerpo) {
  const elegido = cuerpo.color === 'w' || cuerpo.color === 'b' ? cuerpo.color : null;
  const color = elegido || (crypto.randomInt(2) ? 'w' : 'b');
  const sala = {
    codigo: nuevoCodigo(),
    fase: 'esperando',
    numeroPartida: 1,
    partida: new Partida(),
    resultado: null,
    tablasDe: null,
    actividad: Date.now(),
    jugadores: [{
      nombre: limpiarNombre(cuerpo.nombre, 'Anfitrión'),
      token: crypto.randomUUID(),
      color,
      conexion: null,
      revancha: false,
    }],
  };
  salas.set(sala.codigo, sala);
  return sala;
}

function unirse(sala, cuerpo) {
  const anfitrion = sala.jugadores[0];
  const jugador = {
    nombre: limpiarNombre(cuerpo.nombre, 'Invitado'),
    token: crypto.randomUUID(),
    color: anfitrion.color === 'w' ? 'b' : 'w',
    conexion: null,
    revancha: false,
  };
  sala.jugadores.push(jugador);
  sala.fase = 'jugando';
  difundir(sala);
  return jugador;
}

function indiceDe(sala, token) {
  if (typeof token !== 'string') return -1;
  return sala.jugadores.findIndex((j) => j.token === token);
}

function nuevaPartida(sala) {
  for (const j of sala.jugadores) {
    j.color = j.color === 'w' ? 'b' : 'w';
    j.revancha = false;
  }
  sala.partida = new Partida();
  sala.numeroPartida++;
  sala.fase = 'jugando';
  sala.resultado = null;
  sala.tablasDe = null;
}

// Aplica una accion. Devuelve el mensaje de error, o null si ha ido bien.
function aplicarAccion(sala, indice, cuerpo) {
  const yo = sala.jugadores[indice];
  const rival = sala.jugadores[1 - indice];

  if (cuerpo.tipo === 'cancelar') {
    if (sala.fase !== 'esperando') return 'La partida ya ha empezado';
    cerrarSala(sala);
    return null;
  }

  if (cuerpo.tipo === 'revancha') {
    if (sala.fase !== 'final') return 'La partida no ha terminado';
    yo.revancha = true;
    if (rival.revancha) nuevaPartida(sala);
    return null;
  }

  if (sala.fase !== 'jugando') return 'No hay ninguna partida en curso';

  switch (cuerpo.tipo) {
    case 'mover': {
      if (sala.partida.turno !== yo.color) return 'No es tu turno';
      if (typeof cuerpo.jugada !== 'string' || !sala.partida.mover(cuerpo.jugada)) return 'Jugada ilegal';
      sala.tablasDe = null; // mover rechaza la oferta pendiente
      const final = sala.partida.final();
      if (final) terminar(sala, final.ganador, final.motivo);
      return null;
    }
    case 'rendirse':
      terminar(sala, rival.color, 'abandono');
      return null;
    case 'tablas':
      if (sala.tablasDe === rival.color) terminar(sala, null, 'acuerdo');
      else sala.tablasDe = yo.color;
      return null;
    case 'rechazar':
      if (sala.tablasDe === rival.color) sala.tablasDe = null;
      return null;
    default:
      return 'Acción desconocida';
  }
}

function abrirEventos(req, res, sala, indice) {
  const jugador = sala.jugadores[indice];
  jugador.conexion?.end(); // una pestaña nueva sustituye a la anterior

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  jugador.conexion = res;
  difundir(sala);

  const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);
  req.on('close', () => {
    clearInterval(latido);
    if (jugador.conexion === res) {
      jugador.conexion = null;
      difundir(sala);
    }
  });
}

// Devuelve true si la peticion era del ajedrez.
async function handle(req, res, pathname, searchParams) {
  if (!pathname.startsWith('/api/ajedrez/')) return false;

  try {
    if (pathname === '/api/ajedrez/salas' && req.method === 'POST') {
      if (!hacerSitio()) {
        sendJson(res, 503, { error: 'No quedan salas libres. Prueba en un rato.' });
        return true;
      }
      const sala = crearSala((await readJson(req)) || {});
      sendJson(res, 201, { codigo: sala.codigo, token: sala.jugadores[0].token });
      return true;
    }

    const ruta = pathname.match(RUTA_SALA);
    if (!ruta) {
      sendJson(res, 404, { error: 'No encontrado' });
      return true;
    }

    const sala = salas.get(ruta[1]);
    if (!sala) {
      sendJson(res, 404, { error: 'Esa sala no existe o ha caducado' });
      return true;
    }

    const accion = ruta[2];
    if (accion === 'eventos' && req.method === 'GET') {
      const indice = indiceDe(sala, searchParams.get('token'));
      if (indice < 0) sendJson(res, 403, { error: 'No juegas en esta sala' });
      else abrirEventos(req, res, sala, indice);
      return true;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Método no permitido' });
      return true;
    }

    const cuerpo = (await readJson(req)) || {};
    if (accion === 'unirse') {
      if (sala.jugadores.length === 2) {
        sendJson(res, 409, { error: 'La sala ya está llena' });
      } else {
        sendJson(res, 200, { codigo: sala.codigo, token: unirse(sala, cuerpo).token });
      }
      return true;
    }

    const indice = indiceDe(sala, cuerpo.token);
    if (indice < 0) {
      sendJson(res, 403, { error: 'No juegas en esta sala' });
      return true;
    }
    const error = aplicarAccion(sala, indice, cuerpo);
    if (error) {
      enviar(sala, indice); // devuelve al jugador a la posicion real
      sendJson(res, 409, { error });
    } else {
      difundir(sala);
      sendJson(res, 200, { ok: true });
    }
  } catch (err) {
    console.error('Error en el ajedrez online:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Error interno' });
  }
  return true;
}

function limpiarCaducadas() {
  const ahora = Date.now();
  for (const sala of salas.values()) {
    const caducidad = conectada(sala) ? CADUCA_CONECTADA_MS : CADUCA_SIN_CONEXION_MS;
    if (ahora - sala.actividad > caducidad) cerrarSala(sala);
  }
}

setInterval(limpiarCaducadas, LIMPIEZA_MS).unref();

module.exports = { handle };
