import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,createTab,flush} from './helpers/pausa-harness.mjs';

test('two tabs starting different breaks adopt one session and one consumption',async()=>{
  const server=createServer(),a=createTab(server),b=createTab(server);await flush();
  await Promise.all([a.api.startSession(a.api.BREAKS[0]),b.api.startSession(b.api.BREAKS[1])]);
  assert.deepEqual(server.used,['movilidad']);
  assert.equal(a.api.isSessionActive(),true);assert.equal(b.api.isSessionActive(),true);
  await a.advance(125000);await b.tick();
  assert.equal(a.node('pausa-timer-display').textContent,'17:55');
  assert.equal(b.node('pausa-timer-display').textContent,'17:55');
});
test('background throttling and reload recover elapsed time',async()=>{
  const server=createServer(),a=createTab(server);await flush();
  await a.api.startSession(a.api.BREAKS[0]);a.document.hidden=true;server.elapsed=300000;
  const b=createTab(server);await flush();
  assert.equal(b.node('pausa-timer-display').textContent,'15:00');
  a.document.hidden=false;a.event('visibilitychange');await flush();
  assert.equal(a.node('pausa-timer-display').textContent,'15:00');
  assert.equal(server.requests.filter(r=>r.name==='dash_iniciar_pausa').length,1);
});
test('confirmation does not freeze time and abandonment synchronizes without refund',async()=>{
  const server=createServer(),a=createTab(server),b=createTab(server);await flush();
  await a.api.startSession(a.api.BREAKS[1]);await b.api.loadCompleted();
  a.api.renderConfirm();await a.advance(60000);a.node('#pausa-btn-resume').onclick();
  assert.match(a.node('pausa-activa-container').innerHTML,/09:00/);
  a.api.renderConfirm();await a.node('#pausa-btn-exit-anyway').onclick();await b.api.loadCompleted();
  assert.equal(a.api.isSessionActive(),false);assert.equal(b.api.isSessionActive(),false);
  assert.deepEqual(server.used,['visual']);assert.equal(server.session.estado,'abandonada');
  await b.api.startSession(b.api.BREAKS[1]);assert.equal(b.api.isSessionActive(),false);
});
test('offline deadline waits for server confirmation',async()=>{
  const server=createServer(),a=createTab(server);await flush();
  await a.api.startSession(a.api.BREAKS[1]);server.offline=true;await a.advance(600000);
  assert.equal(a.api.isSessionActive(),true);
  assert.doesNotMatch(a.node('pausa-activa-container').innerHTML,/Pausa completada/);
  assert.match(a.node('pausa-sync-status').textContent,/Sin confirmación/);
  server.offline=false;a.event('online');await flush();
  assert.equal(a.api.isSessionActive(),false);
  assert.match(a.node('pausa-activa-container').innerHTML,/Pausa completada/);
  assert.equal([...a.intervals.values()].filter(x=>x.ms===1000||x.ms===10000).length,0);
});
test('reset and account switching invalidate the local session',async()=>{
  const server=createServer(),a=createTab(server);await flush();
  await a.api.startSession(a.api.BREAKS[0]);server.session=null;server.used=[];
  await a.api.loadCompleted();assert.equal(a.api.isSessionActive(),false);
  assert.equal(a.api.getCompletedBreaks().size,0);
  await a.api.startSession(a.api.BREAKS[1]);a.window.APP.inicio.colaborador.id=99;await a.tick();
  assert.equal(a.api.isSessionActive(),false);assert.equal(a.node('pausa-activa-overlay').hidden,true);
});
test('stale reads cannot overwrite a newer start',async()=>{
  const server=createServer();let resolveRead;const stale=server.snapshot();
  const a=createTab(server,{init:false,rpc:(name,args)=>name==='dash_mis_pausas'?new Promise(r=>resolveRead=r):server.rpc(name,args)});
  const read=a.api.loadCompleted();await a.api.startSession(a.api.BREAKS[0]);resolveRead({data:stale});await read;
  assert.equal(a.api.isSessionActive(),true);assert.equal(a.api.getCompletedBreaks().size,1);
});
test('old backend fails closed instead of starting a local-only timer',async()=>{
  const a=createTab(createServer(),{init:false,rpc:async()=>({data:{ok:true,pausas:['visual']}})});
  await a.api.startSession(a.api.BREAKS[1]);
  assert.equal(a.api.isSessionActive(),false);assert.match(a.window.message,/dashboard_78/);
});
test('a read launched during a pending start cannot clear the confirmed session',async()=>{
  const server=createServer();let resolveStart,resolveRead;
  const old=server.snapshot();
  const a=createTab(server,{init:false,rpc:name=>new Promise(r=>{if(name==='dash_iniciar_pausa')resolveStart=r;else resolveRead=r;})});
  const start=a.api.startSession(a.api.BREAKS[0]);const read=a.api.loadCompleted();
  resolveStart(await server.rpc('dash_iniciar_pausa',{p_break_id:'movilidad'}));await start;
  resolveRead({data:old});await read;
  assert.equal(a.api.isSessionActive(),true);assert.equal(a.api.getCompletedBreaks().size,1);
});
test('expired authorization closes the modal instead of retaining an old session',async()=>{
  const server=createServer();let revoked=false;
  const a=createTab(server,{init:false,rpc:(name,args)=>revoked?Promise.resolve({data:{ok:false,motivo:'sin_sesion'}}):server.rpc(name,args)});
  await a.api.startSession(a.api.BREAKS[0]);revoked=true;await a.api.loadCompleted();
  assert.equal(a.api.isSessionActive(),false);assert.equal(a.node('pausa-activa-overlay').hidden,true);
});
