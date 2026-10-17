import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness({from='2026-10-01',to='2026-10-13',min='2020-01-01',max='2026-10-13'}={}){
 class Node{
  constructor(tag='div'){this.tagName=tag;this.attrs={};this.events={};this.style={};this.value='';this.min='';this.max='';this.disabled=false;this.hidden=false;this.innerHTML='';this.textContent='';this.dataset={};this.children={};this.classList={add(){}};this.visible=false;}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
  emit(type,extra={}){const e={target:this,preventDefault(){},stopPropagation(){},...extra};for(const fn of this.events[type]||[])fn(e);}
  dispatchEvent(e){changes.push([this.id,e.type]);this.emit(e.type);}
  setAttribute(k,v){this.attrs[k]=v;}
  before(wrap){this.wrap=wrap;}
  contains(){return false;}
  matches(){return this.visible;}
  showPopover(){this.visible=true;}
  hidePopover(){this.visible=false;}
  getBoundingClientRect(){return {left:100,top:300,bottom:344,width:200};}
  focus(){}
  querySelector(sel){return this.children[sel]??=new Node();}
  querySelectorAll(){return [];}
 }
 const changes=[];
 const make=id=>{const n=new Node('input');n.id=id;n.tabIndex=0;return n;};
 const inputs={'attendance-export-from':make('attendance-export-from'),'attendance-export-to':make('attendance-export-to')};
 inputs['attendance-export-from'].value=from;inputs['attendance-export-to'].value=to;
 for(const i of Object.values(inputs)){i.min=min;i.max=max;}
 const wraps=[];
 const appended=[];
 const doc=new Node();doc.getElementById=id=>inputs[id];
 doc.body=new Node('body');doc.body.appendChild=el=>appended.push(el);
 doc.querySelectorAll=()=>[];
 doc.createElement=()=>{const w=new Node();wraps.push(w);return w;};
 const win=new Node();win.innerWidth=1000;win.innerHeight=800;
 const context=vm.createContext({document:doc,window:win,Event:class{constructor(type){this.type=type;}},Intl,Date});
 vm.runInContext(fs.readFileSync('assets/js/dashboard-date-picker.js','utf8'),context);
 const pick=(i)=>{const w=wraps[i];return {wrap:w,trigger:w.querySelector('.kja-date-trigger'),text:w.querySelector('.kja-date-text'),grid:w.querySelector('.kja-date-grid'),today:w.querySelector('.kja-date-today'),prev:w.querySelector('[data-nav="-1"]'),next:w.querySelector('[data-nav="1"]'),popup:w.querySelector('.kja-date-popup')};};
 return {inputs,changes,context,from:pick(0),to:pick(1),appended,doc};
}
const disabledDays=html=>[...html.matchAll(/data-date="([\d-]+)" disabled/g)].map(m=>m[1]);
const clickDay=(p,date)=>p.grid.emit('click',{target:{closest:()=>({dataset:{date},disabled:false})}});

test('index.html wires the date picker without touching the close section',()=>{
 const html=fs.readFileSync('dashboard.html','utf8');
 assert.match(html,/dashboard-date-picker\.js/);assert.match(html,/dashboard-date-picker\.css/);
});

test('display shows dd/mm/yyyy and syncKjaDatePickers refreshes after silent value changes',()=>{
 const h=harness();
 assert.equal(h.from.text.textContent,'01/10/2026');assert.equal(h.to.text.textContent,'13/10/2026');
 h.inputs['attendance-export-from'].value='2026-09-05';
 vm.runInContext('syncKjaDatePickers()',h.context);
 assert.equal(h.from.text.textContent,'05/09/2026');
});

test('choosing a day sets the input, fires input and change once and closes',()=>{
 const h=harness();
 h.from.trigger.emit('click');assert.equal(h.from.popup.visible,true);
 clickDay(h.from,'2026-10-05');
 assert.equal(h.inputs['attendance-export-from'].value,'2026-10-05');
 assert.deepEqual(h.changes.filter(c=>c[1]==='change'),[['attendance-export-from','change']]);
 assert.equal(h.from.popup.visible,false);assert.equal(h.from.text.textContent,'05/10/2026');
});

test('days beyond the maximum and before the minimum are disabled',()=>{
 const h=harness({from:'2026-10-01',to:'',max:'2026-10-13'});
 h.to.trigger.emit('click');
 const off=disabledDays(h.to.grid.innerHTML);
 assert.ok(off.includes('2026-10-14')&&off.includes('2026-10-31'));
 assert.ok(!off.includes('2026-10-13'));
 assert.equal(h.to.next.disabled,true);
});

test('range is coherent: Hasta blocks days before Desde and Desde blocks days after Hasta',()=>{
 const h=harness({from:'2026-10-05',to:'2026-10-10'});
 h.to.trigger.emit('click');
 const toOff=disabledDays(h.to.grid.innerHTML);
 assert.ok(toOff.includes('2026-10-04')&&!toOff.includes('2026-10-05'));
 h.from.trigger.emit('click');
 const fromOff=disabledDays(h.from.grid.innerHTML);
 assert.ok(fromOff.includes('2026-10-11')&&!fromOff.includes('2026-10-10'));
});

test('Today is disabled when it falls outside the allowed range',()=>{
 const h=harness({from:'2020-01-01',to:'2020-01-31',max:'2020-01-31'});
 h.from.trigger.emit('click');
 assert.equal(h.from.today.disabled,true);
});

test('month navigation: prev and next update month title and keep popup open without closing',()=>{
 const h=harness({from:'2026-10-01',to:'2026-10-17',min:'2020-01-01',max:'2026-10-17'});
 h.from.trigger.emit('click');
 assert.equal(h.from.popup.visible,true);
 const title=h.from.wrap.querySelector('.kja-date-title');
 assert.equal(title.textContent,'Octubre 2026');
 assert.equal(h.from.prev.disabled,false);

 h.from.prev.emit('click');
 assert.equal(title.textContent,'Septiembre 2026');
 assert.equal(h.from.popup.visible,true);

 h.from.prev.emit('click');
 assert.equal(title.textContent,'Agosto 2026');
 assert.equal(h.from.popup.visible,true);

 h.from.next.emit('click');
 assert.equal(title.textContent,'Septiembre 2026');
 assert.equal(h.from.popup.visible,true);

 h.from.next.emit('click');
 assert.equal(title.textContent,'Octubre 2026');
 assert.equal(h.from.popup.visible,true);
});

test('popups are appended to document.body (portal pattern) to avoid desktop overflow clipping',()=>{
 const h=harness();
 assert.equal(h.appended.length,2);
 h.from.trigger.emit('click');
 assert.equal(h.from.popup.style.width,'290px');
 assert.equal(h.from.popup.style.left,'100px');
 assert.equal(h.from.popup.style.top,'352px');
});

