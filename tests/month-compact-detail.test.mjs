import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const main=fs.readFileSync('assets/js/dashboard.js','utf8');
const source=fs.readFileSync('assets/js/dashboard-month-day-detail.js','utf8');
async function setup({canManageEvidence=false,pendingFile=false,withEvidence=false}={}){
 const dom=new JSDOM('<section id="host"></section>');const host=dom.window.document.getElementById('host'),signs=[];
 dom.window.matchMedia=()=>({matches:false});
 const env=vm.createContext({Intl,Date});vm.runInContext(main.slice(main.indexOf('function teamDayActivities('),main.indexOf('\nasync function openTeamDay(')),env);vm.runInContext(source,env);
 let resolveFile;
 const data={ok:true,entrada_at:'2026-10-22T13:04:00Z',estado:'P',entrada_archivos:[{path:'entry.jpg',bucket:'private',mime:'image/jpeg'}],cierre:{requisitos:[{tipo:'rpe',titulo:'RPE',completo:false},{tipo:'salida',titulo:'Salida',completo:false}]},entregas:[]};
 if(withEvidence){data.entregas=[{id:88,tipo:'rpe',archivos:[{bucket:'private',path:'rpe.jpg',mime:'image/jpeg'}]}];}
 const mounted=env.KJAMonthDayDetail.mount(host,{person:{id:1},day:{fecha:'2026-10-22',laborable:true},compact:true,canManageEvidence,managementHtml:'<button>Acción de jornada</button>',rpc:async()=>({data}),storage:{from:()=>({createSignedUrl:(path)=>{signs.push(path);return pendingFile?new Promise(resolve=>resolveFile=resolve):Promise.resolve({data:{signedUrl:'https://example.test/mock.jpg'}})}})}});
 await mounted.ready;await Promise.resolve();
 const clickTab=i=>host.onclick({target:host.querySelector('[data-md-tab="'+i+'"]')});
 return {dom,host,mounted,signs,clickTab,resolveFile};
}
test('compact modal exposes one activity, accessible tabs and collapsed management',async()=>{
 const x=await setup();assert.equal(x.host.querySelectorAll('[role=tab]').length,3);assert.equal(x.host.querySelectorAll('[data-md-group]:not([hidden])').length,1);assert.equal(x.host.querySelector('.md-journal-management').open,false);assert.equal(x.host.querySelector('[role=tab][aria-selected=true]').textContent.includes('entrada'),true);x.clickTab(1);assert.equal(x.host.querySelectorAll('[data-md-group]:not([hidden])').length,1);assert.equal(x.host.querySelector('[data-md-group="1"]').hidden,false);assert.equal(x.host.querySelector('[data-md-preview] img'),null);assert.match(x.host.querySelector('[data-md-preview]').textContent,/Todavía no hay evidencia/);x.mounted.dispose();
});
test('switching to an empty activity invalidates an earlier private URL response',async()=>{
 const x=await setup({pendingFile:true});x.clickTab(2);x.resolveFile({data:{signedUrl:'https://example.test/stale-private.jpg'}});await Promise.resolve();await Promise.resolve();assert.equal(x.host.querySelector('[data-md-preview] img'),null);assert.doesNotMatch(x.host.innerHTML,/stale-private/);x.mounted.dispose();
});
test('keyboard selects tabs and readonly compact view has no mutation controls',async()=>{
 const x=await setup();const nav=x.host.querySelector('[role=tablist]'),tab=x.host.querySelector('[role=tab]');nav.onkeydown({key:'End',target:tab,preventDefault(){}});assert.equal(x.host.querySelector('[data-md-tab="2"]').getAttribute('aria-selected'),'true');assert.equal(x.host.querySelector('[data-md-remove]'),null);assert.equal(x.host.querySelector('[data-md-upload]'),null);x.mounted.dispose();
});

test('initial entry and navigated evidence share selection containers with or without removal permissions',async()=>{
 for(const canManageEvidence of [false,true]){
  const x=await setup({canManageEvidence,withEvidence:true});
  const entry=x.host.querySelector('[data-md-group="0"] .md-file');
  assert.ok(entry.closest('.md-file-chip'),'Entry must use the same selectable chip');
  assert.equal(entry.getAttribute('aria-pressed'),'true','Entry selected automatically on initial load');
  assert.equal(entry.closest('.md-file-chip').querySelector('[data-md-remove]'),null);
  const next=x.host.querySelector('.md-file-nav [data-md-file="1:0"]');next.click();await new Promise(resolve=>setImmediate(resolve));
  const rpe=x.host.querySelector('[data-md-group="1"] .md-file');
  assert.ok(rpe.closest('.md-file-chip'));assert.equal(rpe.getAttribute('aria-pressed'),'true');assert.equal(entry.getAttribute('aria-pressed'),'false');
  assert.equal(!!rpe.closest('.md-file-chip').querySelector('[data-md-remove]'),canManageEvidence);
  x.host.querySelector('.md-file-nav [data-md-file="0:0"]').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(entry.getAttribute('aria-pressed'),'true');assert.equal(rpe.getAttribute('aria-pressed'),'false');
  x.mounted.dispose();
 }
});
