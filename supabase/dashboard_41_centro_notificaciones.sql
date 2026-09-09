-- DASHBOARD 41 · CENTRO UNIFICADO DE NOTIFICACIONES
-- Ejecutar después de dashboard_40_eliminar_notificaciones_revision.sql.
-- Conserva la auditoría de revisiones y añade mensajes directos y asignaciones.

begin;

create table if not exists public.asis_notificaciones (
  id              bigint generated always as identity primary key,
  colaborador_id  bigint not null references public.asis_colaboradores(id) on delete cascade,
  tipo            text not null check (tipo in ('revision_aprobada','revision_observada','mensaje_direccion','asignacion')),
  titulo          text not null check (char_length(btrim(titulo)) between 2 and 120),
  mensaje         text check (mensaje is null or char_length(btrim(mensaje)) between 1 and 700),
  fecha           date,
  entrega_id      bigint references public.asis_entregas_diarias(id) on delete set null,
  asignacion_id   bigint references public.asis_asignaciones_diarias(id) on delete set null,
  actor_id        uuid references public.asis_perfiles(id) on delete set null,
  datos           jsonb not null default '{}'::jsonb,
  creado_at       timestamptz not null default now(),
  leida_at        timestamptz,
  ocultada_at     timestamptz,
  dedupe_key      text
);

create unique index if not exists asis_notificaciones_dedupe_idx
  on public.asis_notificaciones(dedupe_key)
  where dedupe_key is not null;

create index if not exists asis_notificaciones_bandeja_idx
  on public.asis_notificaciones(colaborador_id, creado_at desc)
  where ocultada_at is null;

alter table public.asis_notificaciones enable row level security;
drop policy if exists asis_notificaciones_propias on public.asis_notificaciones;
create policy asis_notificaciones_propias on public.asis_notificaciones
  for select to authenticated
  using (colaborador_id = public.dash_colab());

revoke all on public.asis_notificaciones from public, anon, authenticated;
grant select on public.asis_notificaciones to authenticated;

-- Lleva el historial existente a la nueva bandeja sin marcarlo como nuevo.
insert into public.asis_notificaciones (
  colaborador_id, tipo, titulo, mensaje, fecha, entrega_id, actor_id,
  creado_at, leida_at, ocultada_at, dedupe_key
)
select
  entrega.colaborador_id,
  case revision.estado_nuevo
    when 'observada' then 'revision_observada'
    else 'revision_aprobada'
  end,
  case entrega.requisito
    when 'comparticiones' then 'Comparticiones de Facebook'
    when 'rpe' then 'RPE y evidencias del día'
    when 'salida' then 'Evidencia de hora de salida'
    else coalesce(asignacion.titulo, 'Entregable asignado')
  end,
  revision.nota,
  entrega.fecha,
  entrega.id,
  revision.actor_id,
  revision.creado_at,
  coalesce(revision.leida_at, revision.creado_at),
  revision.ocultada_por_colaborador_at,
  'revision:' || revision.id::text
from public.asis_entrega_revisiones revision
join public.asis_entregas_diarias entrega on entrega.id = revision.entrega_id
left join public.asis_asignaciones_diarias asignacion on asignacion.id = entrega.asignacion_id
on conflict (dedupe_key) where dedupe_key is not null do nothing;

-- Las asignaciones activas de hoy o futuras también deben ser visibles al
-- instalar esta fase; las nuevas quedan cubiertas por el trigger inferior.
insert into public.asis_notificaciones (
  colaborador_id, tipo, titulo, mensaje, fecha, asignacion_id, actor_id,
  datos, creado_at, dedupe_key
)
select
  colaborador.id,
  'asignacion',
  asignacion.titulo,
  asignacion.instrucciones,
  asignacion.fecha,
  asignacion.id,
  asignacion.creado_por,
  jsonb_build_object('tipo_entregable', asignacion.tipo),
  asignacion.creado_at,
  'asignacion:' || asignacion.id::text || ':colaborador:' || colaborador.id::text
from public.asis_asignaciones_diarias asignacion
join public.asis_colaboradores colaborador
  on colaborador.activo
 and (
      colaborador.id = asignacion.colaborador_id
      or (asignacion.colaborador_id is null and colaborador.area_id = asignacion.area_id)
 )
where asignacion.activo
  and asignacion.fecha >= (now() at time zone 'America/Lima')::date
on conflict (dedupe_key) where dedupe_key is not null do nothing;

create or replace function public.dash_notificar_revision_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega public.asis_entregas_diarias;
  v_titulo text;
begin
  select * into v_entrega
    from public.asis_entregas_diarias
   where id = new.entrega_id;

  if v_entrega.id is null then
    return new;
  end if;

  select case v_entrega.requisito
           when 'comparticiones' then 'Comparticiones de Facebook'
           when 'rpe' then 'RPE y evidencias del día'
           when 'salida' then 'Evidencia de hora de salida'
           else coalesce(asignacion.titulo, 'Entregable asignado')
         end
    into v_titulo
    from (select 1) base
    left join public.asis_asignaciones_diarias asignacion
      on asignacion.id = v_entrega.asignacion_id;

  insert into public.asis_notificaciones (
    colaborador_id, tipo, titulo, mensaje, fecha, entrega_id, actor_id,
    creado_at, dedupe_key
  ) values (
    v_entrega.colaborador_id,
    case new.estado_nuevo when 'observada' then 'revision_observada' else 'revision_aprobada' end,
    v_titulo,
    new.nota,
    v_entrega.fecha,
    v_entrega.id,
    new.actor_id,
    new.creado_at,
    'revision:' || new.id::text
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists asis_entrega_revision_notificar on public.asis_entrega_revisiones;
create trigger asis_entrega_revision_notificar
  after insert on public.asis_entrega_revisiones
  for each row execute function public.dash_notificar_revision_trg();

create or replace function public.dash_notificar_asignacion_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.activo then
    return new;
  end if;

  insert into public.asis_notificaciones (
    colaborador_id, tipo, titulo, mensaje, fecha, asignacion_id, actor_id,
    datos, creado_at, dedupe_key
  )
  select
    colaborador.id,
    'asignacion',
    new.titulo,
    new.instrucciones,
    new.fecha,
    new.id,
    new.creado_por,
    jsonb_build_object('tipo_entregable', new.tipo),
    new.creado_at,
    'asignacion:' || new.id::text || ':colaborador:' || colaborador.id::text
  from public.asis_colaboradores colaborador
  where colaborador.activo
    and (
      colaborador.id = new.colaborador_id
      or (new.colaborador_id is null and colaborador.area_id = new.area_id)
    )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists asis_asignacion_notificar on public.asis_asignaciones_diarias;
create trigger asis_asignacion_notificar
  after insert on public.asis_asignaciones_diarias
  for each row execute function public.dash_notificar_asignacion_trg();

create or replace function public.dash_admin_enviar_mensaje(
  p_colaborador bigint,
  p_mensaje text,
  p_asunto text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_mensaje text := nullif(left(btrim(coalesce(p_mensaje, '')), 700), '');
  v_asunto text := coalesce(nullif(left(btrim(coalesce(p_asunto, '')), 120), ''), 'Mensaje de Dirección');
  v_envios_recientes integer;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_colaborador is null or v_mensaje is null or char_length(v_mensaje) < 3
     or char_length(v_asunto) < 2 then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if not exists (
    select 1 from public.asis_colaboradores
     where id = p_colaborador and activo
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'colaborador');
  end if;

  select count(*)::integer into v_envios_recientes
    from public.asis_notificaciones
   where actor_id = auth.uid()
     and tipo = 'mensaje_direccion'
     and creado_at >= now() - interval '1 hour';
  if v_envios_recientes >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  insert into public.asis_notificaciones (
    colaborador_id, tipo, titulo, mensaje, fecha, actor_id
  ) values (
    p_colaborador, 'mensaje_direccion', v_asunto, v_mensaje,
    (now() at time zone 'America/Lima')::date, auth.uid()
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'colaborador_id', p_colaborador);
end;
$$;

revoke all on function public.dash_admin_enviar_mensaje(bigint, text, text) from public, anon;
grant execute on function public.dash_admin_enviar_mensaje(bigint, text, text) to authenticated;

create or replace function public.dash_mis_notificaciones_revision(
  p_limite integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_limite integer := greatest(1, least(coalesce(p_limite, 24), 50));
  v_no_leidas integer := 0;
  v_notificaciones jsonb := '[]'::jsonb;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select count(*)::integer into v_no_leidas
    from public.asis_notificaciones notificacion
   where notificacion.colaborador_id = v_colab
     and notificacion.leida_at is null
     and notificacion.ocultada_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', item.id,
           'tipo', item.tipo,
           'estado', case item.tipo
             when 'revision_observada' then 'observada'
             when 'revision_aprobada' then 'aprobada'
             else item.tipo
           end,
           'nota', item.mensaje,
           'titulo', item.titulo,
           'fecha', item.fecha,
           'creado_at', item.creado_at,
           'leida', item.leida_at is not null,
           'entrega_id', item.entrega_id,
           'asignacion_id', item.asignacion_id,
           'meta', item.datos
         ) order by item.creado_at desc, item.id desc), '[]'::jsonb)
    into v_notificaciones
    from (
      select *
        from public.asis_notificaciones
       where colaborador_id = v_colab
         and ocultada_at is null
       order by creado_at desc, id desc
       limit v_limite
    ) item;

  return jsonb_build_object(
    'ok', true,
    'no_leidas', v_no_leidas,
    'notificaciones', v_notificaciones
  );
end;
$$;

revoke all on function public.dash_mis_notificaciones_revision(integer) from public, anon;
grant execute on function public.dash_mis_notificaciones_revision(integer) to authenticated;

create or replace function public.dash_marcar_notificaciones_revision(
  p_ids bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_marcadas integer := 0;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  if p_ids is not null and cardinality(p_ids) > 50 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  with actualizadas as (
    update public.asis_notificaciones
       set leida_at = now()
     where colaborador_id = v_colab
       and ocultada_at is null
       and leida_at is null
       and (p_ids is null or id = any(p_ids))
    returning id
  )
  select count(*)::integer into v_marcadas from actualizadas;

  return jsonb_build_object('ok', true, 'marcadas', v_marcadas);
end;
$$;

revoke all on function public.dash_marcar_notificaciones_revision(bigint[]) from public, anon;
grant execute on function public.dash_marcar_notificaciones_revision(bigint[]) to authenticated;

create or replace function public.dash_eliminar_notificacion_revision(
  p_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_ocultada bigint;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;

  update public.asis_notificaciones
     set ocultada_at = coalesce(ocultada_at, now())
   where id = p_id
     and colaborador_id = v_colab
  returning id into v_ocultada;

  if v_ocultada is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  end if;

  return jsonb_build_object('ok', true, 'id', v_ocultada);
end;
$$;

revoke all on function public.dash_eliminar_notificacion_revision(bigint) from public, anon;
grant execute on function public.dash_eliminar_notificacion_revision(bigint) to authenticated;

-- Realtime acelera el aviso; el cliente mantiene polling como respaldo.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'asis_notificaciones'
     ) then
    alter publication supabase_realtime add table public.asis_notificaciones;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'tabla privada de notificaciones'::text as pieza,
         count(*)::integer as encontrado,
         1 as esperado
    from information_schema.tables
   where table_schema = 'public' and table_name = 'asis_notificaciones'
  union all
  select 'RPC de mensajes de Dirección', count(*)::integer, 1
    from pg_proc procedimiento
    join pg_namespace esquema on esquema.oid = procedimiento.pronamespace
   where esquema.nspname = 'public'
     and procedimiento.proname = 'dash_admin_enviar_mensaje'
     and procedimiento.pronargs = 3
  union all
  select 'triggers de notificación', count(*)::integer, 2
    from pg_trigger
   where not tgisinternal
     and tgname in ('asis_entrega_revision_notificar','asis_asignacion_notificar')
) revision;
