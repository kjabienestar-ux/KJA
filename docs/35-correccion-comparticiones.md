# Corrección de comparticiones

Dirección anula la entrega observada y conserva su mensaje en el historial y la notificación. El portal abre un modal con la figura de evidencia rechazada, la observación y el botón para subir nuevas comparticiones.

La autorización se limita a la entrega observada del propio colaborador. Permite corregir después del horario y en fechas anteriores, sin cambiar las marcas de asistencia. El reenvío crea una entrega nueva para la fecha original, pendiente de revisión; los archivos anteriores permanecen privados para auditoría.

## Activación

1. Ejecutar `supabase/dashboard_108_correccion_comparticiones.sql` después de la migración 107 en el proyecto Supabase correspondiente.
2. Desplegar la función actualizada: `supabase functions deploy dash-entrega --project-ref <proyecto>`.
3. Publicar `dashboard.html`, los JS modificados y los nuevos archivos `dashboard-evidence-corrections.js` y `dashboard-evidence-corrections.css`.

Las alertas se consultan al ingresar y al actualizar las notificaciones (Realtime cuando esté disponible, con respaldo cada 30 segundos). No interrumpen una carga ni otro modal. “Lo haré después” registra que se vio el aviso y mantiene un acceso en Inicio hasta resolverlo. Leer o eliminar una notificación no elimina la corrección pendiente.

## Verificación

`node --test tests/evidence-corrections.test.mjs tests/evidence-corrections-sql.test.mjs tests/facebook-unavailable.test.mjs tests/facebook-delete.test.mjs tests/daily-close-loading.test.mjs`

Las pruebas SQL ejecutan la migración dos veces en PostgreSQL local (PGlite), comprueban el aviso generado por el trigger existente, autorización, anulación, conservación de archivos, fecha original, nuevo envío pendiente, rechazo de duplicados y sesión vencida.

Al activar: solicitar corrección con una cuenta de Dirección, abrir el portal del colaborador, posponer el aviso, retomarlo desde Inicio y enviar nuevas capturas. Repetir con una entrega de un día anterior y con salida registrada. Validar en 360 px y escritorio.

El 8 de octubre de 2026, el usuario confirmó la ejecución de la migración 108 y el despliegue de `dash-entrega` en `xadxmfgdxwplmhijagix`. Falta publicar el frontend y verificar el flujo en el portal.
