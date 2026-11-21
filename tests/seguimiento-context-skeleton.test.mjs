import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {bootstrapSource,helperSource,moduleSource,fixtureData,date} from './helpers/seguimiento-fixture.mjs';
const skeleton=fs.readFileSync('assets/js/dashboard-skeleton.js','utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(t,{role='direccion',fastTimers=true}={}){
  const dom=new JSDOM('<section id="admin-seguimiento-section"></section><div id="admin-evidence-modal" hidden></div>',{runScripts:'outside-only',url:'http://localhost/dashboard'}),w=dom.window;
  t.after(()=>w.close());w.setInterval=()=>0;w.matchMedia=()=>({matches:true});
  w.eval(bootstrapSource);w.APP.access.rol=role;w.eval(helperSource);w.eval(skeleton);
  if(fastTimers){const withSkeleton=w.DashboardSkeleton.withSkeleton;w.DashboardSkeleton.withSkeleton=(host,kind,fetch,options)=>withSkeleton(host,kind,fetch,{...options,delay:5,minVisible:20,fade:0})}
  let data=fixtureData(),gate=null;const calls=[];
  w.db={rpc:async(name,args)=>{calls.push({name,args});if(gate)await gate.promise;return data[name]?.error?data[name]:{data:structuredClone(data[name])}}};
  w.eval(moduleSource);
  return {w,root:w.document.getElementById('admin-seguimiento-section'),calls,
    pause(){gate=deferred();return gate},data(value){data=value},load:()=>w.KJASeguimiento.load()};
}
test('carga lenta mantiene contexto y usa formas grises solo en datos pendientes',async t=>{
  const h=setup(t),gate=h.pause();const loading=h.load();await wait(12);
  assert.match(h.root.textContent,/Seguimiento diario/);assert.match(h.root.textContent,/Personas/);assert.match(h.root.textContent,/Evidencias/);
  assert.equal(h.root.querySelector('.seg-hours'),null);
  assert.equal(h.root.querySelectorAll('.seg-skeleton,.kja-skeleton-mirror,.kja-skeleton-layer').length,0);
  assert.equal(h.root.querySelectorAll('.seg-loading-person').length,3);
  assert.ok(h.root.querySelectorAll('.kja-sk-block').length>10);
  assert.ok([...h.root.querySelectorAll('.kja-sk-block')].every(node=>node.getAttribute('aria-hidden')==='true'));
  assert.equal(h.w.document.getElementById('seg-export').disabled,true);
  assert.equal(h.root.previousElementSibling.textContent,'Cargando seguimiento diario.');
  gate.resolve();assert.equal(await loading,true);
  assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.equal(h.root.getAttribute('aria-busy'),'false');
  assert.equal(h.root.querySelectorAll('.seg-person').length,3);assert.equal(h.calls.length,4);
  assert.equal(h.root.querySelectorAll('#seg-summary>section').length,2);
});
test('respuesta rápida no muestra placeholders y consultas duplicadas comparten trabajo',async t=>{
  const h=setup(t,{fastTimers:false});await Promise.all([h.load(),h.load()]);
  assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.equal(h.calls.length,4);
  assert.equal(h.root.classList.contains('is-context-loading'),false);
});
test('actualizar conserva filas, filtros y foco durante la espera',async t=>{
  const h=setup(t);await h.load();const gate=h.pause(),search=h.w.document.getElementById('seg-search');
  search.value='maria';search.dispatchEvent(new h.w.Event('input'));search.focus();
  const content=h.w.document.getElementById('seg-workspace').innerHTML;
  const loading=h.load();await wait(12);
  assert.equal(h.w.document.getElementById('seg-workspace').innerHTML,content);
  assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.equal(h.w.document.activeElement,search);
  assert.equal(h.w.document.getElementById('seg-updated').textContent,'');
  gate.resolve();await loading;assert.equal(search.value,'maria');assert.equal(h.w.document.activeElement,search);
});
test('fallo inicial termina el esqueleto y permite reintentar sin resultados falsos',async t=>{
  const h=setup(t),gate=h.pause();h.data(Object.fromEntries(Object.keys(fixtureData()).map(name=>[name,{error:{message:'offline'}}])));
  const loading=h.load();await wait(12);gate.resolve();assert.equal(await loading,false);
  assert.equal(h.root.querySelector('.kja-sk-block,.kja-context-error'),null);
  assert.match(h.root.textContent,/Información no disponible/);assert.ok(h.root.querySelector('[data-seg="reload"]'));
  assert.equal(h.root.getAttribute('aria-busy'),'false');
  h.data(fixtureData());assert.equal(await h.load(),true);assert.equal(h.root.querySelectorAll('.seg-person').length,3);
});
test('fallo de actualización conserva datos anteriores y bloquea acciones con datos incompletos',async t=>{
  const h=setup(t);await h.load();const names=h.root.querySelector('.seg-person-list').textContent;
  const failed=fixtureData();failed.dash_admin_cierres={error:{message:'offline'}};h.data(failed);
  assert.equal(await h.load(),false);assert.equal(h.root.querySelector('.seg-person-list').textContent,names);
  assert.match(h.w.document.getElementById('seg-message').textContent,/datos anteriores/);
  assert.equal(h.w.document.getElementById('seg-export').disabled,true);
  assert.equal(h.root.querySelector('.kja-sk-block'),null);
});
test('cambiar fecha no presenta filas del día anterior y descarta respuestas tardías',async t=>{
  const h=setup(t);await h.load();const gate=h.pause();
  const input=h.w.document.getElementById('seg-date');input.value='2026-10-27';input.dispatchEvent(new h.w.Event('change'));await wait(12);
  assert.equal(h.root.querySelector('.seg-person[data-person]'),null);assert.equal(h.root.querySelectorAll('.seg-loading-person').length,3);
  h.w.KJASeguimiento.reset();gate.resolve();await wait(20);
  assert.equal(h.root.querySelector('.seg-person'),null);assert.equal(h.root.getAttribute('aria-busy'),'false');
  assert.equal(h.root.previousElementSibling?.getAttribute('role')==='status',false);
});
test('una respuesta vacía termina la espera sin confundirla con error',async t=>{
  const h=setup(t),data=fixtureData();data.dash_admin_cierres.personas=[];data.dash_admin_control_diario.filas=[];data.dash_admin_revision_entregas.entregas=[];h.data(data);
  assert.equal(await h.load(),true);assert.match(h.root.textContent,/No hay personas/);
  assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.equal(h.root.getAttribute('aria-busy'),'false');
});
test('editor ve solo sus regiones y consulta únicamente Cierres',async t=>{
  const h=setup(t,{role:'editor'}),gate=h.pause();const loading=h.load();await wait(12);
  assert.equal(h.root.querySelector('.seg-evidence-metrics'),null);assert.equal(h.w.document.getElementById('seg-export').hidden,true);
  gate.resolve();await loading;assert.deepEqual(h.calls.map(call=>call.name),['dash_admin_cierres']);
  assert.ok(h.calls.every(call=>call.args.p_fecha===date));
});
