import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('server enforces a single timed session, ownership, consumption, resets and expiry',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
      create function public.dash_colab() returns bigint language sql as $$ select current_setting('test.colab')::bigint $$;
      create function public.dash_sesion_vigente() returns boolean language sql as $$ select current_setting('test.session')::boolean $$;
      create function public.asis_rol() returns text language sql as $$ select current_setting('test.role') $$;
      set test.colab='1'; set test.session='true'; set test.role='colaborador';
      create table public.asis_areas(id bigint,nombre text);
      create table public.asis_colaboradores(id bigint primary key,nombre text,area_id bigint,activo boolean);
      create table public.asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,salida_at timestamptz);
      insert into public.asis_colaboradores values(1,'Uno',1,true),(2,'Dos',1,true);
      create function public.asis_labora(public.asis_colaboradores,date) returns boolean language sql as $$ select true $$;
      create function public.asis_hora_entrada(public.asis_colaboradores,date) returns time language sql as $$ select '08:00'::time $$;
      create function public.asis_hora_salida(public.asis_colaboradores,date) returns time language sql as $$ select '18:00'::time $$;
      create table public.test_clock(at timestamptz);
      insert into public.test_clock values (((now() at time zone 'America/Lima')::date + time '10:00') at time zone 'America/Lima');
      create function public.pausa_test_clock() returns timestamptz language sql as $$ select at from public.test_clock $$;
      insert into public.asis_registros select id,(at at time zone 'America/Lima')::date,'P',at-interval '2 hours',null from public.asis_colaboradores cross join public.test_clock;
    `);
    await db.exec(fs.readFileSync('supabase/dashboard_75_pausas_activas.sql','utf8'));
    // Solo sustituye el reloj para probar fronteras sin esperar 20 minutos.
    const migration=fs.readFileSync('supabase/dashboard_78_pausas_sesiones.sql','utf8').replaceAll('clock_timestamp()','public.pausa_test_clock()');
    await db.exec(migration); await db.exec(migration);
    const rpc=async(sql,args=[]) => (await db.query(`select public.${sql} as data`,args)).rows[0].data;
    const start=await rpc("dash_iniciar_pausa('movilidad')");
    assert.equal(start.sesion.estado,'en_curso');
    assert.equal(Date.parse(start.sesion.fin_at)-Date.parse(start.ahora),1200000);
    const attempts=await Promise.all([rpc("dash_iniciar_pausa('visual')"),rpc("dash_iniciar_pausa('movilidad')")]);
    for(const response of attempts){assert.equal(response.sesion.id,start.sesion.id);assert.deepEqual(response.pausas,['movilidad']);}
    assert.equal((await rpc('dash_cerrar_pausa($1,false)',[start.sesion.id])).motivo,'tiempo_pendiente');
    assert.equal((await rpc('dash_cerrar_pausa($1,null)',[start.sesion.id])).motivo,'tiempo_pendiente');
    await db.exec("set test.colab='2'");
    assert.equal((await rpc('dash_cerrar_pausa($1,true)',[start.sesion.id])).motivo,'sesion_no_disponible');
    await db.exec("set test.colab='1'; update public.test_clock set at=at+interval '19 minutes 59 seconds'");
    assert.equal((await rpc('dash_cerrar_pausa($1,false)',[start.sesion.id])).motivo,'tiempo_pendiente');
    await db.exec("update public.test_clock set at=at+interval '1 second'");
    const complete=await rpc('dash_mis_pausas()');
    assert.equal(complete.sesion.estado,'completada');
    assert.equal((await rpc('dash_cerrar_pausa($1,false)',[start.sesion.id])).sesion.estado,'completada');
    assert.equal((await rpc("dash_iniciar_pausa('movilidad')")).motivo,'consumida');
    const second=await rpc("dash_iniciar_pausa('visual')");
    assert.equal(Date.parse(second.sesion.fin_at)-Date.parse(second.ahora),600000);
    assert.equal((await rpc('dash_cerrar_pausa($1,true)',[second.sesion.id])).sesion.estado,'abandonada');
    assert.equal((await rpc('dash_cerrar_pausa($1,false)',[second.sesion.id])).sesion.estado,'abandonada');
    assert.equal((await rpc("dash_iniciar_pausa('visual')")).motivo,'consumida');
    assert.equal((await rpc('dash_admin_reset_pausas(1)')).motivo,'sin_permiso');
    await db.exec("set test.role='direccion'");
    const report=await rpc('dash_admin_pausas_diarias()');
    assert.deepEqual(report.filas.find(r=>r.colaborador_id===1).sesiones.map(s=>s.estado),['completada','abandonada']);
    await rpc('dash_admin_reset_pausas(1)');
    assert.equal((await rpc('dash_mis_pausas()')).sesion,null);
    assert.equal((await rpc('dash_cerrar_pausa($1,false)',[second.sesion.id])).motivo,'sesion_no_disponible');
    const resetStart=await rpc("dash_iniciar_pausa('visual')");
    assert.notEqual(resetStart.sesion.id,second.sesion.id);
    await rpc('dash_admin_reset_todas_pausas()');
    assert.deepEqual((await rpc('dash_mis_pausas()')).pausas,[]);
    assert.equal((await rpc("dash_registrar_pausa('visual')")).motivo,'actualizar_portal');
    // Un consumo antiguo no se convierte artificialmente en una sesion completada.
    await db.exec("insert into public.asis_pausas_activas(colaborador_id,fecha,pausas,completadas_count) values(2,(now() at time zone 'America/Lima')::date,'[\"visual\"]',1)");
    const legacy=await rpc('dash_admin_pausas_diarias()');
    assert.deepEqual(legacy.filas.find(r=>r.colaborador_id===2).sesiones,[]);
    const dailyStart=await rpc("dash_iniciar_pausa('visual')");
    await db.exec("update public.test_clock set at=at+interval '1 day'; update public.asis_registros set fecha=fecha+1,marcado_at=marcado_at+interval '1 day'");
    const nextDay=await rpc('dash_mis_pausas()');assert.deepEqual(nextDay.pausas,[]);assert.equal(nextDay.sesion,null);
    const nextStart=await rpc("dash_iniciar_pausa('visual')");assert.notEqual(nextStart.sesion.id,dailyStart.sesion.id);
    await rpc('dash_cerrar_pausa($1,true)',[nextStart.sesion.id]);
    await db.exec("update public.test_clock set at=date_trunc('day',at at time zone 'America/Lima') at time zone 'America/Lima' + interval '17 hours 55 minutes'");
    assert.equal((await rpc("dash_iniciar_pausa('visual')")).motivo,'tiempo_insuficiente');
    await db.exec("update public.asis_registros set salida_at=marcado_at+interval '1 hour'");
    assert.equal((await rpc("dash_iniciar_pausa('visual')")).motivo,'fuera_horario');
    await db.exec("set test.session='false'");
    assert.equal((await rpc('dash_mis_pausas()')).motivo,'sin_sesion');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.dash_pausas_estado(2)'),/permission denied/);
    await assert.rejects(db.query('select * from public.asis_pausa_sesiones'),/permission denied/);
    await assert.rejects(db.query("update public.asis_pausa_sesiones set estado='completada'"),/permission denied/);
  } finally { await db.close(); }
});
