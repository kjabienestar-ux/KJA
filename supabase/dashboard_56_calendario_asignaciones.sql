-- Ejecutar después de dashboard_55. Consulta mensual sin modificar asignaciones.
begin;
create or replace function public.dash_admin_asignaciones_calendario(p_mes date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_inicio date; v_dias jsonb;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_mes is null or p_mes<date '2020-01-01' or p_mes>((now() at time zone 'America/Lima')::date+120) then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  v_inicio:=date_trunc('month',p_mes)::date;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.fecha),'[]'::jsonb) into v_dias
  from (select fecha,count(*) total from public.asis_asignaciones_diarias
        where activo and fecha>=v_inicio and fecha<(v_inicio+interval '1 month') group by fecha) d;
  return jsonb_build_object('ok',true,'dias',v_dias);
end $$;
revoke all on function public.dash_admin_asignaciones_calendario(date) from public,anon,authenticated;
grant execute on function public.dash_admin_asignaciones_calendario(date) to authenticated;
notify pgrst,'reload schema';
commit;
