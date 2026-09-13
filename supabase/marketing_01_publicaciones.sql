-- Ejecutar después de las migraciones de identidad del dashboard.
begin;
create table public.marketing_accesos (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  puede_publicar boolean not null default false
);
alter table public.marketing_accesos enable row level security;
revoke all on public.marketing_accesos from anon, authenticated;

create or replace function public.marketing_permiso()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'acceso', exists(select 1 from public.asis_perfiles p where p.id=auth.uid() and p.activo
      and (p.nivel='sistemas' or exists(select 1 from public.marketing_accesos a where a.usuario_id=p.id))),
    'publicar', exists(select 1 from public.asis_perfiles p where p.id=auth.uid() and p.activo
      and (p.nivel='sistemas' or exists(select 1 from public.marketing_accesos a where a.usuario_id=p.id and a.puede_publicar)))
  );
$$;
revoke all on function public.marketing_permiso() from public, anon;
grant execute on function public.marketing_permiso() to authenticated;

create table public.marketing_publicaciones (
  id uuid primary key,
  autor uuid not null references auth.users(id),
  datos jsonb not null default '{}'::jsonb,
  copy text not null default '' check (length(copy)<=20000),
  enlace text not null default '',
  imagen_path text not null,
  estado text not null default 'borrador' check (estado in ('borrador','publicando','publicado','verificar')),
  facebook_id text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
alter table public.marketing_publicaciones enable row level security;
-- El navegador no puede alterar autor, estado ni identificadores de Facebook.
revoke all on public.marketing_publicaciones from anon, authenticated;
grant all on public.marketing_publicaciones, public.marketing_accesos to service_role;
create index on public.marketing_publicaciones(autor, creado_at desc);

create table public.marketing_lecturas (
  id bigint generated always as identity primary key,
  autor uuid not null references auth.users(id),
  creado_at timestamptz not null default now()
);
alter table public.marketing_lecturas enable row level security;
revoke all on public.marketing_lecturas from anon, authenticated;
create or replace function public.marketing_reservar_lectura(p_autor uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_autor::text, 0));
  if (select count(*) from public.marketing_lecturas where autor=p_autor and creado_at>now()-interval '24 hours')>=30 then
    return false;
  end if;
  insert into public.marketing_lecturas(autor) values(p_autor);
  return true;
end;
$$;
revoke all on function public.marketing_reservar_lectura(uuid) from public, anon, authenticated;
grant execute on function public.marketing_reservar_lectura(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('marketing-flyers','marketing-flyers',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
commit;
