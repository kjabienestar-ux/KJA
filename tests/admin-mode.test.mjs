import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const read=p=>fs.readFileSync(p,'utf8');
test('mode correction is authorized, audited, date scoped and preserves original attendance',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000002'::uuid$$;
 create function asis_puede_editar() returns boolean language sql as $$select current_setting('test.edit')::boolean$$;
 create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.session')::boolean$$;
 set test.edit='true';set test.session='true';
 create table asis_perfiles(id uuid primary key);
 insert into asis_perfiles values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
 create table asis_colaboradores(id bigint primary key,horario_semanal jsonb,dias_laborables int[]);
 insert into asis_colaboradores values(1,'{}',array[1,2,3,4,5]);
 create table asis_registros(colaborador_id bigint,fecha date,modalidad_marcada text,marcado_por uuid,marcado_at timestamptz,salida_at timestamptz,estado text,evidencia_path text,primary key(colaborador_id,fecha));
 insert into asis_registros values(1,'2020-01-02','virtual','00000000-0000-0000-0000-000000000001','2020-01-02T08:00:00-05:00','2020-01-02T13:00:00-05:00','P','original.jpg');
 create table asis_modalidades_diarias(colaborador_id bigint,fecha date,modalidad text,modalidad_base text,cambiado_por uuid,actualizado_at timestamptz default now(),primary key(colaborador_id,fecha));
 create function asis_modalidad_base(asis_colaboradores,date) returns text language sql as $$select 'virtual'::text$$;
 create function asis_modalidad_dia(asis_colaboradores,date) returns text language sql as $$select coalesce((select modalidad from asis_modalidades_diarias where colaborador_id=$1.id and fecha=$2),'virtual')$$;
 `);
 const src=read('supabase/dashboard_70_rpe_presencial.sql'),start=src.indexOf('create or replace function public.asis_modalidad_efectiva(');
 await db.exec(src.slice(start,src.indexOf('$$;',start)+3));
 await db.exec(read('supabase/dashboard_73_modalidad_dia_marcada.sql'));
 const migration=read('supabase/dashboard_85_corregir_modalidad.sql');await db.exec(migration);await db.exec(migration);
 const value=async sql=>(await db.query(sql)).rows[0].data;
 const call=mode=>value(`select dash_admin_cambiar_modalidad(1,'2020-01-02','${mode}') data`);
 const before=await value("select to_jsonb(r)-'modalidad_marcada' data from asis_registros r");
 await db.exec('set role authenticated');
 assert.equal((await call('presencial')).ok,true);
 await db.exec('reset role');
 assert.equal(await value('select modalidad_marcada data from asis_registros'),'presencial');
 assert.equal(await value('select modalidad data from asis_modalidades_diarias'),'presencial');
 assert.equal(await value('select cambiado_por::text data from asis_modalidades_diarias'),'00000000-0000-0000-0000-000000000002');
 assert.deepEqual(await value("select to_jsonb(r)-'modalidad_marcada' data from asis_registros r"),before);
 assert.equal((await call('presencial')).ok,true);
 assert.equal(await value('select count(*)::int data from asis_correcciones_modalidad'),1);
 assert.equal((await call('virtual')).ok,true);
 assert.equal(await value('select count(*)::int data from asis_correcciones_modalidad'),2);
 assert.equal(await value('select count(*)::int data from asis_modalidades_diarias'),1);
 assert.equal((await call('opcional')).motivo,'modalidad_invalida');
 assert.equal((await value("select dash_admin_cambiar_modalidad(1,current_date+1,'virtual') data")).motivo,'fecha');
 assert.equal((await value("select dash_admin_cambiar_modalidad(1,'2020-01-03','virtual') data")).motivo,'sin_registro');
 await db.exec("set test.edit='false'");assert.equal((await call('presencial')).motivo,'sin_permiso');
 await db.exec("set test.edit='true';set test.session='false'");assert.equal((await call('presencial')).motivo,'sesion');
 await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select * from asis_correcciones_modalidad'),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>call('virtual'),/permission denied/);
 }finally{await db.close();}
});

const source=read('assets/js/dashboard-admin-mes.js');
function env(rpc){
 const buttons=['virtual','presencial'].map(mode=>({disabled:false,dataset:{monthMode:mode},setAttribute(){}}));
 const picker={setAttribute(){},removeAttribute(){},querySelectorAll:()=>buttons};
 const status={isConnected:true,textContent:''};
 const day={estado:'P',fecha:'2020-01-02',modalidad:'virtual'};
 const ctx={ADMIN_MONTH_DIALOG:{kind:'cell',personId:'1',date:day.fecha},APP:{adminMonth:{puede_editar:true,hoy:'2026-10-03'}},findMonthCell:()=>({person:{id:1},day}),$:id=>id==='month-mode-status'?status:{querySelector:()=>picker},db:{rpc},loadAdminMonth:async()=>{ctx.refreshed=true;ctx.APP.adminMonth=null;},toast(){},cap:x=>x};
 vm.runInNewContext(source.slice(source.indexOf('async function changeMonthMode('),source.indexOf('async function openPrivateMonthEvidence(')),ctx);
 return {ctx,status,buttons};
}
test('mode control sends exact date, prevents duplicate requests and refreshes saved state',async()=>{
 let resolve,calls=0,args;const gate=new Promise(r=>resolve=r);
 const {ctx,status,buttons}=env(async(name,input)=>{calls++;args=input;return gate;});
 const request=ctx.changeMonthMode('presencial');assert.ok(buttons.every(b=>b.disabled));
 await ctx.changeMonthMode('presencial');assert.equal(calls,1);assert.equal(args.p_fecha,'2020-01-02');
 resolve({data:{ok:true}});await request;assert.ok(ctx.refreshed);assert.match(status.textContent,/guardada/);
});
test('failed save preserves selection and permits retry; read-only never sends a request',async()=>{
 let calls=0;const {ctx,status,buttons}=env(async()=>{calls++;throw Error('Sin conexión');});
 await ctx.changeMonthMode('presencial');assert.equal(status.textContent,'Sin conexión');assert.ok(buttons.every(b=>!b.disabled));
 ctx.APP.adminMonth.puede_editar=false;await ctx.changeMonthMode('presencial');assert.equal(calls,1);
});
