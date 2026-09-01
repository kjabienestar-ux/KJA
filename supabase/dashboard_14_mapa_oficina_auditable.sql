-- =====================================================================
-- KJA · Dashboard 14 — ubicación de oficina auditable
--
-- REQUIERE: dashboard_13_modalidad_y_geocerca.sql
--
-- Mantiene la firma vigente para no interrumpir el dashboard y amplía la
-- trazabilidad: cada reemplazo del punto oficial registra coordenadas
-- anteriores, nuevas y el radio fijo aplicado.
-- =====================================================================

begin;

alter table public.asis_admin_eventos
  drop constraint if exists asis_admin_eventos_accion_check;
alter table public.asis_admin_eventos
  add constraint asis_admin_eventos_accion_check check (accion in (
    'config_portal','config_oficina','regenerar_enlace','reiniciar_pin',
    'resolver_horario','resolver_solicitud'
  ));

create or replace function public.dash_admin_guardar_reglas(
  p_tolerancia integer,p_activo boolean,p_exigir_evidencia boolean,
  p_oficina_lat numeric,p_oficina_lon numeric,p_radio_presencial_m integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_antes public.asis_portal_config;
  v_despues public.asis_portal_config;
  v_cambio_ubicacion boolean;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  if p_tolerancia is null or p_tolerancia not between 0 and 120
     or p_activo is null or p_exigir_evidencia is null
     or p_radio_presencial_m is distinct from 1000
     or ((p_oficina_lat is null)<>(p_oficina_lon is null))
     or (p_oficina_lat is not null and p_oficina_lat not between -90 and 90)
     or (p_oficina_lon is not null and p_oficina_lon not between -180 and 180) then
    return jsonb_build_object('ok',false,'motivo','configuracion');
  end if;

  select * into v_antes
    from public.asis_portal_config
   where id=1
   for update;

  if v_antes.id is null then
    return jsonb_build_object('ok',false,'motivo','sin_configuracion');
  end if;

  v_cambio_ubicacion := v_antes.oficina_lat is distinct from p_oficina_lat
                     or v_antes.oficina_lon is distinct from p_oficina_lon;

  update public.asis_portal_config
     set tolerancia_min=p_tolerancia,
         activo=p_activo,
         exigir_evidencia=true,
         oficina_lat=p_oficina_lat,
         oficina_lon=p_oficina_lon,
         radio_presencial_m=1000,
         actualizado_at=now()
   where id=1
   returning * into v_despues;

  insert into public.asis_admin_eventos(actor_id,accion,detalle)
  values(
    auth.uid(),
    case when v_cambio_ubicacion then 'config_oficina' else 'config_portal' end,
    jsonb_build_object(
      'antes',jsonb_build_object(
        'tolerancia_min',v_antes.tolerancia_min,
        'activo',v_antes.activo,
        'oficina_lat',v_antes.oficina_lat,
        'oficina_lon',v_antes.oficina_lon,
        'radio_presencial_m',v_antes.radio_presencial_m),
      'despues',jsonb_build_object(
        'tolerancia_min',v_despues.tolerancia_min,
        'activo',v_despues.activo,
        'oficina_lat',v_despues.oficina_lat,
        'oficina_lon',v_despues.oficina_lon,
        'radio_presencial_m',v_despues.radio_presencial_m)));

  return jsonb_build_object(
    'ok',true,
    'ubicacion_actualizada',v_cambio_ubicacion,
    'oficina_lat',v_despues.oficina_lat,
    'oficina_lon',v_despues.oficina_lon,
    'radio_presencial_m',v_despues.radio_presencial_m);
end;
$$;

revoke all on function public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer)
  from public,anon;
grant execute on function public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer)
  to authenticated;

comment on function public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer) is
  'Actualiza reglas y punto oficial; solo Dirección y con auditoría de coordenadas antes/después.';

notify pgrst, 'reload schema';

commit;

select
  case when to_regprocedure('public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer)') is not null
       then 'OK' else 'FALTA' end as estado,
  'función de mapa auditable' as pieza,
  1 as encontrado,
  1 as esperado
union all
select
  case when exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
     where n.nspname='public'
       and t.relname='asis_admin_eventos'
       and c.conname='asis_admin_eventos_accion_check'
       and pg_get_constraintdef(c.oid) like '%config_oficina%'
  ) then 'OK' else 'FALTA' end,
  'auditoría de cambio de oficina',
  1,
  1;
