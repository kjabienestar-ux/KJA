# KJA-032 — primer lote del portal de colaboradores

El detalle de un día ya muestra un archivo por vez, pero antes solicitaba al abrir los enlaces de todos los adjuntos. Ahora conserva los metadatos completos y solicita la firma solo para el archivo seleccionado, con la vigencia original de 3600 segundos. Cambiar de archivo o volver a él exige una firma nueva; la ampliación usa la firma del archivo visible. El servidor sigue comprobando acceso; no se cambian políticas ni permisos.

El estado archivado se consulta a través del ayudante existente y solo se muestra tras confirmación autorizada. Un error de firma muestra un error, conserva los controles de navegación y no se interpreta como archivado. Cambiar fecha, cuenta, rol o cerrar el modal invalida respuestas pendientes. Se conservan todas las actividades, recuentos, estados y reglas para justificar, marcar o presentar evidencias.

El historial ya estaba limitado por mes: no se agrega un recorte de registros. Diez consultas simultáneas del mismo usuario y mes comparten una lectura en curso. No hay caché persistente de resultados: otra visita vuelve a consultar. Las tres rutas actuales que refrescan después de guardar entrada/salida o completar una entrega fuerzan una solicitud nueva, aunque hubiera otra anterior en curso. Una respuesta vieja no reemplaza otro mes o cuenta.

## Validación

- Siete pruebas específicas de firmas y lecturas: ocho adjuntos preparan una sola firma al abrir; navegación y regreso renuevan autorización, respuestas tardías se descartan y un archivo fallido conserva navegación. Lecturas coincidentes se agrupan; las posteriores a escrituras no reutilizan respuestas previas. Errores permiten reintentar.
- Calendario: 26/26 pruebas existentes aprobadas. Conjunto de cierres, carga e historial personal ampliado: 66/77; mismos once fallos reproducidos en base1db928a, sin fallos nuevos en la comparación. Evidencia local output/kja-032/comparacion-portal-free.json.
- Navegador acoplado contra fixture local con HTML/CSS y funciones reales, registros y Storage ficticios: escritorio1440x900, ocho adjuntos, contador Firmas1; siguiente archivo Firmas2, una imagen privada visible. Reabrir a390x844 solicita firma nueva (Firmas3), conserva navegación y una imagen privada visible. No es una prueba con una sesión real de colaborador ni de ahorro mensual. Servidor de ensayo local output/kja-032/servidor-ensayos.cjs.

## Publicación y reversión

Publicar dashboard.html y assets/js/dashboard.js juntos mediante PR revisado. No necesita SQL. La galería personal conserva su diseño y no altera la landing pública. Revertir esos dos archivos al merge anterior restaura el comportamiento previo sin tocar datos. Después de publicar, probar una cuenta real de colaborador, navegar entre meses/archivos, comprobar cambios tras guardar una acción ya autorizada y medir solicitudes en recorridos comparables.

No se descargaron ni borraron evidencias reales para este lote. Los ahorros del ensayo son de solicitudes de firma: el visor personal anterior ya mostraba una imagen a la vez; no se atribuye aquí una reducción de ocho a una descargas de imagen. Esa comparación de descargas corresponde al visor administrativo de #177. Quedan por evaluar la galería de comprobante Facebook y las miniaturas del editor: comparten flujos de PDF/edición que se deben conservar antes de modificar su carga.
