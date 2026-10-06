# Control diario — contexto de implementación

## Alcance y dirección

Modo **Operate**. Prioridad elegida: **Pendientes y acciones por persona**. Rediseño exclusivo de `#admin-control-section` en `dashboard.html`, con comportamiento en `assets/js/dashboard-admin-control.js` y estilos en `assets/css/paginas/dashboard-admin-control.css`. Conserva el mundo institucional KJA, el español directo y los flujos de Dirección definidos en `PRODUCT.md` y `DESIGN.md`. Este brief no sustituye el sistema global ni `.impeccable/design.json`.

## Estructura y aspecto

Bandeja plana, blanca y navy: título breve, exportación y Pausas activas, navegación de fecha, resumen de jornadas/horas, bandejas con recuentos y subrayado activo, filtros y filas separadas por líneas. Cada persona reúne identidad, estado escrito con punto semántico, pendiente/siguiente paso, entrada/salida y acción. Inter, SVG lineal y avatares de iniciales; sin nuevos activos raster.

Tokens locales reales: `--control-ink: #203449`, `--control-muted: #5b6875`, `--control-line: #e1e5e9`, `--control-accent: #174f72`. Superficie blanca, contenedor de 12 px, controles de 7–8 px, sin sombra en herramientas. Foco visible de 2 px; hover sin transformaciones. El detalle usa una entrada de 180 ms y respeta movimiento reducido. Estos valores no redefinen tokens globales.

## Operación

- Inicio en **Por atender**; alternativas **Por revisar**, **Concluidas** y **Todo el equipo**. Recuentos sobre búsqueda/área; situación y orden refinan la lista. Prioridad: correcciones, impedimentos, revisiones, jornadas incompletas, sin entrada y otros pendientes. Búsqueda sin distinción de acentos.
- **Ver detalle** expande una persona en línea: requisitos aplicables, seguimiento, avisos y horas. Distingue evidencia registrada de aprobada y respeta exención de RPE presencial, asignaciones canceladas y jornadas no aplicables.
- **Abrir caso** conduce a Cierres conservando fecha, persona y área disponible. **Revisar** abre allí la revisión de esa persona si existen entregas; mantiene el caso accesible si ya no hay evidencias. Esta bandeja no expone rutas privadas.
- Fecha en America/Lima, limitada entre hoy y los 365 días previos. Exportar vista descarga únicamente las filas filtradas/ordenadas, deshabilita la acción durante carga o sin filas y neutraliza fórmulas CSV.

## Respuesta y datos incompletos

La lista muestra dos columnas de colaboradores por encima de 900 px, en orden de lectura horizontal por filas, y una columna hasta 900 px. El detalle permanece expandido dentro de cada caso. En móvil, el documento recupera desplazamiento natural; hasta 540 px se apila el contenido de cada persona. Las acciones tienen 44 px mínimos hasta 900 px. Mantener etiquetas accesibles, `aria-pressed`, `aria-expanded`, anuncios de estado y foco tras cambios.

La consulta combina control diario, impedimentos y cierres. Las respuestas antiguas no reemplazan una fecha más reciente. Si fallan fuentes auxiliares, muestra **Vista parcial**, abre Todo el equipo y limpia situación para evitar ocultar personas por datos desconocidos; el detalle declara requisitos o impedimentos no disponibles. El fallo principal elimina datos anteriores y ofrece Reintentar. Vacíos permiten volver a Todo el equipo. No interpretar ausencia de detalle como cumplimiento confirmado.

## Validación y límites

Pasan 10 pruebas de comportamiento de Control diario. La revisión previa también comprobó sintaxis, `git diff --check` y las tres correcciones mediante inspección estática. La suite amplia conserva fallos ajenos a este alcance. **No hubo capturas ni aprobación visual en navegador**: la comprobación visual e interacción real en escritorio/móvil siguen pendientes. No se generaron imágenes ni se acredita despliegue.

## Seguimiento por área

Distribución calculada con todas las personas de la fecha, independiente de búsqueda. Categorías exclusivas: por revisar primero, otros pendientes después, concluidas sin pendientes y resto sin pendientes; esta última no acredita jornada completada. Cada segmento filtra exactamente las personas de su categoría y área; el nombre filtra el área completa. Ambas acciones limpian filtros incompatibles y conservan el acceso al caso. `__none` identifica Sin área sin confundirlo con Todas las áreas. Los datos parciales suprimen las barras y explican por qué no está disponible el resumen.

Cabecera y espacio de trabajo compactos: fecha junto al encabezado en escritorio, bandejas y recuento/orden en una fila, explicación secundaria de los casos oculta. El bloque de áreas usa fondo tenue, nombre y total junto al recuento destacado de pendientes, encima de la barra. La rejilla adapta columnas con `repeat(auto-fit,minmax(min(100%,260px),1fr))` y limita su altura desplazable. Hover sutil y selección con fondo/borde interior; segmentos con recuentos, etiquetas accesibles y estado seleccionado. Colores locales: pendientes `#b45147`, revisión `#966c13`, concluidas `#28735e`, sin pendientes `#697d8d`.

Las barras se revelan mediante `clip-path` durante 420 ms únicamente cuando cambia la firma JavaScript de fecha/grupos (`ADMIN_CONTROL_AREA_SIGNATURE`); filtrar o seleccionar sin cambiar esa firma no repite la animación. Se respeta movimiento reducido. Sin comprobación visual en navegador.
