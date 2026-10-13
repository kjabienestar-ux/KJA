import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../cursos.html', import.meta.url), 'utf8');
const script = name => fs.readFileSync(new URL('../assets/js/' + name, import.meta.url), 'utf8');
function page(query = '', mutate = '') {
    const dom = new JSDOM(html, { url: 'https://www.kjadmb.com/cursos.html' + query, runScripts: 'outside-only' });
    const { window } = dom;
    window.matchMedia = () => ({ matches: false });
    window.Element.prototype.getAnimations = () => [];
    window.Element.prototype.scrollIntoView = () => {};
    window.Element.prototype.scrollBy = function (options) { this.lastScroll = options; };
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    const run = code => vm.runInContext(code, dom.getInternalVMContext());
    ['cursos-data.js', 'cursos-catalogo.js', 'cursos-formacion-data.js'].forEach(name => run(script(name)));
    if (mutate) run(mutate);
    run(script('cursos-formacion.js'));
    return dom;
}

test('presenta siete cursos, tres destacados y cuatro rutas sin el bloque antiguo de nueve áreas', () => {
    const dom = page();
    const doc = dom.window.document;
    const courses = [...doc.querySelectorAll('[data-formation-course]')];
    assert.equal(courses.length, 7);
    assert.equal(new Set(courses.map(card => card.dataset.formationCourse)).size, 7);
    assert.deepEqual([...doc.querySelectorAll('.formation-course-featured')].map(card => card.dataset.formationCourse).sort(), ['neuropsicologia-tea-tdah', 'rrhh', 'tcc-infantil']);
    assert.equal(doc.querySelectorAll('.formation-route').length, 4);
    assert.equal(doc.querySelectorAll('.formation-route a, .formation-route button').length, 0);
    assert.equal(doc.querySelectorAll('.formation-route-icon svg').length, 4);
    assert.equal(doc.querySelectorAll('[data-formation-course] ul, [data-formation-course] .formation-course-title svg').length, 0);
    assert.equal(doc.querySelectorAll('#formation-workshops img').length, 0);
    assert.equal(doc.querySelectorAll('[data-formation-course]:not([hidden])').length, 6);
    assert.equal(doc.querySelectorAll('.formation-course-soon').length, 0);
    assert.equal(doc.querySelectorAll('.formation-course-demand').length, 3);
    assert.equal(doc.querySelectorAll('.catalog-area-link').length, 0);
    assert.equal(doc.getElementById('todas-las-areas'), null);
    doc.querySelector('[data-formation-route="clinica"]').click();
    doc.querySelector('[data-formation-route="educativa-organizacional"]').click();
    assert.equal(doc.querySelectorAll('[data-formation-course]:not([hidden])').length, 3);
    assert.equal(doc.querySelectorAll('.formation-course-soon').length, 3);
    assert.equal(doc.getElementById('formation-filter'), null);
    dom.window.close();
});

test('una ruta filtra, permite volver a siete y mantiene la navegación del historial', () => {
    const dom = page();
    const doc = dom.window.document;
    doc.querySelector('[data-formation-route="educativa-organizacional"]').click();
    assert.equal(new URL(dom.window.location.href).searchParams.get('ruta'), 'educativa-organizacional');
    assert.deepEqual([...doc.querySelectorAll('[data-formation-course]:not([hidden])')].map(card => card.dataset.formationCourse).sort(), ['convivencia-escolar', 'rrhh', 'wisc-v']);
    assert.equal(doc.querySelector('[data-formation-route="educativa-organizacional"]').getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelectorAll('[data-formation-route]').length, 5);
    doc.querySelector('[data-formation-route=""]').click();
    assert.equal(doc.querySelectorAll('[data-formation-course]:not([hidden])').length, 6);
    assert.equal(doc.getElementById('formation-filter'), null);
    dom.window.history.replaceState(null, '', '?ruta=herramientas#catalogo');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    assert.equal(doc.querySelectorAll('[data-formation-course]:not([hidden])').length, 3);
    dom.window.close();
});

test('las URLs de ruta se pueden abrir directamente y las rutas inválidas no ocultan la oferta', () => {
    const route = page('?ruta=clinica');
    assert.equal(route.window.document.querySelectorAll('[data-formation-course]:not([hidden])').length, 4);
    assert.equal(route.window.document.querySelectorAll('.formation-course-soon').length, 2);
    route.window.close();
    const invalid = page('?ruta=inexistente#catalogo');
    assert.equal(invalid.window.document.querySelectorAll('[data-formation-course]:not([hidden])').length, 6);
    invalid.window.close();
});

test('el detalle conserva el nombre completo, dirige la consulta al curso correcto y restaura foco', () => {
    const dom = page();
    const doc = dom.window.document;
    doc.querySelector('[data-formation-route=""]').click();
    const opener = doc.querySelector('[data-formation-detail="convivencia-escolar"]');
    opener.focus();
    opener.click();
    assert.equal(doc.getElementById('formation-course-dialog').open, true);
    assert.equal(doc.querySelectorAll('#formation-detail-topics li').length, 3);
    const title = 'Convivencia escolar y habilidades socioemocionales en la tutoría educativa';
    assert.equal(doc.getElementById('formation-detail-title').textContent, title);
    const link = new URL(doc.getElementById('formation-detail-consult').href);
    assert.equal(link.host, 'wa.me');
    assert.equal(link.pathname, '/51988918238');
    assert.ok(link.searchParams.get('text').includes(title));
    doc.getElementById('formation-detail-close').click();
    assert.equal(doc.getElementById('formation-course-dialog').open, false);
    assert.equal(doc.activeElement, opener);
    dom.window.close();
});

test('los modales se centran y solo se cierran desde la X', () => {
    const dom = page();
    const doc = dom.window.document;
    const course = doc.querySelector('[data-formation-detail]');
    course.click();
    const courseDialog = doc.getElementById('formation-course-dialog');
    const cancelCourse = new dom.window.Event('cancel', { cancelable: true });
    courseDialog.dispatchEvent(cancelCourse);
    assert.equal(cancelCourse.defaultPrevented, true);
    assert.equal(courseDialog.open, true);
    courseDialog.click();
    assert.equal(courseDialog.open, true);
    doc.getElementById('formation-detail-close').click();
    assert.equal(courseDialog.open, false);

    const workshop = doc.querySelector('[data-workshop-detail]');
    workshop.click();
    const workshopDialog = doc.getElementById('formation-workshop-dialog');
    const cancelWorkshop = new dom.window.Event('cancel', { cancelable: true });
    workshopDialog.dispatchEvent(cancelWorkshop);
    assert.equal(cancelWorkshop.defaultPrevented, true);
    assert.equal(workshopDialog.open, true);
    workshopDialog.click();
    assert.equal(workshopDialog.open, true);
    doc.getElementById('formation-workshop-close').click();
    assert.equal(workshopDialog.open, false);
    dom.window.close();
});

test('la agenda usa scroll sin expandirse, conserva 23 talleres y no contiene fechas vacías', () => {
    const dom = page();
    const doc = dom.window.document;
    const rows = [...doc.querySelectorAll('[data-workshop-id]')];
    assert.equal(rows.length, 23);
    assert.equal(rows.filter(row => !row.hidden).length, 23);
    assert.equal(rows.filter(row => row.textContent.includes('WISC-V')).length, 2);
    assert.equal(doc.querySelectorAll('#formation-workshops time, .formation-month').length, 0);
    const list = doc.getElementById('formation-workshops');
    Object.defineProperties(list, { clientHeight: { value: 500 }, scrollHeight: { value: 4000 } });
    const more = doc.getElementById('formation-workshops-more');
    more.click();
    assert.equal(more.hasAttribute('aria-expanded'), false);
    assert.equal(rows.filter(row => !row.hidden).length, 23);
    assert.equal(list.lastScroll.top, 425);
    assert.equal(list.lastScroll.left, 0);
    assert.equal(list.lastScroll.behavior, 'smooth');
    assert.equal(doc.activeElement, list);
    list.scrollTop = 425;
    list.dispatchEvent(new dom.window.Event('scroll'));
    doc.getElementById('formation-workshops-prev').click();
    assert.equal(list.lastScroll.top, -425);
    dom.window.close();
});

test('el detalle de taller usa foto temática, Próximamente y WhatsApp contextual; restaura foco', () => {
    const dom = page();
    const doc = dom.window.document;
    const opener = doc.querySelector('[data-workshop-detail="oct-23"]');
    opener.click();
    assert.equal(doc.getElementById('formation-workshop-dialog').open, true);
    assert.equal(doc.getElementById('formation-workshop-title').textContent, 'Test de estrés laboral en las organizaciones');
    assert.ok(doc.getElementById('formation-workshop-image').src.endsWith('salud-ocupacional-bienestar.webp'));
    assert.equal(doc.querySelector('.formation-workshop-status').textContent, 'Próximamente');
    assert.ok(new URL(doc.getElementById('formation-workshop-consult').href).searchParams.get('text').includes('Test de estrés laboral'));
    doc.getElementById('formation-workshop-close').click();
    assert.equal(doc.activeElement, opener);
    doc.querySelector('[data-workshop-detail="oct-07"]').click();
    assert.match(doc.getElementById('formation-workshop-note').textContent, /Denominación por confirmar/);
    dom.window.close();
});

test('en móvil los controles avanzan horizontalmente y respetan movimiento reducido', () => {
    const dom = page('', "window.matchMedia = query => ({ matches: query.includes('max-width') || query.includes('reduced-motion') });");
    const doc = dom.window.document;
    const list = doc.getElementById('formation-workshops');
    Object.defineProperties(list, { clientWidth: { value: 320 }, scrollWidth: { value: 7000 } });
    list.dispatchEvent(new dom.window.Event('scroll'));
    doc.getElementById('formation-workshops-next').click();
    assert.equal(list.lastScroll.left, 272);
    assert.equal(list.lastScroll.top, 0);
    assert.equal(list.lastScroll.behavior, 'auto');
    list.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.equal(list.lastScroll.left, -272);
    dom.window.close();
});

test('el catálogo inicia con seis cursos y la segunda página completa sus espacios', () => {
    const first = page('', 'Math.random = () => 0;');
    const visible = doc => [...doc.querySelectorAll('[data-formation-course]:not([hidden])')].map(card => card.dataset.formationCourse);
    const initial = visible(first.window.document);
    assert.equal(new Set(initial).size, 6);
    assert.equal(first.window.document.querySelectorAll('.formation-course-soon').length, 0);
    first.window.document.querySelector('[data-formation-page="2"]').click();
    assert.equal(visible(first.window.document).length, 1);
    assert.equal(first.window.document.querySelectorAll('.formation-course-soon').length, 5);
    assert.equal(first.window.document.querySelector('[data-formation-page="2"]').getAttribute('aria-current'), 'page');
    assert.equal(first.window.document.getElementById('formation-all-courses'), null);
    first.window.close();
});

test('datos incompletos conservan un estado útil y el contenido se escapa al renderizar', () => {
    const empty = page('', 'KJA_FORMATION.workshops = [];');
    assert.ok(empty.window.document.getElementById('formation-workshops').textContent.includes('preparación'));
    assert.equal(empty.window.document.getElementById('formation-workshops-more').hidden, true);
    empty.window.close();
    const escaped = page('', 'KJA_FORMATION.courses[0].title = "<img src=x onerror=alert(1)>";');
    assert.equal(escaped.window.document.querySelector('[data-formation-course="rrhh"] h3').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(escaped.window.document.querySelectorAll('[onerror]').length, 0);
    escaped.window.close();
});

test('la vista por área conserva sus programas y oculta la nueva portada', () => {
    const dom = page('?area=tea-autismo');
    const doc = dom.window.document;
    assert.equal(doc.getElementById('catalogo').hidden, true);
    assert.equal(doc.getElementById('rutas-formacion').hidden, true);
    assert.equal(doc.getElementById('cursos-gratuitos').hidden, true);
    assert.equal(doc.getElementById('course-area-view').hidden, false);
    assert.ok(doc.querySelectorAll('.area-program').length > 0);
    dom.window.close();
});


test('los destacados se distribuyen y el distintivo se puede desplegar sin abrir el curso', () => {
    const dom = page('', 'Math.random = () => .99;');
    const doc = dom.window.document;
    assert.ok(doc.querySelectorAll('[data-formation-course]:not([hidden]) .formation-course-demand').length >= 1);
    doc.querySelector('[data-formation-route=""]').click();
    const cards = [...doc.querySelectorAll('[data-formation-course]:not([hidden])')];
    assert.deepEqual(cards.flatMap((card, index) => card.classList.contains('formation-course-featured') ? [index] : []), [2, 4]);
    const badge = doc.querySelector('.formation-course-demand');
    badge.click();
    assert.equal(badge.getAttribute('aria-pressed'), 'true');
    assert.equal(doc.getElementById('formation-course-dialog').open, false);
    badge.click();
    assert.equal(badge.getAttribute('aria-pressed'), 'false');
    assert.equal(doc.querySelectorAll('[data-formation-detail]').length, 7);
    dom.window.close();
});
