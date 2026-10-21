import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(new URL('../assets/js/dashboard-reclutamiento.js', import.meta.url), 'utf8');
async function setup(t) {
  const dom = new JSDOM('<main id="rec-inbox-root"></main>', { runScripts: 'outside-only', url: 'https://example.test' });
  t.after(() => dom.window.close());
  const w = dom.window;
  await new Promise(resolve => w.addEventListener('load', resolve, { once: true }));
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  w.db = { auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) } };
  let item = { id: 'candidate', codigo: 'KJA-TEST', created_at: '2026-10-21T15:00:00Z', revision: 1, estado: 'Pendiente', notas_revision: '', datos: { nombres: '<img src=x onerror=alert(1)>', dni: '01234567', email: 'ana@example.com', emailNotificacion: 'ana@example.com', telefono: '987654321', carrera: 'Psicología Clínica', nivel: 'Egresada', entrevistaFecha: '2026-10-23', entrevistaHora: '03:00 PM', cvName: 'Mi CV.pdf', motivacion: '<script>alert(1)</script>', requisitosAceptados: true } };
  const calls = [];
  let update = async args => ({ ...item, estado: args.p_estado, notas_revision: args.p_notas, revision: item.revision + 1 });
  let downloadCv = async () => { throw new Error('Descarga no disponible. Reintenta.'); };
  w.URL.createObjectURL = () => 'blob:https://example.test/cv';
  w.URL.revokeObjectURL = () => {};
  w.KJARecruitmentAPI = { message: e => e.message, rpc: async (_client, name, args) => {
    calls.push({ name, args });
    if (name === 'rec_es_admin') return true;
    if (name === 'rec_listar') return { items: [item], total: 1, counts: { pendientes: 1 } };
    if (name === 'rec_actualizar') { item = await update(args); return item; }
    if (name === 'rec_descargar_cv') return downloadCv(args);
    throw new Error(name);
  } };
  w.eval(source); await w.kjaRecruitment.refresh(); w.kjaRecruitment.openDetail('candidate');
  const el = id => w.document.getElementById(id);
  const edit = (id, value) => {
    if (id === 'ri-detail-status') { el('ri-detail-status-trigger').click(); el(id).querySelector(`[role="option"][data-value="${value}"]`).click(); return; }
    el(id).value = value; el(id).dispatchEvent(new w.Event('input'));
  };
  return { w, el, edit, calls, setUpdate: fn => { update = fn; }, setCv: fn => { downloadCv = fn; } };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const pdf = { nombre: 'Mi CV.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.4').toString('base64') };

test('detail groups candidate information safely and handles unavailable file size', async t => {
  const { w, el } = await setup(t);
  assert.equal(el('rec-inbox-detail').open, true);
  assert.equal(el('ri-detail-data').querySelectorAll('img,script').length, 0);
  assert.match(el('ri-detail-title').textContent, /<img/);
  assert.match(el('ri-detail-data').textContent, /Documento adjunto/);
  assert.doesNotMatch(el('ri-detail-data').textContent, /NaN|undefined/);
  assert.match(el('ri-detail-data').textContent, /23 de octubre de 2026/);
  assert.equal(el('ri-save').disabled, true);
  assert.equal(w.document.activeElement, el('ri-detail-title'));
  assert.match(el('ri-email').href, /^mailto:/);
});

test('editing, saving, and resetting to saved values keeps state and notes consistent', async t => {
  const { el, edit, calls } = await setup(t);
  edit('ri-detail-status', 'Entrevista'); edit('ri-detail-notes', 'Confirmar disponibilidad.');
  assert.equal(el('ri-save').disabled, false);
  assert.match(el('ri-save-state').textContent, /sin guardar/);
  await el('ri-review-form').onsubmit({ preventDefault() {} });
  assert.equal(el('ri-current-status').textContent, 'Entrevista');
  assert.equal(el('ri-save').disabled, true);
  assert.equal(el('ri-detail-message').hidden, false);
  assert.equal(calls.find(c => c.name === 'rec_actualizar').args.p_revision, 1);
  edit('ri-detail-notes', 'Otra nota'); assert.equal(el('ri-save').disabled, false);
  edit('ri-detail-notes', 'Confirmar disponibilidad.'); assert.equal(el('ri-save').disabled, true);
});

test('failed save preserves edits, announces recovery, and permits retry', async t => {
  const { el, edit, setUpdate } = await setup(t);
  edit('ri-detail-notes', 'Conservar esta nota.');
  setUpdate(async () => { throw new Error('No se pudo guardar. Reintenta.'); });
  await el('ri-review-form').onsubmit({ preventDefault() {} });
  assert.equal(el('ri-detail-notes').value, 'Conservar esta nota.');
  assert.equal(el('ri-save').disabled, false);
  assert.equal(el('ri-detail-message').getAttribute('role'), 'alert');
  assert.match(el('ri-detail-message').textContent, /Reintenta/);
});

test('saving prevents duplicate requests and closing until the response arrives', async t => {
  const { w, el, edit, calls, setUpdate } = await setup(t);
  let finish;
  setUpdate(args => new Promise(resolve => { finish = () => resolve({ id: 'candidate', estado: args.p_estado, notas_revision: args.p_notas, revision: 2, datos: {} }); }));
  edit('ri-detail-status', 'En revisión');
  const pending = el('ri-review-form').onsubmit({ preventDefault() {} });
  assert.equal(el('ri-close').disabled, true);
  const cancel = new w.Event('cancel', { cancelable: true }); el('rec-inbox-detail').dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  await el('ri-review-form').onsubmit({ preventDefault() {} });
  assert.equal(calls.filter(c => c.name === 'rec_actualizar').length, 1);
  finish(); await pending;
  assert.equal(el('ri-close').disabled, false);
});

test('status dropdown reflects the saved state, opens with the keyboard and closes after choosing', async t => {
  const { w, el, edit } = await setup(t);
  const selected = () => [...el('ri-detail-status').querySelectorAll('[aria-selected="true"]')].map(o => o.dataset.value);
  const menu = el('ri-detail-status').querySelector('[role="listbox"]');
  assert.deepEqual(selected(), ['Pendiente']);
  assert.equal(el('ri-detail-status-trigger').textContent.trim(), 'Pendiente');
  el('ri-detail-status-trigger').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(menu.hidden, false);
  assert.equal(el('ri-detail-status-trigger').getAttribute('aria-expanded'), 'true');
  menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(menu.hidden, true);
  assert.deepEqual(selected(), ['En revisión']);
  edit('ri-detail-status', 'Aprobado');
  assert.deepEqual(selected(), ['Aprobado']);
  assert.equal(el('ri-detail-status-trigger').dataset.state, 'approved');
  assert.match(el('ri-status-help').textContent, /aprobada/);
  assert.equal(w.document.querySelectorAll('select').length, 0);
});

test('a record without a stored CV explains it instead of offering a retry', async t => {
  const { el, setCv } = await setup(t);
  setCv(async () => { throw new Error('CV no disponible'); });
  el('ri-preview').click(); await flush();
  assert.match(el('ri-viewer-empty-text').textContent, /no tiene un CV guardado/);
  assert.equal(el('ri-viewer-retry').hidden, true);
});

test('PDF preview opens inside the dialog, reuses the file for download and returns to the record', async t => {
  const { el, calls, setCv } = await setup(t);
  setCv(async () => pdf);
  el('ri-preview').click(); await flush();
  assert.equal(el('rec-inbox-detail').classList.contains('is-previewing'), true);
  assert.equal(el('ri-detail-data').hidden, true);
  assert.equal(el('ri-viewer-frame').hidden, false);
  assert.match(el('ri-viewer-frame').src, /^blob:.*#navpanes=0&view=FitH$/);
  assert.equal(el('ri-viewer-open').hasAttribute('aria-disabled'), false);
  el('ri-viewer-download').click(); await flush();
  assert.equal(calls.filter(c => c.name === 'rec_descargar_cv').length, 1);
  el('ri-viewer-back').click();
  assert.equal(el('rec-inbox-detail').classList.contains('is-previewing'), false);
  assert.equal(el('ri-detail-data').hidden, false);
  assert.equal(el('ri-viewer-frame').hasAttribute('src'), false);
});

test('preview explains unsupported formats and recovers from errors with a retry', async t => {
  const { el, setCv } = await setup(t);
  el('ri-preview').click(); await flush();
  assert.equal(el('ri-viewer-empty').hidden, false);
  assert.match(el('ri-viewer-empty-text').textContent, /Reintenta/);
  assert.equal(el('ri-viewer-retry').hidden, false);
  setCv(async () => ({ ...pdf, nombre: 'Mi CV.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  el('ri-viewer-retry').click(); await flush();
  assert.equal(el('ri-viewer-frame').hidden, true);
  assert.match(el('ri-viewer-empty-text').textContent, /no se puede previsualizar/);
  assert.equal(el('ri-viewer-retry').hidden, true);
});

test('closing the dialog leaves the preview mode', async t => {
  const { el, setCv } = await setup(t);
  setCv(async () => pdf);
  el('ri-preview').click(); await flush();
  el('ri-close').click();
  assert.equal(el('rec-inbox-detail').open, false);
  assert.equal(el('rec-inbox-detail').classList.contains('is-previewing'), false);
  assert.equal(el('ri-cv-viewer').hidden, true);
});
