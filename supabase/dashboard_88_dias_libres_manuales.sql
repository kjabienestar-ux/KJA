-- Ejecutar después de dashboard_87. Conserva los beneficios presenciales.
begin;
alter table public.asis_descansos_presenciales alter column fecha_presencial drop not null;
alter table public.asis_descansos_presenciales add column if not exists motivo text;
alter table public.asis_descansos_presenciales add column if not exists asignado_por uuid references public.asis_perfiles(id);
create table if not exists public.asis_descansos_auditoria (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.asis_colaboradores(id),
  fecha date not null,accion text not null check(accion in ('asignar','quitar')),
  motivo text,actor uuid not null references public.asis_perfiles(id),creado_at timestamptz not null default now()
);
alter table public.asis_descansos_auditoria enable row level security;
revoke all on public.asis_descansos_auditoria from public,anon,authenticated;

create or replace function public.dash_admin_dia_libre(p_colab bigint,p_fecha date,p_motivo text default null,p_quitar boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_persona public.asis_colaboradores; v_prev public.asis_descansos_presenciales;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false)
    or not coalesce(public.asis_puede_editar(),false) then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha not between date '2020-01-01' and date '2100-12-31' then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  select * into v_persona from public.asis_colaboradores where id=p_colab for update;
  if not found then return jsonb_build_object('ok',false,'motivo','colaborador'); end if;
  select * into v_prev from public.asis_descansos_presenciales where colaborador_id=p_colab and fecha=p_fecha;
  if coalesce(p_quitar,false) then
    if not found then return jsonb_build_object('ok',true); end if;
    if v_prev.fecha_presencial is not null then return jsonb_build_object('ok',false,'motivo','beneficio_presencial'); end if;
    delete from public.asis_descansos_presenciales where colaborador_id=p_colab and fecha=p_fecha;
    insert into public.asis_descansos_auditoria(colaborador_id,fecha,accion,motivo,actor)
      values(p_colab,p_fecha,'quitar',v_prev.motivo,auth.uid());
  else
    if not v_persona.activo or (v_persona.contrato_inicio is not null and p_fecha<v_persona.contrato_inicio) then
      return jsonb_build_object('ok',false,'motivo','colaborador');
    end if;
    if length(btrim(coalesce(p_motivo,''))) not between 3 and 180 then return jsonb_build_object('ok',false,'motivo','detalle'); end if;
    if v_prev.colaborador_id is not null then return jsonb_build_object('ok',false,'motivo','ya_asignado'); end if;
    insert into public.asis_descansos_presenciales(colaborador_id,fecha,motivo,asignado_por)
      values(p_colab,p_fecha,btrim(p_motivo),auth.uid());
    insert into public.asis_descansos_auditoria(colaborador_id,fecha,accion,motivo,actor)
      values(p_colab,p_fecha,'asignar',btrim(p_motivo),auth.uid());
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.dash_admin_dia_libre(bigint,date,text,boolean) from public,anon;
grant execute on function public.dash_admin_dia_libre(bigint,date,text,boolean) to authenticated;

do $$ begin
  if to_regprocedure('public.dash_admin_mes_base_88(integer,integer,boolean)') is null then
    alter function public.dash_admin_mes(integer,integer,boolean) rename to dash_admin_mes_base_88;
  end if;
end $$;
revoke all on function public.dash_admin_mes_base_88(integer,integer,boolean) from public,anon,authenticated;
create or replace function public.dash_admin_mes(p_anio integer,p_mes integer,p_incluir_inactivos boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_dias jsonb;
begin
  v_data:=public.dash_admin_mes_base_88(p_anio,p_mes,p_incluir_inactivos);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(jsonb_build_object('colaborador_id',d.colaborador_id,'fecha',d.fecha,
    'motivo',d.motivo,'manual',d.fecha_presencial is null) order by d.fecha,d.colaborador_id),'[]'::jsonb)
  into v_dias from public.asis_descansos_presenciales d
  where d.fecha between make_date(p_anio,p_mes,1) and (make_date(p_anio,p_mes,1)+interval '1 month - 1 day')::date
    and exists(select 1 from jsonb_array_elements(v_data->'personas') p where (p->>'id')::bigint=d.colaborador_id);
  return v_data||jsonb_build_object('dias_libres',v_dias);
end $$;
revoke all on function public.dash_admin_mes(integer,integer,boolean) from public,anon;
grant execute on function public.dash_admin_mes(integer,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
