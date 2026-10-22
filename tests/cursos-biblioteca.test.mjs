import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../talleres.html', import.meta.url), 'utf8');
const script = name => fs.readFileSync(new URL('../assets/js/' + name, import.meta.url), 'utf8');
function page({ query = '', published = false, driveUrl = '', count = 3, desktop = false } = {}) {
    const dom = new JSDOM(html, { url: 'https://www.kjadmb.com/talleres.html' + query, runScripts: 'outside-only' });
    const { window } = dom;
    const run = code => vm.runInContext(code, dom.getInternalVMContext());
    window.matchMedia = query => ({ matches: desktop && query.includes('min-width: 1051px') });
    window.Element.prototype.getAnimations = () => [];
    window.Element.prototype.scrollIntoView = () => {};
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    run(script('cursos-formacion-data.js'));
    run(script('talleres.js'));
    run(script('cursos-gratuitos-data.js'));
    if (published) run('FREE_COURSE_LIBRARY.preview = false;');
    run('FREE_COURSE_LIBRARY.courses[0].driveUrl = ' + JSON.stringify(driveUrl) + ';');
    if (count === 0) run('FREE_COURSE_LIBRARY.courses = [];');
    if (count === 4) run('FREE_COURSE_LIBRARY.courses.push({ ...FREE_COURSE_LIBRARY.courses[0], id: "extra", title: "Un cuarto curso" });');
    run(script('cursos-gratuitos.js'));
    return dom;
}

test('Talleres contiene la biblioteca y la agenda, mientras Cursos conserva su catálogo', () => {
    const dom = page();
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('[data-workshop-id]').length, 23);
    assert.equal(doc.querySelectorAll('.free-course-card').length, 3);
    assert.ok(doc.getElementById('cursos-gratuitos').compareDocumentPosition(doc.getElementById('agenda-talleres')) & 4);
    const courses = fs.readFileSync(new URL('../cursos.html', import.meta.url), 'utf8');
    assert.equal(courses.includes('id="cursos-gratuitos"'), true);
    assert.equal(courses.includes('id="formation-workshops"'), false);
    assert.ok(courses.includes('id="formation-courses-grid"'));
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
    assert.match(document.getElementById('free-library-content').textContent, /preparando nuevos talleres/);
    dom.window.close();
});


test('Cursos integra la biblioteca con textos y enlaces propios y oculta grabados en áreas históricas', () => {
    for (const query of ['', '?area=tea-autismo']) {
        const source = fs.readFileSync(new URL('../cursos.html', import.meta.url), 'utf8');
        const dom = new JSDOM(source, { url: 'https://www.kjadmb.com/cursos.html' + query, runScripts: 'outside-only' });
        const { window } = dom;
        window.matchMedia = () => ({ matches: false });
        window.Element.prototype.getAnimations = () => [];
        window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
        window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
        const run = name => vm.runInContext(script(name), dom.getInternalVMContext());
        ['cursos-data.js', 'cursos-catalogo.js', 'cursos-formacion-data.js', 'cursos-formacion.js', 'cursos-grabados-data.js', 'cursos-gratuitos.js'].forEach(run);
        const doc = window.document;
        if (query) {
            assert.equal(doc.getElementById('cursos-gratuitos').hidden, true);
            assert.equal(doc.querySelectorAll('.free-course-card').length, 0);
        } else {
            assert.equal(doc.querySelectorAll('.free-course-card').length, 3);
            doc.getElementById('free-library-open').click();
            assert.equal(doc.getElementById('free-library-dialog').open, true);
            assert.equal(doc.querySelectorAll('#free-library-content .free-library-card').length, 20);
            const pending = vm.runInContext('FREE_COURSE_LIBRARY.courses.findIndex(course => !course.driveUrl)', dom.getInternalVMContext());
            if (pending > -1) {
                doc.querySelector('.free-library-card[data-free-course="' + pending + '"]').click();
                assert.equal(doc.querySelector('iframe'), null);
                assert.equal(doc.querySelector('.free-course-catalog-link').getAttribute('href'), 'cursos.html#catalogo');
            }
            doc.getElementById('free-library-close').click();
            assert.equal(doc.activeElement.id, 'free-library-open');
        }
        dom.window.close();
    }
});
