-- PLANTILLA NO EJECUTADA. Exclusiva del custodio en SQL Editor; nunca desde el frontend.
-- Sustituir los dos UUID y el motivo tras verificar presencialmente la identidad y el sucesor.
begin;
do $$
declare saliente uuid:=null; sucesor uuid:=null; motivo text:='';
begin
 if saliente is null or sucesor is null or length(btrim(motivo))<10 then
  raise exception 'Completa UUID saliente, UUID sucesor y motivo verificable. No se efectuó ningún cambio.';
 end if;
 perform 1 from kja_admin.config where id for update;
 if not (select habilitado from kja_admin.config where id) or not kja_admin.activa(sucesor)
  or exists(select 1 from kja_admin.puestos where cuenta=sucesor) then raise exception 'Sucesor no válido.';end if;
 update kja_admin.puestos set cuenta=sucesor where cuenta=saliente;
 if not found then raise exception 'El saliente no ocupa un puesto.';end if;
 insert into kja_admin.operaciones(id,cuenta,accion,motivo,antes,despues,resultado,terminado_at)
 values(gen_random_uuid(),sucesor,'recuperacion_emergencia',motivo,jsonb_build_object('titular',saliente),
 jsonb_build_object('titular',sucesor),'completada',clock_timestamp());
end;$$;
commit;
