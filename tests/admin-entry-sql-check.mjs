// node tests/admin-entry-sql-check.mjs <ruta-a-pglite/dist/index.js>
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const user='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const call=async(sql,params=[])=>(await db.query(sql,params)).rows[0].data;
try{
  await db.exec(`
    create role anon;create role authenticated;create schema auth;create schema storage;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function asis_rol() returns text language sql as $$select current_setting('test.role',true)$$;
    create function dash_sesion_vigente() returns boolean language sql as $$select coalesce(current_setting('test.session',true),'yes')='yes'$$;
    create table asis_perfiles(id uuid primary key);
    insert into asis_perfiles values('${user}'),('${other}');
    create table asis_colaboradores(id bigint primary key,activo boolean,nombre text,contrato_inicio date,horario_semanal jsonb,dias_laborables int[]);
    insert into asis_colaboradores values(1,true,'Colaborador de prueba',null,'{}',array[1,2,3,4,5,6,7]),(2,false,'Inactivo',null,'{}',array[1]);
    create table asis_portal_config(id int,tolerancia_min int);
    insert into asis_portal_config values(1,15);
    create table asis_registros(id bigint generated always as identity primary key,colaborador_id bigint,fecha date,estado text,nota text,
      marcado_por uuid,marcado_at timestamptz,origen text,horas numeric,vinculo text,evidencia_path text,evidencia_origen text,
      evidencia_at timestamptz,modalidad_marcada text,evidencia_lat numeric,evidencia_lon numeric,distancia_oficina_m numeric,
      unique(colaborador_id,fecha));
    create table asis_modalidades_diarias(colaborador_id bigint,fecha date,modalidad text,modalidad_base text,cambiado_por uuid,
      actualizado_at timestamptz default now(),primary key(colaborador_id,fecha));
    create table storage.objects(bucket_id text,name text,created_at timestamptz default now(),metadata jsonb);
    create function asis_labora(asis_colaboradores,date) returns boolean language sql as $$select coalesce(current_setting('test.labora',true),'yes')='yes'$$;
    create function asis_modalidad_base(asis_colaboradores,date) returns text language sql as $$select 'virtual'::text$$;
    create function asis_hora_entrada(asis_colaboradores,date) returns time language sql as $$select time '08:00'$$;
    create function asis_hora_salida(asis_colaboradores,date) returns time language sql as $$select time '13:00'$$;
    create function asis_horas_dia(asis_colaboradores,date) returns numeric language sql as $$select 5::numeric$$;
    create function asis_vinc_dia(asis_colaboradores,date) returns text language sql as $$select 'practicas'::text$$;
    set test.uid='${user}';set test.role='direccion';
  `);
  await db.exec(await fs.readFile('supabase/dashboard_73_modalidad_dia_marcada.sql','utf8'));
  const migration=await fs.readFile('supabase/dashboard_74_entrada_direccion.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const date=await call("select ((now() at time zone 'America/Lima')::date-1)::text data");
  const permit=async(extra={})=>{
    const p={id:1,date,time:'08:15',mode:'presencial',note:'Evidencia recibida por WhatsApp; sin celular.',...extra};
    return call('select dash_admin_entrada_permiso($1,$2,$3,$4,$5) data',[p.id,p.date,p.time,p.mode,p.note]);
  };
  const confirm=id=>call('select dash_admin_confirmar_entrada($1) data',[id]);
  const upload=async(p,mime='image/jpeg',size=150000)=>db.query("insert into storage.objects(bucket_id,name,metadata) values('asis-evidencias',$1,$2)",[p.ruta,{mimetype:mime,size}]);
  for(const role of ['miembro','lider','editor','visor']){
    await db.exec(`set test.role='${role}'`);assert.equal((await permit()).motivo,'sin_permiso');
    assert.equal((await confirm(user)).motivo,'sin_permiso');
  }
  await db.exec("set test.role='direccion';set test.session='no'");assert.equal((await permit()).motivo,'sesion');
  await db.exec("set test.session='yes'");
  assert.equal((await permit({date:'2099-01-01'})).motivo,'fecha_hora');
  assert.equal((await permit({time:'24:00'})).motivo,'fecha_hora');
  assert.equal((await permit({mode:'opcional'})).motivo,'modalidad_invalida');
  assert.equal((await permit({note:' '})).motivo,'nota_requerida');
  assert.equal((await permit({id:2})).motivo,'no_existe');
  await db.exec("set test.labora='no'");assert.equal((await permit()).motivo,'no_labora');await db.exec("set test.labora='yes'");
  const p=await permit(),competing=await permit();assert.equal(p.ok,true);assert.notEqual(p.ruta,competing.ruta);
  assert.equal((await confirm(p.permiso)).motivo,'evidencia_no_verificada');
  await upload(p,'application/pdf');assert.equal((await confirm(p.permiso)).motivo,'evidencia_no_verificada');
  await db.query('delete from storage.objects where name=$1',[p.ruta]);await upload(p);
  await db.exec(`set test.uid='${other}'`);assert.equal((await confirm(p.permiso)).motivo,'permiso_invalido');await db.exec(`set test.uid='${user}'`);
  await db.exec('set role authenticated');
  const result=await confirm(p.permiso);assert.equal(result.ok,true);assert.equal(result.estado,'P');assert.equal(result.modalidad,'presencial');
  assert.deepEqual(await confirm(p.permiso),result,'same permit is idempotent');
  assert.equal((await confirm(competing.permiso)).motivo,'ya_marcado');
  assert.equal((await permit()).motivo,'ya_marcado');
  await assert.rejects(()=>db.query('select * from asis_entradas_direccion'),/permission denied/);
  await db.exec('reset role');
  const saved=await call('select to_jsonb(r) data from asis_registros r where colaborador_id=1');
  assert.equal(saved.origen,'panel');assert.equal(saved.marcado_por,user);assert.equal(saved.evidencia_path,p.ruta);
  assert.equal(saved.evidencia_lat,null);assert.equal(saved.distancia_oficina_m,null,'does not pretend to validate GPS');
  assert.equal(await call("select to_char(marcado_at at time zone 'America/Lima','HH24:MI') data from asis_registros"),'08:15');
  assert.equal(await call('select modalidad data from asis_modalidades_diarias'),'presencial');
  assert.equal(await call('select (confirmado_at is not null and registro_id is not null) data from asis_entradas_direccion where id=$1',[p.permiso]),true);
  const date2=await call("select ((now() at time zone 'America/Lima')::date-2)::text data");
  const late=await permit({date:date2,time:'08:16',mode:'virtual'});await upload(late);
  const tardy=await confirm(late.permiso);assert.equal(tardy.estado,'T');assert.equal(tardy.modalidad,'virtual');
  const date3=await call("select ((now() at time zone 'America/Lima')::date-3)::text data");
  const expired=await permit({date:date3});await upload(expired);
  await db.query("update asis_entradas_direccion set vence_at=now()-interval '1 minute' where id=$1",[expired.permiso]);
  assert.equal((await confirm(expired.permiso)).motivo,'permiso_vencido');
  const changed=await permit({date:date3});await upload(changed);
  await db.exec("set test.labora='no'");assert.equal((await confirm(changed.permiso)).motivo,'no_labora');await db.exec("set test.labora='yes'");
  const historical=await call('select jsonb_agg(r order by id) data from asis_registros r');await db.exec(migration);
  assert.deepEqual(await call('select jsonb_agg(r order by id) data from asis_registros r'),historical);
  await db.exec('set role anon');await assert.rejects(()=>permit(),/permission denied/);await assert.rejects(()=>confirm(p.permiso),/permission denied/);
  console.log('PASS SQL 74: Dirección only, sessions, private permits/evidence, dates, actual time, P/T, modalities, daily sync, audit, idempotency, no overwrite, expiry, revalidation, repeatable migration.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.close();}
