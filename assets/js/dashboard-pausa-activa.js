/**
 * Pausa Activa Module - KJA Dashboard
 * Adaptado de Figma Make a Vanilla JavaScript modular
 */

(function () {
  'use strict';

  const BREAKS = [
    {
      id: "movilidad",
      title: "Movilidad articular",
      subtitle: "Pausa activa · 20 min",
      duration: 20 * 60,
      zones: "Lumbar · Hombros · Caminata",
      activities: [
        {
          title: "Rota los hombros",
          suggestions: [
            "Lleva los hombros hacia atrás trazando círculos amplios y suaves.",
            "Imagina que quieres tocar las orejas con los hombros y luego bájalos despacio.",
            "Siente cómo liberas la tensión acumulada con cada rotación.",
            "Puedes hacerlo de pie o sentado, lo que te resulte más cómodo."
          ]
        },
        {
          title: "Moviliza la zona lumbar",
          suggestions: [
            "De pie, coloca las manos en la cintura y haz círculos suaves con la cadera.",
            "Inclínate levemente hacia adelante y enderézate lentamente.",
            "Respira profundo en cada movimiento para soltar tensión.",
            "No hay prisa; escucha lo que necesita tu cuerpo hoy."
          ]
        },
        {
          title: "Caminata activa",
          suggestions: [
            "Levántate y da unos pasos por el espacio que tengas disponible.",
            "Puedes caminar en el lugar elevando levemente las rodillas.",
            "Aprovecha para hidratarte o simplemente cambiar de postura.",
            "Cualquier movimiento suma. Incluso tres pasos ayudan."
          ]
        },
        {
          title: "Estiramiento de brazos",
          suggestions: [
            "Extiende un brazo frente a ti y jala los dedos suavemente hacia atrás.",
            "Cruza un brazo sobre el pecho y sostenlo con el otro para estirar el hombro.",
            "Mantén cada posición unos segundos; sin dolor, solo alivio.",
            "Repite al otro lado cuando te sientas listo."
          ]
        }
      ]
    },
    {
      id: "visual",
      title: "Descanso visual y cervical",
      subtitle: "Pausa activa · 10 min",
      duration: 10 * 60,
      zones: "Regla 20-20-20 · Cuello · Postura",
      activities: [
        {
          title: "Descansa la vista",
          suggestions: [
            "Aparta la mirada de la pantalla y enfoca un punto lejano durante 20 segundos.",
            "Cierra los ojos suavemente y deja que descansen unos instantes.",
            "Parpadea varias veces para hidratar la córnea de forma natural.",
            "No es obligatorio; si prefieres, simplemente mira al horizonte."
          ]
        },
        {
          title: "Libera tensión cervical",
          suggestions: [
            "Inclina suavemente la cabeza hacia un lado y mantén unos segundos.",
            "Lleva la oreja hacia el hombro sin forzar; siente el estiramiento lateral.",
            "Gira la cabeza lentamente de izquierda a derecha.",
            "Repite al otro lado cuando quieras. Escucha tu ritmo."
          ]
        },
        {
          title: "Revisa tu postura",
          suggestions: [
            "Siéntate con la espalda apoyada en el respaldo de la silla.",
            "Ajusta la pantalla a la altura de los ojos si es posible.",
            "Relaja los hombros: aleja las orejas de ellos.",
            "Pequeños ajustes ahora evitan molestias más tarde."
          ]
        },
        {
          title: "Respiración consciente",
          suggestions: [
            "Inhala lentamente por la nariz contando hasta cuatro.",
            "Retén el aire un momento y exhala despacio.",
            "Permite que el ritmo de la respiración marque el cierre de la pausa.",
            "Cuando te sientas listo, regresa a tus tareas con calma."
          ]
        }
      ]
    }
  ];

  function getActivityFigure(breakId, idx, card = false) {
    const warm = breakId === 'movilidad';
    const shirt = warm ? '#b96f56' : '#588675';
    const light = warm ? '#edc6b4' : '#bad5c6';
    const skin = '#d9a384';
    const ink = '#283b4c';
    const limb = (d, color, width = 9) => '<path d="' + d + '" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    const head = (x = 60, y = 28, tilt = 0) => '<g transform="rotate(' + tilt + ' ' + x + ' ' + y + ')"><path d="M' + (x-3) + ' ' + (y+5) + 'v12h7V' + (y+5) + '" fill="' + skin + '"/><ellipse cx="' + x + '" cy="' + y + '" rx="8" ry="10" fill="' + skin + '"/><path d="M' + (x-8) + ' ' + (y+1) + 'q-5-15 8-14 12 0 8 13l-3-7q-5 4-13 2Z" fill="' + ink + '"/><path d="M' + (x+2) + ' ' + (y+5) + 'h2" stroke="#93624e" stroke-linecap="round"/></g>';
    const torso = '<path d="M49 41q11-5 22 0l5 30q-15 6-31 0Z" fill="' + shirt + '"/><path d="M51 44q-2 12-1 22" stroke="' + light + '" stroke-width="2" stroke-linecap="round" opacity=".6"/>';
    const legs = limb('M53 74 49 106', ink, 11) + limb('M67 74 73 106', '#435565', 11) + limb('M48 109h-8M74 109h8', ink, 6);
    const arrows = (d) => '<path d="' + d + '" fill="none" stroke="' + shirt + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>';
    const standing = (arms, motion = '') => legs + head() + torso + arms + motion;
    let art;
    if (warm) {
      art = [
        standing(limb('M48 46 36 58 30 42', skin, 7) + limb('M72 46 84 58 90 42', skin, 7) + limb('M48 45 40 52', shirt, 10) + limb('M72 45 80 52', shirt, 10), '<g class="pausa-anim-spin">' + arrows('M23 29a12 12 0 0 1 14 5m0 0-6-1m6 1-1-6M97 29a12 12 0 0 0-14 5m0 0 6-1m-6 1 1-6') + '</g>'),
        standing(limb('M48 46 35 61 48 68', skin, 7) + limb('M72 46 85 61 72 68', skin, 7) + limb('M48 45 42 53', shirt, 10) + limb('M72 45 78 53', shirt, 10), '<g class="pausa-anim-sway">' + arrows('M30 78c-7 12 48 20 59 3m0 0-1 7m1-7-7 1') + '</g>'),
        '<g class="pausa-anim-step">' + limb('M56 73 44 91 31 102', ink, 11) + limb('M64 73 77 87 81 105', '#435565', 11) + limb('M31 105h-9M82 108h9', ink, 6) + head(62, 27) + '<path d="m54 39 16 3-3 34-18-3Z" fill="' + shirt + '"/>' + limb('M53 46 40 58 28 53', skin, 7) + limb('M69 46 81 56 91 48', skin, 7) + limb('M54 45 47 52', shirt, 10) + limb('M70 46 76 52', shirt, 10) + '</g>',
        standing(limb('M72 46 43 49 33 43', skin, 7) + limb('M48 46 49 61 64 46', skin, 7) + limb('M72 45 61 47', shirt, 10) + limb('M48 45 48 53', shirt, 10), arrows('M37 29H23m0 0 5-4m-5 4 5 4'))
      ][idx];
    } else {
      art = [
        '<path d="M20 61q39-43 80 0-40 42-80 0Z" fill="#fffdf8" stroke="#729886" stroke-width="2"/><path d="M20 61q39-43 80 0" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="60" r="18" fill="#90b4a1"/><circle cx="60" cy="60" r="11" fill="' + ink + '"/><circle cx="65" cy="54" r="4" fill="white"/><path d="M30 39l-4-5m19-2-2-6m32 8 3-6m13 14 5-4" stroke="' + ink + '" stroke-width="2" stroke-linecap="round"/>' + arrows('M46 92h28'),
        '<path d="M31 110V76q0-22 22-24h15q22 2 22 24v34" fill="' + shirt + '"/>' + head(58, 37, -18) + '<path d="M52 54q8 8 17-1" fill="none" stroke="' + light + '" stroke-width="3"/>' + limb('M39 76v30M82 76v30', skin, 9) + '<g class="pausa-anim-spin">' + arrows('M29 25q-10 13-5 24m0 0-5-4m5 4 3-6M84 22q12 11 10 23m0 0-4-5m4 5 4-5') + '</g>',
        '<path d="M25 54v34h40M30 88v23m30-23v23" stroke="#a7b5ae" stroke-width="5" fill="none" stroke-linecap="round"/>' + limb('M44 80h25l4 26', ink, 10) + limb('M74 109h9', ink, 6) + head(44, 30) + '<path d="M35 43q8-5 17 0l4 38H34Z" fill="' + shirt + '"/>' + limb('M49 51 60 64h20', skin, 7) + limb('M49 50 54 57', shirt, 10) + '<path d="M66 72h44m-8 0v39" stroke="#8c9c96" stroke-width="3" fill="none"/><rect x="79" y="37" width="28" height="23" rx="3" fill="#d0ded6" stroke="#779287" stroke-width="2"/><path d="M91 61v8m-7 0h15" stroke="#779287" stroke-width="2"/>' ,
        '<circle class="pausa-anim-breathe" cx="60" cy="62" r="42" fill="none" stroke="#a3c5b3" stroke-width="1.5"/>' + head(60, 30) + torso + limb('M48 48 36 71 26 77', skin, 7) + limb('M72 48 84 71 94 77', skin, 7) + limb('M48 46 44 56', shirt, 10) + limb('M72 46 76 56', shirt, 10) + '<path d="M48 74Q13 92 35 100l25-8 25 8q22-8-13-26Z" fill="' + ink + '"/><path d="m43 88 17 5 16-5" stroke="#70838c" stroke-width="2" fill="none" stroke-linecap="round"/>'
      ][idx];
    }
    return '<svg viewBox="0 0 120 124" class="' + (card ? 'pausa-illu-card' : 'pausa-fig-svg') + '" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="61" r="51" fill="' + (warm ? '#f4e7df' : '#e8f0e9') + '"/><ellipse cx="60" cy="113" rx="30" ry="3" fill="' + ink + '" opacity=".08"/>' + (art || '') + '</svg>';
  }

  const PREFIX = 'kja-pausa-local-v1:';
  let owner = '', session = null, timer = null, rotation = null, activity = 0;
  let persistent = true, trigger = null, view = 'selection', suggestion = 0;
  const el = id => document.getElementById(id);
  const overlay = () => el('pausa-activa-overlay');
  const container = () => el('pausa-activa-container');
  const item = () => BREAKS.find(b => b.id === session?.type);
  const key = () => PREFIX + owner;
  const remaining = () => Math.max(0, Math.ceil((session.end - Date.now()) / 1000));
  const format = seconds => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  function stop() {
    if (timer !== null) clearInterval(timer);
    if (rotation !== null) clearInterval(rotation);
    timer = rotation = null;
  }
  function read() {
    if (!owner) return null;
    try {
      const raw = localStorage.getItem(key());
      if (raw === null) return null;
      const data = JSON.parse(raw), b = BREAKS.find(b => b.id === data?.type);
      if (!b || data.version !== 1 || !Number.isFinite(data.start) || !Number.isFinite(data.end) || data.end - data.start !== b.duration * 1000 || data.start > Date.now()) {
        localStorage.removeItem(key()); persistent = false; return null;
      }
      return {version:1,type:data.type,start:data.start,end:data.end};
    } catch { persistent = false; return null; }
  }
  function save() {
    if (!owner) return;
    try { if (session) localStorage.setItem(key(),JSON.stringify(session)); else localStorage.removeItem(key()); }
    catch { persistent = false; }
  }
  function storageNote() {
    return persistent ? 'El contador continúa en este navegador al cerrar la ventana o recargar.' : 'No se pudo guardar en este navegador. El contador continúa mientras esta página siga abierta; se perderá al recargar.';
  }
  function rail() {
    const button = el('rail-pausa-open'); if (!button) return;
    button.disabled = !owner;
    button.querySelector('.rail-pausa-duration').textContent = session ? 'Pausa en curso' : '10 o 20 min';
    button.querySelector('.rail-pausa-info > span').textContent = 'Muévete. Respira. Continúa.';
    button.querySelector('.rail-pausa-footer > span:first-child').textContent = session ? 'Volver a mi pausa' : 'Tomar una pausa';
    const figure = button.querySelector('.rail-pausa-figure');
    if (figure && !figure.firstChild) figure.innerHTML = '<span class="rail-pausa-character">'+getActivityFigure('movilidad',0,true)+'</span>'+
      '<span class="rail-pausa-character rail-pausa-extra">'+getActivityFigure('movilidad',3,true)+'</span>'+
      '<span class="rail-pausa-character rail-pausa-extra">'+getActivityFigure('visual',3,true)+'</span>';
  }
  function setAccount(id) {
    const next = String(id || '');
    if (next === owner) return;
    stop(); close(); owner = next; session = null; persistent = true; activity = 0; view = 'selection';
    session = read(); rail();
    // Restore silently: a reload never forces the dialog open.
    if (session && remaining() === 0) { session = null; save(); rail(); }
  }
  function signOut() {
    session = null; save(); setAccount('');
  }
  function close() {
    stop();
    overlay()?.classList.remove("pausa-session-running");
    if (overlay()) overlay().hidden = true;
    document.body.classList.remove('kja-announcement-open');
    trigger?.focus();
  }
  function selection() {
    if (session) { running(); return; }
    view = 'selection';
    stop();
    overlay()?.classList.remove("pausa-session-running");
    const node = container();
    if (!node) return;

    node.className = "pausa-modal-dialog pausa-modal-selection";
    node.innerHTML = `
      <div class="pausa-header">
        <div class="pausa-header-left">
          <img src="assets/pausa-activa/d7974.svg" alt="Pausas Activas">
          <h2 id="pausa-activa-title">Pausas activas</h2>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-close-modal" data-pausa-close aria-label="Cerrar modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="pausa-daily-status" role="status">
        <strong>Dos tipos de pausa</strong>
        <span>${persistent ? 'Úsalas cuando quieras' : 'Solo en esta página'}</span>
        <div class="pausa-daily-track" aria-hidden="true"><i></i><i></i></div>
      </div>

      <div class="pausa-cards-grid">
        ${BREAKS.map((b, idx) => {
          const mins = Math.floor(b.duration / 60);
          const hint = idx === 0
            ? "Movimientos articulares para despertar el cuerpo."
            : "Regla 20-20-20, cuello y postura.";


          return `
            <div class="pausa-flip-container" data-break-id="${b.id}" id="pausa-card-${b.id}">
              <div class="pausa-flip-inner">
                <!-- Front -->
                <div class="pausa-card-front">
                  <div class="pausa-card-tag-row">
                    <span class="pausa-card-tag">Pausa activa</span>
                    <span class="pausa-card-action-text ">ver más →</span>
                  </div>
                  <div class="pausa-card-time">
                    <b>${mins}</b>
                    <span>min</span>
                    <div class="pausa-card-figure" aria-hidden="true">${getActivityFigure(b.id, 0, true)}</div>
                  </div>
                  <div class="pausa-card-title">${b.title}</div>
                  <div class="pausa-card-hint">${hint}</div>
                </div>
                <!-- Back -->
                <div class="pausa-card-back">
                  <div class="pausa-card-tag-row">
                    <span class="pausa-card-tag">${mins} min</span>
                    <span class="pausa-card-action-text">← volver</span>
                  </div>
                  <div class="pausa-card-title">${b.title}</div>
                  <div class="pausa-card-zones">${b.zones}</div>
                  <button type="button" class="pausa-btn-start" data-start-break="${b.id}" >
                    Comenzar
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <details class="pausa-usage-note">
        <summary>Cómo funcionan tus pausas</summary>
        <p>Puedes repetirlas cuando quieras, sin registro de actividad. ${storageNote()}</p>
      </details>
    `;

    // Eventos
    node.querySelector("#pausa-btn-close-modal").onclick = close;

    BREAKS.forEach(b => {

      const cardEl = node.querySelector(`#pausa-card-${b.id}`);
      if (cardEl) {
        const front = cardEl.querySelector('.pausa-card-front');
        const back = cardEl.querySelector('.pausa-card-back');
        const flip = () => {
          const expanded = cardEl.classList.toggle('is-flipped');
          if (front) { front.inert = expanded; front.tabIndex = expanded ? -1 : 0; front.setAttribute('aria-expanded', String(expanded)); }
          if (back) back.inert = !expanded;
          if (expanded) back?.querySelector('.pausa-btn-start')?.focus();
          else front?.focus();
        };
        if (front) {
          front.tabIndex = 0; front.setAttribute('role', 'button');
          front.setAttribute('aria-expanded', 'false');
          front.setAttribute('aria-label', b.title + '. Pulsa Enter para ver los detalles.');
          front.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
        }
        if (back) back.inert = true;
        cardEl.onclick = (e) => {
          if (e.target.closest(".pausa-btn-start")) return;
          flip();
        };

        const startBtn = cardEl.querySelector(`[data-start-break="${b.id}"]`);
        if (startBtn) {
          startBtn.onclick = (e) => {
            e.stopPropagation();
            start(b.id);
          };
        }
      }
    });
    node.querySelector("#pausa-btn-close-modal").focus();
  }
  function start(type) {
    if (!owner || !BREAKS.some(b => b.id === type)) return;
    // Read the current value immediately before starting, including another tab's pause.
    const stored = persistent ? read() : null;
    if (stored) session = stored;
    if (session && remaining() > 0) { running(); return; }
    const b = BREAKS.find(b => b.id === type), now = Date.now();
    session = {version:1,type,start:now,end:now+b.duration*1000}; activity = 0; suggestion = 0;
    save(); rail(); running();
  }
  function updateActivity(animate = false) {
    const b = item(); if (!b) return;
    const a = b.activities[activity];
    el('pausa-act-title').textContent = a.title;
    el('pausa-suggestion-display').textContent = a.suggestions[suggestion % a.suggestions.length];
    el('pausa-act-figure').innerHTML = getActivityFigure(b.id,activity);
    const label = container().querySelector('.pausa-act-tag');
    if (label) label.textContent = `Actividad ${activity+1} de ${b.activities.length}`;
    const content = container().querySelector('.pausa-act-content');
    if (animate && content?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      content.getAnimations?.().forEach(animation => animation.cancel());
      content.animate([{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    container().querySelectorAll('[data-act-idx]').forEach(button => button.classList.toggle('active',Number(button.dataset.actIdx) === activity));
  }
  function running() {
    if (!session) { selection(); return; }
    stop();
    if (!remaining()) { complete(); return; }
    const currentBreak = item(), currentActivityIdx = activity, suggestionIdx = suggestion % currentBreak.activities[activity].suggestions.length;
    const totalSeconds = currentBreak.duration, secondsLeft = remaining();
    overlay()?.classList.add('pausa-session-running');
    const node = container();
    if (!node || !currentBreak) return;
    view = 'running';

    const activeGuide = currentBreak.activities[currentActivityIdx];
    const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

    node.className = "pausa-modal-dialog pausa-modal-session";
    node.innerHTML = `
      <div class="pausa-session-header">
        <div>
          <h2 class="pausa-session-title" id="pausa-activa-title">${currentBreak.title}</h2>
          <p class="pausa-session-subtitle">${currentBreak.subtitle}</p>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-confirm-exit" aria-label="Cerrar pausa">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="pausa-timer-box">
        <span class="pausa-timer-label">Tiempo restante</span>
        <div class="pausa-timer-digit" id="pausa-timer-display">${format(secondsLeft)}</div>
        <p id="pausa-sync-status" role="status">${storageNote()}</p>
        <div class="pausa-progress-track">
          <div class="pausa-progress-bar" id="pausa-progress-bar" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="pausa-activity-box">
        <span class="pausa-act-tag">Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}</span>
        <div class="pausa-act-content">
          <div class="pausa-act-figure-wrap" id="pausa-act-figure" aria-hidden="true">${getActivityFigure(currentBreak.id, currentActivityIdx)}</div>
          <div class="pausa-act-details">
            <div class="pausa-act-title" id="pausa-act-title">${activeGuide.title}</div>
            <div class="pausa-act-suggestion" id="pausa-suggestion-display">${activeGuide.suggestions[suggestionIdx]}</div>
          </div>
        </div>

        <div class="pausa-dots-row">
          <div class="pausa-dots" id="pausa-dots-container">
            ${currentBreak.activities.map((_, i) => `
              <button type="button" class="pausa-dot ${i === currentActivityIdx ? 'active' : ''}" data-act-idx="${i}" aria-label="Actividad ${i+1}"></button>
            `).join('')}
          </div>
          <span class="pausa-rot-hint">Ejercicios que rotan cada 10 s · avanza a tu ritmo</span>
        </div>
      </div>
    `;

    node.querySelector("#pausa-btn-confirm-exit").onclick = confirmExit;

    node.querySelectorAll(".pausa-dot").forEach(btn => {
      btn.onclick = () => {
        activity = parseInt(btn.dataset.actIdx, 10);
        suggestion = 0;
        updateActivity();

      };
    });
    node.querySelector('#pausa-btn-confirm-exit').focus();
    tick();
    timer = setInterval(tick,1000);
    rotation = setInterval(() => {activity = (activity+1) % item().activities.length; if (activity === 0) suggestion++; updateActivity(true);},10000);
  }
  function confirmExit() {
    if (!session) return;
    view = 'confirm';
    if (rotation !== null) clearInterval(rotation); rotation = null;

    const node = container();
    if (!node) return;

    node.className = "pausa-modal-dialog pausa-modal-confirm";
    node.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <h2 id="pausa-activa-title" style="font-size:24px; font-weight:700; color:#1e293b; margin:0; font-family:'Fraunces', Georgia, serif;">¿Seguro que quieres salir?</h2>
        <p style="font-size:14px; color:#475569; line-height:1.5; margin:0;">
          Salir de todas formas cancela esta pausa en las pestañas de este navegador. Puedes volver a iniciarla cuando quieras. Cerrar la ventana con Escape o pulsar fuera conserva el contador.
        </p>
      </div>

      <div class="pausa-action-group">
        <button type="button" class="pausa-btn-primary" id="pausa-btn-resume">Continuar la pausa</button>
        <button type="button" class="pausa-btn-secondary" id="pausa-btn-exit-anyway">Salir de todas formas</button>
      </div>

      <p style="text-align:center; font-size:12px; color:#94a3b8; margin:16px 0 0;">
        Solo toma unos minutos más. ¡Vale la pena!
      </p>
    `;

    node.querySelector("#pausa-btn-resume").onclick = () => {
      running();
    };

    node.querySelector("#pausa-btn-exit-anyway").onclick = () => cancel();
    node.querySelector('#pausa-btn-resume').focus();
  }
  function tick() {
    if (!session) return;
    const seconds = remaining();
    if (!seconds) { complete(); return; }
    if (el('pausa-timer-display')) el('pausa-timer-display').textContent = format(seconds);
    if (el('pausa-progress-bar')) el('pausa-progress-bar').style.width = `${100*(1-seconds/item().duration)}%`;
  }
  function cancel() {
    stop(); session = null; save(); rail(); selection();
  }
  function complete() {
    stop(); session = null; save(); rail(); view = 'complete';
    overlay()?.classList.remove("pausa-session-running");
    const node = container();
    if (!node) return;

    node.className = "pausa-modal-dialog pausa-modal-complete";
    node.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="width:48px; height:48px; border-radius:14px; background:#f0fdf4; color:#16a34a; display:flex; align-items:center; justify-content:center; margin-bottom:4px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 id="pausa-activa-title" style="font-size:24px; font-weight:700; color:#1e293b; margin:0; font-family:'Fraunces', Georgia, serif;">Pausa completada</h2>
        <p style="font-size:14px; color:#475569; line-height:1.5; margin:0;">
          Cumpliste el tiempo de la pausa. Puedes volver a tus tareas cuando estés listo.
        </p>
      </div>

      <div class="pausa-action-group">
        <button type="button" class="pausa-btn-primary" id="pausa-btn-back-selection">Volver a pausas</button>
      </div>
    `;

    node.querySelector("#pausa-btn-back-selection").onclick = () => {
      selection();
    };
    node.querySelector('#pausa-btn-back-selection').focus();
  }
  function sync() {
    if (!owner) return;
    const previous = session, stored = persistent ? read() : session;
    session = stored; rail();
    if (overlay()?.hidden) return;
    if (session) running();
    else if (previous && previous.end <= Date.now()) complete();
    else if (view !== 'complete') selection();
  }
  function open() {
    if (!owner || !overlay()) return;
    trigger = el('rail-pausa-open'); overlay().hidden = false;
    document.body.classList.add('kja-announcement-open');
    sync();
    if (!session && view !== 'complete') selection();
  }
  function init() {
    el('rail-pausa-open')?.addEventListener('click',open);
    el('pausa-activa-backdrop')?.addEventListener('click',close);
    overlay()?.addEventListener('click',event => {if (event.target === overlay()) close();});
    document.addEventListener('keydown',event => {
      if (overlay()?.hidden) return;
      if (event.key === 'Escape') {event.preventDefault(); close();}
      if (event.key !== 'Tab') return;
      const buttons = [...container().querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(button => !button.closest('[inert]')), first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    });
    window.addEventListener('storage',event => {if (owner && (event.key === key() || event.key === null)) sync();});
    document.addEventListener('visibilitychange',() => {
      if (document.hidden) stop(); else sync();
    });
    window.addEventListener('pageshow',sync);
    window.addEventListener('pagehide',stop);
    setAccount(typeof APP !== 'undefined' ? APP.sessionUid : '');
  }
  window.KJAPausasLocal = {setAccount,signOut};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
