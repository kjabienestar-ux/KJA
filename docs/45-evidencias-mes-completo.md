# Evidencias de RPE y salida en Mes completo

Administración → Mes completo → día de una persona permite a Dirección quitar cada archivo de RPE y de evidencia de salida. El botón × pide confirmación dentro de la actividad. Al retirar todos sus archivos se anula la entrega y aparece **Subir nuevas evidencias** para cargar el reemplazo.

- RPE admite de 1 a 5 imágenes; salida admite una imagen y requiere la hora visible en la evidencia.
- Los reemplazos reutilizan los permisos y validaciones administrativos existentes: colaborador activo, fecha dentro de los últimos 180 días y requisito habilitado para esa jornada. Los días justificados y el RPE presencial exento mantienen sus restricciones.
- Retirar archivos conserva las marcas, horas y metas contractuales. La entrega queda pendiente de revisión si conserva archivos. La carga administrativa mantiene el mecanismo vigente de aprobación y regularización de cierres.
- Facebook conserva su flujo. La evidencia de entrada y las actividades asignadas no se modifican con este cambio.
- Después de guardar o retirar se recargan el detalle y el mes. Si falla Storage, el botón de confirmación permite reintentar; las cargas administrativas posteriores de esa persona también intentan completar la limpieza pendiente.

## Controles de la interfaz

La extensión reutiliza los controles y estilos del detalle existente. Cada archivo gestionable tiene un botón × con nombre accesible que identifica el archivo y la actividad. La confirmación aparece dentro de esa actividad, explica la eliminación y la conservación de marcas y horas, y lleva el foco inicialmente a **Cancelar**.

El selector de **Subir nuevas evidencias** conserva un input de archivo accesible por teclado; su etiqueta muestra un contorno con `:focus-within`. La carga comienza al seleccionar los archivos. Para salida, el campo **Hora visible en la evidencia** se presenta antes del selector, admite ajuste de línea y hereda la tipografía y el color de su contenedor. Estos controles amplían la interfaz actual sin cambiar el sistema visual global.

## Activación

1. Ejecutar `supabase/dashboard_115_retirar_evidencias_direccion.sql` después de la migración 114.
2. Desplegar `supabase/functions/dash-entrega/index.ts` con `supabase functions deploy dash-entrega` para el proyecto correspondiente.
3. Publicar los archivos web modificados. `dashboard.html` incrementa sus versiones de caché.

La migración crea una RPC exclusiva de Dirección, una auditoría de retiros y una cola privada de eliminación. No modifica evidencias existentes al instalarse. Las rutas que elimina Storage proceden de la RPC autorizada, no directamente de la petición del navegador.

## Verificación local

Pruebas de UI simulada y PostgreSQL con PGlite: permisos, pertenencia de archivos, rutas compartidas, auditoría, borrado parcial/total, reintento, conservación de horas, límites de carga, hora de salida, confirmación y doble clic. Ejecutar:

```powershell
node --test tests/month-day-detail.test.mjs tests/admin-evidence-delete.test.mjs tests/admin-evidence-edge.test.mjs tests/admin-facebook-delete.test.mjs tests/team-day-detail.test.mjs tests/month-progress.test.mjs tests/facebook-delete.test.mjs
```

Resultado informado por el agente principal: **45 pruebas pasan**. La revisión independiente de entrega (`ship`) no encontró hallazgos materiales.

La validación visual en navegador y el ensayo conectado a Supabase quedan pendientes; no había navegadores disponibles en la sesión de implementación. La revisión independiente tampoco incluyó validación visual. La migración y el despliegue no se ejecutaron sobre producción.

## Ajuste de sesión al solicitar evidencias

Ante un rechazo HTTP 401, el navegador renueva la sesión y reintenta una sola vez con el nuevo token y la misma petición. No reintenta automáticamente errores de permisos, migración ni borrados parciales. Si durante la renovación cambia la cuenta, cancela la operación. Un segundo rechazo tras renovar muestra un error de validación del servidor, sin afirmar que la sesión venció.

Este ajuste solo requiere publicar `dashboard.html` y `assets/js/dashboard-month-day-detail.js` (versión de caché 10); no añade SQL ni cambios a la función Edge. El usuario confirmó haber aplicado previamente la migración y desplegado la función. La causa exacta del rechazo en producción no se pudo reproducir localmente. Pasaron 30 pruebas de sesión, detalle y borrado, incluidas las siete nuevas en `tests/month-evidence-session.test.mjs`.
