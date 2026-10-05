/* Reveal navigation: the page moves above a stationary menu. */
(() => {
    const drawer = document.getElementById('kja-mobile-drawer');
    const page = document.getElementById('kja-page');
    const toggle = document.querySelector('.kja-menu-toggle');
    if (!drawer || !page || !toggle) return;
    const root = document.documentElement;
    const mobile = window.matchMedia('(max-width: 768px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const closeButton = drawer.querySelector('.kja-drawer-close');
    const shield = document.createElement('button');
    shield.type = 'button';
    shield.className = 'kja-page-shield';
    shield.setAttribute('aria-label', 'Cerrar menú y volver a la página');
    page.append(shield);
    let open = false, active = false, savedY = 0, position = 0, timer, start;
    const inertState = new Map();
    const width = () => Math.min(window.innerWidth * .70, 280);
    function paint(x) {
        position = Math.max(0, Math.min(width(), x));
        root.style.setProperty('--kja-reveal-x', position + 'px');
        root.style.setProperty('--kja-reveal-radius', (Math.min(60, window.innerWidth * .15) * position / width()) + 'px');
        root.style.setProperty('--kja-reveal-dim', .18 * position / width());
    }
    function prepare() {
        clearTimeout(timer);
        if (active) return;
        savedY = window.scrollY;
        active = true;
        root.classList.add('kja-reveal-active');
        page.scrollTop = savedY;
        paint(0);
        void page.offsetWidth;
    }
    function setAccessible(expanded) {
        drawer.inert = !expanded;
        drawer.setAttribute('aria-hidden', String(!expanded));
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? 'Cerrar menú' : 'Abrir menú');
        if (expanded) {
            for (const child of page.children) {
                if (child === shield || inertState.has(child)) continue;
                inertState.set(child, child.inert);
                child.inert = true;
            }
        } else {
            inertState.forEach((value, child) => { child.inert = value; });
            inertState.clear();
        }
    }
    function restore() {
        if (open) return;
        root.classList.remove('kja-reveal-active', 'kja-reveal-dragging');
        active = false;
        page.scrollTop = 0;
        window.scrollTo({ top: savedY, behavior: 'instant' });
    }
    function settle(expanded, immediate = false) {
        if (expanded && !mobile.matches) return;
        if (!active && !expanded) return;
        prepare();
        open = expanded;
        root.classList.remove('kja-reveal-dragging');
        setAccessible(open);
        paint(open ? width() : 0);
        if (open) closeButton.focus({ preventScroll: true });
        else {
            if (mobile.matches) toggle.focus({ preventScroll: true });
            if (immediate || reduced.matches) restore();
            else timer = setTimeout(restore, 380);
        }
    }
    toggle.addEventListener('click', () => settle(!open));
    closeButton.addEventListener('click', () => settle(false));
    shield.addEventListener('click', () => settle(false));
    drawer.addEventListener('click', event => { if (event.target.closest('a')) settle(false, true); });
    document.addEventListener('keydown', event => {
        if (!open) return;
        if (event.key === 'Escape') { event.preventDefault(); settle(false); }
        if (event.key === 'Tab') {
            const controls = [...drawer.querySelectorAll('a[href], button'), shield];
            const index = controls.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) { event.preventDefault(); shield.focus(); }
            else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
        }
    });
    mobile.addEventListener('change', () => { if (!mobile.matches) { start = null; settle(false, true); } });
    window.addEventListener('resize', () => { if (open && mobile.matches) paint(width()); });
    document.addEventListener('touchstart', event => {
        start = null;
        if (!mobile.matches || event.touches.length !== 1) return;
        const touch = event.touches[0];
        if (open || touch.clientX <= 32 || event.target.closest('.kja-mobile-bar')) {
            start = { x: touch.clientX, y: touch.clientY, open, position: open ? width() : 0, dragging: false };
        }
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', event => {
        if (!start) return;
        if (event.touches.length !== 1) { settle(start.open); start = null; return; }
        const dx = event.touches[0].clientX - start.x;
        const dy = event.touches[0].clientY - start.y;
        if (!start.dragging) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { start = null; return; }
            if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (!start.open && dx < 0) { start = null; return; }
            prepare();
            start.dragging = true;
            root.classList.add('kja-reveal-dragging');
        }
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
        paint(start.position + dx);
    }, { passive: false, capture: true });
    document.addEventListener('touchend', event => {
        if (!start) return;
        const gesture = start;
        start = null;
        if (!gesture.dragging) return;
        event.stopImmediatePropagation();
        const dx = event.changedTouches[0].clientX - gesture.x;
        settle(Math.abs(dx) > 60 ? dx > 0 : position > width() / 2);
    }, { passive: true, capture: true });
    document.addEventListener('touchcancel', () => {
        if (start && start.dragging) settle(start.open);
        start = null;
    }, { passive: true });
})();
