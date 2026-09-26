-- Aplicar después de las migraciones 78 y anteriores, antes del nuevo frontend.
-- Amplía el detalle personal; no modifica registros ni archivos.
begin;
do $$ begin
  if to_regprocedure('public.dash_dia_detalle_base_79(date)') is null then
    alter function public.dash_dia_detalle(date) rename to dash_dia_detalle_base_79;
  end if;
end $$;

create or replace function public.dash_dia_detalle(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_id bigint:=public.dash_colab();
  v_data jsonb;
  v_archivos jsonb;
  v_actividades jsonb;
  v_salida timestamptz;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_data:=public.dash_dia_detalle_base_79(p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select salida_at into v_salida from public.asis_registros
    where colaborador_id=v_id and fecha=p_fecha;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id','entrega-'||e.id,'tipo',e.requisito,
    'titulo',case e.requisito when 'rpe' then 'RPE' when 'salida' then 'Salida'
      when 'comparticiones' then 'Facebook' else coalesce(a.titulo,'Actividad asignada') end,
    'detalle',e.detalle,'completado_at',e.completado_at
  ) order by e.completado_at,e.id),'[]'::jsonb) into v_actividades
  from public.asis_entregas_diarias e
  left join public.asis_asignaciones_diarias a on a.id=e.asignacion_id
  where e.colaborador_id=v_id and e.fecha=p_fecha and e.estado='completo';

  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket','asis-cierre-evidencias','path',f.path,'mime',f.mime,
    'actividad','entrega-'||e.id,
    'label',case e.requisito when 'rpe' then 'RPE' when 'salida' then 'Salida'
      when 'comparticiones' then 'Facebook' else coalesce(a.titulo,'Actividad asignada') end
  ) order by e.completado_at,e.id,f.orden,f.id),'[]'::jsonb) into v_archivos
  from public.asis_entregas_diarias e
  join public.asis_entrega_archivos f on f.entrega_id=e.id
  left join public.asis_asignaciones_diarias a on a.id=e.asignacion_id
  where e.colaborador_id=v_id and e.fecha=p_fecha and e.estado='completo';

  return v_data||jsonb_build_object('actividades_version',1,'salida_at',v_salida,
    'actividades',v_actividades,'evidencias',coalesce(v_data->'evidencias','[]'::jsonb)||v_archivos);
end $$;
revoke all on function public.dash_dia_detalle_base_79(date) from public,anon,authenticated;
revoke all on function public.dash_dia_detalle(date) from public,anon,authenticated;
grant execute on function public.dash_dia_detalle(date) to authenticated;
notify pgrst,'reload schema';
commit;
