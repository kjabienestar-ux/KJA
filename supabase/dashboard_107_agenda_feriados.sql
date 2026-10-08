-- Aplicar despues de dashboard_106. Agenda de feriados desde Mes completo.
-- Los nuevos feriados eximen jornada y conservan solo Facebook programado.
-- Los feriados historicos conservan su comportamiento anterior.
begin;
alter table public.asis_excepciones add column if not exists solo_comparticiones boolean not null default false;
update public.asis_excepciones set solo_comparticiones=true
where fecha=date '2026-10-08' and ambito='empresa' and tipo='feriado';

create or replace function public.asis_feriado_programado(p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.asis_excepciones where fecha=p_fecha
    and ambito='empresa' and tipo='feriado' and solo_comparticiones)
$$;

create or replace function public.asis_labora(p_colab public.asis_colaboradores,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select case when public.asis_feriado_programado(p_fecha) then false
    else public.asis_labora_base_106(p_colab,p_fecha) end
$$;

create or replace function public.asis_compartir_programado(p_colab bigint,p_fecha date)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_colab public.asis_colaboradores; v_dow integer:=extract(isodow from p_fecha)::integer;
begin
  if not public.asis_feriado_programado(p_fecha) then
    return public.asis_compartir_programado_base_106(p_colab,p_fecha);
  end if;
  select * into v_colab from public.asis_colaboradores where id=p_colab and activo;
  if not found or (v_colab.contrato_inicio is not null and p_fecha<v_colab.contrato_inicio) then
    return false;
  end if;
  if coalesce(v_colab.comparticiones_horario_configurado,false) then
    return exists(select 1 from public.asis_comparticiones_horarios
      where colaborador_id=p_colab and dia_semana=v_dow);
  end if;
  -- La agenda heredada usa el horario habitual, sin volver a exigir jornada.
  return coalesce(v_colab.horario_semanal->v_dow::text->>'mod',
    case when v_dow=any(v_colab.dias_laborables) then 'virtual' else 'no_gestiona' end)<>'no_gestiona';
end $$;

create or replace function public.dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_req jsonb; v_pending integer; v_share boolean;
begin
  v_data:=public.dash_cierre_resumen_colab_base_106(p_colaborador,p_fecha);
  if not public.asis_feriado_programado(p_fecha)
    or not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  v_share:=coalesce((v_data->>'aplica_comparticiones')::boolean,false);
  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb),
    count(*) filter(where not coalesce((item->>'completo')::boolean,false))
    into v_req,v_pending
    from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb))
      with ordinality filas(item,orden)
    where v_share and item->>'tipo'='comparticiones';
  return v_data||jsonb_build_object(
    'feriado',true,'aplica',v_share,'aplica_jornada',false,'solo_comparticiones',v_share,
    'requiere_rpe',false,'requiere_salida',false,'puede_marcar_salida',false,
    'salida_ventana_vencida',false,
    'requisitos',v_req,'asignaciones','[]'::jsonb,
    'pendientes',v_pending,'pendientes_jornada',0,'pendientes_salida',0,
    'comparticiones_pendientes',v_pending>0,
    'comparticiones_vencidas',v_pending>0 and coalesce((v_data->>'comparticiones_vencidas')::boolean,false),
    'estado',case when not v_share then 'no_aplica' when v_pending=0 then 'completa'
      when coalesce((v_data->>'comparticiones_vencidas')::boolean,false) then 'incompleta' else 'en_curso' end);
end $$;

create or replace function public.dash_admin_guardar_feriado(p_fecha date,p_nota text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_nota text:=nullif(btrim(p_nota),'');
begin
  if not public.dash_sesion_vigente() or not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha<(now() at time zone 'America/Lima')::date
    or p_fecha>date '2100-12-31' then return jsonb_build_object('ok',false,'motivo','fecha'); end if;
  if v_nota is not null and char_length(v_nota)>60 then
    return jsonb_build_object('ok',false,'motivo','nota');
  end if;
  perform pg_advisory_xact_lock(107,(p_fecha-date '2000-01-01')::integer);
  delete from public.asis_excepciones where fecha=p_fecha and ambito='empresa';
  insert into public.asis_excepciones(fecha,ambito,tipo,nota,creado_por,solo_comparticiones)
    values(p_fecha,'empresa','feriado',coalesce(v_nota,'Feriado nacional'),auth.uid(),true);
  return jsonb_build_object('ok',true,'fecha',p_fecha);
end $$;

create or replace function public.dash_admin_quitar_feriado(p_fecha date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_eliminados integer;
begin
  if not public.dash_sesion_vigente() or not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha<(now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  perform pg_advisory_xact_lock(107,(p_fecha-date '2000-01-01')::integer);
  delete from public.asis_excepciones where fecha=p_fecha and ambito='empresa';
  get diagnostics v_eliminados=row_count;
  return jsonb_build_object('ok',true,'eliminados',v_eliminados);
end $$;

create or replace function public.dash_admin_feriados_proximos()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_hoy date:=(now() at time zone 'America/Lima')::date;
begin
  if not public.dash_sesion_vigente() or not public.asis_es_miembro() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  return jsonb_build_object('ok',true,'hoy',v_hoy,'puede_editar',public.asis_puede_editar(),
    'feriados',coalesce((select jsonb_agg(item order by item->>'fecha') from (
      select distinct on(fecha) jsonb_build_object('fecha',fecha,'nota',nota,
        'solo_comparticiones',solo_comparticiones) item
      from public.asis_excepciones where ambito='empresa' and tipo='feriado' and fecha>=v_hoy
      order by fecha,id desc
    ) agenda),'[]'::jsonb));
end $$;

-- El libro mensual calculaba excepciones extra antes de los feriados.
-- Conserva esas excepciones sin borrarlas: cancelar el feriado las restaura.
do $$ begin
  if to_regprocedure('public.dash_admin_mes_base_107(integer,integer,boolean)') is null then
    alter function public.dash_admin_mes(integer,integer,boolean) rename to dash_admin_mes_base_107;
  end if;
end $$;
create or replace function public.dash_admin_mes(p_anio integer,p_mes integer,p_incluir_inactivos boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_people jsonb;
begin
  v_data:=public.dash_admin_mes_base_107(p_anio,p_mes,p_incluir_inactivos);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(person||jsonb_build_object('dias',(
    select coalesce(jsonb_agg(case when public.asis_feriado_programado((day->>'fecha')::date)
      then day||jsonb_build_object('laborable',false,'motivo','feriado') else day end order by dn),'[]'::jsonb)
    from jsonb_array_elements(person->'dias') with ordinality d(day,dn)
  )) order by pn),'[]'::jsonb) into v_people
  from jsonb_array_elements(v_data->'personas') with ordinality p(person,pn);
  return v_data||jsonb_build_object('personas',v_people);
end $$;

revoke all on function public.asis_feriado_programado(date),
  public.asis_labora(public.asis_colaboradores,date),public.asis_compartir_programado(bigint,date),
  public.dash_cierre_resumen_colab(bigint,date),public.dash_admin_mes_base_107(integer,integer,boolean)
  from public,anon,authenticated;
revoke all on function public.dash_admin_guardar_feriado(date,text),public.dash_admin_quitar_feriado(date),
  public.dash_admin_feriados_proximos(),public.dash_admin_mes(integer,integer,boolean) from public,anon;
grant execute on function public.dash_admin_guardar_feriado(date,text),public.dash_admin_quitar_feriado(date),
  public.dash_admin_feriados_proximos(),public.dash_admin_mes(integer,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
