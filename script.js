// ============================================================
//  PROMO COUNTDOWN — siempre < 5h, bucle infinito
// ============================================================
(function initCountdown() {
    const elH = document.getElementById('cdHoras');
    if (!elH) return;

    const KEY = 'kja_promo_expiry';
    const pad = n => String(n).padStart(2, '0');

    // Al resetear: entre 4h 10m y 4h 55m (siempre parece que "casi acaba")
    function newExpiry() {
        const base = 4 * 3600000 + 10 * 60000;
        const jitter = Math.random() * 45 * 60000;
        return Date.now() + base + jitter;
    }

    let expiry = parseInt(localStorage.getItem(KEY), 10);
    // Resetear si: no existe, ya expiró, o supera 5h (manipulación)
    if (!expiry || Date.now() > expiry || (expiry - Date.now()) > 5 * 3600000) {
        expiry = newExpiry();
        localStorage.setItem(KEY, expiry);
    }

    function tick() {
        let diff = expiry - Date.now();
        if (diff <= 0) {
            expiry = newExpiry();
            localStorage.setItem(KEY, expiry);
            diff = expiry - Date.now();
        }
        elH.textContent = pad(Math.floor(diff / 3600000));
        document.getElementById('cdMin').textContent = pad(Math.floor((diff % 3600000) / 60000));
        document.getElementById('cdSeg').textContent = pad(Math.floor((diff % 60000) / 1000));
    }

    tick();
    setInterval(tick, 1000);
})();

// ============================================================
//  MOBILE MENU
// ============================================================
function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    const hamburger = document.getElementById('hamburger');
    if (menu) menu.classList.toggle('open');
    if (hamburger) hamburger.classList.toggle('open');
}

document.addEventListener('click', function(e) {
    const menu      = document.getElementById('nav-menu');
    const hamburger = document.getElementById('hamburger');
    if (menu && hamburger && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove('open');
        hamburger.classList.remove('open');
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

        // Clonar fill del bar saliente para resetear su animación CSS
        const oldFill = bars[prev].querySelector('.bar-fill');
        bars[prev].replaceChild(oldFill.cloneNode(true), oldFill);

        // Nuevo índice con wrap-around
        current = (index + TOTAL) % TOTAL;

        // Forzar reflow en el bg entrante para que kenBurns reinicie siempre
        void bgs[current].offsetWidth;

        // Activar slide y fondo
        slides[current].classList.add('active');
        bgs[current].classList.add('active');

        // Clonar fill del bar entrante para que su animación también reinicie
        const inFill = bars[current].querySelector('.bar-fill');
        bars[current].replaceChild(inFill.cloneNode(true), inFill);

        bars[current].classList.add('active');
        bars[current].setAttribute('aria-selected', 'true');

        // Actualizar contador
        if (counter) counter.textContent = pad(current);

        // Animación GSAP de entrada para el contenido del slide
        const animElements = slides[current].querySelectorAll('.animate-hero');
        if (animElements.length) {
            gsap.killTweensOf(animElements);
            gsap.set(animElements, { opacity: 0, y: 30 });
            gsap.to(animElements, {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out',
                delay: 0.1
            });
        }
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

// ============================================================
//  GSAP SCROLLTRIGGER ANIMATIONS (Features & Pricing)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') return;
    // Registrar ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // Animación para Features (Bento Grid)
    if (document.querySelector('#por-que-kja')) {
        gsap.fromTo('.animate-features-header', 
            { opacity: 0, y: 40 },
            {
                scrollTrigger: {
                    trigger: '#por-que-kja',
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out'
            }
        );

        gsap.fromTo('.animate-features-card', 
            { opacity: 0, y: 40 },
            {
                scrollTrigger: {
                    trigger: '#por-que-kja',
                    start: 'top 65%',
                    toggleActions: 'play none none none'
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out'
            }
        );
    }

    // Animación para Pricing (Planes)
    if (document.querySelector('#planes')) {
        gsap.fromTo('.animate-pricing-header', 
            { opacity: 0, y: 40 },
            {
                scrollTrigger: {
                    trigger: '#planes',
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out'
            }
        );

        gsap.fromTo('.animate-pricing-card', 
            { opacity: 0, y: 40 },
            {
                scrollTrigger: {
                    trigger: '#planes',
                    start: 'top 65%',
                    toggleActions: 'play none none none'
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out'
            }
        );
    }

    // Animación para FAQ Premium Rediseñado
    if (document.querySelector('#faq')) {
        gsap.fromTo('.animate-faq-header', 
            { opacity: 0, x: -50 },
            {
                scrollTrigger: {
                    trigger: '#faq',
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                opacity: 1,
                x: 0,
                duration: 0.8,
                ease: 'power3.out'
            }
        );

        gsap.fromTo('.animate-faq-item', 
            { opacity: 0, y: 30 },
            {
                scrollTrigger: {
                    trigger: '#faq',
                    start: 'top 70%',
                    toggleActions: 'play none none none'
                },
                opacity: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.1,
                ease: 'power3.out'
            }
        );
    }
});

