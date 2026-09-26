import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,createTab,flush} from './helpers/pausa-harness.mjs';
test('rail counts server consumption and offers recovery of the active pause',async()=>{
  const server=createServer(),env=createTab(server);await flush();
  assert.equal(env.node('.rail-pausa-duration').textContent,'0 de 2 usadas hoy');
  await env.api.startSession(env.api.BREAKS[1]);
  assert.equal(env.node('.rail-pausa-duration').textContent,'1 de 2 usadas hoy');
  assert.equal(env.node('.rail-pausa-footer > span:first-child').textContent,'Volver a mi pausa');
  await env.advance(600000);await env.api.startSession(env.api.BREAKS[0]);
  assert.equal(env.node('.rail-pausa-duration').textContent,'2 de 2 usadas hoy');
});
test('a failed abandonment keeps the session running and allows retry',async()=>{
  const server=createServer(),env=createTab(server);await flush();await env.api.startSession(env.api.BREAKS[0]);
  env.api.renderConfirm();server.offline=true;await env.node('#pausa-btn-exit-anyway').onclick();
  assert.equal(env.api.isSessionActive(),true);assert.equal(env.node('#pausa-btn-exit-anyway').disabled,false);
  server.offline=false;await env.node('#pausa-btn-exit-anyway').onclick();assert.equal(env.api.isSessionActive(),false);
  assert.equal(server.session.estado,'abandonada');
});
test('administrative reset clears consumption and running modal state',async()=>{
  const server=createServer(),env=createTab(server);await flush();await env.api.startSession(env.api.BREAKS[0]);
  await env.api.resetColaborador(42);
  assert.equal(env.api.isSessionActive(),false);assert.equal(env.api.getCompletedBreaks().size,0);
  assert.equal(env.node('.rail-pausa-duration').textContent,'0 de 2 usadas hoy');
});
