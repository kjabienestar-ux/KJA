import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileModuleFallbacks,moduleFallbackCount} from '../scripts/reconcile-admin-variable-fallbacks.mjs';
test('A mapped module alias keeps its prior value and gets the same semantic fallback',()=>{
  const file='dashboard-assignments-workspace.css',selector='#portal #admin-assignments-section .assignment-toggle-btn:hover';
  const result=reconcileModuleFallbacks(`${selector}{border-color:var(--asg-teal-strong, #99f6e4);color:var(--unknown, #123456)}`,file);
  assert.equal(result.changes.length,1);assert.match(result.css,/var\(--asg-teal-strong, var\(--kja-field-border, #99f6e4\)\)/);assert.equal(moduleFallbackCount(file,selector,'border-color','var(--asg-teal-strong, var(--kja-field-border, #99f6e4))'),1);
  assert.equal(reconcileModuleFallbacks(result.css,file).changes.length,0);
});
