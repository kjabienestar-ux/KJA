-- Grupos del chat del portal. Ejecutar después de chat_06_realtime_eventos.sql.
-- No modifica mensajes privados, roles ni áreas. Admite reejecución.
begin;

create table if not exists public.chat_grupos (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  orden int not null default 0,
  activo boolean not null default true
);
insert into public.chat_grupos(nombre,orden) values
  ('Ingeniería',1),('Conferencias',2),('Organizacional',3),('Salud Ocupacional',4),('Diseño Gráfico',5),
  ('Reclutamiento',6),('Marketing',7),('Administración',8),('RRHH',9)
on conflict (nombre) do nothing;
alter table public.chat_grupos enable row level security;
revoke all on public.chat_grupos from public, anon, authenticated;

create table if not exists public.chat_grupo_miembros (
  grupo_id bigint not null references public.chat_grupos(id) on delete cascade,
  usuario_id uuid not null references public.asis_perfiles(id) on delete cascade,
  unido_at timestamptz not null default clock_timestamp(),
  leido_hasta bigint not null default 0,
  primary key (grupo_id, usuario_id)
);
create index if not exists chat_grupo_miembros_usuario on public.chat_grupo_miembros(usuario_id);
alter table public.chat_grupo_miembros enable row level security;
revoke all on public.chat_grupo_miembros from public, anon, authenticated;

create table if not exists public.chat_grupo_mensajes (
  id bigint generated always as identity primary key,
  grupo_id bigint not null references public.chat_grupos(id) on delete cascade,
  remitente uuid not null references public.asis_perfiles(id),
  cliente_id uuid not null,
  contenido text not null check (char_length(btrim(contenido)) between 1 and 4000),
  creado_at timestamptz not null default clock_timestamp(),
  unique (remitente, cliente_id)
);
create index if not exists chat_grupo_mensajes_historial on public.chat_grupo_mensajes(grupo_id, id desc);
create index if not exists chat_grupo_mensajes_remitente on public.chat_grupo_mensajes(remitente, creado_at desc);
alter table public.chat_grupo_mensajes enable row level security;
revoke all on public.chat_grupo_mensajes from public, anon, authenticated;

-- Integrante activo de un grupo activo.
create or replace function public.chat_grupo_miembro(p_grupo bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.chat_activo() and exists(
    select 1 from public.chat_grupo_miembros m join public.chat_grupos g on g.id=m.grupo_id
     where m.grupo_id=p_grupo and m.usuario_id=auth.uid() and g.activo);
$$;

-- Lista de grupos: todos visibles; el último mensaje y los pendientes solo para integrantes.
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
  where g.activo
  order by g.orden,g.nombre;
end;
$$;

create or replace function public.chat_grupo_unirse(p_grupo bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  if not exists(select 1 from public.chat_grupos where id=p_grupo and activo) then
    raise exception 'El grupo no está disponible.';
  end if;
  -- El historial previo queda legible, pero no cuenta como pendiente.
  insert into public.chat_grupo_miembros(grupo_id,usuario_id,leido_hasta)
    values(p_grupo,auth.uid(),coalesce((select max(id) from public.chat_grupo_mensajes where grupo_id=p_grupo),0))
    on conflict (grupo_id,usuario_id) do nothing;
end;
$$;

create or replace function public.chat_grupo_salir(p_grupo bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  delete from public.chat_grupo_miembros where grupo_id=p_grupo and usuario_id=auth.uid();
end;
$$;

create or replace function public.chat_grupo_historial(p_grupo bigint, p_antes bigint default null)
returns table(id bigint, grupo_id bigint, remitente uuid, autor text, contenido text, creado_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'Únete al grupo para ver sus mensajes.'; end if;
  return query
  select x.id,x.grupo_id,x.remitente,p.nombre,x.contenido,x.creado_at
    from public.chat_grupo_mensajes x join public.asis_perfiles p on p.id=x.remitente
   where x.grupo_id=p_grupo and (p_antes is null or x.id<p_antes)
   order by x.id desc limit 50;
end;
$$;

create or replace function public.chat_grupo_enviar(p_grupo bigint, p_contenido text, p_cliente_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mensaje public.chat_grupo_mensajes; v_texto text:=btrim(p_contenido);
begin
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'Únete al grupo para enviar mensajes.'; end if;
  if p_cliente_id is null or v_texto is null or char_length(v_texto) not between 1 and 4000 then
    raise exception 'Escribe un mensaje de hasta 4000 caracteres.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,742));
  select * into v_mensaje from public.chat_grupo_mensajes where remitente=auth.uid() and cliente_id=p_cliente_id;
  if found then
    if v_mensaje.grupo_id<>p_grupo or v_mensaje.contenido<>v_texto then
      raise exception 'Este identificador ya corresponde a otro mensaje.';
    end if;
  else
    if (select count(*) from public.chat_grupo_mensajes
         where remitente=auth.uid() and creado_at>clock_timestamp()-interval '1 minute')>=30 then
      raise exception 'Has enviado muchos mensajes. Espera un minuto y vuelve a intentar.';
    end if;
    insert into public.chat_grupo_mensajes(grupo_id,remitente,cliente_id,contenido)
      values(p_grupo,auth.uid(),p_cliente_id,v_texto) returning * into v_mensaje;
  end if;
  return jsonb_build_object('id',v_mensaje.id,'grupo_id',v_mensaje.grupo_id,'remitente',v_mensaje.remitente,
    'autor',(select nombre from public.asis_perfiles where id=v_mensaje.remitente),
    'contenido',v_mensaje.contenido,'creado_at',v_mensaje.creado_at);
end;
$$;

create or replace function public.chat_grupo_leer(p_grupo bigint, p_hasta bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_grupo_miembro(p_grupo) then raise exception 'Únete al grupo para ver sus mensajes.'; end if;
  update public.chat_grupo_miembros m
     set leido_hasta=greatest(m.leido_hasta,least(p_hasta,coalesce((select max(x.id) from public.chat_grupo_mensajes x where x.grupo_id=p_grupo),0)))
   where m.grupo_id=p_grupo and m.usuario_id=auth.uid();
end;
$$;

-- Eventos mínimos para Realtime: uno por integrante, sin el contenido del mensaje.
create table if not exists public.chat_grupo_eventos (
  mensaje_id bigint not null references public.chat_grupo_mensajes(id) on delete cascade,
  destinatario uuid not null references public.asis_perfiles(id) on delete cascade,
  creado_at timestamptz not null default clock_timestamp(),
  primary key (mensaje_id, destinatario)
);
create index if not exists chat_grupo_eventos_destinatario on public.chat_grupo_eventos(destinatario, mensaje_id desc);
alter table public.chat_grupo_eventos enable row level security;
revoke all on public.chat_grupo_eventos from public, anon, authenticated;
drop policy if exists chat_grupo_eventos_propios on public.chat_grupo_eventos;
create policy chat_grupo_eventos_propios on public.chat_grupo_eventos
  for select to authenticated using (public.chat_activo() and destinatario=auth.uid());
grant select on public.chat_grupo_eventos to authenticated;

create or replace function public.chat_grupo_evento_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.chat_grupo_eventos(mensaje_id,destinatario)
    select new.id,m.usuario_id from public.chat_grupo_miembros m join public.asis_perfiles p on p.id=m.usuario_id
     where m.grupo_id=new.grupo_id and p.activo and m.usuario_id<>new.remitente
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.chat_grupo_evento_trg() from public, anon, authenticated;
drop trigger if exists chat_grupo_mensajes_evento on public.chat_grupo_mensajes;
create trigger chat_grupo_mensajes_evento after insert on public.chat_grupo_mensajes
  for each row execute function public.chat_grupo_evento_trg();

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='chat_grupo_eventos') then
    alter publication supabase_realtime add table public.chat_grupo_eventos;
  end if;
end $$;

revoke all on function public.chat_grupo_miembro(bigint) from public, anon, authenticated;
revoke all on function public.chat_grupos(), public.chat_grupo_unirse(bigint), public.chat_grupo_salir(bigint),
  public.chat_grupo_historial(bigint,bigint), public.chat_grupo_enviar(bigint,text,uuid), public.chat_grupo_leer(bigint,bigint)
  from public, anon;
grant execute on function public.chat_grupos(), public.chat_grupo_unirse(bigint), public.chat_grupo_salir(bigint),
  public.chat_grupo_historial(bigint,bigint), public.chat_grupo_enviar(bigint,text,uuid), public.chat_grupo_leer(bigint,bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
