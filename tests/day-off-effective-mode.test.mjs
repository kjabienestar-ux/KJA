import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('effective presencial mode grants leave with real attendance, without overriding virtual marks or manual leave',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;
      create table asis_colaboradores(id bigint primary key,nombre text,activo boolean,modalidad text);
      create table asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,modalidad_marcada text);
      create table asis_descansos_presenciales(colaborador_id bigint,fecha date,fecha_presencial date,motivo text,primary key(colaborador_id,fecha));
      insert into asis_colaboradores select n,'Laura '||n,n<>5,'presencial' from generate_series(1,7) n;
      insert into asis_registros values
        (1,'2026-10-02','P',now(),null),(2,'2026-10-02','P',now(),'virtual'),
        (3,'2026-10-02','P',null,null),(4,'2026-10-02','J',now(),null),
        (5,'2026-10-02','P',now(),null),(6,'2026-10-02','T',now(),null);
      insert into asis_descansos_presenciales values(6,'2026-10-05',null,'Premio manual');
      create function asis_modalidad_efectiva(p_colaborador bigint,p_fecha date) returns text language sql stable as $$
        select coalesce(nullif(r.modalidad_marcada,''),c.modalidad) from asis_colaboradores c
        left join asis_registros r on r.colaborador_id=c.id and r.fecha=p_fecha where c.id=p_colaborador$$;`);
    const migration=fs.readFileSync('supabase/dashboard_90_descanso_modalidad_efectiva.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    assert.deepEqual((await db.query('select colaborador_id from asis_descansos_presenciales order by 1')).rows.map(r=>r.colaborador_id),[1,6]);
    assert.equal((await db.query('select motivo from asis_descansos_presenciales where colaborador_id=6')).rows[0].motivo,'Premio manual');
    await db.exec(`create trigger test_descanso after insert or update on asis_registros for each row execute function asis_otorgar_descanso_al_corregir();
      update asis_registros set modalidad_marcada='presencial' where colaborador_id=2;`);
    assert.equal((await db.query('select count(*)::int n from asis_descansos_presenciales')).rows[0].n,3);
    assert.equal((await db.query('select count(*)::int n from asis_registros')).rows[0].n,6);
  }finally{await db.close();}
});
