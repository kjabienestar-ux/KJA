import test from 'node:test';import assert from 'node:assert/strict';
import {retireDesktopFallbacks} from '../scripts/retire-admin-desktop-fallbacks.mjs';
test('Only the desktop and positive token scope may drop a literal fallback',()=>{
  const raw='#admin-person-modal input{color:var(--kja-text-primary, #252523)}';
  assert.equal(retireDesktopFallbacks(raw,'dashboard.css').changes.length,0);
  const wrapped='@media(min-width:901px){'+raw+'}';const out=retireDesktopFallbacks(wrapped,'dashboard.css');assert.equal(out.changes.length,1);assert.match(out.css,/var\(--kja-text-primary\)/);
  assert.equal(retireDesktopFallbacks('@media(min-width:901px){#admin-person-modal input,.personal-input{color:var(--kja-text-primary, #252523)}}','dashboard.css').changes.length,0);
  assert.equal(retireDesktopFallbacks('@media(min-width:901px) and (forced-colors:active){'+raw+'}','dashboard.css').changes.length,0);
});
