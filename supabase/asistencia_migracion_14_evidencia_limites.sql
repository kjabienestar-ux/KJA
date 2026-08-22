-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 14 · LÍMITES MÁS ESTRICTOS PARA LAS FOTOS DE EVIDENCIA
--
-- Se probó en un iPhone y salió un fallo: Safari no sabe codificar WebP,
-- así que devolvía PNG y cada foto pesaba 1,6 MB en vez de 150 KB. A ese
-- ritmo el bucket de 1 GB se llenaba en tres meses.
--
-- El navegador ya está arreglado (cae a JPEG y baja la calidad hasta que
-- la foto entra en 180 KB), pero la regla no puede depender solo de él:
--
--   · fuera image/png  → una fotografía en PNG siempre va a pesar de más.
--     Lo que sube el portal es WebP o JPEG, así que no hace falta.
--   · el tope por archivo baja de 2 MB a 1 MB. Con las fotos entrando en
--     180 KB, 1 MB ya es un margen enorme y corta cualquier abuso.
--
-- Ejecutar TODO el archivo en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════

update storage.buckets
   set allowed_mime_types = array['image/webp','image/jpeg'],
       file_size_limit    = 1048576          -- 1 MB
 where id = 'asis-evidencias';

-- ── COMPROBACIÓN ─────────────────────────────────────────────────────
-- Debe devolver el bucket privado, con 1048576 y solo webp/jpeg:
--
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'asis-evidencias';

-- ── LAS FOTOS QUE YA ESTÁN SUBIDAS ───────────────────────────────────
-- Las que se subieron antes del arreglo siguen pesando lo que pesaban;
-- este cambio solo afecta a las nuevas. Para ver cuáles conviene borrar
-- desde el panel (Storage → asis-evidencias), esta consulta las lista de
-- la más pesada a la más liviana:
--
--   select name,
--          round((metadata->>'size')::numeric / 1024) as kb,
--          metadata->>'mimetype' as tipo,
--          created_at
--     from storage.objects
--    where bucket_id = 'asis-evidencias'
--    order by (metadata->>'size')::numeric desc;
