(function () {
    'use strict';

    const section = document.getElementById('cursos-gratuitos');
    const grid = document.getElementById('free-courses-grid');
    const dialog = document.getElementById('free-library-dialog');
    if (!section || section.hidden || !grid || !dialog || typeof FREE_COURSE_LIBRARY === 'undefined') return;

    const content = document.getElementById('free-library-content');
    const title = document.getElementById('free-library-title');
    const status = document.getElementById('free-library-status');
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const play = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9 5 11 7-11 7V5Z"/></svg>';
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
    const book = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1V4Z"/></svg>';
    const clock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    const accents = '<svg class="free-course-accent free-course-accent--play" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="m13 15-2-9m10 11 3-12m3 19 9-6"/></svg>' +
        '<svg class="free-course-accent free-course-accent--photo" viewBox="0 0 32 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m18 9-6-5M16 20H6m12 10-7 5"/></svg>';
    const preview = FREE_COURSE_LIBRARY.preview !== false;
    const courses = Array.isArray(FREE_COURSE_LIBRARY.courses) ? FREE_COURSE_LIBRARY.courses : [];
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

    function renderCard(course, index) {
        const source = !preview && driveSource(course.driveUrl);
        const availability = source ? 'Grabado' : 'Próximamente';
        const action = source ? 'Ir al curso' : preview ? 'Ver vista previa' : 'Ver disponibilidad';
        return '<article class="free-course-card"><button type="button" class="free-course-open" data-free-course="' + index + '" aria-haspopup="dialog" aria-label="' + (source ? 'Ver curso: ' : 'Consultar vista previa: ') + escape(course.title) + '">' +
            '<img src="' + escape(course.cover) + '" alt="" width="1200" height="600" loading="lazy" decoding="async">' +
            '<span class="free-course-badges"><span class="free-course-badge">' + book + 'Gratis</span><span class="free-course-badge free-course-badge--status">' + availability + '</span></span>' +
            '<span class="free-course-title">' + escape(course.title) + '</span><span class="free-course-meta">' + clock + 'A tu ritmo</span><span class="free-course-play">' + play + '</span>' + accents +
            '<span class="free-course-hover" aria-hidden="true"><strong>' + escape(course.title) + '</strong><span class="free-course-hover-action">' + play + action + '</span></span></button></article>';
    }

    function courseButtons() {
        return courses.map((course, index) => '<button type="button" class="free-library-item" data-free-course="' + index + '"><img src="' + escape(course.cover) + '" alt="" width="160" height="100" loading="lazy"><span><strong>' + escape(course.title) + '</strong><small>' + (preview ? 'Título de ejemplo · Próximamente' : driveSource(course.driveUrl) ? 'Gratis · Grabado' : 'Próximamente') + '</small></span><span class="free-library-item-play">' + play + '</span></button>').join('');
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
        status.textContent = preview ? 'Vista previa' : 'Aprende a tu ritmo';
        content.innerHTML = (preview ? '<p class="free-library-notice">Estamos preparando la biblioteca. Estos títulos son ejemplos de cómo se presentarán los cursos; todavía no hay videos disponibles.</p>' : '') +
            (courses.length ? '<div class="free-library-list">' + courseButtons() + '</div>' : '<p class="free-library-notice">Estamos preparando nuevos cursos gratuitos. Vuelve pronto para descubrirlos.</p>');
        openDialog(trigger);
    }

    function showCourse(index, trigger) {
        const course = courses[index];
        if (!course) return;
        const source = !preview && driveSource(course.driveUrl);
        title.textContent = course.title;
        status.textContent = source ? 'Gratis · Grabado' : preview ? 'Vista previa · Título de ejemplo' : 'Próximamente';
        content.innerHTML = source ?
            '<div class="free-course-player"><iframe src="' + source.embed + '" title="' + escape(course.title) + '" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="free-course-player-help">Si el video no se reproduce, <a href="' + source.open + '" target="_blank" rel="noopener noreferrer">abrir el video en otra pestaña</a>.</p>' :
            '<div class="free-course-coming"><span class="free-course-coming-play" aria-hidden="true">' + play + '</span><h3>Estamos preparando este espacio</h3><p>' + (preview ? 'El título y la portada son ilustrativos. Publicaremos los cursos reales cuando la biblioteca esté disponible.' : 'Este curso todavía no está disponible. Puedes seguir explorando la formación de KJA.') + '</p><a href="cursos.html#catalogo" class="free-course-catalog-link">Explorar cursos y talleres ' + arrow + '</a></div>';
        openDialog(trigger);
    }

    grid.innerHTML = courses.slice(0, 3).map(renderCard).join('') || '<p class="free-library-notice">Nuevos cursos gratuitos, próximamente.</p>';
    const note = document.getElementById('free-courses-preview');
    note.hidden = !preview;
    document.getElementById('free-library-open').addEventListener('click', event => showLibrary(event.currentTarget));
    document.getElementById('free-library-close').addEventListener('click', () => dialog.close());
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-free-course]');
        if (button && (grid.contains(button) || content.contains(button))) showCourse(Number(button.dataset.freeCourse), button);
        if (event.target.closest('.free-course-catalog-link')) dialog.close();
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
