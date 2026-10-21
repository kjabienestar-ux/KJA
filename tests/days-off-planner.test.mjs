import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('assets/js/dashboard-days-off-planner.js','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup(options={}){
  const dom=new JSDOM('<div id="host"></div>',{runScripts:'outside-only'});
  dom.window.eval(source);
  const calls=[],data={hoy:'2026-10-21',puede_editar:true,personas:[{id:1,nombre:'María Pérez',area:'Ingeniería',activo:true,contrato_inicio:'2026-10-01'},{id:2,nombre:'Carlos Ruiz',area:'Marketing',activo:true}],dias_libres:[{colaborador_id:1,fecha:'2026-10-05',motivo:'Meta cumplida',manual:true},{colaborador_id:2,fecha:'2026-10-06',manual:false}]};
  const host=dom.window.document.getElementById('host');
  const rpc=async(name,args)=>{calls.push([name,args]);return options.rpc?options.rpc(name,args):{data:name==='dash_admin_mes'?{...data,dias_libres:[]}:{ok:true}}};
  const planner=dom.window.KJADaysOffPlanner.mount(host,{data:{...data,...options.data},month:'2026-10',rpc,onChanged:()=>{},...options.mount});
  const $=selector=>host.querySelector(selector);
  const click=selector=>$(selector).click();
  const input=(selector,value)=>{$(selector).value=value;$(selector).dispatchEvent(new dom.window.Event('input',{bubbles:true}))};
  return {dom,host,calls,$,click,input,planner};
}
test('search ignores accents, filters areas and preserves explicit worker selection',async()=>{
  const t=setup();await tick();t.input('#lp-search','maria');assert.equal(t.host.querySelectorAll('[data-person]').length,1);
  t.click('[data-person="1"]');assert.match(t.$('#lp-context').textContent,/María Pérez/);
  t.input('#lp-search','nadie');assert.match(t.$('#lp-people-list').textContent,/No hay coincidencias/);
  assert.match(t.$('#lp-target').textContent,/María Pérez/);
});
test('assigns multiple days using existing audited RPC and excludes an assigned date',async()=>{
  const t=setup();await tick();t.click('[data-person="1"]');t.click('[data-day="2026-10-05"]');assert.equal(t.$('#lp-save').disabled,true);
  t.click('[data-day="2026-10-22"]');t.click('[data-day="2026-10-23"]');t.input('#lp-reason','Meta cumplida');t.click('#lp-save');await tick();
  assert.deepEqual(t.calls.map(c=>c[1].p_fecha),['2026-10-22','2026-10-23']);
  assert.match(t.$('#lp-selection-count').textContent,/Selecciona fechas/);
  assert.equal(t.host.querySelectorAll('.lp-entry').length,3);
});
test('a partial failure retains only unresolved dates and keeps the successful record',async()=>{
  let count=0;const t=setup({rpc:async()=>({data:++count===2?{ok:false,motivo:'sin_permiso'}:{ok:true}})});await tick();
  t.click('[data-person="1"]');t.click('[data-day="2026-10-22"]');t.click('[data-day="2026-10-23"]');t.input('#lp-reason','Meta cumplida');t.click('#lp-save');await tick();
  assert.equal(t.host.querySelectorAll('[data-unselect]').length,1);assert.equal(t.$('[data-unselect]').dataset.unselect,'2026-10-23');
  assert.match(t.$('#lp-status').textContent,/No tienes permiso/);assert.match(t.$('[data-day="2026-10-22"]').textContent,/Libre/);
});
test('week view loads the adjacent month and uses Monday through Sunday',async()=>{
  const t=setup({mount:{date:'2026-10-31'}});await tick();t.click('[data-view="week"]');await tick();
  const days=[...t.host.querySelectorAll('[data-day]')].map(b=>b.dataset.day);
  assert.equal(days.length,7);assert.equal(days[0],'2026-10-26');assert.equal(days[6],'2026-11-01');
  assert.equal(t.calls[0][1].p_mes,11);
});
test('range loads other months before selecting to skip existing leave',async()=>{
  const t=setup({rpc:async()=>({data:{ok:true,dias_libres:[{colaborador_id:1,fecha:'2026-11-02',manual:true}]}})});await tick();t.click('[data-person="1"]');
  t.$('#lp-from').value='2026-10-31';t.$('#lp-to').value='2026-11-03';t.click('[data-lp="range"]');await tick();
  assert.equal(t.host.querySelectorAll('[data-unselect]').length,3);assert.equal(t.$('[data-unselect="2026-11-02"]'),null);
});
test('read only view offers no mutations and protects automatic benefits',async()=>{
  const t=setup({data:{puede_editar:false}});await tick();assert.equal(t.$('.lp-assignment').hidden,true);assert.equal(t.$('[data-remove]'),null);
  t.click('[data-person="1"]');t.click('[data-day="2026-10-22"]');assert.equal(t.calls.length,0);
  const editor=setup();await tick();assert.equal(editor.host.querySelectorAll('[data-remove]').length,1);
});
test('failed period load blocks saving and offers retry',async()=>{
  const t=setup({rpc:async()=>({error:{message:'offline'}})});await tick();t.click('[data-lp="next"]');await tick();
  assert.ok(t.$('[data-lp="retry"]'));assert.equal(t.$('#lp-save').disabled,true);assert.match(t.$('#lp-status').textContent,/No se pudo cargar/);
});
