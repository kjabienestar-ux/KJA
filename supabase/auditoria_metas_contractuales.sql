-- SOLO LECTURA. Ejecutar con acceso administrativo en el editor SQL.
-- Una coincidencia es un indicio, no prueba de un error ni autorización para
-- revertir: la meta anterior también podría ser una estimación incorrecta.
select c.id,c.nombre,c.contrato_horas meta_actual,
  h.created_at fecha_cambio,h.horas_anterior,h.horas_nueva,h.nota,
  exists(select 1 from public.asis_historial_contrato x
    where x.colaborador_id=h.colaborador_id and x.tipo in ('horario','fechas')
      and x.created_at=h.created_at) cambio_simultaneo_de_fechas_o_jornada
from public.asis_colaboradores c
join public.asis_historial_contrato h on h.colaborador_id=c.id
where h.tipo='horas_contrato' and h.horas_anterior is distinct from h.horas_nueva
order by cambio_simultaneo_de_fechas_o_jornada desc,h.created_at desc;
