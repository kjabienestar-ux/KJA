-- Ejecutar después de dashboard_51. Ranking provisional, solo Dirección activa.
-- Lee los registros existentes; no modifica contratos, entregas ni reconocimientos.
begin;
create or replace function public.dash_ranking_mes(p_mes date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_inicio date; v_fin date; v_filas jsonb;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    raise exception 'Solo Dirección puede consultar la evaluación mensual.';
  end if;
  if p_mes is null or p_mes<date '2020-01-01' or p_mes>(now() at time zone 'America/Lima')::date then
    raise exception 'Mes inválido.';
  end if;
  v_inicio:=date_trunc('month',p_mes)::date;
  -- Ayer: no penaliza tareas ni jornadas que todavía pueden completarse hoy.
  v_fin:=least((v_inicio+interval '1 month - 1 day')::date,(now() at time zone 'America/Lima')::date-1);
  with calendario as materialized (
    select c.id,c.nombre,c.area_id,a.nombre area,c.contrato_inicio,
      dia::date fecha,r.estado,r.salida_at,r.horas_efectivas,
      public.asis_horas_dia(c,dia::date) esperadas,
      public.dash_cierre_resumen_colab(c.id,dia::date) cierre
    from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id
    cross join generate_series(v_inicio::timestamp,v_fin::timestamp,interval '1 day') dia
    left join public.asis_registros r on r.colaborador_id=c.id and r.fecha=dia::date
    where c.activo and a.activo and c.contrato_inicio is not null
      and public.asis_labora(c,dia::date) and coalesce(r.estado,'') not in ('J','NG')
  ), dias as materialized (
    select * from calendario where fecha>=contrato_inicio
  ), resumen as (
    select d.id,count(*) dias,
      count(*) filter(where estado in ('P','T')) presentes,
      count(*) filter(where estado='P') puntuales,
      sum(greatest(coalesce(esperadas,0),0)) horas_programadas,
      sum(case when estado in ('P','T') and salida_at is not null then least(greatest(coalesce(horas_efectivas,0),0),greatest(coalesce(esperadas,0),0)) else 0 end) horas,
      count(*) filter(where coalesce((cierre->>'aplica')::boolean,false)) cierres_requeridos,
      count(*) filter(where coalesce((cierre->>'aplica')::boolean,false) and salida_at is not null) cierres,
      sum(ev.total) evidencias_requeridas,sum(ev.aprobadas) evidencias_aprobadas,sum(ev.pendientes) revisiones_pendientes,
      sum(ev.subidas) evidencias_subidas,sum(ev.observadas) evidencias_observadas,
      sum(asig.incumplidas) asignaciones_incumplidas
    from dias d
    cross join lateral (
      select count(*) total,
        count(*) filter(where coalesce((req->>'completo')::boolean,false) and e.estado='completo' and e.con_archivo and e.revision_estado='aprobada') aprobadas,
        count(*) filter(where e.estado='completo' and e.con_archivo and e.revision_estado='pendiente') pendientes,
        count(*) filter(where e.estado='completo' and e.con_archivo) subidas,
        count(*) filter(where e.estado='completo' and e.con_archivo and e.revision_estado='observada') observadas
      from jsonb_array_elements(case when coalesce((d.cierre->>'aplica')::boolean,false) then coalesce(d.cierre->'requisitos','[]'::jsonb) else '[]'::jsonb end) req
      left join lateral (
        select entrega.estado,entrega.revision_estado,
          exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id) con_archivo
        from public.asis_entregas_diarias entrega
        where entrega.colaborador_id=d.id and entrega.fecha=d.fecha and entrega.requisito=req->>'tipo' and entrega.asignacion_id is null
        order by entrega.creado_at desc,entrega.id desc limit 1
      ) e on true
    ) ev
    cross join lateral (
      select count(*) incumplidas from public.asis_asignaciones_diarias x
      left join lateral (
        select estado,revision_estado from public.asis_entregas_diarias
        where colaborador_id=d.id and asignacion_id=x.id order by creado_at desc,id desc limit 1
      ) e on true
      where x.fecha=d.fecha and x.activo and x.requerido
        and (x.colaborador_id=d.id or x.area_id=d.area_id)
        and (e.estado is distinct from 'completo' or e.revision_estado='observada')
    ) asig group by d.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'nombre',c.nombre,'area_id',c.area_id,'area',a.nombre,
    'inicio_conocido',c.contrato_inicio is not null,'inicio',c.contrato_inicio,
    'metricas',coalesce(to_jsonb(r)-'id','{}'::jsonb)||jsonb_build_object('dias_mes',(select count(*) from calendario cal where cal.id=c.id))
  ) order by a.orden,c.nombre,c.id),'[]'::jsonb) into v_filas
  from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id
  left join resumen r on r.id=c.id where c.activo and a.activo;
  return jsonb_build_object('version',2,'mes',v_inicio,'hasta',v_fin,'filas',v_filas,'reuniones_registradas',false);
end;
$$;
revoke all on function public.dash_ranking_mes(date) from public,anon,authenticated;
grant execute on function public.dash_ranking_mes(date) to authenticated;
notify pgrst,'reload schema';
commit;
