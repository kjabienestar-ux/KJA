import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=fs.readFileSync('supabase/dashboard_132_jornadas_vigencias.sql','utf8');
function functionSQL(file,name){
 const s=fs.readFileSync('supabase/'+file,'utf8'),start=s.indexOf('create or replace function public.'+name+'(');
 assert.ok(start>=0,name);return s.slice(start,s.indexOf('$$;',s.indexOf('as $$',start))+3);
}
const week=days=>Object.fromEntries(days.map(d=>[d,{mod:'virtual',ini:'08:00',fin:'13:00',vinc:d===6?'voluntariado':'practicas'}]));
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create table permission(allowed boolean,session_ok boolean);insert into permission values(true,true);
 create function asis_puede_editar() returns boolean language sql stable as $$select allowed from permission$$;
 create function dash_sesion_vigente() returns boolean language sql stable as $$select session_ok from permission$$;
 create function asis_es_miembro() returns boolean language sql stable as $$select session_ok from permission$$;
 create function asis_rol() returns text language sql as $$select 'direccion'::text$$;
 create table asis_perfiles(id uuid primary key);insert into asis_perfiles values(auth.uid());
 create table asis_areas(id bigint primary key,nombre text,orden integer,activo boolean);
 insert into asis_areas values(1,'Ingeniería',1,true);
 create table asis_colaboradores(id bigint primary key,nombre text,dni text,area_id bigint,activo boolean default true,orden integer default 1,
   horario_semanal jsonb,dias_laborables integer[],hora_inicio time,hora_fin time,tipo_vinculo text,
   contrato_inicio date,contrato_fin_referencia date,contrato_horas numeric,contrato_horas_voluntariado numeric,
   horas_previas numeric default 10,contrato_pendiente boolean default false,contrato_nota text,
   comparticiones_horario_configurado boolean default false);
 create table asis_registros(id bigint generated always as identity,colaborador_id bigint,fecha date,estado text,horas numeric,vinculo text,
   nota text,marcado_at timestamptz,origen text,evidencia_path text,salida_at timestamptz,modalidad_marcada text);
 create table asis_excepciones(id bigint generated always as identity,fecha date,ambito text,colaborador_id bigint,tipo text,nota text);
 create table asis_horarios_puntuales(colaborador_id bigint,fecha date,hora_inicio time,hora_fin time);
 create table asis_comparticiones_horarios(colaborador_id bigint,dia_semana integer,hora_inicio time,hora_fin time);
 create table asis_descansos_presenciales(colaborador_id bigint,fecha date);
 create table asis_historial_contrato(colaborador_id bigint,tipo text,horario_anterior jsonb,horario_nuevo jsonb,nota text,creado_por uuid);
 `);
 for(const name of ['asis_hora_entrada','asis_hora_salida','asis_labora','asis_horas_dia','asis_vinc_dia'])await db.exec(functionSQL('asistencia_migracion_6_portal.sql',name));
 await db.exec(functionSQL('dashboard_13_modalidad_y_geocerca.sql','asis_modalidad_base'));
 await db.exec(functionSQL('dashboard_06_admin_equipo.sql','dash_admin_horas_semana'));
 await db.exec(functionSQL('dashboard_32_horario_comparticiones.sql','asis_compartir_programado').replace('public.asis_compartir_programado(','public.asis_compartir_programado_base_87('));
 await db.exec(`create function asis_compartir_programado(p_colab bigint,p_fecha date) returns boolean language sql stable as $$select asis_compartir_programado_base_87(p_colab,p_fecha)$$;`);
 for(const name of ['asis_compartir_inicio_at','asis_compartir_fin_at'])await db.exec(functionSQL('dashboard_32_horario_comparticiones.sql',name));
 await db.exec(fs.readFileSync('supabase/dashboard_112_horas_dias_no_laborables.sql','utf8'));
 await db.exec(functionSQL('dashboard_07_admin_mes.sql','dash_admin_mes').replaceAll('public.dash_admin_mes(','public.dash_admin_mes_base_72('));
 await db.exec(`create function dash_admin_mes(p_anio integer,p_mes integer,p_incluir_inactivos boolean default false) returns jsonb language sql as $$select dash_admin_mes_base_72(p_anio,p_mes,p_incluir_inactivos)$$;
 create function dash_inicio(p_colab bigint default null) returns jsonb language sql as $$select jsonb_build_object('ok',true,'colaborador',to_jsonb(c)) from asis_colaboradores c where c.id=coalesce(p_colab,1)$$;
 create function dash_horarios_companeros() returns jsonb language sql as $$select case when not dash_sesion_vigente() then '{"ok":false,"motivo":"sin_permiso"}'::jsonb else jsonb_build_object('ok',true,'personas',(select jsonb_agg(to_jsonb(c)) from asis_colaboradores c)) end$$;
 create function dash_colab() returns bigint language sql as $$select 1::bigint$$;
 create function dash_equipo_cierres_hoy() returns jsonb language sql as $$select jsonb_build_object('ok',true,'fecha',(now() at time zone 'America/Lima')::date,'personas',(select jsonb_agg(jsonb_build_object('id',id,'cierre','{}'::jsonb)) from asis_colaboradores))$$;
 create function dash_historial(p_anio integer,p_mes integer,p_colab bigint default null) returns jsonb language sql stable as $$
 select jsonb_build_object('ok',true,'dias',(select jsonb_agg(jsonb_build_object('fecha',f::date,'lab',asis_labora(c,f::date))) from asis_colaboradores c cross join generate_series(make_date(p_anio,p_mes,1),make_date(p_anio,p_mes,1)+interval '1 month - 1 day',interval '1 day') f where c.id=coalesce(p_colab,1)))$$;
 create function dash_admin_equipo(p_incluir_inactivos boolean default false) returns jsonb language sql stable as $$
 select case when not asis_es_miembro() then '{"ok":false,"motivo":"sin_permiso"}'::jsonb else jsonb_build_object('ok',true,'puede_editar',asis_puede_editar(),'personas',(select jsonb_agg(to_jsonb(c)) from asis_colaboradores c)) end$$;`);
 await db.query(`insert into asis_colaboradores(id,nombre,dni,area_id,horario_semanal,dias_laborables,hora_inicio,hora_fin,tipo_vinculo,contrato_inicio,contrato_fin_referencia,contrato_horas)
 values(1,'Ana','00000001',1,$1,'{1,2,3}','08:00','13:00','practicas',(now() at time zone 'America/Lima')::date-60,(now() at time zone 'America/Lima')::date+180,360)`,[JSON.stringify(week([1,2,3]))]);
 const date=async(n)=>(await db.query(`select ((now() at time zone 'America/Lima')::date+$1::integer)::text d`,[n])).rows[0].d;
 const save=async(type,from,to,days=[4,5,6],version=0)=>(await db.query(`select dash_admin_guardar_jornada(1,$1,$2,$3,$4,'Cambio autorizado', $5) r`,[type,await date(from),to==null?null:await date(to),JSON.stringify(week(days)),version])).rows[0].r;
 return {db,date,save};
}

test('versioned schedules keep stored history, past calendar and credited totals; end and indefinite principal',async()=>{
 const {db,date,save}=await fixture();
 try{
  await db.exec(`insert into asis_registros(colaborador_id,fecha,estado,horas,vinculo,marcado_at,salida_at,evidencia_path)
  values(1,(now() at time zone 'America/Lima')::date-7,'P',5,'practicas',now()-interval '7 days',now()-interval '7 days','private/file.jpg');
  insert into asis_excepciones(fecha,ambito,tipo) select d,'empresa','feriado' from generate_series((now() at time zone 'America/Lima')::date-20,(now() at time zone 'America/Lima')::date-10,interval '1 day') d where extract(isodow from d)=1 limit 1;`);
  const before=(await db.query(`select to_jsonb(c) c,dash_admin_resumen_contrato(c) summary from asis_colaboradores c`)).rows;
  const marks=(await db.query(`select to_jsonb(r) r from asis_registros r`)).rows;
  const historical=(await db.query(`select f::date::text d,asis_labora(c,f::date) lab,dash_admin_horas_programadas_dia(c,f::date) hours,asis_vinc_dia(c,f::date) vinc from asis_colaboradores c cross join generate_series((now() at time zone 'America/Lima')::date-20,(now() at time zone 'America/Lima')::date,interval '1 day') f`)).rows;
  await db.exec(sql);await db.exec(sql);
  const res=await save('principal',7,35);assert.equal(res.ok,true);
  assert.deepEqual((await db.query(`select to_jsonb(c) c,dash_admin_resumen_contrato(c) summary from asis_colaboradores c`)).rows,before);
  assert.deepEqual((await db.query(`select to_jsonb(r) r from asis_registros r`)).rows,marks);
  assert.deepEqual((await db.query(`select f::date::text d,asis_labora(c,f::date) lab,dash_admin_horas_programadas_dia(c,f::date) hours,asis_vinc_dia(c,f::date) vinc from asis_colaboradores c cross join generate_series((now() at time zone 'America/Lima')::date-20,(now() at time zone 'America/Lima')::date,interval '1 day') f`)).rows,historical);
  for(const offset of [7,14,35,36]){
   const [r]=(await db.query(`select asis_labora(c,$1) lab,(asis_jornada_ficha(c,$1)).dias_laborables days from asis_colaboradores c`,[await date(offset)])).rows;
   assert.deepEqual(r.days,offset===36?[]:[4,5,6]);if(offset===36)assert.equal(r.lab,false);
  }
  assert.equal((await save('principal',40,null,[1,3,5],res.version)).ok,true);
  assert.deepEqual((await db.query(`select (asis_jornada_ficha(c,$1)).dias_laborables days from asis_colaboradores c`,[await date(700)])).rows[0].days,[1,3,5]);
 }finally{await db.close();}
});

test('temporary returns to principal by date, rejects overlaps, stale versions and unprotected writes',async()=>{
 const {db,date,save}=await fixture();try{
  await db.exec(sql);
  const principal=await save('principal',5,null,[1,2,3]);assert.equal(principal.ok,true);
  const temp=await save('temporal',10,17,[4,5,6],principal.version);assert.equal(temp.ok,true);
  const days=async(n)=>(await db.query(`select (asis_jornada_ficha(c,$1)).dias_laborables days from asis_colaboradores c`,[await date(n)])).rows[0].days;
  assert.deepEqual(await days(9),[1,2,3]);assert.deepEqual(await days(10),[4,5,6]);assert.deepEqual(await days(17),[4,5,6]);assert.deepEqual(await days(18),[1,2,3]);
  assert.equal((await save('temporal',14,20,[1],temp.version)).motivo,'conflicto');
  assert.equal((await save('principal',30,null,[1],principal.version)).motivo,'desactualizado');
  assert.equal((await save('principal',0,5,[1],temp.version)).motivo,'fechas');
  assert.equal((await save('temporal',30,null,[1],temp.version)).motivo,'fechas');
  await db.exec(`update asis_colaboradores set horario_semanal='{}'`);
  assert.ok((await db.query(`select horario_semanal from asis_colaboradores`)).rows[0].horario_semanal['1']);
  await assert.rejects(db.exec(`update asis_colaboradores set horario_semanal='{}',hora_inicio='06:00'`),/jornada_requiere_vigencia/);
  await db.exec(`update asis_colaboradores set nombre='Ana actualizada'`);
  await db.exec(`update permission set allowed=false`);assert.equal((await save('temporal',30,35,[1],temp.version)).motivo,'sin_permiso');
  await db.exec(`update permission set allowed=true,session_ok=false`);assert.equal((await save('temporal',30,35,[1],temp.version)).motivo,'sin_permiso');
  assert.equal((await db.query(`select dash_admin_equipo(false) r`)).rows[0].r.ok,false);
  const perms=(await db.query(`select has_table_privilege('authenticated','asis_jornadas_vigencias','insert') t,has_function_privilege('anon','dash_admin_guardar_jornada(bigint,text,date,date,jsonb,text,bigint)','execute') anon,has_function_privilege('authenticated','asis_jornada_ficha(asis_colaboradores,date)','execute') resolver`)).rows[0];
  assert.deepEqual(perms,{t:false,anon:false,resolver:false});
 }finally{await db.close();}
});

test('monthly book and directory use date-specific schedules; existing marks and SQL overrides are guarded',async()=>{
 const {db,date,save}=await fixture();try{
  await db.exec(sql);const res=await save('principal',7,35);assert.equal(res.ok,true);
  const target=await date(20);const month=(await db.query(`select dash_admin_mes(extract(year from $1::date)::int,extract(month from $1::date)::int,false) r`,[target])).rows[0].r;
  for(const day of month.personas[0].dias){
   const diff=Math.round((Date.parse(day.fecha)-Date.parse(await date(0)))/86400000);
   const dow=new Date(day.fecha+'T12:00:00Z').getUTCDay();
   assert.equal(day.laborable,(diff>=7&&diff<=35?[4,5,6]:diff>35?[]:[1,2,3]).includes(dow),day.fecha);
  }
  const directory=(await db.query(`select dash_admin_equipo(false) r`)).rows[0].r;
  assert.equal(directory.jornadas_disponibles,true);assert.equal(directory.personas[0].jornadas.length,1);
  const team=(await db.query(`select dash_equipo_cierres_hoy() r`)).rows[0].r;assert.deepEqual(team.personas[0].dias_laborables,[1,2,3]);
  const personal=(await db.query(`select dash_historial(extract(year from $1::date)::int,extract(month from $1::date)::int,1) r`,[target])).rows[0].r;
  for(const d of personal.dias)assert.equal(d.jornada_versionada,d.fecha>=await date(7));
  const colleagues=(await db.query(`select dash_horarios_companeros() r`)).rows[0].r;
  assert.equal(colleagues.personas[0].jornadas.length,1);
  assert.equal('motivo' in colleagues.personas[0].jornadas[0],false);assert.equal('creado_por' in colleagues.personas[0].jornadas[0],false);
  const sharing=(await db.query(`select f::date::text fecha,asis_compartir_programado(1,f::date) scheduled,asis_compartir_inicio_at(1,f::date) start from generate_series($1::date,$2::date,interval '1 day') f`,[await date(7),await date(21)])).rows;
  for(const d of sharing){assert.equal(d.scheduled,[1,2,3].includes(new Date(d.fecha+'T12:00:00Z').getUTCDay()),d.fecha);if(d.scheduled)assert.equal(d.start.toISOString().slice(11,16),'13:00');}
  await db.query(`insert into asis_registros(colaborador_id,fecha,estado,horas) values(1,$1,'P',5)`,[await date(60)]);
  assert.equal((await save('principal',50,null,[1],res.version)).motivo,'registros_existentes');
  assert.equal((await save('principal',50,55,[1],res.version)).motivo,'registros_existentes','expiry also changes dates AFTER the declared end');
  await db.query(`insert into asis_horarios_puntuales values(1,$1,'09:00','12:00')`,[await date(44)]);
  assert.equal((await save('temporal',40,48,[1],res.version)).motivo,'ajuste_puntual');
 }finally{await db.close();}
});

test('mixed links and legacy punctual hours remain dated; temporal cannot outlive a shortened principal',async()=>{
 const {db,date,save}=await fixture();try{
  await db.query(`update asis_colaboradores set tipo_vinculo='ambos',horario_semanal=$1,dias_laborables='{1,6}',contrato_horas_voluntariado=80`,[JSON.stringify(week([1,6]))]);
  await db.exec(`alter function asis_hora_entrada(asis_colaboradores,date) rename to asis_hora_entrada_base_123;alter function asis_hora_salida(asis_colaboradores,date) rename to asis_hora_salida_base_123;`);
  for(const name of ['asis_hora_entrada','asis_hora_salida'])await db.exec(functionSQL('dashboard_123_horario_temporal_ronny.sql',name));
  const past=await date(-7);await db.query(`insert into asis_horarios_puntuales values(1,$1,'10:30','13:00')`,[past]);
  const read=async(d)=>(await db.query(`select asis_hora_entrada(c,$1)::text entry,asis_hora_salida(c,$1)::text exit,asis_vinc_dia(c,$1) link from asis_colaboradores c`,[d])).rows[0];
  const previous=await read(past);await db.exec(sql);const primary=await save('principal',5,null,[1,6]);assert.equal(primary.ok,true);
  assert.deepEqual(await read(past),previous);assert.equal(previous.entry,'10:30:00');
  const saturday=(await db.query(`select min(f)::date::text d from generate_series($1::date,$2::date,interval '1 day') f where extract(isodow from f)=6`,[await date(5),await date(12)])).rows[0].d;
  assert.equal((await read(saturday)).link,'voluntariado');
  const temp=await save('temporal',25,35,[4,6],primary.version);assert.equal(temp.ok,true);
  assert.equal((await save('principal',20,30,[1],temp.version)).motivo,'temporal_fuera_contrato');
  const finite=await save('principal',40,50,[1,6],temp.version);assert.equal(finite.ok,true);
  assert.equal((await save('temporal',49,55,[4],finite.version)).motivo,'principal_finalizada');
 }finally{await db.close();}
});
