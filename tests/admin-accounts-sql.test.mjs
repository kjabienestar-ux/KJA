import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
export const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const migration=fs.readFileSync('supabase/migrations/20261113162057_cuentas_administrativas_kja037.sql','utf8');
export async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),deleted_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now(),not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create table public.asis_areas(id bigint primary key,activo boolean default true);
 create table public.asis_colaboradores(id bigint primary key,activo boolean default true,area_id bigint references asis_areas);
 create table public.asis_perfiles(id uuid primary key references auth.users,nombre text,rol text default 'visor',nivel text default 'miembro',activo boolean default true,acceso_panel boolean default false,colaborador_id bigint unique references asis_colaboradores);
 create table public.perfiles(id uuid primary key references auth.users,nombre text,rol text,activo boolean default true);
 create table public.dash_sesiones(session_id text,perfil_id uuid,vence_at timestamptz,revocada_at timestamptz);
 create table public.marketing_accesos(usuario_id uuid,puede_publicar boolean);
 create table public.marketing_colaboradores_acceso(colaborador_id bigint,area_id bigint);
 create function dash_ranking_mes(p_mes date) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
 create function dash_reporte_facebook(p_desde date,p_hasta date) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
 create function dash_admin_asignaciones_calendario(p_mes date) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
 create function marketing_gestion_accesos() returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
 create function marketing_guardar_accesos(p_area bigint,p_colaboradores bigint[]) returns void language sql as $$select null::void$$;
 create function dash_sesion_vigente() returns boolean language sql stable as $$select true$$;
 create function dash_nivel() returns text language sql stable as $$select 'sistemas'::text$$;
 create function asis_es_miembro() returns boolean language sql stable as $$select true$$;
 create function asis_rol() returns text language sql stable as $$select 'direccion'::text$$;
 create function asis_puede_editar() returns boolean language sql stable as $$select coalesce(public.asis_rol() in ('editor','direccion'),false)$$;
 grant usage on schema public,auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
 grant select,insert,update,delete on asis_perfiles to authenticated;
 insert into asis_colaboradores(id,activo) values(99,true);`);
 // Define this after its dependencies, just as in the existing installation.
 await db.exec(`create function dash_inicio(p_colab bigint default null) returns jsonb language sql stable as $$select jsonb_build_object('ok',public.dash_sesion_vigente(),'perfil',jsonb_build_object('nivel',public.dash_nivel()))$$;`);
 for(let n=1;n<=7;n++){
  await db.query('insert into auth.users(id,email) values($1,$2)',[uid(n),`person${n}@example.test`]);
  await db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,now()-interval \'10 minutes\')',[uid(n+100),uid(n)]);
  if(n<=5)await db.query("insert into asis_perfiles(id,nombre,rol,nivel,acceso_panel,colaborador_id) values($1,$2,'direccion','sistemas',true,$3)",[uid(n),`Person ${n}`,n===5?99:null]);
 }
 await db.exec(migration);
 await db.exec(`begin;insert into kja_admin.puestos values(1,'${uid(1)}'),(2,'${uid(2)}');update kja_admin.config set habilitado=true;commit;`);
 return db;
}
const claims=(n,role='authenticated',sid=n+100)=>({sub:uid(n),role,session_id:uid(sid)});
async function as(db,n,role='authenticated',sid=n+100){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(n,role,sid))]);}
let seq=1000;
async function op(db,actor,action,data={},operation=uid(++seq),sid=actor+100){
 await as(db,actor,'service_role',sid);
 return (await db.query('select dash_admin_cuenta_operar($1,$2,$3,$4,$5) data',[uid(actor),uid(sid),action,{motivo:'Prueba autorizada',...data},operation])).rows[0].data;
}
test('migration, two seats, explicit permission and unprivileged API grants',async()=>{
 const db=await fixture();try{
  for(let n=1;n<=3;n++){await as(db,n);assert.equal((await db.query('select dash_es_superadmin() ok')).rows[0].ok,n<=2);}
  await assert.rejects(db.query('select dash_admin_cuentas()'),/Solo los dos/);
  await as(db,1);assert.equal((await db.query('select dash_admin_cuentas() data')).rows[0].data.cuentas.length,5);
  assert.equal((await db.query("select has_function_privilege('authenticated','dash_admin_cuenta_operar(uuid,uuid,text,jsonb,uuid)','execute') ok")).rows[0].ok,false);
  assert.equal((await db.query("select has_schema_privilege('authenticated','kja_admin','usage') ok")).rows[0].ok,false);
  await assert.rejects(db.exec(`delete from kja_admin.puestos where puesto=2`),/dos superadministradores/);
  await assert.rejects(db.exec(`insert into kja_admin.puestos values(3,'${uid(3)}')`),/check constraint/);
  await assert.rejects(op(db,3,'suspender',{id:uid(4)}),/Solo los dos/);
 }finally{await db.close();}
});
test('suspend, archive typed confirmation, restore and reactivation preserve identities and personal/certificate access',async()=>{
 const db=await fixture();try{
  await db.exec(`insert into perfiles values('${uid(5)}','Shared','colaborador',true)`);
  await assert.rejects(op(db,1,'archivar',{id:uid(5),confirmar_email:'person5@example.test'}),/estado cambió/);
  await op(db,1,'suspender',{id:uid(5)});await as(db,5);
  const state=(await db.query('select asis_es_miembro() panel,dash_nivel() nivel,rec_es_admin() recruitment,dash_zoom_gestiona() zoom,dash_gestiona_certificados() manages,cert_es_miembro() cert')).rows[0];
  assert.equal(state.panel,false);assert.equal(state.nivel,null);assert.equal(state.recruitment,false);assert.equal(state.zoom,false);assert.equal(state.manages,false);
  // New personal/certificate sessions remain possible after suspension.
  await db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,clock_timestamp()+interval \'1 second\')',[uid(205),uid(5)]);await as(db,5,'authenticated',205);
  assert.equal((await db.query('select cert_es_miembro() cert,dash_sesion_vigente() personal')).rows[0].cert,true);
  assert.equal((await db.query('select dash_nivel() nivel')).rows[0].nivel,'miembro');
  assert.deepEqual((await db.query('select marketing_permiso() data')).rows[0].data,{administrar:false,acceso:false,publicar:false});
  await assert.rejects(db.query("select dash_ranking_mes(current_date)"),/Dirección activa/);
  await assert.rejects(db.query("select dash_reporte_facebook(current_date,current_date)"),/Dirección activa/);
  await assert.rejects(db.query("select dash_admin_asignaciones_calendario(current_date)"),/Dirección activa/);
  await assert.rejects(db.query('select marketing_gestion_accesos()'),/Sin permiso/);
  await assert.rejects(db.query('select marketing_guardar_accesos(1,array[99]::bigint[])'),/Sin permiso/);
  await assert.rejects(op(db,1,'archivar',{id:uid(5),confirmar_email:'wrong@example.test'}),/Escribe el correo/);
  await op(db,1,'archivar',{id:uid(5),confirmar_email:'person5@example.test'});
  await assert.rejects(op(db,1,'reactivar',{id:uid(5)}),/estado cambió/);
  await op(db,1,'restaurar',{id:uid(5)});assert.equal((await db.query('select estado from kja_admin.estados where id=$1',[uid(5)])).rows[0].estado,'suspendida');
  await op(db,1,'reactivar',{id:uid(5)});
  assert.equal((await db.query('select count(*)::int n from asis_perfiles')).rows[0].n,5);
  assert.equal((await db.query('select count(*)::int n from perfiles')).rows[0].n,1);
  assert.equal((await db.query('select colaborador_id from asis_perfiles where id=$1',[uid(5)])).rows[0].colaborador_id,99);
 }finally{await db.close();}
});
test('own-seat delegation verifies fresh reauthentication, stays at two and immediately revokes old authority',async()=>{
 const db=await fixture();try{
  for(const n of [1,2])for(const action of ['suspender','archivar'])await assert.rejects(op(db,1,action,{id:uid(n)}),/Primero debe delegar/);
  await assert.rejects(op(db,1,'delegar',{id:uid(3),sesion_prueba:uid(101)}),/Confirma nuevamente/);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[uid(301),uid(1)]);
  await op(db,1,'delegar',{id:uid(3),sesion_prueba:uid(301)});
  await as(db,1);assert.equal((await db.query('select dash_es_superadmin() ok')).rows[0].ok,false);
  await assert.rejects(op(db,1,'delegar',{id:uid(4),sesion_prueba:uid(301)}),/Solo los dos/);
  await as(db,3);assert.equal((await db.query('select dash_es_superadmin() ok')).rows[0].ok,true);
  assert.equal((await db.query('select count(*)::int n from kja_admin.puestos')).rows[0].n,2);
 }finally{await db.close();}
});
test('direct and legacy profile writes cannot bypass management; credentials/session cutoff and audit',async()=>{
 const db=await fixture();try{
  await as(db,3);await assert.rejects(db.query("update asis_perfiles set nombre='Bypass' where id=$1",[uid(1)]),/sección autorizada/);
  await db.exec('set role authenticated');await assert.rejects(db.query("update asis_perfiles set rol='direccion' where id=$1",[uid(3)]),/permission denied/);await db.exec('reset role');
  const operation=uid(++seq);await op(db,1,'restablecer',{id:uid(4)},operation);
  await as(db,4);assert.equal((await db.query('select asis_es_miembro() ok')).rows[0].ok,false);
  await assert.rejects(op(db,2,'restablecer',{id:uid(4)}),/Ya hay un restablecimiento/);
  await op(db,1,'clave_fin',{resultado:'completada'},operation);
  await as(db,4);assert.equal((await db.query('select asis_es_miembro() ok')).rows[0].ok,false);
  await db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,clock_timestamp()+interval \'1 second\')',[uid(304),uid(4)]);await as(db,4,'authenticated',304);
  assert.equal((await db.query('select asis_es_miembro() ok')).rows[0].ok,true);
  const events=(await db.query('select * from kja_admin.operaciones')).rows;assert.equal(events[0].resultado,'completada');assert.doesNotMatch(JSON.stringify(events),/password|token|secret/);
 }finally{await db.close();}
});
test('creation defaults preserve existing profiles, cannot convert a PIN account, and requests are idempotent',async()=>{
 const db=await fixture();try{
  const operation=uid(++seq),data={id:uid(6),nombre:'New Admin',rol:'visor',email:'person6@example.test'};
  await op(db,1,'crear',data,operation);assert.equal((await op(db,1,'crear',data,operation)).repetida,true);
  await assert.rejects(op(db,1,'crear',{...data,id:uid(5),email:'person5@example.test'}),/ya tiene perfil/);
  await op(db,1,'editar',{id:uid(6),nombre:'Changed',rol:'editor'});
  assert.deepEqual((await db.query('select nombre,rol,colaborador_id from asis_perfiles where id=$1',[uid(6)])).rows[0],{nombre:'Changed',rol:'editor',colaborador_id:null});
  await as(db,1);const d=(await db.query('select dash_arranque() data')).rows[0].data;assert.equal(d.acceso.superadmin,true);
  await as(db,1,'service_role');await db.query("update auth.users set email='colab-7@interno.kja' where id=$1",[uid(7)]);
  await assert.rejects(op(db,1,'crear',{id:uid(7),email:'colab-7@interno.kja',nombre:'PIN',rol:'visor'}),/Identidad no válida/);
 }finally{await db.close();}
});
test('competing delegations to the same successor leave two distinct holders',async()=>{
 const db=await fixture();try{
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[uid(301),uid(1),uid(302),uid(2)]);
  const results=await Promise.allSettled([
   op(db,1,'delegar',{id:uid(3),sesion_prueba:uid(301)}),
   op(db,2,'delegar',{id:uid(3),sesion_prueba:uid(302)})
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await db.query('select count(*)::int n,count(distinct cuenta)::int distintos from kja_admin.puestos')).rows[0].distintos,2);
 }finally{await db.close();}
});
test('Auth/profile constraints protect holders and failed actions are audited without overwriting successful operations',async()=>{
 const db=await fixture();try{
  await as(db,1,'service_role');
  await assert.rejects(db.query('update asis_perfiles set activo=false where id=$1',[uid(1)]),/dos superadministradores/);
  await assert.rejects(db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[uid(2)]),/dos superadministradores/);
  await assert.rejects(db.query('delete from asis_perfiles where id=$1',[uid(3)]),/archivan/);
  await db.query('select dash_admin_cuenta_fallo($1,$2,$3,$4,$5,$6)',[uid(1),uid(101),'crear',uid(7),uid(900),'Alta incompleta']);
  const event=(await db.query('select accion,resultado,despues from kja_admin.operaciones')).rows[0];assert.equal(event.resultado,'fallida');assert.equal(event.accion,'crear');assert.deepEqual(event.despues,{operacion_solicitada:uid(900)});
 }finally{await db.close();}
});
test('existing PIN sessions keep their area role and never become superadmin',async()=>{
 const db=await fixture();try{
  await as(db,1,'service_role');await db.query("insert into asis_perfiles(id,nombre,nivel,acceso_panel) values($1,'PIN','lider',false)",[uid(7)]);
  await db.query("insert into dash_sesiones(session_id,perfil_id,vence_at) values($1,$2,now()+interval '1 hour')",[uid(107),uid(7)]);
  await as(db,7);assert.deepEqual((await db.query('select dash_nivel() nivel,dash_sesion_vigente() sesion,dash_es_superadmin() superadmin,asis_es_miembro() panel')).rows[0],{nivel:'lider',sesion:true,superadmin:false,panel:false});
 }finally{await db.close();}
});
