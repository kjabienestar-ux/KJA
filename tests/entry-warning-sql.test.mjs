import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('entry warning is authorized, atomic, audited, idempotent and preserves attendance',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function dash_sesion_vigente() returns boolean language sql as $$select current_setting('test.session',true)='yes'$$;
      create function asis_rol() returns text language sql as $$select current_setting('test.role',true)$$;
      create table asis_registros(id bigint primary key,colaborador_id bigint,fecha date,evidencia_path text,marcado_at timestamptz,salida_at timestamptz,horas numeric,estado text);
      create table asis_notificaciones(colaborador_id bigint,tipo text,titulo text,mensaje text check(length(mensaje)<=700),fecha date,actor_id uuid,datos jsonb,dedupe_key text unique);
      create function dash_equipo_dia_detalle(bigint,date) returns jsonb language sql as $$select jsonb_build_object('ok',current_setting('test.read',true)='yes')$$;
      insert into asis_registros values(10,20,'2026-01-01','entry.jpg','2026-01-01 13:00Z','2026-01-01 18:00Z',5,'P'),(11,30,'2026-01-01','other.jpg','2026-01-01 13:00Z',null,0,'P');
      set test.role='lider';set test.session='yes';set test.read='yes';`);
    const sql=fs.readFileSync('supabase/dashboard_116_advertencia_evidencia_entrada.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const warn=async(path='entry.jpg',reason='La captura corresponde a otra fecha',person=20)=>(await db.query('select dash_admin_advertir_entrada($1,$2,$3,$4) result',[person,'2026-01-01',path,reason])).rows[0].result;
    assert.equal((await warn()).motivo,'sin_permiso');
    await db.exec("set test.role='direccion';set test.session='no'");assert.equal((await warn()).motivo,'sin_permiso');
    await db.exec("set test.session='yes'");
    assert.equal((await warn('other.jpg')).motivo,'archivo_ajeno');assert.equal((await warn('entry.jpg','')).motivo,'datos');
    assert.equal((await warn('entry.jpg','x'.repeat(401))).motivo,'datos');
    const before=(await db.query('select * from asis_registros where id=10')).rows[0];
    assert.equal((await warn()).ok,true);assert.equal((await warn()).ya_notificada,true);
    const after=(await db.query('select * from asis_registros where id=10')).rows[0];
    assert.deepEqual(after,{...before,evidencia_path:null});
    const notices=(await db.query('select * from asis_notificaciones')).rows;
    assert.equal(notices.length,1);assert.equal(notices[0].colaborador_id,20);assert.equal(notices[0].tipo,'mensaje_direccion');
    assert.match(notices[0].mensaje,/por considerarla falsa/);assert.match(notices[0].mensaje,/La captura corresponde a otra fecha/);assert.match(notices[0].mensaje,/carta de advertencia/);
    assert.equal((await db.query('select * from asis_entrada_advertencias')).rows.length,1);
    const detail=() => db.query("select dash_equipo_dia_detalle(20,'2026-01-01') result");
    const notice=(await detail()).rows[0].result.entrada_advertencia;
    assert.match(notice.mensaje,/carta de advertencia/);assert.equal(notice.path,undefined);
    await db.exec("set test.read='no'");assert.equal((await detail()).rows[0].result.entrada_advertencia,undefined);
    // Simulate a notification failure: neither evidence nor audit may change.
    await db.exec("alter table asis_notificaciones add constraint reject_other check(colaborador_id<>30)");
    await assert.rejects(warn('other.jpg','La imagen no corresponde',30),/reject_other/);
    assert.equal((await db.query('select evidencia_path from asis_registros where id=11')).rows[0].evidencia_path,'other.jpg');
    assert.equal((await db.query('select * from asis_entrada_advertencias')).rows.length,1);
    await db.exec('set role authenticated');await assert.rejects(db.query('select * from asis_entrada_advertencias'),/permission denied/);
  }finally{await db.close();}
});
