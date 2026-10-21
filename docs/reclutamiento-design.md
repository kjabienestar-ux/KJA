# Reclutamiento: portada y desplazamiento

## Seguimiento público de postulación

El resultado del modal presenta estado e icono propios para Pendiente, En revisión, Entrevista, Aprobado y No seleccionado. Las fechas del servidor se separan de una orientación contextual sobre el siguiente paso. No se infieren etapas anteriores, porcentajes ni plazos. Cuando hay un resultado, el formulario pasa a una fila compacta y la explicación inicial se retira visualmente para priorizar el seguimiento. Se conserva el aviso accesible de consulta completada.

El resultado recibe foco programático y anuncia estado y descripción sin dibujar un marco azul alrededor de todo el panel; los controles mantienen sus indicadores de foco. Se conservan cierre, limpieza, respuesta tardía y mensaje de espera. El modal se amplía a 560 px en escritorio y mantiene desplazamiento interno en pantallas pequeñas.

Verificación local: 11 pruebas de interfaz y formulario aprobadas. Chromium comprobó los cinco estados en 1440 × 900, 390 × 844 y 360 × 740, con respuesta simulada, sin errores JavaScript ni desbordamiento horizontal. También comprobó icono, orientación, estados vacío/error, limpieza y devolución del foco. Evidencia: `.impeccable/review/recruitment-status/`. No se consultaron documentos personales, no se modificó SQL y no se publicó esta revisión.

## Portada compacta y acciones (21 de octubre de 2026)

Se retiró la etiqueta «Reclutamiento · KJA» de la portada. El titular se presenta en dos líneas con menor escala, conservando fotografía y acento editorial rosa. En escritorio, la altura se define con `clamp(520px, 68svh, 720px)`; se midieron 612 px para 1440 × 900 y 522 px para 1366 × 768. Los accesos a postulación y consulta se agrupan en una fila: acción rosa y alternativa clara, ambos de 52 px y radio de 12 px. Las modalidades pasan a enlaces con iconos y el menú usa tinta oscura para mantener contraste sobre la imagen.

En móvil se conserva una franja fotográfica corta, los botones se apilan y la altura crece según el contenido. La consulta pública de master se integró en la copia local anterior conservando el formulario existente: diálogo, indicador de carga, transporte y redirección de enlaces antiguos.

Comprobación en Chromium a 1440 × 900, 1366 × 768, 768 × 1024, 390 × 844 y 360 × 740: sin desbordamiento horizontal ni errores JavaScript; acciones dentro de portada, apertura y cierre del modal, limpieza del DNI, retorno de foco y navegación al formulario correctos. La consulta se simuló con una respuesta ficticia; no se enviaron ni modificaron expedientes. Evidencia: `.impeccable/review/recruitment-compact/`. Detector de layout sin hallazgos y recursos locales sin faltantes. Estos cambios son locales; esta revisión no publica ni corrige el SQL remoto.

## Expediente administrativo: revisión visual e interacción

El detalle de la postulación presenta la identidad, especialidad, estado guardado y fecha de recepción en una cabecera fija. El cuerpo separa contacto, disponibilidad, entrevista solicitada, CV y comentarios del candidato de la revisión interna. Los datos técnicos del registro permanecen en un desplegable. El CV tiene su descarga junto al nombre; un tamaño ausente se muestra como «Documento adjunto».

En escritorio se usa una ventana de hasta 1060 px con columna lateral de revisión. En pantallas de hasta 820 px se apilan las secciones y se incorporan accesos para saltar entre datos y revisión. Cabecera y acciones permanecen visibles mientras el contenido se desplaza. Los correos y el teléfono permiten iniciar el contacto desde la aplicación correspondiente.

El guardado se habilita al cambiar estado o notas, muestra el progreso y actualiza el estado visible solo tras recibir la respuesta. Un fallo conserva las ediciones y permite reintentar. Durante el guardado se impiden cierres y solicitudes duplicadas. Se aclara que guardar no envía correos.

Verificación: ocho pruebas de bandeja y detalle aprobadas con Node 24. Render y guardado simulados en Chromium a 1440 × 960, 390 × 844 y 599 × 729, sin errores JavaScript ni desbordamientos en el diálogo; acciones visibles en las tres dimensiones. Las capturas usan un candidato ficticio y están en `.impeccable/review/recruitment-detail/`. No se modificaron expedientes reales. El detector informó avisos de tamaños, radios y colores respecto del sistema global; se conserva el lenguaje visual de la bandeja existente.

## Alertas de formularios (octubre de 2026)

Los errores aparecen debajo de cada campo, con borde, texto, `aria-invalid` y `aria-describedby`. Se validan al salir del campo y se actualizan al corregirlo. Al continuar aparece un resumen con enlaces a los campos pendientes y el foco pasa al primero.

Se comprueban DNI de ocho dígitos, correos, teléfonos de 9 a 15 dígitos con formato internacional, requisitos, fecha y CV obligatorio. Se aceptan PDF, DOC y DOCX con contenido, de hasta 10 MB. La zona del CV admite Enter y espacio. Los errores de envío reciben foco y conservan datos y archivo para reintentar con el mismo identificador.

En móvil se evita el recorte de controles y se usan inputs de 16 px. Verificación: escritorio de 1365 px y móvil de 390 px sin errores JavaScript ni desbordamiento horizontal. Capturas: `.impeccable/review/recruitment-validation/`. Las siete pruebas de `tests/recruitment-validation.test.mjs` pasan con Node 24; el Node 20.10 predeterminado no es compatible con las dependencias actuales de jsdom. El envío se simuló sin registrar postulaciones reales. El detector de diseño funcionó en modo degradado por falta de parsers e informó diferencias con el sistema global y estilos existentes.

## Alcance

La página `reclutamiento.html` incorpora la portada de referencia y el proceso existente de cuatro pasos. Ambas copias locales (Live Server en 5505 y servidor en 3000) contienen la misma página y sus dependencias de reclutamiento.

## Diseño

La fotografía images/reclutamiento/entrevista.webp comienza en el borde superior y continúa detrás de la navegación. No hay un velo blanco horizontal sobre la cabecera. Se conserva el degradado lateral para la lectura, el fondo crema, el titular negro Poppins y el énfasis rosa en DM Serif Display cursiva. La onda blanca solo remata el borde inferior.

Los estilos de portada están aislados en assets/css/paginas/reclutamiento-portada.css, con prefijo .rec-reference-hero. Los formularios conservan `reclutamiento.css` y `reclutamiento-confirmacion.css`. El rosa de display es #ed007a, el de los botones #d00068 y el de navegación #a50052.

La fotografía ilustrativa se generó con la herramienta integrada. Su procedencia y el prompt exacto están en images/reclutamiento/entrevista.webp.json; no representa al personal real de KJA.

## Navegación y flujo

La cabecera conserva el menú compartido del sitio. El botón principal y las modalidades enlazan a #rec-tabs-wrapper. Debajo de la portada están los requisitos, los datos y CV, la agenda y la confirmación. El cliente existente usa `reclutamiento-api.js`; esta modificación no despliega ni verifica el servicio remoto de envío.

El documento admite desplazamiento vertical. Los bloqueos específicos del menú móvil y los modales conservan sus reglas de interacción.

## Validación

La comprobación de render en escritorio y móvil confirmó fotografía con coordenada superior 0, ausencia de velo superior, formulario presente y desplazamiento efectivo hasta 700 px, sin desbordamiento horizontal. Las capturas están en .impeccable/review/recruitment-scroll/. Los recursos locales existen y los scripts pasan la comprobación de sintaxis. No se enviaron postulaciones reales.

El bloque para empresas y su enlace se retiraron por solicitud del usuario. La portada conserva el velo reducido, la navegación publicada y el proceso de postulación existente.
