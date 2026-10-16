-- Ejecutar después de marketing_05_eliminar_publicaciones.sql.
begin;
create table if not exists public.marketing_colaboradores_acceso (
  colaborador_id bigint primary key references public.asis_colaboradores(id) on delete cascade,
  area_id bigint not null references public.asis_areas(id),
  otorgado_por uuid not null references auth.users(id),
  actualizado_at timestamptz not null default now()
);
alter table public.marketing_colaboradores_acceso enable row level security;
revoke all on public.marketing_colaboradores_acceso from public, anon, authenticated;
grant all on public.marketing_colaboradores_acceso to service_role;

create or replace function public.marketing_permiso()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'administrar',coalesce(p.nivel='sistemas',false),
    'acceso',coalesce(p.nivel='sistemas' or exists(select 1 from public.marketing_accesos a where a.usuario_id=p.id)
      or exists(select 1 from public.marketing_colaboradores_acceso a join public.asis_colaboradores c on c.id=a.colaborador_id
        join public.asis_areas ar on ar.id=c.area_id
        where c.id=p.colaborador_id and c.activo and ar.activo and a.area_id=c.area_id),false),
    'publicar',coalesce(p.nivel='sistemas' or exists(select 1 from public.marketing_accesos a where a.usuario_id=p.id and a.puede_publicar),false)
  ) from (select 1) base left join public.asis_perfiles p on p.id=auth.uid() and p.activo;
$$;

create or replace function public.marketing_gestion_accesos()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and nivel='sistemas') then
    raise exception 'Solo un administrador puede gestionar los accesos.';
  end if;
  return jsonb_build_object(
    'areas',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre) order by nombre),'[]') from public.asis_areas where activo),
    'colaboradores',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'area_id',c.area_id,
      'acceso',a.colaborador_id is not null and a.area_id=c.area_id or exists(select 1 from public.marketing_accesos l where l.usuario_id=p.id),
      'administrador',coalesce(p.nivel='sistemas',false)) order by c.nombre),'[]')
      from public.asis_colaboradores c left join public.asis_perfiles p on p.colaborador_id=c.id
      left join public.marketing_colaboradores_acceso a on a.colaborador_id=c.id where c.activo)
  );
end;
$$;

create or replace function public.marketing_guardar_accesos(p_area bigint,p_colaboradores bigint[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and nivel='sistemas') then
    raise exception 'Solo un administrador puede gestionar los accesos.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('marketing-area-'||p_area::text,0));
  if not exists(select 1 from public.asis_areas where id=p_area and activo) then raise exception 'Área no disponible.'; end if;
  if p_colaboradores is null or exists(select 1 from unnest(p_colaboradores) x where x is null or not exists(
    select 1 from public.asis_colaboradores c where c.id=x and c.area_id=p_area and c.activo)) then
    raise exception 'Selecciona colaboradores activos del área indicada.';
  end if;
  -- La selección reemplaza los permisos del área, incluidos permisos manuales antiguos.
  delete from public.marketing_accesos a using public.asis_perfiles p,public.asis_colaboradores c
    where a.usuario_id=p.id and p.colaborador_id=c.id and c.area_id=p_area and p.nivel<>'sistemas'
      and not(c.id=any(p_colaboradores));
  delete from public.marketing_colaboradores_acceso a using public.asis_colaboradores c
    where a.colaborador_id=c.id and c.area_id=p_area;
  insert into public.marketing_colaboradores_acceso(colaborador_id,area_id,otorgado_por)
    select distinct x,p_area,auth.uid() from unnest(p_colaboradores) x
    on conflict(colaborador_id) do update set area_id=excluded.area_id,otorgado_por=excluded.otorgado_por,actualizado_at=now();
end;
$$;

alter table public.marketing_publicaciones add column if not exists primer_copy_at timestamptz;
create index if not exists marketing_produccion_autor_fecha on public.marketing_publicaciones(autor,primer_copy_at) where primer_copy_at is not null;
-- No se inventa una fecha de producción para publicaciones anteriores.
create or replace function public.marketing_registrar_primer_copy()
returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='UPDATE' then new.primer_copy_at=old.primer_copy_at; else new.primer_copy_at=null; end if;
  if new.primer_copy_at is null and length(trim(new.copy))>0 then
    if TG_OP='INSERT' then new.primer_copy_at=now();
    elsif length(trim(old.copy))=0 then new.primer_copy_at=now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists marketing_primer_copy on public.marketing_publicaciones;
create trigger marketing_primer_copy before insert or update on public.marketing_publicaciones
  for each row execute function public.marketing_registrar_primer_copy();

create or replace function public.marketing_mi_actividad()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare hoy date=(now() at time zone 'America/Lima')::date;
begin
  if not coalesce((public.marketing_permiso()->>'acceso')::boolean,false) then raise exception 'No tienes acceso a Publicaciones.'; end if;
  return jsonb_build_object(
    'nombre',(select coalesce(c.nombre,p.nombre) from public.asis_perfiles p left join public.asis_colaboradores c on c.id=p.colaborador_id where p.id=auth.uid()),
    'dias',(select jsonb_agg(jsonb_build_object('fecha',d::date,'cantidad',(select count(*) from public.marketing_publicaciones m
      where m.autor=auth.uid() and (m.primer_copy_at at time zone 'America/Lima')::date=d::date)) order by d desc)
      from generate_series(hoy-6,hoy,interval '1 day') d),
    'anteriores',(select count(*) from public.marketing_publicaciones where autor=auth.uid() and primer_copy_at is null and length(trim(copy))>0)
  );
end;
$$;
revoke all on function public.marketing_permiso(),public.marketing_gestion_accesos(),public.marketing_guardar_accesos(bigint,bigint[]),public.marketing_mi_actividad(),public.marketing_registrar_primer_copy() from public,anon;
grant execute on function public.marketing_permiso(),public.marketing_gestion_accesos(),public.marketing_guardar_accesos(bigint,bigint[]),public.marketing_mi_actividad() to authenticated;
commit;
