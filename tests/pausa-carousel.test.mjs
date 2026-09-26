import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,createTab,flush} from './helpers/pausa-harness.mjs';
test('carousel advances illustrations without changing the session deadline',async()=>{
  const server=createServer(),env=createTab(server);await flush();await env.api.startSession(env.api.BREAKS[0]);
  const deadline=server.session.fin_at;
  const tick=()=>[...env.intervals.values()].find(t=>t.ms===10000).fn();
  tick();assert.equal(env.node('pausa-act-title').textContent,env.api.BREAKS[0].activities[1].title);
  const figure=env.node('pausa-act-figure').innerHTML;tick();assert.notEqual(env.node('pausa-act-figure').innerHTML,figure);
  tick();tick();assert.equal(env.node('pausa-act-title').textContent,env.api.BREAKS[0].activities[0].title);
  assert.equal(server.session.fin_at,deadline);assert.equal(server.requests.filter(r=>r.name==='dash_iniciar_pausa').length,1);
});
test('outside click and Escape preserve session; confirmation pauses only illustrations',async()=>{
  const env=createTab(createServer());await flush();await env.api.startSession(env.api.BREAKS[0]);
  const modal=env.node('pausa-activa-container'),html=modal.innerHTML,overlay=env.node('pausa-activa-overlay');
  env.node('pausa-activa-backdrop').onclick();overlay.onclick({target:overlay});env.event('keydown',{key:'Escape'});
  assert.equal(modal.innerHTML,html);assert.equal(overlay.hidden,false);assert.equal(modal.classList.contains('pausa-dialog-shake'),true);
  env.node('#pausa-btn-confirm-exit').onclick();assert.match(modal.innerHTML,/¿Seguro que quieres salir/);
  assert.equal([...env.intervals.values()].some(t=>t.ms===10000),false);
  assert.equal([...env.intervals.values()].some(t=>t.ms===1000),true);
  env.node('#pausa-btn-resume').onclick();assert.equal([...env.intervals.values()].some(t=>t.ms===10000),true);
});
