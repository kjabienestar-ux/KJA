/* KJA · Página de videos cortos: cuadrícula + carrusel interactivo.
 * Los datos viven en assets/js/videos-data.js (VIDEO_DATA, VIDEOS_DEMO). */
(function (root) {
    'use strict';

    var PLATFORMS = {
        youtube: {
            label: 'YouTube',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z"/></svg>'
        },
        tiktok: {
            label: 'TikTok',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.6 6.7a4.8 4.8 0 0 1-3.8-4.3V2h-3.4v13.7a2.9 2.9 0 0 1-5.2 1.7 2.9 2.9 0 0 1 3.2-4.5V9.4a6.3 6.3 0 0 0-5.4 10.7 6.3 6.3 0 0 0 10.8-4.4v-7a8.2 8.2 0 0 0 4.8 1.5V6.8h-1Z"/></svg>'
        },
        facebook: {
            label: 'Facebook',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z"/></svg>'
        }
    };

    var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
        });
    }

    function formatDate(iso) {
        var parts = String(iso || '').split('-').map(Number);
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return '';
        return parts[2] + ' ' + MONTHS[parts[1] - 1] + ' ' + parts[0];
    }

    /* Del más reciente al más antiguo; a igual fecha se respeta el orden del archivo. */
    function sortVideos(list) {
        return (list || []).map(function (item, index) { return { item: item, index: index }; })
            .sort(function (a, b) {
                var byDate = String(b.item.fecha || '').localeCompare(String(a.item.fecha || ''));
                return byDate || a.index - b.index;
            })
            .map(function (entry) { return entry.item; });
    }

    /* Convierte el enlace público de cada red en su reproductor embebido. */
    function videoEmbed(item) {
        var raw = String(item && item.url || '').trim(), url;
        if (!raw) return null;
        try { url = new URL(raw); } catch (error) { return null; }
        if (url.protocol !== 'https:') return null;
        var host = url.hostname.replace(/^(www|m)\./, ''), path = url.pathname, match;

        if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
            var id = host === 'youtu.be' ? path.slice(1) : url.searchParams.get('v');
            if (!id && (match = path.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/))) id = match[1];
            if (!/^[\w-]{11}$/.test(id || '')) return null;
            return { platform: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1' };
        }
        if (host === 'tiktok.com' && (match = path.match(/\/video\/(\d{8,25})/))) {
            return { platform: 'tiktok', src: 'https://www.tiktok.com/player/v1/' + match[1] + '?autoplay=1&rel=0&description=0&music_info=0' };
        }
        /* Instagram no se admite: su reproductor insertado trae el marco de la app y no encaja en el carrusel. */
        if (host === 'facebook.com' || host === 'fb.watch') {
            return { platform: 'facebook', src: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url.href) + '&show_text=false&autoplay=true&width=360' };
        }
        return null;
    }

    /* El enlace manda sobre el campo plataforma: así un error al llenarlo no muestra el ícono equivocado. */
    function platformOf(item) {
        var embed = videoEmbed(item);
        if (embed) return embed.platform;
        return PLATFORMS[item && item.plataforma] ? item.plataforma : 'youtube';
    }

    /* Vista previa de la card: el mismo reproductor, pausado y en silencio, para mostrar un fotograma real. */
    function previewSrc(item) {
        var embed = videoEmbed(item);
        if (!embed) return '';
        var src = embed.src;
        if (embed.platform === 'youtube') return src.replace('autoplay=1', 'autoplay=0&controls=0&mute=1&disablekb=1');
        if (embed.platform === 'facebook') return src.replace('autoplay=true', 'autoplay=false').replace('show_text=false', 'show_text=false&mute=1');
        return src.replace('autoplay=1', 'autoplay=0');
    }

    /* Portada: imagen propia, vista previa del video (solo en cards) o una portada generada con la identidad de KJA. */
    function coverHtml(item, live) {
        if (item.portada) {
            return '<img class="kv-cover-img" src="' + esc(item.portada) + '" alt="" loading="lazy" decoding="async">';
        }
        var preview = live ? previewSrc(item) : '';
        return '<span class="kv-art">' +
            (preview ? '<span class="kv-live" data-preview-src="' + esc(preview) + '" aria-hidden="true"></span>' : '') +
            '<span class="kv-art-logo"><img src="images/logo/kja.webp" alt="" width="418" height="121" loading="lazy" decoding="async"></span>' +
            '<span class="kv-art-eyebrow">' + esc(item.tema) + '</span>' +
            '<span class="kv-art-title">' + esc(item.titulo) + '</span>' +
            '<span class="kv-art-ring" aria-hidden="true"></span>' +
        '</span>';
    }

    function badgesHtml(item) {
        var platform = PLATFORMS[platformOf(item)];
        return '<span class="kv-platform" title="' + platform.label + '">' + platform.icon + '<span class="kv-sr">' + platform.label + '</span></span>' +
            (item.duracion ? '<span class="kv-duration">' + esc(item.duracion) + '</span>' : '') +
            (item.ejemplo ? '<span class="kv-sample">Ejemplo</span>' : '');
    }

    var PLAY_ICON = '<span class="kv-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg></span>';

    function cardHtml(item, index) {
        return '<li class="kv-item">' +
            '<button type="button" class="kv-card" data-video-index="' + index + '" aria-haspopup="dialog" aria-label="Ver video: ' + esc(item.titulo) + '">' +
                '<span class="kv-cover">' + coverHtml(item, true) + badgesHtml(item) + PLAY_ICON + '</span>' +
                '<span class="kv-card-body">' +
                    '<span class="kv-card-title">' + esc(item.titulo) + '</span>' +
                    '<span class="kv-card-meta"><i></i>' + esc(item.tema) + '<span aria-hidden="true">·</span>' + esc(formatDate(item.fecha)) + '</span>' +
                '</span>' +
            '</button>' +
        '</li>';
    }

    /* Los iframes se crean solo cuando la card entra en pantalla, para no cargar todos los reproductores a la vez. */
    function mountPreviews(doc) {
        var slots = doc.querySelectorAll('.kv-live[data-preview-src]');
        if (!slots.length || typeof IntersectionObserver === 'undefined') return;
        /* El iframe mide siempre 360x640 y se reduce al tamaño de la portada: así la interfaz del reproductor conserva sus proporciones en cualquier pantalla. */
        var fit = function (slot) { if (slot.clientWidth) slot.style.setProperty('--kv-s', String(slot.clientWidth / 360)); };
        var resizer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (items) { items.forEach(function (item) { fit(item.target); }); }) : null;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var slot = entry.target;
                observer.unobserve(slot);
                fit(slot);
                if (resizer) resizer.observe(slot);
                var frame = doc.createElement('iframe');
                frame.setAttribute('tabindex', '-1');
                frame.setAttribute('aria-hidden', 'true');
                frame.setAttribute('loading', 'lazy');
                frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                frame.title = '';
                frame.addEventListener('load', function () { slot.classList.add('is-ready'); });
                frame.src = slot.getAttribute('data-preview-src');
                slot.appendChild(frame);
            });
        }, { rootMargin: '200px' });
        for (var i = 0; i < slots.length; i++) observer.observe(slots[i]);
    }

    function createVideosPage(doc, data, demo) {
        var videos = sortVideos(data);
        var state = { index: 0, open: false, trigger: null, mountTimer: null, swipeX: null };
        var $ = function (id) { return doc.getElementById(id); };
        var viewer = $('kv-viewer'), stage = $('kv-stage');

        function renderPage() {
            var grid = $('kv-grid'), empty = $('kv-empty'), count = $('kv-count'), demoNote = $('kv-demo');
            if (count) count.textContent = videos.length + (videos.length === 1 ? ' video' : ' videos');
            if (demoNote) demoNote.hidden = !demo;
            if (grid) grid.innerHTML = videos.map(cardHtml).join('');
            if (empty) empty.hidden = videos.length > 0;
            renderFeatured();
            mountPreviews(doc);
        }

        function renderFeatured() {
            var featured = $('kv-featured');
            if (!featured) return;
            if (!videos.length) { featured.hidden = true; return; }
            var stack = videos.slice(0, 3);
            featured.innerHTML = '<div class="kv-feature-stack">' + stack.map(function (item, index) {
                return '<button type="button" class="kv-feature-card kv-feature-card--' + (index + 1) + '" data-video-index="' + index + '" aria-haspopup="dialog" ' +
                    (index ? 'tabindex="-1" aria-hidden="true"' : 'aria-label="Ver el video más reciente: ' + esc(item.titulo) + '"') + '>' +
                    '<span class="kv-cover">' + coverHtml(item, index === 0) + badgesHtml(item) + PLAY_ICON + '</span>' +
                '</button>';
            }).join('') + '</div>' +
            '<p class="kv-feature-label"><b>Más reciente</b>' + esc(videos[0].titulo) + '</p>';
        }

        function slideHtml(item, index) {
            return '<div class="kv-slide" data-slide-index="' + index + '">' +
                '<div class="kv-slide-media"><span class="kv-cover">' + coverHtml(item, true) + badgesHtml(item) + PLAY_ICON + '</span></div>' +
                '<div class="kv-slide-caption"><b>' + esc(item.titulo) + '</b><small>' + esc(item.tema) + '</small></div>' +
            '</div>';
        }

        function buildViewer() {
            stage.innerHTML = videos.map(slideHtml).join('');
            mountPreviews(doc);
            var dots = $('kv-dots');
            if (dots) {
                dots.innerHTML = videos.map(function (item, index) {
                    return '<button type="button" class="kv-dot" data-dot-index="' + index + '" aria-label="Ir al video ' + (index + 1) + ': ' + esc(item.titulo) + '"></button>';
                }).join('');
            }
        }

        function layoutSlides() {
            var slides = stage.querySelectorAll('.kv-slide');
            for (var i = 0; i < slides.length; i++) {
                var offset = i - state.index, distance = Math.abs(offset), slide = slides[i];
                slide.style.setProperty('--offset', String(offset));
                slide.style.setProperty('--distance', String(Math.min(distance, 3)));
                slide.style.zIndex = String(10 - Math.min(distance, 9));
                slide.classList.toggle('is-active', offset === 0);
                slide.classList.toggle('is-near', distance > 0 && distance <= 2);
                slide.classList.toggle('is-far', distance > 2);
                slide.setAttribute('aria-hidden', offset === 0 ? 'false' : 'true');
            }
        }

        function unmountPlayer() {
            clearTimeout(state.mountTimer);
            var frames = stage.querySelectorAll('.kv-player');
            for (var i = 0; i < frames.length; i++) frames[i].parentNode.removeChild(frames[i]);
        }

        /* Solo el video central tiene reproductor: al cambiar se destruye y el anterior deja de sonar. */
        function mountPlayer(immediate) {
            unmountPlayer();
            var mount = function () {
                if (!state.open) return;
                var item = videos[state.index], slide = stage.querySelector('[data-slide-index="' + state.index + '"] .kv-slide-media');
                if (!slide) return;
                var embed = videoEmbed(item), player = doc.createElement('div');
                player.className = 'kv-player';
                if (embed) {
                    var frame = doc.createElement('iframe');
                    frame.src = embed.src;
                    frame.title = item.titulo;
                    frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write');
                    frame.setAttribute('allowfullscreen', '');
                    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                    frame.setAttribute('loading', 'eager');
                    player.classList.add('kv-player--' + embed.platform);
                    player.appendChild(frame);
                } else {
                    player.classList.add('kv-player--placeholder');
                    player.innerHTML = '<span class="kv-placeholder"><b>' + (item.ejemplo ? 'Video de ejemplo' : 'Video no disponible') + '</b>' +
                        (item.ejemplo ? 'Aquí se reproducirá el video de ' + PLATFORMS[platformOf(item)].label + ' cuando se agregue su enlace.' : 'Ábrelo directamente en ' + PLATFORMS[platformOf(item)].label + '.') + '</span>';
                }
                slide.appendChild(player);
            };
            if (immediate) mount(); else state.mountTimer = setTimeout(mount, 260);
        }

        function syncDetails() {
            var item = videos[state.index], platform = PLATFORMS[platformOf(item)];
            var setText = function (id, text) { var el = $(id); if (el) el.textContent = text; };
            setText('kv-viewer-title', item.titulo);
            setText('kv-viewer-desc', item.descripcion || '');
            setText('kv-viewer-meta', [item.tema, formatDate(item.fecha), platform.label].filter(Boolean).join(' · '));
            setText('kv-counter', (state.index + 1) + ' / ' + videos.length);
            setText('kv-live', 'Video ' + (state.index + 1) + ' de ' + videos.length + ': ' + item.titulo);
            var thumb = $('kv-viewer-thumb');
            if (thumb) thumb.innerHTML = coverHtml(item);
            var external = $('kv-external');
            if (external) {
                external.hidden = !item.url;
                if (item.url) external.href = item.url;
                var label = external.querySelector('span');
                if (label) label.textContent = 'Ver en ' + platform.label;
            }
            var dots = doc.querySelectorAll('.kv-dot');
            for (var i = 0; i < dots.length; i++) {
                var current = Number(dots[i].getAttribute('data-dot-index')) === state.index;
                dots[i].setAttribute('aria-current', current ? 'true' : 'false');
            }
            var single = videos.length < 2, prev = $('kv-prev'), next = $('kv-next');
            if (prev) prev.hidden = single;
            if (next) next.hidden = single;
        }

        function go(index, immediate) {
            if (!videos.length) return;
            state.index = (index + videos.length) % videos.length;
            layoutSlides();
            syncDetails();
            mountPlayer(immediate);
        }

        function focusables() {
            return Array.prototype.filter.call(
                viewer.querySelectorAll('button, a[href], iframe, [tabindex]:not([tabindex="-1"])'),
                function (el) { return !el.hidden && !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]'); }
            );
        }

        function open(index, trigger) {
            if (!viewer || !videos.length) return;
            state.open = true;
            state.trigger = trigger || doc.activeElement;
            viewer.hidden = false;
            doc.documentElement.classList.add('modal-open');
            doc.body.classList.add('modal-open');
            go(index, true);
            var close = $('kv-close');
            if (close && close.focus) close.focus();
        }

        function close() {
            if (!state.open) return;
            state.open = false;
            unmountPlayer();
            viewer.hidden = true;
            doc.documentElement.classList.remove('modal-open');
            doc.body.classList.remove('modal-open');
            if (state.trigger && state.trigger.focus) state.trigger.focus();
        }

        function bind() {
            doc.addEventListener('click', function (event) {
                var target = event.target && event.target.closest ? event.target : null;
                if (!target) return;
                var card = target.closest('[data-video-index]');
                if (card && !viewer.contains(card)) { event.preventDefault(); open(Number(card.getAttribute('data-video-index')), card); return; }
                if (!state.open) return;
                if (target.closest('[data-kv-close]')) { close(); return; }
                var dot = target.closest('[data-dot-index]');
                if (dot) { go(Number(dot.getAttribute('data-dot-index'))); return; }
                var slide = target.closest('.kv-slide');
                if (slide && !slide.classList.contains('is-active')) go(Number(slide.getAttribute('data-slide-index')));
            });
            var prev = $('kv-prev'), next = $('kv-next');
            if (prev) prev.addEventListener('click', function () { go(state.index - 1); });
            if (next) next.addEventListener('click', function () { go(state.index + 1); });
            doc.addEventListener('keydown', function (event) {
                if (!state.open) return;
                if (event.key === 'Escape') { event.preventDefault(); close(); return; }
                if (event.key === 'ArrowRight') { event.preventDefault(); go(state.index + 1); return; }
                if (event.key === 'ArrowLeft') { event.preventDefault(); go(state.index - 1); return; }
                if (event.key === 'Tab') {
                    var items = focusables();
                    if (!items.length) return;
                    var first = items[0], last = items[items.length - 1];
                    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
                }
            });
            /* Deslizar en pantallas táctiles (fuera del reproductor, que captura sus propios gestos). */
            stage.addEventListener('touchstart', function (event) { state.swipeX = event.touches[0].clientX; }, { passive: true });
            stage.addEventListener('touchend', function (event) {
                if (state.swipeX == null) return;
                var delta = event.changedTouches[0].clientX - state.swipeX;
                state.swipeX = null;
                if (Math.abs(delta) > 45) go(state.index + (delta < 0 ? 1 : -1));
            }, { passive: true });
        }

        renderPage();
        if (viewer && stage) { buildViewer(); bind(); }

        return {
            videos: videos,
            state: state,
            open: open,
            close: close,
            next: function () { go(state.index + 1); },
            prev: function () { go(state.index - 1); }
        };
    }

    root.KJAVideos = { sortVideos: sortVideos, videoEmbed: videoEmbed, platformOf: platformOf, formatDate: formatDate, previewSrc: previewSrc, coverHtml: coverHtml, createVideosPage: createVideosPage };

    /* VIDEO_DATA y VIDEOS_DEMO son const globales de videos-data.js: no cuelgan de window. */
    if (typeof VIDEO_DATA !== 'undefined' && root.document && root.document.getElementById('kv-grid')) {
        root.KJAVideos.page = createVideosPage(root.document, VIDEO_DATA, typeof VIDEOS_DEMO !== 'undefined' && VIDEOS_DEMO === true);
    }
})(typeof window !== 'undefined' ? window : globalThis);
