-- Solo lectura: diagnostica el RPE de la jornada mostrada en la captura.
-- Ejecutar en el SQL Editor de Supabase.
select c.id, c.nombre, r.fecha, r.modalidad_marcada,
  public.asis_modalidad_efectiva(c.id,r.fecha) as modalidad_efectiva,
  cfg.rpe_presencial_exento_desde,
  r.fecha >= cfg.rpe_presencial_exento_desde as fecha_con_exencion,
  public.asis_rpe_exento_presencial(c.id,r.fecha) as rpe_exento,
  cierre.datos->>'requiere_rpe' as requiere_rpe,
  cierre.datos->>'estado' as estado_cierre,
  cierre.datos->'requisitos' as requisitos
from public.asis_colaboradores c
join public.asis_registros r on r.colaborador_id=c.id
cross join public.asis_cierre_config cfg
cross join lateral (select public.dash_cierre_resumen_colab(c.id,r.fecha) as datos) cierre
where cfg.id=1 and r.fecha=date '2026-10-02'
  and c.nombre ilike '%Gianfranco%Vargas%';
