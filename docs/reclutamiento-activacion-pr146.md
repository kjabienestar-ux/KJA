# PR #146: revisión, despliegue y activación pendiente

## Verificación posterior: función presente con error SQL

En la comprobación posterior solicitada por el usuario, la situación cambió: la RPC ya está expuesta. Un DNI vacío devuelve `22023` y el documento sintético `00000000` devuelve `42703`, `column "dash_zoom_puede_unirse" does not exist`. No se consultaron los DNI personales de las capturas. La migración oficial 03 no contiene esa referencia; es necesario inspeccionar la definición instalada y el contexto SQL de sus dependencias.

Se descargaron las referencias recientes de `master`, que sigue en `1c54e360`. La copia de revisión quedó en ese commit; la carpeta principal conserva los cambios del usuario. Se dejó una copia exacta de `master` en `supabase/reclutamiento_03_consulta_estado.sql` y diagnóstico de solo lectura en `supabase/reclutamiento_diagnostico_estado.sql`.

Ejecutar primero el diagnóstico en SQL Editor y comprobar las columnas esperadas. Luego reaplicar completa la migración 03 para restaurar su definición oficial. Si el error persiste, el diagnóstico captura `PG_EXCEPTION_CONTEXT` para identificar la dependencia que falla; no aplicar migraciones de Zoom a ciegas. No se ejecutó SQL remoto por falta de acceso administrativo.

Se repitieron las cinco pruebas de `reclutamiento-estado`, todas aprobadas. Además se reprodujo localmente un error 42703 por una función mal definida; restaurar 03 resolvió esa reproducción, devolvió únicamente estado y fechas, reflejó un cambio de estado y conservó la denegación de SELECT anónimo directo. Esto comprueba el procedimiento localmente, no certifica la causa exacta ni la reparación remota.

Lo que sigue documenta la primera verificación y el procedimiento de activación; su referencia a PGRST202 es histórica.

Comprobación del 21 de octubre de 2026. **La activación del backend no está terminada.**

## Evidencia obtenida

- PR #146 revisado y fusionado a `master`: `1c54e360b305065d763496c69c7fd4683a808a56`, a las 18:43:57 UTC. Sin defectos encontrados en el diff del indicador de carga.
- Vercel Production: deployment `7234361511`, estado `success`, asociado al mismo commit. URL: https://kja-67eimh661-kja.vercel.app.
- https://www.kjadmb.com/reclutamiento.html y los archivos `reclutamiento-estado.js?v=4` y `reclutamiento-estado.css?v=4` respondieron HTTP 200 y coinciden con los archivos revisados, normalizando finales de línea. El dominio sin www redirige al mismo sitio.
- 27/27 pruebas aprobadas con Node 22: `reclutamiento-estado`, `reclutamiento-integracion`, `reclutamiento-persistencia`, `reclutamiento-steps-cv`, `admin-entry`. Verificador de recursos sin faltantes y `git diff --check` correcto.
- Pruebas locales con HTML/JS reales y DOM simulado: carga, aviso a 12 segundos sin otra petición, cierre, respuestas tardías, cinco estados y errores. PGlite ejecutó completas las migraciones 01 y 03; comprobó repetibilidad de 03, permisos de `anon` y `authenticated`, salida con exactamente tres claves y cambio de estado visible.
- En el proyecto remoto `xadxmfgdxwplmhijagix`, `GET /rest/v1/rec_postulaciones?select=id&limit=0` devolvió HTTP 401 / `42501`, `permission denied for table rec_postulaciones`. Esto indica que la tabla existe y conserva la restricción de lectura pública. No verifica sus columnas.
- `POST /rest/v1/rpc/rec_consultar_estado` con `{"p_dni":""}` devolvió HTTP 404 / `PGRST202`. La función aún no está disponible mediante PostgREST para el cliente público.
- No hay credenciales administrativas de Supabase ni navegador conectado disponibles en esta sesión. **No se aplicó ninguna migración remota, no se crearon ni modificaron expedientes y no se realizó la prueba visual ni el recorrido integral en producción.**
- Se usó un worktree separado en `C:\Users\yeise\Downloads\KJA-pr146-review`; los cambios previos de la carpeta original se conservaron.

## 1. Comprobar requisitos en Supabase

Abrir https://supabase.com/dashboard/project/xadxmfgdxwplmhijagix/sql/new y ejecutar:

```sql
select to_regclass('public.rec_postulaciones') as postulaciones,
       to_regclass('public.rec_curriculos') as curriculos,
       to_regclass('public.asis_perfiles') as identidad_asistencia,
       to_regclass('public.perfiles') as identidad_certificados;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'rec_postulaciones'
order by ordinal_position;

select to_regprocedure('public.rec_consultar_estado(text)') as consulta;
```

La migración 03 necesita `id` uuid, `datos` jsonb, `estado` text, `created_at` y `updated_at` timestamptz en `public.rec_postulaciones`. La bandeja administrativa también necesita el esquema completo de solicitudes, sus funciones y `rec_curriculos`.

Si falta `rec_postulaciones`, ejecutar **completo** [reclutamiento_01_solicitudes.sql de master](https://github.com/kjabienestar-ux/KJA/blob/master/supabase/reclutamiento_01_solicitudes.sql) antes de continuar. Esta migración requiere las tablas existentes `asis_perfiles` y `perfiles`: si falta alguna, detenerse y restaurar primero el esquema de identidad del portal. No crear tablas vacías para eludir ese requisito. Si la tabla existe pero sus columnas no corresponden, reconciliar el esquema antes de aplicar 03; `CREATE TABLE IF NOT EXISTS` de 01 no corrige una tabla incompatible.

Usar el archivo **01_solicitudes** de master, no el archivo local anterior `reclutamiento_01_postulaciones.sql`.

## 2. Aplicar completa la migración 03

Ejecutar todo [reclutamiento_03_consulta_estado.sql de master](https://github.com/kjabienestar-ux/KJA/blob/master/supabase/reclutamiento_03_consulta_estado.sql). Este es su contenido revisado completo:

```sql
-- Aplicar después de reclutamiento_01_solicitudes.sql.
-- Consulta pública limitada al estado más reciente, sin datos del expediente.
begin;
create index if not exists rec_postulaciones_dni_fecha
  on public.rec_postulaciones ((datos->>'dni'), created_at desc, id desc);

create or replace function public.rec_consultar_estado(p_dni text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    raise exception 'Ingresa un DNI de 8 dígitos' using errcode='22023';
  end if;
  select jsonb_build_object('estado', estado, 'created_at', created_at, 'updated_at', updated_at)
    into v_resultado
    from public.rec_postulaciones
    where datos->>'dni' = p_dni
    order by created_at desc, id desc limit 1;
  return v_resultado;
end;
$$;
revoke all on function public.rec_consultar_estado(text) from public;
grant execute on function public.rec_consultar_estado(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
```

## 3. Verificar función, permisos y protección de tablas

Ejecutar en SQL Editor después de 03:

```sql
select to_regprocedure('public.rec_consultar_estado(text)') as funcion,
       has_function_privilege('anon', 'public.rec_consultar_estado(text)', 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', 'public.rec_consultar_estado(text)', 'EXECUTE') as authenticated_execute;

select p.prosecdef as security_definer, p.proconfig,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p
where p.oid = 'public.rec_consultar_estado(text)'::regprocedure;

select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('rec_postulaciones','rec_curriculos');
```

Esperado: función presente; ambos `execute=true`; `security_definer=true`; `search_path` vacío; ambas tablas con `rls=true` y ambos `select=false`. La definición debe construir únicamente `estado`, `created_at`, `updated_at`.

Comprobar exposición HTTP desde PowerShell con la misma clave **pública** del frontend:

```powershell
$recHeaders = @{ apikey = 'sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub' }
$recEndpoint = 'https://xadxmfgdxwplmhijagix.supabase.co/rest/v1/rpc/rec_consultar_estado'
try {
  Invoke-RestMethod -Method Post -Uri $recEndpoint -Headers $recHeaders `
    -ContentType 'application/json' -Body '{"p_dni":""}'
} catch {
  $_.ErrorDetails.Message
}
```

Esperado: error de validación `22023`, «Ingresa un DNI de 8 dígitos», **no PGRST202**. Si continúa PGRST202, comprobar que se ejecutó en el proyecto indicado y ejecutar `NOTIFY pgrst, 'reload schema';` de nuevo. Verificar que `public` sea un esquema expuesto en la configuración de la API antes de cambiar configuración.

## 4. Prueba integral pendiente con una postulación autorizada

1. Usar una postulación sintética identificada claramente como prueba, con documento de prueba acordado y CV ficticio; o una postulación de prueba ya autorizada. No usar el documento de otra persona. La sesión actual no dispone de un registro de prueba identificado.
2. Abrir https://www.kjadmb.com/reclutamiento.html y el modal **Ver estado de postulación**. Consultar el DNI autorizado. Comprobar indicador, estado inicial y fechas. Abrir Network para revisar la respuesta de `rec_consultar_estado`.
3. Entrar con una cuenta administrativa autorizada en Administración → Solicitudes/Reclutamiento. Buscar exclusivamente la prueba, cambiar `Pendiente` a `En revisión` y guardar. No modificar otras postulaciones.
4. Cerrar y abrir el modal público, volver a consultar el mismo DNI y comprobar `En revisión`; `created_at` debe conservarse y `updated_at` reflejar el guardado. Si hay varias postulaciones del mismo DNI, la consulta devuelve la más reciente.
5. En Network, la respuesta JSON debe contener **exactamente** `estado`, `created_at`, `updated_at`. No debe incluir datos, nombre, código, correo, teléfono, CV ni notas internas. Guardar evidencia sin capturar DNI ni datos privados.
6. Comprobar en móvil y escritorio: carga visible, cierre por X/Escape/fondo, limpieza al cerrar y foco devuelto al botón. Con respuesta demorada más de 12 segundos, el aviso debe aparecer sin una segunda petición. Con movimiento reducido, el círculo debe dejar de girar.

Para verificar automáticamente las claves de la respuesta pública después de la prueba, ejecutar en la misma consola PowerShell:

```powershell
$recDniPrueba = Read-Host 'DNI de la postulación de prueba autorizada'
$recBody = @{ p_dni = $recDniPrueba } | ConvertTo-Json -Compress
$recRespuesta = Invoke-RestMethod -Method Post -Uri $recEndpoint -Headers $recHeaders `
  -ContentType 'application/json' -Body $recBody
if ($null -eq $recRespuesta) { throw 'No se encontró la postulación de prueba' }
$recClaves = @($recRespuesta.PSObject.Properties.Name | Sort-Object)
if (($recClaves -join ',') -ne 'created_at,estado,updated_at') {
  throw ('Respuesta pública inesperada: ' + ($recClaves -join ','))
}
$recRespuesta | Select-Object estado, created_at, updated_at
```

Repetir antes y después del cambio administrativo. Esto valida la salida HTTP, pero no sustituye la comprobación visual del modal.

## Estado de cierre

- Fusión: completada.
- Despliegue Vercel y archivos públicos: comprobados.
- Migración remota: **pendiente de ejecución por quien tenga acceso a Supabase**.
- Prueba integral y visual remota: **pendiente**.
- Privacidad: comprobada en código y PostgreSQL local; lectura directa de postulaciones remotas denegada. Salida remota de la RPC pendiente hasta activar la función.
