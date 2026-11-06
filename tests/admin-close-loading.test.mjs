import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard-admin-cierre.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('let ADMIN_CLOSE_REQUEST='),source.indexOf('\nfunction adminReviewStateLabel('));
const tick=()=>new Promise(r=>setImmediate(r));
const close=id=>({data:{ok:true,id,personas:[],asignaciones:[{id:7}]}});
const review=()=>({data:{ok:true,entregas:[{requisito:'asignado',asignacion_id:7},{requisito:'asignado',asignacion_id:8}]}});
function harness(role='direccion',photos=async p=>p){
 const calls=[],messages=[],renders=[],nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='admin-close-date'?'2026-11-06':'',disabled:false,innerHTML:'',setAttribute(){},removeAttribute(){},querySelector(){return this}});return nodes.get(id)};
 const env={APP:{sessionUid:'A',access:{acceso_panel:true,rol:role},inicio:{colaborador:{id:1,area_id:1}}},$:node,isoLima:()=> '2026-11-06',adminCloseMsg:(...m)=>messages.push(m),
 db:{rpc:(name,args)=>new Promise((resolve,reject)=>calls.push({name,args,resolve,reject}))},
 hydrateAdminCloseControls(){},renderAdminCloseAssignments(){},renderAdminReviewSummary(){},renderAdminCloseStatus(){renders.push(env.APP.adminClose?.id)},hydrateProfilePhotos:photos};
 vm.runInNewContext(code,env);
 const settle=(offset,id)=>{calls[offset].resolve(close(id));if(calls[offset+1]?.name==='dash_admin_revision_entregas')calls[offset+1].resolve(review())};
 return {env,calls,nodes,node,messages,renders,settle,load:opts=>env.loadAdminCloses(opts)};
}
test('twelve coincident requests share one pair of reads and preserve assignment filtering',async()=>{
 const h=harness(),reads=Array.from({length:12},()=>h.load({quiet:true}));await tick();
 assert.equal(h.calls.length,2);assert.ok(reads.every(p=>p===reads[0]));
 h.settle(0,1);assert.equal(await reads[0],true);
 assert.equal(h.env.APP.adminReview.entregas.length,1);
 assert.equal(h.env.APP.adminReview.entregas[0].asignacion_id,7);
 assert.equal(h.node('admin-close-assignments-refresh').disabled,false);
});
test('refresh after a write ignores pre-write result and waits for a subsequent read',async()=>{
 const h=harness(),a=h.load();await tick();
 const b=h.load({quiet:true,refresh:true});h.load({quiet:true,refresh:true});
 h.settle(0,'old');await tick();
 assert.equal(h.calls.length,4);assert.equal(h.renders.length,0);
 h.settle(2,'new');assert.equal(await b,true);await a;
 assert.equal(h.env.APP.adminClose.id,'new');
});
test('late responses for another date, account, role or area cannot replace current data',async()=>{
 for(const change of [h=>h.node('admin-close-date').value='2026-11-07',h=>h.env.APP.sessionUid='B',h=>h.env.APP.access.rol='sistemas',h=>h.env.APP.inicio.colaborador.area_id=2]){
   const h=harness(),a=h.load();await tick();change(h);
   const b=h.load();await tick();h.settle(2,'new');await b;
   h.settle(0,'old');assert.equal(await a,false);
   assert.equal(h.env.APP.adminClose.id,'new');
 }
});
test('transport failure keeps the shared flight until the companion read settles',async()=>{
 const h=harness(),a=h.load();await tick();h.calls[0].reject(Error('offline'));await tick();
 assert.equal(h.load(),a);assert.equal(h.calls.length,2);
 h.calls[1].resolve(review());assert.equal(await a,false);
 assert.equal(h.node('admin-close-assignments-refresh').disabled,false);
 const b=h.load();await tick();h.settle(2,'recovered');assert.equal(await b,true);
});
test('review failure does not lose a valid primary response',async()=>{
 const h=harness(),a=h.load();await tick();h.calls[0].resolve(close(1));h.calls[1].reject(Error('offline'));
 assert.equal(await a,true);assert.equal(h.env.APP.adminClose.id,1);
 assert.equal(h.env.APP.adminReview.entregas.length,0);
});
test('a later photo response cannot overwrite another date',async()=>{
 let release;const h=harness('direccion',p=>new Promise(r=>{release=()=>r(p)})),a=h.load();await tick();h.settle(0,'old');await tick();
 h.node('admin-close-date').value='2026-11-07';release();assert.equal(await a,false);
 assert.equal(h.renders.length,1);
});
test('panel without access sends nothing and a non-Direction role never requests reviews',async()=>{
 const h=harness('sistemas');h.env.APP.access.acceso_panel=false;assert.equal(await h.load(),false);assert.equal(h.calls.length,0);
 h.env.APP.access.acceso_panel=true;const a=h.load();await tick();assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'dash_admin_cierres');
 h.calls[0].resolve(close(1));assert.equal(await a,true);
});
test('loss of access while waiting discards both data and renders',async()=>{
 const h=harness(),a=h.load();await tick();h.env.APP.access.acceso_panel=false;h.settle(0,1);assert.equal(await a,false);
 assert.equal(h.env.APP.adminClose,undefined);assert.equal(h.renders.length,0);
});
