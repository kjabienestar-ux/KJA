import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('videos.html');
const pageJs = read('assets/js/videos.js');
const dataJs = read('assets/js/videos-data.js');
const css = read('assets/css/paginas/videos.css');

// Carga videos.html sin sus scripts externos y ejecuta la página con los datos indicados.
function page(data) {
    const dom = new JSDOM(html.replace(/<script\b[^>]*src=[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'http://localhost/videos.html' });
    const { window } = dom;
    window.setTimeout = fn => { fn(); return 0; };
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
    assert.equal(embed('https://www.tiktok.com/@kjabienestar/video/7412345678901234567').src, 'https://www.tiktok.com/player/v1/7412345678901234567?autoplay=1&rel=0&description=0&music_info=0');
    assert.match(embed('https://www.facebook.com/reel/1234567890').src, /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Freel%2F1234567890&show_text=false/);
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

test('cards preview the real video paused and muted, without autoplay', () => {
    const window = page({ videos: sample });
    const { previewSrc, coverHtml } = window.KJAVideos;
    for (const item of sample.filter(video => video.url)) {
        const src = previewSrc(item);
        assert.ok(src, item.titulo);
        assert.doesNotMatch(src, /autoplay=(1|true)/);
    }
    assert.equal(previewSrc(sample[0]), '');
    assert.match(coverHtml(sample[1], true), /data-preview-src=/);
    assert.doesNotMatch(coverHtml(sample[1]), /data-preview-src=/);
    assert.doesNotMatch(coverHtml({ ...sample[1], portada: 'images/videos/x.webp' }, true), /data-preview-src=/);
    assert.equal(window.document.querySelectorAll('.kv-slide .kv-live[data-preview-src]').length, 2);
});
