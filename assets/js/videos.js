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
            return { platform: 'tiktok', src: 'https://www.tiktok.com/player/v1/' + match[1] + '?autoplay=1&muted=0&rel=0&description=0&music_info=0' };
        }
        /* Instagram no se admite: su reproductor insertado trae el marco de la app y no encaja en el carrusel. */
        if (host === 'facebook.com' || host === 'fb.watch') {
            return { platform: 'facebook', src: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url.href) + '&show_text=false&autoplay=true&mute=0&width=360' };
        }
        return null;
    }

    /* El enlace manda sobre el campo plataforma: así un error al llenarlo no muestra el ícono equivocado. */
    function platformOf(item) {
        var embed = videoEmbed(item);
        if (embed) return embed.platform;
        return PLATFORMS[item && item.plataforma] ? item.plataforma : 'youtube';
    }

    /* Portada estática: imagen propia (vertical 9:16) o una generada con la identidad de KJA.
     * Nunca carga el reproductor: el único iframe de la página es el del video abierto en el carrusel. */
    function coverHtml(item) {
        if (item.portada) {
            return '<img class="kv-cover-img" src="' + esc(item.portada) + '" alt="" loading="lazy" decoding="async">';
        }
        return '<span class="kv-art">' +
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
                '<span class="kv-cover">' + coverHtml(item) + badgesHtml(item) + PLAY_ICON + '</span>' +
                '<span class="kv-card-body">' +
                    '<span class="kv-card-title">' + esc(item.titulo) + '</span>' +
                    '<span class="kv-card-meta"><i></i>' + esc(item.tema) + '<span aria-hidden="true">·</span>' + esc(formatDate(item.fecha)) + '</span>' +
                '</span>' +
            '</button>' +
        '</li>';
    }

    function createVideosPage(doc, data, demo) {
        var videos = sortVideos(data);
        var state = { index: 0, open: false, trigger: null, mountTimer: null, swipeX: null, video: null, muted: false, failed: {}, ambient: 0, toastTimer: null };
        var $ = function (id) { return doc.getElementById(id); };
        var setText = function (id, text) { var el = $(id); if (el) el.textContent = text; };
        var viewer = $('kv-viewer'), stage = $('kv-stage');

        function renderPage() {
            var grid = $('kv-grid'), empty = $('kv-empty'), count = $('kv-count'), demoNote = $('kv-demo');
            if (count) count.textContent = videos.length + (videos.length === 1 ? ' video' : ' videos');
            if (demoNote) demoNote.hidden = !demo;
            if (grid) grid.innerHTML = videos.map(cardHtml).join('');
            if (empty) empty.hidden = videos.length > 0;
            renderFeatured();
        }

        function renderFeatured() {
            var featured = $('kv-featured');
            if (!featured) return;
            if (!videos.length) { featured.hidden = true; return; }
            var stack = videos.slice(0, 3);
            featured.innerHTML = '<div class="kv-feature-stack">' + stack.map(function (item, index) {
                return '<button type="button" class="kv-feature-card kv-feature-card--' + (index + 1) + '" data-video-index="' + index + '" aria-haspopup="dialog" ' +
                    (index ? 'tabindex="-1" aria-hidden="true"' : 'aria-label="Ver el video más reciente: ' + esc(item.titulo) + '"') + '>' +
                    '<span class="kv-cover">' + coverHtml(item) + badgesHtml(item) + PLAY_ICON + '</span>' +
                '</button>';
            }).join('') + '</div>' +
            '<p class="kv-feature-label"><b>Más reciente</b>' + esc(videos[0].titulo) + '</p>';
        }

        function slideHtml(item, index) {
            return '<div class="kv-slide" data-slide-index="' + index + '">' +
                '<div class="kv-slide-media"><span class="kv-cover">' + coverHtml(item) + badgesHtml(item) + PLAY_ICON + '</span></div>' +
                '<div class="kv-slide-caption"><b>' + esc(item.titulo) + '</b><small>' + esc(item.tema) + '</small></div>' +
            '</div>';
        }

        function buildViewer() {
            stage.innerHTML = videos.map(slideHtml).join('');
            var dots = $('kv-dots');
            if (dots) {
                dots.innerHTML = videos.map(function (item, index) {
                    return '<button type="button" class="kv-dot" data-dot-index="' + index + '" aria-label="Ir al video ' + (index + 1) + ': ' + esc(item.titulo) + '">' +
                        (item.portada ? '<img src="' + esc(item.portada) + '" alt="" loading="lazy" decoding="async">' : '') +
                    '</button>';
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

        function setBuffering(on) {
            viewer.classList.toggle('is-buffering', on);
        }

        function setHint(on) {
            var hint = $('kv-hint');
            if (hint) hint.hidden = !on;
        }

        /* Íconos y etiquetas de los controles según el estado real del video. */
        function syncControls() {
            var video = state.video, muted = !video || video.muted, paused = !video || video.paused;
            var sound = $('kv-sound'), toggle = $('kv-toggle');
            if (sound) sound.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
            if (toggle) toggle.setAttribute('aria-label', paused ? 'Reproducir' : 'Pausar');
            viewer.classList.toggle('is-muted', muted);
            viewer.classList.toggle('is-paused', paused);
        }

        function showProgress() {
            var video = state.video, bar = $('kv-progress');
            var ratio = video && video.duration ? Math.min(video.currentTime / video.duration, 1) : 0;
            if (bar) bar.style.transform = 'scaleX(' + ratio + ')';
            var dot = viewer.querySelector('.kv-dot[aria-current="true"]');
            if (dot) dot.style.setProperty('--p', String(ratio));
        }

        /* Un solo <video> para todo el carrusel: tras el primer clic el navegador ya lo deja sonar, así también
         * suena al pasar de video o cuando avanza solo al terminar uno (en iPhone es la única forma). */
        function nativeVideo() {
            if (state.video) return state.video;
            var video = doc.createElement('video');
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('preload', 'auto');
            video.addEventListener('timeupdate', showProgress);
            ['play', 'pause', 'volumechange'].forEach(function (type) { video.addEventListener(type, syncControls); });
            video.addEventListener('waiting', function () { setBuffering(true); });
            video.addEventListener('playing', function () { setBuffering(false); });
            video.addEventListener('ended', function () { if (state.open && videos.length > 1) go(state.index + 1); });
            video.addEventListener('error', function () {
                /* Si el archivo no carga, ese video vuelve al reproductor de su red social. */
                if (!state.open || !video.getAttribute('src')) return;
                state.failed[state.index] = true;
                mountPlayer(true);
            });
            state.video = video;
            return video;
        }

        /* Deja de descargar el archivo (al cerrar o al pasar a un video sin MP4 propio). */
        function releaseVideo() {
            var video = state.video;
            if (!video || !video.getAttribute('src')) return;
            video.removeAttribute('src');
            video.load();
        }

        function playNative() {
            var video = state.video;
            setHint(false);
            video.muted = state.muted;
            var attempt = video.play();
            if (attempt && attempt.catch) attempt.catch(function (error) {
                if (!error || error.name !== 'NotAllowedError' || video.muted) return;
                /* El navegador no dejó sonar: sigue en silencio y se ofrece activar el sonido con un toque. */
                video.muted = true;
                setHint(true);
                var retry = video.play();
                if (retry && retry.catch) retry.catch(function () {});
            });
        }

        function isNative() {
            return viewer.getAttribute('data-player') === 'native' && state.video && state.video.getAttribute('src');
        }

        function togglePlay() {
            if (!isNative()) return;
            if (state.video.paused) playNative(); else state.video.pause();
        }

        function toggleSound() {
            if (!isNative()) return;
            var video = state.video, hint = $('kv-hint'), blocked = hint && !hint.hidden;
            state.muted = !video.muted;
            video.muted = state.muted;
            setHint(false);
            if (blocked && video.paused) playNative();
        }

        function toast(text) {
            var el = $('kv-toast');
            setText('kv-live', text);
            if (!el) return;
            el.textContent = text;
            el.hidden = false;
            clearTimeout(state.toastTimer);
            state.toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
        }

        function share() {
            var item = videos[state.index], url = item.url || doc.location.href, nav = root.navigator || {};
            if (nav.share) {
                nav.share({ title: item.titulo, url: url }).catch(function () {});
            } else if (nav.clipboard && nav.clipboard.writeText) {
                nav.clipboard.writeText(url).then(function () { toast('Enlace copiado'); }, function () { toast('No se pudo copiar el enlace'); });
            }
        }

        /* Fondo ambiental: dos capas que se alternan para cambiar de portada con un fundido. */
        function setAmbient(src) {
            var layers = viewer.querySelectorAll('.kv-ambient');
            if (layers.length < 2) return;
            state.ambient = 1 - state.ambient;
            layers[state.ambient].style.backgroundImage = src ? 'url("' + String(src).replace(/["\\\n]/g, '') + '")' : 'none';
            layers[state.ambient].classList.add('is-on');
            layers[1 - state.ambient].classList.remove('is-on');
        }

        function unmountPlayer() {
            clearTimeout(state.mountTimer);
            if (state.video) state.video.pause();
            setBuffering(false);
            setHint(false);
            var frames = stage.querySelectorAll('.kv-player');
            for (var i = 0; i < frames.length; i++) frames[i].parentNode.removeChild(frames[i]);
        }

        /* Solo el video central tiene reproductor: al cambiar se quita y el anterior deja de sonar.
         * Con MP4 propio (campo video) se reproduce aquí mismo, dentro del clic y con sonido.
         * Sin él se usa el reproductor de la red: en el acto al abrir y, al pasar de video, tras la animación
         * (así no carga los que se saltan rápido); ahí el sonido lo decide la red: Facebook lo bloquea y TikTok arranca en silencio. */
        function mountPlayer(immediate) {
            unmountPlayer();
            var item = videos[state.index], native = !!item.video && !state.failed[state.index];
            viewer.setAttribute('data-player', native ? 'native' : 'embed');
            var sound = $('kv-sound'), toggle = $('kv-toggle');
            if (sound) sound.hidden = !native;
            if (toggle) toggle.hidden = !native;
            if (!native) releaseVideo();
            var mount = function () {
                if (!state.open) return;
                var slide = stage.querySelector('[data-slide-index="' + state.index + '"] .kv-slide-media');
                if (!slide) return;
                var player = doc.createElement('div');
                player.className = 'kv-player';
                if (native) {
                    var video = nativeVideo();
                    player.classList.add('kv-player--native');
                    video.setAttribute('aria-label', item.titulo);
                    if (item.portada) video.setAttribute('poster', item.portada); else video.removeAttribute('poster');
                    video.setAttribute('src', item.video);
                    player.appendChild(video);
                    slide.appendChild(player);
                    playNative();
                    syncControls();
                    return;
                }
                var embed = videoEmbed(item);
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
            if (immediate || native) mount(); else state.mountTimer = setTimeout(mount, 260);
        }

        function syncDetails() {
            var item = videos[state.index], platform = PLATFORMS[platformOf(item)];
            setText('kv-viewer-title', item.titulo);
            setText('kv-viewer-desc', item.descripcion || '');
            var meta = $('kv-viewer-meta');
            if (meta) meta.innerHTML = (item.tema ? '<b>' + esc(item.tema) + '</b>' : '') + esc([formatDate(item.fecha), platform.label].filter(Boolean).join(' · '));
            setText('kv-counter', (state.index + 1) + ' / ' + videos.length);
            setText('kv-live', 'Video ' + (state.index + 1) + ' de ' + videos.length + ': ' + item.titulo);
            setAmbient(item.portada);
            var external = $('kv-external');
            if (external) {
                external.hidden = !item.url;
                if (item.url) external.href = item.url;
                var label = external.querySelector('span');
                if (label) label.textContent = 'Ver en ' + platform.label;
            }
            var dots = viewer.querySelectorAll('.kv-dot'), currentDot = null;
            for (var i = 0; i < dots.length; i++) {
                var current = Number(dots[i].getAttribute('data-dot-index')) === state.index;
                dots[i].setAttribute('aria-current', current ? 'true' : 'false');
                dots[i].style.removeProperty('--p');
                if (current) currentDot = dots[i];
            }
            /* La miniatura actual siempre a la vista: con muchos videos la tira se desplaza. */
            var strip = $('kv-dots');
            if (strip && currentDot) strip.scrollLeft = Math.max(0, currentDot.offsetLeft - (strip.clientWidth - currentDot.offsetWidth) / 2);
            var bar = $('kv-progress');
            if (bar) bar.style.transform = 'scaleX(0)';
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
            /* Con video propio el foco va a pausar/reproducir (así la barra espaciadora lo controla); si no, a cerrar. */
            var focus = $('kv-toggle');
            if (!focus || focus.hidden) focus = $('kv-close');
            if (focus && focus.focus) focus.focus();
        }

        function close() {
            if (!state.open) return;
            state.open = false;
            unmountPlayer();
            releaseVideo();
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
                var action = target.closest('[data-kv-action]');
                if (action) {
                    var name = action.getAttribute('data-kv-action');
                    if (name === 'sound') toggleSound(); else if (name === 'toggle') togglePlay(); else if (name === 'share') share();
                    return;
                }
                if (target.closest('.kv-player--native')) { togglePlay(); return; }
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
                /* Atajos como en YouTube: K o la barra espaciadora pausan, M silencia. */
                var plain = !event.ctrlKey && !event.metaKey && !event.altKey;
                var onControl = doc.activeElement && /^(BUTTON|A)$/.test(doc.activeElement.tagName);
                if (plain && (event.key === 'k' || event.key === 'K' || (event.key === ' ' && !onControl))) { event.preventDefault(); togglePlay(); return; }
                if (plain && (event.key === 'm' || event.key === 'M')) { event.preventDefault(); toggleSound(); return; }
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

    root.KJAVideos = { sortVideos: sortVideos, videoEmbed: videoEmbed, platformOf: platformOf, formatDate: formatDate, coverHtml: coverHtml, createVideosPage: createVideosPage };

    /* VIDEO_DATA y VIDEOS_DEMO son const globales de videos-data.js: no cuelgan de window. */
    if (typeof VIDEO_DATA !== 'undefined' && root.document && root.document.getElementById('kv-grid')) {
        root.KJAVideos.page = createVideosPage(root.document, VIDEO_DATA, typeof VIDEOS_DEMO !== 'undefined' && VIDEOS_DEMO === true);
    }
})(typeof window !== 'undefined' ? window : globalThis);
