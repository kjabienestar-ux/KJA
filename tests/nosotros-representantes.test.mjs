import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('nosotros.html');
const dataJs = read('assets/js/representantes-data.js');
const pageJs = read('assets/js/nosotros-representantes.js');

const opened = [];
test.afterEach(() => opened.splice(0).forEach(window => window.close()));

// Carga nosotros.html sin sus scripts y ejecuta solo los datos y el carrusel de representantes.
// Los temporizadores corren al instante; los intervalos (avance automático) quedan anotados en `intervals`.
// edit(datos), si se pasa, cambia los datos antes de armar el carrusel.
function page({ reducedMotion = false, edit } = {}) {
    const dom = new JSDOM(html.replace(/<script\b[^>]*src=[^>]*><\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/nosotros.html' });
    const { window } = dom;
    opened.push(window);
    const intervals = [];
    window.setTimeout = fn => { fn(); return 0; };
    window.setInterval = (fn, ms) => intervals.push({ fn, ms });
    window.matchMedia = query => ({ matches: reducedMotion && query.includes('reduced-motion'), addEventListener() {} });
    window.eval(dataJs);
    if (edit) edit(window.KJA_REPRESENTANTES);
    window.eval(pageJs);
    const openTab = () => window.document.dispatchEvent(new window.CustomEvent('kja:about-panel', { detail: { panel: 'representantes' } }));
    return { window, document: window.document, intervals, openTab };
}

const avatars = document => [...document.querySelectorAll('#reps-orbit .reps-avatar')];
const card = document => ['reps-name', 'reps-area', 'reps-desc'].map(id => document.getElementById(id).textContent);
// Posición (x, y) dibujada de un avatar: el segundo translate() de su transform.
const position = avatar => avatar.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/).slice(1).map(Number);

test('renders one avatar per representative, with the first one in the center', () => {
    const { document } = page();
    const list = avatars(document);
    assert.equal(list.length, 9);
    assert.equal(list[0].getAttribute('aria-label'), 'Ver a Ángel Raúl Tito Policarpo, representante de Salud ocupacional');
    assert.equal(list[8].getAttribute('aria-label'), 'Ver a Merly Stefany Medina Rodas, representante de Contabilidad');
    assert.deepEqual(list.map(avatar => avatar.querySelector('.reps-avatar-initials').textContent), ['ÁT', 'EM', 'JC', 'JQ', 'YÁ', 'JD', 'DG', 'DL', 'MM']);
    assert.ok(list.every(avatar => avatar.tagName === 'BUTTON' && avatar.type === 'button'));
    assert.equal(list[0].getAttribute('aria-current'), 'true');
    assert.equal(document.querySelectorAll('#reps-orbit [aria-current]').length, 1);
    assert.deepEqual(card(document), ['Ángel Raúl Tito Policarpo', 'Salud ocupacional', 'Promueve espacios de trabajo seguros y acciones preventivas para cuidar el bienestar del equipo.']);
    assert.equal(document.getElementById('reps-card').getAttribute('aria-live'), 'polite');
    // Arriba: texto general para todas las áreas, con el número de áreas y las primeras caras.
    assert.equal(document.getElementById('reps-title').textContent.replace(/\s+/g, ' ').trim(), 'Las personas que impulsan cada área de KJA');
    assert.equal(document.getElementById('reps-count').textContent, '9 áreas');
    assert.deepEqual([...document.querySelectorAll('#reps-faces .reps-summary-face')].map(face => face.textContent), ['ÁT', 'EM', 'JC', 'JQ', 'YÁ']);
    // En la ficha: qué hace el área.
    assert.match(document.getElementById('reps-about').textContent, /^Previene riesgos laborales/);
    // Tamaño real (sin scale) y decreciente desde el centro.
    const widths = [0, 1, 2, 3].map(i => parseFloat(list[i].style.width));
    assert.ok(widths[0] > widths[1] && widths[1] > widths[2] && widths[2] > widths[3], widths.join(' > '));
    assert.equal(list[0].style.transform.includes('scale'), false);
});

test('clicking an avatar spins it to the center along the arc and updates the card', () => {
    const { document, openTab } = page();
    openTab();
    const list = avatars(document);
    list[3].click();
    assert.equal(list[3].getAttribute('aria-current'), 'true');
    assert.equal(list[0].hasAttribute('aria-current'), false);
    assert.ok(list[3].classList.contains('is-center'));
    assert.deepEqual(position(list[3]), [0, 0]);
    assert.deepEqual(card(document), ['Jheferson Junior Quispe', 'Marketing', 'Impulsa contenidos y campañas que acercan los servicios y valores de KJA a más personas.']);
    assert.match(document.getElementById('reps-about').textContent, /^Da a conocer los servicios de KJA/);
    assert.ok(list[3].classList.contains('is-arriving'), 'animación de llegada al centro');
    assert.ok(document.getElementById('reps').classList.contains('is-entering'), 'la ficha entra animada');
    // Cada avatar queda a su distancia circular k del centro (con 9 personas, de −4 a 4).
    const byK = new Map(list.map((avatar, i) => [((i - 3 + 13) % 9) - 4, avatar]));
    const box = k => {
        const [x, y] = position(byK.get(k));
        return { x, y, r: parseFloat(byK.get(k).style.width) / 2 };
    };
    // Media luna ordenada: cada avatar mide 0,8 veces el anterior y el espacio entre bordes
    // vecinos es el mismo en todo el arco (al central se le suma su aro de 9 px).
    const gaps = [0, 1, 2].map(k => {
        const a = box(k), b = box(k + 1);
        return Math.hypot(b.x - a.x, b.y - a.y) - a.r - b.r - (k === 0 ? 9 : 0);
    });
    gaps.forEach(gap => assert.ok(Math.abs(gap - gaps[0]) < .5, `espacios ${gaps.map(g => g.toFixed(1)).join(' / ')}`));
    [1, 2, 3].forEach(k => assert.ok(Math.abs(box(k).r / box(k - 1).r - .8) < .01, `tamaño de k = ${k}`));
    // Simétrica y en forma de sonrisa: cuanto más lejos del centro, más arriba.
    [1, 2, 3].forEach(k => {
        assert.ok(Math.abs(box(-k).x + box(k).x) < .2 && Math.abs(box(-k).y - box(k).y) < .2, `simetría de k = ${k}`);
        assert.ok(box(k).y < box(k - 1).y && box(k).x > box(k - 1).x, `k = ${k} más arriba y más afuera`);
    });
    list.forEach((avatar, i) => {
        const k = ((i - 3 + 13) % 9) - 4;
        assert.equal(avatar.classList.contains('is-hidden'), Math.abs(k) > 3, `visibilidad de ${i}`);
    });
});

test('avatars show the area illustration: the photo comes first and initials are only a fallback', () => {
    const { window, document } = page({ edit: data => { data[1].foto = 'images/nosotros/representantes/erika.webp'; } });
    const list = avatars(document);
    const art = list[0].querySelector('.reps-avatar-face img');
    assert.equal(art.getAttribute('src'), 'images/nosotros/representantes/personas/salud-ocupacional.webp');
    assert.equal(art.getAttribute('alt'), '');
    assert.equal(art.getAttribute('loading'), 'lazy');
    assert.equal(art.getAttribute('decoding'), 'async');
    assert.ok(art.getAttribute('width') && art.getAttribute('height'));
    assert.ok(list[0].querySelector('.reps-avatar-face').classList.contains('is-art'), 'sobre el color suave del área');
    // Con foto, la foto va primero; si falla, la ilustración; si también falla, las iniciales.
    const photo = list[1].querySelector('.reps-avatar-face img');
    const face = list[1].querySelector('.reps-avatar-face');
    assert.equal(photo.getAttribute('src'), 'images/nosotros/representantes/erika.webp');
    assert.equal(face.classList.contains('is-art'), false);
    photo.dispatchEvent(new window.Event('error'));
    assert.equal(photo.getAttribute('src'), 'images/nosotros/representantes/personas/recursos-humanos.webp');
    photo.dispatchEvent(new window.Event('error'));
    assert.equal(face.querySelector('img'), null);
    assert.equal(face.classList.contains('has-image'), false, 'las iniciales vuelven a verse');
    assert.equal(face.querySelector('.reps-avatar-initials').textContent, 'EM');
    // La etiqueta lleva solo el texto; el ícono del área va a la derecha de la cabecera.
    assert.equal(document.querySelector('#reps-area svg'), null);
    assert.ok(document.querySelector('.reps-card-head #reps-icon svg'));
    // La ficha no repite la ilustración ni lleva numeración.
    assert.equal(document.querySelector('#reps-card img'), null);
    assert.equal(document.querySelector('.reps-card-index'), null);
});

test('arrows and arrow keys move one representative at a time, in a loop', () => {
    const { window, document } = page();
    document.querySelector('[data-reps-step="-1"]').click();
    assert.equal(card(document)[0], 'Merly Stefany Medina Rodas');
    document.querySelector('[data-reps-step="1"]').click();
    assert.equal(card(document)[0], 'Ángel Raúl Tito Policarpo');
    const first = avatars(document)[0];
    first.focus();
    first.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(card(document)[0], 'Erika del Socorro Moreno Quilcate');
    assert.equal(document.activeElement, avatars(document)[1], 'el foco sigue al avatar del centro');
    assert.deepEqual(avatars(document).map(avatar => avatar.tabIndex), [-1, 0, -1, -1, -1, -1, -1, -1, -1]);
});

test('the arrow under the heading scrolls down to the carousel', () => {
    const { window, document } = page();
    const calls = [];
    window.scrollTo = options => calls.push({ ...options });
    const jump = document.getElementById('reps-jump');
    assert.equal(jump.getAttribute('href'), '#reps-showcase', 'sin JS también baja al carrusel');
    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    jump.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].behavior, 'smooth');
    assert.equal(Number.isFinite(calls[0].top), true);
    assert.equal(document.activeElement, avatars(document)[0], 'el foco queda en la persona del centro');
    assert.ok(document.getElementById('reps-showcase').contains(document.getElementById('reps-stage')));
});

test('autoplay runs every 6 s only while the tab is open, without announcing each change', () => {
    const { document, intervals, openTab } = page();
    assert.equal(intervals.length, 0, 'la pestaña aún no está abierta');
    openTab();
    assert.equal(intervals.length, 1);
    assert.equal(intervals[0].ms, 6000);
    intervals[0].fn();
    assert.equal(card(document)[0], 'Erika del Socorro Moreno Quilcate');
    assert.equal(document.getElementById('reps-card').getAttribute('aria-live'), 'off');

    const calm = page({ reducedMotion: true });
    calm.openTab();
    assert.equal(calm.intervals.length, 0, 'sin avance automático con movimiento reducido');
});

test('the Representantes tab sits between Directores and Comunidad', () => {
    const { document } = page();
    const tabs = [...document.querySelectorAll('#about-tabs button.nosotros-tab')];
    const visible = tabs.filter(tab => tab.style.display !== 'none').map(tab => tab.getAttribute('aria-controls'));
    assert.deepEqual(visible, ['about-quienes', 'about-directores', 'about-representantes', 'about-servicios', 'about-testimonios']);
    const tab = document.querySelector('#about-tabs [aria-controls="about-representantes"]');
    assert.equal(tab.textContent.trim(), 'Representantes');
    assert.equal(tab.getAttribute('onclick'), "switchAboutTab(this, 'representantes')");
    assert.equal(tab.getAttribute('aria-pressed'), 'false');
    assert.ok(document.getElementById('about-representantes').classList.contains('about-panel'));
    assert.match(html, /assets\/css\/paginas\/nosotros-representantes\.css\?v=\d+/);
    assert.match(html, /assets\/js\/representantes-data\.js\?v=\d+"><\/script>\s*<script defer src="assets\/js\/nosotros-representantes\.js\?v=\d+"/);
});
