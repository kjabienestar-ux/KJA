import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const assistant = require('../assets/js/whatsapp-assistant.js');

test('uses real KJA service categories and adapts direct adviser flow', () => {
  assert.ok(assistant.SERVICES.some(item => item.label === 'Terapia para niños'));
  assert.ok(assistant.SERVICES.some(item => item.label === 'Cursos y talleres'));
  assert.deepEqual(assistant.stepsFor('asesor'), ['service', 'notes', 'summary']);
  assert.deepEqual(assistant.stepsFor('pareja'), ['service', 'intent', 'detail', 'timing', 'notes', 'summary']);
});

test('builds a professional WhatsApp message from every answer', () => {
  const answers = { service: 'pareja', intent: 'Quiero conocer el precio', detail: 'Virtual', timing: 'Esta semana', notes: 'Preferimos atención por la tarde.' };
  const message = assistant.buildMessage(answers);
  assert.match(message, /página web de KJA/);
  assert.match(message, /Terapia de pareja/);
  assert.match(message, /Quiero conocer el precio/);
  assert.match(message, /Virtual/);
  assert.match(message, /Esta semana/);
  assert.match(message, /atención por la tarde/);
});

test('encodes the configured number and message safely', () => {
  const url = assistant.whatsappUrl('+51 988 918 238', { service: 'cursos', intent: 'Quiero más información', detail: 'Virtual', timing: 'Este mes' });
  assert.ok(url.startsWith('https://wa.me/51988918238?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]).includes('Cursos y talleres'), true);
});
