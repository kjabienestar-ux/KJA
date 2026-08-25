-- ══════════════════════════════════════════════════════════════════════
--  KJA · Dashboard — Comprobación de integridad (SOLO LECTURA)
--
--  Correr ANTES de la migración y otra vez DESPUÉS, y comparar.
--  Las dos salidas tienen que ser idénticas: la migración solo AÑADE
--  columnas y funciones, no toca ni una fila de datos.
--
--  No modifica nada. Se puede correr las veces que haga falta.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) Totales por tabla ─────────────────────────────────────────────
select 'colaboradores'        as tabla, count(*) as filas from public.asis_colaboradores
union all select 'registros',            count(*) from public.asis_registros
union all select 'historial_contrato',   count(*) from public.asis_historial_contrato
union all select 'excepciones',          count(*) from public.asis_excepciones
union all select 'solicitudes_horario',  count(*) from public.asis_solicitudes_horario
union all select 'claves',               count(*) from public.asis_claves
union all select 'perfiles',             count(*) from public.asis_perfiles
order by tabla;


-- ── 2) Lo de cada persona, uno por uno ───────────────────────────────
--  Es la comprobación que de verdad importa: días marcados, horas
--  acumuladas y datos de contrato de cada colaborador.
select c.id,
       c.nombre,
       a.nombre                             as area,
       c.activo,
       count(r.id)                          as dias_marcados,
       coalesce(sum(r.horas), 0)            as horas_marcadas,
       c.horas_previas,
       c.contrato_horas,
       c.contrato_inicio,
       c.contrato_fin_referencia,
       c.tipo_vinculo,
       (select count(*) from public.asis_historial_contrato h
         where h.colaborador_id = c.id)     as cambios_contrato,
       (select count(*) from public.asis_excepciones e
         where e.colaborador_id = c.id)     as excepciones,
       exists (select 1 from public.asis_claves k
                where k.colaborador_id = c.id) as tiene_clave
from public.asis_colaboradores c
join public.asis_areas a          on a.id = c.area_id
left join public.asis_registros r on r.colaborador_id = c.id
group by c.id, c.nombre, a.nombre, c.activo, c.horas_previas, c.contrato_horas,
         c.contrato_inicio, c.contrato_fin_referencia, c.tipo_vinculo
order by a.nombre, c.nombre;


-- ── 3) Huellas de las claves ─────────────────────────────────────────
--  Solo para saber CUÁNTAS hay, nunca su contenido. Este es el único
--  número que va a cambiar cuando se pase a 6 dígitos: cada quien crea
--  su clave nueva. Su historial no se toca.
select count(*) as claves_creadas,
       count(*) filter (where bloqueado_hasta > now()) as bloqueadas_ahora
from public.asis_claves;
