-- Inicio y permisos en una sola petición. Conserva las validaciones de dash_inicio.
begin;
create or replace function public.dash_arranque()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare inicio jsonb; acceso jsonb;
begin
  inicio=public.dash_inicio();
  if not coalesce((inicio->>'ok')::boolean,false) then
    return jsonb_build_object('inicio',inicio,'acceso',null);
  end if;
  select jsonb_build_object('rol',rol,'acceso_panel',acceso_panel) into acceso
    from public.asis_perfiles where id=auth.uid() and activo;
  if acceso is null then return jsonb_build_object('inicio',jsonb_build_object('ok',false,'motivo','sesion'),'acceso',null); end if;
  return jsonb_build_object('inicio',inicio,'acceso',acceso);
end;
$$;
revoke all on function public.dash_arranque() from public,anon;
grant execute on function public.dash_arranque() to authenticated;
commit;
