-- Permite estados confirmados de participantes en la misma sala del observador.
-- No convierte ni recalcula muestras antiguas sin informacion.
begin;
alter table public.zoom_camera_samples drop constraint if exists zoom_camera_samples_scope_check;
alter table public.zoom_camera_samples add constraint zoom_camera_samples_scope_check check(scope in ('main','local','breakout','unknown'));
create or replace function public.dash_zoom_camera_sample(p_session uuid,p_seq integer,p_scope text,p_participants jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_session public.zoom_camera_sessions; v_item jsonb; v_key text; v_clean jsonb:='{}'; v_now timestamptz;
begin
 select * into v_session from public.zoom_camera_sessions where id=p_session for update;
 if not found or v_session.observer_id is distinct from auth.uid() or not public.dash_zoom_opera(v_session.reunion_id) then
  raise exception 'No tienes permiso para registrar esta observación.' using errcode='42501';
 end if;
 if v_session.ended_at is not null then raise exception 'La observación ya terminó.'; end if;
 if p_seq is null or p_seq<1 or p_seq>1000000 or p_scope is null or p_scope not in ('main','local','breakout','unknown') then raise exception 'Observación no válida.'; end if;
 if p_seq<=v_session.last_seq then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if jsonb_typeof(p_participants) is distinct from 'array' or octet_length(p_participants::text)>524288 then raise exception 'Lista de participantes no válida.'; end if;
 if jsonb_array_length(p_participants)>1000 then raise exception 'La lista supera los 1000 participantes.'; end if;
 for v_item in select value from jsonb_array_elements(p_participants) loop
  v_key:=v_item->>'id';
  if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item->'id') is distinct from 'string' or v_key is null or length(v_key) not between 1 and 160
   or jsonb_typeof(v_item->'name') is distinct from 'string' or length(v_item->>'name')>256
   or v_item->>'state' is null or v_item->>'state' not in ('on','off','unknown') or v_clean ? v_key then
   raise exception 'Participante no válido o duplicado.';
  end if;
  v_clean:=v_clean||jsonb_build_object(v_key,jsonb_build_object('name',v_item->>'name','state',case when p_scope in ('main','local') then v_item->>'state' else 'unknown' end));
 end loop;
 v_now:=clock_timestamp();
 insert into public.zoom_camera_samples(session_id,seq,received_at,scope,participants) values(p_session,p_seq,v_now,p_scope,v_clean);
 update public.zoom_camera_sessions set last_seq=p_seq,last_seen_at=v_now where id=p_session;
 return jsonb_build_object('ok',true,'received_at',v_now);
end $$;

create or replace function public.dash_zoom_camera_report(p_id uuid,p_session uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_session public.zoom_camera_sessions; v_sessions jsonb; v_people jsonb; v_end timestamptz;
begin
 if not (public.dash_zoom_gestiona() or public.dash_zoom_opera(p_id)) then raise exception 'No tienes permiso para consultar este reporte.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.started_at desc),'[]') into v_sessions from (
  select id,started_at,last_seen_at,ended_at from public.zoom_camera_sessions where reunion_id=p_id order by started_at desc limit 100
 ) s;
 select * into v_session from public.zoom_camera_sessions where reunion_id=p_id and (p_session is null or id=p_session) order by started_at desc limit 1;
 if not found then
  if p_session is not null then raise exception 'La sesión no pertenece a esta reunión.'; end if;
  return jsonb_build_object('ok',true,'sessions',v_sessions,'session',null,'people','[]'::jsonb);
 end if;
 -- Un navegador cerrado no deja crecer un historial indefinidamente. Una
 -- reanudación posterior sí conserva el hueco entre muestras como desconocido.
 v_end:=coalesce(v_session.ended_at,least(now(),v_session.last_seen_at+interval '40 seconds'));
 -- Toda pausa mayor a 20 s deja el exceso como desconocido. Nunca extrapolar
 -- una cámara apagada/encendida durante una desconexión del observador.
 with samples as (
  select seq,received_at,participants,lead(received_at,1,v_end) over(order by seq) until_at
  from public.zoom_camera_samples where session_id=v_session.id
 ), identities as (
  select entry.key id,min(s.received_at) first_seen,max(s.received_at) last_seen,
   (array_agg(entry.value->>'name' order by s.seq desc))[1] name
  from samples s cross join lateral jsonb_each(s.participants) entry group by entry.key
 ), intervals as (
  select i.id,i.name,i.first_seen,i.last_seen,s.seq,s.received_at,
   coalesce(s.participants->i.id->>'state','unknown') state,
   greatest(0,extract(epoch from s.until_at-s.received_at)) seconds,
   s.participants ? i.id present
  from identities i join samples s on s.received_at>=i.first_seen
 ), totals as (
  select id,name,first_seen,last_seen,
   sum(case when state='on' then least(seconds,20) else 0 end) on_seconds,
   sum(case when state='off' then least(seconds,20) else 0 end) off_seconds,
   sum(case when state in ('on','off') then greatest(0,seconds-20) else seconds end) unknown_seconds,
   (array_agg(case when present and v_session.ended_at is null and now()-received_at<=interval '20 seconds' then state else 'unknown' end order by seq desc))[1] state
  from intervals group by id,name,first_seen,last_seen
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'first_seen',first_seen,'last_seen',last_seen,
  'on_seconds',round(on_seconds,1),'off_seconds',round(off_seconds,1),'unknown_seconds',round(unknown_seconds,1),
  'percentage',case when on_seconds+off_seconds>0 then round(100*on_seconds/(on_seconds+off_seconds),1) else null end,'state',state) order by lower(name),id),'[]') into v_people from totals;
 return jsonb_build_object('ok',true,'sessions',v_sessions,'session',to_jsonb(v_session)-'observer_id'-'last_seq',
  'people',v_people,'scope',(select scope from public.zoom_camera_samples where session_id=v_session.id order by seq desc limit 1),'now',now());
end $$;

notify pgrst,'reload schema';
commit;
