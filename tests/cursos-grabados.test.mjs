import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const DRIVE_FOLDER_TITLES = [
    'ADOS y ADI-R', 'Autoridad y convivencia escolar', 'Casos de modificación de conducta en niños y adolescentes', 'Clase de Peabody',
    'Entrevista conductual a padres de familia', 'Estimulación psicomotriz', 'Integración sensorial', 'Integración sensorial en niños con TEA y Down',
    'Intervención en psicoterapia', 'Introducción a la estimulación temprana', 'Maestra sombra', 'Maestra sombra con enfoque Denver', 'Pautas de crianza',
    'Terapia ocupacional', 'Praxias de lenguaje', 'Test de orientación vocacional', 'Entrevista neuropsicológica infantil',
    'Diagnóstico en la ansiedad y depresión', 'Intervención en rabietas y berrinches (TEA y TDAH)', 'Entrevista a padres para indagar sobre el TEA'
];

function cursos({ setup = '' } = {}) {
    const dom = new JSDOM(read('cursos.html'), { url: 'https://www.kjadmb.com/cursos.html', runScripts: 'outside-only' });
    const { window } = dom;
    window.matchMedia = () => ({ matches: false });
    window.Element.prototype.getAnimations = () => [];
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    const run = code => vm.runInContext(code, dom.getInternalVMContext());
    for (const name of ['cursos-data.js', 'cursos-catalogo.js', 'cursos-formacion-data.js', 'cursos-formacion.js', 'cursos-grabados-data.js']) run(read('assets/js/' + name));
    if (setup) run(setup);
    run(read('assets/js/cursos-gratuitos.js'));
    return dom;
}

test('Cursos carga su propia biblioteca de 20 cursos y Talleres conserva la suya', () => {
    assert.match(read('cursos.html'), /assets\/js\/cursos-grabados-data\.js\?v=\d+/);
    assert.doesNotMatch(read('cursos.html'), /cursos-gratuitos-data\.js/);
    assert.match(read('talleres.html'), /assets\/js\/cursos-gratuitos-data\.js\?v=\d+/);
    const versions = ['cursos.html', 'talleres.html'].map(file => read(file).match(/cursos-gratuitos\.js\?v=(\d+)/)[1]);
    assert.equal(versions[0], versions[1], 'ambas páginas cargan la misma versión del script');
});

test('los 20 cursos de la carpeta de Drive tienen título, descripción y portada propia', () => {
    const dom = cursos();
    const library = JSON.parse(vm.runInContext('JSON.stringify(FREE_COURSE_LIBRARY)', dom.getInternalVMContext()));
    assert.equal(library.preview, false);
    assert.deepEqual(library.courses.map(course => course.title), DRIVE_FOLDER_TITLES);
    assert.equal(new Set(library.courses.map(course => course.id)).size, 20);
    assert.equal(new Set(library.courses.map(course => course.cover)).size, 20, 'ninguna portada se repite');
    assert.equal(library.courses.filter(course => course.destacado).length, 3);
    for (const course of library.courses) {
        assert.ok(course.description.trim(), course.title);
        assert.ok(fs.existsSync(new URL(`../${course.cover}`, import.meta.url)), course.cover);
        assert.ok(course.driveUrl === '' || /^https:\/\/drive\.google\.com\/(file\/d\/[\w-]+|open\?id=[\w-]+)/.test(course.driveUrl), course.title + ': enlace de video de Drive');
    }
    const linked = library.courses.map(course => course.driveUrl).filter(Boolean);
    assert.equal(new Set(linked).size, linked.length, 'cada curso tiene un video distinto (sin enlaces repetidos por error)');
    assert.ok(library.courses.filter(course => course.destacado).every(course => course.driveUrl), 'los 3 destacados ya tienen video');
    dom.window.close();
});

test('la página muestra 3 cursos destacados y una flecha que abre los 20 con su portada', () => {
    const dom = cursos();
    const { document } = dom.window;
    const cards = [...document.querySelectorAll('#free-courses-grid .recorded-title')].map(title => title.textContent);
    assert.deepEqual(cards, ['ADOS y ADI-R', 'Estimulación psicomotriz', 'Praxias de lenguaje']);
    const more = document.getElementById('free-library-more');
    assert.equal(more.hidden, false);
    assert.equal(more.getAttribute('aria-label'), 'Ver los 20 cursos gratuitos');
    more.click();
    const dialog = document.getElementById('free-library-dialog');
    assert.equal(dialog.open, true);
    assert.ok(dialog.classList.contains('free-library-dialog--cursos'));
    const libraryCards = [...document.querySelectorAll('#free-library-content .free-library-card')];
    assert.equal(libraryCards.length, 20);
    for (const card of libraryCards) {
        assert.match(card.querySelector('img').getAttribute('src'), /^images\/cursos\/grabados\/.+\.webp$/);
        assert.ok(card.querySelector('strong').textContent.trim());
    }
    assert.match(document.getElementById('free-library-status').textContent, /20 cursos gratuitos/);
    dom.window.close();
});

test('desde el modal se abre un curso y se vuelve a la lista sin cerrar la ventana', () => {
    const dom = cursos({ setup: 'FREE_COURSE_LIBRARY.courses[14].driveUrl = "";' });
    const { document } = dom.window;
    const more = document.getElementById('free-library-more');
    more.click();
    document.querySelector('.free-library-card[data-free-course="14"]').click();
    assert.equal(document.getElementById('free-library-title').textContent, 'Praxias de lenguaje');
    assert.equal(document.getElementById('free-library-status').textContent, 'Próximamente', 'un curso sin video muestra Próximamente');
    document.querySelector('[data-free-back]').click();
    assert.equal(document.getElementById('free-library-dialog').open, true);
    assert.equal(document.querySelectorAll('.free-library-card').length, 20);
    document.getElementById('free-library-close').click();
    assert.equal(document.activeElement, more, 'el foco vuelve a la flecha');
    dom.window.close();
});

test('un curso con su video de Drive se reproduce dentro del modal', () => {
    const dom = cursos({ setup: 'FREE_COURSE_LIBRARY.courses[0].driveUrl = "https://drive.google.com/file/d/video_ados/view?usp=sharing";' });
    const { document } = dom.window;
    document.querySelector('#free-courses-grid [data-free-course="0"]').click();
    assert.equal(document.querySelector('iframe').src, 'https://drive.google.com/file/d/video_ados/preview');
    assert.ok(document.querySelector('[data-free-back]'), 'también permite ver los demás cursos');
    document.getElementById('free-library-close').click();
    assert.equal(document.querySelector('iframe'), null);
    dom.window.close();
});

test('cada curso lista solo materiales propios de KJA con enlaces de Drive válidos', () => {
    const dom = cursos();
    const library = JSON.parse(vm.runInContext('JSON.stringify(FREE_COURSE_LIBRARY)', dom.getInternalVMContext()));
    const all = library.courses.flatMap(course => course.materiales || []);
    assert.equal(all.length, 37);
    for (const course of library.courses) {
        assert.ok(Array.isArray(course.materiales), course.title + ': tiene la lista de materiales');
        for (const item of course.materiales) {
            assert.ok(item.titulo.trim(), course.title);
            assert.ok(['PDF', 'PPT', 'Video'].includes(item.tipo), course.title + ': ' + item.tipo);
            assert.match(item.url, /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/, item.titulo);
            assert.notEqual(item.url, course.driveUrl, item.titulo + ': no repite el video principal');
            assert.doesNotMatch(item.titulo, /\.rar|l[aá]mina|manual|hoja de respuestas|informe|copia de/i, item.titulo);
        }
    }
    const urls = all.map(item => item.url);
    assert.equal(new Set(urls).size, urls.length, 'ningún archivo se enlaza dos veces');
    assert.equal(library.courses.find(course => course.id === 'rabietas-berrinches').materiales.length, 0, 'la carpeta 19 aún está vacía');
    dom.window.close();
});

test('el detalle del curso muestra sus materiales y los abre en otra pestaña', () => {
    const dom = cursos();
    const { document } = dom.window;
    document.querySelector('#free-courses-grid [data-free-course="0"]').click();
    const links = [...document.querySelectorAll('.free-course-materials a')];
    assert.equal(links.length, 2);
    assert.match(document.querySelector('.free-course-materials h3').textContent, /Materiales del curso\s*2/);
    assert.equal(links[0].href, 'https://drive.google.com/file/d/1paW6-MSkkKXNR3K3LGP_8vLluhx-MreX/view');
    for (const link of links) {
        assert.equal(link.target, '_blank');
        assert.match(link.rel, /noopener/);
        assert.match(link.getAttribute('aria-label'), /se abre en otra pestaña/);
    }
    assert.equal(links[1].querySelector('.free-course-material-type').textContent, 'PPT');
    assert.ok(document.querySelector('iframe'), 'el video sigue arriba de los materiales');
    dom.window.close();
});

test('un curso sin video muestra sus materiales y uno sin archivos no muestra la sección', () => {
    const dom = cursos();
    const { document } = dom.window;
    document.getElementById('free-library-more').click();
    document.querySelector('.free-library-card[data-free-course="9"]').click();
    assert.equal(document.getElementById('free-library-status').textContent, 'Próximamente');
    assert.match(document.querySelector('.free-course-coming p').textContent, /revisar sus materiales/);
    assert.equal(document.querySelectorAll('.free-course-materials a').length, 2);
    document.querySelector('[data-free-back]').click();
    document.querySelector('.free-library-card[data-free-course="18"]').click();
    assert.equal(document.querySelector('.free-course-materials'), null);
    assert.match(document.querySelector('.free-course-coming p').textContent, /todavía no está disponible/);
    dom.window.close();
});

test('los materiales con enlaces que no son de un archivo de Drive no se muestran', () => {
    const dom = cursos({ setup: 'FREE_COURSE_LIBRARY.courses[0].materiales = [{ titulo: "Carpeta", tipo: "PDF", url: "https://drive.google.com/drive/folders/abc" }, { titulo: "Externo", tipo: "PDF", url: "https://ejemplo.com/file/d/abc/view" }, { titulo: "Bueno <b>", tipo: "PDF", url: "https://drive.google.com/file/d/abc/view" }];' });
    const { document } = dom.window;
    document.querySelector('#free-courses-grid [data-free-course="0"]').click();
    const links = [...document.querySelectorAll('.free-course-materials a')];
    assert.equal(links.length, 1);
    assert.equal(links[0].querySelector('.free-course-material-name').textContent, 'Bueno <b>', 'el título se escapa');
    dom.window.close();
});
