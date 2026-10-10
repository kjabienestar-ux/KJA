/* Catálogo de áreas y vista especializada. Los programas viven en cursos-data.js. */
(function () {
    'use strict';

    const grid = document.getElementById('cursos-grid');
    const areaView = document.getElementById('course-area-view');
    if (!grid || !areaView || typeof COURSE_DATA === 'undefined') return;

    const entries = Object.entries(COURSE_DATA);
    const areaId = new URLSearchParams(window.location.search).get('area');
    const area = Object.prototype.hasOwnProperty.call(COURSE_DATA, areaId) ? COURSE_DATA[areaId] : null;
    const escape = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const areaUrl = id => 'cursos.html?area=' + encodeURIComponent(id);
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
    const icons = {
        course: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3V4Z"/>',
        workshop: '<path d="m14 4 6 6M4 20l4-1 12-12-3-3L5 16l-1 4Zm12-3h5M16 21h5"/>',
        specialization: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-6 8v6c4 3 8 3 12 0v-6M22 8v8"/>'
    };
    const icon = type => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[type] + '</svg>';
    const whatsappIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.5 8L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z"/><path d="M8 7c0 5 4 9 9 9l1-3-3-1-1 1c-2-1-3-2-4-4l1-1-1-2-2 1Z"/></svg>';
    const waUrl = message => 'https://wa.me/51988918238?text=' + encodeURIComponent(message);

    function renderAreaCard([id, data], index) {
        return '<article class="catalog-area-card" style="--area-shadow-color:' + (index % 2 ? '#004fb02e' : '#cf00632e') + ';--catalog-focus:' + escape(data.catalogFocus || '76% center') + '">' +
            '<a href="' + areaUrl(id) + '" class="catalog-area-link" aria-label="Explorar área: ' + escape(data.title) + '">' +
            '<div class="catalog-area-image"><img src="' + escape(data.catalogImage || data.image) + '" alt="" width="1200" height="600" loading="lazy" decoding="async"></div>' +
            '<span class="catalog-area-veil" aria-hidden="true"></span><span class="catalog-area-lens" aria-hidden="true">' + arrow + '</span>' +
            '<div class="catalog-area-copy"><span class="catalog-area-label">Área ' + String(index + 1).padStart(2, '0') + '</span>' +
            '<h3>' + escape(data.title) + '</h3><p class="catalog-area-description">' + escape(data.catalogSummary || data.description) + '</p>' +
            '<span class="catalog-area-action">Explorar ' + arrow + '</span></div></a></article>';
    }

    function initCatalogExpansion() {
        const wide = window.matchMedia('(min-width: 1051px)');
        const desktop = window.matchMedia('(min-width: 1051px) and (hover: hover) and (pointer: fine)');
        grid.querySelectorAll('.catalog-area-row').forEach(row => {
            let timer;
            const cards = [...row.querySelectorAll('.catalog-area-card')];
            function expand(card) {
                clearTimeout(timer);
                row.classList.toggle('has-expanded', !!card);
                cards.forEach(item => item.classList.toggle('is-expanded', item === card));
            }
            cards.forEach(card => {
                card.addEventListener('pointerenter', () => {
                    if (!desktop.matches) return;
                    clearTimeout(timer);
                    timer = setTimeout(() => expand(card), 110);
                });
                card.querySelector('a').addEventListener('focus', () => {
                    if (wide.matches) expand(card);
                });
            });
            row.addEventListener('pointerleave', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    const focused = document.activeElement.closest('.catalog-area-card');
                    expand(wide.matches && row.contains(focused) ? focused : null);
                }, 160);
            });
            row.addEventListener('focusout', event => {
                if (!row.contains(event.relatedTarget)) expand(null);
            });
            wide.addEventListener?.('change', () => expand(null));
        });
    }

    function renderProgram(program, index) {
        const typeName = program.type === 'course' ? 'Curso' : 'Taller';
        const message = 'Hola KJA, quisiera información sobre el ' + typeName.toLowerCase() + ' «' + program.title + '» del área de ' + area.title + '. ¿Cuáles son las fechas, modalidad y precio?';
        return '<article class="area-program area-program--' + program.type + '">' +
            '<div class="area-program-media"><img src="' + escape(program.image || area.image) + '" alt="" width="800" height="400" loading="lazy" decoding="async"></div>' +
            '<div class="area-program-top"><span class="area-program-icon">' + icon(program.type) + '</span><span class="area-program-type">' + typeName + '</span><span class="area-program-number">' + String(index + 1).padStart(2, '0') + '</span></div>' +
            '<h3>' + escape(program.title) + '</h3><div class="area-program-footer"><span>Fechas y modalidad<br><strong>Consulta disponibilidad</strong></span>' +
            '<a href="' + escape(waUrl(message)) + '" target="_blank" rel="noopener noreferrer" aria-label="Consultar sobre ' + escape(program.title) + '">Consultar ' + arrow + '</a></div></article>';
    }

    function categoryContent(type, label, number, description) {
        const programs = area.programs.filter(program => program.type === type);
        return '<div class="area-section-heading"><div class="area-section-title"><span class="area-section-number">' + number + '</span><div><span class="area-section-eyebrow">' + (type === 'course' ? 'Conocimiento que transforma' : 'De la teoría a la práctica') + '</span><h2>' + label + '</h2></div></div><p>' + description + '</p></div>' +
            (programs.length ? '<div class="area-program-grid">' + programs.map(renderProgram).join('') + '</div>' :
                '<div class="area-category-empty">' + icon(type) + '<div><h3>Nuevos ' + label.toLowerCase() + ' en preparación</h3><p>Consulta con nuestro equipo por las próximas propuestas de esta área.</p></div></div>');
    }

    function initCategoryTabs() {
        const tabs = Array.from(areaView.querySelectorAll('[role="tab"]'));
        const panel = document.getElementById('area-category-panel');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const contents = {
            course: categoryContent('course', 'Cursos', '01', 'Explora fundamentos, herramientas de evaluación y enfoques de intervención.'),
            workshop: categoryContent('workshop', 'Talleres', '02', 'Desarrolla sesiones, informes y recursos para tu práctica profesional.'),
            specialization: document.getElementById('area-specialization-template').innerHTML
        };
        let selected;

        function selectCategory(type, animate, updateUrl) {
            if (!Object.prototype.hasOwnProperty.call(contents, type) || selected === type) return;
            panel.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
            const oldHeight = panel.getBoundingClientRect().height;
            selected = type;
            tabs.forEach(tab => {
                const active = tab.dataset.category === type;
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
            });
            panel.dataset.category = type;
            panel.setAttribute('aria-labelledby', 'area-tab-' + type);
            panel.innerHTML = '<div class="area-panel-content">' + contents[type] + '</div>';
            if (updateUrl) {
                const url = new URL(window.location.href);
                url.hash = 'area-' + type;
                window.history.replaceState(null, '', url);
            }
            if (animate && !reducedMotion.matches && typeof panel.animate === 'function') {
                const newHeight = panel.getBoundingClientRect().height;
                panel.animate([
                    { height: oldHeight + 'px', overflow: 'hidden' },
                    { height: newHeight + 'px', overflow: 'hidden' }
                ], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
                panel.firstElementChild.animate([
                    { opacity: 0, transform: 'translateY(8px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 220, easing: 'ease-out' });
                panel.querySelectorAll('.area-program, .area-specialization').forEach((card, index) => {
                    card.animate([
                        { opacity: 0, transform: 'translateY(10px)' },
                        { opacity: 1, transform: 'translateY(0)' }
                    ], { duration: 240, delay: Math.min(index * 30, 120), fill: 'backwards', easing: 'cubic-bezier(.22,1,.36,1)' });
                });
            }
        }

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => selectCategory(tab.dataset.category, true, true));
            tab.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = tabs.length - 1;
                if (next === undefined) return;
                event.preventDefault();
                tabs[next].focus();
                selectCategory(tabs[next].dataset.category, true, true);
            });
        });
        const categoryFromUrl = () => window.location.hash.replace('#area-', '');
        selectCategory(Object.prototype.hasOwnProperty.call(contents, categoryFromUrl()) ? categoryFromUrl() : 'course', false, false);
        window.addEventListener('hashchange', () => selectCategory(categoryFromUrl(), true, false));
        ['course', 'workshop'].forEach(type => {
            const count = area.programs.filter(program => program.type === type).length;
            document.getElementById('area-' + type + '-count').textContent = count + (count === 1 ? ' programa' : ' programas');
        });
    }

    function initAreaSwitcher() {
        const switcher = document.getElementById('area-switcher');
        const trigger = document.getElementById('area-picker');
        const menu = document.getElementById('area-switcher-menu');
        const options = document.getElementById('area-switcher-options');
        document.getElementById('area-picker-title').textContent = area.title;
        document.getElementById('area-picker-image').src = area.image;
        options.innerHTML = entries.map(([id, data], index) => {
            const active = id === areaId;
            return '<a class="area-switcher-option" href="' + areaUrl(id) + '"' + (active ? ' aria-current="page"' : '') + '>' +
                '<img src="' + escape(data.image) + '" alt="" width="52" height="38" loading="lazy">' +
                '<span><strong>' + escape(data.title) + '</strong><small>' + (active ? 'Estás aquí' : 'Área ' + String(index + 1).padStart(2, '0') + ' · ' + data.programs.length + ' temas') + '</small></span>' +
                '<span class="area-switcher-option-mark" aria-hidden="true">' + (active ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>' : arrow) + '</span></a>';
        }).join('');
        const links = Array.from(options.querySelectorAll('a'));
        function setOpen(open, restoreFocus) {
            menu.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            switcher.classList.toggle('is-open', open);
            switcher.closest('.area-top').classList.toggle('area-picker-open', open);
            if (restoreFocus) trigger.focus();
        }
        trigger.addEventListener('click', () => setOpen(menu.hidden));
        trigger.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            setOpen(true);
            const current = options.querySelector('[aria-current="page"]');
            (current || links[0]).focus();
        });
        switcher.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !menu.hidden) {
                event.preventDefault();
                setOpen(false, true);
            }
        });
        options.addEventListener('keydown', event => {
            const index = links.indexOf(document.activeElement);
            let next;
            if (event.key === 'ArrowDown') next = (index + 1) % links.length;
            if (event.key === 'ArrowUp') next = (index + links.length - 1) % links.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = links.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            links[next].focus();
        });
        document.addEventListener('pointerdown', event => {
            if (!switcher.contains(event.target)) setOpen(false);
        });
        switcher.addEventListener('focusout', event => {
            if (!switcher.contains(event.relatedTarget)) setOpen(false);
        });
    }

    if (area) {
        document.querySelector('.cursos-hero').hidden = true;
        document.getElementById('cursos-gratuitos').hidden = true;
        document.getElementById('catalogo').hidden = true;
        areaView.hidden = false;
        document.body.classList.add('course-area-page');
        document.title = area.title + ' · Cursos y talleres | KJA';
        document.getElementById('area-title').textContent = area.title;
        document.getElementById('area-breadcrumb').textContent = area.title;
        document.getElementById('area-description').textContent = area.description;
        document.getElementById('area-number').textContent = 'Área ' + String(entries.findIndex(([id]) => id === areaId) + 1).padStart(2, '0') + ' / 09';
        const image = document.getElementById('area-image');
        image.src = area.image;
        image.alt = 'Formación KJA: ' + area.title;
        document.getElementById('area-total').textContent = area.programs.length;
        document.getElementById('area-consult').href = waUrl('Hola KJA, quisiera orientación sobre los cursos y talleres de ' + area.title);
        initAreaSwitcher();
        initCategoryTabs();
    } else {
        grid.innerHTML = entries.reduce((rows, entry, index) => {
            if (index % 3 === 0) rows.push([]);
            rows[rows.length - 1].push(renderAreaCard(entry, index));
            return rows;
        }, []).map(cards => '<div class="catalog-area-row">' + cards.join('') + '</div>').join('');
        initCatalogExpansion();
    }
})();
