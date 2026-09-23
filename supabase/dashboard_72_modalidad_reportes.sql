-- DASHBOARD 72: modalidad real en la lista y el libro mensual.
-- Aplicar después de dashboard_71_historial_comparticiones.sql.
-- Corrige consultas de lectura; no modifica registros ni evidencias.
begin;

do $$ begin
  if to_regprocedure('public.dash_admin_lista_base_72(date)') is null then
    alter function public.dash_admin_lista(date) rename to dash_admin_lista_base_72;
  end if;
  if to_regprocedure('public.dash_admin_mes_base_72(integer,integer,boolean)') is null then
    alter function public.dash_admin_mes(integer,integer,boolean) rename to dash_admin_mes_base_72;
  end if;
end $$;

revoke all on function public.dash_admin_lista_base_72(date),
  public.dash_admin_mes_base_72(integer,integer,boolean) from public,anon,authenticated;

create or replace function public.dash_admin_lista(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_personas jsonb;
begin
  v_data:=public.dash_admin_lista_base_72(p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(
    persona.item||jsonb_build_object('modalidad',
      public.asis_modalidad_efectiva((persona.item->>'id')::bigint,p_fecha)
    ) order by persona.orden
  ),'[]'::jsonb) into v_personas
  from jsonb_array_elements(coalesce(v_data->'personas','[]'::jsonb))
    with ordinality as persona(item,orden);
  return jsonb_set(v_data,'{personas}',v_personas,true);
end $$;

create or replace function public.dash_admin_mes(
  p_anio integer,p_mes integer,p_incluir_inactivos boolean default false
)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_personas jsonb;
begin
  v_data:=public.dash_admin_mes_base_72(p_anio,p_mes,p_incluir_inactivos);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(
    jsonb_set(persona.item,'{dias}',(
      select coalesce(jsonb_agg(
        dia.item||jsonb_build_object('modalidad',
          public.asis_modalidad_efectiva((persona.item->>'id')::bigint,(dia.item->>'fecha')::date)
        ) order by dia.orden
      ),'[]'::jsonb)
      from jsonb_array_elements(coalesce(persona.item->'dias','[]'::jsonb))
        with ordinality as dia(item,orden)
    ),true) order by persona.orden
  ),'[]'::jsonb) into v_personas
  from jsonb_array_elements(coalesce(v_data->'personas','[]'::jsonb))
    with ordinality as persona(item,orden);
  return jsonb_set(v_data,'{personas}',v_personas,true);
end $$;

revoke all on function public.dash_admin_lista(date),
  public.dash_admin_mes(integer,integer,boolean) from public,anon;
grant execute on function public.dash_admin_lista(date),
  public.dash_admin_mes(integer,integer,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
