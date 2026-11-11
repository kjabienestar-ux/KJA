import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const src=fs.readFileSync('assets/js/dashboard-pausa-activa.js','utf8');
function tab({saved,blocked=false,owner='A',now=1000000}={}){
  const dom=new JSDOM(`<button id="rail-pausa-open"><span class="rail-pausa-duration"></span><span class="rail-pausa-info"><span></span></span><span class="rail-pausa-footer"><span></span></span><span class="rail-pausa-figure"></span></button><div id="pausa-activa-overlay" hidden><button id="pausa-activa-backdrop"></button><section id="pausa-activa-container" role="dialog" aria-labelledby="pausa-activa-title"></section></div>`,{url:'https://fixture.test',runScripts:'outside-only'});
  const w=dom.window, intervals=new Map(), errors=[];let clock=now,id=0,requests=0;
  w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
  Object.defineProperty(w.document,'hidden',{value:false,configurable:true});
  w.Date.now=()=>clock;
  w.setInterval=(fn,ms)=>{intervals.set(++id,{fn,ms});return id;};w.clearInterval=id=>intervals.delete(id);
  w.fetch=()=>{requests++;throw Error('Forbidden network');};w.db={rpc(){requests++;throw Error('Forbidden RPC');}};
  w.APP={sessionUid:owner};
  if(saved)w.localStorage.setItem('kja-pausa-local-v1:'+owner,saved);
  if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked');}});
  w.eval(src);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const click=s=>{w.document.querySelector(s).click();if(errors.length)throw errors[0];};
  return {w,intervals,click,dom,open:()=>click('#rail-pausa-open'),cancel:()=>{click('#pausa-btn-confirm-exit');click('#pausa-btn-exit-anyway');},start:(type='visual')=>{const card=w.document.querySelector(`[data-break-id="${type}"]`);if(!card.classList.contains('is-flipped'))card.querySelector('.pausa-card-front').click();click(`[data-start-break="${type}"]`);},text:()=>w.document.body.textContent,advance(ms){clock+=ms;for(const {fn,ms} of [...intervals.values()])if(ms===1000)fn();},requests:()=>requests};
}
test('no network on startup, five idle minutes, resume or reconnect',()=>{
  const t=tab();assert.equal(t.intervals.size,0);t.advance(300000);t.open();t.start();
  t.w.dispatchEvent(new t.w.Event('online'));t.w.document.dispatchEvent(new t.w.Event('visibilitychange'));
  t.advance(300000);assert.equal(t.requests(),0);assert.doesNotMatch(src,/\b(?:fetch|db|supabase|XMLHttpRequest|MutationObserver|BroadcastChannel)\b/);
});
test('free use without attendance, both durations and repeat after cancellation',()=>{
  const t=tab();t.open();t.start('movilidad');assert.match(t.text(),/20:00/);
  t.cancel();t.start('visual');assert.match(t.text(),/10:00/);
  t.cancel();t.start('visual');assert.match(t.text(),/10:00/);
});
test('original flip cards work by keyboard and cancellation can be dismissed',()=>{
  const t=tab();t.open();
  const card=t.w.document.querySelector('.pausa-flip-container[data-break-id="visual"]'),front=card.querySelector('.pausa-card-front'),back=card.querySelector('.pausa-card-back');
  assert.equal(back.inert,true);
  front.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  assert.equal(front.inert,true);assert.equal(back.inert,false);assert.equal(card.classList.contains('is-flipped'),true);
  t.click('[data-start-break="visual"]');t.click('#pausa-btn-confirm-exit');
  assert.match(t.text(),/¿Seguro que quieres salir/);t.advance(60000);t.click('#pausa-btn-resume');
  assert.match(t.text(),/09:00/);assert.equal(t.intervals.size,2);assert.ok(t.w.document.querySelector('.pausa-dots-row'));
});
test('closing dialog stops all intervals but preserves deadline and resumes',()=>{
  const t=tab();t.open();t.start();t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(t.intervals.size,0);
  t.advance(90000);t.open();assert.match(t.text(),/08:30/);assert.equal(t.intervals.size,2);
  t.w.document.dispatchEvent(new t.w.Event('visibilitychange'));assert.equal(t.intervals.size,2);
});
test('reload restores only four fields, no history, silently',()=>{
  const t=tab();t.open();t.start();const raw=t.w.localStorage.getItem('kja-pausa-local-v1:A');
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['end','start','type','version']);
  const restored=tab({saved:raw,now:1120000});assert.equal(restored.w.document.querySelector('#pausa-activa-overlay').hidden,true);
  restored.open();assert.match(restored.text(),/08:00/);
});
test('delayed callback finishes by deadline, clears storage and allows another pause',()=>{
  const t=tab();t.open();t.start();t.advance(900000);assert.match(t.text(),/Pausa completada/);
  assert.equal(t.intervals.size,0);assert.equal(t.w.localStorage.length,0);
  t.click('#pausa-btn-back-selection');t.start();assert.match(t.text(),/10:00/);
});
test('suspension and returning to tab recompute elapsed time',()=>{
  const t=tab();t.open();t.start();Object.defineProperty(t.w.document,'hidden',{value:true,configurable:true});
  t.w.document.dispatchEvent(new t.w.Event('visibilitychange'));assert.equal(t.intervals.size,0);t.advance(180000);
  Object.defineProperty(t.w.document,'hidden',{value:false,configurable:true});t.w.document.dispatchEvent(new t.w.Event('visibilitychange'));
  assert.match(t.text(),/07:00/);assert.equal(t.intervals.size,2);
});
test('account change isolates pause; sign out removes current account state',()=>{
  const t=tab();t.open();t.start();t.w.KJAPausasLocal.setAccount('B');t.open();assert.doesNotMatch(t.text(),/Tiempo restante/);
  t.start('movilidad');t.w.KJAPausasLocal.signOut();assert.equal(t.intervals.size,0);
  assert.equal(t.w.localStorage.getItem('kja-pausa-local-v1:B'),null);assert.notEqual(t.w.localStorage.getItem('kja-pausa-local-v1:A'),null);
  t.w.KJAPausasLocal.setAccount('A');t.open();assert.match(t.text(),/10:00/);
});
test('other tab start and cancellation synchronize through current storage',()=>{
  const t=tab();t.open();const session={version:1,type:'movilidad',start:1000000,end:2200000};
  t.w.localStorage.setItem('kja-pausa-local-v1:A',JSON.stringify(session));
  t.w.dispatchEvent(new t.w.StorageEvent('storage',{key:'kja-pausa-local-v1:A'}));assert.match(t.text(),/20:00/);
  t.w.localStorage.removeItem('kja-pausa-local-v1:A');t.w.dispatchEvent(new t.w.StorageEvent('storage',{key:'kja-pausa-local-v1:A'}));
  assert.doesNotMatch(t.text(),/Tiempo restante/);assert.equal(t.intervals.size,0);
});
test('blocked or corrupt storage has explicit in-memory fallback',()=>{
  for(const options of [{blocked:true},{saved:'broken json'},{saved:JSON.stringify({version:3})}]){
    const t=tab(options);t.open();t.start();assert.match(t.text(),/se perderá al recargar/);t.advance(60000);assert.match(t.text(),/09:00/);
  }
});
test('Escape closes and restores focus; Tab remains in dialog',()=>{
  const t=tab();t.open();t.start();const buttons=[...t.w.document.querySelector('#pausa-activa-container').querySelectorAll('button')];
  buttons.at(-1).focus();t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(t.w.document.activeElement,buttons[0]);t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(t.w.document.activeElement.id,'rail-pausa-open');assert.equal(t.intervals.size,0);
});
test('new frontend has no entrypoints, RPC or channels for retired modules',()=>{
  const html=fs.readFileSync('dashboard.html','utf8');
  const files=['dashboard.js','dashboard-admin-cierre.js','dashboard-admin-seguimiento.js'].map(p=>fs.readFileSync('assets/js/'+p,'utf8')).join('\n');
  assert.doesNotMatch(html+files,/KJAChat|KJA_PAUSAS|review-notification|admin-message-|admin-pausas|dash_mis_notificaciones|dash_admin_enviar_mensaje/);
  assert.match(files,/dash_admin_revisar_entrega/);assert.match(files,/dash_admin_asignar_entregable/);
});
