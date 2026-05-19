// ============================================================
//  MOBILE MENU
// ============================================================
function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', function(e) {
    const menu      = document.getElementById('nav-menu');
    const hamburger = document.getElementById('hamburger');
    if (menu && hamburger && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove('open');
    }
});

// ============================================================
//  FAQ ACCORDION
// ============================================================
function toggleFaq(btn) {
    const answer = btn.nextElementSibling;
    const isOpen = answer.classList.contains('open');
    document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
    document.querySelectorAll('.faq-question').forEach(b => b.classList.remove('open'));
    if (!isOpen) {
        answer.classList.add('open');
        btn.classList.add('open');
    }
}

// ============================================================
//  HERO CAROUSEL — PREMIUM
// ============================================================
(function initCarousel() {
    const slides    = document.querySelectorAll('.carousel-slide');
    const bgs       = document.querySelectorAll('.carousel-bg');
    const bars      = document.querySelectorAll('.carousel-bar');
    const counter   = document.getElementById('counterCurrent');
    const prevBtn   = document.getElementById('prevBtn');
    const nextBtn   = document.getElementById('nextBtn');

    if (!slides.length) return;   // no hay carrusel en esta página

    const TOTAL  = slides.length;
    const DELAY  = 5000;
    let current  = 0;
    let timer    = null;

    /* ─ helper: número → "01", "02"… ─ */
    function pad(n) { return String(n + 1).padStart(2, '0'); }

    /* ─ ir al slide n ─ */
    function goTo(index) {
        const prev = current;

        // Limpiar estado anterior
        slides[prev].classList.remove('active');
        bgs[prev].classList.remove('active');
        bars[prev].classList.remove('active');
        bars[prev].setAttribute('aria-selected', 'false');

        // Reiniciar barra de progreso: clonar para resetear animación CSS
        const oldFill = bars[prev].querySelector('.bar-fill');
        const newFill = oldFill.cloneNode(true);
        bars[prev].replaceChild(newFill, oldFill);

        // Nuevo índice con wrap-around
        current = (index + TOTAL) % TOTAL;

        // Activar slide y fondo
        slides[current].classList.add('active');
        bgs[current].classList.add('active');
        bars[current].classList.add('active');
        bars[current].setAttribute('aria-selected', 'true');

        // Actualizar contador
        if (counter) counter.textContent = pad(current);
    }

    /* ─ reiniciar temporizador ─ */
    function resetTimer() {
        clearInterval(timer);
        timer = setInterval(() => goTo(current + 1), DELAY);
    }

    function next() { goTo(current + 1); resetTimer(); }
    function prev() { goTo(current - 1); resetTimer(); }

    /* ─ Flechas ─ */
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    /* ─ Barras (clic directo) ─ */
    bars.forEach(bar => {
        bar.addEventListener('click', function () {
            goTo(parseInt(this.dataset.index, 10));
            resetTimer();
        });
    });

    /* ─ Swipe táctil ─ */
    let touchStartX = 0;
    const carouselEl = document.querySelector('.hero-carousel');
    if (carouselEl) {
        carouselEl.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carouselEl.addEventListener('touchend', e => {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
        }, { passive: true });

        /* ─ Pausa en hover ─ */
        carouselEl.addEventListener('mouseenter', () => clearInterval(timer));
        carouselEl.addEventListener('mouseleave', resetTimer);
    }

    /* ─ Teclado (← →) ─ */
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft')  { prev(); }
        if (e.key === 'ArrowRight') { next(); }
    });

    /* ─ Fijar duración de la barra CSS ─ */
    document.querySelectorAll('.carousel-bar').forEach(b => {
        b.style.setProperty('--carousel-delay', DELAY + 'ms');
    });

    /* ─ Arrancar ─ */
    goTo(0);
    resetTimer();
})();

