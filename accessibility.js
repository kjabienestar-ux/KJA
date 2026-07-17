/* ============================================================
   KJA ACCESIBILITY & PREMIUM WIDGETS SYSTEM (MODULAR)
   ============================================================ */

(function () {
    const htmlEl = document.documentElement;

    // ============================================================
    // CONFIGURACIÓN GLOBAL
    // ============================================================
    const CONFIG = {
        whatsapp: {
            number: '51988918238',
            message: 'Hola KJA, quisiera agendar una cita o recibir más información.',
            toastText: '¡Conversa con nosotros! Agenda tu cita con 20% de descuento.',
            labelText: 'Hablar por WhatsApp'
        }
    };
    // Una página puede redirigir el WhatsApp a otro contacto (p. ej. el panel admin
    // lo apunta a Yeiser, el administrador). Se define window.KJA_WHATSAPP_OVERRIDE antes de este script.
    if (window.KJA_WHATSAPP_OVERRIDE) Object.assign(CONFIG.whatsapp, window.KJA_WHATSAPP_OVERRIDE);

    // ============================================================
    // 1. SISTEMA DE ACCESIBILIDAD UNIVERSAL
    // ============================================================

    // Diccionario de traducciones para el menú
    const dictionary = {
        es: {
            title: "Accesibilidad KJA",
            langLabel: "Idioma: Español",
            profileLabel: "Perfil de accesibilidad",
            profileDefault: "Seleccionar perfil...",
            profileVisual: "Discapacidad Visual",
            profileAdhd: "TDAH (Enfoque de lectura)",
            profileCognitive: "Cognitivo / Dislexia",
            profileMotor: "Motor / Teclado",
            profileCustom: "Personalizado",
            cardTextSize: "Tamaño de texto",
            cardContrast: "Contrastes",
            cardCursor: "Tamaño de cursor",
            cardReadingMask: "Máscara de lectura",
            cardDyslexia: "Fuente disléxica",
            cardLineHeight: "Interlineado",
            reset: "Restablecer"
        },
        en: {
            title: "KJA Accessibility",
            langLabel: "Language: English",
            profileLabel: "Accessibility Profile",
            profileDefault: "Select profile...",
            profileVisual: "Visual Impairment",
            profileAdhd: "ADHD (Reading Focus)",
            profileCognitive: "Cognitive / Dyslexia",
            profileMotor: "Motor / Keyboard",
            profileCustom: "Custom",
            cardTextSize: "Text Size",
            cardContrast: "Contrast",
            cardCursor: "Cursor Size",
            cardReadingMask: "Reading Mask",
            cardDyslexia: "Dyslexia Friendly",
            cardLineHeight: "Line Spacing",
            reset: "Reset All"
        }
    };

    // Perfiles predefinidos
    const profiles = {
        none: {},
        visual: {
            fontSize: 2,
            contrast: 1,
            cursor: 1,
            readingMask: 0,
            dyslexia: 0,
            lineHeight: 0,
            focusHighlight: 0
        },
        adhd: {
            fontSize: 0,
            contrast: 0,
            cursor: 0,
            readingMask: 1,
            dyslexia: 0,
            lineHeight: 0,
            focusHighlight: 0
        },
        cognitive: {
            fontSize: 1,
            contrast: 0,
            cursor: 0,
            readingMask: 0,
            dyslexia: 1,
            lineHeight: 1,
            focusHighlight: 0
        },
        motor: {
            fontSize: 0,
            contrast: 0,
            cursor: 0,
            readingMask: 0,
            dyslexia: 0,
            lineHeight: 0,
            focusHighlight: 1
        },
        custom: {}
    };

    // Estado inicial de accesibilidad
    let accessibilityState = {
        lang: 'es',
        profile: 'none',
        fontSize: 0,       // 0 a 3 (Normal, Grande, Muy Grande, Gigante)
        contrast: 0,       // 0 a 3 (Normal, Alto Contraste, Monocromo, Invertido)
        cursor: 0,         // 0 a 2 (Normal, Grande, Gigante)
        readingMask: 0,    // 0 a 1 (Desactivado, Activado)
        dyslexia: 0,       // 0 a 1 (Desactivado, Activado)
        lineHeight: 0,      // 0 a 2 (Normal, 1.95, 2.3)
        focusHighlight: 0   // 0 a 1 (Desactivado, Activado)
    };

    // Cargar estado guardado
    function loadState() {
        const saved = localStorage.getItem('kja_accessibility_settings');
        if (saved) {
            try {
                accessibilityState = JSON.parse(saved);
            } catch (e) {
                console.error("No se pudo cargar la configuración de accesibilidad:", e);
            }
        }
    }

    // Guardar estado en localStorage
    function saveState() {
        localStorage.setItem('kja_accessibility_settings', JSON.stringify(accessibilityState));
    }

    // Inyectar el Widget de Accesibilidad en el DOM
    function injectAccessibilityWidget() {
        // Crear FAB (Botón flotante en el lado izquierdo inferior)
        const fab = document.createElement('button');
        fab.className = 'accessibility-fab';
        fab.id = 'accessibility-fab';
        fab.setAttribute('aria-label', 'Abrir menú de accesibilidad');
        fab.setAttribute('title', 'Menú de accesibilidad');
        fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/></svg>`;
        document.body.appendChild(fab);

        // Crear Backdrop Overlay
        const overlay = document.createElement('div');
        overlay.className = 'accessibility-overlay';
        overlay.id = 'accessibility-overlay';
        document.body.appendChild(overlay);

        // Crear Sidebar Drawer
        const drawer = document.createElement('div');
        drawer.className = 'accessibility-drawer';
        drawer.id = 'accessibility-drawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.innerHTML = `
            <div class="accessibility-header">
                <div class="accessibility-header-title">
                    <svg viewBox="0 0 24 24"><path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/></svg>
                    <span id="acc-title-text">Accesibilidad KJA</span>
                </div>
                <button class="accessibility-close" id="accessibility-close" aria-label="Cerrar menú de accesibilidad">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="accessibility-body">
                <div class="accessibility-select-group">
                    <label class="accessibility-select-label" id="acc-lang-label" for="acc-lang-select">Idioma: Español</label>
                    <div class="accessibility-select-wrapper">
                        <select class="accessibility-select" id="acc-lang-select">
                            <option value="es">Español</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>
                
                <div class="accessibility-select-group">
                    <label class="accessibility-select-label" id="acc-profile-label" for="acc-profile-select">Perfil de accesibilidad</label>
                    <div class="accessibility-select-wrapper">
                        <select class="accessibility-select" id="acc-profile-select">
                            <option value="none" id="acc-profile-default">Seleccionar perfil...</option>
                            <option value="visual" id="acc-profile-visual">Discapacidad Visual</option>
                            <option value="adhd" id="acc-profile-adhd">TDAH (Enfoque de lectura)</option>
                            <option value="cognitive" id="acc-profile-cognitive">Cognitivo / Dislexia</option>
                            <option value="motor" id="acc-profile-motor">Motor / Teclado</option>
                            <option value="custom" id="acc-profile-custom">Personalizado</option>
                        </select>
                    </div>
                </div>
                
                <div class="accessibility-grid">
                    <div class="accessibility-card" id="acc-card-size" data-type="fontSize">
                        <div class="accessibility-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z"/></svg>
                        </div>
                        <span class="accessibility-card-label" id="acc-label-size">Tamaño de texto</span>
                        <div class="accessibility-bar" data-segments="3">
                            <div class="accessibility-segment"></div>
                            <div class="accessibility-segment"></div>
                            <div class="accessibility-segment"></div>
                        </div>
                    </div>
                    
                    <div class="accessibility-card" id="acc-card-contrast" data-type="contrast">
                        <div class="accessibility-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8v16z"/></svg>
                        </div>
                        <span class="accessibility-card-label" id="acc-label-contrast">Contrastes</span>
                        <div class="accessibility-bar" data-segments="3">
                            <div class="accessibility-segment"></div>
                            <div class="accessibility-segment"></div>
                            <div class="accessibility-segment"></div>
                        </div>
                    </div>
                    
                    <div class="accessibility-card" id="acc-card-cursor" data-type="cursor">
                        <div class="accessibility-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M5.92 3.11a1 1 0 0 1 1.63-.44l13.12 11.23a1 1 0 0 1-.5 1.76h-5.92l4.88 7.32a1 1 0 0 1-1.66 1.11l-4.88-7.32-3.88 3.88a1 1 0 0 1-1.7-.71V3.11z"/></svg>
                        </div>
                        <span class="accessibility-card-label" id="acc-label-cursor">Cursor</span>
                        <div class="accessibility-bar" data-segments="2">
                            <div class="accessibility-segment"></div>
                            <div class="accessibility-segment"></div>
                        </div>
                    </div>
                    
                    <div class="accessibility-card" id="acc-card-mask" data-type="readingMask">
                        <div class="accessibility-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>
                        </div>
                        <span class="accessibility-card-label" id="acc-label-mask">Máscara de lectura</span>
                        <div class="accessibility-bar" data-segments="1">
                            <div class="accessibility-segment"></div>
                        </div>
                    </div>
                    
                    <div class="accessibility-card" id="acc-card-dyslexia" data-type="dyslexia">
                        <div class="accessibility-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M9.62 5.5h2.76L16 16h-2.3l-1.07-3.07H7.36L6.3 16H4L7.62 5.5zm.77 1.83L8.03 11.2h3.94l-1.58-3.87zM16 13h5.5l-4.5 4.5h4.5v1.5H16l4.5-4.5H16V13z"/></svg>
                        </div>
                        <span class="accessibility-card-label" id="acc-label-dyslexia">Fuente disléxica</span>
                        <div class="accessibility-bar" data-segments="1">
                            <div class="accessibility-segment"></div>
                        </div>
                    </div>
                    
                    <div class="accessibility-card" id="acc-card-spacing" data-type="lineHeight">
                        <div class="accessibility-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M10 5h11v2H10V5zm0 12h11v2H10v-2zm0-6h11v2H10v-2zM3 5.5l3.5-3.5L10 5.5H7v13h3l-3.5 3.5L3 18.5h3v-13H3z"/></svg>
                        </div>
                        <span class="accessibility-card-label" id="acc-label-spacing">Interlineado</span>
                        <div class="accessibility-bar" data-segments="2">
                            <div class="accessibility-segment"></div>
                            <div class="accessibility-segment"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="accessibility-footer">
                <button class="accessibility-reset" id="accessibility-reset">
                    <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                    <span id="acc-reset-text">Restablecer</span>
                </button>
            </div>
        `;
        document.body.appendChild(drawer);

        // Crear la máscara de lectura div
        const mask = document.createElement('div');
        mask.className = 'accessibility-reading-mask';
        mask.id = 'accessibility-reading-mask';
        document.body.appendChild(mask);
    }

    // Funciones del cajón (Drawer)
    function openDrawer() {
        const drawer = document.getElementById('accessibility-drawer');
        const overlay = document.getElementById('accessibility-overlay');
        drawer.classList.add('open');
        overlay.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
    }

    function closeDrawer() {
        const drawer = document.getElementById('accessibility-drawer');
        const overlay = document.getElementById('accessibility-overlay');
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
    }

    // Actualizar traducciones
    function updateTranslations(lang) {
        const t = dictionary[lang];
        if (!t) return;
        document.getElementById('acc-title-text').textContent = t.title;
        document.getElementById('acc-lang-label').textContent = t.langLabel;
        document.getElementById('acc-profile-label').textContent = t.profileLabel;
        document.getElementById('acc-profile-default').textContent = t.profileDefault;
        document.getElementById('acc-profile-visual').textContent = t.profileVisual;
        document.getElementById('acc-profile-adhd').textContent = t.profileAdhd;
        document.getElementById('acc-profile-cognitive').textContent = t.profileCognitive;
        document.getElementById('acc-profile-motor').textContent = t.profileMotor;
        document.getElementById('acc-profile-custom').textContent = t.profileCustom;
        document.getElementById('acc-label-size').textContent = t.cardTextSize;
        document.getElementById('acc-label-contrast').textContent = t.cardContrast;
        document.getElementById('acc-label-cursor').textContent = t.cardCursor;
        document.getElementById('acc-label-mask').textContent = t.cardReadingMask;
        document.getElementById('acc-label-dyslexia').textContent = t.cardDyslexia;
        document.getElementById('acc-label-spacing').textContent = t.cardLineHeight;
        document.getElementById('acc-reset-text').textContent = t.reset;
    }

    // Actualizar elementos visuales del Drawer
    function updateUIElements() {
        const profileSelect = document.getElementById('acc-profile-select');
        if (profileSelect) profileSelect.value = accessibilityState.profile;

        const langSelect = document.getElementById('acc-lang-select');
        if (langSelect) langSelect.value = accessibilityState.lang;

        const cards = document.querySelectorAll('.accessibility-card');
        cards.forEach(card => {
            const type = card.getAttribute('data-type');
            const level = accessibilityState[type];

            card.classList.toggle('active', level > 0);

            const segments = card.querySelectorAll('.accessibility-segment');
            segments.forEach((seg, i) => {
                seg.classList.toggle('active', i < level);
            });
        });
    }

    // Aplicar escala de fuente
    function applyFontScaling(level) {
        const scaleMap = [1.0, 1.15, 1.30, 1.45];
        const multiplier = scaleMap[level];

        // Remover estilos previos
        let styleTag = document.getElementById('accessibility-text-scale');
        if (styleTag) styleTag.remove();

        if (level === 0) {
            htmlEl.style.fontSize = '';
            return;
        }

        // Crear una etiqueta de estilo que escale los tamaños absolutos de fuente (px) y rem
        styleTag = document.createElement('style');
        styleTag.id = 'accessibility-text-scale';
        
        // Estilos específicos para KJA que usan fuentes absolutas
        styleTag.innerHTML = `
            html { font-size: ${multiplier * 100}% !important; }
            h1, h2, h3, h4, h5, h6, p, li, span, a, button, input, select, textarea {
                /* Si tienen un font-size en px en shared.css, esto los escalará multiplicativamente */
            }
            .hero h2, .carousel-title { font-size: calc(70px * ${multiplier}) !important; }
            .services-title { font-size: calc(40px * ${multiplier}) !important; }
            @media (max-width: 768px) {
                .hero h2, .carousel-title { font-size: calc(40px * ${multiplier}) !important; }
            }
        `;
        document.head.appendChild(styleTag);
    }

    // Aplicar todos los ajustes de accesibilidad al DOM
    function applySettings() {
        // 1. Tamaño de texto
        applyFontScaling(accessibilityState.fontSize);

        // 2. Contrastes
        htmlEl.classList.remove('acc-contrast-high', 'acc-monochrome', 'acc-inverted');
        if (accessibilityState.contrast === 1) {
            htmlEl.classList.add('acc-contrast-high');
        } else if (accessibilityState.contrast === 2) {
            htmlEl.classList.add('acc-monochrome');
        } else if (accessibilityState.contrast === 3) {
            htmlEl.classList.add('acc-inverted');
        }

        // 3. Cursore gigante
        htmlEl.classList.remove('acc-cursor-1', 'acc-cursor-2');
        if (accessibilityState.cursor === 1) {
            htmlEl.classList.add('acc-cursor-1');
        } else if (accessibilityState.cursor === 2) {
            htmlEl.classList.add('acc-cursor-2');
        }

        // 4. Máscara de lectura (ADHD)
        const mask = document.getElementById('accessibility-reading-mask');
        if (mask) {
            if (accessibilityState.readingMask === 1) {
                mask.style.display = 'block';
                document.addEventListener('mousemove', updateMaskPosition);
            } else {
                mask.style.display = 'none';
                document.removeEventListener('mousemove', updateMaskPosition);
            }
        }

        // 5. Fuente disléxica (la hoja de OpenDyslexic se carga solo la primera vez que se activa)
        if (accessibilityState.dyslexia === 1 && !document.getElementById('acc-dyslexic-font')) {
            const link = document.createElement('link');
            link.id = 'acc-dyslexic-font';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/opendyslexic@1.0.3/open-dyslexic.min.css';
            document.head.appendChild(link);
        }
        htmlEl.classList.toggle('acc-dyslexia', accessibilityState.dyslexia === 1);

        // 6. Interlineado
        htmlEl.classList.remove('acc-line-height-1', 'acc-line-height-2');
        if (accessibilityState.lineHeight === 1) {
            htmlEl.classList.add('acc-line-height-1');
        } else if (accessibilityState.lineHeight === 2) {
            htmlEl.classList.add('acc-line-height-2');
        }

        // 7. Resaltado de enfoque
        htmlEl.classList.toggle('acc-focus-highlight', accessibilityState.focusHighlight === 1);

        // Traducir menú de accesibilidad si aplica
        updateTranslations(accessibilityState.lang);
        updateUIElements();
    }

    function updateMaskPosition(e) {
        htmlEl.style.setProperty('--mask-y', e.clientY + 'px');
    }

    function resetToDefault() {
        accessibilityState = {
            lang: accessibilityState.lang,
            profile: 'none',
            fontSize: 0,
            contrast: 0,
            cursor: 0,
            readingMask: 0,
            dyslexia: 0,
            lineHeight: 0,
            focusHighlight: 0
        };
        applySettings();
        saveState();
    }

    // Inicialización del Widget
    function initAccessibility() {
        loadState();
        injectAccessibilityWidget();
        applySettings();

        // Registrar listeners
        const fab = document.getElementById('accessibility-fab');
        const closeBtn = document.getElementById('accessibility-close');
        const overlay = document.getElementById('accessibility-overlay');
        const langSelect = document.getElementById('acc-lang-select');
        const profileSelect = document.getElementById('acc-profile-select');
        const resetBtn = document.getElementById('accessibility-reset');

        fab.addEventListener('click', openDrawer);
        closeBtn.addEventListener('click', closeDrawer);
        overlay.addEventListener('click', closeDrawer);

        langSelect.addEventListener('change', function () {
            accessibilityState.lang = this.value;
            applySettings();
            saveState();
        });

        profileSelect.addEventListener('change', function () {
            const selectedProfile = this.value;
            if (selectedProfile !== 'none' && selectedProfile !== 'custom') {
                const pSettings = profiles[selectedProfile];
                for (let key in pSettings) {
                    accessibilityState[key] = pSettings[key];
                }
                accessibilityState.profile = selectedProfile;
            } else if (selectedProfile === 'none') {
                resetToDefault();
                return;
            } else if (selectedProfile === 'custom') {
                accessibilityState.profile = 'custom';
            }
            applySettings();
            saveState();
        });

        // Cliks en tarjetas segmentadas
        const cards = document.querySelectorAll('.accessibility-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const type = card.getAttribute('data-type');
                const current = accessibilityState[type];
                const segments = parseInt(card.querySelector('.accessibility-bar').getAttribute('data-segments'), 10);
                const next = (current + 1) % (segments + 1);

                accessibilityState[type] = next;
                accessibilityState.profile = 'custom';
                applySettings();
                saveState();
            });

            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });

        resetBtn.addEventListener('click', resetToDefault);
    }

    // ============================================================
    // 2. WIDGET DE WHATSAPP AVANZADO
    // ============================================================
    function initWhatsAppWidget() {
        const whatsappLink = `https://wa.me/${CONFIG.whatsapp.number}?text=${encodeURIComponent(CONFIG.whatsapp.message)}`;
        
        const widgetHtml = `
            <div class="whatsapp-widget" id="whatsapp-widget">
                <div class="whatsapp-toast" id="whatsapp-toast">${CONFIG.whatsapp.toastText}</div>
                <a id="whatsapp-button" class="whatsapp-button" href="${whatsappLink}" target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp">
                    <span class="whatsapp-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                        </svg>
                    </span>
                    <span class="whatsapp-label">${CONFIG.whatsapp.labelText}</span>
                    <span class="whatsapp-badge" id="whatsapp-badge">1</span>
                </a>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', widgetHtml);

        const toast = document.getElementById('whatsapp-toast');
        const badge = document.getElementById('whatsapp-badge');

        // Mostrar Toast si no ha sido visto
        if (!localStorage.getItem('kja_whatsapp_toast_seen')) {
            setTimeout(() => {
                if (toast) {
                    toast.classList.add('visible');
                    localStorage.setItem('kja_whatsapp_toast_seen', 'true');
                    setTimeout(() => toast.classList.remove('visible'), 6000);
                }
            }, 3000);
        }

        // Mostrar/ocultar Badge
        if (localStorage.getItem('kja_whatsapp_badge_clicked')) {
            if (badge) badge.style.display = 'none';
        }

        const button = document.getElementById('whatsapp-button');
        if (button) {
            button.addEventListener('click', () => {
                localStorage.setItem('kja_whatsapp_badge_clicked', 'true');
                if (badge) badge.style.display = 'none';
            });
        }
    }

    // ============================================================
    // 3. PUNTERO GLOW SPOTLIGHT
    // ============================================================
    function initCursorSpotlight() {
        if (window.innerWidth <= 968) return;

        // Inyectar elementos de cursor
        const dot = document.createElement('div');
        dot.id = 'cursor-dot';
        const glow = document.createElement('div');
        glow.id = 'cursor-glow';
        document.body.appendChild(dot);
        document.body.appendChild(glow);

        let glowX = window.innerWidth / 2;
        let glowY = window.innerHeight / 2;
        let targetX = glowX;
        let targetY = glowY;

        // Mover el punto exactamente
        document.addEventListener('mousemove', (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
            dot.style.left = e.clientX + 'px';
            dot.style.top = e.clientY + 'px';
        });

        // Mover el halo con retardo suave (Lerp)
        function updateGlowPosition() {
            glowX += (targetX - glowX) * 0.08;
            glowY += (targetY - glowY) * 0.08;
            glow.style.left = glowX + 'px';
            glow.style.top = glowY + 'px';
            requestAnimationFrame(updateGlowPosition);
        }
        updateGlowPosition();

        // Mostrar y ocultar al salir de la ventana
        document.addEventListener('mouseenter', () => {
            dot.style.opacity = '1';
            glow.classList.add('active');
        });
        document.addEventListener('mouseleave', () => {
            dot.style.opacity = '0';
            glow.classList.remove('active');
        });

        // Activar al cargar
        setTimeout(() => {
            dot.style.opacity = '1';
            glow.classList.add('active');
        }, 500);

        // Hover en enlaces/botones
        const interactables = 'a, button, .service-btn, .faq-question, .promo-strip-cta, .therapy-pill-v3';
        document.querySelectorAll(interactables).forEach(el => {
            el.addEventListener('mouseenter', () => dot.classList.add('hovering'));
            el.addEventListener('mouseleave', () => dot.classList.remove('hovering'));
        });

        // Efecto del glow al pasar por tarjetas
        const cards = '.feature-card, .plan-card, .faq-premium-item, .cursos-card';
        document.querySelectorAll(cards).forEach(el => {
            el.addEventListener('mouseenter', () => glow.classList.add('on-card'));
            el.addEventListener('mouseleave', () => glow.classList.remove('on-card'));
        });
    }

    // ============================================================
    // INICIALIZACIÓN GLOBAL
    // ============================================================
    function initAll() {
        initAccessibility();
        initWhatsAppWidget();
        initCursorSpotlight();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();

/* ============================================================
   KJA SPLASH / PANTALLA DE CARGA
   Se muestra al entrar a cualquier página y se oculta cuando
   la web terminó de cargar (con un mínimo de tiempo visible
   para que no "parpadee" y un tope de seguridad).
   ============================================================ */
(function () {
    const splash = document.getElementById('kjaSplash');
    if (!splash) return;

    const MIN_VISIBLE = 550;   // ms mínimos en pantalla
    const MAX_VISIBLE = 4500;  // ms tope de seguridad
    const start = (window.performance && performance.now) ? performance.now() : Date.now();
    let hidden = false;

    function hideSplash() {
        if (hidden) return;
        hidden = true;

        const now = (window.performance && performance.now) ? performance.now() : Date.now();
        const wait = Math.max(0, MIN_VISIBLE - (now - start));

        setTimeout(function () {
            splash.classList.add('kja-splash--hidden');
            // Quitar del DOM al terminar la transición
            splash.addEventListener('transitionend', function handler(e) {
                if (e.target === splash && splash.parentNode) {
                    splash.parentNode.removeChild(splash);
                }
            });
        }, wait);
    }

    if (document.readyState === 'complete') {
        hideSplash();
    } else {
        window.addEventListener('load', hideSplash);
    }
    // Nunca dejar la pantalla bloqueada aunque algún recurso falle
    setTimeout(hideSplash, MAX_VISIBLE);
})();

/* ============================================================
   KJA LIQUID GLASS — filtro SVG de refracción para la píldora
   del navbar. Se inyecta una vez por página; el CSS lo aplica
   con filter: url(#kjaGlassDistortion). En navegadores sin
   soporte (Safari/Firefox) el vidrio cae al blur normal.
   ============================================================ */
(function () {
    function injectGlassFilter() {
        if (document.getElementById('kjaGlassDistortion')) return;
        const holder = document.createElement('div');
        holder.setAttribute('aria-hidden', 'true');
        holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        holder.innerHTML =
            '<svg width="0" height="0">' +
              '<filter id="kjaGlassDistortion" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
                '<feTurbulence type="fractalNoise" baseFrequency="0.006 0.014" numOctaves="2" seed="92" result="noise"/>' +
                '<feGaussianBlur in="noise" stdDeviation="2.2" result="soft"/>' +
                '<feDisplacementMap in="SourceGraphic" in2="soft" scale="72" xChannelSelector="R" yChannelSelector="G"/>' +
              '</filter>' +
            '</svg>';
        document.body.appendChild(holder);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectGlassFilter);
    } else {
        injectGlassFilter();
    }
})();
