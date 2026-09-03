-- KJA · Dashboard 16 — acceso uniforme al centro de solicitudes
--
-- Restablece de forma idempotente los permisos de las RPC personales para
-- cualquier colaborador autenticado. El aislamiento real sigue dentro de las
-- funciones: dash_colab() vincula la sesión con una sola ficha y cada persona
-- únicamente consulta o crea solicitudes propias. Nunca se habilita a anon.

begin;

grant usage on schema public to authenticated;

revoke all on function public.dash_solicitudes_personales()
  from public, anon;
revoke all on function public.dash_crear_solicitud(text,date,date,text,text)
  from public, anon;
revoke all on function public.dash_dia_detalle(date)
  from public, anon;

grant execute on function public.dash_solicitudes_personales()
  to authenticated;
grant execute on function public.dash_crear_solicitud(text,date,date,text,text)
  to authenticated;
grant execute on function public.dash_dia_detalle(date)
  to authenticated;

notify pgrst,'reload schema';

commit;

-- Las tres filas deben devolver OK después de aplicar esta migración.
select
  case when has_function_privilege('authenticated',firma,'EXECUTE')
       then 'OK' else 'REVISAR' end as estado,
  firma
from (values
  ('public.dash_solicitudes_personales()'),
  ('public.dash_crear_solicitud(text,date,date,text,text)'),
  ('public.dash_dia_detalle(date)')
) as funciones(firma);
