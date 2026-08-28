-- =====================================================================
-- KJA · Dashboard — Fase 5: acceso, marcado propio y cierre de transición
--
-- REQUIERE
--   · migraciones de asistencia 1–14
--   · dashboard_01, dashboard_03, dashboard_04, dashboard_05,
--     dashboard_06 y dashboard_07
--
-- AÑADE
--   · una lectura consolidada exclusiva de Dirección;
--   · configuración segura de tolerancia, evidencia y enlace anterior;
--   · regeneración explícita del enlace de activación;
--   · reinicio de PIN con revocación de sesiones personales;
--   · resolución auditada de avisos de horario;
--   · bitácora privada de acciones sensibles.
--
-- NO MODIFICA FILAS DE NEGOCIO al instalarse. Solo crea tabla, índice y RPC.
-- Las escrituras ocurren después, por una acción expresa de Dirección.
-- No toca tablas, usuarios ni políticas del módulo de certificados.
-- =====================================================================

begin;

-- 1) BITÁCORA PRIVADA ------------------------------------------------
create table if not exists public.asis_admin_eventos (
  id              bigint generated always as identity primary key,
  actor_id        uuid references public.asis_perfiles(id) on delete set null,
  accion          text not null check (accion in (
    'config_portal','regenerar_enlace','reiniciar_pin','resolver_horario'
  )),
  colaborador_id  bigint references public.asis_colaboradores(id) on delete set null,
  detalle         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists asis_admin_eventos_fecha_idx
  on public.asis_admin_eventos(created_at desc);

alter table public.asis_admin_eventos enable row level security;
revoke all on table public.asis_admin_eventos from public,anon,authenticated;
revoke all on sequence public.asis_admin_eventos_id_seq
  from public,anon,authenticated;


-- 2) CENTRO DE ACCESO CONSOLIDADO -----------------------------------
create or replace function public.dash_admin_marcado()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_personas jsonb;
  v_solicitudes jsonb;
  v_eventos jsonb;
  v_resumen jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select jsonb_build_object(
    'clave',c.clave,
    'tolerancia_min',c.tolerancia_min,
    'activo',c.activo,
    'exigir_evidencia',coalesce(c.exigir_evidencia,false),
    'actualizado_at',c.actualizado_at
  ) into v_config
  from public.asis_portal_config c where c.id=1;
  if v_config is null then
    return jsonb_build_object('ok',false,'motivo','sin_configuracion');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',c.id,'nombre',c.nombre,'area_id',c.area_id,'area',a.nombre,
    'activo',c.activo,'dni_configurado',nullif(regexp_replace(coalesce(c.dni,''),'[^0-9]','','g'),'') is not null,
    'tiene_pin',k.colaborador_id is not null,
    'pin_creado_at',k.creado_at,
    'ultimo_ingreso',k.ultimo_ingreso,
    'fallidos_total',coalesce(k.fallidos_total,0),
    'bloqueado',k.bloqueado_hasta is not null and k.bloqueado_hasta>now(),
    'bloqueado_hasta',k.bloqueado_hasta,
    'tiene_cuenta',exists(
      select 1 from public.asis_perfiles p
      where p.colaborador_id=c.id and p.acceso_panel=false
    )
  ) order by a.orden,c.orden,c.nombre) into v_personas
  from public.asis_colaboradores c
  join public.asis_areas a on a.id=c.area_id
  left join public.asis_claves k on k.colaborador_id=c.id
  where c.activo=true;

  select jsonb_build_object(
    'activos',count(*),
    'con_pin',count(k.colaborador_id),
    'sin_pin',count(*) filter(where k.colaborador_id is null),
    'sin_dni',count(*) filter(where nullif(regexp_replace(coalesce(c.dni,''),'[^0-9]','','g'),'') is null),
    'bloqueados',count(*) filter(where k.bloqueado_hasta is not null and k.bloqueado_hasta>now())
  ) into v_resumen
  from public.asis_colaboradores c
  left join public.asis_claves k on k.colaborador_id=c.id
  where c.activo=true;

  select jsonb_agg(jsonb_build_object(
    'id',s.id,'colaborador_id',s.colaborador_id,'nombre',c.nombre,
    'area',a.nombre,'horario_nuevo',s.horario_nuevo,
    'horario_previo',s.horario_previo,'creado_at',s.creado_at
  ) order by s.creado_at) into v_solicitudes
  from public.asis_solicitudes_horario s
  join public.asis_colaboradores c on c.id=s.colaborador_id
  join public.asis_areas a on a.id=c.area_id
  where s.estado='pendiente';

  select jsonb_agg(jsonb_build_object(
    'id',e.id,'accion',e.accion,'created_at',e.created_at,
    'actor',p.nombre,'colaborador_id',e.colaborador_id,
    'colaborador',c.nombre,'detalle',e.detalle
  ) order by e.created_at desc) into v_eventos
  from (
    select * from public.asis_admin_eventos order by created_at desc limit 20
  ) e
  left join public.asis_perfiles p on p.id=e.actor_id
  left join public.asis_colaboradores c on c.id=e.colaborador_id;

  return jsonb_build_object(
    'ok',true,
    'config',v_config,
    'resumen',coalesce(v_resumen,'{}'::jsonb),
    'personas',coalesce(v_personas,'[]'::jsonb),
    'solicitudes',coalesce(v_solicitudes,'[]'::jsonb),
    'eventos',coalesce(v_eventos,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.dash_admin_marcado() from public,anon;
grant execute on function public.dash_admin_marcado() to authenticated;


-- 3) CONFIGURACIÓN DEL MARCADO --------------------------------------
create or replace function public.dash_admin_guardar_portal(
  p_tolerancia integer,
  p_activo boolean,
  p_exigir_evidencia boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes public.asis_portal_config;
  v_despues public.asis_portal_config;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_tolerancia is null or p_tolerancia not between 0 and 120
     or p_activo is null or p_exigir_evidencia is null then
    return jsonb_build_object('ok',false,'motivo','configuracion');
  end if;

  select * into v_antes from public.asis_portal_config where id=1 for update;
  if not found then
    return jsonb_build_object('ok',false,'motivo','sin_configuracion');
  end if;

  update public.asis_portal_config set
    tolerancia_min=p_tolerancia,
    activo=p_activo,
    exigir_evidencia=p_exigir_evidencia,
    actualizado_at=now()
  where id=1 returning * into v_despues;

  insert into public.asis_admin_eventos(actor_id,accion,detalle)
  values(auth.uid(),'config_portal',jsonb_build_object(
    'antes',jsonb_build_object(
      'tolerancia_min',v_antes.tolerancia_min,
      'activo',v_antes.activo,
      'exigir_evidencia',coalesce(v_antes.exigir_evidencia,false)),
    'despues',jsonb_build_object(
      'tolerancia_min',v_despues.tolerancia_min,
      'activo',v_despues.activo,
      'exigir_evidencia',coalesce(v_despues.exigir_evidencia,false))
  ));

  return jsonb_build_object('ok',true,'config',jsonb_build_object(
    'tolerancia_min',v_despues.tolerancia_min,
    'activo',v_despues.activo,
    'exigir_evidencia',coalesce(v_despues.exigir_evidencia,false),
    'actualizado_at',v_despues.actualizado_at
  ));
end;
$$;

revoke all on function public.dash_admin_guardar_portal(integer,boolean,boolean)
  from public,anon;
grant execute on function public.dash_admin_guardar_portal(integer,boolean,boolean)
  to authenticated;


-- 4) REGENERAR EL ENLACE ANTERIOR -----------------------------------
create or replace function public.dash_admin_regenerar_enlace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_clave text;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  v_clave := encode(sha256((random()::text || clock_timestamp()::text ||
                            coalesce(auth.uid()::text,''))::bytea),'hex');
  update public.asis_portal_config
     set clave=v_clave,actualizado_at=now()
   where id=1;
  if not found then
    return jsonb_build_object('ok',false,'motivo','sin_configuracion');
  end if;

  insert into public.asis_admin_eventos(actor_id,accion,detalle)
  values(auth.uid(),'regenerar_enlace',jsonb_build_object(
    'resultado','enlace_anterior_invalidado'));

  return jsonb_build_object('ok',true,'clave',v_clave);
end;
$$;

revoke all on function public.dash_admin_regenerar_enlace() from public,anon;
grant execute on function public.dash_admin_regenerar_enlace() to authenticated;


-- 5) REINICIAR PIN Y REVOCAR SESIONES PERSONALES --------------------
create or replace function public.dash_admin_reiniciar_pin(p_colab bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_claves integer;
  v_sesiones integer;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select nombre into v_nombre from public.asis_colaboradores where id=p_colab;
  if not found then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;

  delete from public.asis_claves where colaborador_id=p_colab;
  get diagnostics v_claves = row_count;

  update public.dash_sesiones set revocada_at=now()
  where perfil_id in (
    select id from public.asis_perfiles
    where colaborador_id=p_colab and acceso_panel=false
  ) and revocada_at is null;
  get diagnostics v_sesiones = row_count;

  insert into public.asis_admin_eventos(
    actor_id,accion,colaborador_id,detalle
  ) values(auth.uid(),'reiniciar_pin',p_colab,jsonb_build_object(
    'tenia_pin',v_claves>0,'sesiones_revocadas',v_sesiones));

  return jsonb_build_object(
    'ok',true,'nombre',v_nombre,'tenia_pin',v_claves>0,
    'sesiones_revocadas',v_sesiones
  );
end;
$$;

revoke all on function public.dash_admin_reiniciar_pin(bigint) from public,anon;
grant execute on function public.dash_admin_reiniciar_pin(bigint) to authenticated;


-- 6) RESOLVER AVISO DE HORARIO CON AUDITORÍA ------------------------
create or replace function public.dash_admin_resolver_horario(
  p_id bigint,
  p_aplicada boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint;
  v_horario text;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_aplicada is null then
    return jsonb_build_object('ok',false,'motivo','estado');
  end if;

  select colaborador_id,horario_nuevo into v_colab,v_horario
  from public.asis_solicitudes_horario
  where id=p_id and estado='pendiente' for update;
  if not found then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;

  update public.asis_solicitudes_horario set
    estado=case when p_aplicada then 'aplicada' else 'rechazada' end,
    resuelto_por=auth.uid(),resuelto_at=now()
  where id=p_id;

  insert into public.asis_admin_eventos(
    actor_id,accion,colaborador_id,detalle
  ) values(auth.uid(),'resolver_horario',v_colab,jsonb_build_object(
    'resultado',case when p_aplicada then 'aplicada' else 'rechazada' end,
    'horario_solicitado',v_horario));

  return jsonb_build_object('ok',true,'aplicada',p_aplicada);
end;
$$;

revoke all on function public.dash_admin_resolver_horario(bigint,boolean)
  from public,anon;
grant execute on function public.dash_admin_resolver_horario(bigint,boolean)
  to authenticated;


notify pgrst,'reload schema';

-- COMPROBACIÓN: las siete filas deben decir OK.
select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select p.proname pieza,count(*)::integer encontrado,1 esperado
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'dash_admin_marcado','dash_admin_guardar_portal',
    'dash_admin_regenerar_enlace','dash_admin_reiniciar_pin',
    'dash_admin_resolver_horario'
  )
  group by p.proname
  union all
  select 'tabla asis_admin_eventos',count(*)::integer,1
  from information_schema.tables
  where table_schema='public' and table_name='asis_admin_eventos'
  union all
  select 'RLS asis_admin_eventos',count(*)::integer,1
  from pg_tables
  where schemaname='public' and tablename='asis_admin_eventos'
    and rowsecurity=true
) comprobacion
order by pieza;

commit;
