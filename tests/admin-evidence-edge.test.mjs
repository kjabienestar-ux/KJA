import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('supabase/functions/dash-entrega/index.ts','utf8');
const branch=source.slice(source.indexOf('    if (body.accion === "eliminar_imagen_facebook"'),source.indexOf('    if (body.accion === "eliminar_asignacion"'));
async function run({body={accion:'admin_eliminar_evidencia',entrega:11,path:'client.jpg'},data={ok:true,paths:['authorized.jpg']},error=null,storageError=null,queueError=null}={}){
  const calls=[];
  const queue={delete(){return this;},eq(key,value){calls.push(['filter',key,value]);return this;},async in(key,value){calls.push(['queue',key,value]);return {error:queueError};}};
  const ctx=vm.createContext({body,BUCKET:'asis-cierre-evidencias',json:(data,status=200)=>({data,status}),
    usuario:{rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data,error};}},
    servicio:{storage:{from:bucket=>({remove:async paths=>{calls.push(['remove',bucket,paths]);return {error:storageError};}})},from:table=>{calls.push(['table',table]);return queue;}}});
  const result=await vm.runInContext('(async()=>{'+branch+'})()',ctx);
  return {result,calls};
}
test('edge deletes only SQL-authorized paths and clears the evidence queue',async()=>{
  const {result,calls}=await run();assert.equal(result.data.ok,true);
  assert.equal(calls[0][1],'dash_admin_retirar_evidencia');assert.equal(calls[0][2].p_entrega,11);
  assert.deepEqual(calls.find(c=>c[0]==='remove').slice(1),['asis-cierre-evidencias',['authorized.jpg']]);
  assert.equal(calls.find(c=>c[0]==='table')[1],'asis_evidencias_archivos_borrar');
});
test('edge rejects invalid ids, denied permissions and missing migration before touching storage',async()=>{
  for(const options of [{body:{accion:'admin_eliminar_evidencia',entrega:-1,path:'x'}},{data:{ok:false,motivo:'sin_permiso'}},{error:{code:'PGRST202'}}]){
    const {result,calls}=await run(options);assert.equal(result.data.ok,false);assert.ok(!calls.some(c=>c[0]==='remove'));
  }
  assert.equal((await run({error:{code:'PGRST202'}})).result.data.motivo,'migracion_evidencias');
});
test('edge preserves retry semantics when Storage or queue cleanup fails',async()=>{
  for(const options of [{storageError:{message:'offline'}},{queueError:{message:'offline'}}]){
    const {result}=await run(options);assert.equal(result.status,503);assert.equal(result.data.retirada,true);assert.equal(result.data.motivo,'limpieza_pendiente');
  }
});
