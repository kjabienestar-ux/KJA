import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('contract metadata preserves authorized history, scope and original states',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
    create role anon;create role authenticated;
    create table asis_colaboradores(id bigint,contrato_inicio date,contrato_fin_referencia date);
    insert into asis_colaboradores values(1,'2026-09-07','2026-09-25'),(2,'2026-01-01',null);
    create function dash_colab() returns bigint language sql as $$select 1::bigint$$;
    create function dash_historial(p_anio int,p_mes int,p_colab bigint default null) returns jsonb language sql as $$
      select case when coalesce(p_colab,1)=99 then '{"ok":false,"motivo":"sin_permiso"}'::jsonb
        when p_mes not between 1 and 12 then '{"ok":false,"motivo":"fecha"}'::jsonb
        else '{"ok":true,"dias":[{"fecha":"2026-09-26","lab":false,"aplica_comparticiones":true}],"horas":12}'::jsonb end $$;
  `);
  const migration=fs.readFileSync('supabase/dashboard_83_calendario_contrato.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const get=async(id,month=9)=>(await db.query('select dash_historial(2026,$1,$2) data',[month,id])).rows[0].data;
  const own=await get(null);
  assert.deepEqual(own.calendario_contrato,{contrato_inicio:'2026-09-07',contrato_fin_referencia:'2026-09-25'});
  assert.equal(own.dias[0].aplica_comparticiones,true);assert.equal(own.horas,12);
  assert.equal((await get(2)).calendario_contrato.contrato_fin_referencia,null);
  assert.deepEqual(await get(99),{ok:false,motivo:'sin_permiso'});
  assert.deepEqual(await get(1,13),{ok:false,motivo:'fecha'});
  assert.deepEqual((await db.query("select has_function_privilege('anon','dash_historial(integer,integer,bigint)','execute') anon,has_function_privilege('authenticated','dash_historial_base_83(integer,integer,bigint)','execute') base")).rows[0],{anon:false,base:false});
 }finally{await db.close();}
});
