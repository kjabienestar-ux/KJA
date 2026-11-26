import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const catalog = new URL('../docs/auditorias/KJA-051/catalogo.html', import.meta.url);
const browser = await chromium.launch({
  channel: process.env.KJA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'),
  executablePath: process.env.KJA_BROWSER_EXECUTABLE || undefined
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(catalog.href);
  await page.evaluate(() => {
    const group = document.querySelector('#examples .kja-area-group');
    const row = group.querySelector('article div');
    const rows = Array.from({length: 1000}, (_, i) => {
      const copy = row.cloneNode(false);
      copy.textContent = 'Colaborador de prueba ' + (i + 1);
      return copy;
    });
    group.querySelector('article').replaceChildren(...rows);
    group.style.cssText = 'height:560px;overflow:auto';
    group.scrollIntoView({block:'center'});
  });
  const group = page.locator('#examples .kja-area-group').first();
  const cdp = await page.context().newCDPSession(page);
  console.log('Edge/Chromium ' + browser.version() + ' · 1440 × 900 · 1000 filas');
  for (const mode of ['aprobada', 'opaca', 'ensayo-blur']) {
    const reduced = mode === 'opaca';
    await cdp.send('Emulation.setEmulatedMedia', { features: [{
      name: 'prefers-reduced-transparency', value: reduced ? 'reduce' : 'no-preference'
    }] });
    const stats = await group.evaluate(async (el, mode) => {
      el.style.backdropFilter = mode === 'ensayo-blur' ? 'blur(4px)' : '';
      const {backgroundColor, backdropFilter} = getComputedStyle(el);
      const rowsWithBlur = [...el.querySelectorAll('article div')].filter(n => getComputedStyle(n).backdropFilter !== 'none').length;
      el.scrollTop = 0;
      const frames = [];
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      let previous = await frame();
      for (let i = 1; i <= 180; i++) {
        el.scrollTop = (el.scrollHeight - el.clientHeight) * i / 180;
        const now = await frame();
        if (i > 10) frames.push(now - previous);
        previous = now;
      }
      frames.sort((a,b) => a-b);
      return {backgroundColor,backdropFilter,rowsWithBlur,atEnd:Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop)<2,
        medianMs:+frames[Math.floor(frames.length*.5)].toFixed(1),p95Ms:+frames[Math.floor(frames.length*.95)].toFixed(1)};
    }, mode);
    assert.ok(stats.atEnd && stats.rowsWithBlur === 0);
    assert.equal(stats.backdropFilter, mode === 'ensayo-blur' ? 'blur(4px)' : 'none');
    assert.equal(stats.backgroundColor.startsWith('rgba('), !reduced);
    console.log(mode, stats);
  }
} finally {
  await browser.close();
}
