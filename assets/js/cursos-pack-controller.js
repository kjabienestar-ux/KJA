/* KJA-006: estado del pack de cuatro cursos. Conecta el catálogo con la vista de cursos-oferta.js. */
(() => {
  'use strict';
  const view = window.KJA_COURSE_OFFER;
  if (!view || window.KJA_COURSE_PACK || typeof KJA_FORMATION === 'undefined') return;

  const LIMIT = 4;
  const STORAGE_KEY = 'kja-pack-v1';
  const WHATSAPP = '51988918238';
  const catalog = new Map(KJA_FORMATION.courses.map(course => [course.id, course]));
  const grid = document.getElementById('formation-courses-grid');
  const dock = document.querySelector('.offer-dock');
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const courseName = id => catalog.get(id).fullTitle || catalog.get(id).title;
  let ids = [];
  let noteTimer;
  let mascotTimer;

  // Validación propia: la vista lanza TypeError, aquí se filtra antes para no romper el flujo del visitante.
  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter(id => typeof id === 'string' && catalog.has(id)))].slice(0, LIMIT);
  }

  function load() {
    try {
      const stored = sanitize(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return stored;
    } catch {
      return [];
    }
  }

  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* Sin almacenamiento: el pack vive solo en esta visita. */ }
  }

  const status = document.createElement('p');
  status.className = 'formation-pack-sr';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  (document.getElementById('catalogo') || document.body).appendChild(status);

  function syncCards() {
    if (!grid) return;
    const full = ids.length === LIMIT;
    grid.querySelectorAll('[data-offer-add]').forEach(button => {
      const index = ids.indexOf(button.dataset.offerAdd);
      const inPack = index >= 0;
      button.hidden = false;
      button.setAttribute('aria-pressed', String(inPack));
      button.dataset.packFull = String(full && !inPack);
      button.querySelector('.formation-pack-label').textContent = !inPack ? 'Agregar al pack' : index === LIMIT - 1 ? 'Gratis en tu pack' : 'En tu pack';
      const card = button.closest('[data-formation-course]');
      if (card) card.dataset.inPack = String(inPack);
    });
  }

  function sync() {
    view.setSelection(ids);
    syncCards();
    save();
  }

  function add(id) {
    if (!catalog.has(id)) return { ok: false, reason: 'unknown' };
    if (ids.includes(id)) return { ok: false, reason: 'duplicate' };
    if (ids.length >= LIMIT) return { ok: false, reason: 'full' };
    ids = [...ids, id];
    sync();
    return { ok: true, count: ids.length };
  }

  function remove(id) {
    if (!ids.includes(id)) return { ok: false, reason: 'missing' };
    ids = ids.filter(item => item !== id);
    sync();
    return { ok: true, count: ids.length };
  }

  function buildMessage(list = ids) {
    const lines = list.map((id, index) => `${index + 1}. ${courseName(id)}${index === LIMIT - 1 ? ' (incluido gratis)' : ''}`);
    return ['Hola KJA, vengo por la oferta de cursos de su web: 3 cursos por S/99 en total + 1 gratis.', 'Elegí estos 4 cursos:', ...lines, 'Quisiera confirmar mi inscripción.'].join('\n');
  }

  const whatsappUrl = (list = ids) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(buildMessage(list))}`;

  function checkout() {
    const valid = sanitize(ids);
    if (valid.length !== LIMIT || valid.length !== ids.length) {
      ids = valid;
      sync();
      return false;
    }
    // Se abre dentro del mismo gesto del usuario; el visitante decide si envía el mensaje.
    const opened = window.open(whatsappUrl(valid), '_blank');
    if (opened) opened.opener = null;
    else window.location.assign(whatsappUrl(valid));
    return true;
  }

  function announce(text) {
    status.textContent = '';
    requestAnimationFrame(() => { status.textContent = text; });
  }

  function showLimitNote(button) {
    clearTimeout(noteTimer);
    document.querySelectorAll('.formation-pack-note').forEach(note => note.remove());
    const note = document.createElement('p');
    note.className = 'formation-pack-note';
    note.setAttribute('aria-hidden', 'true');
    note.textContent = 'Tu pack ya tiene 4 cursos. Quita uno para elegir otro.';
    button.insertAdjacentElement('afterend', note);
    noteTimer = setTimeout(() => note.remove(), 4200);
  }

  // Capa del vuelo: sin foco, sin IDs y sin capturar toques.
  const layer = document.createElement('div');
  layer.className = 'pack-flight-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const flights = new Set();

  function fly(card) {
    const image = card?.querySelector('.formation-course-media img');
    const target = view.getTarget();
    if (reducedMotion() || !image || !target || typeof image.animate !== 'function') return Promise.resolve();
    const from = image.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !to.width) return Promise.resolve();
    const clone = document.createElement('img');
    clone.src = image.currentSrc || image.src;
    clone.alt = '';
    clone.className = 'pack-flight';
    Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    layer.appendChild(clone);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const end = Math.max(.12, Math.min(1, 48 / from.width));
    const animation = clone.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1, borderRadius: '11px' },
      { transform: `translate(${dx * .45}px, ${dy * .45 - 70}px) scale(${(1 + end) / 2})`, opacity: 1, borderRadius: '18px', offset: .5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${end})`, opacity: .25, borderRadius: '50%' }
    ], { duration: 720, easing: 'cubic-bezier(.45, 0, .25, 1)' });
    flights.add(animation);
    return animation.finished
      .then(() => target.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' }))
      .catch(() => {})
      .finally(() => { clone.remove(); flights.delete(animation); });
  }

  window.addEventListener('pagehide', () => flights.forEach(animation => animation.cancel()));

  // Mascota decorativa junto a la pestaña. No forma parte de la vista ni de su estado.
  const mascot = document.createElement('div');
  mascot.className = 'pack-mascot';
  mascot.setAttribute('aria-hidden', 'true');
  mascot.innerHTML = '<p class="pack-mascot-bubble"></p><svg class="pack-mascot-heart" viewBox="0 0 120 120"><defs><linearGradient id="packMascotFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#d4006a"/></linearGradient></defs><path d="M14 58q-12 4-10 18M106 54q12-8 8-22" stroke="#e0006d" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M60 106C24 80 10 62 10 41 10 25 22 14 37 14c11 0 19 6 23 14 4-8 12-14 23-14 15 0 27 11 27 27 0 21-14 39-50 65z" fill="url(#packMascotFill)"/><ellipse cx="40" cy="30" rx="10" ry="6" fill="#fff" opacity=".35" transform="rotate(-25 40 30)"/><g class="pack-mascot-eye"><ellipse cx="45" cy="50" rx="6" ry="8" fill="#fff"/><circle cx="46" cy="51" r="4" fill="#16203f"/></g><g class="pack-mascot-eye"><ellipse cx="75" cy="50" rx="6" ry="8" fill="#fff"/><circle cx="76" cy="51" r="4" fill="#16203f"/></g><path d="M50 66q10 10 20 0" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="33" cy="63" r="5" fill="#ff9cc9"/><circle cx="87" cy="63" r="5" fill="#ff9cc9"/></svg>';
  document.body.appendChild(mascot);
  const mascotMessages = ['', '¡Buena elección! 1 de 4.', '¡Van 2 de 4!', 'Uno más y el cuarto va gratis.', '¡Pack completo! Ábrelo aquí.'];

  function hideMascot() {
    clearTimeout(mascotTimer);
    mascot.dataset.visible = 'false';
  }

  function showMascot(text) {
    if (dock?.dataset.open === 'true') return;
    const rect = view.getTarget().getBoundingClientRect();
    if (!rect.width) return;
    mascot.style.top = `${rect.top + rect.height / 2}px`;
    mascot.style.right = `${window.innerWidth - rect.left + 6}px`;
    mascot.querySelector('.pack-mascot-bubble').textContent = text;
    mascot.dataset.visible = 'true';
    clearTimeout(mascotTimer);
    mascotTimer = setTimeout(hideMascot, 2600);
  }

  dock?.addEventListener('pointerenter', hideMascot);
  if (dock) new MutationObserver(() => { if (dock.dataset.open === 'true') hideMascot(); }).observe(dock, { attributes: true, attributeFilter: ['data-open'] });
  window.addEventListener('resize', hideMascot);

  grid?.addEventListener('click', event => {
    const button = event.target.closest('[data-offer-add]');
    if (!button) return;
    const id = button.dataset.offerAdd;
    if (ids.includes(id)) {
      remove(id);
      announce(`Quitaste ${courseName(id)}. Llevas ${ids.length} de 4.`);
      return;
    }
    const result = add(id);
    if (!result.ok) {
      if (result.reason === 'full') {
        showLimitNote(button);
        showMascot('Tu pack ya tiene 4. Quita uno para cambiarlo.');
        announce('Tu pack ya tiene 4 cursos. Quita uno para elegir otro.');
      }
      return;
    }
    announce(`Agregaste ${courseName(id)}. Llevas ${ids.length} de 4.${ids.length === LIMIT ? ' Tu pack está completo; continúa desde la pestaña OFERTA.' : ''}`);
    const count = ids.length;
    fly(button.closest('[data-formation-course]')).then(() => showMascot(mascotMessages[count]));
  });

  document.addEventListener('kja:offer:remove', ({ detail }) => {
    if (detail && typeof detail.courseId === 'string') remove(detail.courseId);
  });
  document.addEventListener('kja:offer:checkout', () => { checkout(); });

  ids = load();
  sync();
  window.KJA_COURSE_PACK = Object.freeze({
    version: 1,
    ids: () => [...ids],
    add,
    remove,
    buildMessage: list => buildMessage(sanitize(list ?? ids)),
    whatsappUrl: () => whatsappUrl(),
    checkout
  });
})();
