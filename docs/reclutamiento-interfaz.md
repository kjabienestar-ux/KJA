# Reclutamiento: formularios y revision de expedientes

## Rediseño de la bandeja y vista previa del CV (octubre de 2026)

Aplica a `dashboard.html` (Dirección) y `admin.html` (administración), que comparten `dashboard-reclutamiento.js` y `reclutamiento-bandeja.css`. El resumen es un embudo: total recibido, etapas Pendientes → En proceso → Aprobadas con su porcentaje y una barra apilada por estado (el resto corresponde a No seleccionado). Una barra de títulos guía las columnas (Postulante, Entrevista solicitada, Estado, Acción). Cada postulante se muestra como una tarjeta con un tinte muy suave del color de su estado, avatar con color estable, especialidad, modalidad y turno abreviados, un mini calendario de la entrevista, la recepción relativa («hace 3 d», con la fecha completa al pasar el cursor) y un botón que indica la siguiente acción: Revisar (Pendiente, destacado), Continuar (En revisión), Coordinar (Entrevista) o Ver expediente (Aprobado y No seleccionado). En móvil el botón ocupa todo el ancho al pie de la tarjeta. Correo, DNI y código quedan en el expediente. El filtro de la bandeja y el estado del expediente usan un desplegable propio (botón + `listbox`, manejable con teclado) con un punto del color de cada fase y una marca en la opción elegida, en lugar del `<select>` nativo; el filtro muestra además el número por estado.

Mientras llegan las solicitudes, la bandeja muestra un esqueleto animado (contadores y filas con la forma del contenido). Los refrescos automáticos y el que sigue a guardar una revisión no vacían la tabla.

«Ver CV» muestra el PDF en un visor dentro del mismo diálogo, sin cambiar su tamaño (hasta 1060 × 880 px), y la revisión interna sigue a la derecha (debajo en móvil). El archivo se pide una sola vez y se reutiliza para descargar o abrir en otra pestaña. DOC y DOCX solo se descargan. Al volver, cerrar o cerrar sesión se libera el archivo. Si `rec_descargar_cv` responde «CV no disponible» (no hay fila en `rec_curriculos` para ese expediente), se explica que el expediente no tiene CV guardado, sin ofrecer reintento.

**Migración opcional:** `supabase/reclutamiento_04_conteo_por_estado.sql` hace que el filtro muestre también el número de En revisión, Entrevista y No seleccionado. No es necesaria: sin ella la bandeja, el embudo y el expediente funcionan igual, y esos tres estados solo aparecen sin número. Mantiene la firma y los permisos de `rec_listar` y no modifica datos.

## Expediente administrativo: revisión visual e interacción

El detalle de la postulación presenta la identidad, especialidad, estado guardado y fecha de recepción en una cabecera fija. El cuerpo separa contacto, disponibilidad, entrevista solicitada, CV y comentarios del candidato de la revisión interna. Los datos técnicos del registro permanecen en un desplegable. El CV tiene su descarga junto al nombre; un tamaño ausente se muestra como «Documento adjunto».

En escritorio se usa una ventana de hasta 1060 px con columna lateral de revisión. En pantallas de hasta 820 px se apilan las secciones y se incorporan accesos para saltar entre datos y revisión. Cabecera y acciones permanecen visibles mientras el contenido se desplaza. Los correos y el teléfono permiten iniciar el contacto desde la aplicación correspondiente.

El guardado se habilita al cambiar estado o notas, muestra el progreso y actualiza el estado visible solo tras recibir la respuesta. Un fallo conserva las ediciones y permite reintentar. Durante el guardado se impiden cierres y solicitudes duplicadas. Se aclara que guardar no envía correos.

Verificación: ocho pruebas de bandeja y detalle aprobadas con Node 24. Render y guardado simulados en Chromium a 1440 × 960, 390 × 844 y 599 × 729, sin errores JavaScript ni desbordamientos en el diálogo; acciones visibles en las tres dimensiones. Las capturas usan un candidato ficticio: [escritorio](images/reclutamiento-detalle-desktop.png) y [móvil](images/reclutamiento-detalle-movil.png). No se modificaron expedientes reales. El detector informó avisos de tamaños, radios y colores respecto del sistema global; se conserva el lenguaje visual de la bandeja existente.

## Alertas de formularios (octubre de 2026)

Los errores aparecen debajo de cada campo, con borde, texto, `aria-invalid` y `aria-describedby`. Se validan al salir del campo y se actualizan al corregirlo. Al continuar aparece un resumen con enlaces a los campos pendientes y el foco pasa al primero.

Se comprueban DNI de ocho dígitos, correos, teléfonos de 9 a 15 dígitos con formato internacional, requisitos, fecha y CV obligatorio. Se aceptan PDF, DOC y DOCX con contenido, de hasta 10 MB. La zona del CV admite Enter y espacio. Los errores de envío reciben foco y conservan datos y archivo para reintentar con el mismo identificador.

En móvil se evita el recorte de controles y se usan inputs de 16 px. Verificación: escritorio de 1365 px y móvil de 390 px sin errores JavaScript ni desbordamiento horizontal. Capturas: `.impeccable/review/recruitment-validation/`. Las siete pruebas de `tests/recruitment-validation.test.mjs` pasan con Node 24; el Node 20.10 predeterminado no es compatible con las dependencias actuales de jsdom. El envío se simuló sin registrar postulaciones reales. El detector de diseño funcionó en modo degradado por falta de parsers e informó diferencias con el sistema global y estilos existentes.
