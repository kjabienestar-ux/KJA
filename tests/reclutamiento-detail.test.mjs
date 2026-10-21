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
  w.KJARecruitmentAPI = { message: e => e.message, rpc: async (_client, name, args) => {
    calls.push({ name, args });
    if (name === 'rec_es_admin') return true;
    if (name === 'rec_listar') return { items: [item], total: 1, counts: { pendientes: 1 } };
    if (name === 'rec_actualizar') { item = await update(args); return item; }
    if (name === 'rec_descargar_cv') throw new Error('Descarga no disponible. Reintenta.');
    throw new Error(name);
  } };
  w.eval(source); await w.kjaRecruitment.refresh(); w.kjaRecruitment.openDetail('candidate');
  const el = id => w.document.getElementById(id);
  const edit = (id, value) => { el(id).value = value; el(id).dispatchEvent(new w.Event(id === 'ri-detail-status' ? 'change' : 'input')); };
  return { w, el, edit, calls, setUpdate: fn => { update = fn; } };
}

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
