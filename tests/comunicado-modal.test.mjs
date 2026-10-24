import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Comunicado oficial: estilos CSS responsivos y accesibles', () => {
  const css = fs.readFileSync('assets/css/comunicado-modal.css', 'utf-8');

  // Backdrop overlay y blur
  assert.match(css, /\.kja-comunicado-overlay/, 'Debe tener clase para el overlay');
  assert.match(css, /backdrop-filter/, 'Debe tener backdrop-filter');

  // Adaptabilidad móvil y altura dinámica dvh
  assert.match(css, /100dvh/, 'Debe contemplar 100dvh para navegadores móviles');
  assert.match(css, /@media\s*\(max-width:\s*480px\)/, 'Debe incluir media queries móviles');
  assert.match(css, /overscroll-behavior:\s*contain/, 'Debe prevenir scroll accidental de fondo en móviles');
  assert.match(css, /overflow-y:\s*auto/, 'El modal debe ser scrollable si la pantalla es pequeña');

  // Disparador flotante
  assert.match(css, /\.kja-comunicado-trigger/, 'Debe existir botón flotante para reabrir el comunicado');
});

test('Comunicado oficial: lógica JS, atributos ARIA y contenido legible', () => {
  const js = fs.readFileSync('assets/js/comunicado-modal.js', 'utf-8');

  // ARIA y accesibilidad
  assert.match(js, /setAttribute\(['"]role['"],\s*['"]dialog['"]\)/, 'Debe tener role="dialog"');
  assert.match(js, /setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/, 'Debe tener aria-modal="true"');
  assert.match(js, /setAttribute\(['"]aria-labelledby['"]/, 'Debe tener aria-labelledby');
  assert.match(js, /setAttribute\(['"]aria-describedby['"]/, 'Debe tener aria-describedby');

  assert.match(js, /<h2 id="kja-comunicado-title"/);
  assert.match(js, /937 471 659/);
  assert.doesNotMatch(js, /<picture/);

  // Control de teclado y clic backdrop
  assert.match(js, /Escape/, 'Debe permitir cerrar con tecla Escape');
  assert.match(js, /sessionStorage/, 'Debe usar sessionStorage para no saturar al usuario');
  assert.match(js, /window\.kjaComunicado/, 'Debe exponer API pública window.kjaComunicado');
});

test('Comunicado oficial: integración en index.html y páginas principales', () => {
  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  assert.match(indexHtml, /assets\/css\/comunicado-modal\.css/, 'index.html debe vincular el CSS');
  assert.match(indexHtml, /assets\/js\/comunicado-modal\.js/, 'index.html debe vincular el script JS');

  const pages = ['nosotros.html', 'terapia.html', 'cursos.html', 'talleres.html', 'reclutamiento.html', 'dashboard.html'];
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf-8');
    assert.match(html, /assets\/js\/comunicado-modal\.js/, `${p} debe vincular el script`);
  }
});
