import test from 'node:test';import assert from 'node:assert/strict';
import {componentRoleToken,stateRoleToken} from '../scripts/admin-component-role.mjs';
test('An explicit component anatomy can use a semantic role without a literal palette match',()=>{
  assert.equal(componentRoleToken('.admin-review-note p','color','#546274'),'text-secondary');
  assert.equal(componentRoleToken('.admin-person-modal .admin-field input','background','#f5f4ef'),'surface-opaque');
  assert.equal(componentRoleToken('.admin-row .admin-avatar','background','#f5f4ef'),null);
  assert.equal(componentRoleToken('.admin-card .admin-chart','color','#546274'),null);
  assert.equal(componentRoleToken('.admin-row','color','#123456'),null);
});
test('Explicit status codes retain the workflow meaning; mixed and negated selectors are not inferred',()=>{
  assert.equal(stateRoleToken('.admin-status-pill.incomplete','background','#fff4f3'),'status-error-bg');
  assert.equal(stateRoleToken('.admin-status-pill.complete','background','#e5f2e8'),'status-bg');
  assert.equal(stateRoleToken('.admin-month-cell.j b','color','#285f9f'),'status-justified-text');
  assert.equal(stateRoleToken('.apl-mark.ng','color','#34465e'),'status-neutral-text');
  assert.equal(stateRoleToken('.admin-status-pill.complete,.admin-status-pill.pending','color','#34465e'),null);
  assert.equal(stateRoleToken('.admin-status-pill:not(.complete)','color','#34465e'),null);
});
