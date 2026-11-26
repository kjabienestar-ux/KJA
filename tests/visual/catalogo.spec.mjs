import { test, expect } from '@playwright/test';

const catalog = new URL('../../docs/auditorias/KJA-051/catalogo.html', import.meta.url);
test.beforeEach(async ({ page }) => {
  await page.goto(catalog.href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, img => img.decode()));
  });
});

test('Grupos abiertos, cerrados y foco de teclado', async ({ page }) => {
  const groups = page.locator('#examples');
  await expect(groups).toHaveScreenshot('grupos-inicial.png');
  const buttons = groups.getByRole('button');
  for (const button of await buttons.all()) await button.press('Space');
  await expect(buttons.last()).toBeFocused();
  await expect(groups).toHaveScreenshot('grupos-alternados.png');
});

test('Acciones y etiqueta de estado', async ({ page }) => {
  const variants = page.locator('details');
  await variants.locator('summary').press('Enter');
  await variants.getByRole('button', { name: 'Guardar' }).focus();
  await expect(variants).toHaveScreenshot('acciones.png');
});

test('Las cuatro jerarquías comparten estados y los botones deshabilitados no reaccionan', async ({ page }) => {
  const panel = page.locator('details');
  await panel.locator('summary').press('Enter');
  const actions = panel.locator('.kja-button');
  const expected = [
    ['Guardar','rgb(147, 71, 47)','rgb(133, 64, 39)','rgb(120, 59, 39)'],
    ['Actualizar','rgb(255, 253, 249)','rgb(246, 238, 228)','rgb(241, 237, 230)'],
    ['Cancelar','rgba(0, 0, 0, 0)','rgb(246, 238, 228)','rgb(241, 237, 230)'],
    ['Eliminar','rgb(151, 62, 70)','rgb(130, 52, 60)','rgb(112, 44, 51)'],
  ];
  for (const [label,normal,hover,pressed] of expected) {
    const button = actions.filter({ hasText: label });
    await page.mouse.move(0,0);
    await expect(button).toHaveCSS('background-color', normal);
    const width = await button.evaluate(n=>n.offsetWidth);
    await button.hover();
    await expect(button).toHaveCSS('background-color', hover);
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', pressed);
    await page.mouse.move(0,0);
    await page.mouse.up();
    await expect(button).toHaveCSS('background-color', normal);
    expect(await button.evaluate(n=>n.offsetWidth)).toBe(width);
    await page.keyboard.press('Tab');
    await button.focus();
    await expect(button).toHaveCSS('outline-color','rgb(82, 121, 102)');
    await expect(button).toHaveCSS('outline-width','2px');
    await expect(button).toHaveCSS('outline-offset','2px');
  }
  const disabled=actions.filter({hasText:'Deshabilitado'});
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveCSS('background-color','rgb(241, 237, 230)');
  await expect(disabled).toHaveCSS('color','rgb(92, 86, 79)');
  await expect(disabled).toHaveCSS('opacity','1');
  await disabled.hover();
  await page.mouse.down();
  await expect(disabled).toHaveCSS('background-color','rgb(241, 237, 230)');
  await expect(disabled).toHaveCSS('scale','1');
  await page.mouse.up();
});

test('Vistas del piloto', async ({ page }) => {
  for (const view of ['colaboradores', 'contratos', 'lista', 'seguimiento']) {
    const button = page.locator('[data-view="' + view + '"]');
    await button.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const current = page.locator('#current img');
    await current.evaluate(img => img.decode());
    await expect(current).toHaveScreenshot(view + '.png');
  }
});

test('Listado diario y calendario de asignaciones', async ({ page }) => {
  for (const id of ['asignaciones-dia', 'calendario-asignaciones']) {
    await expect(page.locator('#' + id + ' img')).toHaveScreenshot(id + '.png');
  }
});

test('Seis estados de consulta tienen captura y componente en Figma', async ({ page }) => {
  for (const name of ['carga-inicial-fila', 'actualizando-fila', 'fecha-vacia', 'sin-coincidencias', 'boton-reintentar', 'actualizacion-fallida']) {
    const row = page.locator('#referencias-c2 tr').filter({ has: page.locator('a[href="' + name + '.png"]') });
    await expect(row.getByRole('link', {name: /Abrir en Figma/})).toHaveAttribute('href', /node-id=\d+-\d+$/);
    await expect(page.locator('img[src="' + name + '.png"]')).toHaveScreenshot(name + '.png');
  }
});
