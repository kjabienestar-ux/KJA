-- Chat privado del portal. Ejecutar después de dashboard_01_identidad_y_roles.sql.
begin;

create table if not exists public.chat_mensajes (
  id bigint generated always as identity primary key,
  cliente_id uuid not null,
  remitente uuid not null references public.asis_perfiles(id),
  destinatario uuid not null references public.asis_perfiles(id),
  contenido text not null check (char_length(btrim(contenido)) between 1 and 4000),
  creado_at timestamptz not null default clock_timestamp(),
  leido_at timestamptz,
  check (remitente <> destinatario),
  unique (remitente, cliente_id)
);
create index if not exists chat_enviados on public.chat_mensajes(remitente, destinatario, id desc);
create index if not exists chat_recibidos on public.chat_mensajes(destinatario, remitente, id desc);
create index if not exists chat_no_leidos on public.chat_mensajes(destinatario, remitente) where leido_at is null;
alter table public.chat_mensajes enable row level security;
revoke all on public.chat_mensajes from public, anon, authenticated;

create or replace function public.chat_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.asis_perfiles where id=auth.uid() and activo);
$$;

-- Directorio mínimo: no expone correos, DNI, PIN ni otros datos laborales.
-- Conserva contactos desactivados con historial, pero no permite enviarles.
create or replace function public.chat_contactos()
returns table(id uuid, nombre text, direccion boolean, activo boolean,
  ultimo text, ultimo_at timestamptz, no_leidos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
  select p.id,p.nombre,p.rol='direccion',p.activo,m.contenido,m.creado_at,
    (select count(*) from public.chat_mensajes n where n.destinatario=auth.uid() and n.remitente=p.id and n.leido_at is null)
  from public.asis_perfiles p
  left join lateral (
    select c.contenido,c.creado_at from public.chat_mensajes c
    where (c.remitente=auth.uid() and c.destinatario=p.id) or (c.destinatario=auth.uid() and c.remitente=p.id)
    order by c.id desc limit 1
  ) m on true
  where p.id<>auth.uid() and (p.activo or m.creado_at is not null)
  order by m.creado_at desc nulls last,p.nombre,p.id;
end;
$$;

create or replace function public.chat_historial(p_contacto uuid, p_antes bigint default null)
returns setof public.chat_mensajes language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query select m.* from public.chat_mensajes m
    where ((m.remitente=auth.uid() and m.destinatario=p_contacto) or (m.destinatario=auth.uid() and m.remitente=p_contacto))
      and (p_antes is null or m.id<p_antes)
    order by m.id desc limit 50;
end;
$$;

create or replace function public.chat_enviar(p_contacto uuid, p_contenido text, p_cliente_id uuid)
returns public.chat_mensajes language plpgsql security definer set search_path = public as $$
declare v_mensaje public.chat_mensajes;
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  if p_contacto=auth.uid() or not exists(select 1 from public.asis_perfiles where id=p_contacto and activo) then
    raise exception 'El destinatario no está disponible.';
  end if;
  if p_cliente_id is null or p_contenido is null or char_length(btrim(p_contenido)) not between 1 and 4000 then
    raise exception 'Escribe un mensaje de hasta 4000 caracteres.';
  end if;
  -- Serializa envíos por cuenta; los reintentos no duplican mensajes.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,741));
  select * into v_mensaje from public.chat_mensajes where remitente=auth.uid() and cliente_id=p_cliente_id;
  if found then
    if v_mensaje.destinatario<>p_contacto or v_mensaje.contenido<>btrim(p_contenido) then
      raise exception 'Este identificador ya corresponde a otro mensaje.';
    end if;
    return v_mensaje;
  end if;
  if (select count(*) from public.chat_mensajes where remitente=auth.uid() and creado_at>clock_timestamp()-interval '1 minute')>=30 then
    raise exception 'Has enviado muchos mensajes. Espera un minuto y vuelve a intentar.';
  end if;
  insert into public.chat_mensajes(remitente,destinatario,contenido,cliente_id)
    values(auth.uid(),p_contacto,btrim(p_contenido),p_cliente_id) returning * into v_mensaje;
  return v_mensaje;
end;
$$;

create or replace function public.chat_leer(p_contacto uuid, p_hasta bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  update public.chat_mensajes set leido_at=clock_timestamp()
    where destinatario=auth.uid() and remitente=p_contacto and id<=p_hasta and leido_at is null;
end;
$$;

-- Solo RPC: no hay lectura directa ni actualización/borrado desde el navegador.
revoke all on function public.chat_activo(), public.chat_contactos(), public.chat_historial(uuid,bigint),
  public.chat_enviar(uuid,text,uuid), public.chat_leer(uuid,bigint) from public, anon, authenticated;
grant execute on function public.chat_contactos(), public.chat_historial(uuid,bigint),
  public.chat_enviar(uuid,text,uuid), public.chat_leer(uuid,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
