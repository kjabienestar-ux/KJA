import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const labels={asignar_lider:'Asignó un líder técnico'};
function setup(events=Array.from({length:20},(_,i)=>({accion:'asignar_lider',created_at:new Date(Date.UTC(2026,10,5,12,i)).toISOString(),actor:'Persona '+i,area:i===0?'Ingeniería':'Marketing',lider_nuevo:'Nuevo '+i}))){
 const dom=new JSDOM('<div id="admin-role-audit"></div>',{runScripts:'outside-only'}),w=dom.window;w.matchMedia=()=>({matches:true,addEventListener(){}});w.isoLima=()=> '2026-11-05';w.esc=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');w.APP={adminRoles:{eventos:events}};w.eval(fs.readFileSync('assets/js/dashboard-role-history.js','utf8'));w.renderRoleAuditHistory(events,labels);return {w,d:w.document,events};
}
test('six results per page, descending order, source array unchanged and keyboard focus survives the last page',()=>{
 const {w,d,events}=setup();try{const before=JSON.stringify(events);assert.equal(d.querySelectorAll('article').length,6);assert.match(d.querySelector('article').textContent,/Persona 19/);for(let i=0;i<3;i++)d.querySelector('.rh-pagination button:last-child').click();assert.equal(d.querySelectorAll('article').length,2);assert.match(d.querySelector('.rh-results').textContent,/19–20 de 20/);assert.equal(d.activeElement.textContent,'Anterior');assert.equal(JSON.stringify(events),before);}finally{w.close();}
});
test('search covers every page, ignores accents and restores an explicit empty state',()=>{
 const {w,d}=setup();try{const input=d.querySelector('input');input.value='ingenieria';input.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('article').length,1);assert.equal(d.querySelector('.rh-pagination').hidden,true);assert.match(d.querySelector('article').textContent,/Persona 0/);input.value='zzz';input.dispatchEvent(new w.Event('input'));assert.ok(d.querySelector('[data-rh-reset]'));d.querySelector('[data-rh-reset]').click();assert.equal(d.querySelectorAll('article').length,6);assert.equal(input.value,'');d.querySelector('.rh-order').click();assert.match(d.querySelector('article').textContent,/Persona 0/);}finally{w.close();}
});
test('Lima date boundaries and the seven-day inclusive range are respected',()=>{
 const events=['2026-11-06T01:00:00Z','2026-11-05T04:59:00Z','2026-10-30T12:00:00Z','2026-10-29T12:00:00Z'].map(created_at=>({created_at,accion:'asignar_lider'}));const {w,d}=setup(events);try{d.querySelector('[data-rh-period=today]').click();assert.equal(d.querySelectorAll('article').length,1);d.querySelector('[data-rh-period=week]').click();assert.equal(d.querySelectorAll('article').length,3);}finally{w.close();}
});
test('no events produce a dedicated empty state without pagination',()=>{const {w,d}=setup([]);try{assert.match(d.querySelector('.rh-empty').textContent,/Todavía no/);assert.equal(d.querySelector('.rh-pagination').hidden,true);}finally{w.close();}});
