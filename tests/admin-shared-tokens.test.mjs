import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileShared,managedFallbackUses} from '../scripts/reconcile-admin-shared-tokens.mjs';
import {inspectCss} from '../scripts/check-admin-colors.mjs';

test('Shared anchored rules use desktop tokens with the original literal fallback',()=>{
  const original='#view-gestion .row{color:#69635d;background:#fffdf9} #view-gestion .row:disabled{color:#69635d} #view-gestion .row,#view-inicio .x{color:#69635d} @media(max-width:900px){#view-gestion .row{color:#69635d}} @media(min-width:901px){#view-gestion .row{color:#69635d}}';
  const {css,report}=reconcileShared(original);
  assert.deepEqual(report,{fallbacks:2,exact:1,ink:1});
  assert.match(css,/color:var\(--kja-text-secondary, #69635d\);background:var\(--kja-surface-opaque, #fffdf9\)/);
  assert.match(css,/\.row:disabled\{color:#69635d\}/);
  assert.match(css,/\.row,#view-inicio .x\{color:#69635d\}/);
  assert.match(css,/@media\(max-width:900px\)\{#view-gestion .row\{color:#69635d\}\}/);
  assert.match(css,/@media\(min-width:901px\)\{#view-gestion .row\{color:#69635d\}\}/);
  const compact = s=>[...inspectCss(s,'x.css',true)].map(([k,v])=>[k,[...v].map(([c,a])=>[c,a.length])]);
  assert.deepEqual(compact(css),compact(original),'fallback exceptions remain visible to the guardrail');
  assert.equal(reconcileShared(css).report.fallbacks,0,'idempotent');
  assert.equal([...managedFallbackUses(css).values()].reduce((a,b)=>a+b,0),2);
});

test('Ambiguous colors, gradients, keyframes and mixed selectors are preserved',()=>{
  const original='#view-gestion .control{background:linear-gradient(#fffdf9,#f6eee4);border:1px solid #ded6cb} #view-gestion input{border:1px solid #ded6cb} #view-gestion .row{background:#faf9f5} @keyframes glow{from{color:#69635d}}';
  const {css,report}=reconcileShared(original);
  assert.equal(report.fallbacks,1);
  assert.match(css,/linear-gradient\(#fffdf9,#f6eee4\)/);
  assert.match(css,/input\{border:1px solid #ded6cb\}/);
  assert.match(css,/\.row\{background:#faf9f5\}/);
  assert.match(css,/@keyframes glow\{from\{color:#69635d\}\}/);
});
