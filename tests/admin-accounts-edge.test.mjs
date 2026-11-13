import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/admin-cuentas/handler.mjs';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
function fixture(){
 const state={valid:true,allowed:true,existing:{ok:true,existe:false},calls:[],updates:[],creates:[],failSave:false,passwordError:false,proofId:id(1),proofSignouts:0};
 const token=sid=>`e30.${btoa(JSON.stringify({session_id:sid}))}.signature`;
 const user={auth:{getUser:async()=>({data:{user:state.valid?{id:id(1),email:'actor@example.test'}:null}})},rpc:async()=>({data:state.allowed})};
 const admin={rpc:async(name,args)=>{
  state.calls.push({name,args});if(name==='dash_admin_buscar_identidad')return {data:state.existing};
  if(state.failSave&&args.p_accion==='crear')return {error:{message:'Profile failed'}};
  return {data:{ok:true}};
 },auth:{admin:{createUser:async data=>{state.creates.push(data);return {data:{user:{id:id(3)}}};},updateUserById:async(id,data)=>{state.updates.push({id,data});return {error:state.passwordError?{message:'weak'}:null};}}}};
 const proof={auth:{signInWithPassword:async()=>({data:{user:{id:state.proofId},session:{access_token:token(id(301))}}}),signOut:async()=>{state.proofSignouts++;return {};}}};
 const handler=createHandler({env:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'server':key==='SUPABASE_ANON_KEY'?'public':'https://example.test',createClient:(url,key,options)=>key==='server'?admin:options.global?user:proof});
 const request=async(body,method='POST')=>{
  const r=await handler(new Request('https://example.test',{method,headers:{Authorization:'Bearer '+token(id(101))},body:method==='POST'?JSON.stringify({operation:id(800),motivo:'Solicitud del titular',...body}):undefined}));
  return {status:r.status,data:await r.json()};
 };
 return {state,request};
}
test('denies unauthenticated and non-designated managers before using service APIs',async()=>{
 const {state,request}=fixture();state.valid=false;assert.equal((await request({action:'restablecer',id:id(3),password:'Strong private password'})).status,401);
 state.valid=true;state.allowed=false;assert.equal((await request({action:'crear'})).status,403);assert.equal(state.calls.length,0);
 assert.equal((await request({},'GET')).status,405);
});
test('password reset reserves authority, updates only the target and finalizes without sending secrets to SQL',async()=>{
 const {state,request}=fixture();const password='Strong private password';
 assert.equal((await request({action:'restablecer',id:id(3),password})).status,200);
 assert.equal(state.updates.length,1);assert.equal(state.updates[0].id,id(3));
 assert.deepEqual(state.calls.map(c=>c.args.p_accion),['restablecer','clave_fin']);assert.doesNotMatch(JSON.stringify(state.calls),/Strong private|password/);
 assert.equal(state.calls[1].args.p_datos.resultado,'completada');
 state.passwordError=true;await request({action:'restablecer',id:id(3),password});assert.equal(state.calls.at(-1).args.p_datos.resultado,'fallida');
 const self=await request({action:'restablecer',id:id(1),password});assert.equal(self.status,400);
});
test('existing identities require explicit UUID confirmation and keep their password',async()=>{
 const {state,request}=fixture();state.existing={ok:true,existe:true,id:id(3),confirmada:true,tiene_perfil:false,tecnica:false};
 const body={action:'crear',nombre:'New Admin',email:'new@example.test',rol:'visor',password:'unused private password'};
 assert.equal((await request(body)).status,409);assert.equal(state.creates.length,0);
 assert.equal((await request({...body,confirm_existing:id(3)})).status,200);assert.equal(state.updates.length,0);assert.equal(state.creates.length,0);
 state.existing.tiene_perfil=true;assert.equal((await request({...body,confirm_existing:id(3)})).status,409);
});
test('partial creation reports the surviving identity and never deletes it',async()=>{
 const {state,request}=fixture();state.failSave=true;
 const result=await request({action:'crear',nombre:'New Admin',email:'new@example.test',rol:'visor',password:'Strong private password'});
 assert.equal(result.status,409);assert.match(result.data.error,/identidad existe/);assert.equal(state.creates.length,1);
 assert.doesNotMatch(JSON.stringify(state.calls),/Strong private/);
});
test('delegation reauthenticates the actor, rejects another identity and cleans the proof session',async()=>{
 const {state,request}=fixture();state.proofId=id(2);
 assert.equal((await request({action:'delegar',id:id(3),current_password:'Current private password'})).status,403);assert.equal(state.proofSignouts,1);
 state.proofId=id(1);assert.equal((await request({action:'delegar',id:id(3),current_password:'Current private password'})).status,200);
 const args=state.calls.at(-1).args;assert.equal(args.p_actor,id(1));assert.equal(args.p_sesion,id(101));assert.equal(args.p_datos.sesion_prueba,id(301));assert.doesNotMatch(JSON.stringify(args),/Current private|password/);
});
test('validates password byte length, rejects missing reasons and ignores client actor fields',async()=>{
 const {state,request}=fixture();assert.equal((await request({action:'restablecer',id:id(3),password:'é'.repeat(40)})).status,400);
 assert.equal((await request({action:'suspender',id:id(3),motivo:''})).status,400);
 await request({action:'suspender',id:id(3),actor:id(2),session:id(102)});assert.equal(state.calls.at(-1).args.p_actor,id(1));
});
