-- Opiniones de clientes por enlace único: kjadmb.com/opinar?k=<clave>
-- Aditiva: no modifica la tabla public.comentarios ni sus policies. Requiere que
-- public.comentarios (id, nombre, mensaje, estrellas, aprobado, created_at) ya exista.
-- Los datos privados (recomendación 0-10, nota interna) viven en opinion_respuestas, solo admin.
begin;

create table if not exists public.opinion_enlaces (
  clave text primary key check (clave ~ '^[A-Za-z0-9_-]{16}$'),
  cliente text not null default '' check (char_length(cliente) <= 60),
  servicio text not null default '' check (char_length(servicio) <= 80),
  creado_at timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  expira_at timestamptz not null default now() + interval '30 days',
  usado_at timestamptz,
  comentario_id uuid references public.comentarios(id) on delete set null
);
alter table public.opinion_enlaces enable row level security;
revoke all on public.opinion_enlaces from public, anon, authenticated;
grant all on public.opinion_enlaces to service_role;

create table if not exists public.opinion_respuestas (
  id uuid primary key default gen_random_uuid(),
  clave text unique references public.opinion_enlaces(clave) on delete cascade, -- null = enlace fijo por servicio
  comentario_id uuid references public.comentarios(id) on delete cascade,
  servicio text not null default '',
  recomienda smallint check (recomienda between 0 and 10),
  nota_privada text check (char_length(nota_privada) <= 1000),
  creado_at timestamptz not null default now()
);
alter table public.opinion_respuestas enable row level security;
revoke all on public.opinion_respuestas from public, anon, authenticated;
grant all on public.opinion_respuestas to service_role;

create or replace function public.es_admin_activo()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null
     and exists(select 1 from public.perfiles where id=auth.uid() and rol='admin' and activo);
$$;
revoke all on function public.es_admin_activo() from public;
grant execute on function public.es_admin_activo() to authenticated;

-- Lectura de respuestas e enlaces para el panel (solo admin).
drop policy if exists opinion_respuestas_admin_select on public.opinion_respuestas;
create policy opinion_respuestas_admin_select on public.opinion_respuestas
  for select to authenticated using (public.es_admin_activo());
grant select on public.opinion_respuestas to authenticated;

drop policy if exists opinion_enlaces_admin_select on public.opinion_enlaces;
create policy opinion_enlaces_admin_select on public.opinion_enlaces
  for select to authenticated using (public.es_admin_activo());
grant select on public.opinion_enlaces to authenticated;

-- Admin: genera un enlace de un solo uso (30 días por defecto).
create or replace function public.opinion_crear_enlace(p_cliente text, p_servicio text, p_dias int default 30)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_clave text;
begin
  if not public.es_admin_activo() then raise exception 'No autorizado' using errcode='42501'; end if;
  v_clave := substr(replace(gen_random_uuid()::text,'-',''),1,16);
  insert into public.opinion_enlaces(clave,cliente,servicio,creado_por,expira_at)
  values (v_clave, left(btrim(coalesce(p_cliente,'')),60), left(btrim(coalesce(p_servicio,'')),80), auth.uid(),
          now() + make_interval(days => greatest(1, least(coalesce(p_dias,30), 365))));
  return v_clave;
end $$;
revoke all on function public.opinion_crear_enlace(text,text,int) from public, anon;
grant execute on function public.opinion_crear_enlace(text,text,int) to authenticated;

-- Público: valida el enlace sin revelar nada más que lo necesario para precargar el formulario.
create or replace function public.opinion_resolver(p_clave text)
returns json language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when p_clave !~ '^[A-Za-z0-9_-]{16}$' then json_build_object('estado','invalido')
    else coalesce((
      select case
        when e.usado_at is not null then json_build_object('estado','usado')
        when e.expira_at < now() then json_build_object('estado','expirado')
        else json_build_object('estado','ok','cliente',e.cliente,'servicio',e.servicio)
      end from public.opinion_enlaces e where e.clave = p_clave
    ), json_build_object('estado','invalido'))
  end;
$$;
revoke all on function public.opinion_resolver(text) from public;
grant execute on function public.opinion_resolver(text) to anon, authenticated;

-- Público: registra la opinión como comentario PENDIENTE (aprobado=false) y consume el enlace.
create or replace function public.opinion_enviar(
  p_clave text, p_nombre text, p_mensaje text, p_estrellas int,
  p_recomienda int default null, p_nota text default null)
returns json language plpgsql security definer set search_path=public,pg_temp as $$
declare
  e public.opinion_enlaces%rowtype;
  v_nombre text := btrim(coalesce(p_nombre,''));
  v_mensaje text := btrim(coalesce(p_mensaje,''));
  v_id uuid;
begin
  if p_clave !~ '^[A-Za-z0-9_-]{16}$' then return json_build_object('ok',false,'error','invalido'); end if;
  select * into e from public.opinion_enlaces where clave = p_clave for update;
  if not found then return json_build_object('ok',false,'error','invalido'); end if;
  if e.usado_at is not null then return json_build_object('ok',false,'error','usado'); end if;
  if e.expira_at < now() then return json_build_object('ok',false,'error','expirado'); end if;
  if char_length(v_nombre) not between 2 and 60
     or char_length(v_mensaje) not between 10 and 500
     or p_estrellas is null or p_estrellas not between 1 and 5
     or (p_recomienda is not null and p_recomienda not between 0 and 10)
     or char_length(coalesce(p_nota,'')) > 1000 then
    return json_build_object('ok',false,'error','datos');
  end if;

  insert into public.comentarios(nombre, mensaje, estrellas)
  values (v_nombre, v_mensaje, p_estrellas)
  returning id into v_id;
  update public.comentarios set aprobado = false where id = v_id;  -- siempre pendiente de moderación

  insert into public.opinion_respuestas(clave, comentario_id, servicio, recomienda, nota_privada)
  values (p_clave, v_id, e.servicio, p_recomienda, nullif(btrim(coalesce(p_nota,'')),''));
  update public.opinion_enlaces set usado_at = now(), comentario_id = v_id where clave = p_clave;
  return json_build_object('ok',true);
end $$;
revoke all on function public.opinion_enviar(text,text,text,int,int,text) from public;
grant execute on function public.opinion_enviar(text,text,text,int,int,text) to anon, authenticated;

-- ── Enlace general: kjadmb.com/opinar (servicio opcional: curso|taller|terapia) ──
-- Sin clave por cliente, por eso el anti-spam vive en el servidor: tope diario por
-- dispositivo/red (huella con hash, no se guarda la IP), tope global por hora, tiempo
-- mínimo de llenado y rechazo de textos repetidos. Además todo entra como PENDIENTE.
alter table public.opinion_respuestas add column if not exists origen text not null default 'enlace';

create table if not exists public.opinion_limites (
  huella text not null,
  dia date not null default current_date,
  n int not null default 0,
  primary key (huella, dia)
);
alter table public.opinion_limites enable row level security;
revoke all on public.opinion_limites from public, anon, authenticated;
grant all on public.opinion_limites to service_role;

create or replace function public.opinion_enviar_publico(
  p_servicio text, p_nombre text, p_mensaje text, p_estrellas int,
  p_recomienda int default null, p_nota text default null, p_tiempo_ms int default 0)
returns json language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_serv text := case lower(btrim(coalesce(p_servicio,'')))
    when '' then '' when 'terapia' then 'Terapia' when 'curso' then 'Curso' when 'taller' then 'Taller' else null end;
  v_nombre text := btrim(coalesce(p_nombre,''));
  v_mensaje text := btrim(coalesce(p_mensaje,''));
  v_ip text; v_huella text; v_n int; v_id uuid;
begin
  if v_serv is null
     or char_length(v_nombre) not between 2 and 60
     or char_length(v_mensaje) not between 10 and 500
     or p_estrellas is null or p_estrellas not between 1 and 5
     or (p_recomienda is not null and p_recomienda not between 0 and 10)
     or char_length(coalesce(p_nota,'')) > 1000 then
    return json_build_object('ok',false,'error','datos');
  end if;
  if coalesce(p_tiempo_ms,0) < 5000 then return json_build_object('ok',false,'error','rapido'); end if;

  begin
    v_ip := split_part(coalesce(current_setting('request.headers',true)::json->>'x-forwarded-for',''), ',', 1);
  exception when others then v_ip := ''; end;
  v_huella := md5(coalesce(nullif(btrim(v_ip),''),'sin-ip') || ':kja-opinion');

  -- Tope global: máx. 20 opiniones por enlace general en la última hora.
  if (select count(*) from public.opinion_respuestas
      where origen='fijo' and creado_at > now() - interval '1 hour') >= 20 then
    return json_build_object('ok',false,'error','limite');
  end if;
  -- Texto repetido en los últimos 7 días.
  if exists(select 1 from public.comentarios
            where lower(mensaje)=lower(v_mensaje) and created_at > now() - interval '7 days') then
    return json_build_object('ok',false,'error','duplicado');
  end if;
  -- Tope por dispositivo/red: 3 al día.
  insert into public.opinion_limites(huella,dia,n) values (v_huella,current_date,1)
    on conflict (huella,dia) do update set n = public.opinion_limites.n + 1
    returning n into v_n;
  if v_n > 3 then return json_build_object('ok',false,'error','limite'); end if;

  insert into public.comentarios(nombre, mensaje, estrellas)
  values (v_nombre, v_mensaje, p_estrellas)
  returning id into v_id;
  update public.comentarios set aprobado = false where id = v_id;  -- siempre pendiente de moderación

  insert into public.opinion_respuestas(clave, comentario_id, servicio, recomienda, nota_privada, origen)
  values (null, v_id, v_serv, p_recomienda, nullif(btrim(coalesce(p_nota,'')),''), 'fijo');
  return json_build_object('ok',true);
end $$;
revoke all on function public.opinion_enviar_publico(text,text,text,int,int,text,int) from public;
grant execute on function public.opinion_enviar_publico(text,text,text,int,int,text,int) to anon, authenticated;

-- Público: en qué participó cada testimonio YA APROBADO (para la etiqueta del inicio).
-- Solo id + servicio; la recomendación 0-10 y la nota privada nunca salen.
create or replace function public.opinion_servicios_publicos()
returns json language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(json_agg(json_build_object('id', c.id, 'servicio', r.servicio)), '[]'::json)
  from public.opinion_respuestas r
  join public.comentarios c on c.id = r.comentario_id
  where c.aprobado and r.servicio <> '';
$$;
revoke all on function public.opinion_servicios_publicos() from public;
grant execute on function public.opinion_servicios_publicos() to anon, authenticated;

notify pgrst,'reload schema';
commit;
