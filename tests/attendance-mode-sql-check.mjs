// node tests/attendance-mode-sql-check.mjs <ruta-a-pglite/dist/index.js>
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
async function installFunction(file,name){
  const sql=await fs.readFile(file,'utf8'),start=sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start>=0,name);
  await db.exec(sql.slice(start,sql.indexOf('$$;',start)+3));
}
const value=async sql=>(await db.query(sql)).rows[0].data;
const withoutModes=data=>JSON.parse(JSON.stringify(data,(key,value)=>key==='modalidad'?undefined:value));
try{
  await db.exec(`
    create role anon; create role authenticated;
    create table asis_areas(id bigint primary key,nombre text,orden int,activo boolean default true);
    create table asis_colaboradores(id bigint primary key,nombre text,area_id bigint,orden int,
      activo boolean,contrato_inicio date,horario_semanal jsonb,dias_laborables int[]);
    create table asis_registros(colaborador_id bigint,fecha date,estado text,nota text,
      marcado_at timestamptz,marcado_por uuid,origen text,evidencia_path text,horas numeric,
      modalidad_marcada text,primary key(colaborador_id,fecha));
    create table asis_excepciones(id bigint,fecha date,ambito text,colaborador_id bigint,tipo text,nota text);
    create table asis_modalidades_diarias(colaborador_id bigint,fecha date,modalidad text);
    create function asis_es_miembro() returns boolean language sql as
      $$select coalesce(current_setting('test.member',true),'yes')<>'no'$$;
    create function asis_rol() returns text language sql as $$select 'direccion'::text$$;
    create function asis_puede_editar() returns boolean language sql as $$select true$$;
    create function asis_labora(asis_colaboradores,date) returns boolean language sql as
      $$select extract(isodow from $2)::int=any($1.dias_laborables)$$;
    create function asis_hora_entrada(asis_colaboradores,date) returns time language sql as $$select time '08:00'$$;
    create function asis_hora_salida(asis_colaboradores,date) returns time language sql as $$select time '13:00'$$;
    create function asis_horas_dia(asis_colaboradores,date) returns numeric language sql as $$select 5::numeric$$;
    insert into asis_areas(id,nombre,orden) values(1,'Marketing',1);
    insert into asis_colaboradores values
      (1,'Caso presencial',1,1,true,null,'{}',array[1,2,3,4,5]),
      (2,'Caso virtual',1,2,true,null,'{"3":{"mod":"presencial"}}',array[1,2,3,4,5]),
      (3,'Sin entrada',1,3,true,null,'{}',array[1,2,3,4,5]);
    insert into asis_registros values
      (1,'2026-09-23','P',null,'2026-09-23T08:15:00-05:00',null,'portal','foto-1',5,'presencial'),
      (2,'2026-09-23','P',null,'2026-09-23T08:00:00-05:00',null,'portal','foto-2',5,'virtual');
    insert into asis_modalidades_diarias values(1,'2026-09-23','virtual'),(3,'2026-09-23','presencial');
  `);
  for(const name of ['asis_modalidad_base','asis_modalidad_dia'])await installFunction('supabase/dashboard_13_modalidad_y_geocerca.sql',name);
  await installFunction('supabase/dashboard_70_rpe_presencial.sql','asis_modalidad_efectiva');
  await installFunction('supabase/dashboard_05_admin_lista.sql','dash_admin_lista');
  await installFunction('supabase/dashboard_07_admin_mes.sql','dash_admin_mes');
  const listSql="select dash_admin_lista(date '2026-09-23') data",monthSql='select dash_admin_mes(2026,9) data';
  const beforeList=await value(listSql),beforeMonth=await value(monthSql);
  assert.equal(beforeList.personas[0].modalidad,'virtual','reproduces screenshot discrepancy');
  const records=await value('select jsonb_agg(r) data from asis_registros r');
  const migration=await fs.readFile('supabase/dashboard_72_modalidad_reportes.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  await db.exec('set role authenticated');
  const list=await value(listSql),month=await value(monthSql);
  assert.deepEqual(list.personas.map(p=>p.modalidad),['presencial','virtual','presencial']);
  assert.deepEqual(month.personas.map(p=>p.dias.find(d=>d.fecha==='2026-09-23').modalidad),['presencial','virtual','presencial']);
  assert.equal(month.personas[0].dias.find(d=>d.fecha==='2026-09-24').modalidad,'virtual');
  assert.equal(month.personas[0].dias.find(d=>d.fecha==='2026-09-26').modalidad,'no_gestiona');
  assert.deepEqual(withoutModes(list),withoutModes(beforeList));
  assert.deepEqual(withoutModes(month),withoutModes(beforeMonth));
  assert.equal((await value('select dash_admin_lista(null) data')).motivo,'fecha');
  assert.equal((await value('select dash_admin_mes(2026,13) data')).motivo,'periodo');
  await db.exec("set test.member='no'");
  assert.equal((await value(listSql)).motivo,'sin_permiso');
  assert.equal((await value(monthSql)).motivo,'sin_permiso');
  await assert.rejects(()=>db.query("select dash_admin_lista_base_72(date '2026-09-23')"),/permission denied/);
  await assert.rejects(()=>db.query('select dash_admin_mes_base_72(2026,9)'),/permission denied/);
  await db.exec('reset role;set role anon');
  await assert.rejects(()=>db.query(listSql),/permission denied/);
  await assert.rejects(()=>db.query(monthSql),/permission denied/);
  await db.exec('reset role');
  assert.deepEqual(await value('select jsonb_agg(r) data from asis_registros r'),records);
  console.log('PASS SQL 72: reproduced old mismatch; recorded modality wins; daily choice and schedule fallbacks; list/month agree; unchanged records, totals and permissions; repeatable migration.');
  await db.exec(`
    alter table asis_modalidades_diarias add primary key(colaborador_id,fecha);
    alter table asis_modalidades_diarias add column modalidad_base text default 'virtual';
    alter table asis_modalidades_diarias add column cambiado_por uuid;
    alter table asis_modalidades_diarias add column actualizado_at timestamptz default now();
    alter table asis_modalidades_diarias add constraint base_mode_valid check(modalidad_base in ('virtual','presencial','opcional'));
    set test.member='yes';
  `);
  const syncMigration=await fs.readFile('supabase/dashboard_73_modalidad_dia_marcada.sql','utf8');
  const schedule=await value('select jsonb_agg(c order by id) data from asis_colaboradores c');
  const dailyBefore=await value('select jsonb_agg(d order by colaborador_id,fecha) data from asis_modalidades_diarias d');
  await db.exec(syncMigration);await db.exec(syncMigration);
  assert.deepEqual(await value('select jsonb_agg(d order by colaborador_id,fecha) data from asis_modalidades_diarias d'),dailyBefore,'installation does not rewrite history');
  // Date is deliberately historical: the trigger must use the record date, not today.
  await db.exec(`
    insert into asis_registros(colaborador_id,fecha,modalidad_marcada,estado) values
      (1,'2026-09-30','presencial','P'),(2,'2026-09-30','virtual','P');
  `);
  const chosen=await value("select jsonb_agg(d order by colaborador_id) data from asis_modalidades_diarias d where fecha='2026-09-30'");
  assert.deepEqual(chosen.map(d=>d.modalidad),['presencial','virtual']);
  assert.deepEqual(chosen.map(d=>d.modalidad_base),['virtual','presencial']);
  assert.deepEqual((await value("select dash_admin_lista(date '2026-09-30') data")).personas.slice(0,2).map(p=>p.modalidad),['presencial','virtual']);
  assert.equal(await value("select asis_modalidad_dia(c,date '2026-10-01') data from asis_colaboradores c where id=1"),'virtual');
  await db.exec("update asis_registros set modalidad_marcada='virtual' where colaborador_id=1 and fecha='2026-09-30'");
  assert.equal(await value("select modalidad data from asis_modalidades_diarias where colaborador_id=1 and fecha='2026-09-30'"),'virtual');
  assert.equal(await value("select modalidad_base data from asis_modalidades_diarias where colaborador_id=1 and fecha='2026-09-30'"),'virtual');
  await db.exec("begin;insert into asis_registros(colaborador_id,fecha,modalidad_marcada) values(1,'2026-10-02','presencial');rollback");
  assert.equal(await value("select count(*)::int data from asis_modalidades_diarias where fecha='2026-10-02'"),0,'failed transaction does not change the day');
  await db.exec("insert into asis_registros(colaborador_id,fecha,estado) values(1,'2026-10-05','J')");
  assert.equal(await value("select count(*)::int data from asis_modalidades_diarias where fecha='2026-10-05'"),0,'no invented modality for a record without one');
  assert.deepEqual(await value('select jsonb_agg(c order by id) data from asis_colaboradores c'),schedule);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select asis_sincronizar_modalidad_marcada()'),/permission denied/);
  console.log('PASS SQL 73: both directions update the exact day; schedule unchanged; original base preserved; rollback is atomic; repeatable migration and restricted access.');
  const dashboard=await fs.readFile('assets/js/dashboard.js','utf8');
  const receiptCode=dashboard.slice(dashboard.indexOf('function showMarkReceipt('),dashboard.indexOf('\nfunction openMarkStatus('));
  for(const [stored,confirmed,label] of [['virtual','presencial','Presencial'],['presencial','virtual','Virtual']]){
    const elements=new Map();
    const context={Date,Intl,APP:{inicio:{dia:{fecha:'2026-09-23',modalidad:stored}}},
      $:id=>{if(!elements.has(id))elements.set(id,{dataset:{}});return elements.get(id);},
      fmtTime:t=>t,cap:s=>s,setMarkFlow(){}};
    vm.createContext(context);vm.runInContext(receiptCode,context);
    context.showMarkReceipt({estado:'P',hora:'08:15',modalidad:confirmed},true);
    assert.equal(elements.get('receipt-mode').textContent,label);
  }
  console.log('PASS receipt: confirmed server modality wins over stale local day in both directions.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.close();}
