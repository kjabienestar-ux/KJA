/**
 * KJA · Sistema de Anuncios y Comunicados Emergentes Configurables
 * Controla la visualización inteligente de comunicados para cada integrante según sus días de gestión.
 */
(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURACIÓN DEL ANUNCIO ACTIVO
  // ─────────────────────────────────────────────────────────────────────────
  // Para publicar un nuevo comunicado:
  //   1. Cambia `id` a un valor único (p. ej. incrementa el número final).
  //      Esto reinicia el contador de días para todos los integrantes.
  //   2. Actualiza `fechaInicio` con la fecha de hoy (AAAA-MM-DD).
  //   3. Cambia `imagen` / `imagenFallback` si el flyer es diferente.
  //   4. Ajusta `titulo`, `mensaje`, `puntos`, `alerta` y `notaPie` según el contenido.
  //   5. Asegúrate de que `activo: true`; pon `false` para desactivarlo sin borrarlo.
  // ─────────────────────────────────────────────────────────────────────────
  const DEFAULT_ANNOUNCEMENT = {
    // ── Identificación ──────────────────────────────────────────────────────
    // IMPORTANTE: cambia este id cada vez que publiques un comunicado nuevo.
    // Un id distinto reinicia automáticamente el contador de días de todos.
    id: 'anuncio-comunicado-comparticiones-002',

    // ── Textos ──────────────────────────────────────────────────────────────
    titulo: 'Comunicado Importante',
    subtitulo: 'Envío obligatorio de comprobantes de comparticiones',
    badge: 'IMPORTANTE',
    mensaje:
      'Se le informa que todas las comparticiones que realice en Facebook deben ser evidenciadas y subidas en la plataforma. Asimismo, dichas evidencias deben enviarse al grupo de comparticiones de KJA en WhatsApp. De lo contrario, no serán consideradas en sus reportes.',
    puntos: [
      'Registrar y subir las evidencias de sus comparticiones en la plataforma.',
      'Enviar las evidencias al grupo de comparticiones de KJA por WhatsApp.',
      'Verificar que la información enviada sea clara y completa.',
      'Solo se considerarán en el reporte las comparticiones correctamente evidenciadas.'
    ],
    alerta:
      'Si no se evidencia en la plataforma ni se envía al grupo de WhatsApp, no se considerará en el reporte.',
    notaPie: '¡Cumple con el registro completo para que tus comparticiones sean consideradas!',

    // ── Imagen / Flyer ───────────────────────────────────────────────────────
    // Ruta principal (WebP para mejor rendimiento) y fallback JPG.
    imagen: 'images/dashboard/comunicado-comparticiones-v2.jpg',
    imagenFallback: 'images/dashboard/comunicado-comparticiones.jpg',
    imagenAlt:
      'Comunicado KJA: todas las comparticiones de Facebook deben evidenciarse en la plataforma y enviarse al grupo de WhatsApp',

    // ── Botón de cierre ──────────────────────────────────────────────────────
    botonTexto: 'Entendido',
    botonLink: null, // Si quieres redirigir, pon la URL aquí (p. ej. '/marcar.html')

    // ── Lógica de aparición ──────────────────────────────────────────────────
    // Número de días de gestión del integrante en que debe aparecer el anuncio.
    diasDeAparicion: 3,
    // El anuncio solo se mostrará a partir de esta fecha (zona horaria Lima).
    fechaInicio: '2026-09-21',
    // Opcional: fecha en que el anuncio deja de aparecer para todos.
    fechaFin: null,
    // Pon false para desactivar el anuncio sin necesidad de borrar el código.
    activo: true,
    // true = mostrar solo el flyer (imagen grande) sin repetir el texto encima.
    flyerMode: true
  };

  const STORAGE_PREFIX = 'kja_announcement_';

  // Mapeo de días de la semana a números ISO (1 = Lunes ... 7 = Domingo)
  const DAY_NAME_TO_ISO = {
    lunes: 1,
    lun: 1,
    mon: 1,
    monday: 1,
    martes: 2,
    mar: 2,
    tue: 2,
    tuesday: 2,
    miercoles: 3,
    miércoles: 3,
    mie: 3,
    mié: 3,
    wed: 3,
    wednesday: 3,
    jueves: 4,
    jue: 4,
    thu: 4,
    thursday: 4,
    viernes: 5,
    vie: 5,
    fri: 5,
    friday: 5,
    sabado: 6,
    sábado: 6,
    sab: 6,
    sáb: 6,
    sat: 6,
    saturday: 6,
    domingo: 7,
    dom: 7,
    sun: 7,
    sunday: 7
  };

  /**
   * Obtiene la fecha en formato ISO YYYY-MM-DD en la zona horaria de Lima (Perú).
   */
  function getLimaDateString(dateInput) {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      return dateInput.trim();
    }
    const date = dateInput ? (dateInput instanceof Date ? dateInput : new Date(dateInput)) : new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Obtiene el día ISO de la semana (1 = Lunes, ..., 7 = Domingo) para una fecha dada en Lima.
   */
  function getLimaIsoDayOfWeek(dateInput) {
    const dateStr = getLimaDateString(dateInput);
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    const jsDay = date.getDay(); // 0 = Domingo, 1 = Lunes... 6 = Sábado
    return jsDay === 0 ? 7 : jsDay;
  }

  /**
   * Normaliza una entrada de días de gestión a un conjunto numérico ISO (1-7).
   */
  function normalizeManagementDays(user) {
    if (!user) return new Set();
    const daysSet = new Set();

    // 1. Si el usuario tiene `diasGestion` explícito
    const explicitDays = user.diasGestion || user.dias_gestion;
    if (Array.isArray(explicitDays)) {
      explicitDays.forEach(day => {
        if (typeof day === 'number') {
          // Si es 0..6 (JS), convertir 0 a 7
          const iso = day === 0 ? 7 : day >= 1 && day <= 7 ? day : null;
          if (iso) daysSet.add(iso);
        } else if (typeof day === 'string') {
          const clean = day.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (DAY_NAME_TO_ISO[clean]) {
            daysSet.add(DAY_NAME_TO_ISO[clean]);
          } else {
            const num = Number(clean);
            if (Number.isFinite(num) && num >= 1 && num <= 7) daysSet.add(num);
          }
        }
      });
    }

    // 2. Si el usuario tiene `dias_laborables` (array de enteros 1..7 de Supabase)
    if (Array.isArray(user.dias_laborables)) {
      user.dias_laborables.forEach(num => {
        const n = Number(num);
        if (Number.isFinite(n) && n >= 1 && n <= 7) daysSet.add(n);
      });
    }

    // 3. Si el usuario tiene `horario_semanal` (objeto con claves '1'..'7')
    if (user.horario_semanal && typeof user.horario_semanal === 'object') {
      Object.entries(user.horario_semanal).forEach(([key, val]) => {
        const dow = Number(key);
        if (dow >= 1 && dow <= 7) {
          const mode = val && typeof val === 'object' ? val.mod || val.modalidad : val;
          if (mode && mode !== 'no_gestiona') {
            daysSet.add(dow);
          }
        }
      });
    }

    return daysSet;
  }

  /**
   * Verifica si la fecha dada corresponde a un día de gestión del usuario.
   */
  function isUserManagementDay(user, dateInput) {
    if (!user) return false;

    // Si el objeto de sesión ya indica explícitamente si hoy labora/gestiona para la fecha actual
    const todayLima = getLimaDateString();
    const targetDateStr = getLimaDateString(dateInput);

    if (targetDateStr === todayLima && user.dia && typeof user.dia.labora === 'boolean') {
      return user.dia.labora;
    }

    const isoDay = getLimaIsoDayOfWeek(targetDateStr);
    const managementDays = normalizeManagementDays(user);

    // Si no tiene días configurados pero labora en horario estándar lunes-viernes
    if (managementDays.size === 0) {
      // Fallback seguro: días 1 a 6 si es colaborador activo
      return isoDay >= 1 && isoDay <= 6;
    }

    return managementDays.has(isoDay);
  }

  /**
   * Obtiene la clave de almacenamiento para el usuario y anuncio.
   */
  function getStorageKey(anuncioId, userId) {
    const safeUser = userId != null && String(userId).trim() !== '' ? String(userId).trim() : 'global';
    return `${STORAGE_PREFIX}${anuncioId}_${safeUser}`;
  }

  /**
   * Carga el estado de visualización guardado en localStorage.
   */
  function getUserState(anuncioId, userId) {
    const key = getStorageKey(anuncioId, userId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return {
          anuncioId,
          usuarioId: userId,
          diasVistos: 0,
          fechasVistas: [],
          ultimaFecha: null,
          completado: false
        };
      }
      const parsed = JSON.parse(raw);
      return {
        anuncioId,
        usuarioId: userId,
        diasVistos: Number(parsed.diasVistos || 0),
        fechasVistas: Array.isArray(parsed.fechasVistas) ? parsed.fechasVistas : [],
        ultimaFecha: parsed.ultimaFecha || null,
        completado: Boolean(parsed.completado)
      };
    } catch {
      return {
        anuncioId,
        usuarioId: userId,
        diasVistos: 0,
        fechasVistas: [],
        ultimaFecha: null,
        completado: false
      };
    }
  }

  /**
   * Guarda el estado de visualización en localStorage.
   */
  function saveUserState(anuncioId, userId, state) {
    const key = getStorageKey(anuncioId, userId);
    try {
      localStorage.setItem(key, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar el estado del anuncio en localStorage:', e);
      return false;
    }
  }

  /**
   * Determina si el anuncio debe mostrarse a un usuario en una fecha específica.
   */
  function shouldShowAnnouncement(anuncio, user, dateInput) {
    const config = Object.assign({}, DEFAULT_ANNOUNCEMENT, anuncio || {});
    if (!config.activo) return false;

    const targetDate = getLimaDateString(dateInput);

    // 1. Validar fecha de inicio
    if (config.fechaInicio && targetDate < config.fechaInicio) {
      return false;
    }

    // 2. Validar fecha de fin si existe
    if (config.fechaFin && targetDate > config.fechaFin) {
      return false;
    }

    const userId = user?.id || user?.dni || user?.colaborador_id || user?.email || 'default';
    const state = getUserState(config.id, userId);

    // 3. Si ya completó los días requeridos de aparición
    const maxDays = Number(config.diasDeAparicion || 3);
    if (state.completado || state.diasVistos >= maxDays) {
      return false;
    }

    // 4. Si ya se mostró hoy para este usuario, no repetir el mismo día
    if (state.ultimaFecha === targetDate || state.fechasVistas.includes(targetDate)) {
      return false;
    }

    // 5. Verificar si hoy es día de gestión asignado para este integrante
    const isWorkDay = isUserManagementDay(user, targetDate);
    if (!isWorkDay) {
      return false;
    }

    return true;
  }

  /**
   * Registra que el anuncio fue visto/cerrado en la fecha actual por el usuario.
   */
  function recordAnnouncementViewed(anuncio, user, dateInput) {
    const config = Object.assign({}, DEFAULT_ANNOUNCEMENT, anuncio || {});
    const targetDate = getLimaDateString(dateInput);
    const userId = user?.id || user?.dni || user?.colaborador_id || user?.email || 'default';
    const state = getUserState(config.id, userId);

    // Si ya fue registrado en esta fecha, no duplicar
    if (!state.fechasVistas.includes(targetDate)) {
      state.fechasVistas.push(targetDate);
      state.diasVistos = state.fechasVistas.length;
    }

    state.ultimaFecha = targetDate;
    const maxDays = Number(config.diasDeAparicion || 3);
    if (state.diasVistos >= maxDays) {
      state.completado = true;
    }

    saveUserState(config.id, userId, state);
    return state;
  }

  /**
   * Restablece el estado de un anuncio para pruebas o depuración.
   */
  function resetUserState(anuncioId, userId) {
    const key = getStorageKey(anuncioId, userId);
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  // Elementos del DOM y estado activo
  let activeConfig = Object.assign({}, DEFAULT_ANNOUNCEMENT);
  let activeUser = null;
  let previousActiveElement = null;
  let modalContainer = null;
  let keydownListenerAttached = false;

  /**
   * Escapa caracteres HTML para seguridad.
   */
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }

  /**
   * Construye o recupera el contenedor DOM del modal.
   */
  function ensureModalElement() {
    let container = document.getElementById('kja-announcement-modal');
    if (!container) {
      container = document.createElement('div');
      container.id = 'kja-announcement-modal';
      container.className = 'kja-announcement-overlay';
      container.hidden = true;
      document.body.appendChild(container);
    }
    modalContainer = container;
    return container;
  }

  /**
   * Renderiza el contenido HTML del modal según la configuración.
   */
  function renderModalHtml(config, user) {
    const state = getUserState(config.id, user?.id || user?.dni || 'default');
    const dayNumber = Math.min((state.diasVistos || 0) + 1, config.diasDeAparicion || 3);
    const totalDays = config.diasDeAparicion || 3;

    // Lista de puntos clave
    const pointsHtml = Array.isArray(config.puntos) && config.puntos.length > 0
      ? `<ul class="kja-announcement-points">
          ${config.puntos.map((pt, idx) => `
            <li class="kja-announcement-point">
              <span class="kja-announcement-point-number" aria-hidden="true">${idx + 1}</span>
              <span>${escapeHtml(pt)}</span>
            </li>
          `).join('')}
        </ul>`
      : '';

    // Alerta destacada
    const alertHtml = config.alerta
      ? `<div class="kja-announcement-alert" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>${escapeHtml(config.alerta)}</span>
        </div>`
      : '';

    // Imagen opcional
    const imageHtml = config.imagen
      ? `<div class="kja-announcement-media">
          <img src="${escapeHtml(config.imagen)}" alt="${escapeHtml(config.imagenAlt || config.titulo)}" onerror="if(this.src!=='${escapeHtml(config.imagenFallback || '')}'){this.src='${escapeHtml(config.imagenFallback || '')}'}else{this.style.display='none'}">
        </div>`
      : '';

    // Nota al pie
    const footerDaysHtml = (() => {
      const totalDays = config.diasDeAparicion || 3;
      const dots = Array.from({ length: totalDays }, (_, i) =>
        `<span class="kja-ann-dot${i < dayNumber ? ' kja-ann-dot--done' : ''}" aria-hidden="true"></span>`
      ).join('');
      return `<span class="kja-announcement-days-indicator">
        <i aria-hidden="true"></i>
        <span class="kja-ann-dots">${dots}</span>
        Aviso ${dayNumber}/${totalDays}
      </span>`;
    })();

    // Modo flyer completo vs modo estructurado
    if (config.flyerMode && config.imagen) {
      return `
        <div class="kja-announcement-backdrop" data-kja-announcement-close></div>
        <button type="button" class="kja-announcement-close-btn" data-kja-announcement-close aria-label="Cerrar anuncio">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="kja-announcement-dialog flyer-mode" role="dialog" aria-modal="true" aria-labelledby="kja-announcement-title" tabindex="-1">
          <div class="kja-announcement-body">
            <div class="kja-announcement-media">
              <img src="${escapeHtml(config.imagen)}" alt="${escapeHtml(config.imagenAlt || config.titulo)}">
            </div>
          </div>
          <div class="kja-announcement-footer">
            ${footerDaysHtml}
            <div class="kja-announcement-actions">
              <button type="button" class="kja-announcement-btn kja-announcement-btn-primary" data-kja-announcement-close>
                ${escapeHtml(config.botonTexto || 'Entendido')}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="kja-announcement-backdrop" data-kja-announcement-close></div>
      <button type="button" class="kja-announcement-close-btn" data-kja-announcement-close aria-label="Cerrar anuncio">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div class="kja-announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="kja-announcement-title" tabindex="-1">
        <header class="kja-announcement-header">
          <div class="kja-announcement-brand">
            ${config.badge ? `<span class="kja-announcement-badge">${escapeHtml(config.badge)}</span>` : ''}
            <h2 id="kja-announcement-title" class="kja-announcement-title">${escapeHtml(config.titulo)}</h2>
            ${config.subtitulo ? `<p class="kja-announcement-sub">${escapeHtml(config.subtitulo)}</p>` : ''}
          </div>
        </header>
        <div class="kja-announcement-body">
          ${imageHtml}
          ${config.mensaje ? `<p class="kja-announcement-message">${escapeHtml(config.mensaje)}</p>` : ''}
          ${pointsHtml}
          ${alertHtml}
          ${config.notaPie ? `<p class="kja-announcement-footnote">${escapeHtml(config.notaPie)}</p>` : ''}
        </div>
        <footer class="kja-announcement-footer">
          ${footerDaysHtml}
          <div class="kja-announcement-actions">
            ${config.botonLink ? `
              <a href="${escapeHtml(config.botonLink)}" target="_blank" rel="noopener" class="kja-announcement-btn kja-announcement-btn-primary">
                ${escapeHtml(config.botonTexto || 'Ver enlace')}
              </a>
            ` : `
              <button type="button" class="kja-announcement-btn kja-announcement-btn-primary" data-kja-announcement-close>
                ${escapeHtml(config.botonTexto || 'Entendido')}
              </button>
            `}
          </div>
        </footer>
      </div>
    `;
  }

  /**
   * Maneja el foco atrapado (Focus Trap) dentro del modal.
   */
  function handleKeydown(event) {
    const container = modalContainer;
    if (!container || container.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key === 'Tab') {
      const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');

      const focusable = Array.from(container.querySelectorAll(focusableSelectors)).filter(
        el => el.offsetParent !== null && !el.hidden
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }

  /**
   * Abre el modal de anuncio.
   */
  function openModal(customConfig, user) {
    const config = Object.assign({}, activeConfig, customConfig || {});
    activeConfig = config;
    activeUser = user || activeUser;

    const container = ensureModalElement();
    container.innerHTML = renderModalHtml(config, activeUser);
    container.hidden = false;
    document.body.classList.add('kja-announcement-open');

    // Registrar los eventos de cierre dentro del modal
    container.querySelectorAll('[data-kja-announcement-close]').forEach(elem => {
      elem.addEventListener('click', function (e) {
        e.preventDefault();
        closeModal();
      });
    });

    if (!keydownListenerAttached) {
      document.addEventListener('keydown', handleKeydown);
      keydownListenerAttached = true;
    }

    // Registrar la visualización para el cómputo de días del usuario
    recordAnnouncementViewed(config, activeUser);

    previousActiveElement = document.activeElement;
    requestAnimationFrame(() => {
      const closeBtn = container.querySelector('.kja-announcement-close-btn');
      const primaryBtn = container.querySelector('.kja-announcement-btn-primary');
      if (primaryBtn) {
        primaryBtn.focus();
      } else if (closeBtn) {
        closeBtn.focus();
      }
    });

    return true;
  }

  /**
   * Cierra el modal de anuncio.
   */
  function closeModal() {
    const container = modalContainer || document.getElementById('kja-announcement-modal');
    if (!container || container.hidden) return false;

    container.hidden = true;
    document.body.classList.remove('kja-announcement-open');

    if (previousActiveElement && typeof previousActiveElement.focus === 'function' && previousActiveElement.isConnected) {
      try {
        previousActiveElement.focus({ preventScroll: true });
      } catch {}
    }
    previousActiveElement = null;
    return true;
  }

  /**
   * Comprueba si el anuncio debe mostrarse a este usuario y lo abre automáticamente.
   */
  function checkAndShow(user, customConfig) {
    const config = Object.assign({}, activeConfig, customConfig || {});
    const targetUser = user || activeUser;

    if (shouldShowAnnouncement(config, targetUser)) {
      return openModal(config, targetUser);
    }
    return false;
  }

  /**
   * Inicializa el módulo con una configuración personalizada si se desea.
   */
  function init(customConfig) {
    if (customConfig) {
      activeConfig = Object.assign({}, DEFAULT_ANNOUNCEMENT, customConfig);
    }
    ensureModalElement();
  }

  // API pública del módulo
  const KJAAnnouncementModal = {
    DEFAULT_ANNOUNCEMENT,
    init,
    checkAndShow,
    open: openModal,
    close: closeModal,
    getConfig: () => Object.assign({}, activeConfig),
    setConfig: newConfig => {
      activeConfig = Object.assign({}, activeConfig, newConfig || {});
    },
    isManagementDay: isUserManagementDay,
    normalizeManagementDays,
    shouldShow: shouldShowAnnouncement,
    recordView: recordAnnouncementViewed,
    getUserState,
    resetUserState,
    getLimaDateString,
    getLimaIsoDayOfWeek
  };

  global.KJAAnnouncementModal = KJAAnnouncementModal;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KJAAnnouncementModal;
  }
})(typeof window !== 'undefined' ? window : globalThis);
