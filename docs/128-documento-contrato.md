# Documento del contrato

En *Editar colaborador*, el bloque **Contrato** incluye un campo para adjuntar el documento firmado: un PDF o una imagen escaneada (JPG, PNG o WebP) de hasta 10 MB. Cada persona tiene un documento vigente; al reemplazarlo, el anterior se borra. Solo editores y Dirección pueden subirlo, verlo o quitarlo. En la lista de **Contratos** aparece *Ver contrato* bajo la fecha según documento.

## Activación

1. Ejecutar `supabase/dashboard_128_documento_contrato.sql` en el SQL Editor de Supabase, después de dashboard_127. Crea el bucket privado `asis-contratos`, la tabla `asis_contrato_documentos`, sus políticas y tres funciones (`dash_admin_documentos_contrato`, `dash_admin_registrar_documento_contrato`, `dash_admin_quitar_documento_contrato`). No modifica `dash_admin_guardar_ficha` ni `dash_admin_equipo`.
2. En `dashboard.html`, cambiar `window.KJA_CONTRATO_DOCUMENTO=false` a `true`.
3. Publicar el frontend.

Con la bandera en `false` el campo no aparece y el panel no llama a ninguna de las funciones nuevas, así que publicar el frontend antes de ejecutar el SQL no cambia nada en línea.

Para verlo antes de ejecutar el SQL, abrir el panel en localhost con `?contrato=preview` (por ejemplo `http://localhost:3000/dashboard?contrato=preview`). El campo aparece y se puede elegir y ver un archivo, pero no se sube nada. Ojo: el resto de la ficha sí se guarda en Supabase real al pulsar *Guardar cambios*.

## Cómo funciona

- El archivo se elige en la ficha y se sube recién al pulsar *Guardar cambios*. Cancelar no deja archivos sueltos y también funciona con un colaborador nuevo.
- Orden al guardar: ficha → horario de Facebook → subida a `asis-contratos/<colaborador_id>/<uuid>.<ext>` → registro. Si el registro falla, se borra el archivo recién subido. Si el documento no se puede subir, la ficha queda guardada y un aviso pide volver a abrirla.
- *Ver* abre el documento con un enlace firmado que dura 15 minutos; el bucket nunca es público.
- Adjuntar, reemplazar o quitar el documento queda en el historial del contrato, con el motivo del cambio si se escribió.
- Si se elimina definitivamente a un colaborador, su fila del documento se borra con él, pero el archivo queda en el bucket; se puede borrar a mano desde Storage.
