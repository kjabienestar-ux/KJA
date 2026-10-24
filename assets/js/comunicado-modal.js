/**
 * KJA · Modal de Comunicado Oficial (Actualización de Contacto)
 * Inyecta y controla el modal responsive y optimizado para escritorio y móviles.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'kja_comunicado_contacto_v1';
  let overlayEl = null;
  let triggerBtn = null;
  let lastActiveElement = null;
  let autoOpenHandled = false;

  // Inyectar enlace de estilos si aún no está presente
  function ensureStyles() {
    if (!document.querySelector('link[href*="comunicado-modal.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/comunicado-modal.css?v=20261024-3';
      document.head.appendChild(link);
    }
  }

  // Generar el marcado HTML del modal y el disparador flotante
  function createModalDOM() {
    if (document.getElementById('kja-comunicado-modal')) return;

    // Contenedor principal del modal
    const overlay = document.createElement('div');
    overlay.id = 'kja-comunicado-modal';
    overlay.className = 'kja-comunicado-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'kja-comunicado-title');
    overlay.setAttribute('aria-describedby', 'kja-comunicado-desc');

    overlay.innerHTML = `
      <div class="kja-comunicado-card" role="document">
        <div class="kja-comunicado-header">
          <img class="kja-comunicado-logo" src="images/logo/kja.webp" width="418" height="121" alt="KJA · Desarrollando mi bienestar">
          <button type="button" class="kja-comunicado-close-btn" id="kja-comunicado-x" aria-label="Cerrar comunicado" title="Cerrar ventana">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        <div class="kja-comunicado-body">
<h2 id="kja-comunicado-title">Comunicado oficial</h2>
<p class="kja-comunicado-subtitle">Actualización de número de contacto</p>
<p id="kja-comunicado-desc">Estimados colaboradores: el número del director <strong>Jean Pierre</strong> ha sido dado de baja y ya no se encuentra habilitado.</p>
<div class="kja-comunicado-number"><span class="kja-comunicado-status"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/></svg>Número deshabilitado</span><strong>937 471 659</strong><span>Por favor, no escribir a este número.</span></div>
<p class="kja-comunicado-next">Próximamente se habilitará un nuevo número de contacto, el cual será comunicado oportunamente.</p>
<p class="kja-comunicado-thanks">Agradecemos su comprensión.<br><strong>Equipo KJA</strong></p>
        </div>

        <div class="kja-comunicado-footer">
          <button type="button" class="kja-comunicado-btn-primary" id="kja-comunicado-btn-ok">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            <span>Entendido</span>
          </button>
          <span class="kja-comunicado-caption">Comunicado oficial · KJA</span>
        </div>
      </div>
    `;

    // Botón disparador flotante para reabrir
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'kja-comunicado-trigger';
    trigger.className = 'kja-comunicado-trigger';
    trigger.setAttribute('aria-label', 'Ver comunicado oficial sobre número de contacto');
    trigger.setAttribute('title', 'Ver comunicado oficial');
    trigger.innerHTML = `
      <span class="kja-comunicado-trigger-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </span>
      <span>Comunicado</span>
      <span class="kja-comunicado-trigger-dot" aria-hidden="true"></span>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(trigger);

    overlayEl = overlay;
    triggerBtn = trigger;

    // Escuchadores de eventos
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeModal();
      }
    });

    const closeBtnX = document.getElementById('kja-comunicado-x');
    if (closeBtnX) closeBtnX.addEventListener('click', closeModal);

    const closeBtnOk = document.getElementById('kja-comunicado-btn-ok');
    if (closeBtnOk) closeBtnOk.addEventListener('click', closeModal);

    trigger.addEventListener('click', function () {
      openModal(true);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && overlayEl.classList.contains('is-visible')) {
        const first = document.getElementById('kja-comunicado-x');
        const last = document.getElementById('kja-comunicado-btn-ok');
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('is-visible')) {
        closeModal();
      }
    });
  }

  function openModal(isUserAction) {
    if (!overlayEl || (!isUserAction && autoOpenHandled)) return;
    autoOpenHandled = true;
    lastActiveElement = document.activeElement;
    document.body.classList.add('kja-comunicado-open');
    overlayEl.classList.add('is-visible');

    // Mover foco al botón Entendido para facilitar cierre con teclado
    const okBtn = document.getElementById('kja-comunicado-btn-ok');
    if (okBtn) {
      setTimeout(function () {
        if (overlayEl.classList.contains('is-visible')) okBtn.focus();
      }, 100);
    }
  }

  function closeModal() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-visible');
    document.body.classList.remove('kja-comunicado-open');

    // Registrar en sessionStorage para no ser invasivo en navegaciones subsecuentes
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}

    // Revelar el disparador flotante para que el usuario pueda consultarlo cuando desee
    if (triggerBtn) {
      triggerBtn.classList.add('is-ready');
    }

    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }

  function shouldAutoOpen() {
    // Si la URL contiene ?comunicado o ?comunicado=1 forzar apertura
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('comunicado')) return true;

    try {
      return !sessionStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return true;
    }
  }

  function init() {
    ensureStyles();
    createModalDOM();

    const autoOpen = shouldAutoOpen();

    if (autoOpen) {
      // Esperar a que la pantalla splash se oculte si existe
      const splash = document.getElementById('kjaSplash');
      if (splash && !splash.classList.contains('kja-splash--hidden')) {
        const observer = new MutationObserver(function () {
          if (splash.classList.contains('kja-splash--hidden')) {
            observer.disconnect();
            setTimeout(function () {
              openModal(false);
            }, 350);
          }
        });
        observer.observe(splash, { attributes: true, attributeFilter: ['class'] });

        // Failsafe por si el splash tarda
        setTimeout(function () {
          observer.disconnect();
          if (!overlayEl.classList.contains('is-visible')) {
            openModal(false);
          }
        }, 1800);
      } else {
        // En páginas sin splash, abrir con una pausa agradable de 400ms
        setTimeout(function () {
          openModal(false);
        }, 400);
      }
    } else {
      // Si ya fue visto en esta sesión, dejar el botón flotante listo
      if (triggerBtn) {
        triggerBtn.classList.add('is-ready');
      }
    }
  }

  // API pública
  window.kjaComunicado = {
    open: function () { openModal(true); },
    close: function () { closeModal(); },
    resetSession: function () {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
