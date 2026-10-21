-- Corrección de instalaciones existentes. Ejecutar completo en SQL Editor.
-- Conserva las postulaciones y los CV; no modifica los datos históricos.
begin;

alter table public.rec_postulaciones
  add column if not exists entrevista_fecha date,
  add column if not exists entrevista_hora text,
  add column if not exists entrevista_canal text;

notify pgrst, 'reload schema';
commit;
