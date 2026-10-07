# Cambiar evidencias de Facebook desde Dirección

En Administrador → calendario mensual → detalle de un día → Comparticiones de Facebook, Dirección puede quitar cada imagen tras confirmar. Cuando retira todas, aparece «Subir nuevas evidencias». Seleccionar las imágenes inicia la carga para esa misma persona y fecha. Los demás roles conservan la consulta sin controles de edición.

La eliminación usa la cola de limpieza de Storage de la migración 63. Si falla Storage, se conserva el objetivo para reintentar con «Eliminar imagen». Al quitar la última imagen se anula la entrega; al cargar las nuevas se crea una entrega con la auditoría existente de Dirección. Las eliminaciones registran actor, colaborador, fecha, entrega y ruta en `asis_facebook_retiros_direccion`. No se modifica la entrada ni la salida.

La carga mantiene las reglas existentes: colaborador activo, fecha dentro de los últimos 180 días, comparticiones programadas y cantidad de imágenes configurada (máximo 50). Los archivos de cargas fallidas quedan sujetos a la limpieza de permisos vencidos existente.

## Activación

1. Ejecutar `supabase/dashboard_102_retirar_facebook_direccion.sql`.
2. Desplegar la Edge Function `dash-entrega` actualizada.
3. Publicar los archivos del portal actualizados.

La implementación y las pruebas son locales; no se ejecutaron estos pasos en Supabase remoto.
