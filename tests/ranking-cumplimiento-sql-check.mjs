import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href),db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table asis_perfiles(id uuid,activo boolean,rol text);insert into asis_perfiles values('00000000-0000-4000-8000-000000000001',true,'direccion');
 create table asis_areas(id bigint,nombre text,orden int,activo boolean);insert into asis_areas values(1,'Área',1,true);
 create table asis_colaboradores(id bigint,nombre text,area_id bigint,contrato_inicio date,activo boolean);insert into asis_colaboradores values(1,'Ana',1,'2025-01-01',true);
 create table asis_registros(colaborador_id bigint,fecha date,estado text,salida_at timestamptz);
 insert into asis_registros values(1,'2025-01-01','P','2025-01-01 13:00-05'),(1,'2025-01-02','T','2025-01-02 14:00-05');
 create table asis_cierre_config(id int,salida_anticipacion_min int,salida_gracia_min int);insert into asis_cierre_config values(1,0,15);
 create table asis_entregas_diarias(id bigint,colaborador_id bigint,fecha date,requisito text,asignacion_id bigint,estado text,revision_estado text,creado_at timestamptz,completado_at timestamptz);
 create table asis_entrega_archivos(entrega_id bigint);
 create table asis_entregas_direccion(entrega_id bigint,colaborador_id bigint,fecha date);
 create table asis_asignaciones_diarias(id bigint,fecha date,activo boolean,requerido boolean,colaborador_id bigint,area_id bigint);
 insert into asis_asignaciones_diarias values(1,'2025-01-01',true,true,1,null),(2,'2025-01-01',true,true,1,null),(3,'2025-01-01',false,true,1,null);
 insert into asis_entregas_diarias values
 (1,1,'2025-01-01','rpe',null,'completo','aprobada',now(),'2025-01-01 12:00-05'),
 (2,1,'2025-01-02','rpe',null,'completo','aprobada',now(),'2025-01-02 18:00-05'),
 (3,1,'2025-01-03','comparticiones',null,'completo','aprobada',now(),'2025-01-03 12:00-05'),
 (4,1,'2025-01-01','asignado',1,'completo','pendiente',now(),now());
 insert into asis_entrega_archivos values(1),(2),(3);
 create function asis_labora(asis_colaboradores,date) returns boolean language sql as $$select $2 in(date '2025-01-01',date '2025-01-02')$$;
 create function asis_hora_entrada(asis_colaboradores,date) returns time language sql as $$select time '08:00'$$;
 create function asis_cierre_fin_at(bigint,date) returns timestamptz language sql as $$select ($2+time '13:00') at time zone 'America/Lima'$$;
 create function asis_compartir_fin_at(bigint,date) returns timestamptz language sql as $$select ($2+time '14:00') at time zone 'America/Lima'$$;
 create function dash_cierre_resumen_colab(bigint,date) returns jsonb language sql as $$select case when $2=date '2025-01-03' then '{"aplica_comparticiones":true,"requisitos":[{"tipo":"comparticiones","completo":true}]}'::jsonb when $2 in(date '2025-01-01',date '2025-01-02') then '{"requisitos":[{"tipo":"rpe","completo":true}]}'::jsonb else '{"requisitos":[]}'::jsonb end$$;
 `);
 const sql=await fs.readFile(new URL('../supabase/dashboard_54_ranking_cumplimiento.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await assert.rejects(()=>db.query("select dash_ranking_mes('2025-01-01')"),/Dirección/);
 await db.exec("set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';set role authenticated");
 const read=async()=>(await db.query("select dash_ranking_mes('2025-01-01') r")).rows[0].r;
 let data=await read(),m=data.filas[0].metricas;
 assert.equal(data.version,3);assert.equal(m.dias_mes,2);assert.equal(m.entradas_puntuales,1);assert.equal(m.salidas_puntuales,1);
 assert.equal(m.rpe_cumplidos,1);assert.equal(m.rpe_fuera_horario,1);assert.equal(m.facebook_cumplidos,1);assert.equal(m.facebook_descanso_cumplidos,1);assert.equal(m.facebook_descanso,1);assert.equal(m.asignaciones_incumplidas,1);
 await db.exec("reset role;insert into asis_entregas_direccion values(2,1,'2025-01-02');set role authenticated");m=(await read()).filas[0].metricas;
 assert.equal(m.rpe_cumplidos,2);assert.equal(m.rpe_administracion,1);assert.equal(m.rpe_fuera_horario,0);
 await db.exec("reset role;delete from asis_entrega_archivos where entrega_id=3;set role authenticated");m=(await read()).filas[0].metricas;
 assert.equal(m.facebook_cumplidos,0);assert.equal(m.facebook_mes,1);
 await db.exec("reset role;insert into asis_entrega_archivos values(3);update asis_entregas_diarias set revision_estado='pendiente' where id=3;set role authenticated");m=(await read()).filas[0].metricas;
 assert.equal(m.facebook_cumplidos,0);assert.equal(m.revisiones_pendientes,1);
 await db.exec("reset role;update asis_colaboradores set contrato_inicio='2025-01-03';update asis_entregas_diarias set revision_estado='aprobada' where id=3;set role authenticated");m=(await read()).filas[0].metricas;
 assert.equal(m.dias,0);assert.equal(m.dias_mes,2);assert.equal(m.dias_participacion,1);assert.equal(m.facebook_cumplidos,1);
 await db.exec("reset role;update asis_perfiles set activo=false;set role authenticated");await assert.rejects(read,/Dirección/);
 console.log('Ranking 54 SQL OK: independent Facebook schedule, RPE timing/admin, entry/exit, files/review, assignments and access.');
}finally{await db.close()}
