(function () {
    'use strict';

    const section = document.getElementById('cursos-gratuitos');
    const grid = document.getElementById('free-courses-grid');
    const dialog = document.getElementById('free-library-dialog');
    if (!section || section.hidden || !grid || !dialog || typeof FREE_COURSE_LIBRARY === 'undefined') return;

    const isWorkshop = section.dataset.libraryKind === 'workshop';
    const singular = isWorkshop ? 'taller' : 'curso';
    const plural = isWorkshop ? 'talleres' : 'cursos';
    const catalogUrl = isWorkshop ? 'talleres.html#agenda-talleres' : 'cursos.html#catalogo';
    const content = document.getElementById('free-library-content');
    const title = document.getElementById('free-library-title');
    const status = document.getElementById('free-library-status');
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const play = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9 5 11 7-11 7V5Z"/></svg>';
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
    const back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
    const book = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1V4Z"/></svg>';
    const clock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    const external = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
    const accents = '<svg class="free-course-accent free-course-accent--play" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="m13 15-2-9m10 11 3-12m3 19 9-6"/></svg>' +
        '<svg class="free-course-accent free-course-accent--photo" viewBox="0 0 32 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m18 9-6-5M16 20H6m12 10-7 5"/></svg>';
    const preview = FREE_COURSE_LIBRARY.preview !== false;
    const courses = Array.isArray(FREE_COURSE_LIBRARY.courses) ? FREE_COURSE_LIBRARY.courses : [];
    // Las tarjetas de la página: primero los cursos marcados como destacados y luego el resto, hasta 3.
    const ranked = courses.map((course, index) => ({ course, index }));
    const featured = ranked.filter(item => item.course.destacado).concat(ranked.filter(item => !item.course.destacado)).slice(0, 3);
    // En Cursos la biblioteca muestra tarjetas con portada; Talleres conserva su lista.
    const cardLibrary = !isWorkshop;
    if (cardLibrary) dialog.classList.add('free-library-dialog--cursos');
    let returnFocus;

    function driveSource(value) {
        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return null;
            const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
            const id = match ? match[1] : url.pathname === '/open' ? url.searchParams.get('id') : null;
            if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
            return { embed: 'https://drive.google.com/file/d/' + id + '/preview', open: 'https://drive.google.com/file/d/' + id + '/view' };
        } catch { return null; }
    }

    function renderRecordedCard(course, index) {
        const source = !preview && driveSource(course.driveUrl);
        const action = source ? 'Ver curso: ' : preview ? 'Consultar vista previa: ' : 'Consultar disponibilidad: ';
        return '<article class="free-course-card recorded-item"><button type="button" class="recorded-card" data-free-course="' + index + '" aria-haspopup="dialog" aria-label="' + action + escape(course.title) + '">' +
            '<span class="recorded-image"><img src="' + escape(course.cover) + '" alt="" width="1200" height="600" loading="lazy" decoding="async"><span class="recorded-free">' + book + 'Gratis</span></span>' +
            '<span class="recorded-copy"><span class="recorded-status"><span aria-hidden="true"></span>' + (source ? 'Disponible' : 'Próximamente') + '</span><strong class="recorded-title">' + escape(course.title) + '</strong><span class="recorded-description">' + escape(course.description || '') + '</span><span class="recorded-bottom"><span class="recorded-meta">' + clock + 'A tu ritmo</span><span class="recorded-play" aria-hidden="true">' + play + '</span></span></span></button></article>';
    }

    function renderCard(course, index) {
        if (!isWorkshop) return renderRecordedCard(course, index);
        const source = !preview && driveSource(course.driveUrl);
        const availability = source ? 'Grabado' : 'Próximamente';
        const action = source ? 'Ir al ' + singular : preview ? 'Ver vista previa' : 'Ver disponibilidad';
        return '<article class="free-course-card"><button type="button" class="free-course-open" data-free-course="' + index + '" aria-haspopup="dialog" aria-label="' + (source ? 'Ver ' + singular + ': ' : 'Consultar vista previa: ') + escape(course.title) + '">' +
            '<img src="' + escape(course.cover) + '" alt="" width="1200" height="600" loading="lazy" decoding="async">' +
            '<span class="free-course-badges"><span class="free-course-badge">' + book + 'Gratis</span><span class="free-course-badge free-course-badge--status">' + availability + '</span></span>' +
            '<span class="free-course-title">' + escape(course.title) + '</span><span class="free-course-meta">' + clock + 'A tu ritmo</span><span class="free-course-play">' + play + '</span>' + accents +
            '<span class="free-course-hover" aria-hidden="true"><strong>' + escape(course.title) + '</strong><span class="free-course-hover-action">' + play + action + '</span></span></button></article>';
    }

    function courseButtons() {
        return courses.map((course, index) => '<button type="button" class="free-library-item" data-free-course="' + index + '"><img src="' + escape(course.cover) + '" alt="" width="160" height="100" loading="lazy"><span><strong>' + escape(course.title) + '</strong><small>' + (preview ? 'Título de ejemplo · Próximamente' : driveSource(course.driveUrl) ? 'Gratis · Grabado' : 'Próximamente') + '</small></span><span class="free-library-item-play">' + play + '</span></button>').join('');
    }

    function libraryCards() {
        return '<div class="free-library-cards">' + courses.map((course, index) => {
            const source = !preview && driveSource(course.driveUrl);
            return '<button type="button" class="free-library-card" data-free-course="' + index + '" aria-label="' + (source ? 'Ver curso: ' : 'Consultar: ') + escape(course.title) + '">' +
                '<span class="free-library-card-image"><img src="' + escape(course.cover) + '" alt="" width="800" height="450" loading="lazy" decoding="async"><span class="recorded-free">' + book + 'Gratis</span></span>' +
                '<span class="free-library-card-copy"><span class="recorded-status"><span aria-hidden="true"></span>' + (source ? 'Disponible' : 'Próximamente') + '</span><strong>' + escape(course.title) + '</strong><span class="free-library-card-desc">' + escape(course.description || '') + '</span></span></button>';
        }).join('') + '</div>';
    }

    // Materiales del curso (PDF, PPT, video extra): enlaces de Drive que se abren en otra pestaña.
    function courseMaterials(course) {
        const items = (Array.isArray(course.materiales) ? course.materiales : [])
            .map(item => ({ item, source: item && item.titulo ? driveSource(item.url) : null }))
            .filter(entry => entry.source);
        if (!items.length) return '';
        return '<section class="free-course-materials" aria-labelledby="free-course-materials-title"><h3 id="free-course-materials-title">Materiales del ' + singular + ' <span>' + items.length + '</span></h3><ul>' +
            items.map(({ item, source }) => {
                const type = String(item.tipo || 'Archivo');
                return '<li><a class="free-course-material" href="' + source.open + '" target="_blank" rel="noopener noreferrer" aria-label="' + escape(item.titulo) + ' (' + escape(type) + ', se abre en otra pestaña)">' +
                    '<span class="free-course-material-type free-course-material-type--' + type.toLowerCase().replace(/[^a-z]/g, '') + '" aria-hidden="true">' + escape(type.toUpperCase()) + '</span>' +
                    '<span class="free-course-material-name">' + escape(item.titulo) + '</span><span class="free-course-material-action" aria-hidden="true"><span>Abrir</span>' + external + '</span></a></li>';
            }).join('') + '</ul></section>';
    }

    function openDialog(trigger) {
        if (!dialog.open) {
            returnFocus = trigger;
            dialog.showModal();
        }
        document.getElementById('free-library-close').focus();
    }

    function showLibrary(trigger) {
        title.textContent = 'Biblioteca gratuita';
        status.textContent = preview ? 'Vista previa' : cardLibrary && courses.length ? courses.length + ' ' + plural + ' gratuitos · A tu ritmo' : 'Aprende a tu ritmo';
        content.innerHTML = (preview ? '<p class="free-library-notice">Estamos preparando la biblioteca. Estos títulos son ejemplos de cómo se presentarán los ' + plural + '; todavía no hay videos disponibles.</p>' : '') +
            (courses.length ? (cardLibrary ? libraryCards() : '<div class="free-library-list">' + courseButtons() + '</div>') : '<p class="free-library-notice">Estamos preparando nuevos ' + plural + ' gratuitos. Vuelve pronto para descubrirlos.</p>');
        dialog.scrollTop = 0;
        openDialog(trigger);
    }

    function showCourse(index, trigger) {
        const course = courses[index];
        if (!course) return;
        const source = !preview && driveSource(course.driveUrl);
        const materials = preview ? '' : courseMaterials(course);
        title.textContent = course.title;
        status.textContent = source ? 'Gratis · Grabado' : preview ? 'Vista previa · Título de ejemplo' : 'Próximamente';
        content.innerHTML = (cardLibrary && courses.length > 1 ? '<button type="button" class="free-library-back" data-free-back>' + back + 'Todos los ' + plural + '</button>' : '') + (source ?
            '<div class="free-course-player"><iframe src="' + source.embed + '" title="' + escape(course.title) + '" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="free-course-player-help">Si el video no se reproduce, <a href="' + source.open + '" target="_blank" rel="noopener noreferrer">abrir el video en otra pestaña</a>.</p>' :
            '<div class="free-course-coming"><span class="free-course-coming-play" aria-hidden="true">' + play + '</span><h3>Estamos preparando este espacio</h3><p>' + (preview ? 'El título y la portada son ilustrativos. Publicaremos los ' + plural + ' reales cuando la biblioteca esté disponible.' : materials ? 'El video de este ' + singular + ' todavía no está disponible. Mientras tanto, puedes revisar sus materiales.' : 'Este ' + singular + ' todavía no está disponible. Puedes seguir explorando la formación de KJA.') + '</p><a href="' + catalogUrl + '" class="free-course-catalog-link">Explorar ' + plural + ' ' + arrow + '</a></div>') + materials;
        dialog.scrollTop = 0;
        openDialog(trigger);
    }

    grid.innerHTML = featured.map(item => renderCard(item.course, item.index)).join('') || '<p class="free-library-notice">Nuevos ' + plural + ' gratuitos, próximamente.</p>';
    const more = document.getElementById('free-library-more');
    if (more && courses.length > featured.length) {
        more.hidden = false;
        more.setAttribute('aria-label', 'Ver los ' + courses.length + ' ' + plural + ' gratuitos');
        const label = more.querySelector('.recorded-more-text');
        if (label) label.textContent = 'Ver los ' + courses.length;
        more.addEventListener('click', event => showLibrary(event.currentTarget));
    }
    const note = document.getElementById('free-courses-preview');
    if (note) note.hidden = !preview;
    document.getElementById('free-library-open').addEventListener('click', event => showLibrary(event.currentTarget));
    document.getElementById('free-library-close').addEventListener('click', () => dialog.close());
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-free-course]');
        if (button && (grid.contains(button) || content.contains(button))) showCourse(Number(button.dataset.freeCourse), button);
        if (event.target.closest('.free-course-catalog-link')) dialog.close();
        if (event.target.closest('[data-free-back]') && content.contains(event.target)) showLibrary();
    });
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
        // Unload the iframe so a closed course never continues playing audio.
        content.replaceChildren();
        if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    });
})();
