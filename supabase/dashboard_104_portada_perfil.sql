-- ============================================================================
-- KJA · Dashboard 104 — portada privada del perfil (estilo Facebook)
--
-- Migración aditiva e idempotente. No modifica la foto de perfil, certificados,
-- asistencias, contratos, PIN ni sesiones existentes.
--
-- Reutiliza el bucket privado perfil-fotos (webp/jpeg, máximo 512 KB). El
-- navegador recorta la portada a 1200x450 y la comprime antes de subirla.
-- Solo la propia persona puede leer, crear, reemplazar o borrar su portada.
-- ============================================================================

begin;

alter table public.asis_colaboradores
  add column if not exists portada_path text,
  add column if not exists portada_actualizada_at timestamptz;

comment on column public.asis_colaboradores.portada_path is
  'Ruta privada de la portada comprimida dentro del bucket perfil-fotos.';

alter table public.asis_colaboradores
  drop constraint if exists asis_colaboradores_portada_path_chk;

alter table public.asis_colaboradores
  add constraint asis_colaboradores_portada_path_chk check (
    portada_path is null or portada_path in (
      id::text || '/portada.webp',
      id::text || '/portada.jpg'
    )
  );

-- El bucket ya existe (dashboard_10); se reafirma privado y con los mismos límites.
insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  ('perfil-fotos', 'perfil-fotos', false, 524288,
   array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Las políticas de dashboard_10/17 solo reconocen rutas avatar.*: estas se
-- suman y únicamente aceptan las dos rutas deterministas de la portada propia.
drop policy if exists "perfil portada: lectura propia" on storage.objects;
create policy "perfil portada: lectura propia"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/portada.webp',
      public.dash_colab()::text || '/portada.jpg'
    )
  );

drop policy if exists "perfil portada: crear propia" on storage.objects;
create policy "perfil portada: crear propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/portada.webp',
      public.dash_colab()::text || '/portada.jpg'
    )
  );

drop policy if exists "perfil portada: actualizar propia" on storage.objects;
create policy "perfil portada: actualizar propia"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/portada.webp',
      public.dash_colab()::text || '/portada.jpg'
    )
  )
  with check (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/portada.webp',
      public.dash_colab()::text || '/portada.jpg'
    )
  );

drop policy if exists "perfil portada: borrar propia" on storage.objects;
create policy "perfil portada: borrar propia"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/portada.webp',
      public.dash_colab()::text || '/portada.jpg'
    )
  );

create or replace function public.dash_mi_portada()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id bigint := public.dash_colab();
  v_path text;
  v_actualizada timestamptz;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select portada_path, portada_actualizada_at
    into v_path, v_actualizada
    from public.asis_colaboradores
   where id = v_id and activo;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  return jsonb_build_object(
    'ok', true,
    'path', v_path,
    'actualizada_at', v_actualizada
  );
end;
$$;

create or replace function public.dash_guardar_portada(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := public.dash_colab();
  v_path text := btrim(coalesce(p_path, ''));
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  if v_path not in (v_id::text || '/portada.webp', v_id::text || '/portada.jpg') then
    return jsonb_build_object('ok', false, 'motivo', 'ruta');
  end if;

  update public.asis_colaboradores
     set portada_path = v_path,
         portada_actualizada_at = now()
   where id = v_id and activo;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  return jsonb_build_object('ok', true, 'path', v_path);
end;
$$;

create or replace function public.dash_quitar_portada()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := public.dash_colab();
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  update public.asis_colaboradores
     set portada_path = null,
         portada_actualizada_at = now()
   where id = v_id and activo;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.dash_mi_portada() from public, anon, authenticated;
revoke all on function public.dash_guardar_portada(text) from public, anon, authenticated;
revoke all on function public.dash_quitar_portada() from public, anon, authenticated;

grant execute on function public.dash_mi_portada() to authenticated;
grant execute on function public.dash_guardar_portada(text) to authenticated;
grant execute on function public.dash_quitar_portada() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobación de instalación (solo lectura): todas las filas deben decir OK.
select case when encontrado = esperado then 'OK' else 'REVISAR' end estado,
       pieza, encontrado, esperado
from (
  select 'columnas de portada' pieza,
         (select count(*)::int from information_schema.columns
           where table_schema='public' and table_name='asis_colaboradores'
             and column_name in ('portada_path','portada_actualizada_at')) encontrado,
         2 esperado
  union all
  select 'bucket privado',
         (select count(*)::int from storage.buckets
           where id='perfil-fotos' and public=false
             and file_size_limit=524288),
         1
  union all
  select 'funciones de portada',
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public'
             and p.proname in ('dash_mi_portada','dash_guardar_portada','dash_quitar_portada')),
         3
  union all
  select 'políticas de portada',
         (select count(*)::int from pg_policies
           where schemaname='storage' and tablename='objects'
             and policyname like 'perfil portada:%'),
         4
) q;
