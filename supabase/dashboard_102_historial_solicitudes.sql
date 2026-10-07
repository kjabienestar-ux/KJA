-- Aplicar después de dashboard_101. Retira solicitudes resueltas del historial
-- personal sin borrar evidencias, aprobaciones ni reservas de días libres.
begin;

alter table public.asis_solicitudes_personales
  add column if not exists ocultado_historial_at timestamptz;

create or replace function public.dash_eliminar_solicitud_historial(p_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id bigint := public.dash_colab();
  v_sol public.asis_solicitudes_personales;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select * into v_sol from public.asis_solicitudes_personales
    where id=p_id and colaborador_id=v_id for update;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if v_sol.estado not in ('aprobada','rechazada') then
    return jsonb_build_object('ok',false,'motivo','pendiente');
  end if;
  update public.asis_solicitudes_personales
    set ocultado_historial_at=coalesce(ocultado_historial_at,now()) where id=p_id;
  return jsonb_build_object('ok',true);
end $$;

-- Filtra antes del límite para que las filas retiradas no ocupen los 20 lugares.
-- Mantiene el enriquecimiento de contraofertas incorporado en la migración 94.
create or replace function public.dash_solicitudes_personales()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_id bigint := public.dash_colab(); v_items jsonb;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select jsonb_agg(jsonb_build_object(
    'id',s.id,'tipo',s.tipo,'fecha_inicio',s.fecha_inicio,'fecha_fin',s.fecha_fin,
    'detalle',s.detalle,'evidencia',s.evidencia_path is not null,
    'estado',s.estado,'respuesta',s.respuesta,'creado_at',s.creado_at,
    'resuelto_at',s.resuelto_at
  ) order by s.creado_at desc,s.id desc) into v_items
  from (select * from public.asis_solicitudes_personales
    where colaborador_id=v_id and ocultado_historial_at is null
    order by creado_at desc,id desc limit 20) s;
  return public.asis_enriquecer_contraofertas(
    jsonb_build_object('ok',true,'solicitudes',coalesce(v_items,'[]'::jsonb)));
end $$;

revoke all on function public.dash_eliminar_solicitud_historial(bigint) from public,anon,authenticated;
revoke all on function public.dash_solicitudes_personales() from public,anon,authenticated;
grant execute on function public.dash_eliminar_solicitud_historial(bigint) to authenticated;
grant execute on function public.dash_solicitudes_personales() to authenticated;

notify pgrst,'reload schema';
commit;
