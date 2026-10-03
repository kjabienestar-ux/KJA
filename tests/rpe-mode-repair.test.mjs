import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('SQL 86 repairs stale RPE summaries after historical modality changes',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create table asis_registros(id bigint,colaborador_id bigint,fecha date,modalidad_marcada text,salida_at timestamptz,cierre_regularizado boolean);
      create table asis_cierre_config(id int,salida_anticipacion_min int,salida_gracia_min int);
      insert into asis_cierre_config values(1,15,60);
      insert into asis_registros values(42,42,'2026-10-02','presencial',null,false);
      create table fixture(payload jsonb);
      create function asis_modalidad_efectiva(bigint,date) returns text language sql stable as $$
        select modalidad_marcada from asis_registros where colaborador_id=$1 and fecha=$2 $$;
      create function asis_rpe_exento_presencial(bigint,date) returns boolean language sql stable as $$
        select $2>=date '2026-09-22' and asis_modalidad_efectiva($1,$2)='presencial' $$;
      create function asis_cierre_fin_at(bigint,date) returns timestamptz language sql stable as $$ select now()-interval '2 days' $$;
      create function dash_cierre_resumen_colab(bigint,date) returns jsonb language sql stable as $$ select payload from fixture $$;
    `);
    const facebook={tipo:'comparticiones',completo:false,bloqueado:true};
    const salida={tipo:'salida',completo:false,bloqueado:true};
    const base={ok:true,aplica:true,aplica_jornada:true,estado:'incompleta',comparticiones_vencidas:true,requisitos:[facebook,{tipo:'rpe',completo:false},salida],asignaciones:[]};
    await db.query('insert into fixture values($1)',[base]);
    const sql=fs.readFileSync('supabase/dashboard_86_reparar_rpe_modalidad.sql','utf8');
    await db.exec(sql); await db.exec(sql);
    const close=async()=>(await db.query("select dash_cierre_resumen_colab(42,date '2026-10-02') as data")).rows[0].data;
    const set=async(data)=>db.query('update fixture set payload=$1',[data]);
    let result=await close();
    assert.equal(result.requiere_rpe,false); assert.equal(result.rpe_exento_presencial,true);
    assert.deepEqual(result.requisitos,[facebook,salida]);
    assert.equal(result.pendientes,2); assert.equal(result.pendientes_salida,1);
    assert.equal(result.estado,'incompleta'); assert.equal(result.puede_marcar_salida,false);
    assert.equal((await db.query('select salida_at from asis_registros')).rows[0].salida_at,null);
    // Switching back restores RPE from the underlying summary, even days later.
    await db.exec("update asis_registros set modalidad_marcada='virtual'");
    result=await close(); assert.equal(result.requiere_rpe,true);
    assert.deepEqual(result.requisitos,base.requisitos);
    await db.exec("update asis_registros set modalidad_marcada='presencial',salida_at=now()-interval '1 day'");
    await set({...base,requisitos:[{tipo:'rpe',completo:false},{...salida,completo:true}],comparticiones_vencidas:false,
      asignaciones:[{estado:'cancelada',completo:false}]});
    result=await close(); assert.equal(result.estado,'completa'); assert.equal(result.pendientes_salida,0);
    await db.exec('update asis_registros set cierre_regularizado=true');
    assert.equal((await close()).estado,'regularizada');
    await set({...base,requisitos:[{tipo:'rpe',completo:false},{...salida,completo:true}],asignaciones:[{estado:'pendiente',completo:false}]});
    assert.equal((await close()).pendientes_salida,1);
    // A healthy chain is unchanged, including justified and sharing-only days.
    for(const state of ['completa','justificado','no_aplica']) {
      const healthy={...base,estado:state,requiere_rpe:false,rpe_exento_presencial:true,requisitos:[facebook]};
      await set(healthy); assert.deepEqual(await close(),{...healthy,modalidad:'presencial'});
    }
    await set({ok:false,motivo:'colaborador'}); assert.deepEqual(await close(),{ok:false,motivo:'colaborador'});
    assert.equal((await db.query("select has_function_privilege('authenticated','dash_cierre_resumen_colab(bigint,date)','execute') as allowed")).rows[0].allowed,false);
  } finally { await db.close(); }
});
