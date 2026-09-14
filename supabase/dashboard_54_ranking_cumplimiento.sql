-- Ejecutar después de dashboard_53. Sustituye los criterios del ranking, sin modificar registros.
-- Facebook conserva su calendario independiente, incluso en días sin jornada.
begin;
create or replace function public.dash_ranking_mes(p_mes date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_inicio date; v_fin date; v_filas jsonb;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    raise exception 'Solo Dirección puede consultar la evaluación mensual.';
  end if;
  if p_mes is null or p_mes<date '2020-01-01' or p_mes>(now() at time zone 'America/Lima')::date then raise exception 'Mes inválido.'; end if;
  v_inicio:=date_trunc('month',p_mes)::date;
  v_fin:=least((v_inicio+interval '1 month - 1 day')::date,(now() at time zone 'America/Lima')::date-1);
  with calendario as materialized (
    select c.id,c.area_id,c.contrato_inicio,dia::date fecha,
      dia::date>=c.contrato_inicio incorporado,
      public.asis_labora(c,dia::date) and coalesce(r.estado,'') not in ('J','NG') laboral,
      r.estado,r.salida_at,
      (dia::date+public.asis_hora_entrada(c,dia::date)) at time zone 'America/Lima' inicio_at,
      public.asis_cierre_fin_at(c.id,dia::date) fin_at,
      public.dash_cierre_resumen_colab(c.id,dia::date) cierre,
      public.asis_compartir_fin_at(c.id,dia::date) compartir_fin
    from public.asis_colaboradores c
    join public.asis_areas a on a.id=c.area_id
    cross join generate_series(v_inicio::timestamp,v_fin::timestamp,interval '1 day') dia
    left join public.asis_registros r on r.colaborador_id=c.id and r.fecha=dia::date
    where c.activo and a.activo and c.contrato_inicio is not null
  ), agenda as materialized (
    select cal.*,
      laboral and fin_at is not null and now()>fin_at+make_interval(mins=>cfg.salida_gracia_min) trabajo,
      laboral and fin_at is not null and now()>fin_at+make_interval(mins=>cfg.salida_gracia_min)
        and exists(select 1 from jsonb_array_elements(coalesce(cierre->'requisitos','[]')) q where q->>'tipo'='rpe') rpe_requerido,
      coalesce((cierre->>'aplica_comparticiones')::boolean,false) and compartir_fin is not null and now()>compartir_fin compartir,
      cfg.salida_anticipacion_min,cfg.salida_gracia_min
    from calendario cal cross join public.asis_cierre_config cfg where cfg.id=1
  ), evaluado as materialized (
    select d.*,ev.*,
      incorporado and trabajo and estado='P' entrada_ok,
      incorporado and trabajo and estado in ('P','T') and salida_at between
        fin_at-make_interval(mins=>salida_anticipacion_min) and fin_at+make_interval(mins=>salida_gracia_min) salida_ok,
      case when incorporado and trabajo then (
        select count(*) from public.asis_asignaciones_diarias x
        left join lateral (
          select estado,revision_estado from public.asis_entregas_diarias e
          where e.colaborador_id=d.id and e.asignacion_id=x.id order by e.creado_at desc,e.id desc limit 1
        ) e on true
        where x.fecha=d.fecha and x.activo and x.requerido and (x.colaborador_id=d.id or x.area_id=d.area_id)
          and (e.estado is distinct from 'completo' or e.revision_estado='observada')
      ) else 0 end incumplidas
    from agenda d cross join lateral (
      select
        count(*) filter(where tipo='rpe' and valida and (administracion or completado_at between d.inicio_at and d.fin_at)) rpe_ok,
        count(*) filter(where tipo='rpe' and valida and administracion) rpe_admin,
        count(*) filter(where tipo='rpe' and valida and not administracion and not (completado_at between d.inicio_at and d.fin_at)) rpe_fuera_horario,
        count(*) filter(where tipo='comparticiones' and valida) facebook_ok,
        count(*) filter(where tipo='comparticiones' and valida and not d.laboral) facebook_descanso_ok,
        count(*) requeridas,
        count(*) filter(where subido) subidas,
        count(*) filter(where subido and revision_estado='pendiente') pendientes,
        count(*) filter(where subido and revision_estado='observada') observadas,
        count(*) filter(where valida) aprobadas
      from (
        select req->>'tipo' tipo,e.completado_at,e.revision_estado,
          coalesce(e.estado='completo' and e.con_archivo,false) subido,
          coalesce(e.estado='completo' and e.con_archivo and e.revision_estado='aprobada' and (req->>'completo')::boolean,false) valida,
          coalesce(e.administracion,false) administracion
        from jsonb_array_elements(coalesce(d.cierre->'requisitos','[]')) req
        left join lateral (
          select e.estado,e.revision_estado,e.completado_at,
            exists(select 1 from public.asis_entrega_archivos f where f.entrega_id=e.id) con_archivo,
            exists(select 1 from public.asis_entregas_direccion au where au.entrega_id=e.id and au.colaborador_id=d.id and au.fecha=d.fecha) administracion
          from public.asis_entregas_diarias e where e.colaborador_id=d.id and e.fecha=d.fecha
            and e.requisito=req->>'tipo' and e.asignacion_id is null order by e.creado_at desc,e.id desc limit 1
        ) e on true
        where d.incorporado and ((req->>'tipo'='rpe' and d.rpe_requerido) or (req->>'tipo'='comparticiones' and d.compartir))
      ) evidencia
    ) ev
  ), resumen as (
    select id,
      count(*) filter(where trabajo) dias_mes,
      count(*) filter(where trabajo and incorporado) dias,
      count(*) filter(where incorporado and (trabajo or compartir)) dias_participacion,
      count(*) filter(where trabajo and incorporado and estado in ('P','T')) presentes,
      count(*) filter(where entrada_ok) entradas_puntuales,
      count(*) filter(where salida_ok) salidas_puntuales,
      count(*) filter(where rpe_requerido) rpe_mes,
      count(*) filter(where compartir) facebook_mes,
      count(*) filter(where compartir and incorporado) facebook_asignados,
      count(*) filter(where compartir and incorporado and not laboral) facebook_descanso,
      sum(rpe_ok) rpe_cumplidos,sum(rpe_admin) rpe_administracion,sum(rpe_fuera_horario) rpe_fuera_horario,
      sum(facebook_ok) facebook_cumplidos,sum(facebook_descanso_ok) facebook_descanso_cumplidos,
      sum(requeridas) evidencias_requeridas,sum(subidas) evidencias_subidas,sum(aprobadas) evidencias_aprobadas,
      sum(pendientes) revisiones_pendientes,sum(observadas) evidencias_observadas,sum(incumplidas) asignaciones_incumplidas
    from evaluado group by id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'area_id',c.area_id,'area',a.nombre,
    'inicio_conocido',c.contrato_inicio is not null,'inicio',c.contrato_inicio,'metricas',coalesce(to_jsonb(r)-'id','{}')) order by a.orden,c.nombre,c.id),'[]')
  into v_filas from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id
  left join resumen r on r.id=c.id where c.activo and a.activo;
  return jsonb_build_object('version',3,'mes',v_inicio,'hasta',v_fin,'filas',v_filas,
    'salida_anticipacion_min',(select salida_anticipacion_min from public.asis_cierre_config where id=1),
    'salida_gracia_min',(select salida_gracia_min from public.asis_cierre_config where id=1));
end;
$$;
revoke all on function public.dash_ranking_mes(date) from public,anon,authenticated;
grant execute on function public.dash_ranking_mes(date) to authenticated;
notify pgrst,'reload schema';
commit;
