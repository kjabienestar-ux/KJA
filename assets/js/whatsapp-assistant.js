/* Asistente guiado de WhatsApp para visitantes de KJA. Sin IA ni servicios externos. */
(function (root) {
    'use strict';

    const SERVICES = [
        { id: 'terapia', label: 'Terapias psicológicas', detailLabel: '¿Para quién es la atención?', details: ['Para mí', 'Para un niño o niña', 'Para un adolescente', 'Para otra persona'] },
        { id: 'adultos', label: 'Terapia para adultos', detailLabel: '¿Qué modalidad prefieres?', details: ['Presencial', 'Virtual', 'Quiero conocer ambas opciones'] },
        { id: 'ninos', label: 'Terapia para niños', detailLabel: '¿Qué edad tiene el niño o niña?', details: ['3 a 6 años', '7 a 11 años', '12 años o más', 'Prefiero indicarlo por WhatsApp'] },
        { id: 'adolescentes', label: 'Terapia para adolescentes', detailLabel: '¿Qué edad tiene el adolescente?', details: ['12 a 14 años', '15 a 17 años', '18 años', 'Prefiero indicarlo por WhatsApp'] },
        { id: 'pareja', label: 'Terapia de pareja', detailLabel: '¿Qué modalidad prefieren?', details: ['Presencial', 'Virtual', 'Queremos conocer ambas opciones'] },
        { id: 'familia', label: 'Terapia familiar', detailLabel: '¿Qué modalidad prefieren?', details: ['Presencial', 'Virtual', 'Queremos conocer ambas opciones'] },
        { id: 'evaluacion', label: 'Evaluaciones psicológicas', detailLabel: '¿Para quién es la evaluación?', details: ['Niño o niña', 'Adolescente', 'Adulto', 'Institución o empresa'] },
        { id: 'vocacional', label: 'Orientación vocacional', detailLabel: '¿En qué etapa se encuentra la persona?', details: ['Secundaria', 'Postulante', 'Estudiante superior', 'Cambio de carrera'] },
        { id: 'cursos', label: 'Cursos y talleres', detailLabel: '¿Qué modalidad te interesa?', details: ['Virtual', 'Presencial', 'Para una institución', 'Deseo conocer las opciones'] },
        { id: 'asesor', label: 'Hablar directamente con un asesor', direct: true }
    ];
    const INTENTS = [
        'Quiero más información',
        'Quiero conocer el precio',
        'Quiero solicitar una cotización',
        'Quiero agendar o contratar el servicio',
        'Quiero consultar disponibilidad',
        'Tengo una consulta específica'
    ];
    const TIMINGS = ['Lo antes posible', 'Esta semana', 'Este mes', 'Todavía estoy evaluando'];
    const STEP_KEYS = ['service', 'intent', 'detail', 'timing', 'notes', 'summary'];

    function serviceById(id) { return SERVICES.find(item => item.id === id) || null; }
    function stepsFor(serviceId) {
        const service = serviceById(serviceId);
        return service && service.direct ? ['service', 'notes', 'summary'] : STEP_KEYS.slice();
    }
    function buildMessage(answers) {
        const service = serviceById(answers.service);
        if (!service) return '';
        const lines = [
            'Hola, me comunico desde la página web de KJA.',
            '',
            `Servicio de interés: ${service.label}.`
        ];
        if (answers.intent) lines.push(`Tipo de consulta: ${answers.intent}.`);
        if (answers.detail) lines.push(`${service.detailLabel.replace(/[¿?]/g, '')}: ${answers.detail}.`);
        if (answers.timing) lines.push(`Fecha aproximada: ${answers.timing}.`);
        if (answers.notes) lines.push(`Detalle adicional: ${String(answers.notes).trim()}`);
        lines.push('', 'Agradecería información sobre los siguientes pasos. Gracias.');
        return lines.join('\n');
    }
    function whatsappUrl(number, answers) {
        return `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(buildMessage(answers))}`;
    }

    function init(options) {
        if (typeof document === 'undefined' || document.getElementById('kja-whatsapp-assistant')) return null;
        const button = document.getElementById('whatsapp-button');
        if (!button) return null;
        const href = button.getAttribute('href') || '';
        const numberMatch = href.match(/wa\.me\/(\d+)/);
        const number = options?.number || numberMatch?.[1] || '51988918238';
        const state = { answers: {}, stepIndex: 0, lastFocus: null };

        const overlay = document.createElement('div');
        overlay.id = 'kja-whatsapp-assistant';
        overlay.className = 'kja-wa-assistant';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="kja-wa-backdrop" data-wa-close></div>
            <section class="kja-wa-panel" role="dialog" aria-modal="true" aria-labelledby="kja-wa-title" tabindex="-1">
                <header class="kja-wa-header">
                    <div class="kja-wa-brand"><span class="kja-wa-brand-mark">KJA</span><span><b id="kja-wa-title">Asistente KJA</b><small>Te ayudamos a encontrar el servicio ideal</small></span></div>
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

        function activeSteps() { return stepsFor(state.answers.service); }
        function setQuestion(title, help) {
            question.replaceChildren();
            const heading = document.createElement('h3'); heading.textContent = title; question.appendChild(heading);
            if (help) { const text = document.createElement('p'); text.textContent = help; question.appendChild(text); }
        }
        function option(label, selected, handler) {
            const element = document.createElement('button');
            element.type = 'button'; element.className = 'kja-wa-option'; element.textContent = label;
            element.setAttribute('aria-pressed', selected ? 'true' : 'false');
            element.addEventListener('click', handler); choices.appendChild(element);
        }
        function advance(key, value) {
            state.answers[key] = value;
            state.stepIndex = Math.min(state.stepIndex + 1, activeSteps().length - 1);
            render();
        }
        function renderSummary() {
            const service = serviceById(state.answers.service);
            setQuestion('Resumen de tu solicitud', 'Revisa la información antes de continuar a WhatsApp.');
            const summary = document.createElement('dl'); summary.className = 'kja-wa-summary';
            const rows = [['Servicio', service.label]];
            if (state.answers.intent) rows.push(['Tipo de consulta', state.answers.intent]);
            if (state.answers.detail) rows.push(['Detalle', state.answers.detail]);
            if (state.answers.timing) rows.push(['Fecha aproximada', state.answers.timing]);
            if (state.answers.notes) rows.push(['Observaciones', state.answers.notes]);
            rows.forEach(([label, value]) => {
                const wrap = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
                dt.textContent = label; dd.textContent = value; wrap.append(dt, dd); summary.appendChild(wrap);
            });
            const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'kja-wa-secondary'; edit.textContent = 'Modificar respuestas';
            edit.addEventListener('click', () => { state.stepIndex = 0; render(); });
            const send = document.createElement('a'); send.className = 'kja-wa-send'; send.target = '_blank'; send.rel = 'noopener noreferrer';
            send.href = whatsappUrl(number, state.answers); send.textContent = 'Enviar consulta por WhatsApp';
            send.addEventListener('click', close);
            choices.append(summary, edit, send);
        }
        function renderNotes() {
            const direct = serviceById(state.answers.service)?.direct;
            setQuestion(direct ? '¿En qué podemos ayudarte?' : '¿Deseas agregar algún detalle?', 'Este campo es opcional. No incluyas información clínica sensible.');
            const textarea = document.createElement('textarea'); textarea.className = 'kja-wa-notes'; textarea.rows = 4; textarea.maxLength = 500;
            textarea.placeholder = direct ? 'Escribe brevemente el motivo de tu consulta…' : 'Cuéntanos algo que debamos considerar…';
            textarea.value = state.answers.notes || '';
            const counter = document.createElement('small'); counter.className = 'kja-wa-counter';
            const updateCounter = () => { counter.textContent = `${textarea.value.length}/500`; }; updateCounter();
            textarea.addEventListener('input', updateCounter);
            const next = document.createElement('button'); next.type = 'button'; next.className = 'kja-wa-primary'; next.textContent = 'Revisar solicitud';
            next.addEventListener('click', () => advance('notes', textarea.value.trim()));
            choices.append(textarea, counter, next); setTimeout(() => textarea.focus(), 0);
        }
        function render() {
            choices.replaceChildren();
            const steps = activeSteps();
            if (state.stepIndex >= steps.length) state.stepIndex = steps.length - 1;
            const key = steps[state.stepIndex];
            progress.style.width = `${((state.stepIndex + 1) / steps.length) * 100}%`;
            stepText.textContent = `Paso ${state.stepIndex + 1} de ${steps.length}`;
            back.hidden = state.stepIndex === 0;

            if (key === 'service') {
                setQuestion('¿Qué servicio necesitas?', 'Selecciona una opción para personalizar tu consulta.');
                SERVICES.forEach(item => option(item.label, state.answers.service === item.id, () => {
                    if (state.answers.service !== item.id) state.answers = { service: item.id };
                    advance('service', item.id);
                }));
            } else if (key === 'intent') {
                setQuestion('¿Qué necesitas respecto a este servicio?');
                INTENTS.forEach(item => option(item, state.answers.intent === item, () => advance('intent', item)));
            } else if (key === 'detail') {
                const service = serviceById(state.answers.service);
                setQuestion(service.detailLabel);
                service.details.forEach(item => option(item, state.answers.detail === item, () => advance('detail', item)));
            } else if (key === 'timing') {
                setQuestion('¿Para cuándo necesitas el servicio?');
                TIMINGS.forEach(item => option(item, state.answers.timing === item, () => advance('timing', item)));
            } else if (key === 'notes') renderNotes();
            else renderSummary();
            const focusTarget = choices.querySelector('button, textarea, a');
            if (focusTarget && key !== 'notes') setTimeout(() => focusTarget.focus(), 0);
        }
        function open(event) {
            event?.preventDefault();
            state.lastFocus = document.activeElement;
            overlay.hidden = false; document.body.classList.add('kja-wa-open');
            localStorage.setItem('kja_whatsapp_badge_clicked', 'true');
            const badge = document.getElementById('whatsapp-badge'); if (badge) badge.style.display = 'none';
            render(); panel.focus();
        }
        function close() {
            if (overlay.hidden) return;
            overlay.hidden = true; document.body.classList.remove('kja-wa-open');
            if (state.lastFocus?.focus) state.lastFocus.focus({ preventScroll: true });
        }
        function handleKey(event) {
            if (overlay.hidden) return;
            if (event.key === 'Escape') { event.preventDefault(); close(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [...panel.querySelectorAll('button:not([hidden]),a[href],textarea,[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
            if (!focusable.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        button.addEventListener('click', open);
        overlay.querySelectorAll('[data-wa-close]').forEach(item => item.addEventListener('click', close));
        back.addEventListener('click', () => { state.stepIndex = Math.max(0, state.stepIndex - 1); render(); });
        overlay.addEventListener('keydown', handleKey);
        return { open, close, state };
    }

    const api = { SERVICES, INTENTS, TIMINGS, stepsFor, buildMessage, whatsappUrl, init };
    root.KJAWhatsAppAssistant = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document !== 'undefined') {
        const start = () => init();
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
