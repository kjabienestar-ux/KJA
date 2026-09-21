// node tests/alviery-month-sql-check.mjs <ruta-a-pglite/dist/index.js>
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create table asis_colaboradores(id bigint primary key,nombre text,dni text);
    insert into asis_colaboradores values(1,'Alviery Gonzales Chonta','73939131'),(2,'Otro colaborador','otro');
    create table asis_registros(colaborador_id bigint,fecha date,estado text,salida_at timestamptz,cierre_regularizado boolean);
    insert into asis_registros values
      (1,'2026-09-08','P',null,false),(1,'2026-09-09','T',null,false),
      (1,'2026-09-10','P',null,false),(2,'2026-09-08','P',null,false);
    create table asis_cierre_config(id int,habilitado boolean,obligatorio_desde date,salida_gracia_min int);
    insert into asis_cierre_config values(1,true,'2026-09-07',30);
    create function asis_es_miembro() returns boolean language sql as $$select coalesce(current_setting('test.member',true),'true')='true'$$;
    create function asis_labora(asis_colaboradores,date) returns boolean language sql as $$select true$$;
    create function asis_cierre_fin_at(bigint,date) returns timestamptz language sql as $$select now()-interval '2 days'$$;
    create function dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date) returns jsonb language sql as $$
      select jsonb_build_object('ok',true,'aplica',true,'aplica_jornada',true,
        'entrada_at','2026-09-08T14:00:00Z','estado','incompleta','comparticiones_vencidas',p_fecha=date '2026-09-10',
        'requisitos',jsonb_build_array(jsonb_build_object('tipo','rpe','completo',false),
          jsonb_build_object('tipo','comparticiones','completo',p_fecha<>date '2026-09-10')),
        'asignaciones',jsonb_build_array(jsonb_build_object('id',1,'completo',false)))
    $$;
  `);
  const exception=await fs.readFile('supabase/dashboard_68_alviery_asistencia_comparticiones.sql','utf8');
  await db.exec(exception.split('-- El ranking mantiene')[0]+'\ncommit;');
  const migration=await fs.readFile('supabase/dashboard_69_alviery_cierre_mensual.sql','utf8');
  await db.exec(migration);
  await db.exec(migration); // Safe to apply again.
  await db.exec('set role authenticated');
  const read=async()=> (await db.query('select dash_admin_cierres_mes(2026,9) as data')).rows[0].data;
  let data=await read();
  assert.equal(data.ok,true);
  const state=(id,date)=>data.cierres.find(x=>x.colaborador_id===id&&x.fecha===date)?.estado;
  assert.equal(state(1,'2026-09-08'),'completa');
  assert.equal(state(1,'2026-09-09'),'completa');
  assert.equal(state(1,'2026-09-10'),'incompleta');
  assert.equal(state(2,'2026-09-08'),'incompleta');
  assert.ok(data.cierres.every(x=>x.salida_at===null));
  assert.equal((await db.query('select dash_admin_cierres_mes(2026,13) as data')).rows[0].data.motivo,'periodo');
  await db.exec("set test.member='false'");
  assert.equal((await read()).motivo,'sin_permiso');
  console.log('OK: September 8/9 complete without exit; missing shares, other users, access and period validation preserved.');
} finally {await db.close();}
