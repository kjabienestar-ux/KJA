# Reclutamiento: formularios y revision de expedientes

## Expediente administrativo: revisión visual e interacción

El detalle de la postulación presenta la identidad, especialidad, estado guardado y fecha de recepción en una cabecera fija. El cuerpo separa contacto, disponibilidad, entrevista solicitada, CV y comentarios del candidato de la revisión interna. Los datos técnicos del registro permanecen en un desplegable. El CV tiene su descarga junto al nombre; un tamaño ausente se muestra como «Documento adjunto».

En escritorio se usa una ventana de hasta 1060 px con columna lateral de revisión. En pantallas de hasta 820 px se apilan las secciones y se incorporan accesos para saltar entre datos y revisión. Cabecera y acciones permanecen visibles mientras el contenido se desplaza. Los correos y el teléfono permiten iniciar el contacto desde la aplicación correspondiente.

El guardado se habilita al cambiar estado o notas, muestra el progreso y actualiza el estado visible solo tras recibir la respuesta. Un fallo conserva las ediciones y permite reintentar. Durante el guardado se impiden cierres y solicitudes duplicadas. Se aclara que guardar no envía correos.

Verificación: ocho pruebas de bandeja y detalle aprobadas con Node 24. Render y guardado simulados en Chromium a 1440 × 960, 390 × 844 y 599 × 729, sin errores JavaScript ni desbordamientos en el diálogo; acciones visibles en las tres dimensiones. Las capturas usan un candidato ficticio: [escritorio](images/reclutamiento-detalle-desktop.png) y [móvil](images/reclutamiento-detalle-movil.png). No se modificaron expedientes reales. El detector informó avisos de tamaños, radios y colores respecto del sistema global; se conserva el lenguaje visual de la bandeja existente.

## Alertas de formularios (octubre de 2026)

Los errores aparecen debajo de cada campo, con borde, texto, `aria-invalid` y `aria-describedby`. Se validan al salir del campo y se actualizan al corregirlo. Al continuar aparece un resumen con enlaces a los campos pendientes y el foco pasa al primero.

Se comprueban DNI de ocho dígitos, correos, teléfonos de 9 a 15 dígitos con formato internacional, requisitos, fecha y CV obligatorio. Se aceptan PDF, DOC y DOCX con contenido, de hasta 10 MB. La zona del CV admite Enter y espacio. Los errores de envío reciben foco y conservan datos y archivo para reintentar con el mismo identificador.

En móvil se evita el recorte de controles y se usan inputs de 16 px. Verificación: escritorio de 1365 px y móvil de 390 px sin errores JavaScript ni desbordamiento horizontal. Capturas: `.impeccable/review/recruitment-validation/`. Las siete pruebas de `tests/recruitment-validation.test.mjs` pasan con Node 24; el Node 20.10 predeterminado no es compatible con las dependencias actuales de jsdom. El envío se simuló sin registrar postulaciones reales. El detector de diseño funcionó en modo degradado por falta de parsers e informó diferencias con el sistema global y estilos existentes.
