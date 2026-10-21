import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=name=>fs.readFileSync(`supabase/${name}`,'utf8');
const fixed=source=>source.replaceAll('now()',"timestamptz '2026-10-21 15:00:00+00'");
function definition(source,name){
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start,-1);
  return fixed(source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3));
}

test('Direction can approve past and nonworking dates without duplicating a rest or debit',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function public.asis_rol() returns text language sql as $$select 'direccion'::text$$;
      create table public.asis_colaboradores(id bigint primary key,activo boolean,contrato_inicio date,dias_libres_saldo integer);
      create table public.asis_solicitudes_personales(id bigint primary key,colaborador_id bigint,tipo text,estado text,
        fecha_inicio date,fecha_fin date,detalle text,descanso_programado boolean,contra_fecha date,contra_estado text,
        respuesta text,resuelto_por uuid,resuelto_at timestamptz);
      create table public.asis_descansos_presenciales(colaborador_id bigint,fecha date,motivo text,asignado_por uuid,unique(colaborador_id,fecha));
      create table public.asis_descansos_auditoria(colaborador_id bigint,fecha date,accion text,motivo text,actor uuid);
      create table public.asis_dias_libres_movimientos(colaborador_id bigint,cantidad integer,saldo_anterior integer,saldo_resultante integer,motivo text,solicitud_id bigint,creado_por uuid);
      create table public.asis_admin_eventos(actor_id uuid,accion text,colaborador_id bigint,detalle jsonb);
      create table public.asis_registros(colaborador_id bigint,fecha date,estado text,nota text);
      create function public.dash_admin_guardar_estado(bigint,date,text) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
      create function public.asis_labora(c public.asis_colaboradores,f date) returns boolean language sql as $$
        select extract(isodow from f) in(2,3,4) and not exists(select 1 from public.asis_descansos_presenciales d where d.colaborador_id=c.id and d.fecha=f)$$;
      insert into public.asis_colaboradores values(1,true,'2026-01-01',3);
      insert into public.asis_solicitudes_personales(id,colaborador_id,tipo,estado,fecha_inicio,fecha_fin,detalle,descanso_programado) values
        (1,1,'dia_libre','pendiente','2026-10-21','2026-10-21','Solicitud de días libres',true),
        (2,1,'dia_libre','pendiente','2026-10-22','2026-10-22','Solicitud de días libres',true),
        (3,1,'dia_libre','pendiente','2026-10-20','2026-10-20','Solicitud de días libres',true);
    `);
    for(const [file,name] of [
      ['dashboard_11_solicitudes_personales.sql','dash_admin_resolver_solicitud'],
      ['dashboard_18_dias_libres.sql','asis_descontar_dia_libre_aprobado'],
      ['dashboard_93_solicitar_dias_libres.sql','asis_programar_dia_libre_aprobado'],
      ['dashboard_94_contraofertas_dias_libres.sql','asis_validar_fecha_libre'],
      ['dashboard_94_contraofertas_dias_libres.sql','asis_validar_resolucion_libre']
    ])await db.exec(definition(sql(file),name));
    await db.exec(`
      create trigger asis_aa_validar_libre before update of estado on public.asis_solicitudes_personales for each row execute function public.asis_validar_resolucion_libre();
      create trigger asis_sol_descontar_dia_libre before update of estado on public.asis_solicitudes_personales for each row execute function public.asis_descontar_dia_libre_aprobado();
      create trigger asis_sol_programar_dia_libre after update of estado on public.asis_solicitudes_personales for each row execute function public.asis_programar_dia_libre_aprobado();
    `);
    const decide=async(id,approved=true)=>(await db.query('select public.dash_admin_resolver_solicitud($1,$2,null) as result',[id,approved])).rows[0].result;
    await assert.rejects(decide(1),/dia_no_permitido/);
    // Even fixing only the first trigger would leave a second independent blocker.
    await db.exec('alter table public.asis_solicitudes_personales disable trigger asis_aa_validar_libre');
    await assert.rejects(decide(1),/dia_libre_fecha_vencida/);
    await db.exec('alter table public.asis_solicitudes_personales enable trigger asis_aa_validar_libre');
    const migration=fixed(sql('dashboard_121_aprobar_dia_libre_hoy.sql'));
    await db.exec(migration);await db.exec(migration);
    await db.exec('update public.asis_colaboradores set dias_libres_saldo=0 where id=1');
    await assert.rejects(decide(1),/saldo_dias_libres_insuficiente/);
    await db.exec("update public.asis_colaboradores set dias_libres_saldo=3 where id=1; update public.asis_solicitudes_personales set contra_estado='pendiente' where id=1");
    await assert.rejects(decide(1),/contraoferta_pendiente/);
    await db.exec('update public.asis_solicitudes_personales set contra_estado=null where id=1');
    assert.equal((await decide(1)).ok,true);
    assert.equal((await decide(1)).motivo,'no_existe');
    assert.equal((await decide(2)).ok,true,'future approval still works');
    await assert.rejects(decide(3),/dia_libre_fecha_vencida/);
    assert.equal((await decide(3,false)).ok,true,'expired requests can still be rejected');
    const state=(await db.query(`select dias_libres_saldo as saldo,
      (select count(*)::int from public.asis_dias_libres_movimientos) as movimientos,
      (select count(*)::int from public.asis_descansos_presenciales) as descansos,
      (select count(*)::int from public.asis_descansos_auditoria) as auditoria from public.asis_colaboradores where id=1`)).rows[0];
    assert.deepEqual(state,{saldo:1,movimientos:2,descansos:2,auditoria:2});
    assert.equal((await db.query("select public.asis_validar_fecha_libre(1,'2026-10-21',1) as motivo")).rows[0].motivo,'dia_no_permitido','proposals still require a future date');

    const directionMigration=fixed(sql('dashboard_122_aprobacion_dias_libres_direccion.sql'));
    await db.exec(directionMigration);await db.exec(directionMigration);
    await db.exec(`
      update public.asis_colaboradores set dias_libres_saldo=10 where id=1;
      insert into public.asis_solicitudes_personales(id,colaborador_id,tipo,estado,fecha_inicio,fecha_fin,detalle,descanso_programado) values
        (4,1,'dia_libre','pendiente','2026-10-21','2026-10-21','Descanso ya asignado',true),
        (5,1,'dia_libre','pendiente','2026-10-18','2026-10-18','Domingo pasado',true),
        (6,1,'dia_libre','pendiente','2026-11-01','2026-11-01','Domingo futuro',true),
        (7,1,'dia_libre','pendiente','2025-12-21','2025-12-21','Horario y contrato cambiaron',true),
        (8,1,'dia_libre','pendiente','2026-10-20','2026-10-20','Solicitud atrasada',true),
        (9,1,'dia_libre','pendiente','2026-10-18','2026-10-18','Otra solicitud misma fecha',true),
        (10,1,'dia_libre','pendiente','2026-10-28','2026-10-28','Sin saldo',true);
      update public.asis_solicitudes_personales set contra_estado='pendiente',contra_fecha='2026-10-29' where id=8;
    `);
    for(const id of [4,5,6,7,8,9])assert.equal((await decide(id)).ok,true,`approval ${id}`);
    assert.equal((await decide(5)).motivo,'no_existe','retry cannot debit twice');
    assert.equal((await db.query('select contra_estado from public.asis_solicitudes_personales where id=8')).rows[0].contra_estado,'rechazada');
    assert.deepEqual((await db.query(`select dias_libres_saldo as saldo,
      (select count(*)::int from public.asis_dias_libres_movimientos) as movimientos,
      (select count(*)::int from public.asis_descansos_presenciales) as descansos,
      (select count(*)::int from public.asis_descansos_auditoria) as auditoria from public.asis_colaboradores where id=1`)).rows[0],
      {saldo:6,movimientos:6,descansos:6,auditoria:6});
    await db.exec('update public.asis_colaboradores set dias_libres_saldo=0 where id=1');
    await assert.rejects(decide(10),/saldo_dias_libres_insuficiente/);
    assert.equal((await db.query('select estado from public.asis_solicitudes_personales where id=10')).rows[0].estado,'pendiente');
    await db.exec("create or replace function public.asis_rol() returns text language sql as $$select 'colaborador'::text$$");
    assert.equal((await decide(10)).motivo,'sin_permiso','Direction authorization remains enforced');
  }finally{await db.close();}
});
