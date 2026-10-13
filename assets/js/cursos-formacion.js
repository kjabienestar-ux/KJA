/* Rutas de exploración, selección de cursos y agenda de octubre. */
(function () {
    'use strict';
    const routesGrid = document.getElementById('formation-routes-grid');
    const coursesGrid = document.getElementById('formation-courses-grid');
    const pagination = document.getElementById('formation-pagination');
    const workshopsList = document.getElementById('formation-workshops');
    if (!routesGrid || !coursesGrid || !workshopsList || typeof KJA_FORMATION === 'undefined') return;
    if (document.body.classList.contains('course-area-page')) {
        document.getElementById('rutas-formacion').hidden = true;
        return;
    }

    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const photo = name => 'images/cursos/photos/' + name + '.webp';
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
    const paths = {
        brain: '<path d="M12 4v16M12 5C9 1 5 3 5 6c-4 0-4 6-1 7-2 3 0 6 3 6 0 3 5 3 5 0M12 5c3-4 7-2 7 1 4 0 4 6 1 7 2 3 0 6-3 6 0 3-5 3-5 0M5 6c0 2 1 3 3 3M4 13c2 0 3 1 3 3M19 6c0 2-1 3-3 3M20 13c-2 0-3 1-3 3"/>',
        child: '<circle cx="12" cy="12" r="8"/><path d="M9 4c0-3 5-3 5 0M4 11c-4-2-4 5 0 4M20 11c4-2 4 5 0 4M8 11h1M15 11h1M9 15c2 2 4 2 6 0"/>',
        report: '<path d="M13 2H5v20h14V8l-6-6Zm0 0v6h6M8 12h8M8 16h5"/><circle cx="17" cy="18" r="3"/><path d="m15 21-1 2M19 21l1 2"/>',
        people: '<circle cx="9" cy="7" r="3"/><circle cx="18" cy="9" r="2"/><path d="M2 21v-4a6 6 0 0 1 12 0v4H2ZM16 15c4-2 7 1 7 4v2h-6"/>',
        chat: '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 17-5ZM8 10h8M8 14h5"/>',
        chart: '<path d="M3 3v18h18M7 17v-5M12 17V8M17 17V4"/>'
    };
    const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.report) + '</svg>';
    const waUrl = message => 'https://wa.me/51988918238?text=' + encodeURIComponent(message);

    routesGrid.innerHTML = KJA_FORMATION.routes.map(route =>
        '<article class="formation-route formation-tone-' + escape(route.tone) + '" data-formation-route-card="' + escape(route.id) + '" tabindex="0" aria-labelledby="route-title-' + escape(route.id) + '" aria-describedby="route-description-' + escape(route.id) + '">' +
        '<img src="' + escape(photo(route.image)) + '" width="1200" height="600" alt="" loading="lazy" decoding="async">' +
        '<span class="formation-route-icon">' + icon(route.icon) + '</span><div class="formation-route-copy"><h3 id="route-title-' + escape(route.id) + '">' + escape(route.title) + '</h3><div class="formation-route-summary"><p id="route-description-' + escape(route.id) + '">' + escape(route.description) + '</p></div></div></article>'
    ).join('');

    const featuredStar = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 3 2.2 5.8L21 11l-5.8 2.2L13 19l-2.2-5.8L5 11l5.8-2.2L13 3ZM5 2v4M3 4h4M4 16v5M1.5 18.5h5"/></svg>';
    const shuffled = [...KJA_FORMATION.courses];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    // Random selection with one featured course; the full catalog spreads all three.
    function distributeFeatured(courses) {
        const featured = courses.filter(course => course.featured);
        const ordinary = courses.filter(course => !course.featured);
        if (!featured.length) return courses;
        const positions = courses.length === 7 && featured.length === 3 ? [2, 4, 6] : featured.map((course, index) => Math.floor((index + 1) * courses.length / featured.length) - 1);
        const slots = new Set(positions);
        let featuredIndex = 0, ordinaryIndex = 0;
        return courses.map((course, index) => slots.has(index) ? featured[featuredIndex++] : ordinary[ordinaryIndex++]);
    }
    coursesGrid.innerHTML = shuffled.map(course =>
        '<article class="formation-course' + (course.featured ? ' formation-course-featured formation-tone-' + escape(course.tone) : '') + '" data-formation-course="' + escape(course.id) + '">' +
        '<div class="formation-course-media"><img src="' + escape(photo(course.image)) + '" width="1200" height="600" alt="" loading="lazy" decoding="async">' +
        (course.featured ? '<button type="button" class="formation-course-demand" aria-label="Curso destacado" aria-pressed="false"><span class="formation-featured-surface">' + featuredStar + '<span class="formation-featured-label">Curso destacado</span></span></button>' : '') + '</div>' +
        '<div class="formation-course-title"><h3>' + escape(course.title) + '</h3></div>' +
        '<button type="button" class="formation-action" data-formation-detail="' + escape(course.id) + '" aria-haspopup="dialog" aria-label="Ver curso: ' + escape(course.fullTitle || course.title) + '">Ver curso ' + arrow + '</button></article>'
    ).join('');

    const filterButtons = document.getElementById('formation-course-filters');
    filterButtons.innerHTML = '<button type="button" data-formation-route="" aria-pressed="false">Todas las áreas</button>' + KJA_FORMATION.routes.map(route => '<button type="button" data-formation-route="' + escape(route.id) + '" aria-pressed="false">' + escape(route.title) + '</button>').join('');
    const pageSizeForViewport = () => window.matchMedia('(max-width: 700px)').matches ? 4 : 6;
    let pageSize = pageSizeForViewport();
    let currentPage = 1;
    let activeRoute = '';
    const comingSoonCard = () => '<article class="formation-course formation-course-soon" aria-label="Más cursos próximamente"><div class="formation-course-soon-copy"><span aria-hidden="true">+</span><h3>Más cursos próximamente</h3><p>Estamos preparando nueva formación para esta área.</p></div></article>';
    function renderPagination(totalPages) {
        pagination.hidden = totalPages <= 1;
        if (totalPages <= 1) { pagination.innerHTML = ''; return; }
        const pageButton = page => '<button type="button" data-formation-page="' + page + '"' + (page === currentPage ? ' aria-current="page"' : '') + ' aria-label="Página ' + page + '">' + page + '</button>';
        pagination.innerHTML = '<button type="button" class="formation-pagination-arrow" data-formation-page="prev" aria-label="Página anterior"' + (currentPage === 1 ? ' disabled' : '') + '>' + arrow + '</button>' +
            Array.from({ length: totalPages }, (_, index) => pageButton(index + 1)).join('') +
            '<button type="button" class="formation-pagination-arrow" data-formation-page="next" aria-label="Página siguiente"' + (currentPage === totalPages ? ' disabled' : '') + '>' + arrow + '</button>';
    }
    function applyRoute(id, resetPage = false) {
        const route = KJA_FORMATION.routes.find(item => item.id === id);
        const available = shuffled.filter(course => !route || course.routes.includes(route.id));
        const totalPages = Math.max(1, Math.ceil(available.length / pageSize));
        if (resetPage) currentPage = 1;
        currentPage = Math.min(currentPage, totalPages);
        activeRoute = route?.id || '';
        const pageCourses = distributeFeatured(available).slice((currentPage - 1) * pageSize, currentPage * pageSize);
        KJA_FORMATION.courses.forEach(course => coursesGrid.querySelector('[data-formation-course="' + course.id + '"]').hidden = true);
        coursesGrid.querySelectorAll('.formation-course-soon').forEach(card => card.remove());
        pageCourses.forEach(course => {
            const card = coursesGrid.querySelector('[data-formation-course="' + course.id + '"]');
            card.hidden = false;
            coursesGrid.append(card);
        });
        coursesGrid.insertAdjacentHTML('beforeend', Array.from({ length: pageSize - pageCourses.length }, comingSoonCard).join(''));
        document.getElementById('formation-results').textContent = (route ? route.title : 'Todas las áreas') + ' · ' + available.length + ' cursos';
        filterButtons.querySelectorAll('[data-formation-route]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.formationRoute === (route?.id || '')));
        });
        renderPagination(totalPages);
    }
    filterButtons.addEventListener('click', event => {
        const button = event.target.closest('[data-formation-route]');
        if (!button) return;
        const url = new URL(window.location.href);
        if (button.dataset.formationRoute) url.searchParams.set('ruta', button.dataset.formationRoute);
        else url.searchParams.delete('ruta');
        url.hash = 'catalogo';
        history.pushState(null, '', url.pathname + url.search + url.hash);
        applyRoute(button.dataset.formationRoute, true);
    });
    window.addEventListener('resize', () => {
        const nextPageSize = pageSizeForViewport();
        if (nextPageSize === pageSize) return;
        pageSize = nextPageSize;
        currentPage = 1;
        applyRoute(activeRoute);
    });
    pagination.addEventListener('click', event => {
        const button = event.target.closest('[data-formation-page]');
        if (!button) return;
        const page = button.dataset.formationPage;
        const available = shuffled.filter(course => !activeRoute || course.routes.includes(activeRoute));
        const totalPages = Math.max(1, Math.ceil(available.length / pageSize));
        currentPage = page === 'prev' ? Math.max(1, currentPage - 1) : page === 'next' ? Math.min(totalPages, currentPage + 1) : Number(page);
        applyRoute(activeRoute);
        document.getElementById('formation-courses-grid').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    window.addEventListener('popstate', () => { currentPage = 1; applyRoute(new URLSearchParams(window.location.search).get('ruta')); });
    const initialRoute = new URLSearchParams(window.location.search).get('ruta');
    applyRoute(initialRoute);

    const dialog = document.getElementById('formation-course-dialog');
    let detailOpener;
    coursesGrid.addEventListener('click', event => {
        const badge = event.target.closest('.formation-course-demand');
        if (badge) {
            const expanded = badge.classList.toggle('is-expanded');
            badge.setAttribute('aria-pressed', String(expanded));
            return;
        }
        const button = event.target.closest('[data-formation-detail]');
        if (!button) return;
        const course = KJA_FORMATION.courses.find(item => item.id === button.dataset.formationDetail);
        if (!course) return;
        detailOpener = button;
        document.getElementById('formation-detail-title').textContent = course.fullTitle || course.title;
        document.getElementById('formation-detail-image').src = photo(course.image);
        document.getElementById('formation-detail-topics').innerHTML = course.topics.map(topic => '<li>' + escape(topic) + '</li>').join('');
        document.getElementById('formation-detail-consult').href = waUrl('Hola KJA, quisiera información sobre el curso «' + (course.fullTitle || course.title) + '». ¿Cuáles son las próximas fechas, modalidad, horarios y precios?');
        dialog.showModal();
    });
    document.getElementById('formation-detail-close').addEventListener('click', () => dialog.close());
    // Escape se cancela: el detalle solo se cierra desde su control visible.
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.addEventListener('close', () => detailOpener?.focus({ preventScroll: true }));

    workshopsList.innerHTML = KJA_FORMATION.workshops.map(workshop =>
        '<li data-workshop-id="' + escape(workshop.id) + '"><button type="button" class="formation-workshop-title" data-workshop-detail="' + escape(workshop.id) + '" aria-haspopup="dialog" aria-label="Ver taller: ' + escape(workshop.title) + '">' + escape(workshop.title) + '</button></li>'
    ).join('');
    const more = document.getElementById('formation-workshops-more');
    const prev = document.getElementById('formation-workshops-prev');
    const next = document.getElementById('formation-workshops-next');
    const horizontal = () => window.matchMedia('(max-width: 1000px)').matches;
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function moveWorkshops(direction) {
        const sideways = horizontal();
        const distance = Math.max(1, (sideways ? workshopsList.clientWidth : workshopsList.clientHeight) * .85);
        workshopsList.scrollBy({ left: sideways ? direction * distance : 0, top: sideways ? 0 : direction * distance, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
    function updateScrollControls() {
        const sideways = horizontal();
        const position = sideways ? workshopsList.scrollLeft : workshopsList.scrollTop;
        const max = sideways ? workshopsList.scrollWidth - workshopsList.clientWidth : workshopsList.scrollHeight - workshopsList.clientHeight;
        prev.disabled = position <= 1;
        next.disabled = position >= max - 1;
    }
    prev.addEventListener('click', () => moveWorkshops(-1));
    next.addEventListener('click', () => moveWorkshops(1));
    workshopsList.addEventListener('scroll', updateScrollControls, { passive: true });
    window.addEventListener('resize', updateScrollControls);
    workshopsList.addEventListener('keydown', event => {
        if (event.target !== workshopsList) return;
        const forward = horizontal() ? 'ArrowRight' : 'ArrowDown';
        const back = horizontal() ? 'ArrowLeft' : 'ArrowUp';
        if (event.key === forward || event.key === back) { event.preventDefault(); moveWorkshops(event.key === forward ? 1 : -1); }
    });
    if (!KJA_FORMATION.workshops.length) {
        workshopsList.innerHTML = '<li class="formation-agenda-empty">La programación está en preparación. Consulta con nuestro equipo.</li>';
        more.hidden = true;
        prev.hidden = next.hidden = true;
    } else {
        more.innerHTML = 'Ver todos los talleres (' + KJA_FORMATION.workshops.length + ') ' + arrow;
        more.addEventListener('click', () => {
            workshopsList.focus({ preventScroll: true });
            moveWorkshops(1);
        });
    }
    updateScrollControls();

    const workshopDialog = document.getElementById('formation-workshop-dialog');
    let workshopOpener;
    workshopsList.addEventListener('click', event => {
        const button = event.target.closest('[data-workshop-detail]');
        if (!button) return;
        const workshop = KJA_FORMATION.workshops.find(item => item.id === button.dataset.workshopDetail);
        if (!workshop) return;
        workshopOpener = button;
        document.getElementById('formation-workshop-title').textContent = workshop.title;
        document.getElementById('formation-workshop-image').src = photo(workshop.image);
        document.getElementById('formation-workshop-note').textContent = (workshop.note ? workshop.note + '. ' : '') + 'Consulta las próximas fechas y disponibilidad.';
        document.getElementById('formation-workshop-consult').href = waUrl('Hola KJA, quisiera consultar las próximas fechas y disponibilidad del taller «' + workshop.title + '».');
        workshopDialog.showModal();
    });
    document.getElementById('formation-workshop-close').addEventListener('click', () => workshopDialog.close());
    // Escape se cancela: el taller solo se cierra desde su control visible.
    workshopDialog.addEventListener('cancel', event => event.preventDefault());
    workshopDialog.addEventListener('close', () => workshopOpener?.focus({ preventScroll: true }));
})();
