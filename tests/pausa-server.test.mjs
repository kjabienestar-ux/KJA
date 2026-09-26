import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,createTab} from './helpers/pausa-harness.mjs';
test('server confirmation precedes start and double click makes one request',async()=>{
  const server=createServer();let resolve,calls=0;
  const env=createTab(server,{init:false,rpc:()=>{calls++;return new Promise(r=>resolve=r);}});
  const first=env.api.startSession(env.api.BREAKS[0]);await env.api.startSession(env.api.BREAKS[0]);
  assert.equal(env.api.isSessionActive(),false);assert.equal(calls,1);
  resolve(await server.rpc('dash_iniciar_pausa',{p_break_id:'movilidad'}));await first;
  assert.equal(env.api.isSessionActive(),true);assert.deepEqual([...env.api.getCompletedBreaks()],['movilidad']);
});
test('server refusal and network errors never start a session',async()=>{
  for(const result of [{data:{ok:false,motivo:'fuera_horario'}},{error:{message:'offline'}}]){
    const env=createTab(createServer(),{init:false,rpc:async()=>result});
    await env.api.startSession(env.api.BREAKS[0]);
    assert.equal(env.api.isSessionActive(),false);assert.equal(env.api.getCompletedBreaks().size,0);assert.ok(env.window.message);
  }
});
test('reload reads server balance and observes reset',async()=>{
  const server=createServer();server.used=['movilidad','visual'];const env=createTab(server,{init:false});
  await env.api.loadCompleted();assert.equal(env.api.getCompletedBreaks().size,2);
  server.used=[];await env.api.loadCompleted();assert.equal(env.api.getCompletedBreaks().size,0);
});
test('failed administrative reset preserves balance without success message',async()=>{
  const server=createServer();server.used=['visual'];
  const env=createTab(server,{init:false,rpc:(name,args)=>name==='dash_mis_pausas'?server.rpc(name,args):Promise.resolve({data:{ok:false,motivo:'sin_permiso'}})});
  await env.api.loadCompleted();await env.api.resetColaborador(42);
  assert.equal(env.api.getCompletedBreaks().size,1);assert.match(env.window.message,/permiso/);
});
