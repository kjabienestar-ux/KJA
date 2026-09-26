-- Aplicar después de dashboard_80_salida_independiente_facebook.sql.
-- Consulta de solo lectura: conserva el alcance de Mi equipo y del almacenamiento.
begin;
create or replace function public.dash_equipo_dia_detalle(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_cierre jsonb;
  v_reg public.asis_registros;
  v_entregas jsonb;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false)
    or not coalesce(public.puede_ver_colab(p_colaborador),false) then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha<date '2020-01-01'
    or p_fecha>(now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  v_cierre:=public.dash_cierre_resumen_colab(p_colaborador,p_fecha);
  if not coalesce((v_cierre->>'ok')::boolean,false) then return v_cierre; end if;
  select * into v_reg from public.asis_registros
    where colaborador_id=p_colaborador and fecha=p_fecha;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'tipo',e.requisito,'asignacion_id',e.asignacion_id,
    'titulo',case e.requisito when 'rpe' then 'RPE' when 'salida' then 'Salida'
      when 'comparticiones' then 'Facebook' else coalesce(a.titulo,'Actividad asignada') end,
    'detalle',e.detalle,'completado_at',e.completado_at,
    'archivos',coalesce((select jsonb_agg(jsonb_build_object(
      'bucket','asis-cierre-evidencias','path',f.path,'mime',f.mime
    ) order by f.orden,f.id) from public.asis_entrega_archivos f where f.entrega_id=e.id),'[]'::jsonb)
  ) order by e.completado_at,e.id),'[]'::jsonb) into v_entregas
  from public.asis_entregas_diarias e
  left join public.asis_asignaciones_diarias a on a.id=e.asignacion_id
  where e.colaborador_id=p_colaborador and e.fecha=p_fecha and e.estado='completo';
  return jsonb_build_object('ok',true,'fecha',p_fecha,'colaborador_id',p_colaborador,
    'cierre',v_cierre,'estado',v_reg.estado,'entrada_at',v_reg.marcado_at,
    'salida_at',v_reg.salida_at,'horas',v_reg.horas,'entregas',v_entregas,
    'entrada_archivos',case when nullif(v_reg.evidencia_path,'') is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('bucket','asis-evidencias',
        'path',v_reg.evidencia_path,'mime','image/jpeg')) end);
end $$;
revoke all on function public.dash_equipo_dia_detalle(bigint,date) from public,anon,authenticated;
grant execute on function public.dash_equipo_dia_detalle(bigint,date) to authenticated;
notify pgrst,'reload schema';
commit;
