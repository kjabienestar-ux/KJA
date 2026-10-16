import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('shared quota allows analysis 200, blocks 201, retains minute limit and cache',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table marketing_publicaciones(id uuid primary key,autor uuid,estado text,extraccion jsonb,lectura_inicio timestamptz,lectura_token uuid);
      create table marketing_lecturas(autor uuid,modelo text,creado_at timestamptz default now());
      insert into marketing_publicaciones values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','borrador',null,null,null);`);
    const sql=fs.readFileSync('supabase/marketing_04_limite_200_analisis.sql','utf8');await db.exec(sql);await db.exec(sql);
    const read=async()=> (await db.query("select marketing_iniciar_lectura('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','test') result")).rows[0].result;
    await db.exec("insert into marketing_lecturas(modelo,creado_at) select 'test',now()-interval '2 hours' from generate_series(1,199)");
    assert.ok((await read()).token);
    await db.exec('update marketing_publicaciones set lectura_inicio=null');
    assert.match((await read()).error,/200 lecturas/);
    await db.exec("update marketing_publicaciones set extraccion='{}'");assert.equal((await read()).cache,true);
    await db.exec("update marketing_publicaciones set extraccion=null;delete from marketing_lecturas;insert into marketing_lecturas(modelo) select 'test' from generate_series(1,5)");
    assert.match((await read()).error,/5 lecturas por minuto/);
  }finally{await db.close();}
});
