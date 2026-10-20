/* Rutas de exploración, selección de cursos y agenda de octubre. */
(function () {
    'use strict';
    const coursesGrid = document.getElementById('formation-courses-grid');
    const pagination = document.getElementById('formation-pagination');
    if (!coursesGrid || typeof KJA_FORMATION === 'undefined') return;
    if (document.body.classList.contains('course-area-page')) return;

    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const photo = name => 'images/cursos/photos/' + name + '.webp';
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
    const waUrl = message => 'https://wa.me/51988918238?text=' + encodeURIComponent(message);

    const packIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path class="formation-pack-plus" d="M12 5v14M5 12h14"/><path class="formation-pack-check" d="m5 12 5 5 9-10"/></svg>';
    const featuredStar ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 3 2.2 5.8L21 11l-5.8 2.2L13 19l-2.2-5.8L5 11l5.8-2.2L13 3ZM5 2v4M3 4h4M4 16v5M1.5 18.5h5"/></svg>';
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
        '<button type="button" class="formation-action" data-formation-detail="' + escape(course.id) + '" aria-haspopup="dialog" aria-label="Ver curso: ' + escape(course.fullTitle || course.title) + '">Ver curso ' + arrow + '</button>' +
        // Oculto hasta que cursos-pack-controller.js conecte el pack.
        '<button type="button" class="formation-pack-add" data-offer-add="' + escape(course.id) + '" aria-pressed="false" hidden>' + packIcon + '<span class="formation-pack-label">Agregar al pack</span><span class="formation-pack-sr"> · ' + escape(course.fullTitle || course.title) + '</span></button></article>'
    ).join('');

    const filterButtons = document.getElementById('formation-course-filters');
    filterButtons.innerHTML = '<button type="button" data-formation-route="" aria-pressed="false">Todas las áreas</button>' + KJA_FORMATION.routes.map(route => '<button type="button" data-formation-route="' + escape(route.id) + '" aria-pressed="false">' + escape(route.title) + '</button>').join('');
    const pageSizeForViewport = () => window.matchMedia('(max-width: 700px)').matches ? 4 : 6;
    let pageSize = pageSizeForViewport();
    let currentPage = 1;
    let activeRoute = '';
    const comingSoonCard = () => '<article class="formation-course formation-course-soon" aria-label="Más cursos próximamente"><div class="formation-course-soon-copy"><h3>Más cursos próximamente</h3><p>Estamos preparando nueva formación para esta área.</p></div></article>';
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
    const closeOnBackdrop = modal => {
        modal.addEventListener('click', event => {
            if (event.target !== modal || event.detail === 0) return;
            const bounds = modal.getBoundingClientRect();
            const clickedOutside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
            if (clickedOutside) modal.close();
        });
    };
    closeOnBackdrop(dialog);
    let detailOpener;
    function openCourseDetail(event) {
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
    }
    coursesGrid.addEventListener('click', openCourseDetail);
    document.getElementById('formation-detail-close').addEventListener('click', () => dialog.close());
    // Escape queda bloqueado; el detalle se cierra con la X o al pulsar fuera.
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.addEventListener('close', () => detailOpener?.focus({ preventScroll: true }));

})();
