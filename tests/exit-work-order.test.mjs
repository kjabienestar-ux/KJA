import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/js/dashboard-close-model.js';
const {hasPendingWork}=globalThis.KJACloseModel;
test('exit waits for RPE and active assignments, independently of Facebook',()=>{
  assert.equal(hasPendingWork({requisitos:[{tipo:'rpe',completo:false}]}),true);
  assert.equal(hasPendingWork({requisitos:[{tipo:'rpe',completo:true},{tipo:'salida',completo:false},{tipo:'comparticiones',completo:false}]}),false);
  assert.equal(hasPendingWork({asignaciones:[{estado:'pendiente',completo:false}]}),true);
  assert.equal(hasPendingWork({asignaciones:[{estado:'cancelada',completo:false}]}),false);
  assert.equal(hasPendingWork({asignaciones:[{estado:'pendiente',completo:true}]}),false);
});
