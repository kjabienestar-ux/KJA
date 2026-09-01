-- KJA Dashboard · Fase 15
-- Entrega el punto oficial al usuario autenticado únicamente cuando su modalidad es presencial.
-- Requiere dashboard_13_modalidad_y_geocerca.sql y dashboard_14_mapa_oficina_auditable.sql.

begin;

create or replace function public.dash_protocolo_marcado(
  p_protocolo integer,
  p_lat numeric default null,
  p_lon numeric default null,
  p_precision numeric default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_protocolo constant integer := 20260902;
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_dia jsonb;
  v_modalidad text;
  v_distancia numeric;
  v_motivo text;
begin
  if p_protocolo is distinct from v_protocolo then
    return jsonb_build_object('ok',false,'motivo','version_antigua','protocolo',v_protocolo);
  end if;
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;

  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  select * into v_cfg from public.asis_portal_config where id=1;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;

  v_dia := public.asis_mi_dia(v_colab,coalesce(v_cfg.tolerancia_min,15));
  v_modalidad := v_dia->>'modalidad';

  if v_modalidad='presencial' and p_lat is not null and p_lon is not null
     and p_lat between -90 and 90 and p_lon between -180 and 180
     and v_cfg.oficina_lat is not null and v_cfg.oficina_lon is not null then
    v_distancia := public.asis_distancia_m(p_lat,p_lon,v_cfg.oficina_lat,v_cfg.oficina_lon);
  end if;

  v_motivo := case
    when coalesce((v_dia->>'marcado')::boolean,false) then 'ya_marcado'
    when not coalesce((v_dia->>'labora')::boolean,false) then 'no_labora'
    when not coalesce((v_dia->>'horario_completo')::boolean,false) then 'horario_incompleto'
    when v_dia->>'ventana' not in ('presente','tardanza') then 'fuera_ventana'
    when v_modalidad='presencial' and (v_cfg.oficina_lat is null or v_cfg.oficina_lon is null) then 'oficina_no_configurada'
    when v_modalidad='presencial' and (p_lat is null or p_lon is null) then 'ubicacion_requerida'
    when v_modalidad='presencial' and (p_lat not between -90 and 90 or p_lon not between -180 and 180) then 'ubicacion_invalida'
    when v_modalidad='presencial' and (p_precision is null or p_precision<=0 or p_precision>500) then 'ubicacion_imprecisa'
    when v_modalidad='presencial' and v_distancia>v_cfg.radio_presencial_m then 'fuera_radio'
    else null end;

  return jsonb_build_object(
    'ok',true,
    'protocolo',v_protocolo,
    'evidencia_obligatoria',true,
    'puede_marcar',v_motivo is null,
    'motivo',v_motivo,
    'servidor_at',now(),
    'modalidad',v_modalidad,
    'distancia_m',v_distancia,
    'radio_presencial_m',coalesce(v_cfg.radio_presencial_m,1000),
    'geocerca_configurada',v_cfg.oficina_lat is not null and v_cfg.oficina_lon is not null,
    'oficina_lat',case when v_modalidad='presencial' then v_cfg.oficina_lat else null end,
    'oficina_lon',case when v_modalidad='presencial' then v_cfg.oficina_lon else null end,
    'dia',v_dia);
end;
$$;

revoke all on function public.dash_protocolo_marcado(integer,numeric,numeric,numeric) from public,anon;
grant execute on function public.dash_protocolo_marcado(integer,numeric,numeric,numeric) to authenticated;

commit;

notify pgrst,'reload schema';

-- Debe devolver una fila OK.
select
  case
    when has_function_privilege('authenticated','public.dash_protocolo_marcado(integer,numeric,numeric,numeric)','EXECUTE')
     and not has_function_privilege('anon','public.dash_protocolo_marcado(integer,numeric,numeric,numeric)','EXECUTE')
     and position('oficina_lat' in pg_get_functiondef('public.dash_protocolo_marcado(integer,numeric,numeric,numeric)'::regprocedure))>0
    then 'OK' else 'REVISAR'
  end as estado,
  'ruta presencial autenticada' as pieza,
  1 as esperado;
