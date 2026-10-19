/*
 * Pestaña "Representantes" de nosotros.html: carrusel circular en media luna.
 * Cada avatar se dibuja según su distancia k al centro sobre una parábola:
 * x = k · separación, y = −profundidad · k² (los extremos quedan más arriba).
 * Los datos vienen de representantes-data.js.
 */
(() => {
    'use strict';
    const people = Array.isArray(window.KJA_REPRESENTANTES) ? window.KJA_REPRESENTANTES : [];
    const panel = document.getElementById('about-representantes');
    const root = document.getElementById('reps');
    if (!panel || !root || !people.length) return;

    const stage = document.getElementById('reps-stage');
    const orbit = document.getElementById('reps-orbit');
    const band = document.getElementById('reps-band');
    const bandPath = document.getElementById('reps-band-path');
    const bandFill = document.getElementById('reps-band-fill');
    const showcase = document.getElementById('reps-showcase');
    const jump = document.getElementById('reps-jump');
    const faces = document.getElementById('reps-faces');
    const count = document.getElementById('reps-count');
    const card = document.getElementById('reps-card');
    const cardName = document.getElementById('reps-name');
    const cardArea = document.getElementById('reps-area');
    const cardDesc = document.getElementById('reps-desc');
    const cardAbout = document.getElementById('reps-about');
    const cardIcon = document.getElementById('reps-icon');
    const media = query => window.matchMedia ? window.matchMedia(query) : { matches: false };
    const mobile = media('(max-width: 768px)');
    const reducedMotion = media('(prefers-reduced-motion: reduce)');

    // Media luna = arco de circunferencia de radio `radius` (px de diseño). Cada avatar mide `ratio`
    // veces el anterior y entre bordes vecinos queda siempre el mismo espacio `gap`; `ring` es el aro
    // del central. side: avatares visibles a cada lado; margin: espacio mínimo hasta el borde.
    // Si falta ancho o alto de pantalla, todo se reduce en proporción.
    const LAYOUTS = {
        desktop: { side: 3, size: 140, ratio: .8, gap: 30, radius: 620, ring: 9, opacity: [1, .94, .84, .72], margin: 36, arrowEdge: 36 },
        mobile: { side: 2, size: 106, ratio: .78, gap: 12, radius: 230, ring: 7, opacity: [1, .92, .78], margin: 10, arrowEdge: 28 }
    };
    const DURATION = 500;
    const AUTOPLAY_MS = 6000;
    const LEAVE_MS = 180;
    const SWIPE_PX = 40;
    const PAD_TOP = 24;
    const PAD_BOTTOM = 20;
    const MIN_SCALE = .6;
    const BREATH = 16;             // aire bajo la ficha cuando todo cabe en pantalla
    const EASE = 'cubic-bezier(.22, .61, .36, 1)';
    const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
    const FACES = 5;
    // Íconos de línea por área (viewBox 24 × 24).
    const ICONS = {
        salud: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="M12 9v6M9 12h6"/>',
        personas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
        reclutamiento: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
        marketing: '<path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z"/><path d="M16.5 8.5a4.5 4.5 0 0 1 0 7M19.5 5.5a8.5 8.5 0 0 1 0 13"/>',
        ingenieria: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
        diseno: '<path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5ZM2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
        clinica: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
        audiovisual: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10 6-3.5v11l-6-3.5"/>',
        contabilidad: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h4"/>',
        estrella: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>'
    };
    const n = people.length;
    // Distancia circular más corta: con 9 personas va de −4 a 4.
    const wrap = k => {
        const m = ((k % n) + n) % n;
        return m > (n - 1) / 2 ? m - n : m;
    };
    const colorOf = person => person.color || '#64748b';

    // Primer nombre + primer apellido ("Erika del Socorro Moreno Quilcate" → "EM").
    function initials(name) {
        const words = String(name).trim().split(/\s+/).filter(word => !PARTICLES.has(word.toLowerCase()));
        if (!words.length) return '';
        const surname = words.length >= 4 ? words[words.length - 2] : words[words.length - 1];
        return (words[0][0] + (words.length > 1 ? surname[0] : '')).toUpperCase();
    }

    function icon(name) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.innerHTML = ICONS[name] || ICONS.estrella;
        return svg;
    }

    let layout = LAYOUTS.desktop;
    let side = 0;
    let geometry = { sizes: [], points: [], angles: [], radius: 0 };
    let current = 0;               // persona de la ficha
    let visual = 0;                // persona que los avatares tienen al centro ahora mismo
    const shown = new Array(n);    // k con el que está dibujado cada avatar
    let stepTimer = 0;
    let cardTimer = 0;
    let autoplayTimer = 0;
    let swipedAt = 0;
    let lastWidth = -1;
    let lastHeight = -1;
    let panelActive = panel.classList.contains('active');
    let hovering = false;
    let focused = false;

    const items = people.map((person, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reps-avatar';
        button.style.setProperty('--rep-color', colorOf(person));
        button.setAttribute('aria-label', `Ver a ${person.nombre}, representante de ${person.area}`);
        const face = document.createElement('span');
        face.className = 'reps-avatar-face';
        const letters = document.createElement('span');
        letters.className = 'reps-avatar-initials';
        letters.setAttribute('aria-hidden', 'true');
        letters.textContent = initials(person.nombre);
        face.append(letters);
        // Foto de la persona; si no hay, la ilustración del área. Las iniciales quedan
        // ocultas debajo y solo se ven si ninguna imagen carga.
        const sources = [person.foto, person.imagen].filter(Boolean);
        if (sources.length) {
            const img = document.createElement('img');
            img.alt = '';
            img.width = 320;
            img.height = 320;
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
            face.classList.add('has-image');
            face.classList.toggle('is-art', !person.foto);
            img.addEventListener('error', () => {
                sources.shift();
                if (sources.length) {
                    face.classList.add('is-art');
                    img.src = sources[0];
                } else {
                    img.remove();
                    face.classList.remove('has-image', 'is-art');
                }
            });
            img.src = sources[0];
            face.append(img);
        }
        // Rótulo con el área que aparece al pasar el mouse sobre los avatares de los lados.
        const tip = document.createElement('span');
        tip.className = 'reps-avatar-tip';
        tip.setAttribute('aria-hidden', 'true');
        tip.textContent = person.area;
        button.append(face, tip);
        button.addEventListener('click', () => {
            if (Date.now() - swipedAt < 400) return;
            goTo(index, 'user');
        });
        orbit.append(button);
        return button;
    });

    // Posiciones sobre el arco (el centro del avatar central es el punto más bajo, (0, 0)).
    // Para cada vecino, el ángulo avanza lo justo para que la cuerda entre centros sea
    // radio + radio + gap: así el espacio entre bordes es igual en todo el arco.
    function arc(scale) {
        const sizes = [];
        const points = [{ x: 0, y: 0 }];
        const angles = [0];
        const radius = layout.radius * scale;
        for (let k = 0; k <= side + 1; k++) sizes.push(layout.size * layout.ratio ** k * scale);
        for (let k = 1; k <= side + 1; k++) {
            const chord = sizes[k - 1] / 2 + sizes[k] / 2 + layout.gap * scale + (k === 1 ? layout.ring : 0);
            const angle = angles[k - 1] + 2 * Math.asin(Math.min(1, chord / (2 * radius)));
            angles.push(angle);
            points.push({ x: radius * Math.sin(angle), y: -radius * (1 - Math.cos(angle)) });
        }
        return { sizes, points, angles, radius };
    }

    const headerOffset = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 90;

    // Elige la escala para que el arco no se salga a los lados y, junto con la ficha, quepa
    // en la pantalla debajo de la barra fija del sitio.
    function measure() {
        layout = mobile.matches ? LAYOUTS.mobile : LAYOUTS.desktop;
        side = Math.min(layout.side, Math.max(0, Math.floor((n - 2) / 2)));
        const width = stage.clientWidth;
        const base = arc(1);
        let scale = 1;
        if (width) {
            const reach = base.points[side].x + base.sizes[side] / 2;
            const tall = -base.points[side].y + base.sizes[side] / 2 + base.sizes[0] / 2;
            const room = window.innerHeight - headerOffset() - card.offsetHeight
                - (parseFloat(getComputedStyle(card).marginTop) || 0) - BREATH - PAD_TOP - PAD_BOTTOM;
            scale = Math.min(1, (width / 2 - layout.margin) / reach, Math.max(MIN_SCALE, room / tall));
        }
        geometry = arc(scale);
        const { sizes, points } = geometry;
        const top = -points[side].y + sizes[side] / 2 + PAD_TOP;
        const height = Math.ceil(top + sizes[0] / 2 + PAD_BOTTOM);
        // Flechas bajo el segundo vecino, sin pegarse al borde.
        const arrowX = side >= 2 ? points[2].x : sizes[0] / 2 + 48;
        stage.style.height = height + 'px';
        stage.style.setProperty('--reps-anchor', top.toFixed(1) + 'px');
        stage.style.setProperty('--reps-size', sizes[0].toFixed(1) + 'px');
        stage.style.setProperty('--reps-arrow-x', Math.min(arrowX, width ? width / 2 - layout.arrowEdge : arrowX).toFixed(1) + 'px');
        if (width) drawBand(width, height, top);
    }

    // Banda difusa detrás de los avatares: el mismo arco de circunferencia.
    function drawBand(width, height, top) {
        const { radius, angles } = geometry;
        const end = (angles[side] + angles[side + 1]) / 2;
        const x = Math.min(radius * Math.sin(end), width / 2);
        const y = -radius * (1 - Math.cos(end));
        band.setAttribute('viewBox', `${-width / 2} ${-top} ${width} ${height}`);
        bandPath.setAttribute('d', `M${(-x).toFixed(1)} ${y.toFixed(1)} A${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 0 ${x.toFixed(1)} ${y.toFixed(1)}`);
        bandPath.setAttribute('stroke-width', String(Math.round(geometry.sizes[0] * 1.15)));
        bandFill.setAttribute('x1', String(-x));
        bandFill.setAttribute('x2', String(x));
    }

    // El aro de marca (is-center) es solo para la persona elegida, no para quien pasa por el centro al girar.
    function place(item, k) {
        const distance = Math.abs(k);
        const hidden = distance > side;
        // Quien sale del arco se dibuja un lugar más allá del último visible (más pequeño) y se desvanece.
        const slot = Math.min(distance, side + 1);
        const size = geometry.sizes[slot];
        const x = Math.sign(k) * geometry.points[slot].x;
        const y = geometry.points[slot].y;
        // Tamaño real (no scale()) para que las iniciales y las fotos se vean nítidas.
        item.style.width = size.toFixed(1) + 'px';
        item.style.height = size.toFixed(1) + 'px';
        item.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        item.style.setProperty('--reps-opacity', hidden ? '0' : String(layout.opacity[distance]));
        item.style.zIndex = String(20 - Math.min(distance, 19));
        item.classList.toggle('is-hidden', hidden);
        item.classList.toggle('is-center', k === 0 && item === items[current]);
    }

    // Dibuja los avatares con `pos` al centro. step es el desplazamiento de k en este paso
    // (−1 o 1); con step 0 todo se coloca sin animación.
    function render(pos, step, ms, easing) {
        const entering = [];
        items.forEach((item, i) => {
            const target = wrap(i - pos);
            let k = target;
            if (step && shown[i] !== undefined) {
                const moved = shown[i] + step;
                if (Math.abs(moved) <= side + 1) k = moved;
                // Quien da la vuelta aparece oculto justo detrás del borde y desde ahí entra.
                else if (Math.abs(target) <= side) entering.push([item, target - step]);
            }
            shown[i] = k;
        });
        if (step) {
            entering.forEach(([item, k]) => {
                item.style.transition = 'none';
                place(item, k);
            });
            if (entering.length) void orbit.offsetWidth;
            orbit.style.setProperty('--reps-ms', ms + 'ms');
            orbit.style.setProperty('--reps-ease', easing);
            items.forEach((item, i) => {
                item.style.transition = '';
                place(item, shown[i]);
            });
        } else {
            items.forEach((item, i) => {
                item.style.transition = 'none';
                place(item, shown[i]);
            });
            void orbit.offsetWidth;
            items.forEach(item => { item.style.transition = ''; });
        }
    }

    // Animación de llegada al centro: rebote del avatar y una onda del aro.
    function arrive() {
        items.forEach(item => item.classList.remove('is-arriving'));
        const item = items[current];
        void item.offsetWidth;
        item.classList.add('is-arriving');
    }

    // Gira paso a paso para que los avatares recorran la curva (no la crucen en línea recta).
    function spin() {
        clearTimeout(stepTimer);
        const delta = wrap(current - visual);
        if (!delta) return;
        if (reducedMotion.matches || !panelActive) {
            visual = current;
            render(visual, 0);
            arrive();
            return;
        }
        const steps = Math.abs(delta);
        const direction = Math.sign(delta);
        const ms = Math.round(DURATION / steps);
        let done = 0;
        const next = () => {
            done += 1;
            visual = (visual + direction + n) % n;
            const easing = steps === 1 ? EASE : done === 1 ? 'cubic-bezier(.4, 0, 1, 1)' : done === steps ? 'cubic-bezier(0, 0, .2, 1)' : 'linear';
            render(visual, -direction, ms, easing);
            stepTimer = done < steps ? setTimeout(next, ms) : setTimeout(arrive, Math.round(ms * .5));
        };
        next();
    }

    function markCurrent() {
        items.forEach((item, i) => {
            item.tabIndex = i === current ? 0 : -1;
            if (i === current) item.setAttribute('aria-current', 'true');
            else item.removeAttribute('aria-current');
        });
    }

    // Ficha: sale hacia arriba y entra escalonada.
    function updateCard(source) {
        const person = people[current];
        // Solo se anuncia lo que pide la persona, no cada avance automático.
        card.setAttribute('aria-live', source === 'auto' ? 'off' : 'polite');
        const fill = () => {
            root.style.setProperty('--reps-accent', colorOf(person));
            card.style.setProperty('--rep-color', colorOf(person));
            cardName.textContent = person.nombre;
            cardArea.textContent = person.area;
            cardIcon.replaceChildren(icon(person.icono));
            cardDesc.textContent = person.descripcion;
            cardAbout.textContent = person.resumen || '';
            cardAbout.parentElement.hidden = !person.resumen;
            root.classList.remove('is-leaving', 'is-entering');
            void root.offsetWidth;
            root.classList.add('is-entering');
        };
        clearTimeout(cardTimer);
        if (source === 'init' || reducedMotion.matches || !panelActive) {
            fill();
            return;
        }
        root.classList.remove('is-entering');
        root.classList.add('is-leaving');
        cardTimer = setTimeout(fill, LEAVE_MS);
    }

    function goTo(index, source) {
        const target = ((index % n) + n) % n;
        if (target === current) return;
        current = target;
        markCurrent();
        updateCard(source);
        spin();
        if (source !== 'auto') syncAutoplay();
    }

    // La línea de la ficha se llena en 6 s mientras corre el avance automático (is-playing).
    function syncAutoplay() {
        clearInterval(autoplayTimer);
        autoplayTimer = 0;
        root.classList.remove('is-playing');
        const play = n > 1 && panelActive && !hovering && !focused && !reducedMotion.matches && !document.hidden;
        if (!play) return;
        void root.offsetWidth;
        root.classList.add('is-playing');
        autoplayTimer = setInterval(() => goTo(current + 1, 'auto'), AUTOPLAY_MS);
    }

    // Se recalcula si cambia el ancho o si el alto cambia de verdad (más de 120 px): así la barra de
    // direcciones del celular, que aparece y se esconde al desplazarse, no hace saltar el carrusel.
    function relayout() {
        const width = stage.clientWidth;
        const height = window.innerHeight;
        if (!width || (width === lastWidth && Math.abs(height - lastHeight) <= 120)) return;
        lastWidth = width;
        lastHeight = height;
        measure();
        render(visual, 0);
    }

    // Resumen del encabezado: las primeras caras y cuántas áreas hay.
    function fillSummary() {
        const areas = new Set(people.map(person => person.area)).size;
        count.textContent = `${areas} ${areas === 1 ? 'área' : 'áreas'}`;
        faces.replaceChildren(...people.slice(0, FACES).map((person, index) => {
            const face = document.createElement('span');
            face.className = 'reps-summary-face';
            face.style.setProperty('--rep-color', colorOf(person));
            face.style.setProperty('--i', String(index));
            face.textContent = initials(person.nombre);
            return face;
        }));
    }

    // Flecha del encabezado: baja con suavidad hasta el carrusel y deja el foco en la persona del centro.
    // Si en pantalla caben la flecha, el carrusel y la ficha, se centra todo ese bloque; si no, el
    // carrusel queda justo bajo la barra fija (la flecha se esconde detrás, ver más abajo).
    jump.addEventListener('click', event => {
        event.preventDefault();
        const header = headerOffset();
        const room = window.innerHeight - header;
        const box = showcase.getBoundingClientRect();
        const lead = box.top - jump.getBoundingClientRect().top + 8;
        const top = box.height + lead <= room ? header + lead + (room - box.height - lead) / 2 : header;
        window.scrollTo({ top: window.scrollY + box.top - top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        items[current].focus({ preventScroll: true });
    });
    // La flecha se desvanece cuando pasa por debajo de la barra fija, para que no asome cortada.
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            jump.classList.toggle('is-tucked', entry.intersectionRatio < 1 && entry.boundingClientRect.top < headerOffset());
        }, { rootMargin: `-${headerOffset()}px 0px 0px 0px`, threshold: [0, .5, 1] }).observe(jump);
    }

    root.querySelectorAll('[data-reps-step]').forEach(button => {
        button.addEventListener('click', () => goTo(current + Number(button.dataset.repsStep), 'user'));
    });
    root.addEventListener('keydown', event => {
        const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const onAvatar = items.includes(document.activeElement);
        goTo(current + direction, 'user');
        if (onAvatar) items[current].focus({ preventScroll: true });
    });

    // Deslizar con el dedo; el desplazamiento vertical de la página sigue funcionando (touch-action: pan-y).
    let touch = null;
    stage.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') return;
        touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    stage.addEventListener('pointerup', event => {
        if (!touch || event.pointerId !== touch.id) return;
        const dx = event.clientX - touch.x;
        const dy = event.clientY - touch.y;
        touch = null;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
        swipedAt = Date.now();
        goTo(current + (dx < 0 ? 1 : -1), 'user');
    });
    stage.addEventListener('pointercancel', () => { touch = null; });

    // Pausas del avance automático: mouse encima, foco de teclado dentro, pestaña inactiva,
    // movimiento reducido o página en segundo plano.
    root.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse') return;
        hovering = true;
        syncAutoplay();
    });
    root.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse') return;
        hovering = false;
        syncAutoplay();
    });
    root.addEventListener('focusin', event => {
        try {
            focused = event.target.matches(':focus-visible');
        } catch {
            focused = true;
        }
        syncAutoplay();
    });
    root.addEventListener('focusout', event => {
        focused = focused && root.contains(event.relatedTarget);
        syncAutoplay();
    });
    document.addEventListener('kja:about-panel', event => {
        const wasActive = panelActive;
        panelActive = event.detail?.panel === 'representantes';
        if (panelActive) {
            relayout();
            if (!wasActive) arrive();
        }
        syncAutoplay();
    });
    document.addEventListener('visibilitychange', syncAutoplay);
    reducedMotion.addEventListener?.('change', syncAutoplay);
    mobile.addEventListener?.('change', () => {
        lastWidth = -1;
        relayout();
    });
    // El ancho del escenario lo vigila ResizeObserver; el alto de la ventana, el evento resize.
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(stage);
    window.addEventListener('resize', relayout, { passive: true });

    measure();
    render(visual, 0);
    markCurrent();
    fillSummary();
    updateCard('init');
    syncAutoplay();
})();
