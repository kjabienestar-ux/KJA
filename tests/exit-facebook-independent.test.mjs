import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

const context={};
vm.runInNewContext(fs.readFileSync('assets/js/dashboard-close-model.js','utf8'),context);
const model=context.KJACloseModel;
const source=fs.readFileSync('assets/js/dashboard.js','utf8');

test('mobile exit stays available with Facebook pending, including expired Facebook',()=>{
  const nodes=new Map();
  const node=()=>({dataset:{},style:{setProperty(){}},setAttribute(){},querySelector(){return this;}});
  const ctx={CLOSE_MODEL:model,$:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},
    dailyCloseItemMarkup:()=>'',fmtTime:()=>'',formatAttendanceClock:()=>'',
    dailyCloseGuidePresentation:()=>({}),renderMobileTimeRecord(){},DAILY_EVIDENCE:{busy:false}};
  const start=source.indexOf('function renderMobileDailyClose(');
  const end=source.indexOf('\nfunction ',start+1);
  vm.runInNewContext(source.slice(start,end),ctx);
  for(const expired of [false,true]){
    const data={entrada_at:'2026-09-26T13:00:00Z',estado:expired?'incompleta':'en_curso',
      comparticiones_vencidas:expired,salida_ventana_vencida:false,puede_marcar_salida:true};
    ctx.renderMobileDailyClose(data,[{tipo:'entrada',completo:true},{tipo:'salida',completo:true},{tipo:'comparticiones',completo:false}]);
    assert.equal(nodes.get('mobile-close-action').disabled,false);
    assert.equal(nodes.get('mobile-close-action').dataset.action,'exit');
  }
});

test('only the work deadline or recorded exit closes work; RPE still blocks exit',()=>{
  assert.equal(model.workClosed({estado:'incompleta',comparticiones_vencidas:true,salida_ventana_vencida:false}),false);
  assert.equal(model.workClosed({estado:'incompleta',salida_ventana_vencida:true}),true);
  assert.equal(model.workClosed({salida_at:'2026-09-26T18:00:00Z',puede_compartir:true}),true);
  assert.equal(model.hasPendingWork({requisitos:[{tipo:'comparticiones',completo:false}]}),false);
  assert.equal(model.hasPendingWork({requisitos:[{tipo:'rpe',completo:false}]}),true);
});

test('SQL exposes the work deadline independently and preserves Facebook permissions',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated;
      create table asis_cierre_config(id int,salida_gracia_min int);
      insert into asis_cierre_config values(1,60);
      create function asis_cierre_fin_at(bigint,date) returns timestamptz language sql as $$
        select now()+case when $1=1 then interval '-30 minutes' else interval '-2 hours' end $$;
      create function dash_cierre_resumen_colab(bigint,date) returns jsonb language sql as $$
        select '{"ok":true,"estado":"incompleta","comparticiones_vencidas":true,"puede_compartir":false}'::jsonb $$;`);
    const migration=fs.readFileSync('supabase/dashboard_80_salida_independiente_facebook.sql','utf8');
    await db.exec(migration);
    await db.exec(migration);
    for(const id of [1,2]){
      const result=(await db.query('select dash_cierre_resumen_colab($1,current_date) as data',[id])).rows[0].data;
      assert.equal(result.salida_ventana_vencida,id===2);
      assert.equal(result.comparticiones_vencidas,true);
      assert.equal(result.puede_compartir,false);
    }
  }finally{await db.close();}
});
