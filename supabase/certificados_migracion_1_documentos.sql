-- ══════════════════════════════════════════════════════════════════════
--  KJA · Certificados — Migración 1: documentos con campos propios
--
--  Motivo: la "Constancia de charlas" no es un certificado decorado sino
--  una hoja A4 con membrete, y trae campos que ningún otro tipo usa
--  (colegio, grado, turno, edad, domicilio, a solicitud de quién…).
--
--  En vez de agregar ocho columnas —y repetir ocho veces el DROP+CREATE de
--  las RPC, porque devuelven RETURNS TABLE con columnas fijas— va una sola
--  columna jsonb, igual que ya se hizo con `temario`. El próximo tipo de
--  documento no cuesta otra migración.
--
--  Correr entero en el SQL Editor. Supabase avisa de "destructive operation"
--  en los DROP: es esperado, las funciones se vuelven a crear acá mismo.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) LA COLUMNA ────────────────────────────────────────────────────
alter table public.certificados
  add column if not exists datos jsonb;

comment on column public.certificados.datos is
  'Campos propios del tipo de documento. La constancia de charlas guarda aquí colegio, grado, turno, edad, domicilio, el proceso y a solicitud de quién. Los cuatro tipos clásicos lo dejan nulo.';


-- ── 2) BÚSQUEDA PÚBLICA (por nombre o por DNI) ───────────────────────
--  Dos cambios sobre la versión anterior:
--    a) devuelve `datos`, o la constancia nueva llegaría sin sus campos.
--    b) filtra `oculto`: hasta ahora un certificado mandado a la papelera
--       desde el admin seguía saliendo en la búsqueda pública.
drop function if exists public.buscar_certificados(text);

create function public.buscar_certificados(p_query text)
returns table(id uuid, codigo text, tipo text, nombre text, titulo text,
              duracion text, fecha_inicio date, fecha_fin date, fecha_emision date,
              cliente_id uuid, temario jsonb, font_size_nombre integer,
              font_nombre text, datos jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare q text := btrim(coalesce(p_query,''));
begin
  if length(q) < 3 then return; end if;
  if q ~ '^\d{4,}$' then
    return query
      select c.id,c.codigo,c.tipo,c.nombre,c.titulo,c.duracion,c.fecha_inicio,
             c.fecha_fin,c.fecha_emision,c.cliente_id,c.temario,c.font_size_nombre,
             c.font_nombre,
             -- El domicilio se guarda para imprimir, pero no se publica: es el
             -- único campo que no sirve para verificar nada y suele ser el de
             -- un menor. Para publicarlo igual, cambiar por: c.datos
             c.datos - 'domicilio'::text
      from public.certificados c
      where c.dni = q
        and coalesce(c.oculto, false) = false
      order by c.fecha_emision desc nulls last limit 100;
  else
    return query
      select c.id,c.codigo,c.tipo,c.nombre,c.titulo,c.duracion,c.fecha_inicio,
             c.fecha_fin,c.fecha_emision,c.cliente_id,c.temario,c.font_size_nombre,
             c.font_nombre,
             c.datos - 'domicilio'::text      -- ídem
      from public.certificados c
      where (select bool_and(c.nombre ilike '%'||w||'%')
               from regexp_split_to_table(q, '\s+') as w)
        and coalesce(c.oculto, false) = false
      order by c.fecha_emision desc nulls last limit 100;
  end if;
end;
$function$;

grant execute on function public.buscar_certificados(text) to anon, authenticated;


-- ── 3) VERIFICACIÓN POR CÓDIGO (el flujo del QR) ─────────────────────
--  Ojo con lo que ya hacía y se conserva: devuelve TODOS los certificados
--  de esa misma persona, no solo el del código escaneado.
--  El filtro de papelera va en los dos sitios: en la búsqueda del código y
--  en el listado. Si no, escanear el QR de uno archivado seguía resolviendo
--  a la persona y devolviendo el resto de sus certificados.
drop function if exists public.verificar_codigo(text);

create function public.verificar_codigo(p_codigo text)
returns table(id uuid, codigo text, tipo text, nombre text, titulo text,
              duracion text, fecha_inicio date, fecha_fin date, fecha_emision date,
              cliente_id uuid, temario jsonb, font_size_nombre integer,
              font_nombre text, datos jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.id,c.codigo,c.tipo,c.nombre,c.titulo,c.duracion,
         c.fecha_inicio,c.fecha_fin,c.fecha_emision,c.cliente_id,c.temario,
         c.font_size_nombre,c.font_nombre,
         c.datos - 'domicilio'::text          -- ver nota en buscar_certificados
  from public.certificados c
  where c.cliente_id = (select cliente_id from public.certificados
                         where codigo = p_codigo
                           and coalesce(oculto, false) = false
                         limit 1)
    and coalesce(c.oculto, false) = false
  order by c.fecha_emision desc nulls last;
$function$;

grant execute on function public.verificar_codigo(text) to anon, authenticated;


-- ── 4) PostgREST cachea el esquema ───────────────────────────────────
notify pgrst, 'reload schema';


-- ── COMPROBACIÓN ─────────────────────────────────────────────────────
--  Las dos deben aparecer con `datos jsonb` al final del RETURNS TABLE:
--
--  select p.proname, pg_get_function_result(p.oid)
--  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname in ('buscar_certificados','verificar_codigo');
