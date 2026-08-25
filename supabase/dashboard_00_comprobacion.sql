-- ══════════════════════════════════════════════════════════════════════
--  KJA · Dashboard — Comprobación de integridad (SOLO LECTURA)
--
--  Va TODO en una sola consulta a propósito: el editor de Supabase solo
--  muestra el resultado de la última sentencia, así que partirla en
--  varias hacía que solo se viera el último bloque.
--
--  Correr ANTES de una migración y otra vez DESPUÉS, y comparar las dos
--  salidas: tienen que ser idénticas fila por fila.
--
--  No modifica nada.
-- ══════════════════════════════════════════════════════════════════════

with totales as (
  select 'colaboradores' as que, count(*) as n from public.asis_colaboradores
  union all select 'registros',           count(*) from public.asis_registros
  union all select 'historial_contrato',  count(*) from public.asis_historial_contrato
  union all select 'excepciones',         count(*) from public.asis_excepciones
  union all select 'solicitudes_horario', count(*) from public.asis_solicitudes_horario
  union all select 'claves',              count(*) from public.asis_claves
  union all select 'perfiles',            count(*) from public.asis_perfiles
),
personas as (
  select c.id,
         a.nombre as area,
         c.nombre,
         count(r.id)                                     as dias,
         coalesce(sum(r.horas), 0)                       as horas,
         coalesce(c.horas_previas, 0)                    as previas,
         coalesce(c.contrato_horas, 0)                   as meta,
         coalesce(c.contrato_inicio::text, '-')          as inicio,
         coalesce(c.tipo_vinculo, '-')                   as vinculo,
         (select count(*) from public.asis_historial_contrato h
           where h.colaborador_id = c.id)                as cambios,
         (select count(*) from public.asis_excepciones e
           where e.colaborador_id = c.id)                as excep
  from public.asis_colaboradores c
  join public.asis_areas a          on a.id = c.area_id
  left join public.asis_registros r on r.colaborador_id = c.id
  group by c.id, a.nombre, c.nombre, c.horas_previas, c.contrato_horas,
           c.contrato_inicio, c.tipo_vinculo
)
select 1 as ord, 'TOTAL' as seccion, que as detalle, n::text as valor
  from totales
union all
select 2, area, nombre,
       'dias=' || dias || '  horas=' || horas || '  previas=' || previas ||
       '  meta=' || meta || '  inicio=' || inicio || '  vinculo=' || vinculo ||
       '  cambios=' || cambios || '  excep=' || excep
  from personas
order by ord, seccion, detalle;
