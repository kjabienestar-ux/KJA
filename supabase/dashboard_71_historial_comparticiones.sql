-- DASHBOARD 71: comparticiones en el historial, incluso sin jornada/marcación.
-- Aplicar después de dashboard_70_rpe_presencial.sql. No modifica asistencias,
-- entregas, revisiones, horas ni el cálculo del ranking.
begin;

do $$ begin
  if to_regprocedure('public.dash_historial_base_71(integer,integer,bigint)') is null then
    alter function public.dash_historial(integer,integer,bigint)
      rename to dash_historial_base_71;
  end if;
end $$;
revoke all on function public.dash_historial_base_71(integer,integer,bigint)
  from public,anon,authenticated;

create or replace function public.dash_historial(
  p_anio int,p_mes int,p_colab bigint default null
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_objetivo bigint:=coalesce(p_colab,public.dash_colab());
  v_data jsonb;
  v_dias jsonb;
begin
  -- La función original valida sesión, acceso a la persona y período.
  v_data:=public.dash_historial_base_71(p_anio,p_mes,p_colab);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;

  with dias as materialized (
    select dia,public.dash_cierre_resumen_colab(v_objetivo,(dia->>'fecha')::date) cierre
    from jsonb_array_elements(coalesce(v_data->'dias','[]'::jsonb)) dia
  ), detalles as (
    select dia,cierre,
      coalesce((cierre->>'ok')::boolean,false)
        and coalesce((cierre->>'aplica_comparticiones')::boolean,false) aplica,
      exists(select 1 from jsonb_array_elements(coalesce(cierre->'requisitos','[]'::jsonb)) req
        where req->>'tipo'='comparticiones' and coalesce((req->>'completo')::boolean,false)) completo
    from dias
  )
  select coalesce(jsonb_agg(dia||jsonb_build_object(
    'aplica_comparticiones',aplica,
    'comparticiones_completas',aplica and completo,
    'comparticiones_vencidas',aplica and not completo
      and coalesce((cierre->>'comparticiones_vencidas')::boolean,false),
    'compartir_hasta',case when aplica then cierre->'compartir_hasta' else 'null'::jsonb end
  ) order by dia->>'fecha'),'[]'::jsonb) into v_dias from detalles;

  return jsonb_set(v_data,'{dias}',v_dias);
end $$;
revoke all on function public.dash_historial(integer,integer,bigint) from public,anon,authenticated;
grant execute on function public.dash_historial(integer,integer,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
