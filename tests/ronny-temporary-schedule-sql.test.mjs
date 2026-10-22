import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=name=>fs.readFileSync(`supabase/${name}`,'utf8');
function definition(source,name){
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start,-1);
  return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);
}

test('Ronny has exactly two days off and eight dated 10:30-13:00 shifts; other dates and people retain their schedule',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create table public.asis_perfiles(id uuid primary key);
      create table public.asis_colaboradores(id bigint primary key,nombre text,dni text,activo boolean,
        horario_semanal jsonb,dias_laborables int[],hora_inicio time,hora_fin time,
        contrato_horas numeric,dias_libres_saldo integer);
      create table public.asis_excepciones(id bigint generated always as identity,fecha date,ambito text,
        colaborador_id bigint,tipo text,nota text,creado_por uuid);
      create table public.asis_descansos_presenciales(colaborador_id bigint,fecha date);
      create table public.asis_historial_contrato(colaborador_id bigint,tipo text,horario_anterior jsonb,
        horario_nuevo jsonb,nota text,creado_por uuid);
      create table public.asis_registros(colaborador_id bigint,fecha date,estado text,horas numeric,marcado_at timestamptz);
      insert into public.asis_colaboradores values
        (1,' RONNY  Yural Ruiz Pinillos ',null,true,'{"3":{"ini":"08:15","fin":"13:15","mod":"presencial"}}',
          array[1,2,3,4,5],'08:00','13:00',500,6),
        (2,'Otra persona','72020383',true,'{}',array[1,2,3,4,5],'09:00','14:00',500,3);
      insert into public.asis_registros(colaborador_id,fecha,estado,horas) values(1,'2026-10-20','P',5);
      insert into public.asis_excepciones(fecha,ambito,colaborador_id,tipo,nota) values
        ('2026-10-20','colaborador',1,'laborable_extra','Excepción anterior'),
        ('2026-10-25','colaborador',1,'laborable_extra','Domingo ajeno al acuerdo');
    `);
    const portal=sql('asistencia_migracion_6_portal.sql');
    for(const name of ['asis_hora_entrada','asis_hora_salida','asis_horas_dia','asis_labora'])await db.exec(definition(portal,name));
    await db.exec('alter function public.asis_labora(public.asis_colaboradores,date) rename to asis_labora_base_87');
    await db.exec(definition(sql('dashboard_87_descanso_presencial.sql'),'asis_labora'));
    const original=(await db.query('select to_jsonb(c) as c from public.asis_colaboradores c order by id')).rows;
    const migration=sql('dashboard_123_horario_temporal_ronny.sql');
    await db.exec(migration);
    await db.exec(migration);
    const days=(await db.query(`select f::date as fecha,public.asis_labora(c,f::date) as labora,
      public.asis_hora_entrada(c,f::date)::text as entrada,public.asis_hora_salida(c,f::date)::text as salida,
      public.asis_horas_dia(c,f::date)::float as horas from public.asis_colaboradores c,
      unnest(array[date '2026-10-20',date '2026-10-21',date '2026-10-22',date '2026-10-23',
        date '2026-10-26',date '2026-10-27',date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03']) f
      where c.id=1 order by f`)).rows;
    assert.equal(days.filter(d=>!d.labora).length,2);
    const shifts=days.filter(d=>d.labora);
    assert.equal(shifts.length,8);
    for(const day of shifts){assert.equal(day.entrada,'10:30:00');assert.equal(day.salida,'13:00:00');assert.equal(day.horas,2.5)}
    assert.equal(shifts.reduce((n,d)=>n+d.horas,0),20);
    assert.deepEqual((await db.query('select to_jsonb(c) as c from public.asis_colaboradores c order by id')).rows,original,'weekly hours, balances, modality and contractual targets remain unchanged');
    const normal=(await db.query(`select public.asis_hora_entrada(c,'2026-11-04')::text as entrada,
      public.asis_hora_salida(c,'2026-11-04')::text as salida from public.asis_colaboradores c where id=1`)).rows[0];
    assert.deepEqual(normal,{entrada:'08:15:00',salida:'13:15:00'},'next Wednesday uses the normal weekly schedule');
    assert.equal((await db.query("select public.asis_hora_entrada(c,'2026-10-21')::text as entrada from public.asis_colaboradores c where id=2")).rows[0].entrada,'09:00:00');
    assert.deepEqual((await db.query('select colaborador_id,fecha::text,estado,horas::float from public.asis_registros')).rows,[{colaborador_id:1,fecha:'2026-10-20',estado:'P',horas:5}]);
    assert.equal((await db.query('select count(*)::int as n from public.asis_horarios_puntuales')).rows[0].n,8);
    assert.equal((await db.query('select count(*)::int as n from public.asis_historial_contrato')).rows[0].n,1,'reapplying does not duplicate the audit');
    assert.equal((await db.query('select count(*)::int as n from public.asis_excepciones')).rows[0].n,11);
    assert.equal((await db.query("select tipo from public.asis_excepciones where fecha='2026-10-25'")).rows[0].tipo,'laborable_extra');
    const privileges=(await db.query(`select
      has_table_privilege('authenticated','public.asis_horarios_puntuales','SELECT') as puede_leer,
      has_table_privilege('authenticated','public.asis_horarios_puntuales','INSERT') as puede_insertar,
      has_function_privilege('anon','public.asis_hora_entrada(public.asis_colaboradores,date)','EXECUTE') as anon_helper`)).rows[0];
    assert.deepEqual(privileges,{puede_leer:false,puede_insertar:false,anon_helper:false});
    // The authorized reduced shift replaces a full-day assignment on that date,
    // retaining its prior record in the audit and leaving other dates untouched.
    await db.exec("insert into public.asis_descansos_presenciales values(1,'2026-10-23')");
    await db.exec("insert into public.asis_descansos_presenciales values(1,'2026-11-05')");
    await db.exec(migration);
    assert.equal((await db.query('select count(*)::int as n from public.asis_descansos_presenciales')).rows[0].n,1);
    assert.equal((await db.query("select public.asis_labora(c,'2026-10-23') as labora from public.asis_colaboradores c where id=1")).rows[0].labora,true);
    assert.equal((await db.query('select count(*)::int as n from public.asis_historial_contrato')).rows[0].n,2);
    assert.equal((await db.query("select horario_anterior->'descansos_completos_sustituidos' as previos from public.asis_historial_contrato where jsonb_array_length(horario_anterior->'descansos_completos_sustituidos')>0")).rows[0].previos[0].fecha,'2026-10-23');
    await db.exec(migration);
    assert.equal((await db.query('select count(*)::int as n from public.asis_historial_contrato')).rows[0].n,2);
    // Reconcile old late statuses with the newly approved dated schedule.
    await db.exec(definition(sql('dashboard_12_marcado_blindado.sql'),'asis_ventana'));
    await db.exec(`
      create table public.asis_portal_config(id integer,tolerancia_min integer);
      insert into public.asis_portal_config values(1,15);
      insert into public.asis_registros values
        (1,'2026-10-21','T',0,'2026-10-21 10:30:00-05'),
        (1,'2026-10-23','T',0,'2026-10-23 10:46:00-05'),
        (1,'2026-10-26','T',2.5,'2026-10-26 10:45:59-05'),
        (1,'2026-10-27','T',0,'2026-10-27 10:29:00-05'),
        (1,'2026-10-28','J',5,'2026-10-28 10:30:00-05'),
        (1,'2026-10-29','T',0,null),
        (1,'2026-11-02','P',0,'2026-11-02 10:30:00-05'),
        (1,'2026-11-03','T',0,'2026-11-04 10:30:00-05'),
        (1,'2026-11-04','T',5,'2026-11-04 10:30:00-05'),
        (2,'2026-10-21','T',0,'2026-10-21 10:30:00-05');
    `);
    const recordedBefore=(await db.query('select colaborador_id,fecha::text,horas::float,marcado_at::text from public.asis_registros order by colaborador_id,fecha')).rows;
    const punctuality=sql('dashboard_124_recalcular_puntualidad_ronny.sql');
    await db.exec(punctuality);await db.exec(punctuality);
    assert.deepEqual((await db.query('select colaborador_id,fecha::text,horas::float,marcado_at::text from public.asis_registros order by colaborador_id,fecha')).rows,recordedBefore,'the repair preserves actual entry times and credited hours');
    const states=(await db.query('select colaborador_id,fecha::text,estado from public.asis_registros order by colaborador_id,fecha')).rows;
    assert.deepEqual(states.map(r=>r.estado),['P','P','T','P','P','J','T','P','T','T','T']);
    assert.equal((await db.query("select count(*)::int as n from public.asis_historial_contrato where tipo='otro'")).rows[0].n,1,'repair is audited once');

    // An explicitly requested private notice is published only after verifying
    // the actual schedule. Re-running does not duplicate it or reset read state.
    await db.exec(`create table public.asis_notificaciones(
      colaborador_id bigint,tipo text,titulo text,mensaje text check(char_length(mensaje)<=700),
      fecha date,actor_id uuid,datos jsonb,dedupe_key text,creado_at timestamptz default now(),leida_at timestamptz);
      create unique index notice_dedupe on public.asis_notificaciones(dedupe_key) where dedupe_key is not null`);
    const notice=sql('dashboard_126_notificar_horario_temporal_ronny.sql');
    await db.exec(notice);
    await db.exec('update public.asis_notificaciones set leida_at=now()');
    await db.exec(notice);
    const notices=(await db.query('select colaborador_id,tipo,mensaje,datos,leida_at is not null as leida from public.asis_notificaciones')).rows;
    assert.equal(notices.length,1);
    assert.equal(notices[0].colaborador_id,1);
    assert.equal(notices[0].tipo,'mensaje_direccion');
    assert.equal(notices[0].leida,true);
    assert.equal(notices[0].datos.retorno_habitual,'2026-11-04');
    assert.match(notices[0].mensaje,/4 de noviembre de 2026.*automáticamente/);

    // A historical document belonging to someone else must never select them.
    // If the full name is ambiguous, the script reports candidates and rolls back.
    await db.exec("insert into public.asis_colaboradores(id,nombre,activo) values(3,'Ronny Yural Ruiz Pinillos',true)");
    await assert.rejects(db.exec(migration),/una sola persona activa.*ID 1:.*ID 3:/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from public.asis_historial_contrato')).rows[0].n,3);

    // The directory must expose effective dated schedules using its existing
    // authorized scope, rather than replacing the recurring weekly timetable.
    await db.exec(definition(sql('dashboard_13_modalidad_y_geocerca.sql'),'asis_modalidad_base'));
    await db.exec(`create function public.dash_admin_equipo(p_incluir_inactivos boolean default false)
      returns jsonb language sql security definer as $$
      select case when current_setting('test.denied',true)='yes' then '{"ok":false,"motivo":"sin_permiso"}'::jsonb
      else jsonb_build_object('ok',true,'personas',(select jsonb_agg(to_jsonb(c)) from public.asis_colaboradores c where id=1)) end $$`);
    const directory=sql('dashboard_125_directorio_horarios_temporales.sql').replaceAll('now()',"timestamptz '2026-10-21 15:00:00+00'");
    await db.exec(directory);await db.exec(directory);
    const directoryData=(await db.query('select public.dash_admin_equipo(false) as data')).rows[0].data;
    assert.equal(directoryData.hoy,'2026-10-21');
    assert.equal(directoryData.personas.length,1,'do not add people outside the base RPC scope');
    const ronny=directoryData.personas[0];
    assert.deepEqual(ronny.horario_semanal,original[0].c.horario_semanal);
    assert.equal(ronny.semana_vigente.length,7);
    assert.equal(ronny.semana_vigente[0].fecha,'2026-10-19');
    assert.equal(ronny.semana_vigente[1].laborable,false);
    assert.equal(ronny.semana_vigente[2].entrada,'10:30:00');
    assert.equal(ronny.semana_vigente[2].temporal,true);
    assert.equal(ronny.semana_vigente[3].laborable,false);
    assert.equal(ronny.horarios_temporales.find(d=>d.fecha==='2026-11-03').entrada,'10:30:00');
    assert.equal((await db.query("select has_function_privilege('authenticated','public.dash_admin_equipo_base_125(boolean)','EXECUTE') as allowed")).rows[0].allowed,false);
    await db.exec("select set_config('test.denied','yes',false)");
    assert.deepEqual((await db.query('select public.dash_admin_equipo(false) as data')).rows[0].data,{ok:false,motivo:'sin_permiso'});

    // A dedicated 15-minute tolerance must override any global value on these
    // eight dates only, and the portal must publish that same deadline.
    await db.exec("select set_config('test.denied','no',false); update public.asis_colaboradores set activo=false where id=3");
    await db.exec(`create table public.asis_entradas_direccion(id uuid);
      create function public.asis_mi_dia(p_colab public.asis_colaboradores,p_tol integer) returns jsonb language sql as $$
        select jsonb_build_object('tolerancia',p_tol,'limite',public.asis_hora_entrada(p_colab,date '2026-10-21')+make_interval(mins=>p_tol)) $$;
      update public.asis_portal_config set tolerancia_min=0;
      update public.asis_registros set estado='T' where colaborador_id=1 and fecha='2026-10-21';
    `);
    const tolerance=sql('dashboard_127_puntualidad_horario_temporal_ronny.sql').replaceAll('now()',"timestamptz '2026-10-21 15:00:00+00'");
    await db.exec(tolerance);await db.exec(tolerance);
    const windows=(await db.query(`select h.fecha::text,h.hora_fin::text,
      public.asis_ventana(c,h.fecha,time '10:29',0) as antes,
      public.asis_ventana(c,h.fecha,time '10:30',0) as inicio,
      public.asis_ventana(c,h.fecha,time '10:45:59',0) as puntual,
      public.asis_ventana(c,h.fecha,time '10:46',120) as tarde,
      public.asis_ventana(c,h.fecha,time '13:01',120) as cerrada
      from public.asis_horarios_puntuales h join public.asis_colaboradores c on c.id=h.colaborador_id where c.id=1 order by h.fecha`)).rows;
    assert.equal(windows.length,8);
    for(const row of windows){assert.equal(row.antes,'antes');assert.equal(row.inicio,'presente');assert.equal(row.puntual,'presente');assert.equal(row.tarde,'tardanza');assert.equal(row.cerrada,'cerrada');assert.equal(row.hora_fin,'13:00:00')}
    assert.deepEqual((await db.query("select public.asis_mi_dia(c,0) as dia from public.asis_colaboradores c where id=1")).rows[0].dia,{tolerancia:15,limite:'10:45:00'});
    assert.equal((await db.query("select public.asis_ventana(c,'2026-11-04',time '08:16',0) as window from public.asis_colaboradores c where id=1")).rows[0].window,'tardanza','usual schedule and tolerance return after the temporary period');
    assert.equal((await db.query("select public.asis_ventana(c,'2026-10-21',time '09:01',0) as window from public.asis_colaboradores c where id=2")).rows[0].window,'tardanza','other people retain the global tolerance');
    assert.equal((await db.query("select estado from public.asis_registros where colaborador_id=1 and fecha='2026-10-21'")).rows[0].estado,'P');
    assert.equal((await db.query("select estado from public.asis_registros where colaborador_id=1 and fecha='2026-10-23'")).rows[0].estado,'T','real lateness remains late');
    const updatedDirectory=(await db.query('select public.dash_admin_equipo(false) as data')).rows[0].data;
    assert.equal(updatedDirectory.personas[0].horarios_temporales.find(d=>d.fecha==='2026-10-21').puntual_hasta,'10:45:00');
  }finally{await db.close();}
});
