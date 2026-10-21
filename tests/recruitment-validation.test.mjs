import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../reclutamiento.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../assets/js/reclutamiento.js', import.meta.url), 'utf8');
async function setup(t) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/reclutamiento.html' });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.alert = () => assert.fail('Validation must not open a browser alert');
  await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  w.eval(script);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const el = id => w.document.getElementById(id);
  const set = (id, value, event = 'input') => { el(id).value = value; el(id).dispatchEvent(new w.Event(event)); };
  const cv = (name = 'cv.pdf', size = 20) => {
    Object.defineProperty(el('rec-cv-input'), 'files', { configurable: true, value: [new w.File(['a'.repeat(size)], name)] });
    el('rec-cv-input').dispatchEvent(new w.Event('change'));
  };
  const valid = () => {
    for (const id of ['chk-rec-fb', 'chk-rec-horario', 'chk-rec-entrevista']) { el(id).checked = true; el(id).dispatchEvent(new w.Event('change')); }
    set('rec-nombres', 'Andrea Morales'); set('rec-dni', '01234567');
    set('rec-telefono', '+51 987 654 321'); set('rec-email', 'andrea@example.com'); cv();
    w.switchRecStep(2); w.validateStep2AndNext();
  };
  return { w, el, set, cv, valid };
}

test('empty step lists every missing field, links errors and focuses the first input', async t => {
  const { w, el, set } = await setup(t);
  w.switchRecStep(2); w.validateStep2AndNext();
  assert.equal(el('rec-validation-2').querySelectorAll('button').length, 5);
  assert.equal(w.document.activeElement, el('rec-nombres'));
  assert.equal(el('rec-nombres').getAttribute('aria-invalid'), 'true');
  assert.ok(el('rec-nombres').getAttribute('aria-describedby').includes('rec-nombres-error'));
  set('rec-nombres', 'Andrea');
  assert.equal(el('rec-nombres-error').hidden, true);
  assert.equal(el('rec-validation-2').querySelectorAll('button').length, 4);
  el('rec-validation-2').querySelector('button').click();
  assert.equal(w.document.activeElement, el('rec-dni'));
});

test('validates on blur and allows corrections to DNI, email and international phone', async t => {
  const { el, set } = await setup(t);
  for (const [id, bad, good] of [['rec-dni', 'abcdefgh', '01234567'], ['rec-email', 'wrong', 'ana@example.com'], ['rec-telefono', '987abc321', '+51 987 654 321']]) {
    set(id, bad, 'blur'); assert.equal(el(id).getAttribute('aria-invalid'), 'true');
    set(id, good); assert.equal(el(id).getAttribute('aria-invalid'), 'false');
  }
});

test('CV rejects format, oversized and empty files, recovers and validates removal', async t => {
  const { w, el, cv, valid } = await setup(t);
  cv('photo.png'); assert.match(el('rec-cv-input-error').textContent, /PDF, DOC o DOCX/);
  cv('cv.pdf', 10 * 1024 * 1024 + 1); assert.match(el('rec-cv-input-error').textContent, /10 MB/);
  cv('cv.pdf', 0); assert.match(el('rec-cv-input-error').textContent, /vac/);
  valid(); assert.equal(el('rec-cv-input-error').hidden, true);
  assert.equal(el('rec-tab-3').getAttribute('aria-selected'), 'true');
  w.removeCvFile(); assert.equal(el('rec-cv-dropzone').getAttribute('aria-invalid'), 'true');
});

test('notification fields block submission until corrected', async t => {
  const { w, el, set, valid } = await setup(t);
  valid(); let calls = 0; w.KJARecruitmentAPI = { submit: () => { calls++; } };
  set('rec-correo-notificacion', 'bad'); set('rec-telefono-notificacion', '123');
  await w.validateStep3AndNext();
  assert.equal(calls, 0);
  assert.equal(w.document.activeElement, el('rec-correo-notificacion'));
  assert.equal(el('rec-validation-3').querySelectorAll('button').length, 2);
});

test('network failure preserves inputs and CV, exposes error and permits retry', async t => {
  const { w, el, valid } = await setup(t);
  valid(); const calls = [];
  w.KJARecruitmentAPI = { submit: async (...args) => { calls.push(args); throw new Error('Connection failed. Retry.'); }, message: e => e.message };
  await w.validateStep3AndNext();
  assert.equal(calls.length, 1);
  assert.equal(el('rec-submit-error').hidden, false);
  assert.equal(el('rec-btn-p3-next').disabled, false);
  assert.equal(el('rec-panel-3').inert, false);
  assert.equal(w.document.activeElement, el('rec-submit-error'));
  assert.equal(el('rec-nombres').value, 'Andrea Morales');
  await w.validateStep3AndNext(); assert.equal(calls.length, 2);
  assert.equal(calls[0][0], calls[1][0]); assert.equal(calls[0][2], calls[1][2]);
});

test('skipping earlier steps leads back to the incomplete requirements', async t => {
  const { w, el, set } = await setup(t);
  w.switchRecStep(3);
  set('rec-correo-notificacion', 'ana@example.com'); set('rec-telefono-notificacion', '987654321');
  await w.validateStep3AndNext();
  assert.equal(el('rec-tab-1').getAttribute('aria-selected'), 'true');
  assert.equal(w.document.activeElement, el('chk-rec-fb'));
  assert.equal(el('rec-validation-1').hidden, false);
});

test('successful submission confirms once and keyboard can open the CV picker', async t => {
  const { w, el, valid } = await setup(t);
  let pickers = 0; el('rec-cv-input').click = () => pickers++;
  el('rec-cv-dropzone').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' }));
  assert.equal(pickers, 1);
  valid(); let calls = 0;
  w.KJARecruitmentAPI = { submit: async () => { calls++; return { codigo: 'KJA-TEST', created_at: '2026-10-21T15:00:00Z' }; } };
  await w.validateStep3AndNext();
  assert.equal(calls, 1);
  assert.equal(el('rec-tab-4').getAttribute('aria-selected'), 'true');
  await w.validateStep3AndNext(); assert.equal(calls, 1);
});
