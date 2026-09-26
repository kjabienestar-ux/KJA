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

  let currentBreak = null;
  let timerInterval = null;
  let secondsLeft = 0;
  let totalSeconds = 0;
  let currentActivityIdx = 0;
  let suggestionIdx = 0;
  let suggestionInterval = null;
  let completedBreaks = new Set();
  let session = null, anchorAt = 0, remainingAtAnchor = 0;
  let sessionOwner = null, requestVersion = 0, reading = null, finishing = false;
  let retryAt = 0, viewMode = 'selection';
  const monotonicNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const accountKey = () => String((typeof APP !== 'undefined' ? APP : window.APP)?.inicio?.colaborador?.id || '');
  let channel = null;
  try { if (window.BroadcastChannel) channel = new window.BroadcastChannel('kja-pausas-v2'); } catch {}
  // Los mensajes solo invalidan la vista: nunca autorizan consumos ni finalizaciones.
  function notifyTabs() { channel?.postMessage({ type: 'refresh' }); }
  function clearSession() {
    stopTimer(); stopSuggestionCycle(); session = null; currentBreak = null;
    sessionOwner = null; retryAt = 0;
    getOverlay()?.classList.remove('pausa-session-running');
  }
  function applySnapshot(data) {
    if (data.version !== 2 || !Array.isArray(data.pausas) || !Number.isFinite(Date.parse(data.ahora))) {
      throw new Error('Falta actualizar las pausas en Supabase (dashboard_78). Recarga cuando se aplique.');
    }
    const owner = accountKey();
    if (owner && String(data.colaborador_id) !== owner) return false;
    const previous = session, incoming = data.sesion;
    completedBreaks = new Set(data.pausas);
    if (incoming?.estado === 'en_curso') {
      const item = BREAKS.find(b => b.id === incoming.pausa);
      const remaining = (Date.parse(incoming.fin_at) - Date.parse(data.ahora)) / 1000;
      if (!item || !incoming.id || !Number.isFinite(remaining)) throw new Error('La sesión de pausa no es válida. Actualiza e intenta nuevamente.');
      const changed = previous?.id !== incoming.id;
      session = incoming; currentBreak = item; sessionOwner = owner;
      totalSeconds = item.duration; remainingAtAnchor = Math.max(0, Math.min(totalSeconds, remaining));
      anchorAt = monotonicNow(); secondsLeft = Math.ceil(remainingAtAnchor);
      if (changed) { currentActivityIdx = 0; suggestionIdx = 0; retryAt = 0; }
      const overlay = getOverlay();
      if (overlay) { overlay.hidden = false; overlay.classList.add('pausa-session-running'); }
      document.body.classList.add('kja-announcement-open');
      if (changed || viewMode === 'selection') renderSessionView();
      startTimer();
      if (changed && viewMode === 'session') startSuggestionCycle();
    } else if (previous) {
      clearSession();
      if (incoming?.id === previous.id && incoming.estado === 'completada') {
        playCompletionSound(); renderCompleteView();
      } else if (!getOverlay()?.hidden) renderSelectionView();
    } else if (!starting && viewMode === 'selection' && !getOverlay()?.hidden) {
      renderSelectionView();
    }
    updateRailButton();
    return true;
  }

  // El servidor es la fuente de verdad del saldo diario.
  let starting = false;
  async function pausaRPC(name, args = {}) {
    if (typeof db === 'undefined' || !db?.rpc) throw new Error('No hay conexión. Intenta nuevamente.');
    const { data, error } = await db.rpc(name, args);
    if (error || !data?.ok) {
      const messages = {
        fuera_horario: 'Solo puedes usar pausas dentro de tu horario laboral, después de marcar entrada y antes de salir.',
        consumida: 'Esta pausa ya fue usada hoy.', limite: 'Ya usaste tus dos pausas de hoy.',
        sin_permiso: 'No tienes permiso para realizar esta acción.',
        sin_sesion: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
        tiempo_insuficiente: 'No queda tiempo suficiente en tu jornada para completar esta pausa.',
        tiempo_pendiente: 'La pausa todavía no termina. Estamos sincronizando el tiempo.',
        sesion_no_disponible: 'La pausa fue restablecida o ya no está disponible.',
        actualizar_portal: 'Actualiza la página para usar la nueva versión de pausas.'
      };
      const failure = new Error(messages[data?.motivo] || 'No se pudo consultar o guardar las pausas. Intenta nuevamente.');
      failure.reason = data?.motivo;
      throw failure;
    }
    return data;
  }
  async function loadDailyBreaks() {
    if (reading) return reading;
    const version = requestVersion, owner = accountKey();
    reading = (async () => {
      try {
        const data = await pausaRPC('dash_mis_pausas');
        if (version !== requestVersion || owner !== accountKey()) return false;
        return applySnapshot(data);
      } catch (error) {
        if (version === requestVersion && ['sin_sesion','sin_colaborador'].includes(error.reason)) {
          clearSession(); completedBreaks.clear(); closeModal(); updateRailButton();
        }
        return false;
      }
    })();
    try { return await reading; } finally { reading = null; }
  }

  function usuarioMarcado() {
    try {
      const dia = (typeof APP !== 'undefined' ? APP : window.APP)?.inicio?.dia || {};
      const attendanceCard = document.getElementById('today-attendance-card');
      const visualState = attendanceCard?.dataset?.attendanceState;
      return !!(dia.marcado || dia.marcado_at || visualState === 'marked' || visualState === 'late');
    } catch { return false; }
  }

  // Sonido corto y agradable de campanita/logro con Web Audio API (no requiere archivos externos)
  function playCompletionSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (acorde brillante)
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.1 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.65);
      });
    } catch (e) {
      console.warn("No se pudo reproducir audio:", e);
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function getOverlay() {
    return document.getElementById("pausa-activa-overlay");
  }

  function getModalContainer() {
    return document.getElementById("pausa-activa-container");
  }

  async function openSelectionModal() {
    // Bloquear si el usuario aún no marcó su entrada
    if (!usuarioMarcado()) {
      showEntryRequiredToast();
      return;
    }
    // Consultar el saldo del servidor antes de mostrar las opciones.
    if (!await loadDailyBreaks()) { showEntryRequiredToast('No se pudieron consultar tus pausas. Intenta nuevamente.'); return; }
    const overlay = getOverlay();
    if (!overlay) return;
    if (!currentBreak) renderSelectionView();
    overlay.hidden = false;
    document.body.classList.add("kja-announcement-open");
  }

  // Toast breve no intrusivo que explica por qué no se puede abrir
  function showEntryRequiredToast(message) {
    // Intentar usar el sistema de toast del dashboard si existe
    if (typeof window.toast === 'function') {
      window.toast(message || 'Primero registra tu entrada para acceder a las pausas activas.', true);
      return;
    }
    // Fallback: toast propio mínimo
    const existing = document.getElementById('pausa-entry-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'pausa-entry-toast';
    t.textContent = message || 'Registra tu entrada para activar las pausas activas.';
    t.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'background:#1e293b', 'color:#fff', 'padding:12px 20px',
      'border-radius:12px', 'font-size:13px', 'font-weight:600',
      'z-index:20000', 'box-shadow:0 8px 24px rgba(0,0,0,0.2)',
      'animation:pausaFadeIn 0.25s ease-out'
    ].join(';');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function closeModal() {
    if (starting) return;
    if (currentBreak) { shakeActiveModal(); return; }
    stopTimer();
    stopSuggestionCycle();
    const overlay = getOverlay();
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("kja-announcement-open");
  }

  function shakeActiveModal() {
    const container = getModalContainer();
    if (!container) return;
    container.classList.remove('pausa-dialog-shake');
    void container.offsetWidth;
    container.classList.add('pausa-dialog-shake');
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function stopSuggestionCycle() {
    if (suggestionInterval) {
      clearInterval(suggestionInterval);
      suggestionInterval = null;
    }
  }

  // ─── Vistas del Modal ──────────────────────────────

  // Ilustraciones vectoriales propias: ropa, volumen y posturas legibles.
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

  function renderSelectionView() {
    if (currentBreak) { renderSessionView(); return; }
    viewMode = 'selection';
    stopTimer(); stopSuggestionCycle();
    getOverlay()?.classList.remove("pausa-session-running");
    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-selection";
    container.innerHTML = `
      <div class="pausa-header">
        <div class="pausa-header-left">
          <img src="assets/pausa-activa/d7974.svg" alt="Pausas Activas">
          <h2 id="pausa-activa-title">Pausas activas</h2>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-close-modal" aria-label="Cerrar modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="pausa-daily-status" role="status">
        <strong>${completedBreaks.size} de 2 usadas hoy</strong>
        <span>${completedBreaks.size === 2 ? 'Se renuevan mañana' : completedBreaks.size === 1 ? '1 disponible' : '2 disponibles'}</span>
        <div class="pausa-daily-track" aria-hidden="true"><i class="${completedBreaks.size >= 1 ? 'used' : ''}"></i><i class="${completedBreaks.size >= 2 ? 'used' : ''}"></i></div>
      </div>
      
      <div class="pausa-cards-grid">
        ${BREAKS.map((b, idx) => {
          const isDone = completedBreaks.has(b.id);
          const mins = Math.floor(b.duration / 60);
          const hint = isDone
            ? "Ya usaste esta pausa hoy. Mañana vuelve a estar disponible."
            : idx === 0 
              ? "Movimientos articulares para despertar el cuerpo." 
              : "Regla 20-20-20, cuello y postura.";

          return `
            <div class="pausa-flip-container ${isDone ? 'is-completed' : ''}" data-break-id="${b.id}" id="pausa-card-${b.id}" ${isDone ? 'aria-disabled="true" title="Pausa activa ya realizada hoy"' : ''}>
              <div class="pausa-flip-inner">
                <!-- Front -->
                <div class="pausa-card-front">
                  <div class="pausa-card-tag-row">
                    <span class="pausa-card-tag">${isDone ? 'Usada hoy' : 'Pausa activa'}</span>
                    <span class="pausa-card-action-text ${isDone ? 'pausa-used-check' : ''}">${isDone ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg> Usada' : 'ver más →'}</span>
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
                  <button type="button" class="pausa-btn-start" data-start-break="${b.id}" ${isDone ? 'disabled' : ''}>
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
        <p>Una de cada tipo al día, dentro de tu horario laboral. Se guardan al comenzar y no se acumulan.</p>
      </details>
    `;

    // Eventos
    container.querySelector("#pausa-btn-close-modal").onclick = closeModal;

    BREAKS.forEach(b => {
      const isDone = completedBreaks.has(b.id);
      if (isDone) return; // Sin interacción si ya está completada

      const cardEl = container.querySelector(`#pausa-card-${b.id}`);
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
            startSession(b);
          };
        }
      }
    });
  }

  async function startSession(breakItem) {
    if (starting || currentBreak || !BREAKS.includes(breakItem)) return;
    if (!usuarioMarcado()) { showEntryRequiredToast(); return; }
    starting = true;
    const version = ++requestVersion, owner = accountKey();
    const startButton = getModalContainer()?.querySelector(`[data-start-break="${breakItem.id}"]`);
    if (startButton) { startButton.disabled = true; startButton.textContent = 'Guardando…'; }
    try {
      const data = await pausaRPC('dash_iniciar_pausa', {p_break_id:breakItem.id});
      if (version !== requestVersion || owner !== accountKey()) return;
      ++requestVersion; // Invalida lecturas iniciadas mientras se guardaba el inicio.
      applySnapshot(data);
      notifyTabs();
    } catch (error) { showEntryRequiredToast(error.message); return; }
    finally {
      starting = false;
      if (startButton) { startButton.disabled = false; startButton.textContent = 'Comenzar'; }
    }
  }

  function renderSessionView() {
    const container = getModalContainer();
    if (!container || !currentBreak) return;
    viewMode = 'session';

    const activity = currentBreak.activities[currentActivityIdx];
    const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

    container.className = "pausa-modal-dialog pausa-modal-session";
    container.innerHTML = `
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
        <div class="pausa-timer-digit" id="pausa-timer-display">${formatTime(secondsLeft)}</div>
        <p id="pausa-sync-status" role="status">El tiempo continúa al cambiar de pestaña. La misma pausa se recupera al volver.</p>
        <div class="pausa-progress-track">
          <div class="pausa-progress-bar" id="pausa-progress-bar" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="pausa-activity-box">
        <span class="pausa-act-tag">Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}</span>
        <div class="pausa-act-content">
          <div class="pausa-act-figure-wrap" id="pausa-act-figure" aria-hidden="true">${getActivityFigure(currentBreak.id, currentActivityIdx)}</div>
          <div class="pausa-act-details">
            <div class="pausa-act-title" id="pausa-act-title">${activity.title}</div>
            <div class="pausa-act-suggestion" id="pausa-suggestion-display">${activity.suggestions[suggestionIdx]}</div>
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

    container.querySelector("#pausa-btn-confirm-exit").onclick = renderConfirmView;

    container.querySelectorAll(".pausa-dot").forEach(btn => {
      btn.onclick = () => {
        currentActivityIdx = parseInt(btn.dataset.actIdx, 10);
        suggestionIdx = 0;
        updateActivityDisplay();
        startSuggestionCycle();
      };
    });
  }

  function updateActivityDisplay(animate = false) {
    const titleEl = document.getElementById("pausa-act-title");
    const tagEl = document.querySelector(".pausa-act-tag");
    const sugEl = document.getElementById("pausa-suggestion-display");
    const figEl = document.getElementById("pausa-act-figure");
    const dots = document.querySelectorAll(".pausa-dot");

    if (titleEl && currentBreak) {
      const act = currentBreak.activities[currentActivityIdx];
      titleEl.textContent = act.title;
      if (tagEl) tagEl.textContent = `Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}`;
      if (sugEl) sugEl.textContent = act.suggestions[suggestionIdx] || act.suggestions[0];
      if (figEl) figEl.innerHTML = getActivityFigure(currentBreak.id, currentActivityIdx);
      dots.forEach((d, i) => d.classList.toggle("active", i === currentActivityIdx));
      const content = getModalContainer()?.querySelector('.pausa-act-content');
      if (animate && content?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        content.getAnimations?.().forEach(animation => animation.cancel());
        content.animate([
          { opacity: 0, transform: 'translateX(12px)' },
          { opacity: 1, transform: 'translateX(0)' }
        ], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }
  }

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(tickTimer, 1000);
    tickTimer();
  }
  function tickTimer() {
    if (!session) return;
    if (sessionOwner !== accountKey()) { ++requestVersion; clearSession(); completedBreaks.clear(); closeModal(); return; }
    secondsLeft = Math.max(0, Math.ceil(remainingAtAnchor - (monotonicNow() - anchorAt) / 1000));
    const timerEl = document.getElementById('pausa-timer-display');
    const barEl = document.getElementById('pausa-progress-bar');
    if (timerEl) timerEl.textContent = formatTime(secondsLeft);
    if (barEl) barEl.style.width = `${((totalSeconds - secondsLeft) / totalSeconds) * 100}%`;
    if (!secondsLeft && !finishing && monotonicNow() >= retryAt) finishSession(false);
  }
  async function finishSession(abandon) {
    if (!session || finishing) return;
    finishing = true;
    const id = session.id, version = ++requestVersion, owner = accountKey();
    const button = getModalContainer()?.querySelector('#pausa-btn-exit-anyway');
    if (button) button.disabled = true;
    const status = document.getElementById('pausa-sync-status');
    if (status) status.textContent = 'Validando la pausa con el servidor…';
    try {
      const data = await pausaRPC('dash_cerrar_pausa', {p_sesion:id,p_abandonar:abandon});
      if (version === requestVersion && owner === accountKey()) { ++requestVersion; applySnapshot(data); }
      notifyTabs();
    } catch (error) {
      retryAt = monotonicNow() + 15000;
      if (status) status.textContent = 'Sin confirmación del servidor. Reintentaremos automáticamente.';
      if (abandon) showEntryRequiredToast(error.message);
    } finally {
      finishing = false;
      if (button) button.disabled = false;
    }
  }

  function startSuggestionCycle() {
    stopSuggestionCycle();
    suggestionInterval = setInterval(() => {
      if (!currentBreak) return;
      currentActivityIdx = (currentActivityIdx + 1) % currentBreak.activities.length;
      if (currentActivityIdx === 0) suggestionIdx = (suggestionIdx + 1) % currentBreak.activities[0].suggestions.length;
      updateActivityDisplay(true);
    }, 10000);
  }

  function renderConfirmView() {
    if (!currentBreak) return;
    viewMode = 'confirm';
    stopSuggestionCycle();

    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-confirm";
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <h2 style="font-size:24px; font-weight:700; color:#1e293b; margin:0; font-family:'Fraunces', Georgia, serif;">¿Seguro que quieres salir?</h2>
        <p style="font-size:14px; color:#475569; line-height:1.5; margin:0;">
          Abandonar termina esta pausa en todas tus pestañas. Quedará usada, pero no completada, y no podrás repetirla hoy. Cambiar de pestaña o recargar conserva el tiempo.
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

    container.querySelector("#pausa-btn-resume").onclick = () => {
      renderSessionView();
      startTimer();
      startSuggestionCycle();
    };

    container.querySelector("#pausa-btn-exit-anyway").onclick = () => finishSession(true);
  }

  function renderCompleteView() {
    clearSession(); viewMode = 'complete';
    getOverlay()?.classList.remove("pausa-session-running");
    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-complete";
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="width:48px; height:48px; border-radius:14px; background:#f0fdf4; color:#16a34a; display:flex; align-items:center; justify-content:center; margin-bottom:4px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style="font-size:24px; font-weight:700; color:#1e293b; margin:0; font-family:'Fraunces', Georgia, serif;">Pausa completada</h2>
        <p style="font-size:14px; color:#475569; line-height:1.5; margin:0;">
          Cumpliste el tiempo de la pausa. Puedes volver a tus tareas cuando estés listo.
        </p>
      </div>

      <div class="pausa-action-group">
        <button type="button" class="pausa-btn-primary" id="pausa-btn-back-selection">Volver a pausas</button>
      </div>
    `;

    container.querySelector("#pausa-btn-back-selection").onclick = () => {
      renderSelectionView();
    };
  }

  // ─── Actualizar apariencia del botón en el sidebar ─
  // Muestra el botón bloqueado/desbloqueado según el estado de marca de entrada
  function updateRailButton() {
    const card=document.getElementById('rail-pausa-open');
    if(card) {
      const count=completedBreaks.size;
      const label=card.querySelector('.rail-pausa-duration');
      if(label) label.textContent=count+' de 2 usadas hoy';
      const figure=card.querySelector('.rail-pausa-figure');
      if(figure && !figure.querySelector('svg')) figure.innerHTML=getActivityFigure('movilidad',0,true);
      const info=card.querySelector('.rail-pausa-info > span');
      if(info) info.textContent=count===2 ? 'Mañana, dos nuevas pausas.' : count===1 ? 'Te queda un momento para ti.' : 'Muévete. Respira. Continúa.';
      const footer=card.querySelector('.rail-pausa-footer > span:first-child');
      if(footer) footer.textContent=currentBreak ? 'Volver a mi pausa' : count===2 ? 'Ver mis pausas' : count===1 ? 'Tomar la última pausa' : 'Tomar una pausa';
      card.querySelectorAll('.rail-pausa-mark i').forEach((m,i)=>m.classList.toggle('used',i<count));
    }
    const btn = document.getElementById("rail-pausa-open");
    if (!btn) return;
    const marcado = usuarioMarcado();
    if (marcado) {
      btn.disabled = false;
      btn.removeAttribute('title');
      btn.style.opacity = '';
      btn.style.cursor = '';
    } else {
      btn.disabled = false; // no disabled real para permitir el click y mostrar el toast
      btn.title = 'Registra tu entrada para activar las pausas activas';
      btn.style.opacity = '0.55';
      btn.style.cursor = 'not-allowed';
    }
  }

  // ─── Inicialización ────────────────────────────────

  let adminPausasData=[];
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderAdminPausasTable(rows) {
    const body=el('admin-pausas-table-body'); if(!body)return;
    const labels={en_curso:'En curso',completada:'Tiempo cumplido',abandonada:'Abandonada'};
    body.innerHTML=rows.map(r=>'<tr><td>'+esc(r.colaborador)+'</td><td>'+esc(r.area)+'</td><td>'+r.pausas.length+' de 2 usadas</td><td>'+r.pausas.map(id=>{const s=r.sesiones?.find(s=>s.pausa===id);return esc(id)+' · '+esc(labels[s?.estado]||'Uso anterior sin seguimiento');}).join('<br>')+'</td><td><button type="button" class="admin-pausas-btn-reset-row" data-id="'+esc(r.colaborador_id)+'" '+(r.pausas.length?'':'disabled')+'>Restablecer</button></td></tr>').join('') || '<tr><td colspan="5">No hay colaboradores.</td></tr>';
    body.querySelectorAll('[data-id]').forEach(btn=>btn.onclick=()=>resetColaboradorPausas(btn.dataset.id));
  }
  async function loadAdminPausas() {
    try {
      const data=await pausaRPC('dash_admin_pausas_diarias'); adminPausasData=data.filas;
      filterAdmin();
      const counts={total:data.filas.length,started:data.filas.filter(r=>r.pausas.length===1).length,done:data.filas.filter(r=>r.pausas.length===2).length,none:data.filas.filter(r=>!r.pausas.length).length};
      Object.entries(counts).forEach(([k,v])=>{if(el('admin-pausas-kpi-'+k))el('admin-pausas-kpi-'+k).textContent=v;});
    } catch(error) { if(el('admin-pausas-table-body'))el('admin-pausas-table-body').innerHTML='<tr><td colspan="5">No se pudieron cargar los registros. Pulsa Actualizar.</td></tr>'; }
  }
  function filterAdmin(){const q=(el('admin-pausas-search')?.value||'').toLowerCase();renderAdminPausasTable(adminPausasData.filter(r=>(r.colaborador+' '+r.area).toLowerCase().includes(q)));}
  function openAdminPausasModal(){if(el('admin-pausas-modal'))el('admin-pausas-modal').hidden=false;loadAdminPausas();}
  function closeAdminPausasModal(){if(el('admin-pausas-modal'))el('admin-pausas-modal').hidden=true;}
  async function resetColaboradorPausas(id){await resetPausas('dash_admin_reset_pausas',{p_colaborador_id:id});}
  async function resetTodasPausas(){await resetPausas('dash_admin_reset_todas_pausas',{});}
  async function resetPausas(name,args){
    if(!window.confirm('¿Restablecer las pausas de hoy?'))return;
    try{await pausaRPC(name,args);++requestVersion;notifyTabs();await loadDailyBreaks();await loadAdminPausas();showEntryRequiredToast('Pausas restablecidas.');}
    catch(error){showEntryRequiredToast(error.message);}
  }
  window.KJA_PAUSAS={BREAKS,openAdmin:openAdminPausasModal,closeAdmin:closeAdminPausasModal,refreshAdmin:loadAdminPausas,resetColaborador:resetColaboradorPausas,resetTodas:resetTodasPausas,refreshRail:updateRailButton,loadCompleted:loadDailyBreaks,getCompletedBreaks:()=>new Set(completedBreaks),startSession,renderConfirm:renderConfirmView,isSessionActive:()=>!!currentBreak};

  function init() {
    const actions={'admin-pausas-module':openAdminPausasModal,'admin-pausas-open-btn':openAdminPausasModal,'admin-pausas-close-btn':closeAdminPausasModal,'admin-pausas-backdrop':closeAdminPausasModal,'admin-pausas-refresh-btn':loadAdminPausas,'admin-pausas-reset-all-btn':resetTodasPausas};
    Object.entries(actions).forEach(([id,fn])=>{if(el(id))el(id).onclick=fn;});
    if(el('admin-pausas-search'))el('admin-pausas-search').oninput=filterAdmin;
    window.addEventListener('hashchange',()=>{if(window.location.hash==='#admin-pausas')openAdminPausasModal();});
    const resync = () => { if (!document.hidden) loadDailyBreaks(); };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('pageshow', resync);
    window.addEventListener('online', resync);
    if (channel) channel.onmessage = resync;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!getOverlay()?.hidden)closeModal();else closeAdminPausasModal();}});

    // Consultar las pausas del día en Supabase.
    loadDailyBreaks();

    const openTrigger = document.getElementById("rail-pausa-open");
    if (openTrigger) {
      openTrigger.onclick = openSelectionModal;
    }

    const backdrop = document.getElementById("pausa-activa-backdrop");
    if (backdrop) {
      backdrop.onclick = closeModal;
    }
    const overlay = getOverlay();
    if (overlay) overlay.onclick = event => {
      if (event.target === overlay) closeModal();
    };

    // Actualizar apariencia y persistencia cuando APP.inicio esté disponible
    updateRailButton();

    // Observar cuando renderHome() actualice APP.inicio.dia.marcado
    // Usamos un polling ligero con MutationObserver sobre el welcome-sub que el dashboard actualiza
    const sub = document.getElementById('welcome-sub');
    if (sub) {
      const observer = new MutationObserver(() => {
        loadDailyBreaks();
        updateRailButton();
      });
      observer.observe(sub, { childList: true, subtree: true, characterData: true });
    }
    // Fallback: verificar cada 5 s en caso de que el elemento no exista aún
    const poll = setInterval(() => {
      loadDailyBreaks();
      updateRailButton();
      
    }, 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
