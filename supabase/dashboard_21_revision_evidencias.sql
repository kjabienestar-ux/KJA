-- DASHBOARD 21 — FASE 2 · REVISIÓN ADMINISTRATIVA DE EVIDENCIAS
-- Ejecutar después de dashboard_20_cierre_ventana_nocturna.sql.
-- No elimina entregas ni archivos existentes. Las entregas previas quedan
-- pendientes de revisión y continúan habilitando el cierre hasta ser observadas.

begin;

alter table public.asis_entregas_diarias
  add column if not exists revision_estado text not null default 'pendiente',
  add column if not exists revision_nota text,
  add column if not exists revisado_at timestamptz,
  add column if not exists revisado_por uuid references public.asis_perfiles(id);

alter table public.asis_entregas_diarias
  drop constraint if exists asis_entregas_revision_estado_check;
alter table public.asis_entregas_diarias
  add constraint asis_entregas_revision_estado_check
  check (revision_estado in ('pendiente','aprobada','observada'));

create index if not exists asis_entregas_revision_fecha_idx
  on public.asis_entregas_diarias(fecha, revision_estado, colaborador_id);

create table if not exists public.asis_entrega_revisiones (
  id               bigint generated always as identity primary key,
  entrega_id       bigint not null references public.asis_entregas_diarias(id) on delete cascade,
  estado_anterior  text not null,
  estado_nuevo     text not null check (estado_nuevo in ('aprobada','observada')),
  nota             text,
  actor_id         uuid not null references public.asis_perfiles(id),
  creado_at        timestamptz not null default now()
);

create index if not exists asis_entrega_revisiones_entrega_idx
  on public.asis_entrega_revisiones(entrega_id, creado_at desc);

alter table public.asis_entrega_revisiones enable row level security;
revoke all on public.asis_entrega_revisiones from anon, authenticated;

-- Las rutas privadas solo pueden ser leídas por Dirección o por la propia
-- sesión personal que creó la evidencia. Editores, visores y líderes no reciben
-- acceso transversal a las imágenes.
drop policy if exists "cierre evidencias: lectura autorizada" on storage.objects;
create policy "cierre evidencias: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'asis-cierre-evidencias'
    and name ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp)$'
    and (
      public.asis_rol() = 'direccion'
      or (
        public.dash_sesion_vigente()
        and public.dash_colab() = split_part(name, '/', 4)::bigint
      )
    )
  );

create or replace function public.dash_admin_revision_entregas(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_entregas jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_fecha is null or p_fecha < date '2020-01-01' or p_fecha > v_hoy + 90 then
    return jsonb_build_object('ok', false, 'motivo', 'fecha');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'colaborador_id', e.colaborador_id,
           'colaborador', c.nombre,
           'area_id', c.area_id,
           'area', a.nombre,
           'fecha', e.fecha,
           'requisito', e.requisito,
           'asignacion_id', e.asignacion_id,
           'titulo', case e.requisito
             when 'comparticiones' then 'Comparticiones de Facebook'
             when 'rpe' then 'RPE y evidencias del día'
             else coalesce(ad.titulo, 'Entregable asignado') end,
           'modalidad', e.modalidad,
           'detalle', e.detalle,
           'estado', e.estado,
           'revision_estado', e.revision_estado,
           'revision_nota', e.revision_nota,
           'completado_at', e.completado_at,
           'revisado_at', e.revisado_at,
           'revisor', rp.nombre,
           'jornada_cerrada', r.salida_at is not null,
           'archivos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'path', f.path, 'mime', f.mime, 'bytes', f.bytes, 'orden', f.orden
                    ) order by f.orden)
               from public.asis_entrega_archivos f
              where f.entrega_id = e.id
           ), '[]'::jsonb)
         ) order by
           case e.revision_estado when 'pendiente' then 0 when 'observada' then 1 else 2 end,
           e.completado_at desc), '[]'::jsonb)
    into v_entregas
    from public.asis_entregas_diarias e
    join public.asis_colaboradores c on c.id = e.colaborador_id
    join public.asis_areas a on a.id = c.area_id
    left join public.asis_asignaciones_diarias ad on ad.id = e.asignacion_id
    left join public.asis_perfiles rp on rp.id = e.revisado_por
    left join public.asis_registros r on r.colaborador_id = e.colaborador_id and r.fecha = e.fecha
   where e.fecha = p_fecha;

  return jsonb_build_object(
    'ok', true,
    'fecha', p_fecha,
    'puede_revisar', true,
    'entregas', v_entregas
  );
end;
$$;

revoke all on function public.dash_admin_revision_entregas(date) from public, anon;
grant execute on function public.dash_admin_revision_entregas(date) to authenticated;

create or replace function public.dash_admin_revisar_entrega(
  p_entrega bigint,
  p_estado text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega public.asis_entregas_diarias;
  v_nota text := nullif(left(btrim(coalesce(p_nota, '')), 700), '');
  v_salida timestamptz;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_entrega is null or p_estado is null or p_estado not in ('aprobada','observada') then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if p_estado = 'observada' and (v_nota is null or char_length(v_nota) < 3) then
    return jsonb_build_object('ok', false, 'motivo', 'nota');
  end if;

  select * into v_entrega
    from public.asis_entregas_diarias
   where id = p_entrega
   for update;
  if v_entrega.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;
  if v_entrega.revision_estado <> 'pendiente' or v_entrega.estado <> 'completo' then
    return jsonb_build_object('ok', false, 'motivo', 'ya_revisada');
  end if;

  select salida_at into v_salida
    from public.asis_registros
   where colaborador_id = v_entrega.colaborador_id and fecha = v_entrega.fecha
   for update;
  if p_estado = 'observada' and v_salida is not null then
    return jsonb_build_object('ok', false, 'motivo', 'jornada_cerrada');
  end if;

  update public.asis_entregas_diarias
     set revision_estado = p_estado,
         revision_nota = case when p_estado = 'observada' then v_nota else null end,
         revisado_at = now(),
         revisado_por = auth.uid(),
         estado = case when p_estado = 'observada' then 'anulado' else estado end
   where id = v_entrega.id;

  insert into public.asis_entrega_revisiones(
    entrega_id, estado_anterior, estado_nuevo, nota, actor_id
  ) values (
    v_entrega.id, v_entrega.revision_estado, p_estado,
    case when p_estado = 'observada' then v_nota else null end,
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'entrega', v_entrega.id,
    'estado', p_estado,
    'colaborador_id', v_entrega.colaborador_id,
    'fecha', v_entrega.fecha
  );
end;
$$;

revoke all on function public.dash_admin_revisar_entrega(bigint, text, text) from public, anon;
grant execute on function public.dash_admin_revisar_entrega(bigint, text, text) to authenticated;

create or replace function public.dash_mis_revisiones_cierre()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_fecha date;
  v_revisiones jsonb;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  v_fecha := public.asis_cierre_fecha_activa(v_colab);

  select coalesce(jsonb_agg(jsonb_build_object(
           'requisito', requisito,
           'asignacion_id', asignacion_id,
           'revision_estado', revision_estado,
           'revision_nota', revision_nota,
           'revisado_at', revisado_at
         )), '[]'::jsonb)
    into v_revisiones
    from (
      select distinct on (e.requisito, coalesce(e.asignacion_id, 0))
             e.requisito, e.asignacion_id, e.revision_estado,
             e.revision_nota, e.revisado_at, e.creado_at
        from public.asis_entregas_diarias e
       where e.colaborador_id = v_colab and e.fecha = v_fecha
       order by e.requisito, coalesce(e.asignacion_id, 0), e.creado_at desc, e.id desc
    ) latest;

  return jsonb_build_object('ok', true, 'fecha', v_fecha, 'revisiones', v_revisiones);
end;
$$;

revoke all on function public.dash_mis_revisiones_cierre() from public, anon;
grant execute on function public.dash_mis_revisiones_cierre() to authenticated;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'columnas de revisión'::text as pieza,
         count(*)::int as encontrado, 4 as esperado
    from information_schema.columns
   where table_schema = 'public' and table_name = 'asis_entregas_diarias'
     and column_name in ('revision_estado','revision_nota','revisado_at','revisado_por')
  union all
  select 'tabla de auditoría',
         count(*)::int, 1
    from information_schema.tables
   where table_schema = 'public' and table_name = 'asis_entrega_revisiones'
  union all
  select 'RPC de revisión',
         count(*)::int, 3
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('dash_admin_revision_entregas','dash_admin_revisar_entrega','dash_mis_revisiones_cierre')
  union all
  select 'lectura privada Dirección',
         count(*)::int, 1
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'cierre evidencias: lectura autorizada'
) q;
