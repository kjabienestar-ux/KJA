import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('manual leave enforces permissions, validates dates, audits grants and removals, and preserves the presencial benefit',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '11111111-1111-1111-1111-111111111111'::uuid$$;
      create function dash_sesion_vigente() returns boolean language sql as $$select coalesce(current_setting('test.session',true),'yes')='yes'$$;
      create function asis_puede_editar() returns boolean language sql as $$select coalesce(current_setting('test.editor',true),'yes')='yes'$$;
      create table asis_perfiles(id uuid primary key);
      insert into asis_perfiles values(auth.uid());
      create table asis_colaboradores(id bigint primary key,activo boolean,contrato_inicio date,comparticiones_horario_configurado boolean);
      insert into asis_colaboradores values(1,true,'2026-09-01',false),(2,true,'2026-09-01',false),(3,false,'2026-09-01',false);
      create table asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,modalidad_marcada text);
      insert into asis_registros values(2,'2026-10-02','P',now(),'presencial');
      create function asis_labora(p_colab asis_colaboradores,p_fecha date) returns boolean language sql as $$select true$$;
      create function asis_compartir_programado(p_colab bigint,p_fecha date) returns boolean language sql as $$select asis_labora(c,p_fecha) from asis_colaboradores c where id=p_colab$$;
      create function dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date) returns jsonb language sql as $$select '{"ok":true,"requisitos":[{"tipo":"comparticiones","completo":false},{"tipo":"rpe","completo":false}]}'::jsonb$$;
      create function dash_admin_mes(p_anio integer,p_mes integer,p_incluir_inactivos boolean default false) returns jsonb language sql as $$
        select case when dash_sesion_vigente() then '{"ok":true,"personas":[{"id":1},{"id":2}]}'::jsonb else '{"ok":false}'::jsonb end$$;`);
    await db.exec(fs.readFileSync('supabase/dashboard_87_descanso_presencial.sql','utf8'));
    const migration=fs.readFileSync('supabase/dashboard_88_dias_libres_manuales.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const save=async(id,date,reason='Meta cumplida',remove=false)=>(await db.query('select dash_admin_dia_libre($1,$2,$3,$4) value',[id,date,reason,remove])).rows[0].value;
    await db.exec("set test.editor='no'");assert.equal((await save(1,'2026-11-03')).motivo,'sin_permiso');
    await db.exec("set test.editor='yes';set test.session='no'");assert.equal((await save(1,'2026-11-03')).motivo,'sin_permiso');
    await db.exec("set test.session='yes'");
    assert.equal((await save(1,null)).motivo,'fecha');
    assert.equal((await save(1,'2026-08-01')).motivo,'colaborador');
    assert.equal((await save(3,'2026-11-03')).motivo,'colaborador');
    assert.equal((await save(1,'2026-11-03','')).motivo,'detalle');
    assert.equal((await save(1,'2026-11-03')).ok,true);
    assert.equal((await save(1,'2026-11-03')).motivo,'ya_asignado');
    let behavior=(await db.query("select asis_labora(c,'2026-11-03') work,asis_compartir_programado(id,'2026-11-03') facebook,dash_cierre_resumen_colab(id,'2026-11-03') closure from asis_colaboradores c where id=1")).rows[0];
    assert.equal(behavior.work,false);assert.equal(behavior.facebook,true);
    assert.equal(behavior.closure.dia_libre_presencial,true);assert.equal(behavior.closure.requiere_salida,false);
    assert.deepEqual(behavior.closure.requisitos.map(x=>x.tipo),['comparticiones']);
    const month=async(m)=>(await db.query('select dash_admin_mes(2026,$1) value',[m])).rows[0].value;
    assert.equal((await month(11)).dias_libres[0].manual,true);
    assert.equal((await month(10)).dias_libres[0].manual,false);
    assert.equal((await save(2,'2026-10-05','',true)).motivo,'beneficio_presencial');
    assert.equal((await save(1,'2026-11-03','',true)).ok,true);
    assert.equal((await db.query("select asis_labora(c,'2026-11-03') work from asis_colaboradores c where id=1")).rows[0].work,true);
    assert.equal((await month(11)).dias_libres.length,0);
    assert.deepEqual((await db.query('select accion from asis_descansos_auditoria order by id')).rows.map(x=>x.accion),['asignar','quitar']);
    assert.equal((await db.query('select count(*)::int n from asis_registros')).rows[0].n,1);
  }finally{await db.close();}
});

test('month ledger excludes manual leave from missing entry and exposes a labelled day off',()=>{
  const source=fs.readFileSync('assets/js/dashboard-admin-mes.js','utf8');
  const ctx=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function mergeAdminMonthClosures('),source.indexOf('async function loadAdminMonth(')),ctx);
  vm.runInContext(source.slice(source.indexOf('function monthCellClass('),source.indexOf('function closeAdminPersonCalendar(')),ctx);
  const day={fecha:'2026-10-05',laborable:true};
  const data={hoy:'2026-10-05',personas:[{id:1,dias:[day]}],dias_libres:[{colaborador_id:1,fecha:day.fecha,motivo:'Meta cumplida'}]};
  ctx.mergeAdminMonthClosures(data,{cierres:[]});
  assert.equal(day.laborable,false);assert.equal(day.dia_libre,true);
  assert.equal(data.personas[0].resumen.pendientes,0);
  assert.match(ctx.monthCellClass(day),/day-off/);
});
