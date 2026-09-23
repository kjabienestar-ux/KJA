import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../assets/js/dashboard-month-progress.js';

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
