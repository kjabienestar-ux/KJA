import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

const read=path=>fs.readFileSync(path,'utf8');
function definition(source,name){
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start,-1);
  return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);
}

test('October 8 waives work for everyone, preserves scheduled Facebook, data and other dates',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated;
      create table asis_colaboradores(id bigint primary key,nombre text,activo boolean default true,
        contrato_inicio date default '2026-09-01',comparticiones_horario_configurado boolean default true,
        horario_semanal jsonb default '{}',dias_laborables integer[] default '{4}',hora_inicio time default '09:00',hora_fin time default '18:00');
      create table asis_excepciones(fecha date,ambito text,tipo text,nota text,colaborador_id bigint);
      create table asis_comparticiones_horarios(colaborador_id bigint,dia_semana int,hora_inicio time,hora_fin time);
      create table asis_descansos_presenciales(colaborador_id bigint,fecha date);
      create table fixture(id bigint,payload jsonb);
      insert into asis_colaboradores(id,nombre) select x,'Persona '||x from generate_series(1,8) x;
      update asis_colaboradores set comparticiones_horario_configurado=false where id in (3,4,8);
      update asis_colaboradores set horario_semanal='{"4":{"mod":"no_gestiona"}}' where id=4;
      update asis_colaboradores set contrato_inicio='2026-10-09' where id=5;
      update asis_colaboradores set activo=false where id=6;
      update asis_colaboradores set horario_semanal='{"4":{"mod":"presencial"}}',dias_laborables='{}' where id=8;
      insert into asis_comparticiones_horarios values (1,4,'14:00','15:00'),(2,5,'14:00','15:00'),
        (5,4,'14:00','15:00'),(6,4,'14:00','15:00'),(7,4,'23:00','01:00');
      insert into asis_excepciones values('2026-10-08','colaborador','laborable_extra','Extra',2),
        ('2026-09-05','empresa','feriado','Sistema no disponible',null);
    `);
    const portal=read('supabase/asistencia_migracion_6_portal.sql');
    for(const name of ['asis_labora','asis_hora_entrada','asis_hora_salida'])await db.exec(definition(portal,name));
    await db.exec(definition(read('supabase/dashboard_45_excluir_05_septiembre.sql'),'asis_compartir_programado'));
    await db.exec('alter function asis_labora(asis_colaboradores,date) rename to asis_labora_base_87; alter function asis_compartir_programado(bigint,date) rename to asis_compartir_programado_base_87;');
    await db.exec(definition(read('supabase/dashboard_87_descanso_presencial.sql'),'asis_labora'));
    await db.exec(read('supabase/dashboard_104_comparticiones_inicio_contrato.sql'));
    const schedule=read('supabase/dashboard_32_horario_comparticiones.sql');
    for(const name of ['asis_compartir_inicio_at','asis_compartir_fin_at'])await db.exec(definition(schedule,name));
    await db.exec(`create function dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date) returns jsonb language sql as $$
      select payload||jsonb_build_object('aplica_comparticiones',asis_compartir_programado(p_colaborador,p_fecha),
        'compartir_desde',asis_compartir_inicio_at(p_colaborador,p_fecha),'compartir_hasta',asis_compartir_fin_at(p_colaborador,p_fecha))
      from fixture where id=p_colaborador $$;`);
    const facebook={tipo:'comparticiones',titulo:'Comparticiones',completo:false,revision_estado:'pendiente',entrega:55};
    const base={ok:true,estado:'incompleta',entrada_at:null,salida_at:null,aplica:true,aplica_jornada:true,
      requiere_salida:true,requiere_rpe:true,salida_ventana_vencida:true,comparticiones_vencidas:false,
      requisitos:[{tipo:'rpe',completo:false},facebook,{tipo:'salida',completo:false}],asignaciones:[{id:10,completo:false}],pendientes:4};
    for(let id=1;id<=8;id++)await db.query('insert into fixture values($1,$2)',[id,JSON.stringify(base)]);
    const close=async(id,date='2026-10-08')=>(await db.query('select dash_cierre_resumen_colab($1,$2) value',[id,date])).rows[0].value;
    const before=await close(1,'2026-10-09');
    const migration=read('supabase/dashboard_106_feriado_08_octubre.sql');
    await db.exec(migration);await db.exec(migration);
    for(const id of [1,2,3,4,5,6,7,8]){
      const share=[1,3,7,8].includes(id),result=await close(id);
      assert.equal(result.aplica,share,`aplica ${id}`);
      assert.equal(result.aplica_jornada,false);assert.equal(result.requiere_rpe,false);
      assert.equal(result.requiere_salida,false);assert.equal(result.puede_marcar_salida,false);
      assert.equal(result.salida_ventana_vencida,false);assert.equal(result.pendientes_jornada,0);
      assert.equal(result.pendientes_salida,0);assert.equal(result.pendientes,share?1:0);
      assert.deepEqual(result.requisitos,share?[facebook]:[]);assert.deepEqual(result.asignaciones,[]);
      assert.equal(result.estado,share?'en_curso':'no_aplica');
    }
    assert.equal((await db.query("select count(*)::int n from asis_colaboradores c where asis_labora(c,'2026-10-08')")).rows[0].n,0);
    assert.equal((await db.query("select count(*)::int n from asis_excepciones where fecha='2026-10-08' and ambito='empresa'")).rows[0].n,1);
    assert.equal((await db.query("select tipo from asis_excepciones where colaborador_id=2")).rows[0].tipo,'no_laborable');
    assert.equal(new Date((await close(1)).compartir_desde).toISOString(),'2026-10-08T19:00:00.000Z');
    assert.equal(new Date((await close(7)).compartir_hasta).toISOString(),'2026-10-09T06:00:00.000Z');
    assert.deepEqual(await close(1,'2026-10-09'),before);
    assert.equal((await db.query("select asis_compartir_programado(1,'2026-09-05') value")).rows[0].value,false);
    assert.equal((await db.query('select asis_compartir_programado(999,null) value')).rows[0].value,false);
    assert.deepEqual((await db.query('select payload from fixture where id=1')).rows[0].payload,base);
    await db.query('update fixture set payload=$1 where id=1',[JSON.stringify({...base,comparticiones_vencidas:true})]);
    assert.equal((await close(1)).estado,'incompleta');
    await db.query('update fixture set payload=$1 where id=1',[JSON.stringify({...base,requisitos:[{...facebook,completo:true}]})]);
    assert.equal((await close(1)).estado,'completa');assert.equal((await close(1)).pendientes,0);
    assert.equal((await db.query("select has_function_privilege('authenticated','dash_cierre_resumen_colab(bigint,date)','execute') allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});

test('holiday screens never invent entry, exit or old evidence requirements',()=>{
  const ctx=vm.createContext({});
  vm.runInContext(read('assets/js/dashboard-close-model.js'),ctx);
  const admin=read('assets/js/dashboard-admin-cierre.js');
  vm.runInContext(admin.slice(admin.indexOf('function adminEvidenceMissing('),admin.indexOf('function adminCloseTime(')),ctx);
  const close={feriado:true,aplica:false,aplica_jornada:false,requiere_rpe:false,requiere_salida:false,
    estado:'no_aplica',entrada_at:null,salida_at:null,requisitos:[],asignaciones:[]};
  const old=[{requisito:'rpe',estado:'anulado'},{requisito:'salida',estado:'anulado'},{requisito:'comparticiones',estado:'anulado'}];
  assert.equal(ctx.KJACloseModel.attendancePresentation(null,close).label,'Feriado');
  assert.equal(ctx.KJACloseModel.incompleteReasons(null,close).length,0);
  assert.equal(ctx.adminEvidenceMissing({labora:false,cierre:close},old).length,0);
  assert.equal(ctx.adminCloseEvidenceProgress({cierre:close},old).total,0);
  const sharing={...close,aplica:true,aplica_comparticiones:true,solo_comparticiones:true,estado:'incompleta',
    requisitos:[{tipo:'comparticiones',completo:false}]};
  assert.deepEqual(Array.from(ctx.KJACloseModel.incompleteReasons(null,sharing)),['Comparticiones']);
  assert.deepEqual(Array.from(ctx.adminEvidenceMissing({cierre:sharing},old),x=>x.kind),['comparticiones']);
  assert.equal(ctx.adminCloseEvidenceProgress({cierre:sharing},old).total,1);
});
