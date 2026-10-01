(() => {
  'use strict';

  const portal = document.getElementById('portal');
  if (!portal) return;

  const STORAGE_KEY = 'kja.dashboard.guided-tour.v3';
  const groups = [
    { label: 'Navegación', color: '#ec3e79', soft: '#fff0f5' },
    { label: 'Tu jornada', color: '#407961', soft: '#edf7f1' },
    { label: 'Tu mes', color: '#245f99', soft: '#edf4fc' },
    { label: 'Cierre de jornada', color: '#ad6245', soft: '#fff3eb' },
    { label: 'Mi espacio', color: '#d49a10', soft: '#fff8df' }
  ];
  const step = (id, group, title, copy, targets, figure = 'attendance-on-time.png', closeStage = null) => ({ id, group, title, copy, targets, figure, closeStage });
  const webSteps = [
    step('navigation', 0, 'Todo empieza en el sidebar', 'Inicio reúne tu día; Mi asistencia muestra tu historial y Mi perfil tus datos. Abajo tienes ayuda y cerrar sesión. Tutorial guiado permite repetir esta guía; los accesos adicionales dependen de tus permisos.', ['#sidebar']),
    step('schedule', 1, 'Horario, modalidad y contador', 'Revisa tu entrada y salida programadas. Elige Virtual o Presencial antes de marcar. La cuenta regresiva indica cuánto falta: llegar a cero no registra tu salida.', ['.day-schedule'], 'attendance-phone.png'),
    step('month', 2, 'Tus horas del mes', 'Aquí ves tus horas acreditadas y el avance hacia la meta mensual. Si Dirección aún no configuró una meta, seguirás viendo las horas acumuladas.', ['.day-summary .progress-card']),
    step('entry', 3, '1. Marca tu entrada', 'Confirma tu modalidad y adjunta la evidencia solicitada: Zoom en Virtual; foto y ubicación en Presencial. La entrada guarda tu hora oficial y habilita las evidencias laborales.', ['#day-close-checklist .type-entrada', '#open-mark'], 'attendance-phone.png', 0),
    step('facebook', 3, '2. Comparticiones de Facebook', 'Sube las capturas o el collage que comprueban tus comparticiones. Revisa el horario y confirma el envío: Facebook tiene su propio plazo, incluso si ya registraste tu salida.', ['#day-close-checklist .type-comparticiones'], 'evidence-worker.png', 1),
    step('rpe', 3, '3. Sube tu RPE', 'Adjunta el reporte y las evidencias de tus actividades del día. Comprueba que sean legibles y queden enviadas; corrige cualquier observación. Este requisito aparece cuando corresponde a tu jornada.', ['#day-close-checklist .type-rpe'], 'evidence-worker.png', 2),
    step('exit', 3, '4. Registra tu salida', 'Completa los requisitos laborales y adjunta la foto de salida cuando se solicite, o usa Marcar mi salida. Verifica la confirmación: cerrar sesión no marca salida. Facebook conserva su propio plazo.', ['#day-close-checklist .type-salida', '#day-close-action'], 'attendance-exit.png', 3),
    step('space', 4, 'Mi espacio y listo', 'A la derecha tienes tu perfil, pausas activas y comunicados; Mensajes abre tus conversaciones. Ya puedes repetir el recorrido desde Tutorial guiado cuando lo necesites.', ['#portal-rail'], 'attendance-on-time.png')
  ];
  const mobileSteps = [
    step('navigation', 0, 'Tus accesos rápidos', 'Mi asistencia: historial. Mi perfil: datos personales. Jornada de hoy: horario.', ['.mobile-quick-grid']),
    step('schedule', 1, 'Tus horas registradas', 'Estas tarjetas muestran la entrada y salida registradas, o si están pendientes. Para ver tu horario programado, abre Jornada de hoy desde los accesos rápidos.', ['#mobile-today-summary']),
    step('month', 2, 'Tu calendario del mes', 'Desliza los días para revisar tu asistencia y tus comparticiones. Los estados y avisos te ayudan a identificar registros completos y pendientes.', ['#mobile-month-progress-slot .dashboard-month-progress', '.dashboard-month-progress']),
    step('entry', 3, '1. Marca tu entrada', 'Abre la entrada, elige Virtual o Presencial y adjunta la evidencia solicitada. Confirma para guardar tu hora oficial; entrar al portal no registra tu asistencia.', ['#mobile-close-list .type-entrada', '#mobile-action-mark', '#mobile-quick-attendance'], 'attendance-phone.png', 0),
    step('facebook', 3, '2. Facebook', 'Toca este pendiente y sube tus capturas o un collage. Revisa su horario y confirma el envío: Facebook tiene un plazo independiente de tu salida laboral.', ['#mobile-close-list .type-comparticiones'], 'evidence-worker.png', 1),
    step('rpe', 3, '3. Sube tu RPE', 'Adjunta el reporte y los archivos de tus actividades del día. Verifica que queden enviados y corrige las observaciones. Si tu jornada no exige RPE, este paso no aparece.', ['#mobile-close-list .type-rpe'], 'evidence-worker.png', 2),
    step('exit', 3, '4. Registra tu salida', 'Completa los requisitos laborales y adjunta la foto con la hora visible cuando se solicite. Comprueba la salida registrada. Cerrar sesión no marca salida; Facebook conserva su propio plazo.', ['#mobile-close-list .type-salida', '#mobile-close-footer'], 'attendance-exit.png', 3),
    step('space', 4, 'Tu perfil y mensajes', 'Tu foto abre Mi perfil y Mensajes tus conversaciones. Puedes repetir el tutorial desde el botón Tutorial móvil en Inicio.', ['.mobile-portal-person', '#mobile-profile-link'])
  ];

  let root = null;
  let currentStep = 0;
  let currentTarget = null;
  let previousFocus = null;
  let previousPortalState = null;
  let autoStartTimer = null;
  let activeSteps = [];
  let spotlightFrame = null;
  let tourStorageKey = null;
  let tourMode = null;
  let previousScrollPosition = null;

  function screenMode() {
    return window.matchMedia('(max-width: 900px)').matches ? 'mobile' : 'web';
  }

  function storageKey() {
    const uid = typeof APP !== 'undefined' ? APP.sessionUid : '';
    return `${STORAGE_KEY}:${uid || 'local'}:${screenMode()}`;
  }

  function hasSeenTour() {
    try { return localStorage.getItem(storageKey()) === 'done'; }
    catch (_) { return false; }
  }

  function rememberTour() {
    try { localStorage.setItem(tourStorageKey || storageKey(), 'done'); }
    catch (_) { /* El tutorial sigue disponible aunque el navegador bloquee el almacenamiento. */ }
  }

  function isDisplayed(element) {
    if (!element?.isConnected || element.closest('[hidden]')) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function targetFor(step) {
    for (const selector of step.targets) {
      const element = document.querySelector(selector);
      if (isDisplayed(element)) return element;
    }
    return null;
  }

  function buildTour() {
    root = document.createElement('div');
    root.className = 'guided-tour is-unanchored';
    root.innerHTML = `
      <div class="guided-tour-backdrop" aria-hidden="true"></div>
      <div class="guided-tour-spotlight" aria-hidden="true"></div>
      <section class="guided-tour-card" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title" aria-describedby="guided-tour-copy" tabindex="-1">
        <span class="guided-tour-version">${tourMode === 'mobile' ? 'GUÍA MÓVIL' : 'GUÍA WEB'}</span>
        <ol class="guided-tour-chapters" aria-label="Partes del tutorial">${groups.map((group, index) => `<li data-tour-group="${index}"><span>${index + 1}</span><b>${group.label}</b></li>`).join('')}</ol>
        <header class="guided-tour-head">
          <span class="guided-tour-mark" aria-hidden="true">1</span>
          <div><small class="guided-tour-eyebrow">RECORRIDO DEL DASHBOARD</small><h2 id="guided-tour-title"></h2></div>
          <button class="guided-tour-close" type="button" aria-label="Cerrar recorrido">×</button>
        </header>
        <div class="guided-tour-body"><p class="guided-tour-copy" id="guided-tour-copy"></p><img class="guided-tour-figure" src="images/dashboard/attendance-on-time.png" alt="" aria-hidden="true" width="100" height="110"></div>
        <ol class="guided-tour-close-flow" aria-label="Orden de cierre">${['Entrada', 'Facebook', 'RPE', 'Salida'].map((label, index) => `<li data-tour-close-stage="${index}">${label}</li>`).join('')}</ol>
        <div class="guided-tour-meter" role="progressbar" aria-label="Progreso del tutorial" aria-valuemin="0" aria-valuemax="100"><i></i></div>
        <footer class="guided-tour-footer">
          <span class="guided-tour-progress" aria-live="polite"></span>
          <div class="guided-tour-actions">
            <button class="guided-tour-skip" type="button" aria-label="Omitir el tutorial por ahora"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg><span>Ahora no</span></button>
            <button class="guided-tour-back" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>Volver</span></button>
            <button class="guided-tour-next" type="button"><span class="guided-tour-next-label">Continuar</span><span class="guided-tour-next-bubble" aria-hidden="true"><svg class="guided-tour-next-icon" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span></button>
          </div>
        </footer>
      </section>`;
    document.body.append(root);
    document.addEventListener('wheel', preventPageScroll, { capture: true, passive: false });
    document.addEventListener('touchmove', preventPageScroll, { capture: true, passive: false });
    document.addEventListener('keydown', preventPageScrollKeys, true);

    root.querySelector('.guided-tour-close').addEventListener('click', () => closeTour(true));
    root.querySelector('.guided-tour-skip').addEventListener('click', () => closeTour(true));
    root.querySelector('.guided-tour-back').addEventListener('click', () => showStep(currentStep - 1));
    root.querySelector('.guided-tour-next').addEventListener('click', () => {
      if (currentStep === activeSteps.length - 1) closeTour(true);
      else showStep(currentStep + 1);
    });
    root.addEventListener('keydown', handleTourKeydown);
  }

  function preventPageScroll(event) {
    if (root) event.preventDefault();
  }

  function preventPageScrollKeys(event) {
    if (!root) return;
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key) || (event.code === 'Space' && !event.target?.closest?.('.guided-tour-card'))) {
      event.preventDefault();
    }
  }

  function positionCard(target) {
    const card = root.querySelector('.guided-tour-card');
    const rect = target?.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    if (rect && viewportWidth > 900 && viewportWidth <= 1280) {
      const sideSpace = Math.max(rect.left - 36, viewportWidth - rect.right - 36);
      card.style.width = `${Math.min(320, Math.max(210, sideSpace))}px`;
    } else card.style.width = '';
    const cardRect = card.getBoundingClientRect();
    const gutter = 16;
    const gap = 20;
    let left = Math.round((viewportWidth - cardRect.width) / 2);
    let top = Math.round((viewportHeight - cardRect.height) / 2);

    if (window.matchMedia('(max-width: 900px)').matches && rect) {
      card.style.left = `${left}px`;
      card.style.top = `${Math.max(gutter, rect.bottom + gap)}px`;
      return;
    }

    if (rect) {
      const centeredTop = Math.max(gutter, Math.min(rect.top + (rect.height - cardRect.height) / 2, viewportHeight - cardRect.height - gutter));
      const sidePositions = rect.left + rect.width / 2 < viewportWidth / 2
        ? [rect.right + gap, rect.left - cardRect.width - gap]
        : [rect.left - cardRect.width - gap, rect.right + gap];
      const side = sidePositions.find(x => x >= gutter && x + cardRect.width <= viewportWidth - gutter);
      if (side !== undefined) {
        card.style.left = `${Math.round(side)}px`;
        card.style.top = `${Math.round(centeredTop)}px`;
        return;
      }
      left = Math.round(rect.left + rect.width / 2 - cardRect.width / 2);
      left = Math.max(gutter, Math.min(left, viewportWidth - cardRect.width - gutter));
      const below = viewportHeight - rect.bottom - 18;
      const above = rect.top - 18;
      if (below >= cardRect.height + gutter) top = Math.round(rect.bottom + 18);
      else if (above >= cardRect.height + gutter) top = Math.round(rect.top - cardRect.height - 18);
      else top = viewportHeight - cardRect.height - gutter;
    }

    top = Math.max(gutter, Math.min(top, viewportHeight - cardRect.height - gutter));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function updateSpotlight() {
    if (!root) return;
    currentTarget = targetFor(activeSteps[currentStep]);
    const spotlight = root.querySelector('.guided-tour-spotlight');
    if (!currentTarget || !isDisplayed(currentTarget)) {
      currentTarget = null;
      root.classList.add('is-unanchored');
      spotlight.hidden = true;
      positionCard(null);
      return;
    }
    const rect = currentTarget.getBoundingClientRect();
    const pad = 7;
    const left = Math.max(4, rect.left - pad);
    const top = Math.max(4, rect.top - pad);
    const right = Math.min(document.documentElement.clientWidth - 4, rect.right + pad);
    positionCard(currentTarget);
    const cardTop = root.querySelector('.guided-tour-card').getBoundingClientRect().top;
    const cardBottom = root.querySelector('.guided-tour-card').getBoundingClientRect().bottom;
    if (window.matchMedia('(max-width: 900px)').matches && cardBottom > document.documentElement.clientHeight - 12) {
      window.scrollBy({ top: Math.ceil(cardBottom - document.documentElement.clientHeight + 12), behavior: 'instant' });
      if (!spotlightFrame) spotlightFrame = window.requestAnimationFrame(() => { spotlightFrame = null; updateSpotlight(); });
      return;
    }
    const bottom = Math.min(document.documentElement.clientHeight - 4, rect.bottom + pad);
    if (right <= left || bottom <= top) {
      root.classList.add('is-unanchored');
      spotlight.hidden = true;
      positionCard(null);
      return;
    }
    spotlight.hidden = false;
    spotlight.style.left = `${left}px`;
    spotlight.style.top = `${top}px`;
    spotlight.style.width = `${right - left}px`;
    spotlight.style.height = `${bottom - top}px`;
    spotlight.style.borderRadius = `${Math.max(12, Math.min(22, parseFloat(getComputedStyle(currentTarget).borderRadius) || 12))}px`;
    root.classList.remove('is-unanchored');
    positionCard(currentTarget);
  }

  function showStep(index) {
    if (!root || index < 0 || index >= activeSteps.length) return;
    currentStep = index;
    const step = activeSteps[currentStep];
    const group = groups[step.group];
    root.style.setProperty('--tour-accent', group.color);
    root.style.setProperty('--tour-soft', group.soft);
    root.querySelector('.guided-tour-eyebrow').textContent = group.label;
    root.querySelector('.guided-tour-mark').textContent = step.group + 1;
    root.querySelectorAll('[data-tour-group]').forEach(item => {
      const selected = Number(item.dataset.tourGroup) === step.group;
      item.classList.toggle('is-active', selected);
      item.classList.toggle('is-complete', Number(item.dataset.tourGroup) < step.group);
      if (selected) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    root.querySelector('#guided-tour-title').textContent = step.title;
    root.querySelector('#guided-tour-copy').textContent = step.copy;
    const figure = root.querySelector('.guided-tour-figure');
    figure.hidden = tourMode === 'mobile';
    figure.src = `images/dashboard/${step.figure}`;
    root.querySelector('.guided-tour-close-flow').hidden = step.closeStage === null;
    root.querySelectorAll('[data-tour-close-stage]').forEach(item => {
      const active = Number(item.dataset.tourCloseStage) === step.closeStage;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    root.querySelector('.guided-tour-progress').textContent = `Paso ${currentStep + 1} de ${activeSteps.length}`;
    const progress = Math.round((currentStep + 1) / activeSteps.length * 100);
    root.querySelector('.guided-tour-meter').setAttribute('aria-valuenow', progress);
    root.querySelector('.guided-tour-meter i').style.width = `${progress}%`;
    root.querySelector('.guided-tour-back').disabled = currentStep === 0;
    const lastStep = currentStep === activeSteps.length - 1;
    root.querySelector('.guided-tour-next-label').textContent = lastStep ? 'Listo' : 'Continuar';
    root.querySelector('.guided-tour-next-icon').innerHTML = lastStep ? '<path d="m5 12 4 4L19 6"/>' : '<path d="M5 12h14m-6-6 6 6-6 6"/>';
    root.querySelector('.guided-tour-card').scrollTop = 0;

    currentTarget = targetFor(step);
    if (currentTarget) {
      currentTarget.scrollIntoView({
        behavior: 'instant',
        block: window.matchMedia('(max-width: 900px)').matches ? 'start' : 'center',
        inline: 'nearest'
      });
      if (window.matchMedia('(max-width: 900px)').matches) window.scrollBy({ top: -76, behavior: 'instant' });
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(updateSpotlight));
    root.querySelector('.guided-tour-card').focus({ preventScroll: true });
  }

  function handleTourKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTour(true);
      return;
    }
    if (event.key !== 'Tab' || !root) return;
    const focusable = [...root.querySelectorAll('button:not(:disabled):not([hidden])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector('.guided-tour-card'))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function startTour({ automatic = false } = {}) {
    if (root || portal.hidden || portal.dataset.personal !== 'true' || portal.dataset.view !== 'inicio') return;
    if (automatic && hasSeenTour()) return;
    if ([...document.querySelectorAll('[aria-modal="true"]')].some(isDisplayed)) return;

    tourMode = screenMode();
    activeSteps = (tourMode === 'mobile' ? mobileSteps : webSteps).filter(step => targetFor(step));
    if (!activeSteps.length) return;
    previousFocus = document.activeElement;
    previousScrollPosition = { left: window.scrollX, top: window.scrollY };
    tourStorageKey = storageKey();
    previousPortalState = { inert: portal.inert, ariaHidden: portal.getAttribute('aria-hidden') };
    portal.inert = true;
    portal.setAttribute('aria-hidden', 'true');
    portal.dataset.guidedTour = tourMode;
    buildTour();
    root.dataset.tourMode = tourMode;
    showStep(0);
    root.querySelector('.guided-tour-card').focus({ preventScroll: true });
  }

  function closeTour(dismissed = false) {
    if (!root) return;
    root.remove();
    root = null;
    currentTarget = null;
    document.removeEventListener('wheel', preventPageScroll, true);
    document.removeEventListener('touchmove', preventPageScroll, true);
    document.removeEventListener('keydown', preventPageScrollKeys, true);
    delete portal.dataset.guidedTour;
    if (previousPortalState) {
      portal.inert = previousPortalState.inert;
      if (previousPortalState.ariaHidden === null) portal.removeAttribute('aria-hidden');
      else portal.setAttribute('aria-hidden', previousPortalState.ariaHidden);
    }
    if (dismissed) rememberTour();
    if (previousScrollPosition && !portal.hidden) window.scrollTo({ left: previousScrollPosition.left, top: previousScrollPosition.top, behavior: 'instant' });
    if (previousFocus?.isConnected && !portal.hidden) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
    previousPortalState = null;
    tourStorageKey = null;
    previousScrollPosition = null;
  }

  function syncTriggers() {
    const enabled = portal.dataset.personal === 'true';
    document.querySelectorAll('[data-guided-tour-start]').forEach(button => {
      if (button.hidden === enabled) button.hidden = !enabled;
      button.onclick = () => {
        if (portal.dataset.view !== 'inicio') document.getElementById('nav-inicio')?.click();
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('side-scrim')?.classList.remove('show');
        startTour();
      };
    });
  }

  function maybeAutoStart() {
    syncTriggers();
    if (hasSeenTour() || portal.hidden || portal.dataset.personal !== 'true' || portal.dataset.view !== 'inicio' || root || autoStartTimer || document.getElementById('today-attendance-card')?.classList.contains('daily-close-pending')) return;
    autoStartTimer = window.setTimeout(() => {
      autoStartTimer = null;
      startTour({ automatic: true });
    }, 1100);
  }

  const portalObserver = new MutationObserver(mutations => {
    if (portal.hidden || portal.dataset.personal !== 'true' || portal.dataset.view !== 'inicio') {
      if (autoStartTimer) window.clearTimeout(autoStartTimer);
      autoStartTimer = null;
      closeTour(false);
    }
    if (root && !spotlightFrame) spotlightFrame = window.requestAnimationFrame(() => {
      spotlightFrame = null;
      updateSpotlight();
    });
    maybeAutoStart();
  });
  portalObserver.observe(portal, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-personal', 'data-view'] });
  window.addEventListener('resize', () => {
    if (root && screenMode() !== tourMode) {
      const stepId = activeSteps[currentStep].id;
      closeTour(false);
      startTour();
      if (root) showStep(Math.max(0, activeSteps.findIndex(step => step.id === stepId)));
    } else updateSpotlight();
    maybeAutoStart();
  }, { passive: true });
  window.addEventListener('scroll', updateSpotlight, { passive: true, capture: true });
  window.visualViewport?.addEventListener('resize', updateSpotlight, { passive: true });
  syncTriggers();
  maybeAutoStart();
})();
