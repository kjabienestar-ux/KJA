import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync('assets/js/dashboard-month-day-detail.js','utf8');
const source=js.slice(js.indexOf('  async function facebookRequest('),js.indexOf('  function mount('));
function fixture({responses=[{status:200,result:{ok:true}}],session={access_token:'old',user:{id:'admin'}},refreshed={data:{session:{access_token:'new',user:{id:'admin'}}}}}={}){
  const calls=[];let renewals=0;
  const context=vm.createContext({SUPABASE_URL:'https://example.test',SUPABASE_ANON:'public',
    db:{auth:{getSession:async()=>({data:{session}}),refreshSession:async()=>{renewals++;return refreshed;}}},
    fetch:async(url,options)=>{calls.push(options);const r=responses.shift();if(!r)assert.fail('Unexpected retry');return {status:r.status,ok:r.status>=200&&r.status<300,json:async()=>r.result};}});
  vm.runInContext(source,context);
  return {request:context.facebookRequest,calls,renewals:()=>renewals};
}
const body={accion:'admin_eliminar_evidencia',entrega:42,path:'rpe.jpg'};

test('valid session sends one request without renewing',async()=>{
  const f=fixture();assert.equal((await f.request(body)).ok,true);assert.equal(f.calls.length,1);assert.equal(f.renewals(),0);
});
test('401 renews once and retries the exact operation with the new token',async()=>{
  const f=fixture({responses:[{status:401,result:{ok:false,motivo:'sesion'}},{status:200,result:{ok:true}}]});
  assert.equal((await f.request(body)).ok,true);assert.equal(f.renewals(),1);
  assert.equal(f.calls[0].headers.Authorization,'Bearer old');assert.equal(f.calls[1].headers.Authorization,'Bearer new');
  assert.equal(f.calls[0].body,f.calls[1].body);assert.deepEqual(JSON.parse(f.calls[1].body),body);
});
test('gateway rejection after successful renewal reports validation failure without looping',async()=>{
  const f=fixture({responses:[{status:401,result:{message:'Invalid JWT'}},{status:401,result:{message:'Invalid JWT'}}]});
  await assert.rejects(f.request(body),/validacion_sesion/);assert.equal(f.calls.length,2);assert.equal(f.renewals(),1);
});
test('permissions, missing migration, and partial deletions never trigger automatic retry',async()=>{
  for(const [status,motivo,retirada] of [[403,'sin_permiso',false],[400,'migracion_evidencias',false],[503,'limpieza_pendiente',true],[401,'limpieza_pendiente',true]]){
    const f=fixture({responses:[{status,result:{ok:false,motivo,retirada}}]});
    await assert.rejects(f.request(body),new RegExp(motivo));assert.equal(f.calls.length,1);assert.equal(f.renewals(),0);
  }
});
test('missing or revoked session cannot send the mutation',async()=>{
  const missing=fixture({session:null});await assert.rejects(missing.request(body),/sesion/);assert.equal(missing.calls.length,0);
  const revoked=fixture({responses:[{status:401,result:{motivo:'sesion'}}],refreshed:{error:{status:400}}});
  await assert.rejects(revoked.request(body),/sesion/);assert.equal(revoked.calls.length,1);
});
test('temporary renewal failure does not claim that the session expired',async()=>{
  const f=fixture({responses:[{status:401,result:{motivo:'sesion'}}],refreshed:{error:{status:503}}});
  await assert.rejects(f.request(body),/conexion/);assert.equal(f.calls.length,1);
});
test('switching accounts during renewal cannot replay a pending deletion',async()=>{
  const f=fixture({responses:[{status:401,result:{motivo:'sesion'}}],refreshed:{data:{session:{access_token:'new',user:{id:'another'}}}}});
  await assert.rejects(f.request(body),/cuenta_cambiada/);assert.equal(f.calls.length,1);
});
