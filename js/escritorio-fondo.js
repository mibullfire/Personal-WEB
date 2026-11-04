// Fondo del escritorio: capas que siguen al raton, cristal que se inclina
// y burbujas que explotan al pasar por encima.
(function () {
  const BUBBLE_COUNT = 14;
  const MIN_SIZE = 22;
  const MAX_SIZE = 96;
  const MAX_TILT_DEG = 3;
  const FOLLOW_SPEED = 5; // cuanto mas alto, antes alcanzan las capas al raton

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const $bubbles = document.getElementById('bubbles');

  const random = (min, max) => min + Math.random() * (max - min);

  // ── Burbujas ──

  const bubbles = Array.from({ length: BUBBLE_COUNT }, () => {
    const el = document.createElement('span');
    el.className = 'bubble';
    $bubbles.appendChild(el);
    return { el };
  });

  function spawn(bubble, anywhere) {
    // Las pequeñas abundan mas que las grandes.
    bubble.size = MIN_SIZE + Math.random() ** 2 * (MAX_SIZE - MIN_SIZE);
    bubble.baseX = random(0, innerWidth);
    bubble.y = anywhere ? random(0, innerHeight) : innerHeight + bubble.size;
    bubble.speed = random(14, 34);
    bubble.sway = random(8, 28);
    bubble.phase = random(0, Math.PI * 2);
    bubble.alive = true;
    bubble.el.classList.remove('popping');
    bubble.el.style.setProperty('--size', `${bubble.size}px`);
  }

  function moveBubble(bubble, dt, now) {
    if (!bubble.alive) {
      if (now >= bubble.respawnAt) spawn(bubble, reducedMotion);
      return;
    }
    if (!reducedMotion) {
      bubble.y -= bubble.speed * dt;
      if (bubble.y < -bubble.size) spawn(bubble, false);
    }
    const wobble = reducedMotion ? 0 : Math.sin(now / 420 + bubble.phase) * 0.025;
    const sway = reducedMotion ? 0 : Math.sin(now / 1900 + bubble.phase) * bubble.sway;
    bubble.x = bubble.baseX + sway;
    const offset = bubble.size / 2;
    bubble.el.style.transform =
      `translate3d(${bubble.x - offset}px, ${bubble.y - offset}px, 0) scale(${1 + wobble}, ${1 - wobble})`;
  }

  function addEffect(className, x, y, vars) {
    const el = document.createElement('span');
    el.className = className;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
    el.addEventListener('animationend', () => el.remove());
    $bubbles.appendChild(el);
  }

  function pop(bubble) {
    bubble.alive = false;
    bubble.respawnAt = performance.now() + random(1500, 5000);
    bubble.el.classList.add('popping');
    window.dispatchEvent(new Event('bubble-pop'));

    addEffect('pop-ring', bubble.x, bubble.y, { '--size': `${bubble.size}px` });
    const drops = Math.round(6 + bubble.size / 10);
    for (let i = 0; i < drops; i++) {
      const angle = (i / drops) * Math.PI * 2 + random(-0.2, 0.2);
      const reach = bubble.size * random(0.55, 1);
      addEffect('droplet', bubble.x, bubble.y, {
        '--drop': `${random(2, 5)}px`,
        '--dx': `${Math.cos(angle) * reach}px`,
        '--dy': `${Math.sin(angle) * reach}px`,
      });
    }
  }

  // Distancia del punto al tramo recorrido: si el raton va rapido, entre dos
  // eventos puede saltarse la burbuja entera.
  function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function popAlong(ax, ay, bx, by) {
    for (const bubble of bubbles) {
      if (bubble.alive && distanceToSegment(bubble.x, bubble.y, ax, ay, bx, by) <= bubble.size / 2) {
        pop(bubble);
      }
    }
  }

  // ── Raton ──

  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  const eased = { ...pointer };

  // Las burbujas estan detras de los paneles: tapadas por el cristal no se tocan.
  const overGlass = (e) => e.target instanceof Element && e.target.closest('.glass');

  window.addEventListener('pointermove', (e) => {
    if (!overGlass(e)) popAlong(pointer.x, pointer.y, e.clientX, e.clientY);
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });

  window.addEventListener('pointerdown', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!overGlass(e)) popAlong(e.clientX, e.clientY, e.clientX, e.clientY);
  });

  for (const card of document.querySelectorAll('.glass')) {
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--gx', `${x * 100}%`);
      card.style.setProperty('--gy', `${y * 100}%`);
      if (reducedMotion) return;
      card.style.setProperty('--ry', `${(x - 0.5) * 2 * MAX_TILT_DEG}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 2 * MAX_TILT_DEG}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  // ── Animacion ──

  let lastFrame = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05); // al volver a la pestaña
    lastFrame = now;

    if (!reducedMotion) {
      const follow = 1 - Math.exp(-dt * FOLLOW_SPEED);
      eased.x += (pointer.x - eased.x) * follow;
      eased.y += (pointer.y - eased.y) * follow;
      root.style.setProperty('--mx', ((eased.x / innerWidth) * 2 - 1).toFixed(4));
      root.style.setProperty('--my', ((eased.y / innerHeight) * 2 - 1).toFixed(4));
    }

    for (const bubble of bubbles) moveBubble(bubble, dt, now);
    requestAnimationFrame(frame);
  }

  bubbles.forEach((bubble) => spawn(bubble, true));
  requestAnimationFrame(frame);
})();
