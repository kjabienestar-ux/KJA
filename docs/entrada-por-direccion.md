# Registrar la entrada de un colaborador desde Dirección

En **Administración → Pasar lista → Registrar entrada por colaborador**,
Dirección selecciona cualquier colaborador activo, la fecha, la hora real de
entrada en Lima, Presencial o Virtual, una foto/captura y el motivo del registro.
También puede abrir el formulario desde la fila de una persona sin entrada.

La fecha no puede ser futura ni anterior al contrato. El día debe tener una
jornada laboral con horario de entrada y salida; si no existe, configurar
primero la jornada o excepción mediante las herramientas administrativas.
Se calcula P/T según la hora declarada y la tolerancia del servidor.

El registro es administrativo: `origen='panel'`, `marcado_por` identifica a
Dirección y `marcado_at` conserva la hora declarada. La tabla privada
`asis_entradas_direccion` conserva motivo, responsable, hora de carga/confirmación,
modalidad, evidencia y registro vinculado. No se usa el GPS del administrador
ni se presenta el registro como ubicación verificada del colaborador.
La modalidad confirmada sincroniza solo esa fecha mediante la migración 73.

Se bloquea cualquier entrada ya existente, incluso si se creó durante la carga.
No reemplaza evidencias ni horarios. Ante una respuesta de red incierta, el
botón **Comprobar registro** consulta el mismo intento, sin repetir la carga.
Los permisos de carga vencen a los 15 minutos; cada carga utiliza una ruta única.

## Activación

Con las migraciones anteriores hasta la 71 ya instaladas, ejecutar en orden:

1. `supabase/dashboard_72_modalidad_reportes.sql`
2. `supabase/dashboard_73_modalidad_dia_marcada.sql`
3. `supabase/dashboard_74_entrada_direccion.sql`

Después desplegar la versión del repositorio de la Edge Function `dash-evidencia`
en el proyecto Supabase habitual (por ejemplo, con el CLI configurado:
`supabase functions deploy dash-evidencia`). Mantener la autenticación existente.
No requiere nuevos secretos: usa los mismos SUPABASE_URL, SUPABASE_ANON_KEY y
SUPABASE_SERVICE_ROLE_KEY de la función actual.

Finalmente publicar `dashboard.html`, `assets/js/dashboard.js`, el nuevo archivo
`assets/js/dashboard-admin-entrada.js` y `assets/css/paginas/dashboard.css`.
La función anterior de evidencia personal conserva su contrato.
El formulario detecta un servicio antiguo sin permiso administrativo y no
sube la imagen a la asistencia personal de Dirección.

Si aparece «Tu sesión venció» después de instalar el SQL, comprobar también la
versión desplegada de `dash-evidencia`: la versión antigua llama al permiso de
evidencia personal, que devuelve `sesion` para cuentas sin colaborador vinculado.
En Supabase → Edge Functions → dash-evidencia, reemplazar el código por
`supabase/functions/dash-evidencia/index.ts` y desplegarlo. Publicar el frontend
actualizado para distinguir una cuenta aún autenticada de ese rechazo del servicio.

## Verificación

- `node --test tests/admin-entry.test.mjs`: formulario, conservación de archivos,
  reintentos, permisos y compatibilidad de la función de evidencia.
- `node tests/admin-entry-sql-check.mjs <ruta-a-pglite/dist/index.js>`:
  SQL real en base aislada: autorización, fecha, modalidad, P/T, evidencia,
  auditoría, idempotencia, duplicados, vencimiento y sincronización diaria.
- Revisar en móvil/escritorio tras publicar y confirmar un registro de prueba
  autorizado. Las pruebas aisladas no acreditan despliegue ni acceso a producción.
