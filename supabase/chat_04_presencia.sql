-- Ejecutar después de chat_03_fotos_perfil.sql. No modifica mensajes ni roles.
begin;
create table if not exists public.chat_sesiones (
  usuario_id uuid not null references public.asis_perfiles(id) on delete cascade,
  sesion_id uuid not null,
  visto_at timestamptz not null default clock_timestamp(),
  primary key(usuario_id,sesion_id)
);
create index if not exists chat_sesiones_visto on public.chat_sesiones(visto_at);
alter table public.chat_sesiones enable row level security;
revoke all on public.chat_sesiones from public,anon,authenticated;

-- Cada pestaña tiene una sesión independiente. Solo actualiza la cuenta autenticada.
-- No publica horas de última conexión; solo presencia vigente y duración restante.
create or replace function public.chat_presencia(p_sesion uuid,p_visible boolean default true)
returns table(id uuid,vigencia_segundos double precision)
language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  if p_sesion is null or p_visible is null then raise exception 'Sesión de chat inválida.'; end if;
  delete from public.chat_sesiones where visto_at<clock_timestamp()-interval '70 seconds';
  if p_visible then
    insert into public.chat_sesiones(usuario_id,sesion_id,visto_at)
      values(auth.uid(),p_sesion,clock_timestamp())
      on conflict(usuario_id,sesion_id) do update set visto_at=excluded.visto_at;
  else
    delete from public.chat_sesiones where usuario_id=auth.uid() and sesion_id=p_sesion;
  end if;
  return query select s.usuario_id,
    extract(epoch from (max(s.visto_at)+interval '70 seconds'-clock_timestamp()))::double precision
    from public.chat_sesiones s join public.asis_perfiles p on p.id=s.usuario_id
    where p.activo and s.visto_at>clock_timestamp()-interval '70 seconds'
    group by s.usuario_id;
end;
$$;
revoke all on function public.chat_presencia(uuid,boolean) from public,anon,authenticated;
grant execute on function public.chat_presencia(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
