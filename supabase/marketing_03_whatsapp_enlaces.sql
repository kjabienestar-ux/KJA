-- Enlaces públicos de campaña: sólo se expone el destino por una clave aleatoria.
begin;
create table if not exists public.marketing_whatsapp_enlaces (
  clave text primary key check (clave ~ '^[A-Za-z0-9_-]{16}$'),
  publicacion_id uuid not null references public.marketing_publicaciones(id) on delete cascade,
  firma text not null,
  destino text not null check (destino ~ '^https://wa[.]me/[1-9][0-9]{7,14}[?]text=' and char_length(destino)<=25000),
  creado_at timestamptz not null default now(),
  unique(publicacion_id,firma)
);
alter table public.marketing_whatsapp_enlaces enable row level security;
revoke all on public.marketing_whatsapp_enlaces from public,anon,authenticated;
grant all on public.marketing_whatsapp_enlaces to service_role;
create or replace function public.marketing_resolver_whatsapp(p_clave text)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select destino from public.marketing_whatsapp_enlaces
  where clave=p_clave and p_clave ~ '^[A-Za-z0-9_-]{16}$';
$$;
revoke all on function public.marketing_resolver_whatsapp(text) from public;
grant execute on function public.marketing_resolver_whatsapp(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
