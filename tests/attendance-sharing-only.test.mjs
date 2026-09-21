import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({isoLima:()=> '2026-09-21'});
const source=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
vm.runInContext(source.slice(source.indexOf('function adminEvidenceMissing('),source.indexOf('function adminCloseTime(')),ctx);
const dashboard=fs.readFileSync('assets/js/dashboard.js','utf8');
vm.runInContext(dashboard.slice(dashboard.indexOf('function dailyCloseGuidePresentation('),dashboard.indexOf('function dailyCloseItemMarkup(')),ctx);
vm.runInContext(fs.readFileSync('assets/js/dashboard-close-model.js','utf8'),ctx);
const close={aplica:true,aplica_jornada:true,aplica_comparticiones:true,solo_asistencia_comparticiones:true,requiere_salida:false,entrada_at:'2026-09-21T14:00:00Z',salida_at:null,requisitos:[{tipo:'comparticiones',titulo:'Comparticiones',completo:true}],asignaciones:[],estado:'completa'};
test('attendance and sharing complete the day without exit or invented admin requirements',()=>{
  const person={labora:true,cierre:close};
  assert.equal(ctx.adminEvidenceMissing(person,[]).length,0);
  const progress=ctx.adminCloseEvidenceProgress(person,[{id:1,requisito:'rpe',estado:'anulado'}]);
  assert.equal(progress.done,1);assert.equal(progress.total,1);
  assert.equal(ctx.adminCloseResolvedState(person,progress,'2026-09-21'),'completa');
  assert.equal(ctx.dailyCloseGuidePresentation(close).stage,'complete');
  assert.equal(ctx.KJACloseModel.attendancePresentation(null,close).complete,true);
});
test('missing attendance and expired sharing still require action',()=>{
  assert.equal(ctx.dailyCloseGuidePresentation({...close,entrada_at:null,estado:'sin_entrada'}).stage,'entry');
  const pending={...close,estado:'incompleta',comparticiones_vencidas:true,requisitos:[{tipo:'comparticiones',titulo:'Comparticiones',completo:false}]};
  assert.equal(ctx.dailyCloseGuidePresentation(pending).stage,'incomplete');
  assert.deepEqual(Array.from(ctx.KJACloseModel.incompleteReasons(null,pending)),['Comparticiones']);
  assert.deepEqual(Array.from(ctx.adminEvidenceMissing({labora:true,cierre:pending},[]),x=>x.kind),['comparticiones']);
});
test('ordinary collaborators continue to require exit',()=>{
  const ordinary={...close,solo_asistencia_comparticiones:false,requiere_salida:undefined,estado:'incompleta'};
  assert.ok(ctx.adminEvidenceMissing({labora:true,cierre:ordinary},[]).some(x=>x.kind==='salida'));
  assert.ok(ctx.KJACloseModel.incompleteReasons(null,ordinary).includes('Registro de salida'));
});
