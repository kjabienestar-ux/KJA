-- Ejecutar una vez antes de desplegar la función con códigos de 6 caracteres.
-- Conserva todos los enlaces de 8 y 16 caracteres ya compartidos.
begin;
alter table public.marketing_whatsapp_enlaces
  drop constraint if exists marketing_whatsapp_enlaces_clave_check;
alter table public.marketing_whatsapp_enlaces
  add constraint marketing_whatsapp_enlaces_clave_check
  check (clave ~ '^([A-Za-z0-9_-]{6}|[A-Za-z0-9_-]{8}|[A-Za-z0-9_-]{16})$');
create or replace function public.marketing_resolver_whatsapp(p_clave text)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select destino from public.marketing_whatsapp_enlaces
  where clave=p_clave and p_clave ~ '^([A-Za-z0-9_-]{6}|[A-Za-z0-9_-]{8}|[A-Za-z0-9_-]{16})$';
$$;
revoke all on function public.marketing_resolver_whatsapp(text) from public;
grant execute on function public.marketing_resolver_whatsapp(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
