import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitDesktop,anchored,refactorCss} from '../scripts/refactor-admin-desktop-tokens.mjs';

test('La migración exige escritorio en cada alternativa de la consulta',()=>{
  assert.equal(explicitDesktop('(min-width:901px) and (hover:hover)'),true);
  assert.equal(explicitDesktop('(min-width:1280px),(min-width:1440px)'),true);
  assert.equal(explicitDesktop('(min-width:901px),(max-width:800px)'),false);
  assert.equal(explicitDesktop('not (min-width:901px)'),false);
  assert.equal(explicitDesktop('(min-width:901px) or (max-width:800px)'),false);
  assert.equal(explicitDesktop('(min-width:900px)'),false);
});
test('El selector debe demostrar que hereda los tokens de administración',()=>{
  assert.equal(anchored('#portal #admin-contracts-section .row'),true);
  assert.equal(anchored('#portal :is(#admin-contracts-section,#admin-roles-section) .row'),true);
  assert.equal(anchored(':is(#admin-role-dialog,.pw-modal) .row'),true);
  assert.equal(anchored(':is(#admin-role-dialog,.global) .row'),false);
  assert.equal(anchored('#admin-role-dialog+.other'),false);
  assert.equal(anchored('.global:not(#admin-role-dialog)'),false);
  assert.equal(anchored('#portal .shared'),false);
  assert.equal(anchored('#portal.admin-wide:is([data-admin-section="contratos"],[data-admin-section="roles"]) #view-gestion #admin-refresh'),true);
  assert.equal(anchored('#portal.admin-wide[data-admin-section="roles"]'),false);
  assert.equal(anchored('.admin-role-dialog .admin-role-dialog-heading'),true);
});
test('Sustituye tinta secundaria, coincidencias inequívocas y espaciado sin tocar selectores compartidos',()=>{
  const input='@media(min-width:901px){#portal #admin-contracts-section .r{color:#69635d;background:#fffdf9;padding:8px 12px;gap:14px;gap:14px}.global{color:#69635d}#portal #admin-contracts-section .r,.global{padding:12px}#portal #admin-contracts-section .r:focus-visible{outline:1px solid #93472f}} .admin-x{color:#69635d} @media(max-width:900px){#portal #admin-contracts-section .r{padding:12px}}';
  const {css,report}=refactorCss(input);
  assert.deepEqual(report,{color:2,spacing:2,duplicates:1,nonExactInk:1,nonExactColor:0});
  assert.match(css,/color:var\(--kja-text-secondary\);background:var\(--kja-surface-opaque\);padding:var\(--kja-space-8\) var\(--kja-space-12\);gap:14px/);
  assert.match(css,/\.global\{color:#69635d\}/);
  assert.match(css,/\.r,\.global\{padding:12px\}/);
  assert.match(css,/outline:1px solid #93472f/);
  assert.match(css,/@media\(max-width:900px\)\{#portal #admin-contracts-section .r\{padding:12px\}\}/);
});
test('Normaliza la paleta de escritorio sin usar el divisor decorativo como borde de campo',()=>{
  const input='@media(min-width:901px){#portal #admin-contracts-section{--contract-ink:#282622;--contract-accent:#a9583e;--contract-field-bg:#fcfaf7;--contract-line:#ded6cb}#portal #admin-contracts-section .card{background:#f0ece5;border:1px solid #ded6cb}#portal #admin-contracts-section input{border:1px solid #ded6cb}#portal #admin-contracts-section .button:focus-visible{outline:1px solid #a9583e}}';
  const {css,report}=refactorCss(input);
  assert.equal(report.color,6);
  assert.equal(report.nonExactInk,1);
  assert.equal(report.nonExactColor,2);
  assert.match(css,/--contract-ink:var\(--kja-text-primary\);--contract-accent:var\(--kja-action-primary\);--contract-field-bg:var\(--kja-surface-opaque\);--contract-line:var\(--kja-divider-subtle\)/);
  assert.match(css,/input\{border:1px solid #ded6cb\}/);
  assert.match(css,/:focus-visible\{outline:1px solid #a9583e\}/);
});

test('Reconciliación por familia: campos, foco, separadores y superficies sin alterar mapa o selección',()=>{
  const input='@media(min-width:901px){#portal .aw-workbench input{border-color:#998b7f;background:#fff}#portal .aw-workbench input:focus-visible{outline:2px solid #93472f}#portal .aw-workbench .admin-access-person{border-bottom:1px solid #e6ded4;color:#51483f}#portal .aw-workbench .admin-qr-block{background:#fff}#portal .aw-workbench .admin-office-map-retry{background:#fff}#portal .aw-workbench button[aria-pressed=true]{border-color:#998b7f}}@media(max-width:900px){#portal .aw-workbench input{border-color:#998b7f;background:#fff}}';
  const {css}=refactorCss(input,'assets/css/paginas/dashboard-access-workbench.css');
  assert.match(css,/input\{border-color:var\(--kja-field-border\);background:var\(--kja-surface-opaque\)\}/);
  assert.match(css,/focus-visible\{outline:2px solid var\(--kja-focus\)/);
  assert.match(css,/border-bottom:1px solid var\(--kja-divider-subtle\);color:var\(--kja-text-primary\)/);
  assert.match(css,/\.admin-qr-block\{background:#fff\}/);
  assert.match(css,/button\[aria-pressed=true\]\{border-color:#998b7f\}/);
  assert.match(css,/@media\(max-width:900px\)\{#portal \.aw-workbench input\{border-color:#998b7f;background:#fff/);
});
