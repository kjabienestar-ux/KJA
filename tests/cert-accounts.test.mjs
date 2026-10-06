import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('certificate accounts enforce manager role, unique series, last admin and suspended access',async()=>{
 const db=new PGlite();
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table asis_perfiles(id uuid,activo boolean,acceso_panel boolean,rol text,nivel text);
   create function dash_sesion_vigente() returns boolean language sql stable as $$select coalesce(current_setting('test.session',true),'yes')='yes'$$;
   create table perfiles(id uuid primary key references auth.users,nombre text,rol text,serie int);
   create table certificados(id int primary key,creado_por uuid references perfiles(id),nombre text);
   create table clientes(id int primary key,nombre text);
   create table bitacora(id int primary key);
   alter table certificados enable row level security;
   create policy existing_read on certificados for select to authenticated using(true);
   grant select on certificados to authenticated;
   insert into auth.users values('${a}','admin@test.com'),('${b}','writer@test.com'),('${c}','new@test.com');
   insert into asis_perfiles values('${a}',true,true,'direccion','sistemas');
   insert into perfiles values('${a}','Admin','admin',null),('${b}','Writer','colaborador',1000);
   insert into certificados values(1,'${b}','Original');
   select set_config('test.uid','${a}',false);`);
  const migration=fs.readFileSync('supabase/dashboard_100_cuentas_certificados.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const save=(id,name,role,series,active)=>db.query('select dash_cert_guardar($1,$2,$3,$4,$5)',[id,name,role,series,active]);
  assert.equal((await db.query('select dash_cert_cuentas() data')).rows[0].data.cuentas.length,2);
  await assert.rejects(save(c,'New','colaborador',1000,true),/serie ya/);
  await assert.rejects(save(c,'New','colaborador',1500,true),/múltiplo/);
  await assert.rejects(save(b,'Writer','colaborador',2000,true),/emitidos/);
  await assert.rejects(save(a,'Admin','admin',null,false),/propio/);
  await save(c,'New','colaborador',2000,true);
  await db.exec("update asis_perfiles set nivel='lider'");
  await assert.rejects(db.query('select dash_cert_cuentas()'),/Sin permiso/);
  await assert.rejects(save(b,'Writer','admin',1000,true),/Sin permiso/);
  await db.exec("update asis_perfiles set nivel='sistemas';select set_config('test.session','no',false)");
  await assert.rejects(db.query('select dash_cert_cuentas()'),/Sin permiso/);
  await db.exec("select set_config('test.session','yes',false)");
  await save(b,'Writer','colaborador',1000,false);
  assert.equal((await db.query('select count(*)::int n from certificados')).rows[0].n,1);
  await db.exec(`select set_config('test.uid','${b}',false)`);
  assert.equal((await db.query('select cert_es_miembro() allowed')).rows[0].allowed,false);
  await assert.rejects(db.query("update certificados set nombre='Forbidden' where id=1"),/suspendido/);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from certificados')).rows.length,0);
  await assert.rejects(db.query("update perfiles set activo=true"),/permission denied/);
  await db.exec('reset role');
  await db.exec(`insert into asis_perfiles values('${c}',true,true,'direccion','sistemas');select set_config('test.uid','${c}',false)`);
  await assert.rejects(save(a,'Admin','colaborador',3000,true),/al menos un administrador/);
  await save(b,'Writer','colaborador',1000,true);
  await db.exec(`select set_config('test.uid','${b}',false)`);
  assert.equal((await db.query('select cert_es_miembro() allowed')).rows[0].allowed,true);
  assert.equal((await db.query("select has_function_privilege('anon','dash_cert_cuentas()','execute') allowed")).rows[0].allowed,false);
  assert.equal((await db.query('select count(*)::int n from cert_cuentas_eventos')).rows[0].n,3);
 }finally{await db.close();}
});

test('edge verifies identity and manager permission before Auth administration; existing accounts are not reset',async()=>{
 let handler,allowed=false,valid=true,creates=0,saves=0,recoveries=0,lookup=null,profile=null;
 const user={auth:{getUser:async()=>({data:{user:valid?{id:'actor'}:null},error:null}),resetPasswordForEmail:async()=>{recoveries++;return {error:null};}},
 rpc:async(name)=>name==='dash_gestiona_certificados'?{data:allowed}:name==='dash_cert_buscar_email'?{data:lookup}:(saves++,{data:{ok:true}})};
 const admin={auth:{admin:{createUser:async()=>{creates++;return {data:{user:{id:'new'}}};},getUserById:async()=>({data:{user:{email:'a@test.com'}}})}},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile})})})})};
 const source=fs.readFileSync('supabase/functions/cert-cuentas/index.ts','utf8').replace(/^import .*\n/,'').replace('body:unknown','body').replace('req:Request','req').replaceAll(/(get\('[^']+'\))!/g,'$1');
 const context=vm.createContext({Request,Response,createClient:(_url,key)=>key==='service'?admin:user,
 Deno:{env:{get:k=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',CERT_RECOVERY_URL:'https://example.test/recuperar-certificados.html'})[k]},serve:fn=>handler=fn}});
 vm.runInContext(source,context);
 const call=body=>handler(new Request('https://example.test',{method:'POST',body:JSON.stringify(body),headers:{Authorization:'Bearer test'}}));
 const input={action:'create',email:'a@test.com',nombre:'New user',rol:'colaborador',serie:1000,password:'long-password-test'};
 assert.equal((await call(input)).status,403);assert.equal(creates,0);
 valid=false;assert.equal((await call(input)).status,401);valid=true;allowed=true;
 assert.equal((await call({...input,password:'short'})).status,400);
 assert.equal((await call(input)).status,200);assert.equal(creates,1);assert.equal(saves,1);
 lookup='existing';assert.equal((await call({...input,password:''})).status,200);assert.equal(creates,1);assert.equal(saves,2);
 profile={id:'existing',activo:true};assert.equal((await call(input)).status,409);
 assert.equal((await call({action:'recovery',id:'existing'})).status,200);assert.equal(recoveries,1);
 profile.activo=false;assert.equal((await call({action:'recovery',id:'existing'})).status,400);assert.equal(recoveries,1);
});
