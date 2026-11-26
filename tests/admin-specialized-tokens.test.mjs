import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSpecialized} from '../scripts/reconcile-admin-specialized.mjs';

test('Las conversiones especializadas conservan la función de color y los límites de escritorio',()=>{
  const css='@media(min-width:901px){#portal .aw-workbench .admin-qr-block{background:#fff}#portal .aw-workbench .admin-access-message.bad{background:#fff0f3;color:#9c3548}#portal .aw-workbench :is(.aw-history,.aw-notices){background:rgba(255,253,249,.7)}.global .admin-qr-block{background:#fff}}@media(max-width:900px){#portal .aw-workbench .admin-qr-block{background:#fff}}';
  const result=reconcileSpecialized(css,'dashboard-access-workbench.css');
  assert.equal(result.count,4);
  assert.match(result.css,/admin-qr-block\{background:var\(--kja-surface-white\)/);
  assert.match(result.css,/admin-access-message\.bad\{background:var\(--kja-status-error-bg\);color:var\(--kja-status-error-text\)/);
  assert.match(result.css,/aw-notices\)\{background:var\(--kja-surface-cream\)/);
  assert.match(result.css,/\.global .admin-qr-block\{background:#fff\}/);
  assert.match(result.css,/@media\(max-width:900px\)\{#portal \.aw-workbench \.admin-qr-block\{background:#fff\}/);
  assert.equal(reconcileSpecialized(result.css,'dashboard-access-workbench.css').count,0);
});
test('Las sombras de acción y menú se sustituyen por la elevación correspondiente, no por un color aislado',()=>{
  const result=reconcileSpecialized('@media(min-width:901px){#portal #admin-assignments-section .assignment-cta-btn{box-shadow:0 2px 6px #91493024!important}}','dashboard-admin-asignaciones.css');
  assert.equal(result.count,1);assert.match(result.css,/box-shadow:none!important/);
});
