import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('assets/js/dashboard-admin-mes.js','utf8');
function focusSetup(){
 const dom=new JSDOM('<div id="admin-month-ledger"><button data-month-person="1" data-month-date="2026-10-22">Día</button></div><div id="admin-month-modal"><div id="admin-month-modal-message"></div></div>');
 const doc=dom.window.document,modal=doc.getElementById('admin-month-modal'),ledger=doc.getElementById('admin-month-ledger');
 modal._returnCell={personId:'1',date:'2026-10-22'};modal._returnFocus=ledger.firstChild;
 const env={document:doc,$:id=>doc.getElementById(id),ADMIN_MONTH_DIALOG:{kind:'cell'},loadAdminMonth:async()=>{ledger.innerHTML='<button data-month-person="1" data-month-date="2026-10-22">Día actualizado</button>';return true;}};
 vm.createContext(env);vm.runInContext(source.slice(source.indexOf('function restoreMonthModalFocus('),source.indexOf('function modalMonthMessage(')),env);
 return {env,doc,modal,ledger};
}
test('closing after a matrix refresh focuses the replacement cell',()=>{const {env,doc,ledger}=focusSetup();ledger.innerHTML='<button data-month-person="1" data-month-date="2026-10-22">Nuevo</button>';env.closeMonthModal();assert.equal(doc.activeElement,ledger.firstChild);});
test('missing origin after filtering falls back to the ledger',()=>{const {env,doc,ledger}=focusSetup();ledger.innerHTML='Sin resultados';env.closeMonthModal();assert.equal(doc.activeElement,ledger);assert.equal(ledger.getAttribute('tabindex'),'-1');});
test('saving keeps focus after the asynchronous reload replaces the rows',async()=>{const {env,doc,ledger}=focusSetup();await env.refreshMonthAfterModalClose();assert.equal(doc.activeElement,ledger.firstChild);assert.match(doc.activeElement.textContent,/actualizado/);});
test('an async refresh does not steal focus from a newly opened modal',async()=>{const {env,doc,modal}=focusSetup();const control=doc.createElement('button');modal.append(control);env.loadAdminMonth=async()=>{modal.hidden=false;modal._returnCell={personId:'2',date:'2026-10-22'};control.focus();};await env.refreshMonthAfterModalClose();assert.equal(doc.activeElement,control);});
function stateSetup(){
 const dom=new JSDOM('<div id="admin-month-modal-body"><div class="month-state-picker"><button>P</button><button>T</button></div></div>');let finish;const calls=[],messages=[];let refreshes=0;
 const env={ADMIN_MONTH_DIALOG:{kind:'cell',personId:'1',date:'2026-10-22'},APP:{adminMonth:{puede_editar:true}},$:id=>dom.window.document.getElementById(id),findMonthCell:()=>({person:{id:1},day:{fecha:'2026-10-22'}}),statusText:()=> 'Presente',modalMonthMessage:s=>messages.push(s),db:{rpc:(name,args)=>{calls.push({name,args});return new Promise(resolve=>finish=resolve);}},refreshMonthAfterModalClose:async()=>{refreshes++;env.ADMIN_MONTH_DIALOG=null;},toast:()=>{}};
 vm.createContext(env);vm.runInContext(source.slice(source.indexOf('async function changeMonthState('),source.indexOf('async function removeMonthMark(')),env);
 return {env,dom,calls,messages,resolve:x=>finish(x),refreshes:()=>refreshes};
}
test('immediate state change communicates progress and blocks duplicate submissions',async()=>{const x=stateSetup();const pending=x.env.changeMonthState('P');await x.env.changeMonthState('T');assert.equal(x.calls.length,1);assert.match(x.messages[0],/Aplicando/);assert.ok([...x.dom.window.document.querySelectorAll('button')].every(b=>b.disabled));x.resolve({data:{ok:true}});await pending;assert.equal(x.refreshes(),1);assert.equal(x.calls[0].args.p_estado,'P');});
test('failed state change restores controls and gives a retryable error',async()=>{const x=stateSetup();const pending=x.env.changeMonthState('P');x.resolve({data:{ok:false,motivo:'sin_permiso'}});await pending;assert.equal(x.refreshes(),0);assert.match(x.messages.at(-1),/Tu rol no permite/);assert.ok([...x.dom.window.document.querySelectorAll('button')].every(b=>!b.disabled));});
