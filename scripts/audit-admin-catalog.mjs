import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const catalog = new URL('../docs/auditorias/KJA-051/catalogo.html', import.meta.url);
const browser = await chromium.launch({
  channel: process.env.KJA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'),
  executablePath: process.env.KJA_BROWSER_EXECUTABLE || undefined
});
const failures = [];

async function audit(page, state) {
  const result = await page.evaluate(() => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
  }));
  const evaluated = [...result.passes, ...result.violations, ...result.incomplete].map(rule => rule.id);
  for (const id of ['image-alt', 'button-name', 'color-contrast']) {
    assert.ok(evaluated.includes(id), state + ' · Sin evaluación de ' + id);
  }
  for (const violation of result.violations) {
    for (const node of violation.nodes) failures.push(state + ' · ' + violation.id + ' · ' + node.target.join(' '));
  }
  console.log(state + ' · ' + result.violations.length + ' reglas con incidencias · ' + result.incomplete.length + ' reglas con resultados de revisión manual');
}

try {
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: {width, height} });
    await page.goto(catalog.href);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const groups = page.locator('#examples button[aria-expanded]');
    assert.equal(await groups.count(), 2, 'El catálogo debe cargar sus dos grupos interactivos');
    const views = page.locator('[data-view]');
    assert.equal(await views.count(), 4, 'El catálogo debe cargar sus cuatro vistas');
    await audit(page, width + ' px · inicial');
    for (const button of await groups.all()) {
      const before = await button.getAttribute('aria-expanded');
      await button.focus();
      await button.press('Space');
      assert.notEqual(await button.getAttribute('aria-expanded'), before);
    }
    for (const button of await views.all()) {
      await button.press('Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      await audit(page, width + ' px · ' + await button.textContent());
    }
    await page.close();
  }
} finally {
  await browser.close();
}

assert.equal(failures.length, 0, '\n' + failures.join('\n'));
