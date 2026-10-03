import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
const ctx=vm.createContext({APP:{adminReview:{entregas:[]}}});
vm.runInContext(source.slice(source.indexOf('function adminEvidenceMissing('),source.indexOf('function adminCloseTime(')),ctx);
const person={id:1,labora:true,cierre:{aplica_jornada:true,requiere_salida:false,solo_asistencia_comparticiones:true,entrada_at:'2026-10-02T13:00:00Z',salida_at:null,estado:'completa',requisitos:[{tipo:'comparticiones',completo:true}],asignaciones:[]}};
test('any exempt collaborator can upload optional exit without changing required evidence',()=>{
 for(const id of [1,29,65,999]){
  const p={...person,id};
  const before=JSON.stringify(p);
  const options=ctx.adminEvidenceAvailable(p,[]);
  assert.equal(options.length,1);assert.equal(options[0].kind,'salida');assert.equal(options[0].optional,true);
  assert.equal(ctx.adminEvidenceMissing(p,[]).length,0);
  const progress=ctx.adminCloseEvidenceProgress(p,[]);
  assert.equal(progress.done,1);assert.equal(progress.total,1);
  assert.equal(JSON.stringify(p),before);
 }
});
test('no optional exit for missing entry, nonworking or justified days',()=>{
 for(const p of [{...person,labora:false},{...person,cierre:{...person.cierre,entrada_at:null}},{...person,cierre:{...person.cierre,justificado:true}},{...person,cierre:{...person.cierre,aplica_jornada:false}},{...person,cierre:{...person.cierre,estado:'justificado'}}]){
  assert.equal(ctx.adminEvidenceAvailable(p,[]).length,0);
 }
});
test('existing evidence prevents duplication; recorded exit without photo can be documented',()=>{
 assert.equal(ctx.adminEvidenceAvailable(person,[{requisito:'salida',estado:'completo'}]).length,0);
 assert.equal(ctx.adminEvidenceAvailable({...person,cierre:{...person.cierre,requisitos:[{tipo:'salida',completo:true}]}},[]).length,0);
 assert.equal(ctx.adminEvidenceAvailable({...person,cierre:{...person.cierre,salida_at:'2026-10-02T19:00:00Z'}},[])[0].optional,true);
});
test('ordinary required exit stays required and appears only once',()=>{
 const p={...person,cierre:{...person.cierre,requiere_salida:true,solo_asistencia_comparticiones:false}};
 const options=ctx.adminEvidenceAvailable(p,[]);
 assert.equal(options.length,1);assert.equal(options[0].kind,'salida');assert.notEqual(options[0].optional,true);
});

test('optional exit opens the composer for Dirección and remains restricted for other roles',()=>{
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,classList:{add(){}}});return elements.get(id);};
 const ui=vm.createContext({APP:{access:{rol:'direccion'}},adminEvidencePerson:()=>person,
  adminEvidenceAvailable:p=>ctx.adminEvidenceAvailable(p,[]),$:el,initials:()=> 'AB',adminReviewDate:()=> '02/10/2026',
  document:{activeElement:null,querySelector:()=>({checked:false}),body:{classList:{add(){}}}},
  adminEvidenceMessage(){},renderAdminEvidenceComposer(){},requestAnimationFrame(){},toast(){throw Error('Unexpected missing-evidence message');}});
 vm.runInContext(source.slice(source.indexOf('function openAdminMissingEvidence('),source.indexOf('function closeAdminEvidence(')),ui);
 ui.openAdminMissingEvidence(1);
 assert.equal(ui.ADMIN_EVIDENCE.requirement,'salida');assert.equal(el('admin-evidence-modal').hidden,false);
 el('admin-evidence-modal').hidden=true;ui.APP.access.rol='visor';ui.openAdminMissingEvidence(1);
 assert.equal(el('admin-evidence-modal').hidden,true);
});
