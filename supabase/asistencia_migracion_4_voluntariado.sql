-- =====================================================================
--  KJA · Asistencia — Migración 4: tipo de vínculo (prácticas / voluntariado)
--  Aditiva y segura (no borra datos). Pegar en el SQL Editor y ejecutar.
--
--  Un colaborador puede ser de prácticas, de voluntariado, o AMBOS. En los
--  mixtos el vínculo se define día por día dentro de horario_semanal
--  (campo "vinc"), y las horas se acumulan en dos contadores separados
--  para poder emitir el Certificado de Prácticas y la Constancia de
--  Voluntariado con cifras correctas.
-- =====================================================================

-- 1) Vínculo del colaborador: practicas | voluntariado | ambos
alter table public.asis_colaboradores
  add column if not exists tipo_vinculo text not null default 'practicas';

-- El CHECK se recrea para admitir 'ambos' (si la migración ya se corrió antes
-- con solo dos valores, esto la actualiza sin tocar los datos).
alter table public.asis_colaboradores
  drop constraint if exists asis_colaboradores_tipo_vinculo_check;
alter table public.asis_colaboradores
  add constraint asis_colaboradores_tipo_vinculo_check
  check (tipo_vinculo in ('practicas','voluntariado','ambos'));

comment on column public.asis_colaboradores.tipo_vinculo is
  'practicas | voluntariado | ambos. En ambos, el vínculo de cada día vive en horario_semanal->dow->vinc';

-- 2) Meta de horas del voluntariado (solo para los mixtos).
--    En los no mixtos, contrato_horas sigue siendo la única meta.
alter table public.asis_colaboradores
  add column if not exists contrato_horas_voluntariado integer;

comment on column public.asis_colaboradores.contrato_horas_voluntariado is
  'Meta de horas de voluntariado. Solo aplica cuando tipo_vinculo = ambos';

-- 3) Vínculo congelado en cada marca de asistencia.
--    Igual que "horas", se guarda al marcar para que un cambio de horario
--    posterior no reescriba la historia. Los registros anteriores quedan en
--    NULL y el front los reparte con el horario vigente.
alter table public.asis_registros
  add column if not exists vinculo text;

alter table public.asis_registros
  drop constraint if exists asis_registros_vinculo_check;
alter table public.asis_registros
  add constraint asis_registros_vinculo_check
  check (vinculo is null or vinculo in ('practicas','voluntariado'));

comment on column public.asis_registros.vinculo is
  'Vínculo con el que se contó este día (congelado al marcar). NULL en registros previos a la migración 4';

-- Refresca el caché de esquema de la API (evita el error PGRST204
-- "Could not find the 'tipo_vinculo' column ... in the schema cache").
notify pgrst, 'reload schema';
