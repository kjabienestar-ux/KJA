-- Ejecutar después de chat_01_mensajes.sql.
-- Dirección en el chat: únicamente Yeiser y Erika. No modifica roles ni mensajes.
begin;

create table if not exists public.chat_direccion_contactos (
  perfil_id uuid primary key references public.asis_perfiles(id)
);
alter table public.chat_direccion_contactos enable row level security;
revoke all on public.chat_direccion_contactos from public, anon, authenticated;

-- Identifica las cuentas administrativas actuales una sola vez y conserva sus UUID.
-- Ante nombres ambiguos, detiene toda la migración en lugar de elegir otra cuenta.
do $$
declare v_total integer; v_id uuid; v_persona text;
begin
  if not exists(select 1 from public.chat_direccion_contactos) then
    foreach v_persona in array array['yeiser','erika'] loop
      select count(*),(array_agg(p.id))[1] into v_total,v_id
      from public.asis_perfiles p
      where p.activo and p.rol='direccion' and (
        (v_persona='yeiser' and lower(btrim(p.nombre)) in
          ('yeiser','yeiser jamber avila medina','yeiser avila medina'))
        or (v_persona='erika' and lower(btrim(p.nombre))='erika del socorro moreno quilcate')
      );
      if v_total<>1 then
        raise exception 'Se esperaba una única cuenta activa de Dirección para %, pero se encontraron %. Revisa asis_perfiles antes de continuar.',v_persona,v_total;
      end if;
      insert into public.chat_direccion_contactos(perfil_id) values(v_id);
    end loop;
  end if;
end;
$$;

create or replace function public.chat_contactos()
returns table(id uuid, nombre text, direccion boolean, activo boolean,
  ultimo text, ultimo_at timestamptz, no_leidos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
  select p.id,p.nombre,
    (p.activo and p.rol='direccion' and exists(
      select 1 from public.chat_direccion_contactos d where d.perfil_id=p.id
    )),p.activo,m.contenido,m.creado_at,
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
revoke all on function public.chat_contactos() from public, anon;
grant execute on function public.chat_contactos() to authenticated;
notify pgrst, 'reload schema';
commit;
