import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileDirectPalette,directPaletteToken} from '../scripts/reconcile-admin-direct-palette.mjs';
test('Direct module palette preserves the old value outside admin and respects semantic roles',()=>{
  const css='#admin-role-dialog input{border:1px solid #e0ddea;color:#403955;background:#fff} #admin-role-dialog input:focus-visible{outline:2px solid #655083} .admin-role-status.ok{color:#0b7550;background:#e3f6ee} @media(max-width:900px){#admin-role-dialog input{background:#fff}}';
  const {css:out,changes}=reconcileDirectPalette(css,'dashboard-roles.css');assert.equal(changes.length,6);
  assert.match(out,/border:1px solid var\(--kja-field-border, #e0ddea\)/);assert.match(out,/color:var\(--kja-text-primary, #403955\)/);assert.match(out,/outline:2px solid var\(--kja-focus, #655083\)/);assert.match(out,/status-text, #0b7550/);assert.match(out,/@media\(max-width:900px\)\{#admin-role-dialog input\{background:#fff\}\}/);
});
test('Do not replace personal, mixed selectors, digital assets, unknown colors or gradients',()=>{
  const css='#view-inicio .admin-row{color:#0f172a} #admin-roles-section .avatar,#view-inicio .avatar{background:#fff} .admin-qr-block{background:#fff} .admin-row{background:linear-gradient(#fff,#faf9f5);color:#123456}';
  assert.equal(reconcileDirectPalette(css,'dashboard-roles.css').css,css);
  assert.equal(directPaletteToken('dashboard.css','.admin-status.warn','color','#94590a'),'status-warning-text');
});
test('Rendered KPI and empty-state colors retain their semantic states',()=>{
  const css='#portal #admin-contracts-section .admin-list-kpi:nth-child(2) b{color:#9c5c00} #portal #admin-list-section.apl .apl-facts dd.is-empty{color:#b9b2a8} #portal #admin-month-section .admin-month-cell.p b{background:#e6ede5;color:#35735f}';
  const {css:out,changes}=reconcileDirectPalette(css,'dashboard-contracts.css');assert.equal(changes.length,4);
  assert.match(out,/--kja-status-warning-text, #9c5c00/);assert.match(out,/--kja-text-secondary, #b9b2a8/);assert.match(out,/--kja-status-bg, #e6ede5/);assert.match(out,/--kja-status-text, #35735f/);
});
test('Only a real translucent border is reconciled; gradients and shadows remain intact',()=>{
  const css='.admin-office-rule{border:1px solid rgba(11, 35, 71, .12);box-shadow:0 2px 4px rgba(11,35,71,.12);background:linear-gradient(rgba(11,35,71,.12),#fff)}';
  const {css:out,changes}=reconcileDirectPalette(css,'dashboard.css');assert.equal(changes.length,1);
  assert.match(out,/var\(--kja-surface-border, rgba\(11, 35, 71, \.12\)\)/);assert.match(out,/box-shadow:0 2px 4px rgba\(11,35,71,\.12\)/);
});
