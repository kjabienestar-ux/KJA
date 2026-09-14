-- Ejecutar después de dashboard_56. Retira asignaciones sin borrar evidencias.
begin;
create or replace function public.dash_admin_cancelar_entregable(p_asignacion bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  update public.asis_asignaciones_diarias
     set activo=false,actualizado_at=now()
   where id=p_asignacion and activo;
  if not found then
    return jsonb_build_object('ok',false,'motivo','no_disponible');
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.dash_admin_cancelar_entregable(bigint) from public,anon,authenticated;
grant execute on function public.dash_admin_cancelar_entregable(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
