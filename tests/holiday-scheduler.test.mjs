import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('holiday agenda authorizes edits, schedules across months and restores work on cancellation',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql as $$select '11111111-1111-1111-1111-111111111111'::uuid$$;
   create function dash_sesion_vigente() returns boolean language sql as $$select coalesce(current_setting('test.session',true),'yes')='yes'$$;
   create function asis_puede_editar() returns boolean language sql as $$select coalesce(current_setting('test.edit',true),'yes')='yes'$$;
   create function asis_es_miembro() returns boolean language sql as $$select coalesce(current_setting('test.member',true),'yes')='yes'$$;
   create table asis_colaboradores(id bigint primary key,activo boolean,contrato_inicio date,comparticiones_horario_configurado boolean,horario_semanal jsonb,dias_laborables integer[]);
   create table asis_comparticiones_horarios(colaborador_id bigint,dia_semana int);
   create table asis_excepciones(id bigint generated always as identity,fecha date,ambito text,tipo text,nota text,creado_por uuid,colaborador_id bigint);
   insert into asis_colaboradores values(1,true,'2020-01-01',true,'{}','{1,2,3,4,5,6,7}'),(2,true,'2020-01-01',true,'{}','{1,2,3,4,5,6,7}');
   insert into asis_comparticiones_horarios select 1,generate_series(1,7);
   create function asis_labora_base_106(asis_colaboradores,date) returns boolean language sql as $$select true$$;
   create function asis_compartir_programado_base_106(bigint,date) returns boolean language sql as $$select $1=1$$;
   create function dash_cierre_resumen_colab_base_106(p_colaborador bigint,p_fecha date) returns jsonb language plpgsql as $$begin
     return jsonb_build_object('ok',true,'aplica',true,'aplica_jornada',true,'estado','sin_entrada','aplica_comparticiones',asis_compartir_programado(p_colaborador,p_fecha),
      'requisitos','[{"tipo":"rpe","completo":false},{"tipo":"comparticiones","completo":false}]'::jsonb,'asignaciones','[{"id":7,"completo":false}]'::jsonb);end$$;
   create function dash_admin_mes(p_anio integer,p_mes integer,p_incluir_inactivos boolean default false) returns jsonb language sql as $$
    select jsonb_build_object('ok',true,'personas',jsonb_build_array(jsonb_build_object('id',1,'dias',jsonb_build_array(jsonb_build_object('fecha',make_date(p_anio,p_mes,1),'laborable',true,'motivo','extra')))))$$;
  `);
  const migration=fs.readFileSync('supabase/dashboard_107_agenda_feriados.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const dates=(await db.query("select ((now() at time zone 'America/Lima')::date-1)::text past,((date_trunc('month',now() at time zone 'America/Lima')+interval '2 months')::date)::text future")).rows[0];
  const rpc=async(sql,args=[])=>(await db.query(sql,args)).rows[0].value;
  const save=(date,note='Feriado nacional')=>rpc('select dash_admin_guardar_feriado($1,$2) value',[date,note]);
  assert.equal((await save(dates.past)).motivo,'fecha');assert.equal((await save(null)).motivo,'fecha');
  assert.equal((await save(dates.future,'x'.repeat(61))).motivo,'nota');
  await db.exec("set test.edit='no'");assert.equal((await save(dates.future)).motivo,'sin_permiso');
  assert.equal((await rpc('select dash_admin_quitar_feriado($1) value',[dates.future])).motivo,'sin_permiso');
  await db.exec("set test.edit='yes';set test.session='no'");assert.equal((await save(dates.future)).motivo,'sin_permiso');
  assert.equal((await rpc('select dash_admin_feriados_proximos() value')).motivo,'sin_permiso');
  await db.exec("set test.session='yes'");
  await db.query("insert into asis_excepciones(fecha,ambito,tipo,colaborador_id) values($1,'colaborador','laborable_extra',1)",[dates.future]);
  assert.equal((await save(dates.future)).ok,true);assert.equal((await save(dates.future,'Feriado actualizado')).ok,true);
  const agenda=await rpc('select dash_admin_feriados_proximos() value');
  assert.equal(agenda.feriados.filter(x=>x.fecha===dates.future).length,1);
  assert.equal(agenda.feriados.find(x=>x.fecha===dates.future).nota,'Feriado actualizado');
  for(const id of [1,2]){
   assert.equal(await rpc('select asis_labora(c,$1) value from asis_colaboradores c where id=$2',[dates.future,id]),false);
   const close=await rpc('select dash_cierre_resumen_colab($1,$2) value',[id,dates.future]);
   assert.equal(close.feriado,true);assert.equal(close.aplica_jornada,false);assert.equal(close.pendientes,id===1?1:0);
   assert.deepEqual(close.asignaciones,[]);assert.deepEqual(close.requisitos.map(x=>x.tipo),id===1?['comparticiones']:[]);
  }
  const [year,month]=dates.future.split('-').map(Number);
  const calendar=await rpc('select dash_admin_mes($1,$2) value',[year,month]);
  assert.equal(calendar.personas[0].dias[0].laborable,false);assert.equal(calendar.personas[0].dias[0].motivo,'feriado');
  assert.equal((await rpc('select dash_admin_quitar_feriado($1) value',[dates.future])).ok,true);
  assert.equal(await rpc('select asis_labora(c,$1) value from asis_colaboradores c where id=1',[dates.future]),true);
  assert.equal((await rpc('select dash_cierre_resumen_colab(1,$1) value',[dates.future])).feriado,undefined);
  assert.equal((await rpc('select dash_admin_mes($1,$2) value',[year,month])).personas[0].dias[0].motivo,'extra');
  assert.equal((await db.query("select tipo from asis_excepciones where colaborador_id=1")).rows[0].tipo,'laborable_extra');
  assert.equal((await rpc('select dash_admin_quitar_feriado($1) value',[dates.past])).motivo,'fecha');
  await db.exec("set test.member='no'");assert.equal((await rpc('select dash_admin_feriados_proximos() value')).motivo,'sin_permiso');
  assert.equal(await rpc("select has_function_privilege('authenticated','asis_feriado_programado(date)','execute') value"),false);
 }finally{await db.close();}
});
