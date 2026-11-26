# KJA-051 · Línea base de administración

Primera medición de la Fase 0 del [plan v3](plan-v3.md). El portal sirvió el HTML de esta copia en localhost:3000/dashboard. Playwright abrió Edge 157.0.4341.60 a 1440 × 900 con respuestas ficticias aisladas. Se midió el contenido con caja de layout en once secciones tras resolver la carga. Recursos externos sustituidos en la prueba; las familias tipográficas son declaraciones CSS, no evidencia de descarga de fuentes.

| Valores efectivos distintos | Color | Radios | Sombras | Tamaño de fuente | Familias | Espaciado |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Conjunto de once secciones | 192 | 25 | 29 | 32 | 4 | 31 |

[Valores exactos por vista](baseline.json). Los colores incluyen texto, fondo y borde superior computados; se incluyen valores por defecto, transparentes y colores de estados presentes. Espaciado incluye padding y gap. Son valores CSS resueltos, no recuentos de literales fuente ni defectos. Excluye el marco exterior, pseudo-elementos y estados que requieren interacción. Para repetir desde la raíz, servir esta copia en el puerto 3000 y ejecutar `node scripts/audit-admin-design.mjs` con Playwright instalado o KJA_PLAYWRIGHT_MODULE apuntando al módulo. Las once capturas y el JSON quedan en .tmp/kja-051.

| Función y prioridad | Evidencia de código | Decisión propuesta |
| --- | --- | --- |
| Expandir colaboradores por área · alta | Contratos: botón de cabecera con cantidad y chevron, primera área abierta y apertura de resultados al cambiar filtro. Colaboradores: control Mostrar/Contraer, conjunto de áreas contraídas y cantidad de personas. Pasar lista: chevron y segundo botón con la misma acción fuera de la secuencia de tabulación. Véanse dashboard-contract-areas.js, dashboard-people-workbench.js y dashboard.js (apl-area-toggle). | Tres implementaciones confirmadas. Meta: una cabecera accesible, preservando políticas de apertura, unidades de conteo y contenido de cada módulo. |
| Consultar panorama por área | Seguimiento usa details/summary alrededor del panorama agregado del día. | Conservar como divulgación de un resumen. No computarlo como cuarta lista de colaboradores. |
| Filtrar por indicador | Pasar lista genera cinco botones apl-kpi con aria-pressed y barra proporcional. Seguimiento separa resumen Personas/Evidencias y bandejas de revisión. | Conservar distinción entre leer y filtrar. Dar selección perceptible solo a indicadores interactivos. |
| Seleccionar área o fecha | Seguimiento enlaza el selector de área compartido y usa navegación de día. En Descargas la selección de rango requiere confirmación. | Reutilizar el control y separar confirmación del borrador de la selección inmediata. Auditar calendarios abiertos antes de fijar el conteo. |
| Esperar resultados o recuperar un error | El controlador común gestiona tiempos y regiones; los módulos conocen contexto y validez del resultado. | Conservar 180/300/200 ms y política de datos anteriores. Inventariar las diferencias entre primer error, vacío confirmado y fallo de actualización. |
| Estilo de campos | DESIGN.md define superficies frías y controles de 52 px; dashboard-admin-field-controls.css define superficies cálidas y disparadores de mínimo 42 px. | Formalizar valores administrativos por función; medir contraste con los fondos efectivos antes de proponer sustituciones. |

Comparación visual reproducible con datos ficticios: [Contratos](contratos.png), [Colaboradores](colaboradores.png), [Pasar lista](lista.png), [Seguimiento diario](seguimiento.png). Las políticas de interacción descritas en la matriz proceden del código.

Para cerrar la fase faltan el inventario fuente acotado al escritorio, las variantes de botones y etiquetas, calendarios abiertos, modales y estados de interacción, y completar el orden de adopción con esas evidencias. Las metas se evaluarán sobre la misma población en cada medición.


## Medición fuente y controles abiertos

Comando reproducible desde la raíz: `node scripts/audit-admin-css.cjs`. En las [27 hojas de estilo seleccionadas](css-source.json) se registraron 773 notaciones de color, 44 valores de radio, 137 de sombra, 40 tamaños explícitos de fuente y 202 nombres de variables. El archivo contiene la lista exacta de hojas y valores para repetir la comparación. Es un recuento de declaraciones, incluye variantes léxicas equivalentes y valores heredados. No incluye CSS compartido del portal, estilos generados por JS ni abreviaturas font. Se excluyen condiciones con ancho máximo entre 100 y 900 px. Estos números y los computados en las once vistas tienen denominadores distintos.

| Función | Implementaciones localizadas en código | Decisión para la adopción |
| --- | --- | --- |
| Elegir fecha | Pasar lista: renderAdminCalendarPopoverGrid. Cierres: renderAdminCloseCalendarGrid. Seguimiento y Descargas: initKjaDatePicker. Facebook: renderCalendar. | Cuatro constructores localizados. Comparar sus límites de fecha y confirmar la selección inmediata o diferida por contexto antes de sustituirlos. |
| Consultar actividad mensual | assignmentCalendarMarkup dibuja días con actividad y carga el resumen del día. | Conservar como calendario de datos; la consulta del día pertenece a Asignaciones. |
| Mostrar un estado | peopleTag en Colaboradores y pill en Seguimiento generan dos marcas distintas. | Una base de etiqueta y tokens semánticos; el módulo proporciona texto y categoría. No equiparar tardanza con revisión observada. |
| Mostrar indicadores | A los indicadores de Pasar lista y Seguimiento se suman renderKpis de Facebook y Ranking en módulos independientes. | Separar lectura, filtrado y métricas de distinta unidad. No convertir un valor puramente informativo en botón. |
| Botón primario y acciones | peopleButton emite pw-primary; el formulario aa-form usa aa-primary. El modal de Descargas habilita la acción al aplicar una selección válida. | Compartir aspecto y foco; el módulo conserva el permiso y la habilitación. |
| Editar y confirmar | aa-dialog tiene nombre, descripción, estado anunciado y botones Cancelar/Guardar. Descargas presenta elección de formato y luego parámetros y acción. | Compartir cabecera, foco y pie; conservar los pasos y las validaciones por formulario. |

Prueba reproducida: `node tests/seguimiento-descargas.visual.mjs`, con datos ficticios. Pasó en 1440×1000, 1280×900, 1366×768 y 1280×600. Se verificaron fecha pendiente, confirmación, rango, seis filas, descarga simulada, error, vacío y Escape con retorno del foco al disparador. Ninguna resolución mostró desbordamiento vertical ni errores de página. Capturas de [selección de rango](05-excel-rango.png), [fallo](09-error.png) y [vacío](10-sin-datos.png). La evidencia corresponde al modal de Descargas.

Orden inicial: grupos por área en Contratos/Colaboradores, uso operativo de Pasar lista, indicadores y selector de fechas, filtros y estados. La aprobación de dirección visual precede al cambio de tokens.

## Revisión de dirección visual

El [inventario de formularios y diálogos](formularios.md) añade 40 nodos declarados y ocho referencias dinámicas en los módulos inspeccionados. El inventario identifica ubicaciones; el recorrido interactivo verificado corresponde a Descargas. Los formularios que cambian permisos, contratos o asistencias se validarán con datos ficticios al migrar su familia.

La [hoja de decisiones](direccion.md) y la [comparación de superficies](direccion.html) quedan listas para la revisión de Piero antes de fijar tokens.

## Revisión de adopción de escritorio

La comprobación del 23/11/2026 recorre las mismas once vistas de la línea base con datos ficticios. La cobertura indica los patrones que tienen evidencia en el portal y, cuando corresponde, su referencia de Figma. La evidencia de la lista principal no acredita por sí sola todos sus diálogos auxiliares.

| Vista | Evidencia de adopción | Pendiente para el cierre |
| --- | --- | --- |
| Contratos | Grupos, indicadores, área, búsqueda, carga y vacío; editor comprobado desde Contratos | El contrato conserva sus campos, cálculos y validaciones especializados; ver pruebas de protección de metadatos y editor. |
| Colaboradores | Grupos, identidad, indicadores, área, búsqueda, estados, alta y edición; cuentas verificadas en navegador con datos ficticios | Alta por pasos, edición por pestañas y cuentas con confirmación de identidad son variantes por función. |
| Pasar lista | Cabeceras, filas, calendario, indicador filtrable, estados y acciones compartidas | Revisión integral de las excepciones de marcación. |
| Seguimiento | Grupos, identidad, indicadores, calendario, evidencias y Descargas | Comprobar consistencia de los estados del visor en revisión integral. |
| Resumen operativo | Carga con contexto, estructura de KJA-038 y diálogo de jornadas generales probado con teclado | Mantener indicadores de jornada y barras de proporción, con sus unidades propias. |
| Asignaciones | Calendario, plazo, selección de destinatarios, sorteo, listado y estados de entrega | Comprobar correspondencias de variantes restantes de entrega. |
| Roles | Consulta de área y confirmación de liderazgo | Revisar diferencia entre consulta y gestión en los demás controles del módulo. |
| Mes completo | Barra mensual, filtros, calendario y estados de consulta; feriados comprobados en cuatro tamaños; pruebas de ficha del día, solicitudes y días libres | Los calendarios especializado e individual conservan sus datos, permisos y acciones. |
| Facebook | Período, área, búsqueda, filtro de evidencia, vacío, ayuda y visor; Escape verificado | El visor no modal conserva navegación por fecha/persona y el componente de detalle compartido. |
| Ranking | Período, área, búsqueda, clasificación, vacío, simulación y desglose; capas sobre navegación y foco verificados | Controles numéricos y anillos de puntuación mantienen sus funciones particulares. |
| Acceso | Configuración de marcado, coordenadas pendientes y foco; pruebas del workbench y confirmaciones de acciones sensibles | Confirmaciones de PIN y enlace conservan su protección y no se ejecutaron cambios reales. |

[Catálogo actualizado](catalogo.html) · [Estado y evidencias de KJA-051](../../tasks/KJA-051.md).

### Medición intermedia

Mismo recorrido de 1440 × 900 que la medición inicial; Edge pasó de 157.0.4341.60 a 158.0.4370.33. Esta comparación sirve para orientar la retirada de duplicados; no acredita las metas finales.

| Valores efectivos distintos | Inicial | Intermedio |
| --- | ---: | ---: |
| Colores | 192 | 189 |
| Radios | 25 | 25 |
| Sombras | 29 | 24 |
| Tamaños de fuente | 32 | 33 |
| Familias tipográficas | 4 | 4 |
| Espaciado | 31 | 31 |

El recuento de 27 hojas del inventario fuente seguía registrando 773 notaciones de color en esa medición.

### Inicio de etapa E · 24/11/2026

Se revisaron las variantes auxiliares con datos de ensayo y se vincularon nueve ejemplos editables al catálogo. Se mantienen las geometrías específicas por función. Las pruebas de acceso y cuentas no realizan mutaciones en producción. La revisión integral continúa con la comprobación de discrepancias del sistema y la retirada de estilos heredados.

La primera limpieza de colores reduce el registro de excepciones de 6.906 usos iniciales a 6.877 (29 menos), mediante sustitución por variables y retirada de declaraciones duplicadas en el editor y otros controles de escritorio. El guardarraíl de 85 hojas sigue sin permitir colores literales nuevos. La medición efectiva intermedia actualizada conserva 189 colores, 25 radios, 25 sombras, 33 tamaños de fuente, cuatro familias y 31 valores de espaciado. Estos conteos no alcanzan aún las metas finales.

### Reconciliación del foco y la selección

Los ejemplos Mes completo y Asignaciones diferían en grosor y vínculo a la variable. Se establecieron tokens semánticos para ancho y separación del anillo, ancho del borde y selección persistente. La geometría normal es borde neutro de 1 px, anillo verde de 2 px separado 2 px, con halo sutil solo para campos y selectores. Los controles compuestos tienen un único anillo externo y los controles compactos mantienen excepciones interiores justificadas.

- Figma: 18 capas de foco y tres capas de selección auditadas, 43 bordes de campo de 1 px vinculados, 107 aplicaciones inequívocas de color literal vinculadas a variables existentes. La lectura final de Componentes, Vistas y Patrones, incluidas capas internas de instancias, devolvió 21 anillos, cuatro selecciones y 49 bordes con grosor y vínculo correctos, sin trazos del verde de foco literales. Se conserva el significado de los colores ambiguos en lugar de enlazarlos automáticamente por coincidencia hexadecimal. [Patrón editable](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=124-26).
- Portal: seis módulos (Colaboradores, Contratos, Mes, Ranking, Facebook, Marcado) en 1024, 1280, 1440 y 1920 px, más Asignaciones en los cuatro tamaños. Las pruebas de foco verifican color, ancho, separación, borde neutro, halo y ausencia de anillo interno duplicado. 43 pruebas de contraste y geometría; 15 comparaciones visuales y 15 escenarios axe del catálogo sin incidencias; cero colores literales nuevos. [Mes enfocado](mes-controles.png) · [Simulación de Ranking](ranking-simulacion.png) · [Alta](alta-colaborador.png).

La siguiente revisión compara otros estados y propiedades compartidas; esta reconciliación no implica auditoría concluida de todos los componentes.

### Estados de acciones y filtros

- Botones: 4 jerarquías × 5 estados en el conjunto original `3:8`, 20 variantes con geometría y color ligados a variables, etiqueta editable compartida. [Matriz de instancias](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=128-362). Las acciones equivalentes del portal consumen tokens de interacción; se mantuvieron densidades específicas y la semántica de permiso/habilitación.
- Filtros: [Facebook](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=133-349) y [Ranking](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=133-367), seis estados cada uno. [Matriz](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=133-394). Se conserva la selección persistente durante hover, y el contador seleccionado de Facebook supera 5:1 (antes aproximadamente 4,06:1). El buscador de esa vista ahora muestra en Figma el mismo anillo de foco que el portal. [Facebook](facebook-personas.png) · [Ranking](ranking-filtros.png).
- Validación: 7 módulos en cuatro tamaños de escritorio (incluidas pulsación sin envío, foco, conservación de selección y descarga deshabilitada), Asignaciones en cuatro tamaños y cuentas en tres tamaños e integración, 104 pruebas unitarias seleccionadas antes de ampliar la matriz de contraste a 52 casos, 56 comprobaciones finales de contraste y guardarraíles, 18 pruebas de catálogo y 15 escenarios de accesibilidad automatizada sin incidencias. Cero escrituras operativas. Se actualizó solo la referencia visual de acciones por el cambio deliberado del estado deshabilitado y borde de acciones sólidas.
- El registro de excepciones queda en 6.871 usos heredados frente a 6.906 iniciales, con cero nuevos. El avance no acredita todavía la retirada total de estilos antiguos ni las metas de cierre.

### Pestañas y selectores comunes

Se consolidaron el indicador de pestaña (3 px terracota), la selección de valor (2 px terracota) y el foco verde temporal. Los seis menús comparten superficie, elevación, búsqueda y opción; la opción enfocada por `aria-activedescendant` tiene contorno interior y la opción seleccionada conserva su check. Figma conserva los IDs del selector deshabilitado y menú originales; se añadieron seis variantes de pestaña, siete de selector, cinco de opción y los iconos vectoriales enlazados. [Matriz de 18 estados](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=144-457).

- Pruebas con Colaboradores, Contratos y Marcado en cuatro tamaños: hover, pulsación, foco, selección persistente y recuperación de foco con Escape. Pasar lista y Seguimiento completaron los recorridos de escritorio en cuatro tamaños, con datos ficticios y cero errores de JavaScript.
- Se retiraron 57 usos de color literal más (de 6.871 a 6.814); cero nuevos y 59 pruebas de contraste/guardarraíles aprobadas. Medición efectiva de las once secciones a 1440 × 900, Edge 158.0.4370.33: 188 colores, 25 radios, 24 sombras, 33 tamaños de fuente, cuatro familias, 31 espaciados. No equivale todavía al objetivo final de E.

### Superficies, radios y elevación

Se consolidaron los radios de diálogos centrados (20 px), tarjetas (16 px), subtarjetas (12 px) y menús (18 px). Los controles de 10 px y las píldoras comparten variables base con alias semánticos. Se crearon tres estilos de elevación coherentes en Figma: tarjeta, menú, diálogo. Las filas permanecen planas y los visores laterales conservan su función. Acceso eliminó el glass residual en escritorio. La leyenda de Resumen conserva sus tres puntos coloreados y sus etiquetas textuales bajo tokens de gráfico. [Fundamentos](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=153-534).

- La prueba en navegador verifica el radio y sombra efectivos de diálogos y tarjetas representativas en cuatro tamaños. Recorridos de Colaboradores, Contratos, Roles, Marcado, Mes, Ranking, Facebook, Pasar lista y Seguimiento completos; cuentas en tres tamaños e integración. 109 pruebas unitarias seleccionadas, 18 pruebas visuales y 15 escenarios de accesibilidad de catálogo aprobados. Datos de ensayo; sin publicación.
- 6.801 usos de color heredados frente a 6.906 iniciales, cero nuevos; 187 colores, 25 radios, 23 sombras, 33 tamaños de fuente, cuatro familias, 31 espaciados en la medición efectiva intermedia. Los diálogos no forman parte del conteo de las once vistas principales: se verifican aparte, mediante el estilo efectivo. Las metas finales aún están pendientes.

### Tipografía de administración

Se definió la escala semántica de texto y se tokenizaron las familias operativas; los encabezados que usaban Georgia directamente ahora usan Fraunces como primera opción de escritorio. Los 12 estilos de texto de Figma (11, 12, 12,5, 13, 14, 16 y 28 px) están en [Fundamentos](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=157-285); 40 etiquetas de componentes están vinculadas. Se normalizaron 71 textos de Vistas importados con SF Pro, Georgia, Libre Baskerville o Crimson Text. Se verificaron visualmente Roles, Acceso y Plazo de cierre, este último tras vincular 45 pinturas a variables semánticas.

La medición efectiva vuelve a contar 187 colores, 25 radios, 23 sombras, 33 tamaños de texto, tres familias declaradas y 31 espaciados. El script ahora registra etiquetas visibles inferiores a 11 px; `node scripts/audit-admin-design.mjs --check-captions` comprueba el límite y las dos excepciones declaradas. A 1440 × 900, en las once secciones, quedan únicamente dos casos: iniciales de avatares compactos en Ranking y Marcado (10 px, acompañadas por el nombre). Esta comprobación no cubre todos los diálogos auxiliares ni otros tamaños. Pasaron los 28 recorridos de Contratos, Colaboradores, Roles, Mes, Facebook, Ranking y Marcado en cuatro tamaños, así como las 59 pruebas de contraste/colores; sin modificación móvil.

**Clasificación inicial de excepciones para el cierre.** El registro de 6.801 usos se divide en 1.146 dentro de consultas de ancho mínimo explícito de 901 px o superior y 5.655 restantes (declaraciones no restringidas explícitamente a escritorio). No se puede tratar el segundo grupo como todo móvil ni como todo escritorio: hay selectores compartidos, hojas especializadas y reglas que solo se activan por la estructura del DOM. Revisar primero el grupo explícito y luego la aplicabilidad de las restantes declaraciones; no migrar indiscriminadamente reglas compartidas, ni eliminar excepciones del registro mientras sus literales estén presentes.

### Espaciado, contraste y retirada incremental

La escala 4/8/12/16/20/24/32 px se vinculó a 292 usos de padding, gap y margen, sin cambiar sus valores. `text-secondary` (#5c564f) separa texto auxiliar de las tintas de estado y mejora el contraste de tres grises anteriores. `scripts/refactor-admin-desktop-tokens.mjs` exige simultáneamente una consulta de escritorio y un selector anclado en el ámbito de tokens; por defecto solo informa. Ejecutarlo con `--write` migra los valores candidatos. Pasaron las pruebas de exclusión de consultas y selectores compartidos; una segunda ejecución de diagnóstico no tiene candidatos. Migró 141 literales de color y se quitaron cuatro adicionales al retirar tres reglas de foco duplicadas. Registro: 6.656 usos frente a 6.801 de la etapa anterior y 6.906 iniciales; 1.001 en consultas explícitas de escritorio, 5.655 restantes. Cero nuevos.

Figma: [escala](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=163-285) con cinco variables nuevas, 55 bindings de espaciado comprobados en 25 nodos, 23 textos secundarios de Roles/Acceso vinculados. [Leyendas y empates](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=169-250): cuatro variantes de leyenda y tres de empate, siete instancias de componentes. IDs de continuidad en [figma-state.json](figma-state.json). El catálogo se regenera usando el AST CSS para extraer correctamente cada bloque de escritorio, incluso cuando hay varios bloques; se preservan las capturas de referencia.

`node scripts/audit-admin-design.mjs --check-captions --check-contrast` audita el contraste de los textos realmente visibles a 1440 × 900 con datos ficticios. La primera ejecución detectó siete infracciones directas y 26 etiquetas cortas con colores calculables bajo AA. Se corrigieron los códigos P/T/J/NG, ayuda de lista, Nueva asignación, unidad de KPI y avatares/empates de Ranking, contador de Contratos, contador seleccionado de Roles y celdas vacías/contador de Mes. Repetición: cero violaciones y cero textos cortos medibles bajo AA. Quedan **96** resultados manuales: Resumen 31, Asignaciones 53, Roles 3, Facebook 2, Ranking 7. No se interpreta un fondo desconocido como aprobado. Medición efectiva: 184 colores, 25 radios, 23 sombras, 33 tamaños de texto, tres familias y 31 espaciados. Las 65 pruebas de contraste/tokens/alcance y las 18 visuales + 15 escenarios de accesibilidad del catálogo pasaron; la geometría de Asignaciones se comprobó a cuatro anchos y el Resumen a tres. El trabajo sigue circunscrito a escritorio y no acredita publicación.

### Fondos renderizados y paleta semántica

`node scripts/audit-admin-design.mjs --check-captions --check-sampled-contrast` mide los 96 nodos incompletos de axe mediante dos capturas de cada región (normal y glifo transparente sin alterar geometría/foreground original), toma el peor fondo visible bajo los píxeles del glifo y calcula la razón con la tinta CSS. Las capturas usan datos ficticios; no se declaran aprobados fondos arbitrarios ni estados no recorridos. Se encontraron ocho incumplimientos (L/M/M/J/V/S/D del calendario y placeholder de Asignaciones), corregidos con `text-secondary`. A 1440 × 900, las once vistas vuelven a pasar axe y el muestreo de los 96 casos, sin incumplimientos calculables ni casos sin resolver. El script conserva la razón y el fondo de peor caso en `.tmp/kja-051/baseline.json`. El borde y radio de búsqueda usan los tokens de campo, y la leyenda de error del calendario usa el botón primario, con reintento independiente y restauración de foco. El ensayo en cuatro tamaños verifica el reintento visible y sin escrituras reales.

Se añadieron `surface-canvas`, `surface-accent-tint` y `divider-subtle` (decorativo, no borde de control); 187 sustituciones del refactor de escritorio y siete ajustes manuales retiraron 194 usos de color. No se ampliaron reglas móviles ni se propagaron variables al portal de colaboradores. [Patrón de Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=180-209): tres variables comprobadas, 29 pinturas reconciliadas (incluidos siete encabezados de calendario), búsqueda vacía de 360 × 40 con propiedad Placeholder e icono reutilizado, y botón primario existente. Referencias en `figma-state.json`. Resultado efectivo intermedio: 181 colores, 25 radios, 23 sombras, 33 tamaños de texto, tres familias y 31 espaciados. Pruebas de contexto de Contratos/Colaboradores/Roles/Mes/Marcado en cuatro anchos; 86 pruebas de tokens, alcance, contraste y muestreo; catálogo sin incidencias. Sin publicación.

`node scripts/audit-admin-color-scope.mjs` clasifica **6.462** usos restantes, comparados con 6.656 previos y 6.906 iniciales: 287 en escritorio con anclaje conocido, 520 en escritorio sin anclaje demostrado, 1.956 en reglas compartidas/ancladas y 3.699 en reglas compartidas o de ámbito no demostrado. Cero nuevos. No se borran excepciones por clasificación: siguiente acción, resolver las de anclaje conocido y comprobar el DOM/uso de las demás; revisar los objetivos de cierre sin invadir móvil.

### Pulido de controles detectado en localhost

Las seis capturas de Piero revelaron reglas heredadas que aún competían con el sistema de diseño. Pasar lista oculta y vuelve inerte el disparador antiguo en escritorio y lo restaura para la adaptación existente. Los buscadores compuestos y el selector mensual eliminan el fondo, borde y sombra internos; solo el contenedor dibuja el campo. Nueva asignación deja de animar sombras y transformaciones. Las casillas de filtros usan 18 × 18 px y radio 4, marca blanca sobre terracota y foco verde independiente de la selección. Se conserva el comportamiento en colores forzados. Figma: se verificaron búsqueda `179:94`, acción primaria `3:9` y período mensual `100:191`; se ajustó la casilla `100:218`, manteniendo las variables de fondo, borde y grosor. [Vista](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=100-190).

`node tests/admin-control-polish-browser.mjs` verifica visibilidad y teclado del selector, fondos y foco, estabilidad de la acción durante hover/pulsación y geometría y estados del checkbox en 1024, 1280, 1440 y 1920 px. Capturas de ensayo en `.tmp/kja-051-polish/`. Pasan también las pruebas de contexto de Pasar lista y Seguimiento y `node scripts/check-admin-colors.mjs` (85 hojas, cero colores literales nuevos); la repetición de `node scripts/audit-admin-design.mjs --check-captions --check-sampled-contrast` pasa las once vistas y 96 fondos. Los recorridos usan datos ficticios y no escriben en producción; no acreditan todos los escenarios reales ni modifican móvil.

### Reconciliación por familias de escritorio

Se extendió el refactor conservador a cuatro hojas de escritorio: Colaboradores/editor (50 usos), Mes y feriados (22), Acceso y marcado (34), Contratos/Roles (29). Las 135 sustituciones enlazan superficies, bordes, divisores, placeholders, acciones y foco a tokens existentes. Solo se modifican reglas con consulta explícita de escritorio y consumidor anclado. Los colores específicos del QR, mapa, estados especializados y selecciones ambiguas no se sustituyen por semejanza cromática. El segundo diagnóstico no tiene candidatos; el registro de excepciones baja de 6.462 a 6.327 (152 escritorio anclado, 520 escritorio sin anclaje demostrado, 1.956 compartido anclado y 3.699 compartido sin demostrar). El guardarraíl no permite usos nuevos. La medición efectiva de las once vistas devuelve 178 colores, 25 radios, 23 sombras y tres familias tipográficas; axe y 96 fondos muestreados siguen pasando.

En Acceso se unificaron el campo de tolerancia, buscador de oficina, coordenadas y enlace de solo lectura: un único fondo y contorno, foco del botón Copiar independiente (blanco interior sobre terracota), soporte crema del anillo verde en el panel oscuro. `min`, Latitud y Longitud emplean tinta secundaria, de al menos 11 px. En [Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=79-97) se actualizaron nueve capas del diseño existente (radios, transparencia y bindings de borde y texto), y se verificaron visualmente; los focos de Alta/Editar colaborador y Feriados ya estaban vinculados al token verde y grosor de 2 px. Los recorridos de cinco módulos pasan en cuatro anchos y 84 pruebas de refactor, colores y contraste. El ensayo de controles no guarda ni copia enlaces reales: mapa y generación QR se simulan sin conexión. Los 152 usos restantes requieren revisión semántica específica (estados calendarios, fondos especializados, elevación y decoración); después, comprobar los estilos compartidos sin modificar móvil. No se declara la meta de cero literales cumplida.

### Estados especializados y cierre del grupo de escritorio anclado

Los 152 usos restantes de ese grupo se retiraron: 132 mediante `scripts/reconcile-admin-specialized.mjs` (cada reemplazo exige archivo, rol de selector, propiedad, literal original, consulta de escritorio y anclaje) y 20 mediante la corrección de calendario individual y Días libres. Se reutilizan los tokens de estado, elevación, borde y superficie. Los tres roles nuevos de tokens v0.7.0 (`surface-white`, `surface-scrim`, `loading-shine`) conservan blanco de QR/carga y opacidad del reflejo y del fondo de diálogos. Variables correspondientes en Figma `190:2–4`, con ámbito de relleno y sintaxis CSS; no se modifica la operación del QR ni la temporización de carga.

En Ver mes se corrigieron dos fallos hallados en recorridos: a 1024 px la acción desbordaba la columna y una celda vecina interceptaba el clic; Enter sobre un día generaba coordenadas (0,0) y el detector de clic exterior cerraba el diálogo. El ancho interno ahora es flexible y solo un clic sobre el dialog/backdrop puede cerrar por esa vía. Los colores de estado se mantienen en hover y selección, J usa morado en administración de escritorio con leyenda concordante, y el detalle comparte la paleta de la celda. El calendario personal y el móvil conservan su presentación previa. [Captura de ensayo](calendario-individual.png) · [Figma, 26 variantes de día e interacción y 11 instancias de revisión](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=194-211). Se verificaron etiquetas distintas por estado, el anillo sin recorte y la propiedad Día editable.

Pasaron 123 pruebas unitarias seleccionadas, los recorridos de cinco módulos en cuatro anchos, los de Asignaciones y Pasar lista y la regresión ampliada de controles (1024, 1280, 1440, 1920 px). Se comprobó entrada al calendario por clic, cambio de mes, hover de cinco tonos, Enter sin cierre, estado de detalle, selección persistente al perder foco y Escape. La auditoría de once vistas mantiene cero infracciones y 96/96 fondos complejos aprobados; medición efectiva 166 colores, 25 radios, 21 sombras, 33 tamaños de texto y tres familias. Sin escrituras reales, cambios móviles ni despliegue.

Registro fuente: **6.175** usos heredados de 6.906 iniciales, cero nuevos; cero en la categoría de escritorio con anclaje probado (de 287 a 152 y a cero), **520** de escritorio cuyo anclaje no se ha demostrado, **1.956** compartidos/anclados y **3.699** compartidos sin alcance demostrado. Esta reducción no equivale al objetivo de cero para todas las reglas administrativas. Siguiente: demostrar consumidores y ámbito de los tres grupos pendientes, evitar migrar reglas aplicables a móvil y comprobar las metas finales.

### Menús flotantes y auditoría de consumidores

Se acotó la herencia de tokens a los consumidores de gestión, navegación lateral activa, ficha y diálogos auxiliares de jornada/perfil, y menús portallados de campo y rol. No se generalizó a `admin-wide` ni al rail de otras vistas. Se retiraron 150 usos literales adicionales en la reconciliación de campos, organización y navegación. Roles: fondo opaco, borde verde al abrir, buscador con un único fondo, opciones de 36 px y selección cálida con marca; el foco interior de 2 px no se corta al desplazarse. Flechas, Inicio/Fin y Escape actúan sobre el menú; cancelar no guarda el borrador. El editor conserva la opción elegida y distinguible del hover. La navegación lateral usa foco 2/2 por encima de la regla antigua, sin alterar el acento de selección.

[Captura del portal de ensayo](selector-roles.png) · [Figma: Roles / Consultar área / Cambiar líder](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=199-326). El componente de opción tiene cinco variantes (normal, hover, foco, seleccionado, seleccionado y foco), texto Inter editable y avatar compacto reutilizable; el foco y la altura están vinculados a variables. La lámina muestra instancias, no una captura importada.

`node tests/admin-menu-scope-browser.mjs` pasa en 1024, 1280, 1440 y 1920 px, incluidos foco y Escape, selección por teclado y cancelación. Los recorridos `admin-data-context-browser` de Roles, Colaboradores, Contratos y Marcado pasan en los mismos cuatro anchos. La auditoría de contraste de once vistas mantiene 96/96 fondos, cero infracciones y ningún caption informativo inferior a 11 px. Medición intermedia de valores efectivos: 164 colores, 25 radios, 20 sombras. 82 pruebas unitarias seleccionadas pasan. Datos ficticios, sin escrituras reales.

`node scripts/audit-admin-css-consumers.mjs` registra los **6.025** usos heredados (de 6.906 iniciales), con archivo, consulta, selector y ocurrencia; compara propiedades de tokens computadas en 13 escenarios de escritorio (11 vistas y dos pestañas adicionales de Acceso). Se observaron 918 usos con tokens heredados; 753 pertenecen explícitamente a otras vistas, 4.350 no se observaron y cuatro corresponden a keyframes. El informe reproducible se genera en `.tmp/kja-051/css-consumers.json`. Los selectores pueden coincidir sin dominar la cascada; una muestra sin coincidencia no prueba falta de uso ni autoriza eliminar reglas. Queda abierta la revisión de estilos compartidos y estados no observados. No se reclama la meta de cero literales ni se modifica móvil.

### Ficha de Colaboradores y reglas compartidas

La hoja explícita de escritorio `dashboard-people-workbench.css` perdió sus 121 usos heredados inventariados. Se unificaron los tonos de estados, superficies, controles, barras de progreso, tabla semanal y menús. El mensaje al volver de editar no pulsa ni reinicia una animación: tintado y barra de acento durante 2,6 s, con desplazamiento instantáneo si se prefiere reducir movimiento. El foco de las pestañas es interior para evitar recortes y simultáneo con el indicador de selección. [Captura del portal de ensayo](ficha-jornada.png) · [Ficha editable de Jornada en Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=203-285). La vista incluye 24 instancias y texto Inter/Fraunces, ocho filas de horario y tres variantes de fila semanal, además de la nueva variante de pestaña seleccionada y enfocada con etiqueta editable. Se comprobó en 1024, 1280, 1440 y 1920 px, sin abrir ni modificar registros reales.

`scripts/reconcile-admin-shared-tokens.mjs` concilia 93 usos en doce hojas compartidas: 61 colores exactos y 32 tintas semánticas. Cada `var(--kja-rol, valor-previo)` conserva el respaldo literal exacto; fuera del ámbito de escritorio no existen esos tokens. Las excepciones se mantienen en el guardarraíl, no se excluyen de su recuento. La migración es idempotente y evita colores ambiguos, funciones y reglas exclusivas de móvil. Se amplió el ensayo a 32 escenarios con diálogos de Resumen, Registro de entrada, Ficha, Alta, Roles, calendario, feriados y Ranking. El predicado fuera de alcance incluye la exclusión positiva `#portal:not(.admin-wide)` porque `dashboard.js` define `admin-wide` cuando se abre Gestión o Cuentas administrativas. Así los 889 usos de `dashboard-user-glass.css` quedan fuera explícitamente, sin cambiar esa hoja ni el portal personal.

El cierre se consulta con `node scripts/audit-admin-closeout.mjs` después de repetir las dos auditorías. Una huella del HTML, scripts y hojas enlazadas evita comparar una medición obsoleta. Del inventario inicial de 6.906 hay 5.904 literales en el registro (1.002 retirados), 1.175 de ámbito externo demostrado, 93 respaldos gestionados y 4.636 aún por resolver o justificar. El porcentaje de avance por etapas no equivale a esta meta cuantitativa. No se certifica eliminación total de colores literales ni conformidad integral de estados que no han sido ensayados.

Medición con el mismo recorrido de once vistas y resolución 1440 × 900, Edge 158.0.4370.33 frente a 157.0.4341.60 de la línea base:

| Valores efectivos distintos | Inicial | Actual |
| --- | ---: | ---: |
| Colores | 192 | 154 |
| Radios | 25 | 25 |
| Sombras | 29 | 20 |
| Tamaños de texto | 32 | 33 |
| Familias tipográficas declaradas | 4 | 3 |
| Espaciados | 31 | 31 |

No son conteos de tokens fuente. No se da por alcanzada la meta de radios, sombras y valores exclusivos de tokens. Pasan 97 pruebas unitarias seleccionadas, los recorridos de ficha y controles en cuatro anchos, la revisión de accesibilidad del catálogo en 15 escenarios y los 96 fondos complejos de la auditoría de las once vistas sin violaciones. `audit-admin-closeout` devuelve `EN-CURSO`, no conformidad final.

### Paleta transversal y geometría

25/11/2026. Se migraron colores de carga, paletas nombradas de módulos y valores directos por familia semántica, con el respaldo exacto anterior cuando intervienen hojas compartidas. El análisis suplementario `painted` registra el uso visible (tinta directa, fondo, borde con grosor, radios de superficie y sombras), sin confundir herencia computada con pintura. Se normalizaron indicadores, estados, fondos, sombras y controles, incluyendo el botón global Actualizar. No se alteró la autorización ni la conducta de las operaciones.

| Medición | Inicial | Actual |
| --- | ---: | ---: |
| Colores computados distintos | 192 | 84 |
| Radios computados distintos | 25 | 23 |
| Sombras computadas distintas | 29 | 13 |
| Literales inventariados | 6.906 | 5.871 |
| Respaldos gestionados dentro del inventario | 0 | 2.003 |
| Fuera de alcance demostrado | — | 1.175 |
| Pendientes de resolución o justificación | — | 2.693 |

Los 1.035 usos retirados y 2.003 fallbacks gestionados son categorías diferentes. No se declara como resuelto un literal por no observarse en el recorrido. Las auditorías usan la misma huella del código; el cierre continúa `EN-CURSO`. 37 escenarios de consumidores, once vistas con cero violaciones automáticas y 18 fondos muestreados sin fallos (la simplificación de fondos reduce las muestras necesarias). 107 unitarias seleccionadas y recorridos de Cuentas/controles/menús/directorio pasan; el catálogo generado vuelve a superar su revisión de 15 escenarios. Las muestras de autorización para Cuentas son exclusivamente ficticias e interceptadas en el navegador de pruebas. [Galería de reconocimiento de escritorio](reconocimiento.html): cuatro pares antes/actual y siete vistas actuales, capturas reproducibles con datos ficticios; pendiente aprobación del resultado global.

**Figma**: 90 variables comprobadas, 12 estilos de texto y cuatro efectos; la versión de código 0.7.1 conserva valores y cuatro alias que ya existían en Figma. Se verificaron 2.382 pinturas sólidas visibles vinculadas en Fundamentos, Componentes, Patrones y Vistas, cero sin variable y cero discrepancias de RGB de respaldo. Se excluyen capas internas de instancias, pinturas invisibles (37 transparentes) y contenido externo; los radios estándar suman 556 capas con enlace, 542 nuevas. Correcciones de contraste verificadas en Días libres y símbolos Sí/No. Registro estructurado: [figma-state.json](figma-state.json). Quedan las metas de fuente, geometría funcional y reconocimiento de Piero. Esto no implica publicación de la biblioteca ni despliegue del portal.

### Reconocimiento y correspondencia verificada

25/11/2026. Piero aprobó explícitamente la [galería de reconocimiento](reconocimiento.html); se conserva sin regenerar su referencia. En comparación con el mismo tamaño y los datos ficticios, diez vistas cambian menos de 0,5 % de sus píxeles (diferencia superior a ocho niveles por canal); Seguimiento cambia 0,55 %, con 0,02 % por encima de 32 niveles. La [revisión técnica de la diferencia](reconocimiento-revision.json) confirma la conservación visual de la estructura y registra el cambio semántico intencional de estado. La comparación alerta de diferencias, no certifica comportamiento ni sustituye la aprobación humana.

| Medición | Inicial | Actual |
| --- | ---: | ---: |
| Colores computados distintos | 192 | 62 |
| Radios computados distintos | 25 | 21 |
| Sombras computadas distintas | 29 | 12 |
| Literales inventariados | 6.906 | 5.871 |
| Respaldos gestionados | 0 | 3.297 |
| Fuera de ámbito demostrado | — | 1.269 |
| Excepciones explícitas | — | 163 |
| Pendientes de resolución o justificación | — | 1.142 |

Los respaldos gestionados corresponden a tokens semánticos que conservan el valor anterior fuera del escritorio de Gestión. Las 163 excepciones se desglosan en identidad por área (84 paleta y 37 gráficos, incluidos los avatares diferenciados por área en los menús y los iconos de Control), medallas de ranking (22), fondo ambiental (11), comportamiento alternativo de plataforma (5) y tema oscuro excluido (4). Estas excepciones no incluyen controles interactivos genéricos. No se considera resuelto un literal solo por no observarse en las pruebas. El inventario reproducible de declaraciones pendientes se obtiene con `node scripts/audit-admin-pending-declarations.mjs`; el cierre mantiene estado EN-CURSO hasta resolver los pendientes.

**Biblioteca y código.** El [registro de correspondencias](correspondencias.json) cubre 38 familias y 30 secciones de catálogo con 66 nodos distintos verificados por MCP, sin referencias ausentes. Coinciden las reglas y marcadores referenciados en código y catálogo según `node scripts/check-admin-correspondence.mjs`. Figma contiene 94 variables, 12 estilos de texto y cuatro efectos; 2.382 pinturas sólidas visibles vinculadas con cero divergencias de respaldo, y 695 nodos con radio vinculado. Los cuatro radios funcionales incorporados en v0.7.2 se vincularon a 139 capas. Las acciones no tienen sombra; las elevaciones corresponden a superficies. [Estado de la biblioteca](figma-state.json).

**Verificación.** 134 unitarias seleccionadas aprobadas, 42 escenarios de consumidores (incluidas rutas históricas de Control/Cierres), 15 recorridos de accesibilidad del catálogo, regresiones de controles, navegación por teclado en menús, ficha de Colaboradores y espaciado de Asignaciones en cuatro anchos de escritorio. Las once vistas superan el contraste AA evaluado, con los 18 fondos de revisión muestreados sin fallos ni textos informativos menores de 11 px. Los casos auxiliares de informe y confirmación de eliminación usan superficies, estados y foco comunes; `tests/admin-auxiliary-surface-browser.mjs` comprueba los cuatro anchos y contraste de color en un documento aislado sin solicitudes al servidor. Las seis unitarias de consulta de informe pasan, sin modificar descarga, permisos o interacción con evidencias. Las últimas verificaciones se ejecutan localmente sobre c802c3f con cambios de trabajo; no hay publicación ni cambios de diseño móvil.

### Cierre final de la etapa E

26/11/2026 · **HECHO local**. La puerta automática de cierre comprueba la misma huella de código entre medición renderizada y auditoría de consumidores, la comparación de reconocimiento y la revisión técnica de sus alertas, la correspondencia completa de Figma, el contraste y la clasificación de la geometría pintada. Resultado: [cierre-final.json](cierre-final.json), SHA de diseño `2cb304742159d412dfcc3586f6eb513e825118a9ed32f488d35037f4ad26f45c` sobre `feat/pierokja` en `c802c3f`. Referencia aprobada por Piero el 25/11: se mantiene intacta.

| Medición inicial frente al cierre | Inicial | Final |
| --- | ---: | ---: |
| Colores computados distintos | 192 | 37 |
| Radios computados distintos | 25 | 20 |
| Sombras computadas distintas | 29 | 9 |
| Literales inventariados | 6.906 | 5.871 |
| Respaldos gestionados en los literales | 0 | 4.419 |
| Fuera del ámbito administrativo demostrado | — | 1.269 |
| Excepciones funcionales justificadas | — | 183 |
| Usos administrativos pendientes | — | **0** |

La reducción no equivale a eliminar los 5.871 valores retenidos: cada uno pertenece a una categoría auditada. Las excepciones de medios, marcas externas, efectos de ilustración y compatibilidad son específicas por archivo, selector y propiedad; no cubren los controles generales. El archivo `scripts/admin-reviewed-declarations.json` recoge decisiones de migración por declaración exacta, no inferencias por cercanía de color. Las 85 hojas pasan el guardarraíl de cero literales nuevos. Los valores computados incluyen estilos por defecto; la auditoría adicional clasifica todos los radios y colores realmente pintados, con un solo fondo de medalla fuera de paleta de tokens de componentes. Las elevaciones observadas son de tarjeta y menú; las otras sombras corresponden a indicadores, divisores y medallas. En diálogos y foco se conservan sus estilos comunes específicos.

**Figma y catálogo.** Tokens v0.7.3: 114 entradas fuente, 100 variables en Figma, 14 estilos de texto y 4 de efecto. Con la familia del indicador circular quedan 39 familias, 31 secciones y 68 nodos verificados por MCP. El [componente](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=225-140) contiene 12 variantes de 4 tipos × 3 estados y cuatro [instancias de reconocimiento](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=225-395); se comprobaron 194 pinturas vinculadas, cero sin vincular, 24 enlaces de radio en la familia y textos Inter/Fraunces. Los valores por tipo se separan para preservar cada muestra; el foco conserva borde interior neutro y contorno exterior verde de 2 px. La paleta de las series del portal no cambia. [Registro](correspondencias.json) · [Estado Figma](figma-state.json) · [Catálogo](catalogo.html#resumen-indicadores-circulares).

**Evidencia visual.** Once vistas con 0 violaciones de contraste automático, tres fondos complejos muestreados sin fallos y ningún caption informativo inferior a 11 px. La [revisión de reconocimiento final](reconocimiento-revision.json) documenta cuatro alertas de diferencia pixelaria (0,68 %, 1,05 %, 0,77 %, 1,61 %) por cambios de hora, estados semánticos y contornos de controles; ninguna cambia la anatomía aprobada. Ranking conserva su medalla y comparte el fondo neutro del avatar. 42 escenarios de consumidores con datos ficticios, 141 pruebas unitarias seleccionadas aprobadas, 15 recorridos de accesibilidad del catálogo y cinco suites aprobadas en cuatro tamaños de escritorio (1024, 1280, 1440 y 1920 px), sin solicitudes operativas de escritura.

**Reproducción:** `node scripts/generate-admin-tokens.cjs`, `node scripts/generate-admin-catalog.cjs --check`, `node scripts/check-admin-colors.mjs`, `node scripts/check-admin-correspondence.mjs`, `node scripts/audit-admin-pending-declarations.mjs`, `node scripts/audit-admin-design.mjs --check-contrast --check-sampled-contrast --check-captions`, `node scripts/audit-admin-css-consumers.mjs`, `node scripts/audit-admin-recognition.mjs` y `node scripts/audit-admin-closeout.mjs --check`. Las auditorías y capturas temporales se regeneran para el mismo código; las referencias aprobadas nunca se sustituyen por capturas nuevas. El cierre certifica el alcance administrativo local de escritorio y los recorridos auditados, no todas las combinaciones de datos reales ni la publicación. El trabajo móvil, SQL y backend se preserva.
