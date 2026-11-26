import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileEffects,effectToken} from '../scripts/reconcile-admin-effects.mjs';
import {managedFallbackUses} from '../scripts/reconcile-admin-shared-tokens.mjs';
test('Effects are whole-role aliases and preserve the exact legacy fallback',()=>{
  const file='dashboard.css';const css='.admin-control-card{box-shadow:0 8px 24px rgba(15,36,66,.04)} .admin-review-sheet{box-shadow:0 28px 80px rgba(0,18,45,.34)} .admin-review-field input:focus{box-shadow:0 0 0 3px #eee8f7} .admin-primary-action{box-shadow:0 3px 8px #93472f; background:linear-gradient(160deg,#b66448,#94492f)}';
  const out=reconcileEffects(css,file);assert.equal(out.changes.length,5);assert.match(out.css,/--kja-surface-card-shadow, 0 8px 24px rgba/);assert.match(out.css,/--kja-surface-dialog-shadow/);assert.match(out.css,/--kja-field-focus-shadow/);assert.match(out.css,/--kja-action-shadow/);assert.match(out.css,/--kja-action-primary, linear-gradient/);
  assert.equal([...managedFallbackUses(out.css,file).values()].reduce((a,b)=>a+b,0),6);
});
test('Do not conflate an ancestor surface, a selection ring or an asset with elevation',()=>{
  const value='0 8px 24px rgba(15,36,66,.04)';
  for(const s of ['.admin-control-card .some-button','.admin-control-card>.some-button','.admin-control-card.is-selected','.admin-control-card .admin-avatar','.admin-control-card,.some-button','.admin-control-card .admin-qr','.admin-control-card :is(.admin-control-card,.some-button)'])assert.equal(effectToken('dashboard.css',s,'box-shadow',value),null,s);
  assert.equal(effectToken('dashboard.css','.admin-control-card','box-shadow','0 0 0 1px #93472f'),null);
  assert.equal(reconcileEffects('@media(max-width:900px){.admin-control-card{box-shadow:'+value+'}}','dashboard.css').changes.length,0);
});
