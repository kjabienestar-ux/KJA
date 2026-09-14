-- Ejecutar después de dashboard_57 y desplegar la Edge Function dash-entrega.
-- La cola permite reintentar Storage sin perder las rutas pendientes.
begin;
create table if not exists public.asis_asignacion_archivos_borrar(
  asignacion_id bigint not null references public.asis_asignaciones_diarias(id),
  path text not null,
  solicitado_por uuid not null,
  creado_at timestamptz not null default now(),
  primary key(asignacion_id,path)
);
alter table public.asis_asignacion_archivos_borrar enable row level security;
revoke all on public.asis_asignacion_archivos_borrar from public,anon,authenticated;
grant all on public.asis_asignacion_archivos_borrar to service_role;
create or replace function public.dash_admin_retirar_archivos(p_asignacion bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_paths jsonb;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  perform 1 from public.asis_asignaciones_diarias where id=p_asignacion for update;
  if not found then return jsonb_build_object('ok',false,'motivo','no_disponible'); end if;
  update public.asis_asignaciones_diarias set activo=false,actualizado_at=now() where id=p_asignacion;
  insert into public.asis_asignacion_archivos_borrar(asignacion_id,path,solicitado_por)
    select distinct p_asignacion,f.path,auth.uid()
    from public.asis_entrega_archivos f join public.asis_entregas_diarias e on e.id=f.entrega_id
    where e.asignacion_id=p_asignacion
      and not exists(select 1 from public.asis_entrega_archivos otro
        join public.asis_entregas_diarias eo on eo.id=otro.entrega_id
        where otro.path=f.path and eo.asignacion_id is distinct from p_asignacion)
    on conflict do nothing;
  delete from public.asis_entrega_archivos f using public.asis_entregas_diarias e
    where e.id=f.entrega_id and e.asignacion_id=p_asignacion;
  update public.asis_entregas_diarias set estado='anulado' where asignacion_id=p_asignacion;
  select coalesce(jsonb_agg(path),'[]'::jsonb) into v_paths
    from public.asis_asignacion_archivos_borrar where asignacion_id=p_asignacion;
  return jsonb_build_object('ok',true,'paths',v_paths);
end $$;
revoke all on function public.dash_admin_retirar_archivos(bigint) from public,anon,authenticated;
grant execute on function public.dash_admin_retirar_archivos(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
