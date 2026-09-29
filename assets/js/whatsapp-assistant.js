/* Asistente de WhatsApp KJA: tipo de atención, servicio específico y envío. */
(function (root) {
    'use strict';

    const THERAPIES = [
        'Evaluación Pedagógica',
        'Terapia de Conducta',
        'Integración Sensorial',
        'Tratamiento de Lenguaje',
        'Modificación de Conducta',
        'Terapia de Aprendizaje',
        'Atención y Concentración',
        'Terapia de Mindfulness',
        'Evaluaciones Integrales',
        'Orientación Vocacional',
        'Terapia de Pareja',
        'Terapia Emocional',
        'Dependencia Emocional',
        'Cognitivo Conductual (TCC)',
        'Terapia de Ansiedad',
        'Terapia de Depresión',
        'Terapia Familiar',
        'Consejería Familiar'
    ];

    const COURSES = [
        'TEA / Autismo',
        'Terapia Ocupacional e Integración Sensorial',
        'Terapia de Lenguaje',
        'Psicoterapia y Terapia Cognitivo-Conductual',
        'Neuropsicología',
        'Adultos Mayores y Psicooncología',
        'Evaluación Psicológica Clínica',
        'Psicología Organizacional y Selección de Personal',
        'Salud Ocupacional y Bienestar'
    ];

    const CATEGORIES = [
        { id: 'terapias', label: 'Terapias', description: 'Atención psicológica, evaluaciones y orientación.', items: THERAPIES },
        { id: 'cursos', label: 'Cursos', description: 'Cursos y talleres de formación psicológica.', items: COURSES }
    ];

    function categoryById(id) {
        return CATEGORIES.find(category => category.id === id) || null;
    }

    function buildMessage(answers) {
        const category = categoryById(answers?.category);
        if (!category || !answers?.item) return '';
        return [
            'Hola KJA, me comunico desde su página web.',
            '',
            `Tipo de servicio: ${category.label}.`,
            `Opción elegida: ${answers.item}.`,
            'Quisiera recibir información sobre disponibilidad, modalidad y precio.',
            '',
            'Gracias.'
        ].join('\n');
    }

    function whatsappUrl(number, answers) {
        const cleanNumber = String(number || '').replace(/\D/g, '');
        return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(buildMessage(answers))}`;
    }

    function init(options) {
        if (typeof document === 'undefined' || document.getElementById('kja-whatsapp-assistant')) return null;
        const trigger = document.getElementById('whatsapp-button');
        if (!trigger) return null;
        const numberMatch = (trigger.getAttribute('href') || '').match(/wa\.me\/(\d+)/);
        const number = options?.number || numberMatch?.[1] || '51988918238';
        const state = { step: 0, answers: {}, lastFocus: null };

        const overlay = document.createElement('div');
        overlay.id = 'kja-whatsapp-assistant';
        overlay.className = 'kja-wa-assistant';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="kja-wa-backdrop" data-wa-close></div>
            <section class="kja-wa-panel" role="dialog" aria-modal="true" aria-labelledby="kja-wa-title" tabindex="-1">
                <header class="kja-wa-header">
                    <div class="kja-wa-brand"><span class="kja-wa-brand-mark">KJA</span><span><b id="kja-wa-title">Asistente KJA</b><small>Encuentra rápidamente lo que necesitas</small></span></div>
                    <button class="kja-wa-close" type="button" data-wa-close aria-label="Cerrar asistente">×</button>
                </header>
                <div class="kja-wa-progress" aria-hidden="true"><i></i></div>
                <div class="kja-wa-content">
                    <div class="kja-wa-greeting"><span aria-hidden="true">👋</span><p>¡Hola! Bienvenido a KJA. Estamos aquí para ayudarte.</p></div>
                    <div class="kja-wa-question" aria-live="polite"></div>
                    <div class="kja-wa-options"></div>
                </div>
                <footer class="kja-wa-footer">
                    <button class="kja-wa-back" type="button">← Regresar</button>
                    <span class="kja-wa-step" aria-live="polite"></span>
                </footer>
            </section>`;
        document.body.appendChild(overlay);

        const panel = overlay.querySelector('.kja-wa-panel');
        const question = overlay.querySelector('.kja-wa-question');
        const choices = overlay.querySelector('.kja-wa-options');
        const back = overlay.querySelector('.kja-wa-back');
        const progress = overlay.querySelector('.kja-wa-progress i');
        const stepText = overlay.querySelector('.kja-wa-step');

        function setQuestion(title, help) {
            question.replaceChildren();
            const heading = document.createElement('h3');
            heading.textContent = title;
            question.appendChild(heading);
            if (help) {
                const text = document.createElement('p');
                text.textContent = help;
                question.appendChild(text);
            }
        }

        function option(label, description, selected, handler) {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'kja-wa-option';
            element.setAttribute('aria-pressed', selected ? 'true' : 'false');
            const title = document.createElement('b');
            title.textContent = label;
            element.appendChild(title);
            if (description) {
                const detail = document.createElement('small');
                detail.textContent = description;
                element.appendChild(detail);
            }
            element.addEventListener('click', handler);
            choices.appendChild(element);
        }

        function goToWhatsApp(item) {
            state.answers.item = item;
            const url = whatsappUrl(number, state.answers);
            const outbound = document.createElement('a');
            outbound.href = url;
            outbound.target = '_blank';
            outbound.rel = 'noopener noreferrer';
            document.body.appendChild(outbound);
            outbound.click();
            outbound.remove();
            close();
        }

        function render() {
            choices.replaceChildren();
            progress.style.width = state.step === 0 ? '50%' : '100%';
            stepText.textContent = `Paso ${state.step + 1} de 2`;
            back.hidden = state.step === 0;

            if (state.step === 0) {
                setQuestion('¿Qué necesitas?', 'Selecciona una opción para ver todos los servicios disponibles.');
                CATEGORIES.forEach(category => option(
                    category.label,
                    category.description,
                    state.answers.category === category.id,
                    () => {
                        state.answers = { category: category.id };
                        state.step = 1;
                        render();
                    }
                ));
            } else {
                const category = categoryById(state.answers.category);
                setQuestion(
                    category.id === 'terapias' ? '¿Qué terapia necesitas?' : '¿Qué curso te interesa?',
                    'Al seleccionar una opción abriremos WhatsApp con tu consulta preparada.'
                );
                category.items.forEach(item => option(item, null, state.answers.item === item, () => goToWhatsApp(item)));
            }
            setTimeout(() => choices.querySelector('button')?.focus(), 0);
        }

        function open(event) {
            event?.preventDefault();
            state.lastFocus = document.activeElement;
            state.step = 0;
            state.answers = {};
            overlay.hidden = false;
            document.body.classList.add('kja-wa-open');
            localStorage.setItem('kja_whatsapp_badge_clicked', 'true');
            const badge = document.getElementById('whatsapp-badge');
            if (badge) badge.style.display = 'none';
            render();
            panel.focus();
        }

        function close() {
            if (overlay.hidden) return;
            overlay.hidden = true;
            document.body.classList.remove('kja-wa-open');
            if (state.lastFocus?.focus) state.lastFocus.focus({ preventScroll: true });
        }

        function handleKey(event) {
            if (overlay.hidden) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = [...panel.querySelectorAll('button:not([hidden]),a[href],[tabindex]:not([tabindex="-1"])')].filter(element => !element.disabled);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        trigger.addEventListener('click', open);
        overlay.querySelectorAll('[data-wa-close]').forEach(element => element.addEventListener('click', close));
        back.addEventListener('click', () => {
            state.step = 0;
            state.answers = {};
            render();
        });
        overlay.addEventListener('keydown', handleKey);
        return { open, close, state, render };
    }

    const api = { THERAPIES, COURSES, CATEGORIES, categoryById, buildMessage, whatsappUrl, init };
    root.KJAWhatsAppAssistant = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document !== 'undefined') {
        const start = () => init();
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
