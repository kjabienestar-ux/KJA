-- DASHBOARD 44 · HORARIOS PROGRAMADOS EN CIERRES
-- Ejecutar despues de dashboard_43_reparar_regularizacion_salida.sql.
-- Expone el horario efectivo de cada fecha, incluidos horarios personalizados,
-- sin entregar al cliente columnas adicionales del perfil.

begin;

do $$
begin
  if to_regprocedure('public.dash_admin_cierres_base_44(date)') is null then
    alter function public.dash_admin_cierres(date)
      rename to dash_admin_cierres_base_44;
  end if;
end;
$$;

revoke all on function public.dash_admin_cierres_base_44(date)
  from public,anon,authenticated;

create or replace function public.dash_admin_cierres(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_data jsonb;
  v_personas jsonb;
begin
  v_data:=public.dash_admin_cierres_base_44(p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;

  select coalesce(jsonb_agg(
           fila.item||jsonb_build_object(
             'hora_inicio_programada',public.asis_hora_entrada(colaborador,p_fecha),
             'hora_salida_programada',public.asis_hora_salida(colaborador,p_fecha)
           ) order by fila.orden
         ),'[]'::jsonb)
    into v_personas
    from jsonb_array_elements(coalesce(v_data->'personas','[]'::jsonb))
         with ordinality as fila(item,orden)
    left join public.asis_colaboradores colaborador
      on colaborador.id=(fila.item->>'id')::bigint;

  return jsonb_set(v_data,'{personas}',v_personas,true);
end;
$$;

revoke all on function public.dash_admin_cierres(date) from public,anon;
grant execute on function public.dash_admin_cierres(date) to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end as estado,
       pieza,encontrado,esperado
from (
  select 'RPC de cierres con horarios'::text as pieza,
         count(*)::integer as encontrado,2 as esperado
    from pg_proc procedimiento
    join pg_namespace esquema on esquema.oid=procedimiento.pronamespace
   where esquema.nspname='public'
     and procedimiento.proname in ('dash_admin_cierres','dash_admin_cierres_base_44')
) revision;
