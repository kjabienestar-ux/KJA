import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('RPE and exit removal authorize Direction, audit, retry and preserve attendance',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.session',true)='yes'$$;
      create function asis_rol() returns text language sql as $$select current_setting('test.role',true)$$;
      create table asis_colaboradores(id bigint primary key);
      insert into asis_colaboradores values(20),(30);
      create table asis_entregas_diarias(id bigint primary key,colaborador_id bigint,requisito text,asignacion_id bigint,fecha date,estado text,revision_estado text,revision_nota text,revisado_at timestamptz,revisado_por uuid);
      create table asis_entrega_archivos(entrega_id bigint,path text,mime text);
      create table asis_carga_permisos(path text,colaborador_id bigint);
      create table asis_registros(colaborador_id bigint,fecha date,salida_at timestamptz,horas numeric);
      insert into asis_registros values(20,'2026-01-01','2026-01-02 00:14:00Z',5.2);
      insert into asis_entregas_diarias(id,colaborador_id,requisito,fecha,estado,revision_estado,revision_nota) values
        (10,20,'rpe','2026-01-01','completo','aprobada','OK'),
        (11,20,'salida','2026-01-01','completo','aprobada','OK'),
        (12,30,'rpe','2026-01-01','completo','pendiente',null),
        (13,20,'rpe','2026-01-01','anulado','pendiente',null),
        (14,20,'comparticiones','2026-01-01','completo','pendiente',null);
      insert into asis_entrega_archivos values(10,'rpe.jpg','image/jpeg'),(10,'video.mp4','video/mp4'),(11,'exit.jpg','image/jpeg'),(12,'other.jpg','image/jpeg'),(13,'rpe.jpg','image/jpeg'),(14,'facebook.jpg','image/jpeg');
      insert into asis_carga_permisos values('rpe.jpg',20),('video.mp4',20),('exit.jpg',20);
      set test.session='yes';set test.role='lider';`);
    const migration=fs.readFileSync('supabase/dashboard_115_retirar_evidencias_direccion.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const remove=async(id,path)=>(await db.query('select dash_admin_retirar_evidencia($1,$2) result',[id,path])).rows[0].result;
    assert.equal((await remove(10,'rpe.jpg')).motivo,'sin_permiso');
    await db.exec("set test.role='direccion';set test.session='no'");
    assert.equal((await remove(10,'rpe.jpg')).motivo,'sin_permiso');
    await db.exec("set test.session='yes'");
    assert.equal((await remove(10,'other.jpg')).motivo,'archivo_ajeno');
    assert.equal((await remove(14,'facebook.jpg')).motivo,'sin_entrega');
    await db.exec("insert into asis_entrega_archivos values(12,'rpe.jpg','image/jpeg')");
    assert.equal((await remove(10,'rpe.jpg')).motivo,'cambio_concurrente');
    await db.exec("delete from asis_entrega_archivos where entrega_id=12 and path='rpe.jpg'");
    assert.equal((await remove(10,'rpe.jpg')).ok,true);
    assert.equal((await remove(10,'rpe.jpg')).ok,true);
    let row=(await db.query('select * from asis_entregas_diarias where id=10')).rows[0];
    assert.equal(row.estado,'completo');assert.equal(row.revision_estado,'pendiente');assert.equal(row.revision_nota,null);
    assert.equal((await db.query("select * from asis_entrega_archivos where path='rpe.jpg'")).rows.length,0);
    assert.equal((await remove(10,'video.mp4')).ok,true);
    assert.equal((await remove(11,'exit.jpg')).ok,true);
    assert.equal((await remove(11,'exit.jpg')).ok,true);
    assert.equal((await db.query("select * from asis_entregas_diarias where id in (10,11) and estado='anulado'")).rows.length,2);
    assert.equal((await db.query('select * from asis_evidencias_retiros_direccion')).rows.length,3);
    assert.equal((await db.query('select * from asis_evidencias_archivos_borrar')).rows.length,3);
    assert.equal((await db.query('select * from asis_carga_permisos')).rows.length,0);
    row=(await db.query('select * from asis_registros')).rows[0];
    assert.equal(Number(row.horas),5.2);assert.equal(new Date(row.salida_at).toISOString(),'2026-01-02T00:14:00.000Z');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from asis_evidencias_retiros_direccion'),/permission denied/);
  }finally{await db.close();}
});
