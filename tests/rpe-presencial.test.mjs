import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ranking from '../assets/js/ranking-model.js';

const sql=fs.readFileSync('supabase/dashboard_70_rpe_presencial.sql','utf8');
const adminJs=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
const dashboardJs=fs.readFileSync('assets/js/dashboard.js','utf8');
const rankingJs=fs.readFileSync('assets/js/dashboard-ranking.js','utf8');

test('migration records a stable Lima cutover without deleting historical evidence',()=>{
  assert.match(sql,/add column if not exists rpe_presencial_exento_desde date/);
  assert.match(sql,/where id=1 and rpe_presencial_exento_desde is null/);
  assert.match(sql,/\(now\(\) at time zone 'America\/Lima'\)::date/);
  assert.doesNotMatch(sql,/delete\s+from\s+public\.asis_(entregas_diarias|entrega_archivos)/i);
  assert.doesNotMatch(sql,/storage\.objects\s+where/i);
});

test('effective modality and close summary exempt only recorded presencial RPE',()=>{
  for(const fragment of [
    'create or replace function public.asis_modalidad_efectiva(',
    "return coalesce(v_marcada,public.asis_modalidad_dia(v_colaborador,p_fecha))",
    "public.asis_modalidad_efectiva(p_colaborador,p_fecha)='presencial'",
    "where item->>'tipo'<>'rpe'",
    "'requiere_rpe',v_tenia_rpe and not v_exento",
    "'rpe_exento_presencial',v_exento",
  ]) assert.ok(sql.includes(fragment),`missing presencial policy fragment: ${fragment}`);
  assert.match(sql,/v_exento:=v_tenia_rpe and public\.asis_rpe_exento_presencial/);
  assert.match(sql,/if not public\.asis_rpe_exento_presencial\(v_colaborador,v_fecha\)\s+and not exists/);
});

test('every collaborator and Direction RPE write path is server protected',()=>{
  for(const name of [
    'dash_entrega_permiso','dash_video_permiso','dash_reemplazo_permiso',
    'dash_confirmar_entrega','dash_reemplazar_entrega','dash_adjuntar_video',
    'dash_admin_entrega_permiso','dash_admin_confirmar_entrega','dash_admin_revisar_entrega',
  ]) assert.match(sql,new RegExp(`create or replace function public\\.${name}\\(`));
  assert.ok((sql.match(/rpe_no_requerido_presencial/g)||[]).length>=9);
  assert.match(sql,/create or replace function public\.dash_admin_revision_entregas\(p_fecha date\)/);
  assert.match(sql,/create or replace function public\.dash_admin_control_diario\(p_fecha date\)/);
  assert.match(sql,/create or replace function public\.dash_mis_revisiones_cierre\(\)/);
});

test('admin progress ignores preserved RPE reviews when the day is exempt',()=>{
  const start=adminJs.indexOf('function adminCloseEvidenceKey');
  const end=adminJs.indexOf('function adminCloseMsg',start);
  const context={};vm.createContext(context);vm.runInContext(adminJs.slice(start,end),context);
  const exempt=context.adminCloseEvidenceProgress(
    {labora:true,cierre:{aplica_jornada:true,requiere_rpe:false,requisitos:[],asignaciones:[]}},
    [{id:1,requisito:'rpe',estado:'completo'}],
  );
  assert.deepEqual({...exempt},{done:0,total:0});
  const virtual=context.adminCloseEvidenceProgress(
    {labora:true,cierre:{aplica_jornada:true,requiere_rpe:true,requisitos:[],asignaciones:[]}},
    [{id:1,requisito:'rpe',estado:'completo'}],
  );
  assert.deepEqual({...virtual},{done:1,total:1});
});

const person=extra=>({nombre:'Ana',inicio_conocido:true,metricas:{
  dias_mes:10,dias:10,dias_participacion:10,entradas_puntuales:10,
  salidas_mes:10,salidas_puntuales:10,facebook_mes:10,facebook_cumplidos:10,
  rpe_mes:0,rpe_cumplidos:0,...extra,
}});

test('ranking gives neutral RPE credit only when all evaluated work is presencial',()=>{
  const presencial=ranking.evaluate([person({rpe_exentos_presencial:10})])[0];
  assert.equal(presencial.parts.rpe,25);
  assert.equal(presencial.score,100);
  const mixed=ranking.evaluate([person({rpe_mes:2,rpe_cumplidos:1,rpe_exentos_presencial:8})])[0];
  assert.equal(mixed.parts.rpe,12.5);
  assert.equal(mixed.score,87.5);
  const unscheduled=ranking.evaluate([person({rpe_exentos_presencial:0})])[0];
  assert.equal(unscheduled.parts.rpe,null);
  assert.equal(unscheduled.score,75);
});

test('ranking and exit copy explain the presencial exception',()=>{
  assert.match(rankingJs,/RPE en jornadas virtuales/);
  assert.match(rankingJs,/Exento por presencial/);
  assert.match(rankingJs,/data\.version!==4/);
  assert.match(sql,/rpe_exentos_presencial/);
  assert.match(sql,/'version',4/);
  assert.match(dashboardJs,/function dailyPendingWorkLabel\(close\)/);
  assert.match(dashboardJs,/return 'los entregables pendientes'/);
  assert.match(dashboardJs,/rpe_no_requerido_presencial:'Hoy trabajas presencial/);
  assert.match(adminJs,/rpe_no_requerido_presencial:'La jornada es presencial/);
});
