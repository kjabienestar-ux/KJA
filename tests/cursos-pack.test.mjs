import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../cursos.html', import.meta.url), 'utf8');
const script = name => fs.readFileSync(new URL('../assets/js/' + name, import.meta.url), 'utf8');

function setup({ area = false, stored } = {}) {
  const dom = new JSDOM(html, { url: 'https://www.kjadmb.com/cursos.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const opened = [];
  window.open = url => { opened.push(url); return {}; };
  if (stored !== undefined) window.sessionStorage.setItem('kja-pack-v1', stored);
  if (area) window.document.body.classList.add('course-area-page');
  const run = code => vm.runInContext(code, dom.getInternalVMContext());
  ['cursos-data.js', 'cursos-catalogo.js', 'cursos-formacion-data.js', 'cursos-formacion.js', 'cursos-oferta.js', 'cursos-pack-controller.js'].forEach(name => run(script(name)));
  const ids = [...run('KJA_FORMATION.courses.map(course => course.id)')];
  const document = window.document;
  const addButton = id => document.querySelector(`[data-offer-add="${id}"]`);
  return { dom, window, document, run, ids, opened, addButton, pack: window.KJA_COURSE_PACK, view: window.KJA_COURSE_OFFER };
}

test('los botones del catálogo agregan hasta cuatro cursos y explican el límite del quinto', () => {
  const { dom, document, ids, addButton, pack, view } = setup();
  assert.equal(document.querySelectorAll('[data-offer-add]:not([hidden])').length, ids.length);
  assert.equal(document.querySelectorAll('.formation-course-soon [data-offer-add]').length, 0);
  ids.slice(0, 4).forEach(id => addButton(id).click());
  assert.deepEqual([...pack.ids()], ids.slice(0, 4));
  assert.deepEqual([...view.getSelection()], ids.slice(0, 4));
  assert.equal(addButton(ids[3]).getAttribute('aria-pressed'), 'true');
  assert.match(addButton(ids[3]).textContent, /Gratis en tu pack/);
  assert.match(addButton(ids[0]).textContent, /En tu pack/);
  assert.equal(addButton(ids[4]).dataset.packFull, 'true');
  addButton(ids[4]).click();
  assert.deepEqual([...pack.ids()], ids.slice(0, 4));
  assert.match(document.querySelector('.formation-pack-note').textContent, /ya tiene 4/);
  assert.equal(document.querySelector('[data-offer-checkout]').hidden, false);
  dom.window.close();
});

test('no admite duplicados ni IDs desconocidos', () => {
  const { dom, ids, pack } = setup();
  assert.equal(pack.add(ids[0]).ok, true);
  assert.deepEqual({ ...pack.add(ids[0]) }, { ok: false, reason: 'duplicate' });
  assert.deepEqual({ ...pack.add('curso-inexistente') }, { ok: false, reason: 'unknown' });
  assert.deepEqual([...pack.ids()], [ids[0]]);
  dom.window.close();
});

test('quitar y volver a agregar conserva el orden de selección; de cuatro a tres oculta WhatsApp', () => {
  const { dom, document, ids, addButton, pack, view } = setup();
  ids.slice(0, 4).forEach(id => addButton(id).click());
  addButton(ids[1]).click();
  assert.deepEqual([...pack.ids()], [ids[0], ids[2], ids[3]]);
  assert.equal(addButton(ids[1]).getAttribute('aria-pressed'), 'false');
  assert.equal(document.querySelector('[data-offer-checkout]').hidden, true);
  addButton(ids[1]).click();
  assert.deepEqual([...view.getSelection()], [ids[0], ids[2], ids[3], ids[1]]);
  dom.window.close();
});

test('filtros y paginación no pierden la selección', () => {
  const { dom, document, ids, addButton, pack } = setup();
  addButton(ids[0]).click();
  addButton(ids[1]).click();
  document.querySelector('[data-formation-route="infantil"]').click();
  document.querySelector('[data-formation-route=""]').click();
  document.querySelector('[data-formation-page="2"]')?.click();
  assert.deepEqual([...pack.ids()], ids.slice(0, 2));
  assert.equal(addButton(ids[0]).getAttribute('aria-pressed'), 'true');
  assert.equal(addButton(ids[1]).closest('[data-formation-course]').dataset.inPack, 'true');
  dom.window.close();
});

test('quitar desde el panel actualiza el estado canónico, la vista y las tarjetas', () => {
  const { dom, document, ids, addButton, pack, view } = setup();
  ids.slice(0, 3).forEach(id => addButton(id).click());
  document.querySelector(`[data-offer-remove="${ids[1]}"]`).click();
  assert.deepEqual([...pack.ids()], [ids[0], ids[2]]);
  assert.deepEqual([...view.getSelection()], [ids[0], ids[2]]);
  assert.equal(addButton(ids[1]).getAttribute('aria-pressed'), 'false');
  dom.window.close();
});

test('WhatsApp solo se abre con cuatro cursos válidos y lleva sus nombres', () => {
  const { dom, document, run, ids, addButton, opened } = setup();
  ids.slice(0, 3).forEach(id => addButton(id).click());
  document.dispatchEvent(new dom.window.CustomEvent('kja:offer:checkout', { detail: {} }));
  assert.equal(opened.length, 0);
  addButton(ids[3]).click();
  document.querySelector('[data-offer-checkout]').click();
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^https:\/\/wa\.me\/51988918238\?text=/);
  const text = decodeURIComponent(opened[0].split('?text=')[1]);
  const names = run(`${JSON.stringify(ids.slice(0, 4))}.map(id => { const course = KJA_FORMATION.courses.find(item => item.id === id); return course.fullTitle || course.title; })`);
  names.forEach((name, index) => assert.ok(text.includes(`${index + 1}. ${name}`), name));
  assert.match(text, /3 cursos por S\/99 en total \+ 1 gratis/);
  assert.match(text, /\(incluido gratis\)\nQuisiera confirmar mi inscripción\.$/);
  dom.window.close();
});

test('la selección guardada se revalida y descarta IDs inválidos o repetidos', () => {
  const { dom, window, ids, pack, view } = setup({ stored: JSON.stringify(['rrhh', 'curso-inexistente', 'rrhh', 'wisc-v', 7]) });
  assert.deepEqual([...pack.ids()], ['rrhh', 'wisc-v']);
  assert.deepEqual([...view.getSelection()], ['rrhh', 'wisc-v']);
  assert.equal(window.sessionStorage.getItem('kja-pack-v1'), JSON.stringify(['rrhh', 'wisc-v']));
  assert.ok(ids.includes('rrhh') && ids.includes('wisc-v'));
  dom.window.close();
  const broken = setup({ stored: '{no-json' });
  assert.deepEqual([...broken.pack.ids()], []);
  broken.dom.window.close();
});

test('en las áreas históricas no se crea el pack', () => {
  const { dom, window } = setup({ area: true });
  assert.equal(window.KJA_COURSE_PACK, undefined);
  assert.equal(window.document.querySelector('.pack-flight-layer'), null);
  dom.window.close();
});
