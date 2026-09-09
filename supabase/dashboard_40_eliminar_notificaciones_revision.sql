-- DASHBOARD 40 · OCULTAR NOTIFICACIONES DE REVISIÓN
-- Ejecutar después de dashboard_39_alta_direccion_fabrizio_erika.sql.
-- El colaborador puede quitar un aviso de su campana sin borrar la auditoría.

begin;

alter table public.asis_entrega_revisiones
  add column if not exists ocultada_por_colaborador_at timestamptz;

create index if not exists asis_entrega_revisiones_visibles_idx
  on public.asis_entrega_revisiones(entrega_id, creado_at desc)
  where ocultada_por_colaborador_at is null;

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
     and revision.leida_at is null
     and revision.ocultada_por_colaborador_at is null;

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
        and revision.ocultada_por_colaborador_at is null
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

  update public.asis_entrega_revisiones revision
     set ocultada_por_colaborador_at = coalesce(revision.ocultada_por_colaborador_at, now())
    from public.asis_entregas_diarias entrega
   where revision.id = p_id
     and entrega.id = revision.entrega_id
     and entrega.colaborador_id = v_colab
  returning revision.id into v_ocultada;

  if v_ocultada is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  end if;

  return jsonb_build_object('ok', true, 'id', v_ocultada);
end;
$$;

revoke all on function public.dash_eliminar_notificacion_revision(bigint) from public, anon;
grant execute on function public.dash_eliminar_notificacion_revision(bigint) to authenticated;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'ocultación privada sin borrar auditoría'::text as pieza,
         count(*)::integer as encontrado, 1 as esperado
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'asis_entrega_revisiones'
     and column_name = 'ocultada_por_colaborador_at'
  union all
  select 'RPC para quitar una notificación'::text, count(*)::integer, 1
    from pg_proc procedimiento
    join pg_namespace esquema on esquema.oid = procedimiento.pronamespace
   where esquema.nspname = 'public'
     and procedimiento.proname = 'dash_eliminar_notificacion_revision'
     and procedimiento.pronargs = 1
) revision;
