/* Agenda pública de Talleres. Los datos y fotografías se comparten con formación. */
(() => {
    'use strict';
    const list = document.getElementById('formation-workshops');
    if (!list || typeof KJA_FORMATION === 'undefined') return;
    const search = document.getElementById('talleres-search');
    const count = document.getElementById('talleres-count');
    const empty = document.getElementById('talleres-empty');
    const dialog = document.getElementById('formation-workshop-dialog');
    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
    const workshops = KJA_FORMATION.workshops;
    const workshopPhoto = workshop => workshop.photo || 'images/cursos/photos/' + workshop.image + '.webp';
    let opener;
    list.innerHTML = workshops.map(workshop => '<li data-workshop-id="' + escape(workshop.id) + '"><button type="button" class="talleres-topic" data-workshop-detail="' + escape(workshop.id) + '" aria-haspopup="dialog"><span><span class="talleres-topic-status">Próximamente</span><strong>' + escape(workshop.title) + '</strong><span class="talleres-topic-description">' + escape(workshop.description || '') + '</span><span class="talleres-topic-link">Conocer el taller ' + arrow + '</span><span class="talleres-topic-preview" aria-hidden="true"><span><img src="' + escape(workshopPhoto(workshop)) + '" alt="" width="1200" height="800" loading="lazy" decoding="async"></span></span></span></button></li>').join('');
    const rows = [...list.children];
    // Dos listas independientes evitan que el hover estire la fila de al lado.
    const columns = [0, 1].map(index => {
        const column = document.createElement('ol');
        column.className = 'talleres-timeline-column';
        column.setAttribute('aria-label', 'Talleres de octubre, columna ' + (index + 1));
        return column;
    });
    rows.forEach((row, index) => {
        const button = row.querySelector('.talleres-topic');
        const copy = button.firstElementChild;
        copy.className = 'talleres-topic-copy';
        button.append(copy.querySelector('.talleres-topic-preview'));
    });
    const singleColumn = window.matchMedia('(max-width: 600px)');
    function arrangeColumns() {
        // En móvil vuelve a una lista cronológica única, también para el teclado.
        list.replaceChildren();
        if (singleColumn.matches) {
            list.append(columns[0]);
            columns[0].append(...rows);
        }
        else {
            list.append(...columns);
            rows.forEach((row, index) => columns[index % 2].append(row));
        }
        markLineEnds();
    }
    function markLineEnds() {
        rows.forEach(row => row.classList.remove('is-last-visible'));
        (singleColumn.matches ? [columns[0]] : columns).forEach(column => {
            [...column.children].filter(row => !row.hidden).at(-1)?.classList.add('is-last-visible');
        });
    }
    singleColumn.addEventListener?.('change', arrangeColumns);
    arrangeColumns();
    function filter() {
        const terms = normalize(search.value).split(/\s+/).filter(Boolean);
        let visible = 0;
        rows.forEach((row, index) => {
            row.hidden = !terms.every(term => normalize(workshops[index].title).includes(term));
            if (!row.hidden) visible++;
        });
        count.textContent = terms.length ? visible + ' de ' + workshops.length + ' talleres' : workshops.length + ' talleres para explorar';
        empty.hidden = visible > 0;
        markLineEnds();
    }
    search.addEventListener('input', filter);
    document.getElementById('talleres-reset').addEventListener('click', () => { search.value = ''; filter(); search.focus(); });
    filter();
    list.addEventListener('click', event => {
        const button = event.target.closest('[data-workshop-detail]');
        if (!button) return;
        const workshop = workshops.find(item => item.id === button.dataset.workshopDetail);
        if (!workshop) return;
        opener = button;
        document.getElementById('formation-workshop-title').textContent = workshop.title;
        document.getElementById('formation-workshop-image').src = workshopPhoto(workshop);
        document.getElementById('formation-workshop-note').textContent = (workshop.description ? workshop.description + ' ' : '') + (workshop.note ? workshop.note + '. ' : '') + 'Consulta las próximas fechas y disponibilidad.';
        document.getElementById('formation-workshop-consult').href = 'https://wa.me/51988918238?text=' + encodeURIComponent('Hola KJA, quisiera consultar las próximas fechas y disponibilidad del taller «' + workshop.title + '».');
        dialog.showModal();
    });
    document.getElementById('formation-workshop-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog || event.detail === 0) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    // Se conserva la interacción de cierre aprobada para los detalles de Cursos.
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
})();
