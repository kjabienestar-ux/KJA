(() => {
    'use strict';
    const tabs = document.getElementById('about-tabs');
    tabs?.addEventListener('keydown', event => {
        const buttons = [...tabs.querySelectorAll('button')].filter(button => button.offsetParent !== null);
        const index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        let next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        buttons[next].focus();
        buttons[next].click();
    });

    const track = document.getElementById('community-track');
    if (!track) return;
    const carousel = track.closest('.community-carousel');
    const slides = [...track.querySelectorAll('.community-slide')];
    const photos = slides.map(slide => slide.querySelector('.community-photo'));
    const dots = [...carousel.querySelectorAll('[data-slide]')];
    const previous = carousel.querySelector('[data-gallery-step="-1"]');
    const next = carousel.querySelector('[data-gallery-step="1"]');
    const status = carousel.querySelector('[role="status"]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileGallery = window.matchMedia('(max-width: 768px)');
    let active = 0;
    let frame = 0;
    let announcement;
    let drag = null;

    function update() {
        frame = 0;
        if (!mobileGallery.matches || !track.clientWidth) return;
        const bounds = track.getBoundingClientRect();
        const center = bounds.left + bounds.width / 2;
        const positions = slides.map(slide => {
            const rect = slide.getBoundingClientRect();
            return (rect.left + rect.width / 2 - center) / rect.width;
        });
        active = positions.reduce((best, value, index) => Math.abs(value) < Math.abs(positions[best]) ? index : best, 0);
        positions.forEach((position, index) => {
            const distance = Math.min(1, Math.abs(position));
            const photo = photos[index];
            photo.style.setProperty('--photo-scale', reducedMotion.matches ? '1' : String(1 - distance * .045));
            photo.style.setProperty('--photo-angle', (reducedMotion.matches ? 0 : Math.max(-1, Math.min(1, position)) * -5) + 'deg');
            photo.style.setProperty('--photo-y', (reducedMotion.matches ? 0 : distance * 5) + 'px');
            photo.style.setProperty('--photo-opacity', reducedMotion.matches ? '1' : String(1 - distance * .12));
            slides[index].classList.toggle('is-current', index === active);
            if (index === active) dots[index].setAttribute('aria-current', 'true');
            else dots[index].removeAttribute('aria-current');
        });
        previous.disabled = active === 0;
        next.disabled = active === slides.length - 1;
    }
    function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
    }
    function goTo(index) {
        if (!mobileGallery.matches || !track.clientWidth) return;
        const target = slides[Math.max(0, Math.min(slides.length - 1, index))];
        const rect = target.getBoundingClientRect();
        const bounds = track.getBoundingClientRect();
        track.scrollTo({ left: track.scrollLeft + rect.left + rect.width / 2 - bounds.left - bounds.width / 2, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
    track.addEventListener('scroll', () => {
        if (!mobileGallery.matches) return;
        schedule();
        clearTimeout(announcement);
        announcement = setTimeout(() => { status.textContent = 'Foto ' + (active + 1) + ' de ' + slides.length; }, 180);
    }, { passive: true });
    dots.forEach(dot => dot.addEventListener('click', () => goTo(Number(dot.dataset.slide))));
    previous.addEventListener('click', () => goTo(active - 1));
    next.addEventListener('click', () => goTo(active + 1));
    track.addEventListener('keydown', event => {
        if (!mobileGallery.matches) return;
        const destinations = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
        if (!(event.key in destinations)) return;
        event.preventDefault();
        goTo(destinations[event.key]);
    });
    // Touch uses native scrolling; mouse dragging offers the same direct control.
    track.addEventListener('pointerdown', event => {
        if (!mobileGallery.matches || event.pointerType !== 'mouse' || event.button !== 0) return;
        drag = { x: event.clientX, scroll: track.scrollLeft };
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', event => {
        if (!drag) return;
        track.scrollLeft = drag.scroll - (event.clientX - drag.x);
    });
    function finishDrag() {
        if (!drag) return;
        drag = null;
        track.classList.remove('is-dragging');
        update();
        goTo(active);
    }
    track.addEventListener('pointerup', finishDrag);
    track.addEventListener('pointercancel', finishDrag);
    track.addEventListener('lostpointercapture', finishDrag);
    track.addEventListener('dragstart', event => event.preventDefault());
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(track);
    window.addEventListener('resize', schedule, { passive: true });
    reducedMotion.addEventListener('change', schedule);
    document.addEventListener('kja:about-panel', event => {
        if (event.detail.panel === 'servicios') schedule();
    });
    function syncLayout() {
        const mobile = mobileGallery.matches;
        drag = null;
        clearTimeout(announcement);
        track.classList.remove('is-dragging');
        carousel.querySelector('.community-controls').hidden = !mobile;
        track.setAttribute('aria-label', mobile ? 'Galería de fotos. Usa las flechas izquierda y derecha para navegar.' : 'Fotos de nuestra comunidad');
        if (mobile) {
            track.setAttribute('tabindex', '0');
            carousel.setAttribute('aria-roledescription', 'carrusel');
        } else {
            track.removeAttribute('tabindex');
            carousel.removeAttribute('aria-roledescription');
            photos.forEach(photo => {
                ['--photo-scale', '--photo-angle', '--photo-y', '--photo-opacity'].forEach(property => photo.style.removeProperty(property));
            });
        }
        slides.forEach(slide => {
            if (mobile) slide.setAttribute('aria-roledescription', 'diapositiva');
            else slide.removeAttribute('aria-roledescription');
        });
        schedule();
    }
    mobileGallery.addEventListener('change', syncLayout);
    syncLayout();
})();
