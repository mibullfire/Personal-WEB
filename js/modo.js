// Modo claro/oscuro de toda la web. Se carga en el <head> sin defer para fijar
// el modo antes de pintar. El modo por defecto es el oscuro.
(function () {
  const STORAGE_KEY = 'modo';
  const CLARO = 'claro';
  const root = document.documentElement;

  const ICONOS = {
    sol: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    luna: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>',
  };

  // localStorage puede fallar en modo privado.
  function leerModo() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function guardarModo(modo) {
    try {
      localStorage.setItem(STORAGE_KEY, modo);
    } catch {
      // Sin almacenamiento el cambio dura hasta recargar.
    }
  }

  const esClaro = () => root.dataset.modo === CLARO;

  function aplicar(modo) {
    if (modo === CLARO) root.dataset.modo = CLARO;
    else delete root.dataset.modo;
    // Hojas externas que solo valen para un modo, p. ej. el resaltado de código.
    for (const link of document.querySelectorAll('link[data-solo-modo]')) {
      link.disabled = (link.dataset.soloModo === CLARO) !== esClaro();
    }
  }

  function pintarBoton(boton) {
    const texto = esClaro() ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    boton.setAttribute('aria-label', texto);
    boton.title = texto;
    boton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${esClaro() ? ICONOS.luna : ICONOS.sol}</svg>`;
  }

  function crearBoton() {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'modo-toggle';
    pintarBoton(boton);
    boton.addEventListener('click', () => {
      const modo = esClaro() ? 'oscuro' : CLARO;
      aplicar(modo);
      guardarModo(modo);
      pintarBoton(boton);
      // Para lo que se pinta en canvas y no sigue a las variables CSS.
      window.dispatchEvent(new Event('modo-cambiado'));
    });
    document.body.append(boton);
  }

  aplicar(leerModo());
  document.addEventListener('DOMContentLoaded', crearBoton);
})();
