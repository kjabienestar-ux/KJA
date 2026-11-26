import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inspectCss, scanPortal, snapshot, compare } from '../scripts/check-admin-colors.mjs';

const inspect = css => new Map([['example.css', inspectCss(css, 'example.css')]]);
test('Una excepción solo cubre su selector, propiedad y número de usos', () => {
  const allowed = snapshot(inspect('.admin-panel { color: #fff }'));
  assert.equal(compare(inspect('.admin-panel { color: #fff; color: #fff }'), allowed).length, 1);
  assert.equal(compare(inspect('.admin-other { color: #fff }'), allowed).length, 1);
  assert.equal(compare(inspect('.admin-panel { background: #fff }'), allowed).length, 1);
  assert.deepEqual(compare(inspect(''), allowed), []);
});
test('Se revisan selectores administrativos y consultas que incluyen escritorio', () => {
  const css = '.public { color:red } @media(max-width:900px){.admin-panel{color:red}} @media(max-width:600px),(min-width:1200px){.admin-panel{color:blue}}';
  assert.equal(compare(inspect(css), {}).length, 1);
});
test('Se detectan literales en degradados y alternativas de variables, sin contar referencias', () => {
  const css = '.admin-panel { background: linear-gradient(var(--kja-bg,#fff),oklch(90% .1 40),red),url(#abc); color:currentColor; border-color:transparent; content:"#fff" }';
  assert.equal(compare(inspect(css), {}).length, 3);
});
test('El CSS de escritorio coincide con las excepciones vigentes', () => {
  const expected = JSON.parse(fs.readFileSync(new URL('../docs/auditorias/KJA-051/excepciones-colores.json', import.meta.url)));
  const actual = scanPortal();
  assert.deepEqual(compare(actual, expected), []);
  assert.deepEqual(snapshot(actual), expected);
});
