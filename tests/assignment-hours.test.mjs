import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/dashboard-assignment-hours.js',import.meta.url),'utf8');
function harness(){
  const nodes=new Map(),writes=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,hidden:false});return nodes.get(id)};
  const state={result:{data:[{salida_gracia_min:180}],error:null},reloads:0};
  const chain={eq(key,value){writes.push([key,value]);return this},select:async()=>state.result};
  const c={$,APP:{access:{rol:'direccion'},sessionUid:'user'},Date,
    loadAdminCloses:async()=>{state.reloads++},db:{from:()=>({
      select:()=>({eq:()=>({single:async()=>({data:{salida_gracia_min:120}})})}),
      update:values=>{writes.push(values);return chain}
    })}};
  vm.createContext(c);vm.runInContext(source,c);
  return {c,$,writes,state};
}
test('validates blank, fractional and out-of-range margins',()=>{
  const {c}=harness();
  for(const value of ['',null,'abc',-1,721,1.5])assert.equal(c.assignmentHoursValue(value),null);
  for(const value of [0,120,720])assert.equal(c.assignmentHoursValue(String(value)),value);
});
test('loads actual margin and saves with a concurrency guard and audit identity',async()=>{
  const h=harness();await h.c.loadAssignmentHours();
  assert.equal(h.$('assignment-hours-minutes').value,'120');
  h.$('assignment-hours-minutes').value='180';
  await h.c.saveAssignmentHours({preventDefault(){}});
  assert.equal(h.writes[0].salida_gracia_min,180);
  assert.equal(h.writes[0].actualizado_por,'user');
  assert.deepEqual(h.writes[2],['salida_gracia_min',120]);
  assert.equal(h.state.reloads,1);
  assert.match(h.$('assignment-hours-status').textContent,/Guardado/);
});
test('conflicts and failed writes require a reload and never report success',async()=>{
  for(const result of [{data:[],error:null},{data:null,error:{message:'denied'}}]){
    const h=harness();await h.c.loadAssignmentHours();h.state.result=result;
    h.$('assignment-hours-minutes').value='180';await h.c.saveAssignmentHours({preventDefault(){}});
    assert.equal(h.state.reloads,0);assert.equal(h.$('assignment-hours-save').disabled,true);
    assert.equal(h.$('assignment-hours-retry').hidden,false);
    assert.doesNotMatch(h.$('assignment-hours-status').textContent,/Guardado:/);
  }
});
test('non-Direction users cannot save and duplicate submissions are ignored',async()=>{
  const h=harness();await h.c.loadAssignmentHours();h.$('assignment-hours-minutes').value='180';
  h.c.APP.access.rol='visor';await h.c.saveAssignmentHours({preventDefault(){}});assert.equal(h.writes.length,0);
  h.c.APP.access.rol='direccion';await Promise.all([h.c.saveAssignmentHours({preventDefault(){}}),h.c.saveAssignmentHours({preventDefault(){}})]);
  assert.equal(h.writes.filter(row=>row.salida_gracia_min).length,1);
});
test('preview explains midnight when the exit window reaches the next day',()=>{
  const h=harness();h.$('assignment-hours-minutes').value='420';h.c.previewAssignmentHours();
  assert.match(h.$('assignment-hours-preview').textContent,/01:00 del día siguiente/);
  assert.match(h.$('assignment-hours-preview').textContent,/antes de medianoche/);
});
