-- Aplicar después de dashboard_113. No modifica metas existentes.
begin;
do $$
begin
  if to_regprocedure('public.dash_admin_guardar_colaborador_base_114(jsonb,text)') is null then
    alter function public.dash_admin_guardar_colaborador(jsonb,text)
      rename to dash_admin_guardar_colaborador_base_114;
  end if;
end $$;
-- El guardado original queda disponible solo para el wrapper autorizado.
revoke all on function public.dash_admin_guardar_colaborador_base_114(jsonb,text)
  from public,anon,authenticated;

create or replace function public.dash_admin_guardar_colaborador(
  p_datos jsonb,p_motivo text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id bigint:=nullif(p_datos->>'id','')::bigint;
  v_actual public.asis_colaboradores;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if v_id is not null then
    select * into v_actual from public.asis_colaboradores where id=v_id for update;
    if found then
      -- Un cliente antiguo que recalcula automáticamente no declara una edición
      -- de la meta. Se rechaza todo el guardado para no ocultar el conflicto.
      if (nullif(p_datos->>'contrato_horas','')::numeric is distinct from v_actual.contrato_horas
          or nullif(p_datos->>'contrato_horas_voluntariado','')::numeric
             is distinct from v_actual.contrato_horas_voluntariado)
         and (p_datos->'meta_editada_explicitamente') is distinct from 'true'::jsonb then
        return jsonb_build_object('ok',false,'motivo','meta_requiere_edicion_explicita');
      end if;
    end if;
  end if;
  return public.dash_admin_guardar_colaborador_base_114(p_datos,p_motivo);
end $$;
revoke all on function public.dash_admin_guardar_colaborador(jsonb,text) from public,anon;
grant execute on function public.dash_admin_guardar_colaborador(jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
