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

// STATS COUNTER ANIMATION
(function () {
    var counters = document.querySelectorAll('.stat-number[data-target], .sb-stat-number[data-target]');
    if (!counters.length) return;

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            var target = parseInt(el.dataset.target, 10);
            var suffix = el.dataset.suffix || '';
            var duration = 1600;
            var start = null;

            function step(timestamp) {
                if (!start) start = timestamp;
                var progress = Math.min((timestamp - start) / duration, 1);
                var ease = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.floor(ease * target) + suffix;
                if (progress < 1) requestAnimationFrame(step);
                else el.textContent = target + suffix;
            }
            requestAnimationFrame(step);
            observer.unobserve(el);
        });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
})();

// ============================================================
//  ARC CAROUSEL — BRINDAMOS semicircle (clockwise, all 6 visible)
// ============================================================
(function () {
    var stage = document.getElementById('sbArcStage');
    if (!stage) return;

    var cards   = stage.querySelectorAll('.sb-arc-card');
    var N       = cards.length;   // 6
    var R       = 95;             // radius px
    var CX      = 18;             // arc center offset from stage left (px)
    var SPD     = 0.005;          // rad/frame ≈ 10s per loop
    var angle   = 0;
    var active  = false;
    var PI      = Math.PI;
    var HALF_PI = PI / 2;
    var spacing = PI / N;         // 30° between items

    // Fade zone at ±90° edges — wider = smoother appearance (28° ≈ 0.49 rad)
    var FADE_EDGE = 0.49;

    var io = new IntersectionObserver(function (entries) {
        active = entries[0].isIntersecting;
        if (active) requestAnimationFrame(tick);
    }, { threshold: 0.1 });
    io.observe(stage);

    function tick() {
        if (!active) return;
        angle += SPD;

        var stageH = stage.offsetHeight || 260;

        for (var i = 0; i < N; i++) {
            // Wrap each item onto right semicircle [-PI/2, +PI/2]
            var raw = angle + spacing * i;
            var a   = ((raw % PI) + PI) % PI - HALF_PI;

            var x = R * Math.cos(a);
            var y = R * Math.sin(a);

            // Tight taper: 0.78 at 12/6-o'clock, 1.0 at 3-o'clock
            var scale = 0.78 + 0.22 * Math.cos(a);

            // Fade only in the last 8.5° near each edge (hides the wrap jump)
            var distFromEdge = HALF_PI - Math.abs(a);
            var opacity = Math.max(0, Math.min(1, distFromEdge / FADE_EDGE));

            var c = cards[i];
            c.style.left      = (CX + x) + 'px';
            c.style.top       = (stageH / 2 + y) + 'px';
            c.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
            c.style.opacity   = opacity.toFixed(3);
            c.style.zIndex    = Math.round(scale * 10);
        }

        requestAnimationFrame(tick);
    }
})();

// ============================================================
//  ÁREAS DE ATENCIÓN — ETIQUETAS Y MODAL
// ============================================================
const topicsData = {
    "ansiedad": {
        title: "Tratamiento de Ansiedad",
        desc: "La ansiedad constante puede paralizarte y afectar tu día a día. Nuestro equipo te ayuda con herramientas basadas en evidencia para recuperar la calma y tu bienestar.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/terapia_conductual.webp",
        courses: [{name: "Taller: Manejo de ansiedad", url: "cursos.html"}]
    },
    "depresion": {
        title: "Tratamiento de Depresión",
        desc: "La depresión es una condición que afecta tu energía, motivación y estado de ánimo. Te acompañamos a recuperar tu bienestar paso a paso, a tu propio ritmo.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/psicologia_clinica.avif",
        courses: [{name: "Charla: Sanando desde adentro", url: "cursos.html"}]
    },
    "tdah": {
        title: "Evaluación y Tratamiento TDAH",
        desc: "El TDAH no tratado puede causar frustración en el trabajo o estudios. Te ayudamos a entender tu mente y desarrollar estrategias de enfoque y organización.",
        price: "S/ 80.00",
        image: "images/Terapia/tdh1.webp",
        courses: [{name: "Curso: Estrategias para adultos con TDAH", url: "cursos.html"}]
    },
    "fobias": {
        title: "Superando Fobias",
        desc: "Los miedos irracionales limitan tus experiencias. Utilizamos técnicas de exposición gradual y terapia cognitivo-conductual para ayudarte a vivir sin ataduras.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/terapia_conductual.webp",
        courses: [{name: "Charla: Entendiendo el miedo", url: "cursos.html"}]
    },
    "conflictos de pareja": {
        title: "Terapia de Pareja",
        desc: "Mejoren la comunicación, reconstruyan la confianza y resuelvan conflictos desde la empatía. Espacio seguro para reconectar y fortalecer su vínculo afectivo.",
        price: "S/ 100.00",
        image: "images/inicio-terapias/terapia_sistemica.png",
        courses: [{name: "Taller: Comunicación Asertiva en Pareja", url: "cursos.html"}]
    },
    "dependencia emocional": {
        title: "Independencia Emocional",
        desc: "Rompe patrones de relaciones tóxicas y aprende a construir vínculos desde la libertad y el amor propio. Te acompañamos en tu proceso de autovaloración.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/psicologia_clinica.avif",
        courses: [{name: "Curso: Amor Propio y Relaciones Sanas", url: "cursos.html"}]
    },
    "autoestima": {
        title: "Fortalecimiento de Autoestima",
        desc: "Descubre tu verdadero valor y aprende a tratarte con autocompasión. Te brindamos herramientas para silenciar al crítico interno y potenciar tu seguridad.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/terapia_conductual.webp",
        courses: [{name: "Taller: Autocompasión y Crecimiento", url: "cursos.html"}]
    },
    "burnout": {
        title: "Recuperación del Burnout",
        desc: "El agotamiento extremo (Burnout) afecta tu salud física y mental. Diseñamos un plan para que recuperes tu energía, establezcas límites y encuentres equilibrio.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/colegiados_cpa.jpg",
        courses: [{name: "Charla: Equilibrio Vida y Trabajo", url: "cursos.html"}]
    },
    "traumas": {
        title: "Sanación de Traumas",
        desc: "Las heridas del pasado no tienen que definir tu futuro. Ofrecemos terapias especializadas y un entorno seguro para procesar eventos dolorosos.",
        price: "S/ 80.00",
        image: "images/inicio-terapias/terapia_conductual.webp",
        courses: [{name: "Curso: Introducción al trauma y resiliencia", url: "cursos.html"}]
    },
    // Default fallback
    "default": {
        title: "Atención Psicológica Especializada",
        desc: "Abordamos este motivo de consulta con terapias basadas en evidencia, en un ambiente confidencial y libre de juicios. Nuestro equipo te guía hacia tu bienestar.",
        price: "S/ 60.00",
        image: "images/inicio-terapias/psicologia_clinica.avif",
        courses: [{name: "Charla Introductoria sobre Salud Mental", url: "cursos.html"}]
    }
};

const areasList = [
    "Ansiedad", "Depresión", "Estrés", "Autoestima", "Burnout", "Traumas", 
    "TEPT", "Abuso", "TOC", "Fobias", "Conflictos de pareja", "Duelo", 
    "Conducta infantil", "Dependencia emocional", "Manejo de emociones", 
    "TDAH", "Trastornos alimenticios", "Violencia doméstica", 
    "Orientación vocacional", "Dificultades laborales", "Transiciones de vida"
];

document.addEventListener('DOMContentLoaded', () => {
    const cloud = document.getElementById('areasCloud');
    if (!cloud) return;

    // Generar etiquetas
    areasList.forEach(area => {
        const btn = document.createElement('button');
        btn.className = "px-4 md:px-5 py-2 md:py-2.5 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-medium hover:border-[#f10075] hover:text-[#f10075] hover:shadow-md transition-all duration-300 transform hover:-translate-y-1";
        btn.textContent = area;
        btn.onclick = () => openTopicModal(area);
        cloud.appendChild(btn);
    });

    // Animación GSAP de la sección al hacer scroll
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.areas-anim', 
            { opacity: 0, y: 30 },
            {
                scrollTrigger: {
                    trigger: '#areas-atencion',
                    start: 'top 75%',
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
});

function openTopicModal(topicName) {
    const key = topicName.toLowerCase();
    const data = topicsData[key] || { ...topicsData['default'], title: "Tratamiento: " + topicName };
    
    // Inyectar textos
    document.getElementById('modalTitle').textContent = data.title;
    document.getElementById('modalDesc').textContent = data.desc;
    document.getElementById('modalPrice').textContent = data.price;
    
    // Inyectar imagen
    const imgEl = document.getElementById('modalImage');
    if (imgEl && data.image) {
        imgEl.src = data.image;
        imgEl.alt = data.title;
    }
    
    // Botón de WhatsApp pre-llenado
    const phone = "51988918238"; // Número configurado
    const message = `Hola, quiero agendar cita y solicitar más información sobre: ${data.title}.`;
    document.getElementById('modalWaBtn').href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    // Cursos sugeridos — cards estilo recomendación
    const coursesList = document.getElementById('modalCoursesList');
    coursesList.innerHTML = '';
    data.courses.forEach((c, index) => {
        const card = document.createElement('a');
        card.href = c.url;
        card.className = "course-card-anim block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl border border-gray-100 transition-all duration-300 group";
        card.style.animationDelay = `${index * 0.2}s`;
        
        // Usar la imagen del tratamiento como referencia visual de la card
        const cardImg = c.image || data.image || 'images/inicio-terapias/terapia_conductual.webp';
        const cardDesc = c.desc || 'Programa especializado diseñado para fortalecer tu bienestar emocional con herramientas prácticas.';
        
        card.innerHTML = `
            <div class="relative h-40 overflow-hidden">
                <img src="${cardImg}" alt="${c.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div class="absolute bottom-3 left-4 right-4">
                    <span class="text-white font-bold text-sm drop-shadow-lg">${c.name}</span>
                </div>
            </div>
            <div class="p-4">
                <p class="text-gray-600 text-xs leading-relaxed mb-3 line-clamp-2">${cardDesc}</p>
                <span class="inline-flex items-center gap-1.5 text-[#004fb0] text-xs font-bold group-hover:text-[#f10075] transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                    VER DETALLES
                </span>
            </div>
        `;
        coursesList.appendChild(card);
    });

    // Actualizar caption de imagen
    const captionEl = document.getElementById('modalImageCaption');
    if (captionEl) captionEl.textContent = `KJA — ${data.title}`;

    // Mostrar modal con animaciones
    const modal = document.getElementById('topicModal');
    const content = document.getElementById('topicModalContent');
    
    modal.classList.remove('hidden'); // por si acaso
    // Un pequeño timeout para que la transición de opacidad funcione
    setTimeout(() => {
        modal.classList.remove('pointer-events-none', 'opacity-0');
        modal.classList.add('opacity-100');
        
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    document.body.style.overflow = 'hidden'; // Evitar scroll de fondo
}

function closeTopicModal() {
    const modal = document.getElementById('topicModal');
    const content = document.getElementById('topicModalContent');
    
    modal.classList.remove('opacity-100');
    modal.classList.add('pointer-events-none', 'opacity-0');
    
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        document.body.style.overflow = ''; 
    }, 300);
}

