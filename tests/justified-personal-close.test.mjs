import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import calendar from '../assets/js/attendance-calendar-model.js';
import progress from '../assets/js/dashboard-month-progress.js';

const day={fecha:'2026-09-25',lab:true,estado:'J',cierre_estado:'incompleta',aplica_comparticiones:true,comparticiones_completas:true,comparticiones_vencidas:false};
test('September 25: justified birthday leave with Facebook delivered is not incomplete',()=>{
  for(const lab of [true,false]){
    assert.equal(calendar.present({...day,lab}).tone,'j');
    const view=progress.present({...day,lab});
    assert.equal(view.state,'j');assert.equal(view.alert,false);
    assert.match(view.reason,/justificada/);assert.match(view.reason,/entregadas/);
  }
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync('assets/js/dashboard-close-model.js','utf8'),ctx);
  const close={aplica:true,estado:'incompleta',entrada_at:null,salida_at:null,requisitos:[{tipo:'rpe',completo:false}]};
  for(const [mark,summary] of [[{estado:'J'},close],[null,{...close,justificado:true}],[null,{...close,estado:'justificado'}]]){
    const view=ctx.KJACloseModel.attendancePresentation(mark,summary);
    assert.equal(view.label,'Justificado');assert.equal(view.incomplete,false);
    assert.equal(ctx.KJACloseModel.incompleteReasons(mark,summary).length,0);
  }
  assert.equal(ctx.KJACloseModel.attendancePresentation({estado:'P'},close).incomplete,true);
});
test('justification keeps missing Facebook visible and removing J restores incomplete closure',()=>{
  const pending={...day,comparticiones_completas:false};
  assert.equal(calendar.present(pending).tone,'j');
  assert.match(progress.present(pending).reason,/pendientes/);
  assert.equal(calendar.present({...pending,comparticiones_vencidas:true}).tone,'missing');
  assert.equal(progress.present({...pending,comparticiones_vencidas:true}).alert,true);
  assert.equal(calendar.present({...day,estado:'P'}).tone,'incomplete');
  assert.equal(progress.present({...day,estado:'P'}).alert,true);
  assert.equal(calendar.present({...day,futuro:true}).tone,'future');
  assert.equal(progress.present({...day,futuro:true}).state,'future');
});
test('SQL: J waives only work requirements, preserves Facebook and is reversible without data changes',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated;
      create table public.asis_registros(colaborador_id bigint,fecha date,estado text);
      create table public.fixture(id bigint,payload jsonb);
      create function public.dash_cierre_resumen_colab(bigint,date) returns jsonb language sql as $$
        select payload from public.fixture where id=$1 $$;
      insert into public.asis_registros values(1,'2026-09-25','J'),(2,'2026-09-25','J'),(3,'2026-09-25','J'),(4,'2026-09-25','P');
    `);
    const facebook={tipo:'comparticiones',completo:true,revision_estado:'pendiente',entrega:55,editable:false};
    const base={ok:true,aplica:true,aplica_jornada:true,estado:'incompleta',entrada_at:null,salida_at:null,aplica_comparticiones:true,comparticiones_vencidas:false,puede_compartir:false,requisitos:[{tipo:'rpe',completo:false},facebook,{tipo:'salida',completo:false}],asignaciones:[{id:7,completo:false}],pendientes:3};
    for(const [id,payload] of [[1,base],[2,{...base,comparticiones_vencidas:true,requisitos:[{...facebook,completo:false}]}],[3,{...base,aplica_comparticiones:false}],[4,base],[5,{ok:false,motivo:'colaborador'}]]){
      await db.query('insert into fixture values($1,$2)',[id,JSON.stringify(payload)]);
    }
    const migration=fs.readFileSync('supabase/dashboard_82_justificacion_cierre_personal.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const close=async(id,date='2026-09-25')=>(await db.query('select public.dash_cierre_resumen_colab($1,$2) value',[id,date])).rows[0].value;
    const result=await close(1);
    assert.equal(result.estado,'justificado');assert.equal(result.justificado,true);
    assert.equal(result.aplica_jornada,false);assert.equal(result.requiere_rpe,false);assert.equal(result.requiere_salida,false);
    assert.equal(result.pendientes,0);assert.equal(result.pendientes_jornada,0);assert.equal(result.pendientes_salida,0);
    assert.equal(result.puede_marcar_salida,false);assert.equal(result.puede_compartir,false);
    assert.equal(result.solo_comparticiones,true);assert.equal(result.entrada_at,null);assert.equal(result.salida_at,null);
    assert.deepEqual(result.requisitos,[facebook]);assert.deepEqual(result.asignaciones,[]);
    const missing=await close(2);
    assert.equal(missing.estado,'justificado');assert.equal(missing.pendientes,1);assert.equal(missing.comparticiones_vencidas,true);
    const unscheduled=await close(3);
    assert.equal(unscheduled.aplica,false);assert.deepEqual(unscheduled.requisitos,[]);
    assert.deepEqual(await close(4),base);assert.deepEqual(await close(5),{ok:false,motivo:'colaborador'});
    assert.equal(await close(6),null);assert.deepEqual(await close(1,'2026-09-24'),base);
    await db.exec("update asis_registros set estado='P' where colaborador_id=1");
    assert.deepEqual(await close(1),base);
    assert.deepEqual((await db.query('select payload from fixture where id=1')).rows[0].payload,base);
    assert.equal((await db.query('select count(*)::int n from asis_registros')).rows[0].n,4);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.dash_cierre_resumen_colab(bigint,date)','execute') allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});
