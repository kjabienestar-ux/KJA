/* KJA-006: vista controlada del pack. No conserva el carrito ni abre WhatsApp. */
(() => {
  'use strict';
  const dock = document.querySelector('.offer-dock');
  if (!dock || window.KJA_COURSE_OFFER) return;
  if (document.body.classList.contains('course-area-page') || typeof KJA_FORMATION === 'undefined') {
    dock.hidden = true;
    return;
  }
  const tab = dock.querySelector('.offer-tab');
  const popover = dock.querySelector('.offer-popover');
  const card = dock.querySelector('.offer-card');
  const close = dock.querySelector('.offer-close');
  const dialog = dock.querySelector('.offer-mobile-dialog');
  const mouseHover = matchMedia('(hover: hover) and (pointer: fine)');
  const mobile = matchMedia('(max-width: 600px), (hover: none) and (pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const catalog = new Map(KJA_FORMATION.courses.map(course => [course.id, course]));
  const slots = dock.querySelector('[data-offer-slots]');
  const browse = dock.querySelector('[data-offer-browse]');
  const checkout = dock.querySelector('[data-offer-checkout]');
  let selection = [];
  let pinned = false;
  let revealTimer;
  let leaveTimer;
  let dismissTimer;
  let scrollSnapshot;

  function snapshot() {
    return { courseIds: [...selection], count: selection.length, complete: selection.length === 4, total: 99, currency: 'PEN' };
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(`kja:offer:${name}`, { detail }));
  }

  function renderSelection(announce = true) {
    const activeRemove = document.activeElement?.closest('[data-offer-remove]');
    const activeIndex = activeRemove ? selection.indexOf(activeRemove.dataset.offerRemove) : -1;
    const nextSlots = document.createDocumentFragment();
    for (let index = 0; index < 4; index++) {
      const course = catalog.get(selection[index]);
      const item = document.createElement('li');
      item.className = 'offer-slot';
      item.dataset.offerSlot = String(index);
      item.dataset.selected = String(Boolean(course));
      item.dataset.bonus = String(index === 3);
      const copy = document.createElement('div');
      copy.className = 'offer-slot-copy';
      const title = document.createElement('p');
      title.className = 'offer-slot-title';
      if (course) {
        item.dataset.courseId = course.id;
        const image = document.createElement('img');
        image.className = 'offer-slot-photo';
        image.src = `images/cursos/photos/${course.image}.webp`;
        image.alt = '';
        image.width = 40;
        image.height = 40;
        image.decoding = 'async';
        item.appendChild(image);
        title.textContent = course.fullTitle || course.title;
      } else {
        const number = document.createElement('span');
        number.className = 'offer-slot-number';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = String(index + 1).padStart(2, '0');
        item.appendChild(number);
        title.textContent = ['Tu primer curso', 'Tu segundo curso', 'Tu tercer curso', 'Tu curso gratis'][index];
      }
      copy.appendChild(title);
      if (index === 3) {
        const bonus = document.createElement('span');
        bonus.className = 'offer-slot-bonus';
        bonus.textContent = course ? 'Incluido gratis en tu pack' : 'El cuarto va por KJA';
        copy.appendChild(bonus);
      }
      item.appendChild(copy);
      if (course) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'offer-remove';
        remove.dataset.offerRemove = course.id;
        remove.setAttribute('aria-label', `Quitar ${course.fullTitle || course.title}`);
        remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></svg>';
        item.appendChild(remove);
      }
      nextSlots.appendChild(item);
    }
    slots.replaceChildren(nextSlots);
    const count = selection.length;
    dock.dataset.count = String(count);
    dock.querySelector('[data-offer-count]').textContent = `${count}/4`;
    tab.setAttribute('aria-label', `Abrir oferta de cursos: ${count} de 4 seleccionados`);
    dock.querySelector('[data-offer-progress]').textContent = `${count} de 4`;
    dock.querySelectorAll('.offer-progress span').forEach((segment, index) => { segment.dataset.filled = String(index < count); });
    checkout.hidden = count !== 4;
    browse.textContent = count === 4 ? 'Editar mi selección' : count ? 'Seguir eligiendo' : 'Elegir mis cursos';
    const help = count === 4 ? 'Tu pack está completo. Continúa por WhatsApp.' : count === 3 ? 'Te falta 1 curso para completar tu oferta.' : `Elige ${4 - count} cursos para completar tu oferta.`;
    dock.querySelector('[data-offer-help]').textContent = help;
    if (announce) dock.querySelector('[data-offer-status]').textContent = `${count} de 4 cursos seleccionados. ${help}`;
    if (activeRemove && dock.dataset.open === 'true') {
      const buttons = [...slots.querySelectorAll('[data-offer-remove]')];
      (buttons[Math.max(0, Math.min(activeIndex, buttons.length - 1))] || browse).focus({ preventScroll: true });
    }
  }

  function setSelection(courseIds) {
    if (!Array.isArray(courseIds) || courseIds.length > 4 || new Set(courseIds).size !== courseIds.length || courseIds.some(id => typeof id !== 'string' || !catalog.has(id))) {
      throw new TypeError('La vista espera hasta 4 IDs únicos de KJA_FORMATION.courses.');
    }
    if (courseIds.length === selection.length && courseIds.every((id, index) => id === selection[index])) return snapshot();
    selection = [...courseIds];
    renderSelection();
    const state = snapshot();
    emit('rendered', state);
    return snapshot();
  }

  function clearHoverTimers() {
    clearTimeout(revealTimer);
    clearTimeout(leaveTimer);
  }

  function lockScroll() {
    if (scrollSnapshot) return;
    const properties = ['position', 'top', 'width', 'overflow'];
    scrollSnapshot = {
      y: window.scrollY,
      styles: properties.map(property => [property, document.body.style[property]])
    };
    Object.assign(document.body.style, {
      position: 'fixed', top: `-${scrollSnapshot.y}px`, width: '100%', overflow: 'hidden'
    });
  }

  function finishDialog(restoreFocus = false, afterClose) {
    clearTimeout(dismissTimer);
    dialog.dataset.visible = 'false';
    if (dialog.open) dialog.close();
    popover.appendChild(card);
    if (scrollSnapshot) {
      const snapshot = scrollSnapshot;
      scrollSnapshot = null;
      snapshot.styles.forEach(([property, value]) => { document.body.style[property] = value; });
      window.scrollTo({ top: snapshot.y, behavior: 'instant' });
    }
    if (restoreFocus) tab.focus({ preventScroll: true });
    if (dock.dataset.open === 'false') dock.dataset.stage = 'gift';
    afterClose?.();
  }

  function openPanel(focus = false) {
    clearHoverTimers();
    clearTimeout(dismissTimer);
    dock.dataset.stage = 'panel';
    dock.dataset.open = 'true';
    tab.setAttribute('aria-expanded', 'true');
    if (mobile.matches) {
      dock.dataset.mode = 'modal';
      tab.setAttribute('aria-controls', 'offer-mobile-dialog');
      popover.inert = true;
      popover.setAttribute('aria-hidden', 'true');
      if (!dialog.open) {
        dialog.appendChild(card);
        lockScroll();
        dialog.showModal();
        close.focus({ preventScroll: true });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (dialog.open && dock.dataset.open === 'true') dialog.dataset.visible = 'true';
      }));
    } else {
      if (dialog.open) finishDialog();
      dock.dataset.mode = 'popover';
      tab.setAttribute('aria-controls', 'offer-popover');
      popover.inert = false;
      popover.setAttribute('aria-hidden', 'false');
      if (focus) requestAnimationFrame(() => requestAnimationFrame(() => {
        if (dock.dataset.open === 'true') close.focus({ preventScroll: true });
      }));
    }
  }

  function dismiss(restoreFocus = false, afterClose) {
    clearHoverTimers();
    pinned = false;
    dock.dataset.stage = 'gift';
    dock.dataset.open = 'false';
    tab.setAttribute('aria-expanded', 'false');
    popover.inert = true;
    popover.setAttribute('aria-hidden', 'true');
    if (dialog.open) {
      dialog.dataset.visible = 'false';
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => finishDialog(restoreFocus, afterClose), 160);
    } else if (restoreFocus) {
      tab.focus({ preventScroll: true });
      dock.dataset.stage = 'gift';
    }
    if (!dialog.open) afterClose?.();
  }

  dock.addEventListener('pointerenter', event => {
    if (!mouseHover.matches || event.pointerType !== 'mouse' || dialog.open) return;
    clearHoverTimers();
    if (dock.dataset.open === 'true') return;
    dock.dataset.stage = 'label';
    // Primer tiempo: extender la pestaña. Segundo: revelar el panel, sin otro clic.
    revealTimer = setTimeout(() => openPanel(), 440);
  });
  dock.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse' || dialog.open) return;
    clearHoverTimers();
    if (!pinned && !dock.contains(document.activeElement)) {
      leaveTimer = setTimeout(() => dismiss(), 120);
    }
  });
  tab.addEventListener('focus', () => {
    if (dock.dataset.open === 'false') dock.dataset.stage = 'label';
  });
  tab.addEventListener('click', event => {
    if (pinned) return dismiss(true);
    pinned = true;
    openPanel(event.detail === 0);
  });
  tab.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    pinned = true;
    openPanel(true);
  });
  close.addEventListener('click', () => dismiss(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dock.dataset.open === 'true' && !dialog.open) {
      event.preventDefault();
      dismiss(dock.contains(document.activeElement));
    }
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dismiss(true);
  });
  dialog.addEventListener('pointerdown', event => {
    if (event.target === dialog) dismiss(true);
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...card.querySelectorAll('button:not(:disabled), a[href]')].filter(element => !element.hidden && element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!dialog.open && !dock.contains(event.target)) dismiss();
  });
  dock.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!dialog.open && !dock.contains(document.activeElement)) dismiss();
    });
  });
  mobile.addEventListener('change', () => {
    if (dock.dataset.open === 'true') openPanel();
  });

  slots.addEventListener('click', event => {
    const remove = event.target.closest('[data-offer-remove]');
    if (remove) emit('remove', { courseId: remove.dataset.offerRemove, ...snapshot() });
  });
  checkout.addEventListener('click', () => {
    if (selection.length === 4) emit('checkout', snapshot());
  });
  browse.addEventListener('click', () => {
    dismiss(false, () => {
      const section = document.getElementById('catalogo');
      const heading = document.getElementById('formation-courses-title');
      section?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  });

  renderSelection(false);
  window.KJA_COURSE_OFFER = Object.freeze({
    version: 1,
    setSelection,
    getSelection: () => [...selection],
    getTarget: () => tab,
    open: () => { pinned = true; openPanel(true); },
    close: () => dismiss(true)
  });
})();
