-- =====================================================================
--  KJA · Asistencia — Migración 5: contrato pendiente de actualizar
--  Aditiva y segura (no borra datos). Pegar en el SQL Editor y ejecutar.
--
--  Hay contratos (sobre todo de internado) que están a la mano pero
--  incompletos: no figura la fecha de culminación, o las horas que
--  aparecen ahí ya cambiaron. Marcarlos como PENDIENTE evita que el
--  sistema proyecte fechas de término sobre datos que se sabe que no son
--  definitivos, y deja anotado qué falta para retomarlo después.
-- =====================================================================

alter table public.asis_colaboradores
  add column if not exists contrato_pendiente boolean not null default false;

comment on column public.asis_colaboradores.contrato_pendiente is
  'true = los datos del contrato son provisionales. La proyección de término no se toma como firme';

alter table public.asis_colaboradores
  add column if not exists contrato_nota text;

comment on column public.asis_colaboradores.contrato_nota is
  'Qué falta o qué hay que confirmar del contrato (texto libre, visible en el módulo)';

-- Refresca el caché de esquema de la API (evita el error PGRST204
-- "Could not find the 'contrato_pendiente' column ... in the schema cache").
notify pgrst, 'reload schema';
