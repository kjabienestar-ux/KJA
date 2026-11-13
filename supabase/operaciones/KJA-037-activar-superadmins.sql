-- PREPARADO, NO EJECUTADO. Después de instalar la migración y desplegar ambas Edge Functions.
-- Identidades contrastadas por lectura el 13/11/2026; volver a comprobar antes de ejecutar.
begin;
do $$
declare a uuid:='cb1e4ba7-c5c8-46f9-9211-45c09cbab6bd'; b uuid:='18fb2a02-b524-4865-b981-5a2f0b7a4881';
begin
 perform 1 from kja_admin.config where id for update;
 if (select habilitado from kja_admin.config where id) or exists(select 1 from kja_admin.puestos) then
  raise exception 'Ya existe una designación. No sobrescribir: usar delegación o recuperación controlada.';
 end if;
 if not kja_admin.activa(a) or not kja_admin.activa(b) or
  not exists(select 1 from auth.users where id=a and lower(email)='piero69@kja.com' and email_confirmed_at is not null) or
  not exists(select 1 from auth.users where id=b and lower(email)='yeiser69@gmail.com' and email_confirmed_at is not null) then
  raise exception 'No coinciden las dos identidades administrativas verificadas.';
 end if;
 insert into kja_admin.puestos values(1,a),(2,b);
 insert into kja_admin.operaciones(id,accion,motivo,despues,resultado,terminado_at)
 values(gen_random_uuid(),'activacion','Designación inicial aprobada por Piero',jsonb_build_object('puestos',jsonb_build_array(a,b)),'completada',clock_timestamp());
 update kja_admin.config set habilitado=true where id;
end;$$;
commit;
select puesto,p.nombre from kja_admin.puestos s join public.asis_perfiles p on p.id=s.cuenta order by puesto;
