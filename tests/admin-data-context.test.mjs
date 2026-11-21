import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const wait=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}assert.ok(check(),'El estado esperado debe aparecer');};
function setup(t){
  const dom=new JSDOM('<section id="view"><button id="admin-new-person">Nuevo</button><input id="filter"><div id="admin-people-kpis"></div><div id="admin-people-list"></div></section>',{runScripts:'outside-only'}),w=dom.window;
  t.after(()=>w.close());w.APP={sessionUid:'one',access:{rol:'direccion'},identity:{isSystem:true},adminTeam:null};w.isoLima=()=> '2026-11-21';w.matchMedia=()=>({matches:true});
  w.renderAdminPeople=()=>{w.document.getElementById('admin-people-list').innerHTML=w.APP.adminTeam?'<button>Ficha de Ana</button>':'Sin datos';};
  w.eval(fs.readFileSync('assets/js/dashboard-skeleton.js','utf8'));w.eval(fs.readFileSync('assets/js/dashboard-admin-data-loading.js','utf8'));
  const host=w.document.getElementById('view');return {w,host,run:fn=>w.AdminDataLoading.run('colaboradores',host,fn,{delay:5,minVisible:20,fade:0})};
}
test('primera carga oculta datos parciales, conserva filtros y libera capas/inercia al resolver',async t=>{
  const h=setup(t),d=deferred();const pending=h.run(async()=>{await d.promise;h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;});
  await wait(()=>h.host.querySelector('.adc-row'));assert.equal(h.host.getAttribute('aria-busy'),'true');assert.equal(h.w.document.getElementById('filter').disabled,false);
  assert.equal(h.w.document.getElementById('admin-people-list').inert,true);assert.equal(h.host.querySelector('.kja-skeleton-mirror'),null);
  d.resolve();await pending;assert.equal(h.host.getAttribute('aria-busy'),'false');assert.equal(h.host.querySelector('.kja-context-layer'),null);assert.equal(h.w.document.getElementById('admin-people-list').inert,false);
});
test('actualizar conserva datos y foco; un fallo bloquea acciones antiguas y reintentar las restaura',async t=>{
  const h=setup(t);await h.run(async()=>{h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;});
  const input=h.w.document.getElementById('filter');input.value='Ana';input.focus();const d=deferred();let fail=true;
  const pending=h.run(async()=>{await d.promise;if(fail){h.w.APP.adminTeam=null;return false;}h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;});
  await wait(()=>h.host.classList.contains('is-context-refreshing'));assert.match(h.host.textContent,/Ficha de Ana/);assert.equal(h.host.querySelector('.kja-context-layer'),null);assert.equal(h.w.document.activeElement,input);
  d.resolve();await pending;assert.match(h.host.textContent,/datos anteriores/);assert.equal(h.w.document.getElementById('admin-people-list').inert,true);
  fail=false;h.host.querySelector('.adc-retry').click();await wait(()=>!h.w.AdminDataLoading.busy('colaboradores'));
  assert.equal(h.w.document.getElementById('admin-people-list').inert,false);assert.equal(h.w.document.getElementById('admin-new-person').disabled,false);assert.equal(input.value,'Ana');assert.equal(h.host.querySelector('.adc-retry'),null);
});
test('un error inicial acaba la espera, informa indisponibilidad y recupera con reintento',async t=>{
  const h=setup(t);let ok=false;await h.run(async()=>{if(!ok)throw Error('offline');h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;});
  assert.equal(h.host.getAttribute('aria-busy'),'false');assert.match(h.host.textContent,/Información no disponible/);assert.equal(h.host.querySelector('.kja-context-layer'),null);
  ok=true;h.host.querySelector('.adc-retry').click();await wait(()=>!h.w.AdminDataLoading.busy('colaboradores'));assert.match(h.host.textContent,/Ficha de Ana/);
});
test('cambiar sesión retira identidades anteriores antes de consultar el nuevo contexto',async t=>{
  const h=setup(t);await h.run(async()=>{h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;});
  h.w.APP.sessionUid='two';const d=deferred();const pending=h.run(async()=>{await d.promise;h.w.APP.adminTeam={ok:true};return true;});
  assert.doesNotMatch(h.host.textContent,/Ficha de Ana/);assert.equal(h.w.APP.adminTeam,null);d.resolve();await pending;
});
test('reiniciar sesión limpia instantáneas privadas y no conserva bloqueos de una consulta fallida',async t=>{
  const h=setup(t);await h.run(async()=>{h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;});
  await h.run(async()=>false);assert.equal(h.w.document.getElementById('admin-people-list').inert,true);
  h.w.AdminDataLoading.reset();assert.equal(h.w.APP.adminTeam,null);assert.equal(h.host.querySelector('.adc-notice'),null);assert.equal(h.w.document.getElementById('admin-people-list').inert,false);
  assert.equal(h.w.document.getElementById('admin-new-person').disabled,false);
  const d=deferred(),pending=h.run(async()=>{await d.promise;return true;});await wait(()=>h.host.querySelector('.adc-row'));
  d.resolve();await pending;
});
test('la entrada del lector evita envoltura recursiva y deduplica consultas simultáneas',async t=>{
  const h=setup(t),d=deferred();h.w.APP.adminSection='colaboradores';let calls=0;
  const read=async()=>{calls++;assert.equal(h.w.AdminDataLoading.shouldWrap('colaboradores'),false);await d.promise;h.w.APP.adminTeam={ok:true};h.w.renderAdminPeople();return true;};
  const first=h.run(read),second=h.run(read);assert.equal(first,second);assert.equal(calls,1);assert.equal(h.w.AdminDataLoading.shouldWrap('colaboradores'),true);
  d.resolve();await first;assert.equal(h.w.AdminDataLoading.busy('colaboradores'),false);
});
test('una respuesta descartada no borra datos compartidos recibidos por una vista más reciente',async t=>{
  const h=setup(t),d=deferred(),pending=h.run(async()=>{await d.promise;return undefined;});
  h.w.APP.adminTeam={from:'consulta más reciente'};d.resolve();await pending;
  assert.equal(h.w.APP.adminTeam.from,'consulta más reciente');assert.equal(h.host.querySelector('.adc-retry'),null);assert.equal(h.host.getAttribute('aria-busy'),'false');
});
