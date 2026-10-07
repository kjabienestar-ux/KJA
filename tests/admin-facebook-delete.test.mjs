import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Direction can remove historical Facebook evidence with audit, ownership checks and retry',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.session',true)='yes'$$;
      create function asis_rol() returns text language sql as $$select current_setting('test.role',true)$$;
      create table asis_entregas_diarias(id bigint primary key,colaborador_id bigint,requisito text,fecha date,estado text,revision_estado text,revision_nota text,cantidad_compartida integer);
      create table asis_entrega_archivos(entrega_id bigint,path text,mime text);
      create table asis_carga_permisos(path text,colaborador_id bigint);
      create table asis_facebook_archivos_borrar(entrega_id bigint,colaborador_id bigint,path text,primary key(entrega_id,path));
      insert into asis_entregas_diarias values(10,20,'comparticiones','2026-01-01','completo','aprobada','OK',50),(11,30,'rpe','2026-01-01','completo','pendiente',null,null);
      insert into asis_entrega_archivos values(10,'one.jpg','image/jpeg'),(10,'two.jpg','image/jpeg'),(11,'rpe.jpg','image/jpeg');
      insert into asis_carga_permisos values('one.jpg',20),('two.jpg',20);
      set test.session='yes';set test.role='lider';`);
    const migration=fs.readFileSync('supabase/dashboard_102_retirar_facebook_direccion.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const remove=async(id,path)=>(await db.query('select dash_admin_retirar_imagen_facebook($1,$2) result',[id,path])).rows[0].result;
    assert.equal((await remove(10,'one.jpg')).ok,false);
    await db.exec("set test.role='direccion';set test.session='no'");
    assert.equal((await remove(10,'one.jpg')).ok,false);
    await db.exec("set test.session='yes'");
    assert.equal((await remove(11,'rpe.jpg')).motivo,'sin_entrega');
    assert.equal((await remove(10,'rpe.jpg')).motivo,'archivo_ajeno');
    assert.equal((await remove(10,'one.jpg')).ok,true);
    let row=(await db.query('select * from asis_entregas_diarias where id=10')).rows[0];
    assert.equal(row.estado,'completo');assert.equal(row.revision_estado,'pendiente');assert.equal(row.cantidad_compartida,null);
    assert.equal((await remove(10,'one.jpg')).ok,true);
    assert.equal((await db.query('select * from asis_facebook_retiros_direccion')).rows.length,1);
    assert.equal((await remove(10,'two.jpg')).ok,true);
    row=(await db.query('select * from asis_entregas_diarias where id=10')).rows[0];
    assert.equal(row.estado,'anulado');
    assert.equal((await remove(10,'two.jpg')).ok,true);
    assert.equal((await db.query('select * from asis_carga_permisos')).rows.length,0);
    assert.equal((await db.query('select * from asis_entrega_archivos')).rows[0].path,'rpe.jpg');
    const audit=(await db.query('select * from asis_facebook_retiros_direccion')).rows;
    assert.equal(audit.length,2);assert.equal(audit[0].colaborador_id,20);assert.equal(audit[0].actor_id,'00000000-0000-0000-0000-000000000001');
  }finally{await db.close();}
});
