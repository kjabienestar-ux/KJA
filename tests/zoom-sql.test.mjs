import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('Zoom: RLS, destinatarios, revocación y privacidad de enlaces',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create table asis_areas(id bigint primary key,nombre text,activo boolean);
 create table asis_colaboradores(id bigint primary key,nombre text,area_id bigint,activo boolean);
 create table asis_perfiles(id uuid primary key,activo boolean,acceso_panel boolean,rol text,nivel text,colaborador_id bigint);
 insert into asis_areas values(1,'Marketing',true),(2,'Sistemas',true);
 insert into asis_colaboradores values(1,'Ana',1,true),(2,'Luis',2,true),(3,'Baja',1,false);
 insert into asis_perfiles values
 ('00000000-0000-4000-8000-000000000001',true,true,'direccion','sistemas',null),
 ('00000000-0000-4000-8000-000000000002',true,false,'visor','miembro',1),
 ('00000000-0000-4000-8000-000000000003',true,false,'visor','lider',2),
 ('00000000-0000-4000-8000-000000000004',true,false,'visor','miembro',3);`);
 const sql=fs.readFileSync('supabase/dashboard_109_zoom.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`insert into zoom_reuniones(id,topic,status,audience,area_ids,person_ids,join_url,host_email) values
 ('10000000-0000-4000-8000-000000000001','Marketing','ready','areas','{1}','{}','SECRET','HOST'),
 ('10000000-0000-4000-8000-000000000002','General','ready','all','{}','{}','SECRET','HOST'),
 ('10000000-0000-4000-8000-000000000003','Luis','ready','people','{}','{2}','SECRET','HOST'),
 ('10000000-0000-4000-8000-000000000004','Fallida','error','all','{}','{}','SECRET','HOST'),
 ('10000000-0000-4000-8000-000000000005','Cancelada','cancelled','all','{}','{}','SECRET','HOST');`);
 const identity=async n=>db.exec("select set_config('request.uid','00000000-0000-4000-8000-"+String(n).padStart(12,'0')+"',false)");
 const list=async()=>(await db.query('select dash_zoom_listar() data')).rows[0].data;
 await identity(2);let data=await list();assert.equal(data.admin,false);assert.deepEqual(data.meetings.map(m=>m.topic).sort(),['General','Marketing']);assert.equal(JSON.stringify(data).includes('SECRET'),false);assert.equal(JSON.stringify(data).includes('HOST'),false);assert.deepEqual(data.people,[]);
 await identity(3);data=await list();assert.deepEqual(data.meetings.map(m=>m.topic).sort(),['General','Luis']);
 assert.equal((await db.query("select dash_zoom_puede_unirse('10000000-0000-4000-8000-000000000001') ok")).rows[0].ok,false);
 await identity(4);assert.equal((await list()).ok,false);
 await identity(1);data=await list();assert.equal(data.admin,true);assert.equal(data.meetings.length,4);assert.equal(JSON.stringify(data).includes('SECRET'),false);assert.equal(data.areas.length,2);
 await db.exec('update asis_perfiles set activo=false where colaborador_id=1');await identity(2);assert.equal((await list()).ok,false);
 const perms=(await db.query("select has_table_privilege('authenticated','zoom_reuniones','select') rd,has_table_privilege('authenticated','zoom_reuniones','insert') wr,has_function_privilege('anon','dash_zoom_listar()','execute') anon,has_function_privilege('authenticated','dash_zoom_listar()','execute') member")).rows[0];assert.deepEqual(perms,{rd:false,wr:false,anon:false,member:true});
 }finally{await db.close();}
});