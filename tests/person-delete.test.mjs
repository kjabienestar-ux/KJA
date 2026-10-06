import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('inactive deletion validates permissions, protects active/admin accounts and rolls back dependencies',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
   create table permission(allowed boolean);insert into permission values(true);
   create function asis_puede_editar() returns boolean language sql as $$select allowed from permission$$;
   create function dash_sesion_vigente() returns boolean language sql as $$select true$$;
   create table asis_colaboradores(id bigint primary key,nombre text,activo boolean);
   create table asis_perfiles(id uuid primary key,colaborador_id bigint references asis_colaboradores on delete set null,activo boolean,acceso_panel boolean);
   create table dash_sesiones(perfil_id uuid,revocada_at timestamptz);
   create table asis_registros(id bigint primary key,colaborador_id bigint references asis_colaboradores on delete cascade);
   create table asis_correcciones_modalidad(colaborador_id bigint references asis_colaboradores);
   create table asis_facebook_archivos_borrar(colaborador_id bigint references asis_colaboradores);
   create table unexpected(colaborador_id bigint references asis_colaboradores);
   insert into asis_colaboradores values(1,'Baja',false),(2,'Activo',true),(3,'Admin',false),(4,'Pendiente',false),(5,'Bloqueado',false);
   insert into asis_perfiles values('00000000-0000-0000-0000-000000000002',1,true,false),('00000000-0000-0000-0000-000000000003',3,true,true),('00000000-0000-0000-0000-000000000005',5,true,false);
   insert into dash_sesiones values('00000000-0000-0000-0000-000000000002',null);
   insert into asis_registros values(1,1),(2,2);
   insert into asis_correcciones_modalidad values(1),(5);
   insert into asis_facebook_archivos_borrar values(4);
   insert into unexpected values(5);`);
  const sql=fs.readFileSync('supabase/dashboard_99_eliminar_colaboradores_baja.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  const del=async(id,name)=>(await db.query('select dash_admin_eliminar_colaborador($1,$2) result',[id,name])).rows[0].result;
  assert.equal((await del(2,'Activo')).motivo,'activo');
  assert.equal((await del(3,'Admin')).motivo,'cuenta_admin');
  assert.equal((await del(4,'Pendiente')).motivo,'archivos_pendientes');
  assert.equal((await del(1,'Otro')).motivo,'confirmacion');
  await db.exec('update permission set allowed=false');
  assert.equal((await del(1,'Baja')).motivo,'sin_permiso');
  await db.exec('update permission set allowed=true');
  assert.equal((await del(5,'Bloqueado')).motivo,'referencias');
  assert.equal((await db.query('select activo from asis_perfiles where colaborador_id=5')).rows[0].activo,true);
  assert.equal((await db.query('select count(*)::int n from asis_correcciones_modalidad where colaborador_id=5')).rows[0].n,1);
  assert.equal((await del(1,'Baja')).ok,true);
  assert.equal((await db.query('select count(*)::int n from asis_registros')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from dash_sesiones where revocada_at is not null')).rows[0].n,1);
  const profile=(await db.query("select activo,colaborador_id from asis_perfiles where id='00000000-0000-0000-0000-000000000002'")).rows[0];
  assert.deepEqual(profile,{activo:false,colaborador_id:null});
  assert.equal((await del(1,'Baja')).motivo,'no_existe');
  assert.equal((await db.query("select has_function_privilege('anon','dash_admin_eliminar_colaborador(bigint,text)','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('client requires confirmation and inactive person; failures restore button; success refreshes directory',async()=>{
 let confirmed=false,calls=0,refreshes=0,fail=false;
 const button={textContent:'Eliminar definitivamente',disabled:false};
 const context=vm.createContext({APP:{adminTeam:{puede_editar:true,personas:[{id:1,nombre:'Baja',activo:false},{id:2,nombre:'Activo',activo:true}]}},
  $:()=>({addEventListener(){}}),confirm:()=>confirmed,alert(){},toast(){},
  db:{rpc:async()=>{calls++;if(fail)throw Error('network');return {data:{ok:true}};}},
  fillAdminTeamFilters(){refreshes++;},renderAdminPeople(){},renderAdminContracts(){}});
 vm.runInContext(fs.readFileSync('assets/js/dashboard-person-delete.js','utf8'),context);
 await context.deleteAdminInactivePerson(1,button);assert.equal(calls,0);
 confirmed=true;await context.deleteAdminInactivePerson(2,button);assert.equal(calls,0);
 fail=true;await context.deleteAdminInactivePerson(1,button);assert.equal(button.disabled,false);assert.equal(context.APP.adminTeam.personas.length,2);
 fail=false;await context.deleteAdminInactivePerson(1,button);assert.equal(refreshes,1);assert.equal(context.APP.adminTeam.personas.length,1);
 assert.equal(context.APP.adminTeam.personas[0].id,2);
});
