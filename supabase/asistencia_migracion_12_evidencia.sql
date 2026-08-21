-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 12 · EVIDENCIA FOTOGRÁFICA AL MARCAR ASISTENCIA
--
-- Quien marca desde su enlace personal (/marcar?k=…) debe adjuntar una
-- foto: el Zoom abierto con su nombre si es virtual, o su llegada al
-- consultorio si es presencial. La foto se comprime en el celular
-- (≈100 KB) y se sube a un bucket privado; aquí solo se guarda la ruta.
--
-- La ubicación es opcional: si el navegador la entrega, se registra para
-- poder contrastar las marcas presenciales con la dirección del local.
--
-- Ejecutar TODO el archivo en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) COLUMNAS NUEVAS EN EL REGISTRO ────────────────────────────────
alter table public.asis_registros
  add column if not exists evidencia_path   text,
  add column if not exists evidencia_origen text check (evidencia_origen in ('camara','archivo')),
  add column if not exists evidencia_lat    numeric(9,6),
  add column if not exists evidencia_lon    numeric(9,6),
  add column if not exists evidencia_at     timestamptz;

comment on column public.asis_registros.evidencia_path is
  'Ruta dentro del bucket asis-evidencias, ej: 2026/08/7/2026-08-21.webp. Nula = marca sin foto';
comment on column public.asis_registros.evidencia_origen is
  'camara = la tomó en el momento · archivo = la subió desde su equipo (más fácil de falsear)';
comment on column public.asis_registros.evidencia_lat is
  'Latitud que entregó el navegador al marcar. Nula si no dio permiso de ubicación';

-- ── 2) INTERRUPTOR: ¿SE EXIGE LA FOTO? ───────────────────────────────
--    Encendido por defecto. Si algún día falla la subida de fotos y el
--    equipo no puede marcar, dirección lo apaga y todos siguen marcando.
alter table public.asis_portal_config
  add column if not exists exigir_evidencia boolean not null default true;

comment on column public.asis_portal_config.exigir_evidencia is
  'true = sin foto no se puede marcar desde el portal. Apagarlo solo si la subida está caída';

-- ⚠ SE DEJA APAGADO AL EJECUTAR ESTA MIGRACIÓN.
--   Si se encendiera ahora, nadie podría marcar hasta que marcar.html sepa
--   subir fotos (fase 3). Se enciende recién cuando esa fase esté probada:
--
--     update public.asis_portal_config set exigir_evidencia = true where id = 1;
--
update public.asis_portal_config set exigir_evidencia = false where id = 1;

-- ── 3) BUCKET PRIVADO PARA LAS FOTOS ─────────────────────────────────
--    Privado: nadie ve una foto con la URL suelta. Dirección las abre
--    con enlaces firmados que caducan. Tope de 2 MB por archivo: la foto
--    llega comprimida a ~100 KB, así que 2 MB ya es un margen enorme y
--    evita que alguien suba un video disfrazado de imagen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asis-evidencias', 'asis-evidencias', false, 2097152,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 2097152,
      allowed_mime_types = array['image/webp','image/jpeg','image/png'];

-- ── 4) QUIÉN PUEDE VER LAS FOTOS ─────────────────────────────────────
--    Solo los miembros del panel (dirección/editor/visor). La subida NO
--    pasa por acá: la hace la edge function con una URL firmada, porque
--    el portal funciona sin login.
drop policy if exists "asis evidencias: ver miembros" on storage.objects;
create policy "asis evidencias: ver miembros"
  on storage.objects for select to authenticated
  using (bucket_id = 'asis-evidencias' and public.asis_es_miembro());

drop policy if exists "asis evidencias: borrar miembros" on storage.objects;
create policy "asis evidencias: borrar miembros"
  on storage.objects for delete to authenticated
  using (bucket_id = 'asis-evidencias' and public.asis_es_miembro());

-- ── 5) RPC DE MARCADO, CON EVIDENCIA ─────────────────────────────────
--    Cambia la firma (4 → 8 parámetros), así que hay que DROP + CREATE:
--    "create or replace" no basta cuando cambian los argumentos.
--    El cuerpo es el de la migración 9 (ventana por minuto) más la foto.
drop function if exists public.asis_portal_marcar(text, bigint, text, text);

create or replace function public.asis_portal_marcar(
  p_clave    text,
  p_colab    bigint,
  p_pin      text,
  p_disp     text,
  p_foto     text    default null,   -- ruta ya subida al bucket
  p_foto_org text    default null,   -- 'camara' | 'archivo'
  p_lat      numeric default null,
  p_lon      numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_ahora  time := (now() at time zone 'America/Lima')::time;
  v_reg    public.asis_registros;
  v_vent   text;
  v_estado text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k     from public.asis_claves        where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;

  if not public.asis_labora(v_colab, v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'no_labora');
  end if;

  -- La foto es obligatoria mientras el interruptor esté encendido
  if v_cfg.exigir_evidencia and coalesce(btrim(p_foto), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'falta_evidencia');
  end if;

  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado',
      'estado', v_reg.estado, 'marcado_at', v_reg.marcado_at);
  end if;

  -- La ventana se decide acá, no en el navegador: es la regla, no un aviso
  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, v_cfg.tolerancia_min);
  if v_vent in ('antes','cerrada') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent,
      'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
  end if;

  v_estado := case when v_vent = 'tardanza' then 'T' else 'P' end;

  insert into public.asis_registros
    (colaborador_id, fecha, estado, origen, dispositivo, horas, vinculo,
     evidencia_path, evidencia_origen, evidencia_lat, evidencia_lon, evidencia_at)
  values (v_colab.id, v_hoy, v_estado, 'portal', left(coalesce(p_disp,''), 80),
          public.asis_horas_dia(v_colab, v_hoy), public.asis_vinc_dia(v_colab, v_hoy),
          nullif(btrim(coalesce(p_foto,'')), ''),
          case when p_foto_org in ('camara','archivo') then p_foto_org else null end,
          p_lat, p_lon,
          case when coalesce(btrim(p_foto),'') <> '' then now() else null end);

  return jsonb_build_object('ok', true, 'estado', v_estado, 'hora', v_ahora,
    'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
end;
$$;

grant execute on function public.asis_portal_marcar(text, bigint, text, text, text, text, numeric, numeric)
  to anon, authenticated;

notify pgrst, 'reload schema';

-- ── COMPROBACIÓN ─────────────────────────────────────────────────────
-- Al terminar, esto debe devolver una fila con los 8 argumentos:
--
--   select p.proname, pg_get_function_arguments(p.oid) as argumentos
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'asis_portal_marcar';
--
-- Y esto, el bucket privado recién creado:
--
--   select id, public, file_size_limit from storage.buckets where id = 'asis-evidencias';
