import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('contract progress credits elapsed holidays, leave and days off without duplicating attendance',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon; create role authenticated;
      create table asis_colaboradores(
        id bigint primary key, contrato_inicio date, tipo_vinculo text,
        horas_previas numeric, contrato_horas numeric, horario_semanal jsonb,
        dias_laborables integer[], hora_inicio time, hora_fin time,
        contrato_horas_voluntariado numeric, contrato_pendiente boolean,
        contrato_nota text, contrato_fin_referencia date
      );
      create table asis_registros(
        colaborador_id bigint, fecha date, estado text, horas numeric, vinculo text
      );
      create table asis_excepciones(
        fecha date, ambito text, colaborador_id bigint, tipo text
      );
      create table asis_descansos_presenciales(colaborador_id bigint,fecha date);

      create function asis_vinc_dia(p_colab asis_colaboradores,p_fecha date)
      returns text language sql stable as $$
        select case when p_colab.tipo_vinculo='ambos'
          then coalesce(nullif(p_colab.horario_semanal->extract(isodow from p_fecha)::int::text->>'vinc',''),'practicas')
          when p_colab.tipo_vinculo='voluntariado' then 'voluntariado' else 'practicas' end
      $$;
      create function dash_admin_horas_semana(p_colab asis_colaboradores,p_vinculo text)
      returns numeric language sql stable as $$select case when p_vinculo='voluntariado' then 4 else 25 end$$;
      create function asis_labora(p_colab asis_colaboradores,p_fecha date)
      returns boolean language plpgsql stable as $$
      declare v_dow text:=extract(isodow from p_fecha)::int::text; v_mod text; v_tipo text;
      begin
        if exists(select 1 from asis_descansos_presenciales d where d.colaborador_id=p_colab.id and d.fecha=p_fecha) then return false; end if;
        select tipo into v_tipo from asis_excepciones e where e.fecha=p_fecha and e.ambito='colaborador' and e.colaborador_id=p_colab.id limit 1;
        if v_tipo='laborable_extra' then return true; end if;
        if exists(select 1 from asis_excepciones e where e.fecha=p_fecha and e.ambito='empresa' and e.tipo='feriado') then return false; end if;
        if v_tipo='no_laborable' then return false; end if;
        v_mod:=coalesce(nullif(p_colab.horario_semanal->v_dow->>'mod',''),case when v_dow::int=any(p_colab.dias_laborables) then 'virtual' else 'no_gestiona' end);
        return v_mod<>'no_gestiona';
      end $$;
    `);

    const migration=fs.readFileSync('supabase/dashboard_112_horas_dias_no_laborables.sql','utf8');
    await db.exec(migration); await db.exec(migration);
    const dates=(await db.query(`
      select d::date::text fecha from generate_series(
        (now() at time zone 'America/Lima')::date-20,
        (now() at time zone 'America/Lima')::date,interval '1 day') d
      where extract(isodow from d) between 1 and 5 order by d desc limit 5
    `)).rows.map(row=>row.fecha);
    assert.equal(dates.length,5);
    const [holiday,permission,dayOff,justified,workedHoliday]=dates;
    const future=(await db.query(`select d::date::text fecha from generate_series(
      (now() at time zone 'America/Lima')::date+1,
      (now() at time zone 'America/Lima')::date+10,interval '1 day') d
      where extract(isodow from d) between 1 and 5 order by d limit 1`)).rows[0].fecha;
    const beforeStart=(await db.query(`select d::date::text fecha from generate_series(
      (now() at time zone 'America/Lima')::date-90,
      (now() at time zone 'America/Lima')::date-70,interval '1 day') d
      where extract(isodow from d) between 1 and 5 order by d limit 1`)).rows[0].fecha;

    await db.query(`insert into asis_colaboradores values(
      1,(now() at time zone 'America/Lima')::date-60,'practicas',10,100,'{}','{1,2,3,4,5}','08:00','13:00',null,false,null,null)`);
    await db.query(`insert into asis_excepciones values
      ($1,'empresa',null,'feriado'),($2,'colaborador',1,'no_laborable'),
      ($3,'empresa',null,'feriado'),($4,'empresa',null,'feriado'),
      ($5,'empresa',null,'feriado')`,[holiday,permission,workedHoliday,future,beforeStart]);
    await db.query(`insert into asis_descansos_presenciales values(1,$1)`,[dayOff]);
    await db.query(`insert into asis_registros values(1,$1,'J',null,null),(1,$2,'P',4,'practicas')`,[justified,workedHoliday]);

    const summary=(await db.query(`select dash_admin_resumen_contrato(c) value from asis_colaboradores c where id=1`)).rows[0].value;
    assert.equal(summary.marcadas,4);
    assert.equal(summary.horas_no_laborables,20);
    assert.equal(summary.cumplidas,34);
    assert.equal(summary.faltantes,66);

    const sunday=(await db.query(`select max(d)::date::text fecha from generate_series(
      (now() at time zone 'America/Lima')::date-30,
      (now() at time zone 'America/Lima')::date-7,interval '1 day') d
      where extract(isodow from d)=7`)).rows[0].fecha;
    const saturday=(await db.query(`select ($1::date-1)::text fecha`,[sunday])).rows[0].fecha;
    await db.query(`insert into asis_colaboradores values(
      2,$1,'ambos',0,40,$2::jsonb,'{6,7}','09:00','13:00',20,false,null,null)`,[
      saturday,JSON.stringify({'6':{mod:'virtual',ini:'22:00',fin:'06:00',vinc:'practicas'},'7':{mod:'virtual',ini:'09:00',fin:'13:00',vinc:'voluntariado'}})
    ]);
    await db.query(`insert into asis_excepciones values
      ($1,'colaborador',2,'no_laborable'),($2,'colaborador',2,'no_laborable')`,[saturday,sunday]);
    assert.equal(await db.query(`select asis_vinc_dia(c,$1) value from asis_colaboradores c where id=2`,[sunday]).then(x=>x.rows[0].value),'voluntariado');
    assert.equal(await db.query(`select dash_admin_horas_programadas_dia(c,$1) value from asis_colaboradores c where id=2`,[sunday]).then(x=>Number(x.rows[0].value)),4);
    const mixed=(await db.query(`select dash_admin_resumen_contrato(c) value from asis_colaboradores c where id=2`)).rows[0].value;
    assert.equal(mixed.horas_no_laborables,8);
    assert.equal(mixed.cumplidas,8);
    assert.equal(mixed.voluntariado.horas_no_laborables,4);
    assert.equal(mixed.voluntariado.cumplidas,4);
    assert.equal(await db.query(`select dash_admin_horas_programadas_dia(c,$1) value from asis_colaboradores c where id=2`,[saturday]).then(x=>Number(x.rows[0].value)),8);
    assert.equal(await db.query(`select has_function_privilege('authenticated','dash_admin_horas_programadas_dia(asis_colaboradores,date)','execute') value`).then(x=>x.rows[0].value),false);
  }finally{await db.close();}
});

test('both contract screens consume and explain server-side non-working credits',()=>{
  const dashboard=fs.readFileSync('assets/js/dashboard-admin-equipo.js','utf8');
  const legacy=fs.readFileSync('asistencia.html','utf8');
  assert.match(dashboard,/r\.horas_no_laborables/);
  assert.match(dashboard,/días no laborables/);
  assert.match(legacy,/db\.rpc\('dash_admin_equipo'/);
  assert.match(legacy,/r\.cumplidas\|\|0[\s\S]*r\.previas\|\|0/);
});
