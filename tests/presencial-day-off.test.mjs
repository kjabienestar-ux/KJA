import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

test('October 2 attendance grants only October 5 leave, retaining Facebook and original records',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated;
      create table asis_colaboradores(id bigint primary key,activo boolean,comparticiones_horario_configurado boolean);
      create table asis_registros(colaborador_id bigint,fecha date,estado text,marcado_at timestamptz,modalidad_marcada text);
      create table fixture(id bigint,payload jsonb);
      create function asis_labora(p_colab asis_colaboradores,p_fecha date) returns boolean language sql as $$ select true $$;
      create function asis_compartir_programado(p_colab bigint,p_fecha date) returns boolean language sql as $$
        select case when comparticiones_horario_configurado then id<>6 else asis_labora(c,p_fecha) end
        from asis_colaboradores c where id=p_colab $$;
      create function dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date) returns jsonb language sql as $$ select payload from fixture where id=p_colaborador $$;
      insert into asis_colaboradores select n,true,n in (2,6) from generate_series(1,7) n;
      insert into asis_registros values
        (1,'2026-10-02','P',now(),'presencial'),(2,'2026-10-02','T',now(),'presencial'),
        (3,'2026-10-02','P',now(),'virtual'),(4,'2026-10-03','P',now(),'presencial'),
        (5,'2026-10-02','J',null,'presencial'),(6,'2026-10-02','P',now(),'presencial'),
        (7,'2026-10-02','P',now(),null);
    `);
    const facebook={tipo:'comparticiones',completo:false,bloqueado:false,entrega:44};
    const base={ok:true,aplica:true,aplica_jornada:true,entrada_at:null,salida_at:null,
      estado:'sin_entrada',puede_compartir:true,compartir_desde:'10:00',compartir_hasta:'15:00',
      requisitos:[{tipo:'rpe',completo:false},facebook,{tipo:'salida',completo:false}],asignaciones:[{id:1,completo:false}]};
    for(let id=1;id<=7;id++)await db.query('insert into fixture values($1,$2)',[id,JSON.stringify(base)]);
    const migration=fs.readFileSync('supabase/dashboard_87_descanso_presencial.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    assert.deepEqual((await db.query('select colaborador_id from asis_descansos_presenciales order by 1')).rows.map(x=>x.colaborador_id),[1,2,6]);
    const close=async(id,date='2026-10-05')=>(await db.query('select dash_cierre_resumen_colab($1,$2) value',[id,date])).rows[0].value;
    const result=await close(1);
    assert.equal(result.dia_libre_presencial,true);assert.equal(result.aplica_jornada,false);
    assert.equal(result.solo_comparticiones,true);assert.equal(result.requiere_salida,false);
    assert.equal(result.pendientes,1);assert.equal(result.pendientes_jornada,0);
    assert.deepEqual(result.requisitos,[facebook]);assert.deepEqual(result.asignaciones,[]);
    assert.equal(result.puede_compartir,true);assert.equal(result.compartir_hasta,'15:00');
    for(const id of [3,4,5,7])assert.deepEqual(await close(id),base);
    assert.deepEqual(await close(1,'2026-10-06'),base);
    const days=(await db.query("select id,asis_labora(c,'2026-10-05') work,asis_compartir_programado(id,'2026-10-05') facebook from asis_colaboradores c order by id")).rows;
    assert.equal(days[0].work,false);assert.equal(days[0].facebook,true);
    assert.equal(days[1].facebook,true);assert.equal(days[2].work,true);assert.equal(days[5].facebook,false);
    await db.query('update fixture set payload=$1 where id=1',[JSON.stringify({...base,comparticiones_vencidas:true})]);
    assert.equal((await close(1)).estado,'incompleta');
    await db.query('update fixture set payload=$1 where id=1',[JSON.stringify({...base,requisitos:[{...facebook,completo:true}]})]);
    assert.equal((await close(1)).estado,'completa');
    assert.equal((await db.query('select count(*)::int n from asis_registros')).rows[0].n,7);
    assert.equal((await db.query("select has_function_privilege('authenticated','asis_otorgar_descanso_presencial(date,date)','execute') allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});

test('desktop and mobile show congratulations and only Facebook, with no attendance action',()=>{
  const source=fs.readFileSync('assets/js/dashboard.js','utf8');
  const nodes=new Map();
  const get=id=>{
    if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelectorAll:()=>[],querySelector:()=>get(id+'-child')});
    return nodes.get(id);
  };
  const data={ok:true,aplica:true,dia_libre_presencial:true,solo_comparticiones:true,pendientes:1,puede_compartir:true,
    requisitos:[{tipo:'comparticiones',completo:false}],asignaciones:[],estado:'en_curso'};
  const ctx=vm.createContext({$:get,APP:{cierre:data,inicio:{}},DAILY_EVIDENCE:{busy:false},esc:x=>x,fmtTime:x=>x,
    formatAttendanceClock:x=>x,cap:x=>x,clearDailyCloseLoadError(){},syncMarkedAttendanceAction(){},
    dailyCloseItemMarkup:item=>item.tipo,dailyCloseMessage(){},renderMobileTimeRecord(){}});
  vm.runInContext(fs.readFileSync('assets/js/dashboard-close-model.js','utf8'),ctx);
  vm.runInContext('const CLOSE_MODEL=KJACloseModel;',ctx);
  vm.runInContext('let _clockInterval=null;',ctx);
  for(const [start,end] of [['function dailyCloseGuidePresentation(','function dailyCloseItemMarkup('],
    ['function renderDayOffSchedule(','function syncMobileEntryAction('],
    ['function renderMobileDailyClose(','function mergeDailyIssueState('],['function renderDailyClose(','async function loadDailyClose(']]){
    vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),ctx);
  }
  ctx.renderDailyClose();
  assert.match(get('day-close-title').textContent,/día libre/);assert.match(get('mobile-close-title').textContent,/día libre/);
  assert.match(get('day-close-copy').textContent,/Felicidades/);
  assert.equal(get('day-close-checklist').innerHTML,'comparticiones');assert.equal(get('mobile-close-list').innerHTML,'comparticiones');
  assert.equal(get('day-close-button').hidden,true);assert.equal(get('mobile-close-action').hidden,true);
  assert.equal(get('day-close-button').disabled,true);
  assert.match(get('day-schedule-title').textContent,/Felicidades.*descanso/);
  assert.match(get('clock-caption').textContent,/no necesitas registrar entrada ni salida/);
  data.requisitos[0].completo=true;data.pendientes=0;ctx.renderDailyClose();
  assert.equal(get('mobile-close-count-child').textContent,'100%');
  assert.deepEqual(Array.from(ctx.KJACloseModel.incompleteReasons(null,{...data,estado:'incompleta'})),[]);
});

test('day off blocks exit even with a stale permission, and timestamps display Lima time',async()=>{
  const source=fs.readFileSync('assets/js/dashboard.js','utf8');
  const ctx=vm.createContext({APP:{cierre:{dia_libre_presencial:true,puede_marcar_salida:true}}});
  vm.runInContext(source.slice(source.indexOf('function openDailyExitModal('),source.indexOf('function closeDailyExitModal(')),ctx);
  vm.runInContext(source.slice(source.indexOf('async function markDailyExit('),source.indexOf('function facebookShareDate(')),ctx);
  // No DOM access or RPC should be attempted, despite the stale permission.
  ctx.openDailyExitModal();await ctx.markDailyExit();
  vm.runInContext(source.slice(source.indexOf('const fmtTime ='),source.indexOf('\n};',source.indexOf('const fmtTime ='))+3)+'\nthis.formatTime=fmtTime;',ctx);
  assert.equal(ctx.formatTime('2026-10-05T15:00:00+00:00'),'10:00');
  assert.equal(ctx.formatTime('2026-10-05T20:00:00+00:00'),'15:00');
  assert.equal(ctx.formatTime('08:30:00'),'08:30');
});
