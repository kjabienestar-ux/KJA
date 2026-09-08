-- DASHBOARD 38 - COMPARTICIONES DESDE UNA IMAGEN
-- Ejecutar despues de dashboard_37_carga_evidencias_direccion.sql.
-- Conserva el maximo de 50 capturas y reduce el minimo obligatorio a una.

begin;

alter table public.asis_cierre_config
  alter column comparticiones_min set default 1;

update public.asis_cierre_config
   set comparticiones_min=1,
       actualizado_at=now()
 where id=1
   and comparticiones_min is distinct from 1;

notify pgrst,'reload schema';
commit;

select case when comparticiones_min=1 then 'OK' else 'REVISAR' end estado,
       comparticiones_min minimo,
       50 maximo
  from public.asis_cierre_config
 where id=1;
