import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-pausa-activa.js','utf8');
function selection(done=false){
  let flipped=false;
  const front={setAttribute(k,v){this[k]=v},focus(){this.focused=true}},start={focus(){this.focused=true}},back={inert:true,querySelector:()=>start};
  const card={classList:{toggle(){flipped=!flipped;return flipped}},querySelector:s=>s==='.pausa-card-front'?front:s==='.pausa-card-back'?back:start};
  const close={},container={querySelector:s=>s==='#pausa-btn-close-modal'?close:card};
  const c={getModalContainer:()=>container,BREAKS:[{id:'visual',duration:600,title:'Descanso visual',zones:'Cuello'}],completedBreaks:new Set(done?['visual']:[]),closeModal(){},startSession(){c.started=true}};
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  function renderSelectionView()'),source.indexOf('  function startSession(')),c);c.renderSelectionView();
  return {c,container,front,back,start,card};
}
test('keyboard reveals exercises and makes only the visible face interactive',()=>{
  const h=selection();h.front.onkeydown({key:'Enter',preventDefault(){}});
  assert.equal(h.front.inert,true);assert.equal(h.back.inert,false);assert.equal(h.front['aria-expanded'],'true');assert.equal(h.start.focused,true);
  h.card.onclick({target:{closest:()=>null}});
  assert.equal(h.front.inert,false);assert.equal(h.back.inert,true);assert.equal(h.front.focused,true);
  h.start.onclick({stopPropagation(){}});assert.equal(h.c.started,true);
});
test('completed breaks remain unavailable in the refreshed selection',()=>{
  const h=selection(true);assert.match(h.container.innerHTML,/is-completed/);assert.match(h.container.innerHTML,/data-start-break="visual" disabled/);
  assert.equal(h.card.onclick,undefined);assert.equal(h.start.onclick,undefined);assert.match(h.container.innerHTML,/id="pausa-activa-title"/);
});
