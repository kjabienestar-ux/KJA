import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
const ctx=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function adminCloseEvidenceKey('),source.indexOf('function adminCloseMsg(')),ctx);
test('cancelled assignment history cannot create a fourth pending requirement',()=>{
 const person={cierre:{requisitos:['rpe','salida','comparticiones'].map(tipo=>({tipo,completo:true})),asignaciones:[]}};
 const reviews=[{id:7,requisito:'asignado',asignacion_id:42,estado:'anulado'}];
 const result=ctx.adminCloseEvidenceProgress(person,reviews);
 assert.equal(result.done,3);assert.equal(result.total,3);
});
test('active assignment remains pending when its latest evidence is annulled',()=>{
 const person={cierre:{requisitos:[],asignaciones:[{id:42,completo:false}]}};
 const result=ctx.adminCloseEvidenceProgress(person,[{id:7,requisito:'asignado',asignacion_id:42,estado:'anulado'}]);
 assert.equal(result.done,0);assert.equal(result.total,1);
});
