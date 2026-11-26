import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const { values } = JSON.parse(read('../assets/admin-tokens.json'));
const stylesheet = read('../assets/css/paginas/kja-admin-tokens.css');

function color(value) {
  const alias=/^var\(--kja-([\w-]+)\)$/.exec(value);
  if(alias){assert.ok(values[alias[1]]&&values[alias[1]]!==value,'Alias de color válido: '+value);return color(values[alias[1]]);}
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    const channels = value.slice(1).match(/../g).map(hex => parseInt(hex, 16));
    return { channels, alpha: 1 };
  }
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d+)\s*\)$/.exec(value);
  assert.ok(rgba, 'Formato de color no reconocido: ' + value);
  const channels = rgba.slice(1, 4).map(Number);
  const alpha = Number(rgba[4]);
  assert.ok(channels.every(n => n <= 255) && alpha <= 1, 'Color fuera de rango: ' + value);
  return { channels, alpha };
}

function luminance(channels) {
  const [r, g, b] = channels.map(channel => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function minimumContrast(ink, surface) {
  assert.equal(ink.alpha, 1, 'El primer plano debe ser opaco para esta comprobación');
  const foreground = luminance(ink.channels);
  // sRGB luminance increases with each channel. Black and white bound every
  // possible backing color, including an arbitrary image behind the glass.
  const over = backing => luminance(surface.channels.map(c => c * surface.alpha + backing * (1 - surface.alpha)));
  const low = over(0), high = over(255);
  const nearest = Math.max(low, Math.min(foreground, high));
  return (Math.max(foreground, nearest) + 0.05) / (Math.min(foreground, nearest) + 0.05);
}

test('WCAG: extremos, orden inverso y fondo translúcido de igual luminancia', () => {
  const black = color('#000000'), white = color('#ffffff');
  assert.equal(minimumContrast(black, white), 21);
  assert.equal(minimumContrast(white, black), 21);
  assert.equal(minimumContrast(black, black), 1);
  assert.equal(minimumContrast(color('#888888'), color('rgba(255,255,255,.5)')), 1);
  assert.ok(minimumContrast(color('#777777'), white) < 4.5);
});

test('el CSS publicado en el repositorio coincide con los tokens fuente', () => {
  const entries = [...stylesheet.matchAll(/^\s*--kja-([\w-]+):\s*([^;]+);/gm)].map(m => [m[1], m[2]]);
  assert.equal(entries.length, Object.keys(values).length);
  assert.deepEqual(Object.fromEntries(entries), values);
});

function check(foreground, backgrounds, threshold) {
  for (const background of backgrounds) {
    test(foreground + ' sobre ' + background + ' ≥ ' + threshold + ':1', () => {
      const ratio = minimumContrast(color(values[foreground]), color(values[background]));
      assert.ok(ratio >= threshold, foreground + ' sobre ' + background + ' alcanza ' + ratio.toFixed(3) + ':1');
    });
  }
}

const surfaces = ['surface-opaque', 'surface-hover', 'surface-cream', 'surface-canvas', 'surface-accent-tint'];
for (const text of ['text-primary', 'text-secondary', 'status-neutral-text', 'action-secondary']) check(text, surfaces, 4.5);
check('text-primary', ['status-neutral-bg', 'status-bg'], 4.5);
check('on-action', ['action-primary', 'action-danger', 'status-text', 'status-warning-text', 'status-justified-text', 'status-neutral-text'], 4.5);
check('action-primary', ['surface-hover'], 4.5);
check('action-primary', ['surface-accent-tint'], 4.5);
check('action-danger', ['status-error-bg'], 4.5);
check('status-error-text', ['surface-opaque'], 4.5);
check('person-avatar-text', ['person-avatar-bg'], 4.5);
check('status-text', ['status-bg', 'surface-opaque'], 4.5);
for (const tone of ['info', 'warning', 'error', 'justified', 'neutral']) {
  check('status-' + tone + '-text', ['status-' + tone + '-bg'], 4.5);
}
check('focus', [...surfaces, 'status-bg', 'status-neutral-bg'], 3);
check('selection-border', [...surfaces, 'status-bg'], 3);
check('field-border', surfaces, 3);
check('on-action', ['action-primary-hover', 'action-primary-pressed', 'action-danger-hover', 'action-danger-pressed'], 4.5);
check('action-disabled-text', ['action-disabled-bg'], 4.5);
check('action-secondary', ['action-neutral-pressed'], 4.5);
check('action-danger', ['action-neutral-pressed'], 4.5);
check('on-action', ['filter-selected-count-bg'], 4.5);
check('text-primary', ['filter-pressed-bg'], 4.5);
check('tab-indicator-color', surfaces, 3);

test('foco y selección conservan tokens semánticos y geometría compartida', () => {
  assert.equal(values['focus-ring-width'], '2px');
  assert.equal(values['focus-ring-offset'], '2px');
  assert.equal(values['field-border-width'], '1px');
  assert.equal(values['selection-border'], values.focus);
});
