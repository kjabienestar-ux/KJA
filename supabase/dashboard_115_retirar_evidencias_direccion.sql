-- Aplicar después de dashboard_114 y desplegar la función dash-entrega.
-- Retira adjuntos RPE/salida; conserva marcas, horas y metas contractuales.
begin;
create table if not exists public.asis_evidencias_archivos_borrar (
  entrega_id bigint not null references public.asis_entregas_diarias(id),
  colaborador_id bigint not null references public.asis_colaboradores(id),
  path text not null,
  creado_at timestamptz not null default now(),
  primary key(entrega_id,path)
);
create table if not exists public.asis_evidencias_retiros_direccion (
  id bigint generated always as identity primary key,
  entrega_id bigint not null,
  colaborador_id bigint not null,
  fecha date not null,
  requisito text not null,
  path text not null,
  actor_id uuid not null,
  creado_at timestamptz not null default now()
);
alter table public.asis_evidencias_archivos_borrar enable row level security;
alter table public.asis_evidencias_retiros_direccion enable row level security;
revoke all on public.asis_evidencias_archivos_borrar,public.asis_evidencias_retiros_direccion from public,anon,authenticated;
grant all on public.asis_evidencias_archivos_borrar,public.asis_evidencias_retiros_direccion to service_role;

create or replace function public.dash_admin_retirar_evidencia(p_entrega bigint,p_path text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint;
  v_entrega public.asis_entregas_diarias;
  v_restantes integer;
begin
  if not coalesce(public.dash_sesion_vigente(),false) or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select colaborador_id into v_colab from public.asis_entregas_diarias where id=p_entrega;
  if v_colab is null then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;
  perform pg_advisory_xact_lock(v_colab);
  select * into v_entrega from public.asis_entregas_diarias
    where id=p_entrega and colaborador_id=v_colab and requisito in ('rpe','salida') for update;
  if not found then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;
  -- Un reintento sólo devuelve rutas autorizadas previamente por esta RPC.
  if exists(select 1 from public.asis_evidencias_archivos_borrar
      where entrega_id=p_entrega and colaborador_id=v_colab and path=p_path) then
    return jsonb_build_object('ok',true,'paths',jsonb_build_array(p_path));
  end if;
  if v_entrega.estado is distinct from 'completo' then
    return jsonb_build_object('ok',false,'motivo','sin_entrega');
  end if;
  if not exists(select 1 from public.asis_entrega_archivos where entrega_id=p_entrega and path=p_path) then
    return jsonb_build_object('ok',false,'motivo','archivo_ajeno');
  end if;
  -- No borrar una ruta utilizada por otra actividad o entrega activa.
  if exists(select 1 from public.asis_entrega_archivos f
      join public.asis_entregas_diarias e on e.id=f.entrega_id
      where f.path=p_path and e.id<>p_entrega and
        (e.colaborador_id<>v_colab or e.requisito<>v_entrega.requisito
         or e.asignacion_id is distinct from v_entrega.asignacion_id
         or e.fecha<>v_entrega.fecha or e.estado<>'anulado')) then
    return jsonb_build_object('ok',false,'motivo','cambio_concurrente');
  end if;
  insert into public.asis_evidencias_archivos_borrar(entrega_id,colaborador_id,path)
    values(p_entrega,v_colab,p_path);
  insert into public.asis_evidencias_retiros_direccion(entrega_id,colaborador_id,fecha,requisito,path,actor_id)
    values(p_entrega,v_colab,v_entrega.fecha,v_entrega.requisito,p_path,auth.uid());
  delete from public.asis_entrega_archivos f using public.asis_entregas_diarias e
    where e.id=f.entrega_id and f.path=p_path and e.colaborador_id=v_colab
      and e.requisito=v_entrega.requisito and e.fecha=v_entrega.fecha
      and e.asignacion_id is not distinct from v_entrega.asignacion_id;
  delete from public.asis_carga_permisos where path=p_path and colaborador_id=v_colab;
  select count(*) into v_restantes from public.asis_entrega_archivos where entrega_id=p_entrega;
  update public.asis_entregas_diarias set
    estado=case when v_restantes=0 then 'anulado' else estado end,
    revision_estado='pendiente',revision_nota=null,revisado_at=null,revisado_por=null
    where id=p_entrega;
  return jsonb_build_object('ok',true,'paths',jsonb_build_array(p_path));
end $$;
revoke all on function public.dash_admin_retirar_evidencia(bigint,text) from public,anon;
grant execute on function public.dash_admin_retirar_evidencia(bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
