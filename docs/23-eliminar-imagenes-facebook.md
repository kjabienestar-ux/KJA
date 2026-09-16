# Eliminar imágenes de Facebook

## Activación

1. Aplicar `supabase/dashboard_63_eliminar_imagen_facebook.sql` después de la migración 62.
2. Desplegar la Edge Function `dash-entrega` actualizada.
3. Publicar el portal actualizado.

Estos pasos no se ejecutaron contra el entorno remoto durante la implementación.

## Uso

En Cierre de mi jornada → Comparticiones de Facebook → Editar, pulsar la × de una imagen guardada. La alerta pide confirmar su eliminación irreversible. Cancelar no hace cambios. Confirmar elimina inmediatamente esa imagen; no hace falta pulsar Guardar cambios. Para imágenes recién seleccionadas y todavía no subidas, la × sólo las quita de la selección local.

El servidor comprueba sesión, propietario, entrega de Facebook y horario de edición. Si queda alguna imagen, conserva la entrega y reinicia su revisión y cantidad declarada. Si se elimina la última, la entrega pasa a anulada y Facebook vuelve a quedar pendiente. Se conserva la cabecera de la entrega por trazabilidad, pero se borran los registros del archivo, incluidos los de versiones anteriores de la misma entrega, el permiso de carga y el objeto de Storage.

## Recuperación

PostgreSQL y Storage no comparten una transacción. Primero se retiran las referencias y se registra una cola privada de limpieza; después la función elimina el objeto usando Storage API. No se borra directamente la tabla storage.objects.

Si Storage falla, la interfaz indica que queda limpieza pendiente y permite reintentar con la misma ×. También se recuperan eliminaciones pendientes del propietario en una posterior solicitud de carga o limpieza a dash-entrega. Hasta terminar una limpieza pendiente en el editor, no se permite guardar una sustitución con esa ruta. Si se cierra el editor, la cola persiste. Enlaces firmados o copias previamente descargadas pueden seguir existiendo fuera del portal.

## Verificación

Pruebas automatizadas del cliente: cancelar, eliminar la última imagen, eliminar una entre varias, rechazo de permisos y fallo de Storage con reintento. Queda pendiente probar en Supabase: un usuario no puede retirar rutas ajenas ni eliminar fuera de horario; la última imagen deja el requisito pendiente; las rutas desaparecen de asis_entrega_archivos y del bucket; una falla de Storage conserva la cola y el reintento la limpia. No se han ejecutado estas pruebas de integración contra la base real.
