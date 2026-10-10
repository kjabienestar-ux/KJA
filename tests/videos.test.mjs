import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
// Cajas de primer nivel de un MP4: si "moov" va antes que "mdat", el video empieza sin descargarse entero.
const mp4Boxes = file => {
    const buf = fs.readFileSync(new URL(`../${file}`, import.meta.url)), boxes = [];
    for (let pos = 0; pos + 8 <= buf.length && boxes.length < 20;) {
        let size = buf.readUInt32BE(pos);
        boxes.push(buf.toString('latin1', pos + 4, pos + 8));
        if (size === 1) size = Number(buf.readBigUInt64BE(pos + 8));
        if (size < 8) break;
        pos += size;
    }
    return boxes;
};
const html = read('videos.html');
const pageJs = read('assets/js/videos.js');
const dataJs = read('assets/js/videos-data.js');
const css = read('assets/css/paginas/videos.css');

// Carga videos.html sin sus scripts externos y ejecuta la página con los datos indicados.
// setup(window), si se pasa, prepara el entorno (APIs del navegador, temporizadores) antes de ejecutarla.
function page(data, setup) {
    const dom = new JSDOM(html.replace(/<script\b[^>]*src=[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'http://localhost/videos.html' });
    const { window } = dom;
    window.setTimeout = fn => { fn(); return 0; };
    if (setup) setup(window);
    // var y no const: cada eval indirecto tiene su propio ámbito léxico (en el navegador los scripts sí lo comparten).
    window.eval(`var VIDEOS_DEMO = ${data.demo === true}; var VIDEO_DATA = ${JSON.stringify(data.videos)};`);
    window.eval(pageJs);
    return window;
}

const sample = [
    { titulo: 'Antiguo', tema: 'Pareja', fecha: '2026-08-01', plataforma: 'facebook', url: '' },
    { titulo: 'Reciente', tema: 'Ansiedad', fecha: '2026-10-04', plataforma: 'youtube', url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' },
    { titulo: 'Medio', tema: 'Autoestima', fecha: '2026-09-15', plataforma: 'tiktok', url: 'https://www.tiktok.com/@kjabienestar/video/7412345678901234567', ejemplo: true }
];

test('videos are listed from the most recent to the oldest', () => {
    const window = page({ videos: sample, demo: true });
    const titles = [...window.document.querySelectorAll('.kv-card-title')].map(el => el.textContent);
    assert.deepEqual(titles, ['Reciente', 'Medio', 'Antiguo']);
    assert.equal(window.document.getElementById('kv-count').textContent, '3 videos');
    assert.equal(window.document.getElementById('kv-demo').hidden, false);
    assert.match(window.document.querySelector('.kv-feature-label').textContent, /Más reciente\s*Reciente/);
    assert.equal(window.document.querySelectorAll('.kv-sample').length >= 1, true);
});

test('each platform link becomes its embeddable player', () => {
    const { KJAVideos } = page({ videos: [] });
    const embed = url => KJAVideos.videoEmbed({ url });
    assert.equal(embed('https://www.youtube.com/shorts/dQw4w9WgXcQ').src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0&modestbranding=1');
    assert.equal(embed('https://youtu.be/dQw4w9WgXcQ').platform, 'youtube');
    assert.equal(embed('https://www.youtube.com/watch?v=dQw4w9WgXcQ').platform, 'youtube');
    assert.equal(embed('https://www.tiktok.com/@kjabienestar/video/7412345678901234567').src, 'https://www.tiktok.com/player/v1/7412345678901234567?autoplay=1&muted=0&rel=0&description=0&music_info=0');
    const facebook = embed('https://www.facebook.com/reel/1234567890').src;
    assert.match(facebook, /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Freel%2F1234567890&show_text=false/);
    assert.equal(new URL(facebook).searchParams.get('autoplay'), 'true');
    assert.equal(new URL(facebook).searchParams.get('mute'), '0', 'arranca solo y pide sonido');
    for (const bad of ['', 'no es un enlace', 'https://www.instagram.com/reel/C9abcDEF12/', 'http://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://vimeo.com/123', 'https://www.youtube.com/shorts/corto', 'javascript:alert(1)']) {
        assert.equal(embed(bad), null, bad);
    }
    assert.equal(KJAVideos.platformOf({ plataforma: 'tiktok', url: 'https://youtu.be/dQw4w9WgXcQ' }), 'youtube');
    assert.equal(KJAVideos.platformOf({ plataforma: 'facebook', url: '' }), 'facebook');
    assert.equal(KJAVideos.platformOf({ plataforma: 'instagram', url: '' }), 'youtube', 'Instagram ya no se admite');
});

test('the carousel opens on the chosen video and keeps a single live player', () => {
    const window = page({ videos: sample });
    const doc = window.document, viewer = doc.getElementById('kv-viewer');
    doc.querySelectorAll('.kv-card')[1].click();
    assert.equal(viewer.hidden, false);
    assert.equal(doc.getElementById('kv-counter').textContent, '2 / 3');
    assert.equal(doc.getElementById('kv-viewer-title').textContent, 'Medio');
    assert.equal(doc.querySelectorAll('.kv-player').length, 1);
    assert.match(doc.querySelector('.kv-slide.is-active .kv-player iframe').src, /tiktok\.com\/player\/v1\//);
    assert.ok(doc.body.classList.contains('modal-open'));

    doc.getElementById('kv-next').click();
    assert.equal(doc.getElementById('kv-counter').textContent, '3 / 3');
    assert.equal(doc.querySelectorAll('.kv-player').length, 1);
    assert.match(doc.querySelector('.kv-slide.is-active .kv-player').textContent, /Video no disponible/);

    doc.getElementById('kv-next').click();
    assert.equal(doc.getElementById('kv-counter').textContent, '1 / 3', 'vuelve al inicio');
    doc.getElementById('kv-prev').click();
    assert.equal(doc.getElementById('kv-counter').textContent, '3 / 3', 'retrocede de forma circular');

    doc.querySelector('[data-dot-index="0"]').click();
    assert.match(doc.querySelector('.kv-slide.is-active iframe').src, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    assert.equal(doc.getElementById('kv-external').href, 'https://www.youtube.com/shorts/dQw4w9WgXcQ');

    doc.querySelector('.kv-slide[data-slide-index="1"]').click();
    assert.equal(doc.getElementById('kv-counter').textContent, '2 / 3', 'pulsar una vecina la centra');

    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.equal(doc.getElementById('kv-counter').textContent, '1 / 3');
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(viewer.hidden, true);
    assert.equal(doc.querySelectorAll('.kv-player').length, 0, 'al cerrar se detiene el video');
    assert.equal(doc.body.classList.contains('modal-open'), false);
    assert.equal(doc.activeElement, doc.querySelectorAll('.kv-card')[1], 'el foco vuelve a la tarjeta');
});

test('empty data shows the friendly empty state', () => {
    const window = page({ videos: [] });
    assert.equal(window.document.getElementById('kv-empty').hidden, false);
    assert.equal(window.document.getElementById('kv-featured').hidden, true);
    assert.equal(window.document.getElementById('kv-demo').hidden, true);
});

test('titles from the data file are escaped', () => {
    const window = page({ videos: [{ titulo: '<img src=x onerror=alert(1)>', tema: 'X', fecha: '2026-10-01', plataforma: 'youtube', url: '' }] });
    assert.equal(window.document.querySelector('.kv-card img[src="x"]'), null);
    assert.equal(window.document.querySelector('.kv-card-title').textContent, '<img src=x onerror=alert(1)>');
});

test('published data is real, playable and free of tracking parameters', () => {
    assert.match(dataJs, /const VIDEOS_DEMO = false;/);
    const window = page({ videos: [] });
    window.eval(dataJs.replace(/\bconst\b/g, 'var') + ';window.__data=VIDEO_DATA;');
    assert.ok(window.__data.length > 0);
    for (const item of window.__data) {
        for (const key of ['titulo', 'descripcion', 'tema', 'fecha', 'plataforma', 'url']) assert.ok(item[key], `${item.titulo}: ${key}`);
        assert.match(item.fecha, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(item.ejemplo, undefined, `${item.titulo}: sin marca de ejemplo`);
        assert.doesNotMatch(item.url, /[?&](utm_|stkn|s=|is_from_webapp|sender_device|stack_idx)/, `${item.titulo}: enlace limpio`);
        const embed = window.KJAVideos.videoEmbed(item);
        assert.ok(embed, `${item.titulo}: el enlace se puede reproducir`);
        assert.equal(embed.platform, item.plataforma, `${item.titulo}: plataforma coherente con el enlace`);
        for (const key of ['portada', 'video']) {
            if (item[key]) assert.ok(fs.existsSync(new URL(`../${item[key]}`, import.meta.url)), `${item.titulo}: ${key} existe`);
        }
        if (item.video) assert.match(mp4Boxes(item.video).join(' '), /moov.*mdat/, `${item.titulo}: el MP4 empieza a sonar sin descargarse entero`);
    }
});

test('Videos sits between Cursos and Certificados on every public page', () => {
    const pages = ['index.html', 'terapia.html', 'cursos.html', 'videos.html', 'certificado.html', 'nosotros.html', 'libro-reclamaciones.html', 'politica-privacidad.html', 'terminos-condiciones.html'];
    for (const file of pages) {
        const source = read(file);
        const drawer = source.slice(source.indexOf('class="kja-drawer-links"'), source.indexOf('</ul>', source.indexOf('class="kja-drawer-links"')));
        const desktop = source.slice(source.indexOf('class="nav-center nav-links-center"'), source.indexOf('</ul>', source.indexOf('class="nav-center nav-links-center"')));
        for (const [name, block] of [['drawer', drawer], ['escritorio', desktop]]) {
            const cursos = block.indexOf('href="cursos.html"'), videos = block.indexOf('href="videos.html"'), cert = block.indexOf('href="certificado.html"');
            assert.ok(cursos > -1 && cursos < videos && videos < cert, `${file} (${name})`);
        }
    }
    assert.match(read('videos.html'), /<a href="videos\.html" class="active" aria-current="page">/);
    assert.match(read('videos.html'), /<link rel="canonical" href="https:\/\/www\.kjadmb\.com\/videos\.html">/);
    assert.match(read('sitemap.xml'), /<loc>https:\/\/www\.kjadmb\.com\/videos\.html<\/loc>/);
});

test('the seventh nav link does not overflow the desktop bar and carousel arrows avoid transform centering', () => {
    assert.match(read('assets/css/shared.css'), /@media \(min-width: 969px\) and \(max-width: 1140px\) \{\s*\.nav-links-center \{\s*gap: 18px;/);
    assert.match(read('index.html'), /@media \(min-width:969px\) and \(max-width:1140px\)\{\.nav-links-center\{gap:18px\}\}/);
    const arrow = css.match(/\.kv-nav \{[^}]*\}/)[0];
    assert.doesNotMatch(arrow, /transform/);
    assert.match(arrow, /top: 0;\s*bottom: 0;[\s\S]*margin: auto 0;/);
});

test('no player loads until a video is clicked, and then only the chosen one', () => {
    // Todas las portadas "en pantalla" y ningún temporizador corre: aun así no debe cargarse ningún reproductor.
    const window = page({ videos: sample }, win => {
        win.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; }
            observe(target) { this.callback([{ isIntersecting: true, target }], this); }
            unobserve() {}
            disconnect() {}
        };
        win.setTimeout = () => 0;
    });
    const doc = window.document;
    assert.equal(doc.querySelectorAll('iframe').length, 0, 'sin reproductores antes del clic');
    assert.equal(doc.querySelectorAll('.kv-slide .kv-cover .kv-art').length, 3, 'el carrusel muestra portadas estáticas');

    doc.querySelectorAll('.kv-card')[1].click();
    const frames = doc.querySelectorAll('iframe');
    assert.equal(frames.length, 1, 'al abrir se monta solo el video elegido, sin esperar ningún temporizador');
    assert.ok(frames[0].closest('.kv-slide.is-active .kv-player'));
    assert.match(frames[0].src, /^https:\/\/www\.tiktok\.com\/player\/v1\/7412345678901234567\?autoplay=1&muted=0/);
    assert.equal(frames[0].getAttribute('allow'), 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write');

    doc.getElementById('kv-next').click();
    assert.equal(doc.querySelectorAll('iframe').length, 0, 'al cambiar de video el anterior se quita en el acto y deja de sonar');
    doc.getElementById('kv-close').click();
    assert.equal(doc.querySelectorAll('iframe').length, 0);

    const { coverHtml } = window.KJAVideos;
    assert.match(coverHtml({ ...sample[1], portada: 'images/videos/x.webp' }), /^<img class="kv-cover-img" src="images\/videos\/x\.webp"/);
    assert.match(coverHtml(sample[1]), /^<span class="kv-art">/);
});

test('videos with their own MP4 play inside the click, with sound, also when switching or when one ends', async () => {
    const plays = [];
    let blockSound = false;
    const videos = sample.map((video, i) => ({ ...video, video: `assets/videos/v${i}.mp4` }));
    const window = page({ videos }, win => {
        win.setTimeout = () => 0; // ningún temporizador: el video debe arrancar dentro del mismo clic
        win.HTMLMediaElement.prototype.play = function () {
            plays.push({ src: this.getAttribute('src'), muted: this.muted });
            if (blockSound && !this.muted) return win.Promise.reject(Object.assign(new win.Error('sin permiso'), { name: 'NotAllowedError' }));
            return win.Promise.resolve();
        };
        win.HTMLMediaElement.prototype.pause = () => {};
        win.HTMLMediaElement.prototype.load = () => {};
    });
    const doc = window.document;
    doc.querySelectorAll('.kv-card')[1].click();
    const video = doc.querySelector('.kv-slide.is-active .kv-player--native video');
    assert.ok(video, 'reproductor nativo en el video central');
    assert.equal(doc.querySelectorAll('iframe').length, 0, 'sin reproductores de redes sociales');
    assert.ok(video.hasAttribute('playsinline'), 'en iPhone se reproduce dentro de la página');
    assert.deepEqual(plays, [{ src: 'assets/videos/v2.mp4', muted: false }], 'arranca dentro del clic y con sonido');

    doc.getElementById('kv-next').click();
    assert.equal(doc.querySelector('.kv-slide.is-active video'), video, 'siempre el mismo <video>, ya autorizado a sonar');
    assert.deepEqual(plays.at(-1), { src: 'assets/videos/v0.mp4', muted: false });

    doc.getElementById('kv-sound').click();
    assert.equal(video.muted, true);
    doc.getElementById('kv-prev').click();
    assert.deepEqual(plays.at(-1), { src: 'assets/videos/v2.mp4', muted: true }, 'respeta el silencio elegido');
    doc.getElementById('kv-sound').click();
    assert.equal(video.muted, false);

    video.dispatchEvent(new window.Event('ended'));
    assert.equal(doc.getElementById('kv-counter').textContent, '3 / 3', 'al terminar pasa solo al siguiente');
    assert.deepEqual(plays.at(-1), { src: 'assets/videos/v0.mp4', muted: false });

    blockSound = true;
    doc.getElementById('kv-next').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(video.muted, true, 'si el navegador no deja sonar, sigue en silencio');
    assert.equal(doc.getElementById('kv-hint').hidden, false, 'y ofrece activar el sonido');
    assert.deepEqual(plays.slice(-2).map(play => play.muted), [false, true]);

    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(doc.querySelectorAll('.kv-player').length, 0);
    assert.equal(video.hasAttribute('src'), false, 'al cerrar deja de descargar y de sonar');
});
