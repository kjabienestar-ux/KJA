import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const assistant = require('../assets/js/whatsapp-assistant.js');

test('starts with therapies or courses and exposes every current option', () => {
  assert.deepEqual(assistant.CATEGORIES.map(item => item.label), ['Terapias', 'Cursos']);
  assert.equal(assistant.THERAPIES.length, 18);
  assert.equal(assistant.COURSES.length, 9);
  assert.ok(assistant.THERAPIES.includes('Terapia de Ansiedad'));
  assert.ok(assistant.COURSES.includes('TEA / Autismo'));
  assert.ok(assistant.COURSES.includes('Salud Ocupacional y Bienestar'));
});

test('builds a professional WhatsApp message from the two selections', () => {
  const answers = { category: 'terapias', item: 'Terapia de Pareja' };
  const message = assistant.buildMessage(answers);
  assert.match(message, /página web/);
  assert.match(message, /Tipo de servicio: Terapias/);
  assert.match(message, /Opción elegida: Terapia de Pareja/);
  assert.match(message, /disponibilidad, modalidad y precio/);
});

test('encodes the configured number and message safely', () => {
  const url = assistant.whatsappUrl('+51 988 918 238', { category: 'cursos', item: 'Neuropsicología' });
  assert.ok(url.startsWith('https://wa.me/51988918238?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]).includes('Neuropsicología'), true);
});

test('keeps the assistant body visible with a viewport-aware panel height', () => {
  const css = readFileSync(new URL('../assets/css/whatsapp-assistant.css', import.meta.url), 'utf8');
  assert.match(css, /\.kja-wa-panel\s*\{[^}]*height:\s*min\(680px,\s*calc\(100dvh - 130px\)\)/s);
  assert.doesNotMatch(css, /\.kja-wa-panel\s*\{[^}]*max-height:/s);
});
