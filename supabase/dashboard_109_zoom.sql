-- KJA · Zoom: reuniones privadas, por área o persona. Ejecutar después de 108.
begin;
create table if not exists public.zoom_reuniones (
 id uuid primary key,
 zoom_id text unique,
 topic text not null default 'Reunión pendiente',
 host_id text,
 host_email text,
 type integer not null default 2 check(type in (2,3,8)),
 start_time timestamptz,
 duration integer not null default 60 check(duration between 1 and 1440),
 timezone text not null default 'America/Lima',
 recurrence jsonb,
 occurrences jsonb not null default '[]',
 join_url text,
 audience text not null default 'areas' check(audience in ('all','areas','people')),
 area_ids bigint[] not null default '{}',
 person_ids bigint[] not null default '{}',
 status text not null default 'pending' check(status in ('pending','ready','error','cancelled')),
 revision integer not null default 1,
 operation_id uuid,
 busy_until timestamptz,
 last_error text,
 created_by uuid references public.asis_perfiles(id) on delete set null,
 created_at timestamptz not null default now(),
 synced_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.zoom_eventos (
 id bigint generated always as identity primary key,
 reunion_id uuid references public.zoom_reuniones(id),
 actor_id uuid references public.asis_perfiles(id) on delete set null,
 action text not null,
 result text not null,
 created_at timestamptz not null default now()
);
alter table public.zoom_reuniones enable row level security;
alter table public.zoom_eventos enable row level security;
revoke all on public.zoom_reuniones,public.zoom_eventos from public,anon,authenticated;
revoke all on sequence public.zoom_eventos_id_seq from public,anon,authenticated;
grant all on public.zoom_reuniones,public.zoom_eventos to service_role;
grant usage,select on sequence public.zoom_eventos_id_seq to service_role;

create or replace function public.dash_zoom_gestiona()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.asis_perfiles p
 where p.id=auth.uid() and p.activo and p.acceso_panel
 and p.rol='direccion' and p.nivel='sistemas'
 and (p.colaborador_id is null or exists(select 1 from public.asis_colaboradores c where c.id=p.colaborador_id and c.activo)));
$$;
create or replace function public.dash_zoom_puede_unirse(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.zoom_reuniones r where r.id=p_id and r.status='ready'
 and (public.dash_zoom_gestiona() or exists(
 select 1 from public.asis_perfiles p join public.asis_colaboradores c on c.id=p.colaborador_id
 where p.id=auth.uid() and p.activo and c.activo
 and (r.audience='all' or (r.audience='areas' and c.area_id=any(r.area_ids))
 or (r.audience='people' and c.id=any(r.person_ids))))));
$$;
create or replace function public.dash_zoom_listar()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_admin boolean:=public.dash_zoom_gestiona(); v_rows jsonb;
begin
 if not exists(select 1 from public.asis_perfiles p where p.id=auth.uid() and p.activo
 and (p.colaborador_id is null or exists(select 1 from public.asis_colaboradores c where c.id=p.colaborador_id and c.activo))) then
 return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
 select coalesce(jsonb_agg(case when v_admin then
 (to_jsonb(r)-'join_url'-'operation_id'-'created_by') else
 jsonb_build_object('id',r.id,'topic',r.topic,'type',r.type,'start_time',r.start_time,
 'duration',r.duration,'occurrences',r.occurrences,'timezone',r.timezone,'status',r.status)
 end order by r.created_at desc),'[]') into v_rows
 from public.zoom_reuniones r where (v_admin and r.status<>'cancelled') or public.dash_zoom_puede_unirse(r.id);
 return jsonb_build_object('ok',true,'admin',v_admin,'now',now(),'meetings',v_rows,
 'areas',case when v_admin then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre) order by nombre),'[]') from public.asis_areas where activo) else '[]'::jsonb end,
 'people',case when v_admin then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'area_id',area_id) order by nombre),'[]') from public.asis_colaboradores where activo) else '[]'::jsonb end);
end;
$$;
revoke all on function public.dash_zoom_gestiona(),public.dash_zoom_puede_unirse(uuid),public.dash_zoom_listar() from public,anon;
grant execute on function public.dash_zoom_gestiona(),public.dash_zoom_puede_unirse(uuid),public.dash_zoom_listar() to authenticated;
notify pgrst,'reload schema';
commit;
