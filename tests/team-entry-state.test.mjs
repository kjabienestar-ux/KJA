import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/js/dashboard-close-model.js';
test('team missing entry only applies to configured working days',()=>{
  const p={dias_laborables:[1,2,3,4,5],hora_inicio:'08:00',hora_fin:'14:00'};
  const check=globalThis.KJACloseModel.teamEntryException;
  assert.equal(check(p,{},'2026-09-19'),'No labora hoy');
  assert.equal(check({...p,contrato_pendiente:true},{},'2026-09-18'),'Datos pendientes de actualizar');
  assert.equal(check({...p,hora_inicio:null},{},'2026-09-18'),'Horario pendiente de actualizar');
  assert.equal(check(p,{},'2026-09-18'),'');
  assert.equal(check({...p,dias_laborables:[7]},{},'2026-09-20'),'');
  assert.equal(check(p,{solo_comparticiones:true},'2026-09-18'),'No labora hoy');
});
