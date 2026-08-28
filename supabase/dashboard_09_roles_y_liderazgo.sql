-- =====================================================================
-- KJA · Dashboard — Fase 6: roles y liderazgo por área
--
-- REQUIERE
--   · dashboard_01 a dashboard_08
--
-- AÑADE
--   · lectura consolidada de áreas, líderes y cuentas activadas;
--   · asignación, reemplazo y retiro atómicos del líder de un área;
--   · bitácora privada de cambios de liderazgo.
--
-- NO CAMBIA líderes ni colaboradores al instalarse. Las escrituras ocurren
-- únicamente cuando un administrador de sistemas confirma una acción.
-- No modifica PIN, sesiones, asistencias, contratos ni certificados.
-- =====================================================================

begin;

-- 1) BITÁCORA PRIVADA DE ROLES ---------------------------------------
create table if not exists public.asis_roles_eventos (
  id                 bigint generated always as identity primary key,
  actor_id           uuid references public.asis_perfiles(id) on delete set null,
  accion             text not null check (accion in (
    'asignar_lider','reemplazar_lider','retirar_lider'
  )),
  area_id             bigint references public.asis_areas(id) on delete set null,
  lider_anterior_id  bigint references public.asis_colaboradores(id) on delete set null,
  lider_nuevo_id     bigint references public.asis_colaboradores(id) on delete set null,
  detalle            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists asis_roles_eventos_fecha_idx
  on public.asis_roles_eventos(created_at desc);

alter table public.asis_roles_eventos enable row level security;
revoke all on table public.asis_roles_eventos from public,anon,authenticated;
revoke all on sequence public.asis_roles_eventos_id_seq
  from public,anon,authenticated;


-- 2) LECTURA DEL MAPA DE LIDERAZGO -----------------------------------
create or replace function public.dash_admin_roles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_areas jsonb;
  v_eventos jsonb;
  v_resumen jsonb;
begin
  if not public.asis_es_miembro()
     or public.dash_nivel() is distinct from 'sistemas'
     or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',a.id,
    'nombre',a.nombre,
    'activo',a.activo,
    'personas_activas',(
      select count(*) from public.asis_colaboradores c
       where c.area_id=a.id and c.activo=true
    ),
    'cuentas_activadas',(
      select count(*)
        from public.asis_colaboradores c
        join public.asis_perfiles p on p.colaborador_id=c.id
       where c.area_id=a.id and c.activo=true and p.activo=true
         and p.acceso_panel=false
    ),
    'lider',(
      select jsonb_build_object(
        'id',c.id,'nombre',c.nombre,'activo',c.activo,
        'cuenta_activa',p.activo,
        'contrato_fin_referencia',c.contrato_fin_referencia,
        'tipo_vinculo',c.tipo_vinculo
      )
        from public.asis_perfiles p
        join public.asis_colaboradores c on c.id=p.colaborador_id
       where c.area_id=a.id and p.nivel='lider'
       order by p.activo desc,c.activo desc,c.nombre
       limit 1
    ),
    'personas',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'nombre',c.nombre,'activo',c.activo,
        'nivel',coalesce(p.nivel,'miembro'),
        'tiene_cuenta',p.id is not null,
        'cuenta_activa',coalesce(p.activo,false),
        'es_administrador',coalesce(p.acceso_panel,false),
        'asignable',p.id is not null and p.activo=true
                     and p.acceso_panel=false and c.activo=true,
        'contrato_fin_referencia',c.contrato_fin_referencia,
        'tipo_vinculo',c.tipo_vinculo
      ) order by c.activo desc,c.orden,c.nombre)
        from public.asis_colaboradores c
        left join public.asis_perfiles p on p.colaborador_id=c.id
       where c.area_id=a.id
    ),'[]'::jsonb)
  ) order by a.orden,a.nombre) into v_areas
  from public.asis_areas a
  where a.activo=true;

  select jsonb_build_object(
    'areas',count(*),
    'con_lider',count(*) filter(where exists(
      select 1
        from public.asis_perfiles p
        join public.asis_colaboradores c on c.id=p.colaborador_id
       where c.area_id=a.id and p.nivel='lider'
    )),
    'sin_lider',count(*) filter(where not exists(
      select 1
        from public.asis_perfiles p
        join public.asis_colaboradores c on c.id=p.colaborador_id
       where c.area_id=a.id and p.nivel='lider'
    )),
    'lideres_por_revisar',count(*) filter(where exists(
      select 1
        from public.asis_perfiles p
        join public.asis_colaboradores c on c.id=p.colaborador_id
       where c.area_id=a.id and p.nivel='lider'
         and (not c.activo or not p.activo
              or (c.contrato_fin_referencia is not null
                  and c.contrato_fin_referencia<current_date))
    ))
  ) into v_resumen
  from public.asis_areas a where a.activo=true;

  select jsonb_agg(jsonb_build_object(
    'id',e.id,'accion',e.accion,'created_at',e.created_at,
    'actor',actor.nombre,'area',a.nombre,
    'lider_anterior',anterior.nombre,'lider_nuevo',nuevo.nombre
  ) order by e.created_at desc) into v_eventos
  from (
    select * from public.asis_roles_eventos order by created_at desc limit 20
  ) e
  left join public.asis_perfiles actor on actor.id=e.actor_id
  left join public.asis_areas a on a.id=e.area_id
  left join public.asis_colaboradores anterior on anterior.id=e.lider_anterior_id
  left join public.asis_colaboradores nuevo on nuevo.id=e.lider_nuevo_id;

  return jsonb_build_object(
    'ok',true,
    'resumen',coalesce(v_resumen,'{}'::jsonb),
    'areas',coalesce(v_areas,'[]'::jsonb),
    'eventos',coalesce(v_eventos,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.dash_admin_roles() from public,anon;
grant execute on function public.dash_admin_roles() to authenticated;


-- 3) ASIGNACIÓN ATÓMICA ---------------------------------------------
create or replace function public.dash_admin_asignar_lider(
  p_area bigint,
  p_colab bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area_nombre text;
  v_anterior bigint;
  v_anterior_nombre text;
  v_nuevo_nombre text;
  v_perfil uuid;
  v_accion text;
begin
  if not public.asis_es_miembro()
     or public.dash_nivel() is distinct from 'sistemas'
     or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select nombre into v_area_nombre
    from public.asis_areas
   where id=p_area and activo=true
   for update;
  if not found then
    return jsonb_build_object('ok',false,'motivo','area');
  end if;

  select c.id,c.nombre into v_anterior,v_anterior_nombre
    from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
   where c.area_id=p_area and p.nivel='lider'
   order by p.activo desc,c.activo desc,c.nombre
   limit 1;

  if p_colab is not null then
    select c.nombre into v_nuevo_nombre
      from public.asis_colaboradores c
     where c.id=p_colab and c.area_id=p_area and c.activo=true;
    if not found then
      return jsonb_build_object('ok',false,'motivo','persona_area');
    end if;

    select p.id into v_perfil
      from public.asis_perfiles p
     where p.colaborador_id=p_colab and p.activo=true
       and p.acceso_panel=false;
    if not found then
      return jsonb_build_object('ok',false,'motivo','sin_cuenta');
    end if;

    if v_anterior=p_colab then
      return jsonb_build_object('ok',true,'sin_cambios',true,
        'lider',v_nuevo_nombre,'area',v_area_nombre);
    end if;
  end if;

  -- El área nunca queda en un estado intermedio visible: todo ocurre en
  -- esta misma transacción y el disparador mantiene un solo líder.
  update public.asis_perfiles p set nivel='miembro'
    from public.asis_colaboradores c
   where c.id=p.colaborador_id and c.area_id=p_area and p.nivel='lider';

  if p_colab is null then
    if v_anterior is null then
      return jsonb_build_object('ok',true,'sin_cambios',true,'area',v_area_nombre);
    end if;
    v_accion:='retirar_lider';
  else
    update public.asis_perfiles set nivel='lider' where id=v_perfil;
    v_accion:=case when v_anterior is null then 'asignar_lider'
                   else 'reemplazar_lider' end;
  end if;

  insert into public.asis_roles_eventos(
    actor_id,accion,area_id,lider_anterior_id,lider_nuevo_id,detalle
  ) values (
    auth.uid(),v_accion,p_area,v_anterior,p_colab,
    jsonb_build_object('area',v_area_nombre)
  );

  return jsonb_build_object(
    'ok',true,'accion',v_accion,'area',v_area_nombre,
    'lider_anterior',v_anterior_nombre,'lider_nuevo',v_nuevo_nombre
  );
end;
$$;

revoke all on function public.dash_admin_asignar_lider(bigint,bigint)
  from public,anon;
grant execute on function public.dash_admin_asignar_lider(bigint,bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;


-- 4) COMPROBACIÓN ----------------------------------------------------
select * from (
  select 'tabla asis_roles_eventos'::text pieza,
         (to_regclass('public.asis_roles_eventos') is not null)::int encontrado,
         1 esperado
  union all
  select 'RLS asis_roles_eventos',
         (select relrowsecurity::int from pg_class
           where oid='public.asis_roles_eventos'::regclass),1
  union all
  select 'dash_admin_roles',
         (to_regprocedure('public.dash_admin_roles()') is not null)::int,1
  union all
  select 'dash_admin_asignar_lider',
         (to_regprocedure(
           'public.dash_admin_asignar_lider(bigint,bigint)'
         ) is not null)::int,1
) q
cross join lateral (
  select case when encontrado=esperado then 'OK' else 'REVISAR' end estado
) s
order by pieza;
