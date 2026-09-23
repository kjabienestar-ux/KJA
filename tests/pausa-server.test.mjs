import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/dashboard-pausa-activa.js','utf8');
function setup(rpc) {
  const nodes=new Map();
  const node=()=>({hidden:true,style:{},classList:{add(){},remove(){},toggle(){}},querySelector:()=>node(),querySelectorAll:()=>[],removeAttribute(){}});
  const document={readyState:'loading',addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},body:node()};
  const window={APP:{inicio:{colaborador:{id:42},dia:{marcado:true}}},toast:message=>window.message=message,confirm:()=>true};
  const ctx={window,document,db:{rpc},Intl,setInterval:()=>1,clearInterval(){},setTimeout(){},console};
  vm.runInNewContext(source,ctx);
  return {api:window.KJA_PAUSAS,window,nodes};
}
test('session starts only after server confirms consumption; double click sends one request',async()=>{
  let resolve,calls=0;
  const env=setup(()=>{calls++;return new Promise(r=>resolve=r);});
  const first=env.api.startSession(env.api.BREAKS[0]);
  await env.api.startSession(env.api.BREAKS[0]);
  assert.equal(env.api.isSessionActive(),false);assert.equal(calls,1);
  resolve({data:{ok:true,pausas:['movilidad']}});await first;
  assert.equal(env.api.isSessionActive(),true);
  assert.deepEqual([...env.api.getCompletedBreaks()],['movilidad']);
});
test('server refusal and network failures never start a session',async()=>{
  for(const result of [{data:{ok:false,motivo:'fuera_horario'}},{error:{message:'offline'}}]){
    const env=setup(async()=>result);
    await env.api.startSession(env.api.BREAKS[0]);
    assert.equal(env.api.isSessionActive(),false);assert.equal(env.api.getCompletedBreaks().size,0);
    assert.ok(env.window.message);
  }
});
test('reload reads server balance and observes administrative reset',async()=>{
  let pauses=['movilidad','visual'];const env=setup(async()=>({data:{ok:true,pausas:pauses}}));
  await env.api.loadCompleted();assert.equal(env.api.getCompletedBreaks().size,2);
  pauses=[];await env.api.loadCompleted();assert.equal(env.api.getCompletedBreaks().size,0);
});
test('failed reset does not erase the balance or announce success',async()=>{
  const env=setup(async name=>name==='dash_mis_pausas'?{data:{ok:true,pausas:['visual']}}:{data:{ok:false,motivo:'sin_permiso'}});
  await env.api.loadCompleted();await env.api.resetColaborador(42);
  assert.equal(env.api.getCompletedBreaks().size,1);assert.match(env.window.message,/permiso/);
});
