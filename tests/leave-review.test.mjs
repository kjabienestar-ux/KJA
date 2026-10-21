import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('inbox groups a submission, retains resolved dates and separates people and batches',()=>{
 const source=fs.readFileSync('assets/js/dashboard-leave-review.js','utf8');
 const context={};vm.createContext(context);
 vm.runInContext(source.slice(0,source.indexOf("$('admin-request-list').onclick")),context);
 const item=(id,group,person=1,state='pendiente')=>({id,tipo:'dia_libre',solicitud_grupo:group,colaborador_id:person,estado:state});
 const groups=context.groupAdminLeaveRequests([item(1,'a'),item(2,'a'),item(3,'a',1,'aprobada'),item(4,'b'),item(5,'a',2),item(6,'c',1,'rechazada'),{id:7,tipo:'justificacion',estado:'pendiente'}]);
 assert.equal(groups.length,4);
 assert.equal(groups[0].items.length,3);
 assert.equal(groups[0].items.filter(item=>item.estado==='pendiente').length,2);
 assert.equal(groups[1].items[0].id,4);assert.equal(groups[2].items[0].id,5);
});

function decisionContext(reply){
 const source=fs.readFileSync('assets/js/dashboard.js','utf8');
 const controls=[{disabled:false},{disabled:false}],notices=[],updates=[],calls=[];
 const row={querySelector:()=>({value:' Respuesta de prueba '}),querySelectorAll:()=>controls};
 const context={APP:{access:{rol:'direccion'}},CSS:{escape:String},document:{querySelector:()=>row},
  db:{rpc:async(name,args)=>{calls.push({name,args});return reply;}},
  toast:(text,bad)=>notices.push({text,bad}),updateAdminLeaveDecision:(...args)=>updates.push(args),loadAdminHub:async()=>{}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function adminPersonalRequestErrorMessage('),source.indexOf('async function saveAdminState(')),context);
 return {context,controls,notices,updates,calls};
}

test('failed leave decisions preserve server error codes, do not resolve locally and allow retry',async()=>{
 for(const [error,expected] of [
  [{code:'PGRST202',message:'missing RPC'},/migraciones/],
  [{code:'42501',message:'permission denied'},/permiso de Dirección/],
  [{code:'PGRST301',message:'expired JWT'},/iniciar sesión/],
  [{code:'42703',message:'column "required_field" does not exist'},/42703.*required_field/],
  [{code:'P0001',message:'dia_libre_fecha_vencida'},/configuración de aprobaciones/],
  [{code:'P0001',message:'dia_no_permitido'},/configuración de aprobaciones/],
  [{code:'P0001',message:'no_laborable'},/configuración de aprobaciones/],
  [{code:'P0001',message:'contraoferta_pendiente'},/responder/],
  [{code:'P0001',message:'duplicada'},/otra solicitud/],
  [{code:'P0001',message:'saldo_dias_libres_insuficiente'},/suficientes días libres/]
 ]){
  const h=decisionContext({error,data:null});
  await h.context.resolveAdminPersonalRequest(12,true);
  assert.match(h.notices[0].text,expected);
  assert.equal(h.notices[0].bad,true);
  assert.equal(h.updates.length,0);
  assert.ok(h.controls.every(control=>!control.disabled));
 }
});

test('business denial explains concurrent resolution and keeps pending state',async()=>{
 const h=decisionContext({data:{ok:false,motivo:'no_existe'},error:null});
 await h.context.resolveAdminPersonalRequest(12,true);
 assert.match(h.notices[0].text,/ya fue resuelta/);
 assert.equal(h.updates.length,0);
 assert.ok(h.controls.every(control=>!control.disabled));
});

test('leave decisions update local state only after server confirmation',async()=>{
 const h=decisionContext({data:{ok:true},error:null});
 await h.context.resolveAdminPersonalRequest(12,true);
 assert.equal(h.calls[0].name,'dash_admin_resolver_solicitud');
 assert.equal(h.calls[0].args.p_id,12);
 assert.equal(h.calls[0].args.p_respuesta,'Respuesta de prueba');
 assert.equal(h.updates.length,1);
 assert.match(h.notices[0].text,/aprobado/);
});
