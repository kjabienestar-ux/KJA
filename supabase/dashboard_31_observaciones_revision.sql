-- Ejecutar después de dashboard_30_compartir_evidencia_whatsapp.sql.
-- Permite que Dirección guarde una observación opcional al aprobar.
-- Una jornada cerrada continúa sin poder reabrirse para reemplazar archivos.

begin;

create or replace function public.dash_admin_revisar_entrega(
  p_entrega bigint,
  p_estado text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega public.asis_entregas_diarias;
  v_nota text := nullif(left(btrim(coalesce(p_nota, '')), 700), '');
  v_salida timestamptz;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_entrega is null or p_estado is null or p_estado not in ('aprobada','observada') then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if p_estado = 'observada' and (v_nota is null or char_length(v_nota) < 3) then
    return jsonb_build_object('ok', false, 'motivo', 'nota');
  end if;

  select * into v_entrega
    from public.asis_entregas_diarias
   where id = p_entrega
   for update;
  if v_entrega.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;
  if v_entrega.revision_estado <> 'pendiente' or v_entrega.estado <> 'completo' then
    return jsonb_build_object('ok', false, 'motivo', 'ya_revisada');
  end if;

  select salida_at into v_salida
    from public.asis_registros
   where colaborador_id = v_entrega.colaborador_id and fecha = v_entrega.fecha
   for update;
  if p_estado = 'observada' and v_salida is not null then
    return jsonb_build_object('ok', false, 'motivo', 'jornada_cerrada');
  end if;

  update public.asis_entregas_diarias
     set revision_estado = p_estado,
         revision_nota = v_nota,
         revisado_at = now(),
         revisado_por = auth.uid(),
         estado = case when p_estado = 'observada' then 'anulado' else estado end
   where id = v_entrega.id;

  insert into public.asis_entrega_revisiones(
    entrega_id, estado_anterior, estado_nuevo, nota, actor_id
  ) values (
    v_entrega.id, v_entrega.revision_estado, p_estado, v_nota, auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'entrega', v_entrega.id,
    'estado', p_estado,
    'nota', v_nota,
    'colaborador_id', v_entrega.colaborador_id,
    'fecha', v_entrega.fecha
  );
end;
$$;

revoke all on function public.dash_admin_revisar_entrega(bigint, text, text) from public, anon;
grant execute on function public.dash_admin_revisar_entrega(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'RPC observaciones de revisión'::text as pieza,
         count(*)::int as encontrado, 1 as esperado
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'dash_admin_revisar_entrega'
     and p.pronargs = 3
) q;
