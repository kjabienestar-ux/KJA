-- Chat privado del portal: eventos mínimos para Supabase Realtime.
-- Ejecutar después de chat_05_abrir_colaborador.sql.
-- No expone el contenido de chat_mensajes por lectura directa.
begin;

create table if not exists public.chat_eventos (
  mensaje_id bigint primary key references public.chat_mensajes(id) on delete cascade,
  destinatario uuid not null references public.asis_perfiles(id) on delete cascade,
  creado_at timestamptz not null default clock_timestamp()
);
create index if not exists chat_eventos_destinatario on public.chat_eventos(destinatario, mensaje_id desc);
alter table public.chat_eventos enable row level security;
revoke all on public.chat_eventos from public, anon, authenticated;
drop policy if exists chat_eventos_propios on public.chat_eventos;
create policy chat_eventos_propios on public.chat_eventos
  for select to authenticated
  using (public.chat_activo() and destinatario=auth.uid());
grant select on public.chat_eventos to authenticated;
-- La policy RLS necesita invocar esta función con el JWT del usuario.
grant execute on function public.chat_activo() to authenticated;

create or replace function public.chat_emitir_evento_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_eventos(mensaje_id,destinatario)
    values(new.id,new.destinatario)
    on conflict (mensaje_id) do nothing;
  return new;
end;
$$;
revoke all on function public.chat_emitir_evento_trg() from public, anon, authenticated;

drop trigger if exists chat_mensajes_emitir_evento on public.chat_mensajes;
create trigger chat_mensajes_emitir_evento
  after insert on public.chat_mensajes
  for each row execute function public.chat_emitir_evento_trg();

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname='supabase_realtime'
          and schemaname='public'
          and tablename='chat_eventos'
     ) then
    alter publication supabase_realtime add table public.chat_eventos;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
