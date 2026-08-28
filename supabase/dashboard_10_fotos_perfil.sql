-- ============================================================================
-- KJA · Dashboard 10 — fotos privadas de perfil
--
-- Migración aditiva e idempotente. No modifica certificados, asistencias,
-- contratos, PIN ni sesiones existentes.
--
-- El navegador rechaza originales mayores de 3 MB y los comprime antes de
-- subirlos. Storage aplica además un límite estricto de 512 KB al archivo final.
-- ============================================================================

begin;

alter table public.asis_colaboradores
  add column if not exists foto_path text,
  add column if not exists foto_actualizada_at timestamptz;

comment on column public.asis_colaboradores.foto_path is
  'Ruta privada de la foto comprimida dentro del bucket perfil-fotos.';

alter table public.asis_colaboradores
  drop constraint if exists asis_colaboradores_foto_path_chk;

alter table public.asis_colaboradores
  add constraint asis_colaboradores_foto_path_chk check (
    foto_path is null or foto_path in (
      id::text || '/avatar.webp',
      id::text || '/avatar.jpg'
    )
  );

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  ('perfil-fotos', 'perfil-fotos', false, 524288,
   array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura privada: la propia persona, su líder autorizado y los miembros del
-- panel conservan exactamente el alcance de public.puede_ver_colab().
drop policy if exists "perfil fotos: lectura autorizada" on storage.objects;
create policy "perfil fotos: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and name ~ '^[0-9]+/avatar\.(webp|jpg)$'
    and public.puede_ver_colab(split_part(name, '/', 1)::bigint)
  );

-- Escritura: una sesión personal solo puede usar las dos rutas deterministas
-- de su propio colaborador. No puede crear carpetas ni archivos adicionales.
drop policy if exists "perfil fotos: crear propia" on storage.objects;
create policy "perfil fotos: crear propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/avatar.webp',
      public.dash_colab()::text || '/avatar.jpg'
    )
  );

drop policy if exists "perfil fotos: actualizar propia" on storage.objects;
create policy "perfil fotos: actualizar propia"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/avatar.webp',
      public.dash_colab()::text || '/avatar.jpg'
    )
  )
  with check (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/avatar.webp',
      public.dash_colab()::text || '/avatar.jpg'
    )
  );

drop policy if exists "perfil fotos: borrar propia" on storage.objects;
create policy "perfil fotos: borrar propia"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and name in (
      public.dash_colab()::text || '/avatar.webp',
      public.dash_colab()::text || '/avatar.jpg'
    )
  );

create or replace function public.dash_mi_foto()
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

  select foto_path, foto_actualizada_at
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

create or replace function public.dash_guardar_foto(p_path text)
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

  if v_path not in (v_id::text || '/avatar.webp', v_id::text || '/avatar.jpg') then
    return jsonb_build_object('ok', false, 'motivo', 'ruta');
  end if;

  update public.asis_colaboradores
     set foto_path = v_path,
         foto_actualizada_at = now()
   where id = v_id and activo;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  return jsonb_build_object('ok', true, 'path', v_path);
end;
$$;

create or replace function public.dash_quitar_foto()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := public.dash_colab();
  v_path text;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  update public.asis_colaboradores
     set foto_path = null,
         foto_actualizada_at = now()
   where id = v_id and activo
   returning foto_path into v_path;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.dash_mi_foto() from public, anon, authenticated;
revoke all on function public.dash_guardar_foto(text) from public, anon, authenticated;
revoke all on function public.dash_quitar_foto() from public, anon, authenticated;

grant execute on function public.dash_mi_foto() to authenticated;
grant execute on function public.dash_guardar_foto(text) to authenticated;
grant execute on function public.dash_quitar_foto() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobación de instalación (solo lectura): todas las filas deben decir OK.
select case when encontrado = esperado then 'OK' else 'REVISAR' end estado,
       pieza, encontrado, esperado
from (
  select 'columnas de foto' pieza,
         (select count(*)::int from information_schema.columns
           where table_schema='public' and table_name='asis_colaboradores'
             and column_name in ('foto_path','foto_actualizada_at')) encontrado,
         2 esperado
  union all
  select 'bucket privado',
         (select count(*)::int from storage.buckets
           where id='perfil-fotos' and public=false
             and file_size_limit=524288),
         1
  union all
  select 'funciones de foto',
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public'
             and p.proname in ('dash_mi_foto','dash_guardar_foto','dash_quitar_foto')),
         3
  union all
  select 'políticas privadas',
         (select count(*)::int from pg_policies
           where schemaname='storage' and tablename='objects'
             and policyname like 'perfil fotos:%'),
         4
) q;
