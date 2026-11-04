// Escritorio privado: saludo, reloj, tiempo y notas. Usa la misma contraseña
// que el panel del blog, enviada en la cabecera X-Admin-Password.
(function () {
  const PASSWORD_KEY = 'escritorio_password';
  const PLACE_KEY = 'escritorio_zona';
  const DEFAULT_PLACE = { name: 'Madrid', latitude: 40.4165, longitude: -3.7026 };
  const WEATHER_EVERY_MS = 15 * 60 * 1000;
  const SEARCH_DELAY_MS = 300;
  const COMBO_POPS = 3; // burbujas seguidas para que empiece el marcador...
  const COMBO_WINDOW_MS = 3000; // ...en este tiempo
  const SCORE_TIMEOUT_MS = 10000;

  const $ = (id) => document.getElementById(id);
  const $login = $('login');
  const $app = $('app');
  const $notes = $('notes');
  const $notesMsg = $('notes-msg');
  const $place = $('place');
  const $placeForm = $('place-form');
  const $placeInput = $('place-input');
  const $placeResults = $('place-results');

  let password = '';
  let widgetsStarted = false;

  // ── Almacenamiento (puede fallar en modo privado) ──

  function storedPassword() {
    try {
      return sessionStorage.getItem(PASSWORD_KEY) || localStorage.getItem(PASSWORD_KEY) || '';
    } catch { return ''; }
  }
  function storePassword(value, remember) {
    try {
      sessionStorage.setItem(PASSWORD_KEY, value);
      if (remember) localStorage.setItem(PASSWORD_KEY, value);
    } catch { /* sin almacenamiento: habra que escribirla cada vez */ }
  }
  function forgetPassword() {
    try {
      sessionStorage.removeItem(PASSWORD_KEY);
      localStorage.removeItem(PASSWORD_KEY);
    } catch { /* nada */ }
  }

  function storedPlace() {
    try {
      const place = JSON.parse(localStorage.getItem(PLACE_KEY));
      return Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude) ? place : DEFAULT_PLACE;
    } catch { return DEFAULT_PLACE; }
  }
  function storePlace(place) {
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(place));
    } catch { /* se usara la zona por defecto la proxima vez */ }
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'X-Admin-Password': password, Accept: 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) logout('La contraseña ya no es válida');
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function sendNote(path, method, data) {
    return api(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  // ── Entrar / salir ──

  async function tryLogin(value, remember) {
    password = value;
    await api('/api/admin/check', { method: 'POST' });
    storePassword(value, remember);
    $login.hidden = true;
    $app.hidden = false;
    loadNotes();
    if (!widgetsStarted) {
      widgetsStarted = true;
      startClock();
      showPlace();
      setInterval(loadWeather, WEATHER_EVERY_MS);
    }
  }

  function logout(message) {
    password = '';
    forgetPassword();
    $app.hidden = true;
    resetScore();
    $notes.replaceChildren();
    $login.hidden = false;
    $('password').value = '';
    $('password').focus();
    $('login-msg').textContent = message || '';
  }

  $login.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-msg').textContent = '';
    try {
      await tryLogin($('password').value, $('remember').checked);
    } catch (err) {
      $('login-msg').textContent = err.message;
    }
  });
  $('logout').addEventListener('click', () => logout());

  // ── Saludo y reloj ──

  let score = null; // null: se ve el saludo
  let scoreTimer = null;
  let recentPops = [];

  function renderGreeting() {
    $('greeting').textContent = score === null
      ? `${greetingFor(new Date().getHours())}, Miguel`
      : `Score: ${score}`;
  }

  function resetScore() {
    score = null;
    recentPops = [];
    clearTimeout(scoreTimer);
    renderGreeting();
  }

  window.addEventListener('bubble-pop', () => {
    if ($app.hidden) return;

    if (score !== null) {
      score++;
    } else {
      const now = performance.now();
      recentPops = recentPops.filter((time) => now - time < COMBO_WINDOW_MS);
      recentPops.push(now);
      if (recentPops.length < COMBO_POPS) return;
      score = recentPops.length;
    }

    renderGreeting();
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(resetScore, SCORE_TIMEOUT_MS);
  });

  function greetingFor(hour) {
    if (hour >= 6 && hour < 14) return 'Buenos días';
    if (hour >= 14 && hour < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function drawTicks() {
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 12; i++) {
      const major = i % 3 === 0;
      const tick = document.createElementNS(ns, 'line');
      tick.setAttribute('class', major ? 'tick major' : 'tick');
      tick.setAttribute('x1', 100);
      tick.setAttribute('y1', 14);
      tick.setAttribute('x2', 100);
      tick.setAttribute('y2', major ? 26 : 22);
      tick.setAttribute('transform', `rotate(${i * 30} 100 100)`);
      $('ticks').appendChild(tick);
    }
  }

  function setHand(id, degrees) {
    $(id).setAttribute('transform', `rotate(${degrees} 100 100)`);
  }

  // Las agujas avanzan de forma continua, sin saltos de segundo en segundo.
  function moveHands() {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    setHand('hand-second', seconds * 6);
    setHand('hand-minute', minutes * 6);
    setHand('hand-hour', hours * 30);
    requestAnimationFrame(moveHands);
  }

  function tick() {
    const now = new Date();
    $('clock-time').textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    $('clock-date').textContent = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    renderGreeting();
  }

  function startClock() {
    drawTicks();
    moveHands();
    tick();
    setInterval(tick, 1000);
  }

  // ── Tiempo (Open-Meteo, sin clave) ──

  const WEATHER_CODES = [
    [[0], 'Despejado', '☀️'],
    [[1], 'Casi despejado', '🌤️'],
    [[2], 'Parcialmente nuboso', '⛅'],
    [[3], 'Nublado', '☁️'],
    [[45, 48], 'Niebla', '🌫️'],
    [[51, 53, 55], 'Llovizna', '🌦️'],
    [[56, 57], 'Llovizna helada', '🌧️'],
    [[61, 63, 65], 'Lluvia', '🌧️'],
    [[66, 67], 'Lluvia helada', '🌧️'],
    [[71, 73, 75, 77], 'Nieve', '🌨️'],
    [[80, 81, 82], 'Chubascos', '🌦️'],
    [[85, 86], 'Chubascos de nieve', '🌨️'],
    [[95, 96, 99], 'Tormenta', '⛈️'],
  ];

  function describeWeather(code) {
    const [, label, icon] = WEATHER_CODES.find(([codes]) => codes.includes(code)) || [[], '', '🌡️'];
    return { label, icon };
  }

  function dayName(isoDate) {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' });
  }

  function renderDays(daily) {
    // El primer dia es hoy: ya se ve arriba.
    const days = daily.time.slice(1).map((date, i) => {
      const day = document.createElement('div');
      day.className = 'weather-day';
      const name = Object.assign(document.createElement('span'), { className: 'day-name', textContent: dayName(date) });
      const { icon, label } = describeWeather(daily.weather_code[i + 1]);
      const glyph = Object.assign(document.createElement('span'), { className: 'day-icon', textContent: icon, title: label });
      const max = Math.round(daily.temperature_2m_max[i + 1]);
      const min = Math.round(daily.temperature_2m_min[i + 1]);
      const temps = Object.assign(document.createElement('span'), { textContent: `${max}° / ${min}°` });
      day.append(name, glyph, temps);
      return day;
    });
    $('w-days').replaceChildren(...days);
  }

  let weatherRequest = 0;

  async function loadWeather() {
    const request = ++weatherRequest;
    const { latitude, longitude } = storedPlace();
    const params = new URLSearchParams({
      latitude,
      longitude,
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: 'auto',
      forecast_days: 4,
    });

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error();
      const { current, daily } = await res.json();
      if (request !== weatherRequest) return; // ya se ha elegido otra zona

      const clearNight = !current.is_day && current.weather_code <= 1;
      const { label, icon } = describeWeather(current.weather_code);
      $('w-icon').textContent = clearNight ? '🌙' : icon;
      $('w-temp').textContent = `${Math.round(current.temperature_2m)}°`;
      $('w-desc').textContent = label;
      $('w-feels').textContent = `${Math.round(current.apparent_temperature)}°`;
      $('w-humidity').textContent = `${Math.round(current.relative_humidity_2m)}%`;
      $('w-wind').textContent = `${Math.round(current.wind_speed_10m)} km/h`;
      renderDays(daily);
    } catch {
      if (request === weatherRequest) $('w-desc').textContent = 'No se pudo cargar el tiempo';
    }
  }

  function showPlace() {
    $place.textContent = storedPlace().name;
    loadWeather();
  }

  function closeSearch() {
    searchRequest++;
    clearTimeout(searchTimer);
    $placeForm.hidden = true;
    $place.hidden = false;
    $placeResults.replaceChildren();
  }

  function choosePlace(place) {
    storePlace(place);
    closeSearch();
    showPlace();
  }

  function renderPlaces(results) {
    if (results.length === 0) {
      $placeResults.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Sin resultados' }));
      return;
    }
    $placeResults.replaceChildren(...results.map((r) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
      button.addEventListener('click', () => {
        choosePlace({ name: r.name, latitude: r.latitude, longitude: r.longitude });
      });
      return button;
    }));
  }

  let searchTimer = null;
  let searchRequest = 0;

  async function searchPlaces(query) {
    const request = ++searchRequest;
    const params = new URLSearchParams({ name: query, count: 5, language: 'es' });
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      if (!res.ok) throw new Error();
      const { results } = await res.json();
      if (request === searchRequest) renderPlaces(results || []);
    } catch {
      if (request === searchRequest) {
        $placeResults.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'No se pudo buscar' }));
      }
    }
  }

  $place.addEventListener('click', () => {
    $place.hidden = true;
    $placeForm.hidden = false;
    $placeInput.value = '';
    $placeInput.focus();
  });

  $placeInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const query = $placeInput.value.trim();
    if (query.length < 2) {
      searchRequest++;
      $placeResults.replaceChildren();
      return;
    }
    searchTimer = setTimeout(() => searchPlaces(query), SEARCH_DELAY_MS);
  });

  $placeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
  });

  // Enter elige el primer resultado.
  $placeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    $placeResults.querySelector('button')?.click();
  });

  // ── Notas ──

  function showNotesError(err) {
    $notesMsg.textContent = err.message;
  }

  function fitHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function renderNote(note) {
    const row = document.createElement('li');
    row.className = note.done ? 'note done' : 'note';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = note.done;
    check.setAttribute('aria-label', 'Marcar como hecha');
    check.addEventListener('change', async () => {
      try {
        await sendNote(`/api/notes/${note.id}`, 'PATCH', { done: check.checked });
        await loadNotes();
      } catch (err) {
        check.checked = !check.checked;
        showNotesError(err);
      }
    });

    const text = document.createElement('textarea');
    text.rows = 1;
    text.maxLength = 500;
    text.value = note.body;
    text.setAttribute('aria-label', 'Texto de la nota');
    text.addEventListener('input', () => fitHeight(text));
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      }
    });
    let saved = note.body;
    text.addEventListener('change', async () => {
      const body = text.value.trim();
      if (!body) {
        text.value = saved;
        fitHeight(text);
        return;
      }
      try {
        await sendNote(`/api/notes/${note.id}`, 'PATCH', { body });
        saved = body;
        $notesMsg.textContent = '';
      } catch (err) {
        showNotesError(err);
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Borrar nota');
    remove.addEventListener('click', async () => {
      try {
        await api(`/api/notes/${note.id}`, { method: 'DELETE' });
        await loadNotes();
      } catch (err) {
        showNotesError(err);
      }
    });

    row.append(check, text, remove);
    return row;
  }

  async function loadNotes() {
    try {
      const { notes } = await api('/api/notes');
      $notes.replaceChildren(...notes.map(renderNote));
      $notes.querySelectorAll('textarea').forEach(fitHeight);
      $notesMsg.textContent = '';
    } catch (err) {
      showNotesError(err);
    }
  }

  $('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('note-input');
    const body = input.value.trim();
    if (!body) return;
    try {
      await sendNote('/api/notes', 'POST', { body });
      input.value = '';
      await loadNotes();
    } catch (err) {
      showNotesError(err);
    }
  });

  // Si ya habia contraseña guardada, se entra directamente.
  const saved = storedPassword();
  if (saved) {
    tryLogin(saved, false).catch(() => logout());
  } else {
    $login.hidden = false;
    $('password').focus();
  }
})();
