import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('repairs already corrected attendance and grants leave on later corrections without overwriting manual leave',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;
      create table asis_colaboradores(id bigint primary key,activo boolean);
      create table asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,modalidad_marcada text);
      create table asis_descansos_presenciales(colaborador_id bigint,fecha date,fecha_presencial date,motivo text,primary key(colaborador_id,fecha));
      insert into asis_colaboradores values(1,true),(2,true),(3,true),(4,true),(5,false),(6,true);
      insert into asis_registros values
        (1,'2026-10-02','P',now(),'presencial'),
        (2,'2026-10-02','T',now(),'virtual'),
        (3,'2026-10-02','P',now(),'virtual'),
        (4,'2026-10-03','P',now(),'virtual'),
        (5,'2026-10-02','P',now(),'virtual'),
        (6,'2026-10-02','J',null,'virtual');
      insert into asis_descansos_presenciales values(3,'2026-10-05',null,'Premio manual');`);
    const original=fs.readFileSync('supabase/dashboard_87_descanso_presencial.sql','utf8');
    await db.exec(original.slice(original.indexOf('create or replace function public.asis_otorgar_descanso_presencial'),original.indexOf('do $$ begin')));
    const migration=fs.readFileSync('supabase/dashboard_89_descanso_modalidad_corregida.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const ids=async()=>(await db.query('select colaborador_id from asis_descansos_presenciales order by 1')).rows.map(r=>r.colaborador_id);
    assert.deepEqual(await ids(),[1,3]);
    await db.exec("update asis_registros set modalidad_marcada='presencial' where colaborador_id in (2,3,4,5,6)");
    assert.deepEqual(await ids(),[1,2,3]);
    const manual=(await db.query('select * from asis_descansos_presenciales where colaborador_id=3')).rows[0];
    assert.equal(manual.fecha_presencial,null);assert.equal(manual.motivo,'Premio manual');
    await db.exec("update asis_registros set estado='P',marcado_at=now() where colaborador_id=6");
    assert.deepEqual(await ids(),[1,2,3,6]);
    await db.exec("update asis_registros set modalidad_marcada='presencial' where colaborador_id=2");
    assert.deepEqual(await ids(),[1,2,3,6]);
    assert.equal((await db.query('select count(*)::int n from asis_registros')).rows[0].n,6);
  }finally{await db.close();}
});
