import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewedDeclarationToken} from '../scripts/admin-reviewed-declarations.mjs';
import {reconcileDirectPalette} from '../scripts/reconcile-admin-direct-palette.mjs';
import {reconcileEffects} from '../scripts/reconcile-admin-effects.mjs';
import {exceptionReason} from '../scripts/admin-legacy-exceptions.mjs';
import {managedFallbackUses} from '../scripts/reconcile-admin-shared-tokens.mjs';

test('Reviewed rules match the exact source and preserve the old fallback',()=>{
  const file='assets/css/paginas/dashboard-admin-seguimiento.css';
  const selector='#seg-download-dialog .seg-d-alert';
  assert.equal(reviewedDeclarationToken(file,selector,'color','#893e29','color'),'status-error-text');
  assert.equal(reviewedDeclarationToken(file,selector+' button','color','#893e29','color'),null);
  assert.equal(reviewedDeclarationToken(file,selector,'color','#123456','color'),null);
  const source=selector+'{background:#f5e6df;color:#893e29;border:1px solid #d9b9a7}';
  const result=reconcileDirectPalette(source,file);
  assert.equal(result.changes.length,3);
  assert.match(result.css,/var\(--kja-status-error-bg, #f5e6df\)/);
  assert.match(result.css,/var\(--kja-status-error-text, #893e29\)/);
  assert.equal([...managedFallbackUses(result.css,file).values()].reduce((a,b)=>a+b,0),3);
  const shadow=reconcileEffects('#seg-download-dialog{box-shadow:0 6px 18px #32251c12,0 30px 70px #32251c30}',file);
  assert.match(shadow.css,/var\(--kja-surface-dialog-shadow, 0 6px 18px #32251c12,0 30px 70px #32251c30\)/);
});
test('Content exceptions are limited to the exact illustration, media or platform property',()=>{
  assert.equal(exceptionReason('dashboard.css','.admin-review-gallery>a','background','#071a34'),'evidence-media-matte');
  assert.equal(exceptionReason('dashboard.css','.admin-review-gallery>a button','background','#071a34'),null);
  assert.equal(exceptionReason('dashboard.css','.admin-review-gallery>a','color','#071a34'),null);
  assert.equal(exceptionReason('dashboard-facebook-report.css','#portal #admin-facebook-section.fbr .fbr-fbico','color','#1877f2'),'external-brand');
  assert.equal(exceptionReason('dashboard-facebook-report.css','#portal #admin-facebook-section.fbr button','color','#1877f2'),null);
});
test('The old control halo can be reached only inside canonical shadow fallbacks',()=>{
  const css=fs.readFileSync(new URL('../assets/css/paginas/dashboard-admin-control.css',import.meta.url),'utf8');
  const uses=css.split(/\r?\n/).filter(line=>line.includes('var(--control-primary-ring)'));
  assert.equal(uses.length,2);
  assert.ok(uses.every(line=>line.includes('var(--kja-field-focus-shadow,')));
});
test('The existing shimmer uses neutral and shine tokens without changing its legacy gradient',()=>{
  const file='assets/css/paginas/dashboard-admin-seguimiento.css';
  const css=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const uses=[...managedFallbackUses(css,file)].filter(([k])=>k.includes('.seg-skeleton'));
  assert.equal(uses.reduce((a,[,n])=>a+n,0),3);
});
