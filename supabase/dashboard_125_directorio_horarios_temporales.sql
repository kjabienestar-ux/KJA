-- Ejecutar después de dashboard_123. Solo amplía la lectura del directorio.
begin;
do $$ begin
  if to_regprocedure('public.dash_admin_equipo_base_125(boolean)') is null then
    alter function public.dash_admin_equipo(boolean) rename to dash_admin_equipo_base_125;
  end if;
end $$;
revoke all on function public.dash_admin_equipo_base_125(boolean) from public,anon,authenticated;

create or replace function public.dash_admin_equipo(p_incluir_inactivos boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_data jsonb;
  v_personas jsonb;
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_lunes date;
begin
  -- Se conserva la autorización y el alcance del directorio original.
  v_data:=public.dash_admin_equipo_base_125(p_incluir_inactivos);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  v_lunes:=v_hoy-(extract(isodow from v_hoy)::integer-1);
  select coalesce(jsonb_agg(fila.item||jsonb_build_object(
    'horarios_temporales',ajustes.dias,
    'semana_vigente',(select jsonb_agg(jsonb_build_object(
      'fecha',f.fecha,'laborable',public.asis_labora(c,f.fecha),
      'entrada',case when public.asis_labora(c,f.fecha) then public.asis_hora_entrada(c,f.fecha) end,
      'salida',case when public.asis_labora(c,f.fecha) then public.asis_hora_salida(c,f.fecha) end,
      'modalidad',public.asis_modalidad_base(c,f.fecha),
      'temporal',exists(select 1 from jsonb_array_elements(ajustes.dias) d where (d->>'fecha')::date=f.fecha)
    ) order by f.fecha) from (select v_lunes+n as fecha from generate_series(0,6) n) f)
  ) order by fila.orden),'[]'::jsonb) into v_personas
  from jsonb_array_elements(coalesce(v_data->'personas','[]'::jsonb)) with ordinality fila(item,orden)
  join public.asis_colaboradores c on c.id=(fila.item->>'id')::bigint
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'fecha',d.fecha,'laborable',public.asis_labora(c,d.fecha),
      'entrada',case when public.asis_labora(c,d.fecha) then public.asis_hora_entrada(c,d.fecha) end,
      'salida',case when public.asis_labora(c,d.fecha) then public.asis_hora_salida(c,d.fecha) end
    ) order by d.fecha),'[]'::jsonb) as dias
    from (
      select h.fecha from public.asis_horarios_puntuales h where h.colaborador_id=c.id
        and h.fecha between v_hoy-180 and v_hoy+180
      union
      select e.fecha from public.asis_excepciones e where e.ambito='colaborador' and e.colaborador_id=c.id
        and e.fecha between v_hoy-180 and v_hoy+180
    ) d
  ) ajustes;
  return v_data||jsonb_build_object('hoy',v_hoy,'personas',v_personas);
end $$;
revoke all on function public.dash_admin_equipo(boolean) from public,anon;
grant execute on function public.dash_admin_equipo(boolean) to authenticated;
notify pgrst,'reload schema';
commit;
