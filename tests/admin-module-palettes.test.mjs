import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileModulePalette} from '../scripts/reconcile-admin-module-palettes.mjs';
import {inspectCss} from '../scripts/check-admin-colors.mjs';
const compact=map=>[...map].map(([k,v])=>[k,[...v].map(([c,a])=>[c,a.length])]);
test('A module palette uses semantic roles with the exact original fallback; other contexts stay intact',()=>{
  const css='#portal #admin-roles-section{--role-ink:#403955;--role-accent:#655083;--role-unmapped:#999} .other{--role-ink:#403955} @media(max-width:900px){#portal #admin-roles-section{--role-ink:#403955}}';
  const {css:out,changes}=reconcileModulePalette(css,'dashboard-roles.css');assert.equal(changes.length,2);
  assert.match(out,/--role-ink:var\(--kja-text-primary, #403955\)/);assert.match(out,/--role-accent:var\(--kja-action-primary, #655083\)/);
  assert.match(out,/\.other\{--role-ink:#403955\}/);assert.match(out,/@media\(max-width:900px\)\{#portal #admin-roles-section\{--role-ink:#403955\}\}/);
  assert.deepEqual(compact(inspectCss(out,'roles.css',true)),compact(inspectCss(css,'roles.css',true)));
  assert.equal(reconcileModulePalette(out,'dashboard-roles.css').changes.length,0);
});
test('A shared module gradient remains the identical fallback, not a new visual on other views',()=>{
  const css='#portal.admin-wide{--glass-surface:linear-gradient(135deg,#ffffffd9,#ffffff80)}';
  const out=reconcileModulePalette(css,'dashboard-glass.css').css;
  assert.equal(out,'#portal.admin-wide{--glass-surface:var(--kja-surface-cream, linear-gradient(135deg,#ffffffd9,#ffffff80))}');
  assert.deepEqual(compact(inspectCss(out,'glass.css',true)),compact(inspectCss(css,'glass.css',true)));
});
