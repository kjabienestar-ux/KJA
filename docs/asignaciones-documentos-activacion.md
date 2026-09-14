# Activar PDF, Word y PowerPoint en asignaciones

La migración dashboard_55 actualiza PostgreSQL y Storage, pero no despliega la Edge Function que entrega permisos de carga.

1. Ejecutar `supabase/dashboard_55_documentos_asignaciones.sql`.
2. Actualizar la Edge Function **dash-entrega** con `supabase/functions/dash-entrega/index.ts`. Desde la raíz del repositorio:

   ```powershell
   npx supabase@latest functions deploy dash-entrega --project-ref xadxmfgdxwplmhijagix --use-api
   ```

   También puede reemplazarse su código y desplegarse desde Edge Functions en el panel de Supabase.
3. Publicar los archivos web actualizados y recargar el portal.
4. Probar una asignación nueva y una corrección con PDF y DOCX menores a 10 MB.

Diagnóstico: en Network, la petición a `functions/v1/dash-entrega` debe enviar `ext: "pdf"` (o doc/docx) y responder una `ruta` terminada en esa misma extensión. La versión anterior convierte los documentos a `.jpg`; el archivo sube, pero SQL rechaza la combinación de extensión y MIME con `archivo_no_verificado`. La versión web actual detecta esa discrepancia antes de subir y conserva el archivo seleccionado.

Si la extensión ya coincide, comprobar en Storage el MIME y tamaño del objeto rechazado y la versión de las funciones SQL. No ampliar los permisos ni aceptar documentos como imágenes para eludir la validación.
