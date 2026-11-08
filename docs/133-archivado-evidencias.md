# Retiro de archivos con historial conservado

El archivado conserva las filas de asistencia, entregas, adjuntos, cantidades y revisiones. No usa las RPC de eliminar evidencias: esas operaciones pueden anular una entrega o reiniciar su revisión.

La tabla privada `asis_archivos_archivados` registra bucket, ruta original, ID del objeto, bytes, SHA-256, identificador del respaldo y fechas. Solo servicio puede escribir o leerla directamente. `dash_archivo_archivado` expone únicamente el estado de retiro a quienes ya podían ver el archivo, replicando las políticas de cada bucket.

El visor intenta abrir el archivo normalmente. Si no puede, consulta el estado autorizado. Solo una confirmación expresa del servidor muestra «Presentado · Archivo retirado por el sistema». Un error de red, falta de permisos o archivo desconocido sigue siendo un error. El aviso aclara que la revisión original se conserva: no convierte pendientes u observaciones en aprobaciones.

## Orden de operación

1. Exportar inventario de Storage, definición de buckets y registros de entregas/adjuntos/asistencia/solicitudes a una carpeta privada fuera del sitio y de Git.
2. Ejecutar `scripts/backup-storage.mjs DIRECTORIO` con `KJA_ARCHIVE_SERVICE_KEY` solo en el entorno del proceso. Descarga exclusivamente del proyecto KJA fijo; no hace borrados. Reanuda archivos válidos, compara tamaños y ETag MD5 cuando existe, genera SHA-256 y un manifiesto.
3. Exigir manifiesto completo y volver a verificar localmente los hashes antes de retirar. Revisar los objetos actuales y excluir nuevos, modificados o con referencias posteriores al corte.
4. Aplicar migración 133 y publicar los visores con caché renovada antes del retiro.
5. Registrar el respaldo verificado, retirar mediante Storage API (nunca borrando filas de `storage.objects` por SQL), confirmar ausencia del objeto y registrar `retirado_at`.
6. Comparar las filas de negocio afectadas antes y después; no debe cambiar ningún estado, cantidad ni revisión como consecuencia del archivado.

## Corte autorizado en esta operación

Hasta el 31 de octubre de 2026 inclusive, zona America/Lima: límite exclusivo `2026-11-01T05:00:00Z`. Se revisan tanto creación como última modificación. Buckets de evidencias: `asis-evidencias`, `asis-cierre-evidencias`, `solicitud-evidencias`. Chat, marketing, perfiles y contratos se respaldan, pero no se retiran.

## Recuperación

El manifiesto conserva ruta de origen, bucket, tipo MIME, tamaño, hash y ruta local. Para recuperar un archivo, verificar el SHA-256 local y subirlo mediante Storage API al bucket y ruta originales con el MIME original. No sobrescribir un archivo existente sin investigar su versión. Tras comprobar su lectura, retirar la marca `retirado_at` mediante una operación administrativa controlada. Las referencias originales siguen existiendo y no requieren reconstruirse.

El respaldo contiene información privada. No guardarlo en carpetas publicadas ni incluir claves, URLs firmadas o datos personales en Git. El resumen de Storage muestra un promedio del ciclo, por lo que no necesariamente bajará al instante hasta el tamaño actual.
