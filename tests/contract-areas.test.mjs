import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
function setup(){
 const dom=new JSDOM('<section id="admin-contracts-section"><input id="admin-contract-search"><input id="admin-contract-area"><input type="checkbox" id="admin-contract-inactive"><input type="checkbox" id="admin-contract-pending"><div id="admin-contract-list"></div></section>',{runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:true,addEventListener(){}});w.requestAnimationFrame=cb=>cb();w.eval(fs.readFileSync('assets/js/dashboard-contract-areas.js','utf8'));
 const people=[{id:1,area_id:1,area:'Ingeniería'},{id:2,area_id:1,area:'Ingeniería'},{id:3,area_id:2,area:'Marketing <equipo>'}];
 function render(items=people){d.getElementById('admin-contract-list').innerHTML=items.map(p=>`<article class="admin-contract-row"><button data-team-edit="${p.id}">Editar</button></article>`).join('');w.organizeContractAreas(items);}
 render();return {w,d,render,people};
}
test('all area headers stay visible, contract nodes/actions survive grouping and areas collapse independently',()=>{
 const {w,d}=setup();try{const buttons=d.querySelectorAll('.contract-area-toggle');assert.equal(buttons.length,2);assert.equal(d.querySelectorAll('.contract-area-panel:not([hidden])').length,1);assert.equal(d.querySelector('.contract-area-panel:not([hidden]) [data-team-edit]').dataset.teamEdit,'1');buttons[0].click();assert.equal(d.querySelectorAll('.contract-area-panel:not([hidden])').length,0);buttons[1].click();assert.equal(d.querySelector('.contract-area-panel:not([hidden]) [data-team-edit]').dataset.teamEdit,'3');assert.equal(buttons[1].textContent.includes('Marketing <equipo>'),true);assert.equal(buttons[1].querySelector('equipo'),null);}finally{w.close();}
});
test('refresh retains the collapsed state; search reveals its matching area without removing original permissions',()=>{
 const {w,d,render,people}=setup();try{d.querySelector('.contract-area-toggle').click();render();assert.equal(d.querySelectorAll('.contract-area-panel:not([hidden])').length,0);d.getElementById('admin-contract-search').value='Marketing';render([people[2]]);assert.equal(d.querySelectorAll('.contract-area-toggle').length,1);assert.equal(d.querySelectorAll('.contract-area-panel:not([hidden])').length,1);assert.equal(d.querySelector('[data-team-edit]').dataset.teamEdit,'3');}finally{w.close();}
});
