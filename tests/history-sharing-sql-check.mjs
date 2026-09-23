// node tests/history-sharing-sql-check.mjs <ruta-a-pglite/dist/index.js>
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
try{
  await db.exec(`
    create role anon; create role authenticated;
    create function public.dash_colab() returns bigint language sql as $$select 1::bigint$$;
    create table fixture_cierres(fecha date primary key, cierre jsonb);
    create function public.dash_cierre_resumen_colab(bigint,date) returns jsonb language sql as $$
      select cierre from fixture_cierres where fecha=$2
    $$;
    create function public.dash_historial(p_anio int,p_mes int,p_colab bigint default null)
    returns jsonb language plpgsql security definer as $$begin
      if coalesce(p_colab,1)<>1 then return '{"ok":false,"motivo":"sin_permiso"}'; end if;
      if p_mes not between 1 and 12 then return '{"ok":false,"motivo":"fecha"}'; end if;
      return jsonb_build_object('ok',true,'horas',42,'meta',100,'totales',jsonb_build_object('P',1,'laborables',1),
        'dias',(select jsonb_agg(jsonb_build_object('fecha',fecha,'lab',fecha=date '2026-09-07','cierre_estado',null) order by fecha) from fixture_cierres));
    end $$;
    insert into fixture_cierres values
      ('2026-09-07','{"ok":true,"aplica_comparticiones":true,"comparticiones_vencidas":true,"requisitos":[{"tipo":"comparticiones","completo":false}]}'),
      ('2026-09-08','{"ok":true,"aplica_comparticiones":true,"comparticiones_vencidas":true,"compartir_hasta":"2026-09-08T14:00:00-05:00","requisitos":[{"tipo":"comparticiones","completo":false}]}'),
      ('2026-09-09','{"ok":true,"aplica_comparticiones":true,"comparticiones_vencidas":false,"requisitos":[{"tipo":"comparticiones","completo":true,"revision_estado":"pendiente"}]}'),
      ('2026-09-10','{"ok":true,"aplica_comparticiones":false,"requisitos":[]}'),
      ('2026-09-11','{"ok":true,"aplica_comparticiones":true,"comparticiones_vencidas":false,"requisitos":[{"tipo":"comparticiones","completo":false}]}'),
      ('2026-09-12','{"ok":false,"motivo":"no_aplica"}');
  `);
  const sql=await fs.readFile('supabase/dashboard_71_historial_comparticiones.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  await db.exec('set role authenticated');
  const result=(await db.query('select dash_historial(2026,9) data')).rows[0].data;
  assert.equal(result.horas,42);assert.equal(result.meta,100);assert.deepEqual(result.totales,{P:1,laborables:1});
  const [work,missing,delivered,off,open,unavailable]=result.dias;
  assert.equal(work.comparticiones_vencidas,true);
  assert.equal(missing.lab,false);assert.equal(missing.cierre_estado,null);
  assert.equal(missing.aplica_comparticiones,true);assert.equal(missing.comparticiones_vencidas,true);
  assert.equal(missing.compartir_hasta,'2026-09-08T14:00:00-05:00');
  assert.equal(delivered.comparticiones_completas,true);assert.equal(delivered.comparticiones_vencidas,false);
  assert.equal(off.aplica_comparticiones,false);assert.equal(open.comparticiones_vencidas,false);
  assert.equal(unavailable.aplica_comparticiones,false);
  assert.equal((await db.query('select dash_historial(2026,9,2) data')).rows[0].data.motivo,'sin_permiso');
  assert.equal((await db.query('select dash_historial(2026,13) data')).rows[0].data.motivo,'fecha');
  await assert.rejects(()=>db.query('select dash_historial_base_71(2026,9)'),/permission denied/);
  await db.exec('reset role;set role anon');
  await assert.rejects(()=>db.query('select dash_historial(2026,9)'),/permission denied/);
  console.log('PASS SQL 71: repeatable migration, access protection, non-working days without attendance, delivered/pending/expired sharing, unchanged hours and totals.');
}finally{await db.close();}
