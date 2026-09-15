import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
const ctx=vm.createContext({isoLima:()=> '2026-09-15'});
vm.runInContext(source.slice(source.indexOf('function adminEvidenceMissing('),source.indexOf('function adminCloseTime(')),ctx);
const person={labora:true,cierre:{justificado:true,estado:'incompleta',entrada_at:'2026-09-14T13:26:00Z',requisitos:['rpe','salida','comparticiones'].map(tipo=>({tipo,completo:false})),asignaciones:[{id:7,completo:false}]}};
test('justified day with an entry only requires Facebook and remains justified after upload',()=>{
  assert.deepEqual(Array.from(ctx.adminEvidenceMissing(person,[]),item=>item.kind),['comparticiones']);
  assert.equal(ctx.adminCloseEvidenceProgress(person,[]).total,1);
  assert.equal(ctx.adminCloseResolvedState(person,{done:0,total:1},'2026-09-14'),'justificado');
  const reviews=[{id:1,requisito:'comparticiones',estado:'completo'},{id:2,requisito:'rpe',estado:'anulado'}];
  assert.equal(ctx.adminEvidenceMissing(person,reviews).length,0);
  assert.equal(ctx.adminCloseEvidenceProgress(person,reviews).done,1);
  assert.equal(ctx.adminCloseEvidenceProgress(person,reviews).total,1);
  assert.equal(ctx.adminCloseResolvedState(person,{done:1,total:1},'2026-09-14'),'justificado');
});
test('removing justification restores the ordinary incomplete day and requirements',()=>{
  const ordinary={...person,cierre:{...person.cierre,justificado:false}};
  assert.equal(ctx.adminEvidenceMissing(ordinary,[]).length,4);
  assert.equal(ctx.adminCloseResolvedState(ordinary,{done:0,total:4},'2026-09-14'),'incompleta');
});
test('justification does not require an entry or invent Facebook on unscheduled days',()=>{
  const noEntry={cierre:{justificado:true,requisitos:[]}};
  assert.equal(ctx.adminEvidenceMissing(noEntry,[]).length,0);
  assert.equal(ctx.adminCloseEvidenceProgress(noEntry,[]).total,0);
  assert.equal(ctx.adminCloseResolvedState(noEntry,{done:0,total:0},'2026-09-14'),'justificado');
});
