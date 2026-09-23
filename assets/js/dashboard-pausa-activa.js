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

  // ─── Persistencia en localStorage ────────────────────
  // Clave: kja_pausas_<colaborador_id>_<fecha_lima>
  // Formato guardado: { date: "YYYY-MM-DD", completed: ["movilidad", "visual"] }

  function isoLimaHoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  }

  function getColaboradorId() {
    try { return window.APP?.inicio?.colaborador?.id || null; } catch { return null; }
  }

  function getStorageKey() {
    const colaboradorId = getColaboradorId();
    return colaboradorId ? `kja_pausas_${colaboradorId}_${isoLimaHoy()}` : null;
  }

  function loadCompletedFromStorage() {
    try {
      const hoy = isoLimaHoy();
      const key = getStorageKey();
      if (!key) return;
      const raw = localStorage.getItem(key);
      if (!raw) { completedBreaks = new Set(); return; }
      const parsed = JSON.parse(raw);
      // Si la fecha guardada es distinta a hoy, se descarta (cambio de día)
      if (parsed.date !== hoy) {
        localStorage.removeItem(key);
        completedBreaks = new Set();
        return;
      }
      completedBreaks = new Set(parsed.completed || []);
    } catch {
      completedBreaks = new Set();
    }
  }

  function saveCompletedToStorage() {
    try {
      const key = getStorageKey();
      if (!key) return;
      localStorage.setItem(key, JSON.stringify({
        date: isoLimaHoy(),
        completed: Array.from(completedBreaks)
      }));
    } catch {
      // silencioso si localStorage no está disponible
    }
  }

  // ─── Marca de entrada ─────────────────────────────────
  // Mantiene la validación alineada con el registro que renderiza el dashboard.
  function usuarioMarcado() {
    try {
      const dia = window.APP?.inicio?.dia || {};
      const attendanceCard = document.getElementById('today-attendance-card');
      const visualState = attendanceCard?.dataset.attendanceState;
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

  function openSelectionModal() {
    // Bloquear si el usuario aún no marcó su entrada
    if (!usuarioMarcado()) {
      showEntryRequiredToast();
      return;
    }
    // Recargar pausas completadas desde localStorage (por si otra pestaña las actualizó)
    loadCompletedFromStorage();
    const overlay = getOverlay();
    if (!overlay) return;
    renderSelectionView();
    overlay.hidden = false;
    document.body.classList.add("kja-announcement-open");
  }

  // Toast breve no intrusivo que explica por qué no se puede abrir
  function showEntryRequiredToast() {
    // Intentar usar el sistema de toast del dashboard si existe
    if (typeof window.toast === 'function') {
      window.toast('Primero registra tu entrada para acceder a las pausas activas.', true);
      return;
    }
    // Fallback: toast propio mínimo
    const existing = document.getElementById('pausa-entry-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'pausa-entry-toast';
    t.textContent = 'Registra tu entrada para activar las pausas activas.';
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
    stopTimer();
    stopSuggestionCycle();
    const overlay = getOverlay();
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("kja-announcement-open");
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

  function renderSelectionView() {
    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-selection";
    container.innerHTML = `
      <div class="pausa-header">
        <div class="pausa-header-left">
          <img src="assets/pausa-activa/d7974.svg" alt="Pausas Activas">
          <h2>Pausas activas</h2>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-close-modal" aria-label="Cerrar modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <p class="pausa-desc">Breves sesiones de ergonomía para recargar energía y concentración.</p>
      
      <div class="pausa-cards-grid">
        ${BREAKS.map((b, idx) => {
          const isDone = completedBreaks.has(b.id);
          const mins = Math.floor(b.duration / 60);
          const hint = isDone
            ? "¡Completado! Excelente trabajo cuidando de tu bienestar hoy."
            : idx === 0 
              ? "Movimientos articulares para despertar el cuerpo." 
              : "Regla 20-20-20, cuello y postura.";

          return `
            <div class="pausa-flip-container ${isDone ? 'is-completed' : ''}" data-break-id="${b.id}" id="pausa-card-${b.id}" ${isDone ? 'aria-disabled="true" title="Pausa activa ya realizada hoy"' : ''}>
              <div class="pausa-flip-inner">
                <!-- Front -->
                <div class="pausa-card-front">
                  <div class="pausa-card-tag-row">
                    <span class="pausa-card-tag">${isDone ? 'Sesión finalizada' : 'Pausa activa'}</span>
                    <span class="pausa-card-action-text">${isDone ? 'Completado ✓' : 'ver más →'}</span>
                  </div>
                  <div class="pausa-card-time">
                    <b>${mins}</b>
                    <span>min</span>
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
                  <button type="button" class="pausa-btn-start" data-start-break="${b.id}">
                    Comenzar
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Eventos
    container.querySelector("#pausa-btn-close-modal").onclick = closeModal;

    BREAKS.forEach(b => {
      const isDone = completedBreaks.has(b.id);
      if (isDone) return; // Sin interacción si ya está completada

      const cardEl = container.querySelector(`#pausa-card-${b.id}`);
      if (cardEl) {
        cardEl.onclick = (e) => {
          if (e.target.closest(".pausa-btn-start")) return;
          cardEl.classList.toggle("is-flipped");
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

  function startSession(breakItem) {
    if (!usuarioMarcado()) {
      showEntryRequiredToast();
      return;
    }
    currentBreak = breakItem;
    totalSeconds = breakItem.duration;
    secondsLeft = totalSeconds;
    currentActivityIdx = 0;
    suggestionIdx = 0;

    renderSessionView();
    startTimer();
    startSuggestionCycle();
  }

  function renderSessionView() {
    const container = getModalContainer();
    if (!container || !currentBreak) return;

    const activity = currentBreak.activities[currentActivityIdx];
    const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

    container.className = "pausa-modal-dialog pausa-modal-session";
    container.innerHTML = `
      <div class="pausa-session-header">
        <div>
          <h2 class="pausa-session-title">${currentBreak.title}</h2>
          <p class="pausa-session-subtitle">${currentBreak.subtitle}</p>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-confirm-exit" aria-label="Cerrar pausa">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="pausa-timer-box">
        <span class="pausa-timer-label">Tiempo restante</span>
        <div class="pausa-timer-digit" id="pausa-timer-display">${formatTime(secondsLeft)}</div>
        <div class="pausa-progress-track">
          <div class="pausa-progress-bar" id="pausa-progress-bar" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="pausa-activity-box">
        <span class="pausa-act-tag">Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}</span>
        <div class="pausa-act-title" id="pausa-act-title">${activity.title}</div>
        <div class="pausa-act-suggestion" id="pausa-suggestion-display">${activity.suggestions[suggestionIdx]}</div>

        <div class="pausa-dots-row">
          <div class="pausa-dots" id="pausa-dots-container">
            ${currentBreak.activities.map((_, i) => `
              <button type="button" class="pausa-dot ${i === currentActivityIdx ? 'active' : ''}" data-act-idx="${i}" aria-label="Actividad ${i+1}"></button>
            `).join('')}
          </div>
          <span class="pausa-rot-hint">Sugerencias que rotan cada 10 s · avanza a tu ritmo</span>
        </div>
      </div>
    `;

    container.querySelector("#pausa-btn-confirm-exit").onclick = renderConfirmView;

    container.querySelectorAll(".pausa-dot").forEach(btn => {
      btn.onclick = () => {
        currentActivityIdx = parseInt(btn.dataset.actIdx, 10);
        suggestionIdx = 0;
        updateActivityDisplay();
      };
    });
  }

  function updateActivityDisplay() {
    const titleEl = document.getElementById("pausa-act-title");
    const tagEl = document.querySelector(".pausa-act-tag");
    const sugEl = document.getElementById("pausa-suggestion-display");
    const dots = document.querySelectorAll(".pausa-dot");

    if (titleEl && currentBreak) {
      const act = currentBreak.activities[currentActivityIdx];
      titleEl.textContent = act.title;
      if (tagEl) tagEl.textContent = `Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}`;
      if (sugEl) sugEl.textContent = act.suggestions[suggestionIdx] || act.suggestions[0];
      dots.forEach((d, i) => d.classList.toggle("active", i === currentActivityIdx));
    }
  }

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (secondsLeft <= 1) {
        stopTimer();
        stopSuggestionCycle();
        if (currentBreak) {
          completedBreaks.add(currentBreak.id);
          saveCompletedToStorage(); // Persistir en localStorage
        }
        playCompletionSound();
        renderCompleteView();
      } else {
        secondsLeft--;
        const timerEl = document.getElementById("pausa-timer-display");
        const barEl = document.getElementById("pausa-progress-bar");
        if (timerEl) timerEl.textContent = formatTime(secondsLeft);
        if (barEl) barEl.style.width = `${((totalSeconds - secondsLeft) / totalSeconds) * 100}%`;
      }
    }, 1000);
  }

  function startSuggestionCycle() {
    stopSuggestionCycle();
    suggestionInterval = setInterval(() => {
      if (!currentBreak) return;
      const suggestions = currentBreak.activities[currentActivityIdx].suggestions;
      if (!suggestions || suggestions.length <= 1) return;

      const sugEl = document.getElementById("pausa-suggestion-display");
      if (sugEl) {
        sugEl.style.opacity = '0';
        setTimeout(() => {
          suggestionIdx = (suggestionIdx + 1) % suggestions.length;
          sugEl.textContent = suggestions[suggestionIdx];
          sugEl.style.opacity = '1';
        }, 350);
      }
    }, 10000);
  }

  function renderConfirmView() {
    stopTimer();
    stopSuggestionCycle();

    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-confirm";
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <h2 style="font-size:24px; font-weight:700; color:#1e293b; margin:0; font-family:'Fraunces', Georgia, serif;">¿Seguro que quieres salir?</h2>
        <p style="font-size:14px; color:#475569; line-height:1.5; margin:0;">
          Tu cuerpo ya empezó a descansar — si cierras ahora perderás el avance de esta sesión y no podrás retomarlo.
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

    container.querySelector("#pausa-btn-exit-anyway").onclick = () => {
      renderSelectionView();
    };
  }

  function renderCompleteView() {
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
          Has terminado las actividades. Puedes volver a tus tareas cuando estés listo.
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
  function init() {
    // Cargar pausas completadas del día desde localStorage
    loadCompletedFromStorage();

    const openTrigger = document.getElementById("rail-pausa-open");
    if (openTrigger) {
      openTrigger.onclick = openSelectionModal;
    }

    const backdrop = document.getElementById("pausa-activa-backdrop");
    if (backdrop) {
      backdrop.onclick = closeModal;
    }

    // Actualizar apariencia y persistencia cuando APP.inicio esté disponible
    updateRailButton();

    // Observar cuando renderHome() actualice APP.inicio.dia.marcado
    // Usamos un polling ligero con MutationObserver sobre el welcome-sub que el dashboard actualiza
    const sub = document.getElementById('welcome-sub');
    if (sub) {
      const observer = new MutationObserver(() => {
        loadCompletedFromStorage();
        updateRailButton();
      });
      observer.observe(sub, { childList: true, subtree: true, characterData: true });
    }
    // Fallback: verificar cada 5 s en caso de que el elemento no exista aún
    const poll = setInterval(() => {
      loadCompletedFromStorage();
      updateRailButton();
      if (getColaboradorId() && usuarioMarcado()) clearInterval(poll);
    }, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

if (false) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('AudioContext no disponible');
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

  function openSelectionModal() {
    const overlay = getOverlay();
    if (!overlay) return;
    renderSelectionView();
    overlay.hidden = false;
    document.body.classList.add("kja-announcement-open");
  }

  function closeModal() {
    stopTimer();
    stopSuggestionCycle();
    const overlay = getOverlay();
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("kja-announcement-open");
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

  function renderSelectionView() {
    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-selection";
    container.innerHTML = `
      <div class="pausa-header">
        <div class="pausa-header-left">
          <img src="assets/pausa-activa/d7974.svg" alt="Pausas Activas">
          <h2>Pausas activas</h2>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-close-modal" aria-label="Cerrar modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <p class="pausa-desc">Breves sesiones de ergonomía para recargar energía y concentración.</p>
      
      <div class="pausa-cards-grid">
        ${BREAKS.map((b, idx) => {
          const isDone = completedBreaks.has(b.id);
          const mins = Math.floor(b.duration / 60);
          const hint = isDone
            ? "¡Completado! Excelente trabajo cuidando de tu bienestar hoy."
            : idx === 0 
              ? "Movimientos articulares para despertar el cuerpo." 
              : "Regla 20-20-20, cuello y postura.";

          return `
            <div class="pausa-flip-container ${isDone ? 'is-completed' : ''}" data-break-id="${b.id}" id="pausa-card-${b.id}" ${isDone ? 'aria-disabled="true" title="Pausa activa ya realizada hoy"' : ''}>
              <div class="pausa-flip-inner">
                <!-- Front -->
                <div class="pausa-card-front">
                  <div class="pausa-card-tag-row">
                    <span class="pausa-card-tag">${isDone ? 'Sesión finalizada' : 'Pausa activa'}</span>
                    <span class="pausa-card-action-text">${isDone ? 'Completado ✓' : 'ver más →'}</span>
                  </div>
                  <div class="pausa-card-time">
                    <b>${mins}</b>
                    <span>min</span>
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
                  <button type="button" class="pausa-btn-start" data-start-break="${b.id}">
                    Comenzar
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Eventos
    container.querySelector("#pausa-btn-close-modal").onclick = closeModal;

    BREAKS.forEach(b => {
      const isDone = completedBreaks.has(b.id);
      if (isDone) return; // Sin interacción si ya está completada

      const cardEl = container.querySelector(`#pausa-card-${b.id}`);
      if (cardEl) {
        cardEl.onclick = (e) => {
          if (e.target.closest(".pausa-btn-start")) return;
          cardEl.classList.toggle("is-flipped");
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

  function startSession(breakItem) {
    currentBreak = breakItem;
    totalSeconds = breakItem.duration;
    secondsLeft = totalSeconds;
    currentActivityIdx = 0;
    suggestionIdx = 0;

    renderSessionView();
    startTimer();
    startSuggestionCycle();
  }

  function renderSessionView() {
    const container = getModalContainer();
    if (!container || !currentBreak) return;

    const activity = currentBreak.activities[currentActivityIdx];
    const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

    container.className = "pausa-modal-dialog pausa-modal-session";
    container.innerHTML = `
      <div class="pausa-session-header">
        <div>
          <h2 class="pausa-session-title">${currentBreak.title}</h2>
          <p class="pausa-session-subtitle">${currentBreak.subtitle}</p>
        </div>
        <button type="button" class="pausa-close-btn" id="pausa-btn-confirm-exit" aria-label="Cerrar pausa">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="pausa-timer-box">
        <span class="pausa-timer-label">Tiempo restante</span>
        <div class="pausa-timer-digit" id="pausa-timer-display">${formatTime(secondsLeft)}</div>
        <div class="pausa-progress-track">
          <div class="pausa-progress-bar" id="pausa-progress-bar" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="pausa-activity-box">
        <span class="pausa-act-tag">Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}</span>
        <div class="pausa-act-title" id="pausa-act-title">${activity.title}</div>
        <div class="pausa-act-suggestion" id="pausa-suggestion-display">${activity.suggestions[suggestionIdx]}</div>

        <div class="pausa-dots-row">
          <div class="pausa-dots" id="pausa-dots-container">
            ${currentBreak.activities.map((_, i) => `
              <button type="button" class="pausa-dot ${i === currentActivityIdx ? 'active' : ''}" data-act-idx="${i}" aria-label="Actividad ${i+1}"></button>
            `).join('')}
          </div>
          <span class="pausa-rot-hint">Sugerencias que rotan cada 10 s · avanza a tu ritmo</span>
        </div>
      </div>
    `;

    container.querySelector("#pausa-btn-confirm-exit").onclick = renderConfirmView;

    container.querySelectorAll(".pausa-dot").forEach(btn => {
      btn.onclick = () => {
        currentActivityIdx = parseInt(btn.dataset.actIdx, 10);
        suggestionIdx = 0;
        updateActivityDisplay();
      };
    });
  }

  function updateActivityDisplay() {
    const titleEl = document.getElementById("pausa-act-title");
    const tagEl = document.querySelector(".pausa-act-tag");
    const sugEl = document.getElementById("pausa-suggestion-display");
    const dots = document.querySelectorAll(".pausa-dot");

    if (titleEl && currentBreak) {
      const act = currentBreak.activities[currentActivityIdx];
      titleEl.textContent = act.title;
      if (tagEl) tagEl.textContent = `Actividad ${currentActivityIdx + 1} de ${currentBreak.activities.length}`;
      if (sugEl) sugEl.textContent = act.suggestions[suggestionIdx] || act.suggestions[0];
      dots.forEach((d, i) => d.classList.toggle("active", i === currentActivityIdx));
    }
  }

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (secondsLeft <= 1) {
        stopTimer();
        stopSuggestionCycle();
        if (currentBreak) completedBreaks.add(currentBreak.id);
        playCompletionSound();
        renderCompleteView();
      } else {
        secondsLeft--;
        const timerEl = document.getElementById("pausa-timer-display");
        const barEl = document.getElementById("pausa-progress-bar");
        if (timerEl) timerEl.textContent = formatTime(secondsLeft);
        if (barEl) barEl.style.width = `${((totalSeconds - secondsLeft) / totalSeconds) * 100}%`;
      }
    }, 1000);
  }

  function startSuggestionCycle() {
    stopSuggestionCycle();
    suggestionInterval = setInterval(() => {
      if (!currentBreak) return;
      const suggestions = currentBreak.activities[currentActivityIdx].suggestions;
      if (!suggestions || suggestions.length <= 1) return;

      const sugEl = document.getElementById("pausa-suggestion-display");
      if (sugEl) {
        sugEl.style.opacity = '0';
        setTimeout(() => {
          suggestionIdx = (suggestionIdx + 1) % suggestions.length;
          sugEl.textContent = suggestions[suggestionIdx];
          sugEl.style.opacity = '1';
        }, 350);
      }
    }, 10000);
  }

  function renderConfirmView() {
    stopTimer();
    stopSuggestionCycle();

    const container = getModalContainer();
    if (!container) return;

    container.className = "pausa-modal-dialog pausa-modal-confirm";
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <h2 style="font-size:24px; font-weight:700; color:#1e293b; margin:0; font-family:'Fraunces', Georgia, serif;">¿Seguro que quieres salir?</h2>
        <p style="font-size:14px; color:#475569; line-height:1.5; margin:0;">
          Tu cuerpo ya empezó a descansar — si cierras ahora perderás el avance de esta sesión y no podrás retomarlo.
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

    container.querySelector("#pausa-btn-exit-anyway").onclick = () => {
      if (currentBreak) completedBreaks.add(currentBreak.id);
      renderSelectionView();
    };
  }

  function renderCompleteView() {
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
          Has terminado las actividades. Puedes volver a tus tareas cuando estés listo.
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

  // ─── Inicialización ────────────────────────────────
  function init() {
    const openTrigger = document.getElementById("rail-pausa-open");
    if (openTrigger) {
      openTrigger.onclick = openSelectionModal;
    }

    const backdrop = document.getElementById("pausa-activa-backdrop");
    if (backdrop) {
      backdrop.onclick = closeModal;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

}
