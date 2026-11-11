# KJA-032 — editor de evidencias bajo demanda

El editor consulta los metadatos completos de la entrega sin firmar ni descargar miniaturas. Cada archivo guardado muestra un botón Ver archivo. Al pulsarlo, solicita una firma nueva de 900 segundos y carga únicamente esa vista previa; los documentos siguen ofreciendo un enlace privado. Las imágenes nuevas seleccionadas localmente conservan su vista inmediata.

Las URLs de consulta no se escriben en existingFiles: esa lista mantiene las referencias de guardado completas. Una nueva renderización descarta las vistas anteriores y vuelve a mostrar los botones; consultar otra vez exige nueva firma. Los errores ofrecen reintento sin retirar archivos del modelo ni impedir conservarlos. El cierre, cambio de cuenta/rol, una nueva apertura o retirar el archivo de la selección descartan respuestas tardías.

No cambia la lógica de subir, reemplazar o eliminar. Guardar conserva todos los p_conservar_paths que el usuario no haya retirado, incluido existingVideoPath; no es necesario abrir miniaturas para conservar archivos. La × de Facebook mantiene su confirmación y operación protegida original. En RPE/asignados la retirada sigue perteneciendo al reemplazo al guardar. Las correcciones históricas continúan abriendo una entrega vacía sin reutilizar archivos anulados.

## Base y activación

Preparado sobre 1b88e9a del PR #181. Integrar primero #181 y después este lote. Solo frontend: dashboard.html, dashboard.js y daily-editor-demand.css. No necesita migración ni cambia permisos, horarios, estados de revisión o Storage. Para revertir, volver esos archivos a la base de este PR sin tocar registros ni evidencias.

Después de publicar, probar una cuenta real: abrir editor, consultar una imagen y un documento, añadir reemplazo, revisar los archivos retenidos y el video. Cualquier prueba de guardado o eliminación real requiere la acción explícitamente autorizada del usuario; no se realizó en este avance.

## Validación

36/36 pruebas específicas y relacionadas: carga sin Storage, firma individual/TTL, error/reintento, imágenes nuevas locales, documento privado, respuestas tardías, fallo de metadatos, conservación completa al guardar sin vistas y exclusión únicamente del archivo elegido. Las pruebas existentes de eliminación con confirmación, documentos, corrección y selección de formato siguen aprobadas.

Suite ampliada de cierres/Facebook:93/104 tanto en base1b88e9a como con cambios; mismos once fallos previos, sin nuevos. Evidencia local output/kja-032/editor-demand-comparison.json y TAP respectivos.

Ensayo en navegador acoplado con HTML/CSS y funciones reales, datos y Storage ficticios: ocho tarjetas, cero firmas y cero imágenes privadas al abrir; pulsar Ver archivo6 produjo una firma y una imagen. Los ocho archivos permanecieron disponibles. Escritorio1440x900 y móvil390x844; galería dentro del ancho. No se pulsaron × ni Guardar en el navegador. El payload de guardado se verificó en pruebas con backend ficticio: conserva rutas y video, y distingue los reemplazos nuevos. Fuente local del ensayo output/kja-032/servidor-editor-demanda.cjs, resultado editor-demanda-browser.json.

El beneficio depende de cuántas vistas consulte la persona. Abrir el editor para cambiar un comentario o añadir una captura ya no descarga todas las anteriores. Consultarlas todas sigue requiriendo sus bytes. No se midió ahorro mensual ni se acredita solución al pico de la1p.m.; el tamaño de Storage no se reduce.
