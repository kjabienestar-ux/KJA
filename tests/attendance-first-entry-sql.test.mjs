import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('team RPC returns first real entry across all months without modifying attendance',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated;
      create function public.dash_colab() returns bigint language sql as $$ select 1::bigint $$;
      create function public.dash_sesion_vigente() returns boolean language sql as $$ select true $$;
      create table public.asis_areas(id bigint,nombre text);
      create table public.asis_colaboradores(id bigint,nombre text,area_id bigint,activo boolean,
        dias_laborables int[],horario_semanal jsonb,hora_inicio time,hora_fin time,foto_path text,foto_actualizada_at timestamptz);
      create table public.asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz);
      insert into public.asis_areas values(1,'Ingeniería'),(2,'Otra área');
      insert into public.asis_colaboradores(id,nombre,area_id,activo) values
        (1,'Antiguo',1,true),(2,'Nuevo',1,true),(3,'Sin entrada',1,true),(4,'Otra área',2,true),(5,'Inactivo',1,false);
      insert into public.asis_registros values
        (1,'2026-08-10','P','2026-08-10 13:00Z'),
        (1,'2026-09-01','P','2026-09-01 13:00Z'),
        (2,'2026-09-01','NG','2026-09-01 13:00Z'),
        (2,'2026-09-02','J','2026-09-02 13:00Z'),
        (2,'2026-09-03','P',null),
        (2,'2026-09-14','T','2026-09-14 13:20Z'),
        (2,'2026-09-15','P','2026-09-15 13:00Z');
    `);
    const migration=fs.readFileSync(new URL('../supabase/dashboard_77_companeros_primera_asistencia.sql',import.meta.url),'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const {rows}=await db.query('select public.dash_horarios_companeros() as data');
    assert.equal(rows[0].data.ok,true);
    const people=new Map(rows[0].data.personas.map(p=>[p.id,p]));
    assert.equal(people.size,3);
    assert.equal(people.get(1).primera_asistencia,'2026-08-10');
    assert.equal(people.get(2).primera_asistencia,'2026-09-14');
    assert.equal(people.get(3).primera_asistencia,null);
    assert.equal((await db.query('select count(*)::int as n from public.asis_registros')).rows[0].n,7);
    await db.exec('create or replace function public.dash_sesion_vigente() returns boolean language sql as $$ select false $$');
    assert.equal((await db.query('select public.dash_horarios_companeros() as data')).rows[0].data.motivo,'sin_permiso');
  }finally{await db.close();}
});
