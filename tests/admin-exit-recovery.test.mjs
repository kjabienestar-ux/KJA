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
      create table asis_cierre_config(id int,habilitado boolean,obligatorio_desde date);
      insert into asis_cierre_config values(1,true,current_date-180);
      create table asis_registros(id bigint primary key,colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,salida_at timestamptz,
        salida_dispositivo text,salida_origen text,salida_por uuid,horas_efectivas numeric,horas numeric,cierre_regularizado boolean default false,
        cierre_nota text,cierre_actualizado_at timestamptz);
      create table asis_entregas_diarias(id bigint primary key,colaborador_id bigint,fecha date,requisito text,estado text,revision_estado text,completado_at timestamptz);
      create table asis_entregas_direccion(entrega_id bigint,colaborador_id bigint,fecha date,salida_reportada_at timestamptz,actor_id uuid);
      create table asis_entrega_archivos(entrega_id bigint);
      create table fixture(id bigint primary key,payload jsonb);
      create function asis_labora(asis_colaboradores,date) returns boolean language sql as $$ select true $$;
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
    await db.exec("create or replace function asis_rol() returns text language sql as $$ select 'colaborador'::text $$");
    assert.equal((await call('salida')).motivo,'sin_permiso');
  } finally {await db.close();}
});
