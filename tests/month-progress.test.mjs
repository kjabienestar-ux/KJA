import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../assets/js/dashboard-month-progress.js';
import fs from 'node:fs';
import vm from 'node:vm';

function calendarRenderHarness(){
  const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
  let markup='',replacements=0;
  const days={dataset:{responsiveBound:'true'},clientWidth:350,scrollWidth:1500,scrollLeft:0,
    get innerHTML(){return markup;},set innerHTML(value){markup=value;replacements++;},
    setAttribute(){},querySelector(){return markup.includes(' today"')?{offsetLeft:800,offsetWidth:44}:null;}};
  const context={$:()=>days,window:{matchMedia:()=>({matches:true})},requestAnimationFrame:fn=>fn(),
    KJAMonthProgress:{...model,bind:()=>()=>{},curve:()=>{}},esc:String,
    monthNames:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']};
  vm.runInNewContext(source.slice(source.indexOf('let hideDashboardDayTooltip='),source.indexOf("let selectedAttendanceDate=")),context);
  const history={anio:2026,mes:9,hoy:'2026-09-25',dias:[{lab:true,fecha:'2026-09-25',d:25,estado:'P'}]};
  return {days,history,render:context.renderDashboardMonthProgress,replacements:()=>replacements};
}

test('calendar curve follows the viewport on scroll and resets on desktop',()=>{
  const listeners={},frames=[];
  const media={matches:true,addEventListener:(name,fn)=>{listeners.media=fn;}};
  let shift=0;
  const days=[25,175,325].map(x=>({value:'',style:{setProperty(name,value){this.value=value;}},getBoundingClientRect:()=>({left:x-22-shift,width:44})}));
  const container={ownerDocument:{defaultView:{matchMedia:()=>media,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},addEventListener(){}}},
    getBoundingClientRect:()=>({left:0,width:350}),querySelectorAll:()=>days,addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const flush=()=>{while(frames.length)frames.shift()();};
  model.curve(container);flush();
  assert.equal(days[1].style.value,'0.00px');
  assert.equal(days[0].style.value,days[2].style.value);
  assert.ok(parseFloat(days[0].style.value)>18);
  shift=150;listeners.scroll();flush();assert.equal(days[2].style.value,'0.00px');
  media.matches=false;listeners.media();flush();
  assert.ok(days.every(day=>day.style.value==='0px'));
});

test('background refresh preserves the scrolled date and unchanged day buttons',()=>{
  const h=calendarRenderHarness();h.render(h.history);
  assert.ok(h.days.scrollLeft>0);
  h.days.scrollLeft=120;
  h.render(h.history);
  assert.equal(h.days.scrollLeft,120);
  assert.equal(h.replacements(),1);
  h.history.dias[0].estado='T';h.render(h.history);
  assert.equal(h.days.scrollLeft,120);
  assert.match(h.days.innerHTML,/Entrada con tardanza/);
});

test('initial centering waits for a visible calendar and runs again on a new date',()=>{
  const h=calendarRenderHarness();h.days.clientWidth=0;h.render(h.history);
  assert.equal(h.days.scrollLeft,0);
  h.days.clientWidth=350;h.render(h.history);assert.ok(h.days.scrollLeft>0);
  h.days.scrollLeft=120;h.history.hoy='2026-09-26';h.history.dias[0].fecha='2026-09-26';h.history.dias[0].d=26;h.render(h.history);
  assert.ok(h.days.scrollLeft>120);
});

test('a non-working day with assigned overdue sharing is visible and red',()=>{
  const view=model.present({lab:false,aplica_comparticiones:true,comparticiones_vencidas:true});
  assert.equal(view.state,'incomplete');assert.equal(view.alert,true);
  assert.match(view.reason,/No tenías jornada laboral/);assert.match(view.reason,/plazo venció/);
});
test('days without either obligation stay hidden, including legacy API data',()=>{
  assert.equal(model.present({lab:false}),null);
  assert.equal(model.present({lab:false,aplica_comparticiones:false,comparticiones_vencidas:true}),null);
  assert.equal(model.present({lab:true,estado:'P'}).state,'p');
});
test('an uploaded sharing is delivered even while approval is pending',()=>{
  const view=model.present({lab:false,aplica_comparticiones:true,comparticiones_completas:true,revision_estado:'pendiente'});
  assert.equal(view.state,'p');assert.equal(view.alert,false);
  assert.match(view.reason,/entregadas/);assert.doesNotMatch(view.reason,/aprobadas/);
});
test('open sharing windows and future obligations never become missing deliveries',()=>{
  const day={lab:false,aplica_comparticiones:true};
  assert.equal(model.present(day).state,'sharing-pending');
  assert.match(model.present(day).reason,/aún no vence/);
  assert.equal(model.present({...day,futuro:true,comparticiones_vencidas:true}).state,'future');
});
test('sharing can mark a working day red without changing its attendance mark',()=>{
  const day={lab:true,estado:'P',cierre_estado:'completa',aplica_comparticiones:true,comparticiones_vencidas:true};
  assert.equal(model.present(day).state,'incomplete');assert.equal(day.estado,'P');
  assert.doesNotMatch(model.present(day).reason,/No tenías jornada/);
  assert.equal(model.present({...day,comparticiones_completas:true,comparticiones_vencidas:false}).state,'p');
});
test('existing incomplete shifts retain their own explanation',()=>{
  const view=model.present({lab:true,cierre_estado:'incompleta'});
  assert.equal(view.state,'incomplete');assert.match(view.reason,/cierre o sus evidencias/);
});

test('mobile days open a concise dialog with the selected date and real summary',()=>{
  const events=()=>({listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
  const win=Object.assign(events(),{matchMedia:()=>({matches:true})});
  const title={},copy={},close={},done={};
  const dialog=Object.assign(events(),{setAttribute(){},querySelector(s){return s==='h2'?title:s==='p'?copy:s.includes('-close')?close:done;},showModal(){this.open=true;},close(){this.open=false;},getBoundingClientRect(){return {left:10,right:350,top:100,bottom:400};}});
  const tip=Object.assign(events(),{setAttribute(){},contains(){return false;}});
  const doc=Object.assign(events(),{defaultView:win,body:{append(){}},createElement:tag=>tag==='dialog'?dialog:tip});
  const container=Object.assign(events(),{ownerDocument:doc,dataset:{}});
  const button={dataset:{dayReason:'23 de septiembre, hoy: Presente. Comparticiones entregadas.'},closest(){return this;}};
  model.bind(container);
  container.listeners.focusin({target:button});assert.equal(tip.hidden,true);
  container.listeners.click({target:button});
  assert.equal(dialog.open,true);assert.equal(title.textContent,'23 de septiembre, hoy');
  assert.equal(copy.textContent,'Presente. Comparticiones entregadas.');
  done.onclick();assert.equal(dialog.open,false);
  container.listeners.click({target:button});close.onclick();assert.equal(dialog.open,false);
});

test('tooltip supports pointer, keyboard, tap, Escape, outside dismissal and rebinding',()=>{
  const events=()=>({listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
  const doc=events(),win=events();win.innerWidth=360;win.innerHeight=700;doc.defaultView=win;
  const attrs={};const button={dataset:{dayReason:'19 de septiembre: faltan comparticiones.'},setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];},getBoundingClientRect(){return {left:330,top:650,bottom:694,width:30};},contains(x){return x===this;},closest(){return this;}};
  const tip=Object.assign(events(),{style:{},setAttribute(){},getBoundingClientRect(){return {width:300,height:90};},contains(){return false;}});
  doc.createElement=()=>tip;doc.body={append(){}};
  const container=Object.assign(events(),{ownerDocument:doc,dataset:{},contains:x=>x===button});
  const hide=model.bind(container);assert.equal(model.bind(container),undefined);
  container.listeners.pointerover({target:button,pointerType:'mouse'});
  assert.equal(tip.hidden,false);assert.equal(tip.textContent,button.dataset.dayReason);
  assert.equal(tip.style.left,'52px');assert.equal(tip.style.top,'552px');
  doc.listeners.keydown({key:'Escape'});assert.equal(tip.hidden,true);assert.equal(attrs['aria-describedby'],undefined);
  container.listeners.focusin({target:button});assert.equal(tip.hidden,false);
  container.listeners.focusout();assert.equal(tip.hidden,true);
  container.listeners.click({target:button});assert.equal(tip.hidden,false);
  doc.listeners.pointerdown({target:{}});assert.equal(tip.hidden,true);
  container.listeners.click({target:button});win.listeners.resize();assert.equal(tip.hidden,true);
  container.listeners.click({target:button});hide();assert.equal(tip.hidden,true);
});
