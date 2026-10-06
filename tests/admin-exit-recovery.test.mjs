import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('administrative exits: recover reported times using current work policy, preserve restrictions and existing exits',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
      create function asis_rol() returns text language sql as $$ select 'direccion'::text $$;
      create table asis_colaboradores(id bigint primary key,nombre text,activo boolean);
      create table asis_cierre_config(id int,habilitado boolean,obligatorio_desde date,salida_anticipacion_min int,salida_gracia_min int);
      insert into asis_cierre_config values(1,true,current_date-180,15,120);
      create table asis_registros(id bigint primary key,colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,salida_at timestamptz,
        salida_dispositivo text,salida_origen text,salida_por uuid,horas_efectivas numeric,horas numeric,cierre_regularizado boolean default false,
        cierre_nota text,cierre_actualizado_at timestamptz);
      create table asis_entregas_diarias(id bigint primary key,colaborador_id bigint,fecha date,requisito text,estado text,revision_estado text,completado_at timestamptz);
      create table asis_entregas_direccion(entrega_id bigint,colaborador_id bigint,fecha date,salida_reportada_at timestamptz,actor_id uuid);
      create table asis_entrega_archivos(entrega_id bigint);
      create table fixture(id bigint primary key,payload jsonb);
      create function asis_labora(asis_colaboradores,date) returns boolean language sql as $$ select true $$;
      create function asis_cierre_fin_at(bigint,date) returns timestamptz language sql as $$
        select ($2+time '13:00') at time zone 'America/Lima' $$;
      create function asis_rpe_exento_presencial(bigint,date) returns boolean language sql as $$ select $1=1 $$;
      create function dash_cierre_resumen_colab(bigint,date) returns jsonb language sql as $$
        select payload || jsonb_build_object('salida_at',r.salida_at,'estado',case when r.salida_at is null or coalesce((payload->>'comparticiones_vencidas')::boolean,false) then 'incompleta' else 'regularizada' end)
        from fixture f join asis_registros r on r.colaborador_id=f.id where f.id=$1 and r.fecha=$2 $$;
      create function dash_admin_confirmar_entrega_base_70(bigint,date,text,bigint,text,text[],text,time) returns jsonb language sql as $$
        select case when $3='fallo' then '{"ok":false,"motivo":"archivo_no_verificado"}'::jsonb
        else '{"ok":true,"cierre_regularizado":false}'::jsonb end $$;
      insert into asis_colaboradores select i,'Persona '||i,true from generate_series(1,12) i;
      insert into asis_registros(id,colaborador_id,fecha,estado,marcado_at)
        select i,i,current_date-1,'P',(current_date-1+time '08:12') at time zone 'America/Lima' from generate_series(1,12) i;
      insert into fixture select i,'{"ok":true,"aplica_jornada":true,"pendientes_salida":0}'::jsonb from generate_series(1,12) i;
      insert into asis_entregas_diarias select i,i,current_date-1,'salida','completo','aprobada',
        (current_date-1+time '16:51') at time zone 'America/Lima' from generate_series(1,12) i;
      insert into asis_entregas_direccion select i,i,current_date-1,
        (current_date-1+time '14:00') at time zone 'America/Lima',auth.uid() from generate_series(1,12) i;
      insert into asis_entrega_archivos select i from generate_series(1,12) i where i<>6;
      update fixture set payload=payload||'{"comparticiones_vencidas":true}'::jsonb where id=2;
      update fixture set payload=payload||'{"pendientes_salida":1}'::jsonb where id=3;
      update asis_registros set estado='J' where id=4;
      update asis_registros set salida_at=(current_date-1+time '13:00') at time zone 'America/Lima',horas=4.8,horas_efectivas=4.8 where id=5;
      update asis_entregas_direccion set salida_reportada_at=null where entrega_id=7;
      update asis_entregas_direccion set salida_reportada_at=(current_date-1+time '07:00') at time zone 'America/Lima' where entrega_id=8;
      update asis_entregas_diarias set revision_estado='observada' where id=9;
      update asis_registros set estado='NG' where id=10;
      update fixture set payload=null where id=11;
      update asis_entregas_direccion set fecha=current_date-2 where entrega_id=12;
    `);
    // Keep date-specific recovery deterministic on any test host date.
    const migration=fs.readFileSync('supabase/dashboard_84_regularizacion_salida_vigente.sql','utf8').replaceAll("date '2026-10-02'","(current_date-1)");
    await db.exec(migration);
    const rows=(await db.query("select id,to_char(salida_at at time zone 'America/Lima','HH24:MI') salida,horas,cierre_nota,salida_por from asis_registros order by id")).rows;
    assert.equal(rows[0].salida,'14:00');assert.equal(Number(rows[0].horas),5.8);
    assert.equal(rows[1].salida,'14:00');
    assert.equal((await db.query('select dash_cierre_resumen_colab(2,current_date-1) x')).rows[0].x.estado,'incompleta');
    assert.equal(rows[4].salida,'13:00');assert.equal(Number(rows[4].horas),4.8);
    for(const id of [3,4,6,7,8,9,10,11,12])assert.equal(rows[id-1].salida,null,'must preserve blocked case '+id);
    assert.equal(rows[0].salida_por,'00000000-0000-0000-0000-000000000001');
    await db.exec(migration);
    assert.deepEqual((await db.query("select id,to_char(salida_at at time zone 'America/Lima','HH24:MI') salida,horas,cierre_nota,salida_por from asis_registros order by id")).rows,rows);
    assert.equal((await db.query("select has_function_privilege('authenticated','dash_admin_regularizar_cierre_impl(bigint,date,uuid)','execute') allowed")).rows[0].allowed,false);
    const call=async(type)=>(await db.query("select dash_admin_confirmar_entrega(3,current_date-1,$1) x",[type])).rows[0].x;
    // A final subsequent delivery retries recovery once work requirements are satisfied.
    await db.exec("update fixture set payload=jsonb_set(payload,'{pendientes_salida}','0') where id=3");
    assert.equal((await call('fallo')).ok,false);
    assert.equal((await db.query('select salida_at from asis_registros where id=3')).rows[0].salida_at,null);
    assert.equal((await call('asignado')).cierre_regularizado,true);
    assert.equal((await db.query("select dash_admin_confirmar_entrega(1,current_date-1,'rpe') x")).rows[0].x.motivo,'rpe_no_requerido_presencial');
    // Migration 91 broadens recovery beyond one date, accepts only on-time
    // personal evidence, and retries when an existing upload is approved.
    await db.exec(`
      create function dash_admin_revisar_entrega(bigint,text,text default null) returns jsonb language plpgsql as $$
      begin
        if $2 not in ('aprobada','observada') then return '{"ok":false}'::jsonb; end if;
        update asis_entregas_diarias set revision_estado=$2 where id=$1;
        return '{"ok":true}'::jsonb;
      end $$;
      insert into asis_colaboradores select i,'Persona '||i,true from generate_series(13,17) i;
      insert into asis_registros(id,colaborador_id,fecha,estado,marcado_at)
        select i,i,current_date-5,'P',(current_date-5+time '08:15') at time zone 'America/Lima' from generate_series(13,17) i;
      insert into fixture select i,jsonb_build_object('ok',true,'aplica_jornada',true,'pendientes_salida',0,
        'salida_desde','12:45:00','salida_hasta','15:00:00') from generate_series(13,17) i;
      insert into asis_entregas_diarias select i,i,current_date-5,'salida','completo',
        case when i=16 then 'pendiente' else 'aprobada' end,
        (current_date-5+time '13:00') at time zone 'America/Lima' from generate_series(13,17) i;
      insert into asis_entrega_archivos select i from generate_series(13,17) i;
      insert into asis_entregas_direccion values(13,13,current_date-5,(current_date-5+time '13:00') at time zone 'America/Lima',auth.uid());
      update asis_entregas_diarias set completado_at=now() where id in (13,15);
      update fixture set payload=payload||'{"pendientes_salida":1}'::jsonb where id=17;
    `);
    const recovery=fs.readFileSync('supabase/dashboard_91_recuperar_salidas_con_evidencia.sql','utf8');
    await db.exec(recovery);
    const exits=async()=>(await db.query("select id,to_char(salida_at at time zone 'America/Lima','HH24:MI') salida,horas,cierre_nota from asis_registros order by id")).rows;
    const after=await exits();
    for(const id of [13,14]){assert.equal(after[id-1].salida,'13:00');assert.equal(Number(after[id-1].horas),4.75);}
    for(const id of [3,5])assert.equal(after[id-1].salida,rows[id-1].salida||'14:00');
    for(const id of [4,6,7,8,9,10,11,12,15,16,17])assert.equal(after[id-1].salida,null,'91 must preserve blocked case '+id);
    await db.exec(recovery);assert.deepEqual(await exits(),after);
    assert.equal((await db.query("select has_function_privilege('authenticated','dash_admin_revisar_entrega_base_91(bigint,text,text)','execute') allowed")).rows[0].allowed,false);
    const approve=async(id,state='aprobada')=>(await db.query('select dash_admin_revisar_entrega($1,$2) x',[id,state])).rows[0].x;
    assert.equal((await approve(16,'invalid')).ok,false);
    assert.equal((await exits())[15].salida,null);
    assert.equal((await approve(16)).cierre_regularizado,true);
    assert.equal((await exits())[15].salida,'13:00');
    await db.exec("update fixture set payload=jsonb_set(payload,'{pendientes_salida}','0') where id=17");
    assert.equal((await approve(17)).cierre_regularizado,true);
    // Canonical window may cross midnight; a time-only summary is insufficient.
    await db.exec(`
      insert into asis_colaboradores values(18,'Turno nocturno',true);
      insert into asis_registros(id,colaborador_id,fecha,estado,marcado_at)
        values(18,18,current_date-5,'P',(current_date-5+time '18:00') at time zone 'America/Lima');
      insert into fixture values(18,'{"ok":true,"aplica_jornada":true,"pendientes_salida":0,"salida_desde":"23:45:00","salida_hasta":"02:00:00"}');
      insert into asis_entregas_diarias values(18,18,current_date-5,'salida','completo','aprobada',
        (current_date-4+time '00:10') at time zone 'America/Lima');
      insert into asis_entrega_archivos values(18);
      create or replace function asis_cierre_fin_at(bigint,date) returns timestamptz language sql as $$
        select case when $1=18 then ($2+1+time '00:00') at time zone 'America/Lima'
                    else ($2+time '13:00') at time zone 'America/Lima' end $$;
    `);
    await db.exec(recovery);
    assert.equal((await exits())[17].salida,'00:10');
    assert.equal(Number((await exits())[17].horas),6.17);
    await db.exec("create or replace function asis_rol() returns text language sql as $$ select 'colaborador'::text $$");
    assert.equal((await call('salida')).motivo,'sin_permiso');
    assert.equal((await approve(15)).motivo,'sin_permiso');
  } finally {await db.close();}
});
