-- Grupos privados creados por el equipo. Requiere chat_11.
begin;
alter table public.chat_grupos add column if not exists privado boolean not null default false;
alter table public.chat_grupos add column if not exists creador uuid references public.asis_perfiles(id);
create or replace function public.chat_grupos()
returns table(id bigint, nombre text, miembros bigint, unido boolean, ultimo text, ultimo_autor text,
  ultimo_remitente uuid, ultimo_at timestamptz, no_leidos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
  select g.id,g.nombre,
    (select count(*) from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id
      where m.grupo_id=g.id and p.activo),
    yo.usuario_id is not null,
    case when yo.usuario_id is not null then u.contenido end,
    case when yo.usuario_id is not null then u.autor end,
    case when yo.usuario_id is not null then u.remitente end,
    case when yo.usuario_id is not null then u.creado_at end,
    case when yo.usuario_id is null then 0::bigint else
      (select count(*) from public.chat_grupo_mensajes n
        where n.grupo_id=g.id and n.remitente<>auth.uid() and n.id>yo.leido_hasta) end
  from public.chat_grupos g
  left join public.chat_grupo_miembros yo on yo.grupo_id=g.id and yo.usuario_id=auth.uid()
  left join lateral (
    select x.contenido,p.nombre as autor,x.remitente,x.creado_at
      from public.chat_grupo_mensajes x join public.asis_perfiles p on p.id=x.remitente
     where x.grupo_id=g.id order by x.id desc limit 1
  ) u on true
  where g.activo and (not g.privado or yo.usuario_id is not null)
  order by g.orden,g.nombre;
end;
$$;

create or replace function public.chat_grupo_unirse(p_grupo bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if not exists(select 1 from public.chat_grupos where id=p_grupo and activo and (not privado or public.chat_grupo_miembro(id))) then
  raise exception 'Este grupo es privado o no está disponible.';
 end if;
 insert into public.chat_grupo_miembros(grupo_id,usuario_id,leido_hasta)
 values(p_grupo,auth.uid(),coalesce((select max(id) from public.chat_grupo_mensajes where grupo_id=p_grupo),0))
 on conflict do nothing;
end $$;

create or replace function public.chat_grupo_crear(p_nombre text,p_miembros uuid[])
returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 if char_length(btrim(coalesce(p_nombre,''))) not between 1 and 60 then raise exception 'Escribe un nombre de hasta 60 caracteres.'; end if;
 if cardinality(p_miembros) is null or cardinality(p_miembros) not between 1 and 100
  or exists(select 1 from unnest(p_miembros) x where not exists(select 1 from public.asis_perfiles where id=x and activo)) then
  raise exception 'Selecciona entre 1 y 100 personas activas.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,743));
 if (select count(*) from public.chat_grupos where creador=auth.uid() and activo)>=30 then raise exception 'Ya administras 30 grupos activos.'; end if;
 insert into public.chat_grupos(nombre,privado,creador) values(btrim(p_nombre),true,auth.uid()) returning id into v_id;
 insert into public.chat_grupo_miembros(grupo_id,usuario_id)
 select v_id,x from (select distinct unnest(p_miembros||array[auth.uid()]) as x) t;
 return v_id;
exception when unique_violation then raise exception 'Ya existe un grupo con ese nombre. Elige otro.';
end $$;

create or replace function public.chat_grupo_detalle(p_grupo bigint)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.chat_grupo_miembro(p_grupo) then raise exception 'No perteneces a este grupo.'; end if;
 return (select jsonb_build_object('id',g.id,'nombre',g.nombre,'creador',g.creador,'privado',g.privado,
  'miembros',(select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'activo',p.activo) order by p.nombre)
    from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id where m.grupo_id=g.id))
  from public.chat_grupos g where g.id=p_grupo);
end $$;

create or replace function public.chat_grupo_administrar(p_grupo bigint,p_accion text,p_usuario uuid default null,p_nombre text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
 select creador into v_owner from public.chat_grupos where id=p_grupo and activo for update;
 if not public.chat_grupo_miembro(p_grupo) or v_owner is distinct from auth.uid() then raise exception 'Solo quien administra este grupo puede cambiarlo.'; end if;
 if p_accion='nombre' then
  if char_length(btrim(coalesce(p_nombre,''))) not between 1 and 60 then raise exception 'Escribe un nombre de hasta 60 caracteres.'; end if;
  update public.chat_grupos set nombre=btrim(p_nombre) where id=p_grupo;
 elsif p_accion='agregar' then
  if not exists(select 1 from public.asis_perfiles where id=p_usuario and activo) then raise exception 'Cuenta no disponible.'; end if;
  if (select count(*) from public.chat_grupo_miembros where grupo_id=p_grupo)>=100 then raise exception 'El grupo llegó a 100 integrantes.'; end if;
  insert into public.chat_grupo_miembros(grupo_id,usuario_id,leido_hasta)
   values(p_grupo,p_usuario,coalesce((select max(id) from public.chat_grupo_mensajes where grupo_id=p_grupo),0)) on conflict do nothing;
 elsif p_accion='quitar' then
  if p_usuario=auth.uid() then raise exception 'Transfiere la administración antes de salir.'; end if;
  delete from public.chat_grupo_miembros where grupo_id=p_grupo and usuario_id=p_usuario;
 elsif p_accion='transferir' then
  if not exists(select 1 from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id where m.grupo_id=p_grupo and m.usuario_id=p_usuario and p.activo) then raise exception 'Elige una persona activa del grupo.'; end if;
  update public.chat_grupos set creador=p_usuario where id=p_grupo;
 else raise exception 'Acción no disponible.';
 end if;
exception when unique_violation then raise exception 'Ya existe un grupo con ese nombre.';
end $$;

create or replace function public.chat_grupo_salir(p_grupo bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 perform id from public.chat_grupos where id=p_grupo for update;
 if exists(select 1 from public.chat_grupos where id=p_grupo and creador=auth.uid()) then
  raise exception 'Transfiere la administración a otra persona antes de salir.';
 end if;
 delete from public.chat_grupo_miembros where grupo_id=p_grupo and usuario_id=auth.uid();
end $$;

create or replace function public.chat_capacidades()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
 return '{"version":2,"grupos":true,"archivos":true,"administrar_grupos":true}'::jsonb;
end $$;
revoke all on function public.chat_grupo_crear(text,uuid[]),public.chat_grupo_detalle(bigint),
 public.chat_grupo_administrar(bigint,text,uuid,text) from public,anon,authenticated;
grant execute on function public.chat_grupo_crear(text,uuid[]),public.chat_grupo_detalle(bigint),
 public.chat_grupo_administrar(bigint,text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;

