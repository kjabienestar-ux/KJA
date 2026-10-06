# Días libres: extensión del dashboard

- **Modo:** operate. Adición local al flujo existente; no establece una identidad visual nueva ni cambia `DESIGN.md`.
- **Identidad heredada:** espacio personal del dashboard, superficie clara, texto azul oscuro, acento azul y tipografía heredada. El anuncio vive en «Tu bienestar», junto a Pausas activas; conserva el modal de solicitudes existente. Su composición usa imagen y texto en dos columnas, bordes suaves y foco visible.
- **Imagen:** `images/dashboard/dias_libres.png`, recurso suministrado para este anuncio, sin generación ni sustitución. El HTML declara dimensiones de 1254 × 1254 y texto alternativo; no se infiere autoría ni licencia adicional.
- **Acción:** «Elegir mi día» abre la solicitud de una sola fecha. El calendario permite martes o viernes futuros, hasta 180 días adelante; bloquea días no laborables, descansos asignados y solicitudes pendientes o aprobadas. Dirección debe aprobar la solicitud.
- **Visibilidad y saldo:** el anuncio se muestra al colaborador con saldo disponible. Dirección agrega saldo desde Colaboradores; asignar directamente un descanso no agrega saldo. Solicitar reserva saldo, aprobar lo descuenta y rechazar libera la reserva. También existe entrada desde Mi asistencia.
- **Alcance de revisión:** lectura de `dashboard.html` (`rail-days-off`), `assets/css/paginas/dashboard-days-off.css` y `docs/93-solicitar-dias-libres.md`. Navegador no disponible en esta revisión: sin validación visual renderizada. Dictamen del revisor de código: entrega funcional limitada a este alcance; no constituye aprobación visual del dashboard completo.

## Refinamiento del anuncio

La imagen completa ahora tiene un ancho máximo de 168 px. El saldo usa Fraunces, compartida con Pausas activas, y la acción ocupa una fila inferior azul de al menos 44 px. La fecha elegible y el requisito de aprobación se leen por separado. Se heredan el azul #09244c y el texto secundario #526174 del módulo de bienestar. Incluye foco visible, adaptación móvil y respeto a movimiento reducido. Cambio exclusivamente visual; no requiere otra migración SQL. Revisión basada en la captura suministrada y el código; pendiente de comprobación renderizada.

## Dirección vigente: conservar la composición original

El usuario prefirió la primera versión y rechazó el título serif y la franja azul inferior. La versión vigente vuelve a imagen completa a la izquierda, saldo en Inter a la derecha y enlace «Elegir mi día» dentro de la columna de texto. Se afinan la separación de 18 px, el interlineado, un divisor fino antes de la acción y una flecha SVG consistente. La imagen recupera su protagonismo. Esta especificación reemplaza el refinamiento anterior. CSS v3; sin cambios de lógica o SQL. Validación renderizada pendiente por falta de navegador disponible.

## Calendario y contraofertas (migración 94)

La regla vigente incluye martes, miércoles, jueves y viernes. El calendario del modal de días libres ocupa una fila propia en el flujo del formulario, con fechas legibles y selección persistente; no flota sobre el comentario. Dirección puede aprobar, rechazar o proponer otra fecha con motivo. La propuesta aparece en bienestar e historial incluso sin saldo disponible, con aceptación/rechazo explícitos. Mantiene una única reserva hasta resolverla. Pruebas locales de SQL y JavaScript aprobadas; revisión de código sin bloqueos materiales. Sin validación visual renderizada. Los tamaños y colores del formulario siguen el módulo existente; avisos del detector sobre la escala global se documentan como ajustes locales.

## Bandeja agrupada de Dirección (96)

Una fila por envío de días libres, con nombre, fechas y cantidad pendiente. «Revisar» abre un diálogo nativo con foco contenido y cierre mediante Escape. El comentario aparece una vez y cada fecha ofrece aprobación, rechazo o contraoferta; las fechas resueltas siguen visibles durante la revisión. El título usa Inter y las superficies claras, bordes suaves y colores de estado del dashboard. La migración identifica lotes nuevos y recupera envíos anteriores por timestamp exacto de transacción. Pruebas locales aprobadas; falta validación visual renderizada.

## Revisión 97: historial compacto y evidencia previa

Los estados dejan de ocupar varias filas en bienestar: un único acceso abre Mis solicitudes en diálogo nativo, destacando propuestas por responder. El calendario muestra superficies verdes para disponibles, azul sólido para elegidos y tachadura sobre fechas no disponibles, acompañados de leyenda textual y nombre accesible. Se exige un comprobante privado de la solicitud previa por envío. Dirección abre la imagen en otro diálogo nativo sobre la revisión para conservar foco y visibilidad. Las solicitudes históricas siguen válidas. Las pruebas SQL de permisos, rutas y evidencia única pasaron; no hay comprobación visual renderizada. La paleta y tipografía heredan el dashboard; las advertencias del detector sobre Inter y escalas globales no implican cambiar la identidad.
