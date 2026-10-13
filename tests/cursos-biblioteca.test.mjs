import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../cursos.html', import.meta.url), 'utf8');
const script = name => fs.readFileSync(new URL('../assets/js/' + name, import.meta.url), 'utf8');
function page({ query = '', published = false, driveUrl = '', count = 3, desktop = false } = {}) {
    const dom = new JSDOM(html, { url: 'https://www.kjadmb.com/cursos.html' + query, runScripts: 'outside-only' });
    const { window } = dom;
    const run = code => vm.runInContext(code, dom.getInternalVMContext());
    window.matchMedia = query => ({ matches: desktop && query.includes('min-width: 1051px') });
    window.Element.prototype.getAnimations = () => [];
    window.Element.prototype.scrollIntoView = () => {};
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    run(script('cursos-data.js'));
    run(script('cursos-catalogo.js'));
    run(script('cursos-formacion-data.js'));
    run(script('cursos-formacion.js'));
    run(script('cursos-gratuitos-data.js'));
    if (published) run('FREE_COURSE_LIBRARY.preview = false;');
    run('FREE_COURSE_LIBRARY.courses[0].driveUrl = ' + JSON.stringify(driveUrl) + ';');
    if (count === 0) run('FREE_COURSE_LIBRARY.courses = [];');
    if (count === 4) run('FREE_COURSE_LIBRARY.courses.push({ ...FREE_COURSE_LIBRARY.courses[0], id: "extra", title: "Un cuarto curso" });');
    run(script('cursos-gratuitos.js'));
    return dom;
}

test('la biblioteca gratuita precede las cuatro rutas y la selección de cursos', () => {
    const dom = page();
    const { document } = dom.window;
    assert.equal(document.querySelectorAll('.formation-route').length, 4);
    assert.equal(document.querySelectorAll('[data-formation-course]').length, 7);
    assert.equal(document.querySelectorAll('.catalog-area-link').length, 0);
    assert.ok(document.getElementById('cursos-gratuitos').compareDocumentPosition(document.getElementById('catalogo')) & 4);
    dom.window.close();
});

test('la vista de un área conserva sus programas y oculta la biblioteca', () => {
    const dom = page({ query: '?area=tea-autismo' });
    const { document } = dom.window;
    assert.equal(document.getElementById('cursos-gratuitos').hidden, true);
    assert.equal(document.getElementById('catalogo').hidden, true);
    assert.equal(document.getElementById('area-title').textContent, 'TEA / Autismo');
    assert.ok(document.querySelectorAll('.area-program').length > 0);
    assert.equal(document.querySelectorAll('.free-course-card').length, 0);
    dom.window.close();
});

test('la vista previa nunca reproduce un enlace configurado por accidente', () => {
    const dom = page({ driveUrl: 'https://drive.google.com/file/d/demo_file/view' });
    const { document } = dom.window;
    document.querySelector('[data-free-course="0"]').click();
    assert.equal(document.getElementById('free-library-dialog').open, true);
    assert.match(document.getElementById('free-library-status').textContent, /Vista previa/);
    assert.equal(document.querySelector('iframe'), null);
    assert.equal(document.getElementById('free-courses-preview').hidden, false);
    dom.window.close();
});

for (const url of ['https://drive.google.com/file/d/demo_file/view?usp=sharing', 'https://drive.google.com/open?id=demo_file']) {
    test('reproduce un archivo de Drive publicado: ' + url, () => {
        const dom = page({ published: true, driveUrl: url });
        const { document } = dom.window;
        assert.equal(document.querySelector('iframe'), null, 'no se carga el reproductor antes del clic');
        const trigger = document.querySelector('[data-free-course="0"]');
        trigger.click();
        assert.equal(document.querySelector('iframe').src, 'https://drive.google.com/file/d/demo_file/preview');
        assert.equal(document.getElementById('free-courses-preview').hidden, true);
        document.getElementById('free-library-close').click();
        assert.equal(document.querySelector('iframe'), null, 'el cierre descarga el video');
        assert.equal(document.activeElement, trigger, 'el foco vuelve a la tarjeta');
        dom.window.close();
    });
}

test('enlaces inválidos o ajenos a Drive no se insertan en el reproductor', () => {
    for (const driveUrl of ['', 'javascript:alert(1)', 'https://drive.google.com.evil.example/file/d/demo/view', 'http://drive.google.com/file/d/demo/view', 'https://drive.google.com/drive/folders/demo']) {
        const dom = page({ published: true, driveUrl });
        dom.window.document.querySelector('[data-free-course="0"]').click();
        assert.equal(dom.window.document.querySelector('iframe'), null);
        assert.equal(dom.window.document.getElementById('free-library-status').textContent, 'Próximamente');
        dom.window.close();
    }
});

test('la biblioteca permite más cursos que los tres destacados y navegar a uno', () => {
    const dom = page({ count: 4 });
    const { document } = dom.window;
    assert.equal(document.querySelectorAll('.free-course-card').length, 3);
    document.getElementById('free-library-open').click();
    assert.equal(document.querySelectorAll('.free-library-item').length, 4);
    document.querySelector('.free-library-item[data-free-course="3"]').click();
    assert.equal(document.getElementById('free-library-title').textContent, 'Un cuarto curso');
    dom.window.close();
});

test('una biblioteca vacía muestra un estado útil', () => {
    const dom = page({ published: true, count: 0 });
    const { document } = dom.window;
    assert.equal(document.querySelectorAll('.free-course-card').length, 0);
    document.getElementById('free-library-open').click();
    assert.match(document.getElementById('free-library-content').textContent, /preparando nuevos cursos/);
    dom.window.close();
});
