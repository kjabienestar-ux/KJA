import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function reviewNotificationScope('),source.indexOf('\nfunction closeReviewNotifications('));
function harness(){
  const calls=[];
  const env={APP:{sessionUid:'A',inicio:{colaborador:{id:1}},access:{rol:'miembro'},identity:{hasPersonal:true},notifications:{request:0,loading:false,deletingId:null,items:[]}},
    db:{rpc(name,args){return new Promise((resolve,reject)=>calls.push({name,args,resolve,reject}))}},
    renderReviewNotifications(){},announceFreshNotifications(){},toast(){}};
  vm.runInNewContext(code,env);
  return {env,calls,load:opts=>env.loadReviewNotifications(opts)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=id=>({data:{ok:true,no_leidas:1,notificaciones:[{id}]}});

test('concurrent refreshes share one read and preserve its result',async()=>{
  const h=harness(),a=h.load(),b=h.load({quiet:true});
  assert.equal(a,b);await tick();assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].name,'dash_mis_notificaciones_revision');
  h.calls[0].resolve(response(1));await a;
  assert.equal(h.env.APP.notifications.items[0].id,1);
  assert.equal(h.env.APP.notificationReadRequest,null);
});
test('events during a read coalesce into a subsequent read for fresh data',async()=>{
  const h=harness(),a=h.load();await tick();
  h.load({refresh:true});h.load({refresh:true});
  h.calls[0].resolve(response(1));await tick();
  assert.equal(h.calls.length,2);
  h.calls[1].resolve(response(2));await a;
  assert.equal(h.env.APP.notifications.items[0].id,2);
});
test('late responses cannot replace data after changing account or scope',async()=>{
  for(const change of [env=>env.APP.sessionUid='B',env=>env.APP.access.rol='direccion',env=>env.APP.inicio.colaborador.id=2,env=>env.APP.inicio.colaborador.area_id=3]){
    const h=harness(),a=h.load();await tick();change(h.env);
    const b=h.load();await tick();assert.equal(h.calls.length,2);
    h.calls[1].resolve(response(2));await b;
    h.calls[0].resolve(response(1));await a;
    assert.equal(h.env.APP.notifications.items[0].id,2);
  }
});
test('failed transport releases the read so retry can succeed',async()=>{
  const h=harness(),a=h.load({quiet:true});await tick();h.calls[0].reject(Error('offline'));await a;
  assert.equal(h.env.APP.notifications.loading,false);
  assert.equal(h.env.APP.notificationReadRequest,null);
  const b=h.load();await tick();h.calls[1].resolve(response(2));await b;
  assert.equal(h.env.APP.notifications.items[0].id,2);
});
test('invalidating a read prevents a late response from restoring removed items',async()=>{
  const h=harness(),a=h.load();await tick();
  h.env.APP.notificationReadRequest=null;
  h.env.APP.notifications={request:2,loading:false,deletingId:null,items:[]};
  h.calls[0].resolve(response(1));assert.equal(await a,null);
  assert.equal(h.env.APP.notifications.items.length,0);
});
test('no reads while a notification write is pending or access is absent',async()=>{
  const h=harness();h.env.APP.notifications.loading=true;await h.load();
  h.env.APP.notifications.loading=false;h.env.APP.notifications.deletingId=2;await h.load();
  h.env.APP.notifications.deletingId=null;h.env.APP.identity.hasPersonal=false;await h.load();
  assert.equal(h.calls.length,0);
});
