-- Eliminación lógica: conserva los enlaces de campañas ya compartidas.
begin;
alter table public.marketing_publicaciones add column if not exists eliminado_at timestamptz;
notify pgrst,'reload schema';
commit;
