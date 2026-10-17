import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'parse5';

const htmlSource = fs.readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
const jsSource = fs.readFileSync(new URL('../assets/js/dashboard-marketing.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../assets/css/paginas/dashboard-marketing.css', import.meta.url), 'utf8');

const document = parse(htmlSource);
const nodes = [];
function walk(node){ nodes.push(node); for(const child of node.childNodes||[]) walk(child); }
walk(document);
const attr = (node, key) => node?.attrs?.find(a => a.name === key)?.value;
const find = id => nodes.find(n => attr(n, 'id') === id);

test('emoji popover is unclipped and styled with iOS frosted glass', () => {
  assert.ok(find('marketing-emoji-popover'), 'emoji popover element must exist');
  assert.ok(find('marketing-emoji-search'), 'emoji search input must exist');
  assert.ok(find('marketing-emoji-search-clear'), 'emoji search clear button must exist');
  assert.ok(find('marketing-emoji-close'), 'emoji close button must exist');
  assert.ok(find('marketing-emoji-list'), 'emoji list region must exist');

  // Verify that marketing-ai-refine is overflow: visible so popover is not clipped
  assert.match(cssSource, /\.marketing-ai-refine\s*\{[^}]*overflow:\s*visible/, 'marketing-ai-refine must have overflow: visible');
  assert.match(cssSource, /\.marketing-emoji-popover\s*\{[^}]*backdrop-filter:\s*blur/, 'popover must have backdrop-filter blur');
  assert.match(cssSource, /\.marketing-emoji-popover\s*\{[^}]*z-index:\s*1000/, 'popover must have high z-index');
});

test('emoji segmented destination controller has buttons for copy, prompt and whatsapp', () => {
  const targetCopy = find('marketing-emoji-target-copy');
  const targetPrompt = find('marketing-emoji-target-prompt');
  const targetWa = find('marketing-emoji-target-whatsapp');
  assert.ok(targetCopy, 'target copy button must exist');
  assert.ok(targetPrompt, 'target prompt button must exist');
  assert.ok(targetWa, 'target whatsapp button must exist');
});

test('emoji category navigation contains all 9 standard iOS categories including Peru flag', () => {
  const expectedCats = ['destacados', 'caras', 'personas', 'animales', 'comida', 'actividades', 'viajes', 'objetos', 'simbolos'];
  expectedCats.forEach(cat => {
    const tab = nodes.find(n => attr(n, 'data-cat') === cat);
    assert.ok(tab, `category tab for "${cat}" must exist in dashboard.html`);
  });

  // Verify catalog in dashboard-marketing.js includes Peru flag 🇵🇪 and accent-insensitive normalization
  assert.ok(jsSource.includes('🇵🇪'), 'catalog must include Peruvian flag 🇵🇪');
  assert.match(jsSource, /normalizeSearchText/, 'js must include normalizeSearchText helper');
  assert.match(jsSource, /peru perú lima bandera nacional/, 'flag must have peru and perú search tags');
});
