import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=name=>fs.readFileSync(new URL(`../supabase/${name}`,import.meta.url),'utf8');
function definition(source,name){
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start,-1);
  return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);
}

test('SQL: an absent Facebook window must not erase the daily close or its completed evidence',async()=>{
  const db=new PGlite();
  try{
    // Isolated fixtures: no connection to Supabase or real attendance data.
    await db.exec(`
      create role anon; create role authenticated;
      create table public.asis_registros(id bigint,colaborador_id bigint,fecha date,marcado_at timestamptz,salida_at timestamptz);
      create function public.asis_compartir_inicio_at(bigint,date) returns timestamptz language sql as $$
        select case $1 when 2 then now()-interval '1 hour' when 3 then now()+interval '1 hour' else null end $$;
      create function public.asis_compartir_fin_at(bigint,date) returns timestamptz language sql as $$
        select case $1 when 2 then now()+interval '1 hour' when 3 then now()+interval '2 hours' else null end $$;
      create function public.asis_cierre_fin_at(bigint,date) returns timestamptz language sql as $$
        select case $1 when 4 then now()+interval '1 hour' else now()-interval '1 minute' end $$;
      create function public.dash_cierre_resumen_colab_base_28(bigint,date) returns jsonb language sql as $$
        select '{"ok":true,"requisitos":[{"tipo":"rpe","completo":true},{"tipo":"salida","completo":true}],"asignaciones":[],"pendientes":0}'::jsonb $$;
      insert into public.asis_registros values
        (1,1,current_date,now()-interval '6 hours',null),
        (4,4,current_date,now()-interval '1 hour',null);
    `);
    const old=sql('dashboard_32_horario_comparticiones.sql');
    await db.exec(definition(old,'asis_compartir_en_ventana'));
    await db.exec(definition(old,'dash_evidencia_editable'));
    await db.exec(definition(sql('dashboard_28_edicion_evidencias_jornada.sql'),'dash_cierre_resumen_colab'));
    const close=async id=>(await db.query('select public.dash_cierre_resumen_colab($1,current_date) as cierre',[id])).rows[0].cierre;
    // This is the real historical function chain, including jsonb_set.
    assert.equal(await close(1),null,'old SQL reproduces the missing daily close');
    const migration=sql('dashboard_76_cierre_sin_horario_facebook.sql');
    await db.exec(migration);
    await db.exec(migration); // Safe to reapply.
    for(const id of [1,2,3,4,5]){
      const value=await close(id);
      assert.equal(value.ok,true);
      assert.equal(value.pendientes,0);
      assert.deepEqual(value.requisitos,[{tipo:'rpe',completo:true},{tipo:'salida',completo:true}]);
      assert.equal(value.puede_editar_evidencias,id===2||id===4);
    }
    const window=(await db.query(`select public.asis_compartir_en_ventana(1,current_date) as sin_horario,
      public.asis_compartir_en_ventana(2,current_date) as abierta,
      public.asis_compartir_en_ventana(3,current_date) as futura`)).rows[0];
    assert.deepEqual(window,{sin_horario:false,abierta:true,futura:false});
    await db.exec('update public.asis_registros set salida_at=now() where colaborador_id=4');
    assert.equal((await close(4)).puede_editar_evidencias,false);
    assert.equal((await db.query('select count(*)::int as n from public.asis_registros')).rows[0].n,2);
  }finally{await db.close();}
});
