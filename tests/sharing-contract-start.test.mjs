import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('sharing starts inclusively at contract date and preserves schedule and rest rules',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create table asis_colaboradores(id bigint primary key,contrato_inicio date,comparticiones_horario_configurado boolean);
   create table asis_descansos_presenciales(colaborador_id bigint,fecha date);
   create function asis_labora_base_87(asis_colaboradores,date) returns boolean language sql as $$select true$$;
   create function asis_compartir_programado_base_87(bigint,date) returns boolean language sql as $$select extract(isodow from $2)<>7$$;
   insert into asis_colaboradores values(1,'2026-09-17',true),(2,'2026-09-17',false),(3,null,true);
   insert into asis_descansos_presenciales values(2,'2026-09-13'),(2,'2026-09-20');
  `);
  const sql=fs.readFileSync('supabase/dashboard_104_comparticiones_inicio_contrato.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  for(const [id,date,expected] of [[1,'2026-09-16',false],[1,'2026-09-17',true],[1,'2026-09-18',true],[1,'2026-09-20',false],[2,'2026-09-13',false],[2,'2026-09-20',true],[3,'2026-09-16',true],[999,'2026-09-17',false],[1,null,false]]){
   const result=await db.query('select asis_compartir_programado($1,$2) value',[id,date]);
   assert.equal(result.rows[0].value,expected,`${id}: ${date}`);
  }
 }finally{await db.close();}
});
