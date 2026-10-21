import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const loader=source.slice(source.indexOf('async function loadAdminHub(){'),source.indexOf('function renderAdminHubSnapshot('));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const names=['asis_colaboradores','asis_registros','dash_admin_cierres','asis_solicitudes_horario','dash_admin_solicitudes_agrupadas','dash_admin_control_diario','photos'];
 const gates=Object.fromEntries(names.map(name=>[name,deferred()])),calls=[],renders=[],notices=[],timers=new Map(),elements=new Map();let timerId=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{disabled:false,innerHTML:''});return elements.get(id);};
 const query=name=>{calls.push(name);return gates[name].promise;};
 const context={APP:{sessionUid:'first',access:{rol:'direccion',acceso_panel:true}},$:el,isoLima:()=> '2026-10-21',
  db:{from(name){const builder={select(){return builder},eq(){return builder},order(){return builder},then(ok,bad){return query(name).then(ok,bad)}};return builder;},rpc:name=>query(name)},
  renderAdminHubSnapshot:s=>renders.push(JSON.parse(JSON.stringify(s))),hydrateProfilePhotos:()=>query('photos'),toast:text=>notices.push(text),
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(loader,context);
 const core=()=>{gates.asis_colaboradores.resolve({data:[{id:1,nombre:'Prueba',foto_path:''}],error:null});gates.asis_registros.resolve({data:[],error:null});gates.dash_admin_cierres.resolve({data:{ok:true,personas:[]},error:null});};
 return {context,gates,calls,renders,notices,timers,el,core};
}

test('overview paints after three core queries without waiting for requests, review or photos; duplicate loads share work',async()=>{
 const h=setup(),first=h.context.loadAdminHub(),second=h.context.loadAdminHub();
 await tick();assert.equal(h.calls.length,3);assert.equal(h.renders.length,0);
 h.core();assert.equal(await first,true);assert.equal(await second,true);await tick();
 assert.ok(h.renders.length>=1);
 assert.equal(h.renders[0].personalRequestsRes.pending,true);
 assert.equal(h.renders[0].controlRes.pending,true);
 assert.equal(h.el('admin-refresh').disabled,false);
 assert.equal(h.calls.filter(name=>name==='dash_admin_cierres').length,1);
 assert.ok(!h.calls.some(name=>['dash_admin_mes','dash_admin_equipo','dash_admin_roles'].includes(name)));
});

test('requests appear independently even if evidence review and profile photos are still pending',async()=>{
 const h=setup(),loading=h.context.loadAdminHub();h.core();await loading;await tick();
 const before=h.renders.length;
 h.gates.dash_admin_solicitudes_agrupadas.resolve({data:{ok:true,solicitudes:[{id:7}]},error:null});await tick();
 assert.equal(h.renders.length,before+1);
 assert.equal(h.renders.at(-1).personalRequestsRes.data.solicitudes[0].id,7);
 assert.equal(h.renders.at(-1).controlRes.pending,true);
});

test('late results cannot repaint the overview after the signed-in account changes',async()=>{
 const h=setup(),loading=h.context.loadAdminHub();h.core();await loading;await tick();
 const count=h.renders.length;h.context.APP.sessionUid='other';
 h.gates.dash_admin_control_diario.resolve({data:{ok:true,filas:[]},error:null});
 h.gates.photos.resolve([{id:9}]);await tick();assert.equal(h.renders.length,count);
});

test('core errors end loading, reenable refresh and do not launch secondary queries',async()=>{
 const h=setup(),loading=h.context.loadAdminHub();
 h.gates.asis_colaboradores.resolve({error:{message:'Failed'},data:null});
 h.gates.asis_registros.resolve({data:[]});h.gates.dash_admin_cierres.resolve({data:{ok:true}});
 assert.equal(await loading,false);assert.equal(h.el('admin-refresh').disabled,false);
 assert.equal(h.renders.length,0);assert.equal(h.calls.length,3);assert.match(h.notices[0],/administración/);
});

test('a stalled core request has a bounded wait and leaves a usable retry action',async()=>{
 const h=setup(),loading=h.context.loadAdminHub();await tick();
 for(const timer of [...h.timers.values()]){assert.equal(timer.ms,12000);timer.fn();}
 assert.equal(await loading,false);assert.equal(h.el('admin-refresh').disabled,false);
 assert.equal(h.context.APP.adminHubLoad,null);
});

test('a synchronous client error does not leave a stuck refresh or unresolved request',async()=>{
 const h=setup();h.context.db.from=()=>{throw new Error('Client failed');};
 assert.equal(await h.context.loadAdminHub(),false);
 assert.equal(h.el('admin-refresh').disabled,false);assert.equal(h.context.APP.adminHubLoad,null);
});

test('partial overview labels pending checks and does not invent clear contracts or evidence',()=>{
 const dom=new JSDOM(fs.readFileSync('dashboard.html','utf8'));
 try{
  const context={APP:{access:{rol:'direccion'}},$:id=>dom.window.document.getElementById(id),cap:s=>s,esc:s=>s,
   renderAdminOverviewCharts(){},groupAdminLeaveRequests:()=>[],renderAdminRequestGroup:()=>'',syncAdminLeaveReview(){}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function renderAdminHubSnapshot('),source.indexOf('function adminListMsg(')),context);
  const unavailable={data:null,error:null};
  context.renderAdminHubSnapshot({today:'2026-10-21',peopleRes:{data:[]},marksRes:{data:[]},closesRes:{data:{ok:true,personas:[]}},
   legacyRequestsRes:{data:[],pending:true},personalRequestsRes:{data:null,pending:true},controlRes:{data:null,pending:true},teamRes:unavailable,monthRes:unavailable,rolesRes:unavailable});
  assert.match(context.$('admin-overview-headline').textContent,/Cargando revisión/);
  assert.match(context.$('admin-status-list').textContent,/sigue cargando/);
  assert.doesNotMatch(context.$('admin-status-list').textContent,/Todo bajo control/);
  assert.match(context.$('admin-request-list').textContent,/Cargando solicitudes/);
  assert.equal(context.$('admin-overview-contract-value').textContent,'Consultar');
 }finally{dom.window.close();}
});
