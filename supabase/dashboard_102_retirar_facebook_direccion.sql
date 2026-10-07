-- Aplicar después de dashboard_101. Requiere la cola de la migración 63.
begin;
create table if not exists public.asis_facebook_retiros_direccion (
  id bigint generated always as identity primary key,
  entrega_id bigint not null,
  colaborador_id bigint not null,
  fecha date not null,
  path text not null,
  actor_id uuid not null,
  creado_at timestamptz not null default now()
);
alter table public.asis_facebook_retiros_direccion enable row level security;
revoke all on public.asis_facebook_retiros_direccion from public,anon,authenticated;
grant all on public.asis_facebook_retiros_direccion to service_role;
create or replace function public.dash_admin_retirar_imagen_facebook(p_entrega bigint,p_path text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint;
  v_entrega public.asis_entregas_diarias;
  v_restantes integer;
begin
  if not coalesce(public.dash_sesion_vigente(),false) or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select colaborador_id into v_colab from public.asis_entregas_diarias where id=p_entrega;
  if v_colab is null then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;
  perform pg_advisory_xact_lock(v_colab);
  select * into v_entrega from public.asis_entregas_diarias
    where id=p_entrega and colaborador_id=v_colab and requisito='comparticiones' for update;
  if not found then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;
  -- Reintento de una eliminación ya autorizada: sólo termina la limpieza pendiente.
  if exists(select 1 from public.asis_facebook_archivos_borrar
      where entrega_id=p_entrega and colaborador_id=v_colab and path=p_path) then
    return jsonb_build_object('ok',true,'paths',jsonb_build_array(p_path));
  end if;
  if v_entrega.estado<>'completo' then
    return jsonb_build_object('ok',false,'motivo','sin_entrega');
  end if;
  if not exists(select 1 from public.asis_entrega_archivos
      where entrega_id=p_entrega and path=p_path and mime in ('image/jpeg','image/webp','image/png')) then
    return jsonb_build_object('ok',false,'motivo','archivo_ajeno');
  end if;
  -- Una ruta compartida sólo puede pertenecer a versiones previas de esta entrega.
  if exists(select 1 from public.asis_entrega_archivos f
      join public.asis_entregas_diarias e on e.id=f.entrega_id
      where f.path=p_path and e.id<>p_entrega and
        (e.colaborador_id<>v_colab or e.requisito<>'comparticiones'
         or e.fecha<>v_entrega.fecha or e.estado<>'anulado')) then
    return jsonb_build_object('ok',false,'motivo','cambio_concurrente');
  end if;
  insert into public.asis_facebook_archivos_borrar(entrega_id,colaborador_id,path)
    values(p_entrega,v_colab,p_path);
  insert into public.asis_facebook_retiros_direccion(entrega_id,colaborador_id,fecha,path,actor_id)
    values(p_entrega,v_colab,v_entrega.fecha,p_path,auth.uid());
  delete from public.asis_entrega_archivos f using public.asis_entregas_diarias e
    where e.id=f.entrega_id and f.path=p_path and e.colaborador_id=v_colab
      and e.requisito='comparticiones' and e.fecha=v_entrega.fecha;
  delete from public.asis_carga_permisos where path=p_path and colaborador_id=v_colab;
  select count(*) into v_restantes from public.asis_entrega_archivos where entrega_id=p_entrega;
  update public.asis_entregas_diarias set
    estado=case when v_restantes=0 then 'anulado' else estado end,
    revision_estado='pendiente',revision_nota=null,cantidad_compartida=null
    where id=p_entrega;
  return jsonb_build_object('ok',true,'paths',jsonb_build_array(p_path));
end $$;
revoke all on function public.dash_admin_retirar_imagen_facebook(bigint,text) from public,anon;
grant execute on function public.dash_admin_retirar_imagen_facebook(bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
