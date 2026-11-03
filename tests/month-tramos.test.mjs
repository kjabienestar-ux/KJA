import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('assets/js/dashboard-admin-mes.js','utf8');
const days=(month,n)=>Array.from({length:n},(_,i)=>({fecha:`${month}-${String(i+1).padStart(2,'0')}`,estado:'P',laborable:true}));
function setup(){
 const dom=new JSDOM('<div id="admin-month-kpis"></div><div id="admin-month-ledger"></div>');
 const people=Array.from({length:18},(_,i)=>({id:i+1,nombre:'Persona '+i,area:'Área',activo:true,dias:days('2026-10',31),resumen:{}}));
 const env={Date,Math,window:{innerWidth:1440},APP:{adminMonth:{personas:people,hoy:'2026-10-22',puede_editar:true}},$:id=>dom.window.document.getElementById(id),monthPeople:()=>people,closeAdminPersonCalendar(){},sumMonth:()=>0,monthRate:()=>null,monthTitle:x=>x,currentMonthValue:()=> '2026-10',esc:x=>String(x),profileAvatarMarkup:()=>'',monthCellClass:()=>'',statusText:x=>x,monthMessage(){}};
 vm.createContext(env);vm.runInContext(source.slice(source.indexOf('let ADMIN_MONTH_RANGE='),source.indexOf('function renderAdminMonthSummary()')),env);
 return {env,dom,people};
}
test('tramos cover each date exactly once including six-week months and leap February',()=>{
 const {env}=setup();for(const [month,n] of [['2026-10',31],['2026-11',30],['2028-02',29],['2026-02',28]])for(const narrow of [false,true]){
 const d=days(month,n),ranges=env.monthDayRanges(d,narrow);assert.deepEqual(Array.from(ranges.flat(),x=>x.fecha),d.map(x=>x.fecha));assert.ok(ranges.every(x=>x.length<=(narrow?3:7)));
 }
});
test('initial range uses server today, preserves selected date across narrow mode and resets on month change',()=>{
 const {env}=setup();let v=env.monthRangeView(days('2026-10',31),'2026-10-22',false);assert.equal(v.visible[0].fecha,'2026-10-19');v=env.monthRangeView(days('2026-10',31),'2026-10-22',true);assert.ok(v.visible.some(d=>d.fecha==='2026-10-22'));v=env.monthRangeView(days('2026-11',30),'2026-10-22',false);assert.equal(v.visible[0].fecha,'2026-11-01');
});
test('pagination renders eight people and only selected dates; monthly source remains complete',()=>{
 const {env,dom,people}=setup();env.renderAdminMonthLedger();assert.equal(dom.window.document.querySelectorAll('[data-month-person]').length,56);assert.equal(dom.window.document.querySelectorAll('[data-person-calendar]').length,8);assert.equal(people[0].dias.length,31);assert.equal(dom.window.document.querySelector('[data-month-date]').dataset.monthDate,'2026-10-19');vm.runInContext('ADMIN_MONTH_RANGE.page=2',env);env.renderAdminMonthLedger();assert.equal(dom.window.document.querySelectorAll('[data-person-calendar]').length,2);people.length=1;env.renderAdminMonthLedger();assert.equal(dom.window.document.querySelector('[data-person-calendar]').dataset.personCalendar,'1');
});
test('empty filtered list keeps date controls and explicit empty state',()=>{const {env,dom,people}=setup();people.length=0;env.renderAdminMonthLedger();assert.match(dom.window.document.body.textContent,/No hay colaboradores/);assert.equal(dom.window.document.querySelector('.month-range-footer'),null);assert.doesNotMatch(dom.window.document.body.textContent,/Tramo 1 de 0|1 \/ 1/);});

test('zero search results preserve available date ranges without a fictitious person paginator',()=>{
 const {env,dom}=setup();env.monthPeople=()=>[];env.renderAdminMonthLedger();assert.ok(dom.window.document.querySelector('[data-month-range]'));assert.equal(dom.window.document.querySelector('[data-month-page]'),null);assert.match(dom.window.document.body.textContent,/No hay colaboradores/);
});
