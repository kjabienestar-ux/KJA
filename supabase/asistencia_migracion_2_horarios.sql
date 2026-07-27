-- =====================================================================
--  KJA · Asistencia — Migración 2: horario semanal + horas de contrato
--  Aditiva y segura (no borra datos). Pegar en el SQL Editor y ejecutar.
-- =====================================================================

alter table public.asis_colaboradores
  add column if not exists hora_inicio     time,                       -- entrada general (contrato)
  add column if not exists hora_fin        time,                       -- salida general
  add column if not exists horario_semanal jsonb not null default '{}'::jsonb,
  add column if not exists contrato_horas  numeric;                    -- total de horas de prácticas (fase 2)

-- horario_semanal: objeto por día ISO (1=Lun … 6=Sáb, 7=Dom). Ejemplo:
--   {
--     "1": {"mod":"virtual"},                        -- usa hora_inicio/hora_fin generales
--     "2": {"mod":"presencial","ini":"09:00","fin":"18:00"},
--     "3": {"mod":"opcional","ini":"08:00","fin":"13:00"},
--     "6": {"mod":"no_gestiona"}                      -- (los días sin clave = no gestiona)
--   }
-- mod ∈ 'virtual' | 'presencial' | 'opcional' | 'no_gestiona'
-- ini/fin son opcionales; si faltan, se toman las horas generales del colaborador.

comment on column public.asis_colaboradores.horario_semanal is 'Horario por día ISO: {"1":{"mod":"virtual","ini":"08:00","fin":"14:00"}, ...}';
