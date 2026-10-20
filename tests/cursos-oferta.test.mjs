import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../cursos.html', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../assets/js/cursos-formacion-data.js', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../assets/js/cursos-oferta.js', import.meta.url), 'utf8');
const ids = ['rrhh', 'neuropsicologia-tea-tdah', 'tcc-infantil', 'ados-adir'];
function setup({ area = false, missingData = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://www.kjadmb.com/cursos.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  if (area) window.document.body.classList.add('course-area-page');
  if (!missingData) vm.runInContext(data, dom.getInternalVMContext());
  vm.runInContext(script, dom.getInternalVMContext());
  return { dom, window, document: window.document, api: window.KJA_COURSE_OFFER };
}

test('la vista muestra cuatro espacios y reserva WhatsApp para cuatro cursos reales', () => {
  const { dom, document, api } = setup();
  assert.equal(document.querySelectorAll('[data-offer-slot]').length, 4);
  for (let count = 0; count <= 4; count++) {
    api.setSelection(ids.slice(0, count));
    assert.equal(document.querySelectorAll('[data-offer-slot][data-selected="true"]').length, count);
    assert.equal(document.querySelector('[data-offer-checkout]').hidden, count !== 4);
    assert.equal(document.querySelector('[data-offer-count]').textContent, `${count}/4`);
  }
  assert.match(document.querySelector('[data-offer-slot="3"]').textContent, /Incluido gratis/);
  assert.equal(document.querySelector('[data-offer-checkout]').hasAttribute('href'), false);
  dom.window.close();
});

test('IDs inválidos, duplicados y un quinto curso no alteran la selección visible', () => {
  const { dom, api } = setup();
  api.setSelection(ids.slice(0, 2));
  for (const invalid of [null, 'rrhh', ['rrhh', 'rrhh'], ['curso-inexistente'], [...ids, 'wisc-v'], [123]]) {
    assert.throws(() => api.setSelection(invalid), /IDs únicos/);
    assert.deepEqual([...api.getSelection()], ids.slice(0, 2));
  }
  dom.window.close();
});

test('la vista no comparte arrays mutables con el carrito del integrador', () => {
  const { dom, api } = setup();
  const input = ids.slice(0, 2);
  const returned = api.setSelection(input);
  input.pop();
  returned.courseIds.pop();
  api.getSelection().pop();
  assert.deepEqual([...api.getSelection()], ids.slice(0, 2));
  dom.window.close();
});

test('quitar y continuar emiten intenciones; el integrador sigue controlando el carrito', () => {
  const { dom, window, document, api } = setup();
  const events = [];
  document.addEventListener('kja:offer:remove', event => events.push({ type: 'remove', detail: event.detail }));
  document.addEventListener('kja:offer:checkout', event => events.push({ type: 'checkout', detail: event.detail }));
  api.setSelection(ids.slice(0, 3));
  document.querySelector('[data-offer-checkout]').click();
  assert.equal(events.length, 0);
  api.setSelection(ids);
  document.querySelector('[data-offer-remove="rrhh"]').click();
  assert.equal(events[0].detail.courseId, 'rrhh');
  assert.deepEqual([...api.getSelection()], ids);
  document.querySelector('[data-offer-checkout]').click();
  assert.equal(events[1].type, 'checkout');
  assert.equal(events[1].detail.total, 99);
  assert.equal(events[1].detail.currency, 'PEN');
  assert.deepEqual([...events[1].detail.courseIds], ids);
  assert.equal(window.location.href, 'https://www.kjadmb.com/cursos.html');
  api.setSelection(ids.slice(1));
  assert.equal(document.querySelector('[data-offer-checkout]').hidden, true);
  dom.window.close();
});

test('el destino de animación es estable al renderizar; inicializar dos veces no duplica eventos', () => {
  const { dom, window, document, api } = setup();
  const target = api.getTarget();
  let rendered = 0;
  document.addEventListener('kja:offer:rendered', () => rendered++);
  vm.runInContext(script, dom.getInternalVMContext());
  api.setSelection(ids.slice(0, 1));
  api.setSelection(ids.slice(0, 1));
  assert.equal(rendered, 1);
  assert.equal(api.getTarget(), target);
  assert.equal(window.KJA_COURSE_OFFER, api);
  dom.window.close();
});

test('las áreas históricas y la falta de catálogo no activan una oferta ajena al catálogo', () => {
  for (const options of [{ area: true }, { missingData: true }]) {
    const { dom, document, api } = setup(options);
    assert.equal(document.querySelector('.offer-dock').hidden, true);
    assert.equal(api, undefined);
    dom.window.close();
  }
});
