-- KJA: piloto humano Meeting SDK. Ejecutar después de 109.
begin;
create table if not exists public.zoom_operadores (
 reunion_id uuid references public.zoom_reuniones(id) on delete cascade,
 perfil_id uuid references public.asis_perfiles(id) on delete cascade,
 otorgado_por uuid references public.asis_perfiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(reunion_id,perfil_id)
);
alter table public.zoom_operadores enable row level security;
revoke all on public.zoom_operadores from public,anon,authenticated;
grant all on public.zoom_operadores to service_role;

create or replace function public.dash_zoom_opera(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.zoom_reuniones r
 where r.id=p_id and r.status='ready' and exists(
 select 1 from public.asis_perfiles p where p.id=auth.uid() and p.activo
 and (p.colaborador_id is null or exists(select 1 from public.asis_colaboradores c where c.id=p.colaborador_id and c.activo))
 and (public.dash_zoom_gestiona() or exists(select 1 from public.zoom_operadores o where o.reunion_id=r.id and o.perfil_id=p.id))));
$$;

create or replace function public.dash_zoom_delegar(p_id uuid,p_email text,p_otorgar boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_perfil uuid;
begin
 if not public.dash_zoom_gestiona() then raise exception 'Solo Sistemas puede delegar Zoom.' using errcode='42501'; end if;
 if p_otorgar is null then raise exception 'Selecciona la acción.'; end if;
 if not exists(select 1 from public.zoom_reuniones where id=p_id and status='ready') then raise exception 'Reunión no disponible.'; end if;
 select p.id into v_perfil from public.asis_perfiles p join auth.users u on u.id=p.id
 where lower(u.email)=lower(trim(p_email))
 and (not p_otorgar or (p.activo and (p.colaborador_id is null or exists(select 1 from public.asis_colaboradores c where c.id=p.colaborador_id and c.activo))));
 if v_perfil is null then raise exception 'No se encontró una cuenta del portal válida con ese correo.'; end if;
 if p_otorgar then
 insert into public.zoom_operadores(reunion_id,perfil_id,otorgado_por) values(p_id,v_perfil,auth.uid()) on conflict do nothing;
 else delete from public.zoom_operadores where reunion_id=p_id and perfil_id=v_perfil;
 end if;
 insert into public.zoom_eventos(reunion_id,actor_id,action,result) values(p_id,auth.uid(),case when p_otorgar then 'operator_grant' else 'operator_revoke' end,v_perfil::text);
 return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.dash_zoom_operaciones()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ok',true,'admin',public.dash_zoom_gestiona(),'meetings',
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'topic',r.topic,'zoom_id',r.zoom_id,
 'operators',case when public.dash_zoom_gestiona() then
 coalesce((select jsonb_agg(u.email order by u.email) from public.zoom_operadores o join auth.users u on u.id=o.perfil_id where o.reunion_id=r.id),'[]'::jsonb)
 else '[]'::jsonb end) order by r.topic)
 from public.zoom_reuniones r where public.dash_zoom_opera(r.id)),'[]'::jsonb));
$$;
revoke all on function public.dash_zoom_opera(uuid),public.dash_zoom_delegar(uuid,text,boolean),public.dash_zoom_operaciones() from public,anon;
grant execute on function public.dash_zoom_opera(uuid),public.dash_zoom_delegar(uuid,text,boolean),public.dash_zoom_operaciones() to authenticated;
notify pgrst,'reload schema';
commit;
