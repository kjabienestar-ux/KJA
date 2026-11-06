import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const html=fs.readFileSync('dashboard.html','utf8'),ui=fs.readFileSync('assets/js/dashboard-access-workbench.js','utf8');
function setup(desktop=true){
  const dom=new JSDOM(html,{runScripts:'outside-only'}),w=dom.window;
  let change;const media={matches:desktop,addEventListener:(_,cb)=>change=cb};w.matchMedia=()=>media;w.requestAnimationFrame=cb=>cb();let maps=0;w.prepareOfficeMap=()=>maps++;
  w.eval(ui);return {w,d:w.document,resize(value){media.matches=value;change();},maps:()=>maps};
}
test('desktop separates access consultation from configuration, preserving existing controls and handlers',()=>{
  const {d,w}=setup();
  assert.equal(d.querySelector('.aw-tabs [role=tab][aria-selected=true]').textContent,'Equipo');
  assert.ok(d.querySelector('#aw-panel-equipo #admin-access-list'));
  const save=d.getElementById('admin-access-save');let calls=0;save.onclick=()=>calls++;
  d.getElementById('aw-tab-reglas').click();assert.equal(d.getElementById('aw-panel-reglas').hidden,false);assert.equal(d.getElementById('aw-panel-equipo').hidden,true);
  assert.equal(d.querySelector('#aw-panel-reglas #admin-access-save'),save);save.click();assert.equal(calls,1);
  assert.equal(d.querySelector('#admin-access-evidence').disabled,true);
  w.close();
});
test('arrow keys and Home/End move focus and selection together; map refreshes when opened',()=>{
  const h=setup(),{d,w}=h;d.getElementById('aw-tab-equipo').focus();
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(d.activeElement.id,'aw-tab-reglas');assert.equal(h.maps(),1);
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(d.activeElement.id,'aw-tab-equipo');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert.equal(d.activeElement.id,'aw-tab-reglas');
  w.close();
});
test('mobile retains original layout and resizing restores the same elements without duplicates',()=>{
  const h=setup(false),{d,w}=h,layout=d.querySelector('.admin-access-layout'),policy=d.querySelector('.admin-policy-card');
  assert.equal(d.querySelector('.aw-tabs'),null);assert.equal(policy.parentNode,layout);
  for(let i=0;i<2;i++){h.resize(true);assert.equal(d.querySelector('#aw-panel-reglas .admin-policy-card'),policy);h.resize(false);assert.equal(policy.parentNode,layout);assert.equal(d.querySelectorAll('#admin-access-settings').length,1);}
  w.close();
});
test('sensitive actions keep confirmation and out-of-range tolerance never sends a write',async()=>{
  const h=setup(),{w,d}=h;let writes=0,confirmations=0;
  w.$=id=>d.getElementById(id);w.APP={access:{rol:'direccion'},adminAccess:{config:{activo:true},resumen:{sin_pin:1},personas:[{id:1,nombre:'Persona de prueba'}]}};
  w.db={rpc:async()=>{writes++;return {data:{ok:true}}}};w.confirm=()=>{confirmations++;return false};
  w.eval(fs.readFileSync('assets/js/dashboard-admin-acceso.js','utf8'));
  await w.resetAccessPin(1);await w.rotateAccessLink();assert.equal(confirmations,2);assert.equal(writes,0);
  d.getElementById('admin-access-tolerance').value='121';await w.saveAccessSettings({preventDefault(){}});assert.equal(writes,0);assert.match(d.getElementById('admin-access-message').textContent,/0 y 120/);
  w.close();
});
test('six-person pages preserve filters, clamp a shrinking result and restore the full list outside desktop',()=>{
  const h=setup(),{w,d}=h;w.$=id=>d.getElementById(id);w.esc=String;w.initials=()=>'';
  w.APP={adminAccess:{personas:Array.from({length:14},(_,i)=>({id:i+1,nombre:'Persona '+(i+1),area:'Área',tiene_pin:i>1,tiene_cuenta:true,dni_configurado:true}))}};
  w.eval(fs.readFileSync('assets/js/dashboard-admin-acceso.js','utf8'));w.renderAccessPeople();
  assert.equal(d.querySelectorAll('.admin-access-person').length,6);assert.match(d.getElementById('admin-access-pagination').textContent,/1–6 de 14/);
  d.querySelector('[aria-label="Página 3"]').click();assert.equal(d.querySelectorAll('.admin-access-person').length,2);assert.match(d.getElementById('admin-access-list').textContent,/Persona 13/);
  d.getElementById('admin-access-filter').value='missing';d.getElementById('admin-access-filter').dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('.admin-access-person').length,2);assert.match(d.getElementById('admin-access-pagination').textContent,/1–2 de 2/);
  d.getElementById('admin-access-filter').value='';d.getElementById('admin-access-filter').dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('.admin-access-person').length,6);
  h.resize(false);assert.equal(d.querySelectorAll('.admin-access-person').length,14);assert.equal(d.getElementById('admin-access-pagination'),null);w.close();
});
