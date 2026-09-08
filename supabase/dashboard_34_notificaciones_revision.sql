-- DASHBOARD 34 · NOTIFICACIONES DE REVISIÓN PARA EL COLABORADOR
-- Ejecutar después de dashboard_33_carga_masiva_horarios_comparticiones.sql.
-- Convierte cada aprobación u observación futura en una notificación privada.

begin;

-- Las revisiones anteriores a esta fase se consideran ya vistas para evitar
-- que la campana se estrene con un historial antiguo como si fuera nuevo.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asis_entrega_revisiones'
      and column_name = 'leida_at'
  ) then
    alter table public.asis_entrega_revisiones
      add column leida_at timestamptz;

    update public.asis_entrega_revisiones
       set leida_at = creado_at
     where leida_at is null;
  end if;
end $$;

create index if not exists asis_entrega_revisiones_no_leidas_idx
  on public.asis_entrega_revisiones(entrega_id, creado_at desc)
  where leida_at is null;

create or replace function public.dash_mis_notificaciones_revision(
  p_limite integer default 16
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_limite integer := greatest(1, least(coalesce(p_limite, 16), 30));
  v_no_leidas integer := 0;
  v_notificaciones jsonb := '[]'::jsonb;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select count(*)::integer
    into v_no_leidas
    from public.asis_entrega_revisiones revision
    join public.asis_entregas_diarias entrega on entrega.id = revision.entrega_id
   where entrega.colaborador_id = v_colab
     and revision.leida_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', item.id,
           'estado', item.estado_nuevo,
           'nota', item.nota,
           'fecha', item.fecha,
           'creado_at', item.creado_at,
           'leida', item.leida_at is not null,
           'requisito', item.requisito,
           'titulo', case item.requisito
             when 'comparticiones' then 'Comparticiones de Facebook'
             when 'rpe' then 'RPE y evidencias del día'
             when 'salida' then 'Evidencia de hora de salida'
             else coalesce(item.titulo_asignacion, 'Entregable asignado')
           end
         ) order by item.creado_at desc, item.id desc), '[]'::jsonb)
    into v_notificaciones
    from (
      select
        revision.id,
        revision.estado_nuevo,
        revision.nota,
        revision.creado_at,
        revision.leida_at,
        entrega.fecha,
        entrega.requisito,
        asignacion.titulo as titulo_asignacion
      from public.asis_entrega_revisiones revision
      join public.asis_entregas_diarias entrega on entrega.id = revision.entrega_id
      left join public.asis_asignaciones_diarias asignacion on asignacion.id = entrega.asignacion_id
      where entrega.colaborador_id = v_colab
      order by revision.creado_at desc, revision.id desc
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
    update public.asis_entrega_revisiones revision
       set leida_at = now()
      from public.asis_entregas_diarias entrega
     where entrega.id = revision.entrega_id
       and entrega.colaborador_id = v_colab
       and revision.leida_at is null
       and (p_ids is null or revision.id = any(p_ids))
    returning revision.id
  )
  select count(*)::integer into v_marcadas from actualizadas;

  return jsonb_build_object('ok', true, 'marcadas', v_marcadas);
end;
$$;

revoke all on function public.dash_marcar_notificaciones_revision(bigint[]) from public, anon;
grant execute on function public.dash_marcar_notificaciones_revision(bigint[]) to authenticated;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'columna de lectura'::text as pieza,
         count(*)::integer as encontrado, 1 as esperado
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'asis_entrega_revisiones'
     and column_name = 'leida_at'
  union all
  select 'RPC de notificaciones', count(*)::integer, 2
    from pg_proc procedimiento
    join pg_namespace esquema on esquema.oid = procedimiento.pronamespace
   where esquema.nspname = 'public'
     and procedimiento.proname in (
       'dash_mis_notificaciones_revision',
       'dash_marcar_notificaciones_revision'
     )
) revision;
