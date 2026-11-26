# KJA-051 — Sistema de diseño del panel de administración

Versión 3 · 21 de noviembre de 2026 · Plan optimizado: estandarización de componentes e identidad de software

KJA-051 pule el panel que ya existe y lo convierte en un sistema de diseño con identidad propia. Se conservan los colores cálidos, el sidebar de doble nivel, el terracota, la tipografía y las superficies translúcidas. Lo que cambia es que cada función del usuario tenga un solo componente, respaldado por tokens, reglas y comprobaciones automáticas.

## 1. Objetivo y criterio de éxito

Consolidar la identidad cálida del panel de administración en un sistema compartido entre Figma, documentación y código, y eliminar las inconsistencias que hoy la diluyen. Esas inconsistencias son componentes con la misma función y distinta apariencia o comportamiento: acordeones con chevron frente a otros con botón «Mostrar/Ocultar», al menos tres interfaces de calendario, al menos dos diseños de tarjeta de indicador y colores distintos para un mismo estado. Son ejemplos de un patrón más amplio; la auditoría de la Fase 0 encontrará el resto.

La entrega está completa cuando se cumplen cuatro condiciones:

- Todo componente administrativo está inventariado, documentado y migrado, o figura como excepción justificada.
- Figma, catálogo y código representan los mismos componentes, variantes y estados.
- Los conteos de línea base (colores, radios, sombras, implementaciones por función) alcanzan sus metas (sección 11).
- Quien usa el panel hoy lo reconoce como el mismo producto, ahora más coherente (prueba de reconocimiento, sección 3).

El repositorio ya contiene `DESIGN.md`, variables CSS y componentes compartidos. Se actualiza esa base: no se crea otro archivo `design.md` ni se reconstruye el panel.

## 2. Identidad: qué se conserva y qué se pule

La identidad actual es el punto de partida y no se discute. Los valores de la tabla se leen de las capturas; la fuente de verdad son las variables CSS vigentes, que la Fase 0 extrae y confirma.

| Elemento | Se conserva | Se pule |
| --- | --- | --- |
| Paleta | Fondos crema y neutros cálidos, terracota como acento dominante, verde bosque para acciones secundarias como «Actualizar», estados en pasteles apagados | Escalas completas por color, un token por estado, contraste AA en textos secundarios y de 11–12 px |
| Tipografía | Serif en titulares, sans en la interfaz, eyebrows en mayúsculas con tracking amplio (familias exactas por confirmar en el CSS) | Escala de tamaños, pesos e interlineado definida; tamaño mínimo para texto informativo |
| Navegación | Sidebar de doble nivel: rail de íconos y menú agrupado, con estado activo en beige y borde terracota; breadcrumb y barra superior | Solo estados (hover, foco, activo), tooltips en el rail y nombres accesibles. Estructura y posición intactas |
| Superficies | Tarjetas crema translúcidas, bordes finos, radios grandes, sombras suaves y efecto glass | Tokens de glass con niveles y fallback opaco; uso solo en contenedores |
| Acciones | Botón terracota con degradado sutil como acción principal; píldoras pastel de aprobar y rechazar | Jerarquía primario, secundario, terciario y destructivo; un solo primario por contexto |
| Datos | KPI con anillo, listas con avatar de iniciales, píldoras de estado, segmented control, chips | Una anatomía por función y estados completos de carga, vacío y error |
| Movimiento | Esqueletos #e7e7e7 con reflejo blanco, tiempos 180/300/200 ms, movimiento reducido | Se convierten en tokens sin cambiar valores |

Un cambio que toque la columna «Se conserva» requiere la aprobación expresa de Piero.

## 3. Principios guía y alcance del cambio

Los principios orientan las decisiones; no son reglas que se comprueben una a una. Las reglas concretas (tokens, anatomía de cada componente) nacen de aplicarlos.

1. **Pulir, no reinventar.** Todo cambio visible debe quitar una inconsistencia, corregir un defecto de accesibilidad o usabilidad, o formalizar un valor que ya existe.
2. **Misma función, mismo componente.** Lo que resuelve la misma tarea para el usuario (elegir una fecha, leer un indicador, expandir un grupo, filtrar una lista) se ve y se comporta igual. Los acordeones, calendarios e indicadores son ejemplos de este principio, no su lista completa. Una diferencia se admite cuando una necesidad real del módulo la justifica y queda escrita.
3. **Calidez con claridad.** La estética cálida nunca compromete el contraste, la legibilidad ni la jerarquía.
4. **Un vocabulario visual estable.** Terracota para la acción principal, un color por estado, glass para contenedores: cada recurso significa lo mismo en todas las vistas.
5. **La presentación no decide el negocio.** Los componentes muestran lo que reciben; permisos, cálculos y reglas de asistencia no viven en ellos.
6. **Lo que no se verifica se desvía.** Cada regla importante tiene una comprobación automática o un punto de revisión.

### Alcance del cambio visual

- **Dentro:** tokens, superficies, sombras, radios, desenfoque, espaciado, color de estados, jerarquía de acciones, anatomía y estados de las familias de componentes, y accesibilidad.
- **Fuera (tickets aparte):** layout de las vistas, estructura de navegación, tarjeta hero del resumen operativo, cambios de marca (matiz del terracota, familias tipográficas, logotipo), modo oscuro y portal del colaborador.
- **Ajustes de valor permitidos:** variaciones dentro de la misma familia de color o escala, como oscurecer un gris secundario para alcanzar AA, sin cambiar el matiz de marca.

### Prueba de reconocimiento

Cada familia de componentes debe superar esta prueba: junto a su versión actual, se identifica como el mismo producto. Si un cambio no la supera, se justifica por escrito o se revierte. Piero la valida por familia, con capturas lado a lado.

## 4. Arquitectura del sistema

El sistema se organiza en cinco capas; cada una solo depende de las anteriores.

1. **Fundamentos:** tokens de color, tipografía, espaciado, radios, elevación y glass, movimiento e íconos.
2. **Primitivos:** botón, campo, etiqueta de estado, avatar, ícono y superficie.
3. **Compuestos:** grupo o acordeón, tarjeta de indicador, calendario y selector de fecha, filtros, fila y modal.
4. **Patrones:** bandeja de solicitudes, lista agrupada, estados de carga, vacío y error, formulario y tablero de indicadores.
5. **Vistas:** consumen el sistema y no se rediseñan.

**Nomenclatura.** Prefijo `kja-` en componentes y variables. Los tokens siguen el formato `categoría-rol-variante` (por ejemplo `color-action-primary` o `surface-glass-bg`); los componentes usan `kja-<componente>` con modificadores de variante y atributos de estado (`aria-*`, `data-state`).

**Especificación de cada componente.** Propósito y cuándo no usarlo; anatomía; variantes; estados (normal, hover, foco, seleccionado, deshabilitado, error, carga); contenido permitido y longitudes; interacción y teclado; accesibilidad; tokens que consume; referencias a Figma y código; y qué cambia respecto al estado actual.

**Madurez.** Cada componente pasa por Propuesto, Piloto, Estable y Obsoleto, y su estado figura en el catálogo.

## 5. Fase 0 — Línea base y auditoría

Primero se mide y se inventaría; no se cambia nada. La salida es un inventario por función, una línea base numérica y una lista priorizada de discrepancias.

- Trabajar exclusivamente en la copia autorizada `KJA-trabajo-limpio`. Registrar rama, SHA y diferencias iniciales, conservar los archivos ajenos y comprobar de nuevo el PR #196 antes de implementar.
- Extraer los valores vigentes: variables CSS, familias tipográficas, paleta, radios, sombras y espaciados. Esos valores, y no los de las capturas, son la base de los tokens.
- Medir la línea base con un script repetible: colores distintos (hex, rgb, hsl), valores de radio, sombras, tamaños de fuente, variantes de botón y número de implementaciones de acordeón, calendario, tarjeta de indicador y etiqueta de estado. Fijar una meta para cada conteo.
- Contrastar `DESIGN.md` con el aspecto efectivo. Hoy documenta una base institucional fría mientras existen controles cálidos; se resuelve preservando la dirección visual aprobada.
- Aplicar better-ui al revisar superficies, íconos y movimiento, respetando las decisiones específicas de KJA.
- Empezar por Contratos, Colaboradores, Pasar lista y Seguimiento diario; seguir con el resto de vistas, formularios y modales.

### Detección de equivalentes por función

La matriz se organiza por función del usuario, no por clase CSS ni por vista, porque dos componentes equivalentes suelen tener nombres y estilos sin relación entre sí.

1. Listar las funciones que se repiten: elegir una fecha o un rango, leer un indicador, expandir o contraer un grupo, filtrar y buscar, seleccionar un destino, mostrar un estado, aprobar o rechazar, mostrar carga, vacío o error, mostrar a una persona, agrupar contenido en una superficie, conmutar entre vistas, abrir un modal o panel, y mostrar una lista o tabla.
2. Para cada función, recorrer todas las vistas y buscar su marcado y estilos en el código. Registrar cada implementación distinta: dónde vive, cómo se ve, cómo se comporta y qué código usa.
3. Comparar las implementaciones en apariencia, comportamiento (apertura, selección, teclado, foco) y contenido admitido.
4. Clasificar cada diferencia como **unificar** (sin razón de negocio para diferir), **corregir** (es un defecto, como contraste insuficiente o foco ausente) o **conservar** (una necesidad real del módulo la justifica), con motivo y evidencia. Distinguir lo observado en la interfaz de lo inferido por código.
5. Priorizar las funciones con implementaciones divergentes por frecuencia de uso y visibilidad de la inconsistencia, y repartirlas entre las etapas de la Fase 4. Las sospechas de partida (acordeones, calendarios, indicadores) se confirman o se descartan aquí.

**Salida:** matriz por función con ubicaciones, apariencia, comportamiento, código compartido, variantes, estados y problemas; capturas de escritorio; lista priorizada; línea base numérica. La inspección visual requiere un navegador cuyo acceso pueda verificarse (por ejemplo Playwright), registrando su versión y la carga real de la página.

## 6. Fase 1 — Dirección visual (medio día)

Las referencias externas sirven para pulir la identidad actual, no para sustituirla. Esta fase va después de la auditoría y antes de definir tokens, para no tokenizar dos veces.

- Reunir de 6 a 10 referencias de plataformas de gestión de personal, asistencia o administración con estética cálida en Dribbble, Behance, Mobbin, Refero o Land-book. Criterios: afinidad cálida, densidad comparable y uso en escritorio.
- Extraer una decisión por referencia en uno de cuatro ejes: superficies y glass, acordeones y agrupación, densidad de listas, estados y feedback.
- Registrar cada decisión en una hoja: referencia, eje, decisión, token que afecta, riesgo y veredicto. Una referencia sin decisión escrita no entra.
- Filtrar con la sección 2: una decisión que contradiga la columna «Se conserva» se descarta o pasa a otro ticket.
- Decidir el nivel de glass: translúcido sin desenfoque (lo actual), desenfoque ligero o desenfoque marcado. Punto de partida recomendado: translúcido con desenfoque ligero.
- Resultado: unas 10 decisiones aprobadas por Piero, anexadas a `DESIGN.md` como sección «Dirección visual».

## 7. Fase 2 — Fundamentos, tokens y guardarraíles

Los fundamentos formalizan los valores que el panel ya usa; solo se ajustan los que no cumplen accesibilidad o rompen la coherencia.

### Tokens en tres niveles

- **Base:** paleta, tamaños, espaciado, radios, tipografía, duraciones y parámetros de desenfoque.
- **Semántico:** texto principal y secundario, superficies, bordes, acción (primaria, secundaria, destructiva), foco y estados (pendiente, aprobado, rechazado, advertencia, informativo).
- **Componente:** valores específicos solo cuando una variante lo necesite, con justificación escrita.

### Fundamentos a definir

| Categoría | Qué se define | Criterio |
| --- | --- | --- |
| Color | Escalas de terracota, verde bosque y neutros cálidos; pares texto-superficie | Misma familia cromática actual; cada par cumple AA |
| Tipografía | Familias vigentes, escala de tamaños, pesos, interlineado y eyebrows | Tamaño mínimo para texto informativo; valores tomados del CSS |
| Espaciado | Escala sobre múltiplos de 4 px | Cada valor existente se asigna al escalón más cercano |
| Radios | Tres o cuatro escalones (campo, tarjeta, contenedor, píldora) | Menos valores distintos que la línea base |
| Elevación y glass | Niveles de sombra y `surface-glass` | Ver el apartado siguiente |
| Movimiento | 180/300/200 ms, curvas y movimiento reducido | Sin cambios de valor |
| Íconos | Set vigente, tamaños y grosor de trazo | Un solo estilo de ícono |
| Foco y estados | Anillo de foco, hover, seleccionado, deshabilitado | Visible sobre fondo claro y sobre glass |

### Glass

`surface-glass` es un conjunto de tokens: fondo con opacidad, desenfoque, borde, sombra y un fallback opaco para navegadores sin `backdrop-filter` o con transparencia reducida. Se aplica solo a contenedores (tarjetas, paneles, modales y rail), nunca a filas, celdas ni campos. El texto se apoya sobre fondos casi opacos y el contraste se valida contra el peor fondo posible.

### Flujo unidireccional

- Un archivo de tokens versionado es la única fuente de valores.
- Un script genera desde él las variables CSS del panel; otro sincroniza las mismas variables, con los mismos nombres y valores, en Figma.
- No se editan valores a mano en el CSS generado ni en Figma: el cambio se hace en el archivo de tokens y se propaga.
- La sincronización con Figma se ejecuta bajo demanda y reporta diferencias; no es automática ni en tiempo real.
- Los tokens administrativos se limitan al ámbito de escritorio del panel con `@layer` o una clase de ámbito, sin afectar al portal del colaborador ni acumular otra capa permanente de sobrescrituras.

### Documentación

- **`DESIGN.md`:** identidad, principios, dirección visual, jerarquía, densidad, accesibilidad, resumen de tokens, reglas para incorporar cambios y enlaces al catálogo. No repite anatomías.
- **Catálogo HTML interno:** documentación viva de cada componente (anatomía, contenido permitido, interacción, estados, variantes) con ejemplos ejecutables y datos ficticios, separado del flujo operativo y sin acceso al backend.
- **Registro de correspondencias:** componente, identificador de Figma e implementación, junto al catálogo.

### Guardarraíles automáticos

- **Contraste:** script de WCAG AA (4,5:1 para texto normal; 3:1 para texto grande y componentes de interfaz) sobre los pares semánticos, incluido el peor fondo de glass.
- **Colores literales:** una verificación falla si aparece un color literal en el CSS del panel fuera del archivo de tokens, con lista explícita de excepciones.
- **Accesibilidad automática:** axe-core sobre el catálogo.
- **Capturas:** Playwright captura el catálogo en 1280 × 720, 1440 × 900 y 1920 × 1080, por componente y estado, y las compara con la referencia aprobada.
- **Rendimiento:** prueba de `backdrop-filter` sobre contenedores con listas largas y desplazamiento.
- **Línea base:** un comando repite los conteos de la Fase 0.

## 8. Fase 3 — Rebanada delgada y piloto

Grupo por área es el piloto porque es acotado y visible, no porque sea el único problema. Valida el método (tokens, Figma, código, catálogo y guardarraíles) antes de aplicarlo a calendarios, indicadores y el resto de familias que detecte la auditoría.

Se crea el archivo Figma **KJA — Administración / Sistema de diseño**, organizado en Fundamentos, Componentes, Patrones, Vistas y Cambios, con variables, estilos tipográficos, Auto Layout y variantes explícitas. Se construye con el MCP de Figma. Al inicio solo se pueblan Fundamentos y los componentes del piloto; Patrones, Vistas y Cambios se completan al llegar cada etapa.

### Contenido de la rebanada

1. Tokens semánticos de acción y estado, que eliminan las diferencias de color entre componentes equivalentes.
2. Botón con jerarquía (primario, secundario, terciario, destructivo) y estados normal, hover, foco y deshabilitado.
3. Etiqueta de estado.
4. Grupo por área en Contratos y Colaboradores, construido con las piezas anteriores (Etapa A).

### Grupo por área

- Cabecera común con nombre, cantidad y control de expansión reconocible: cabecera completa clicable, chevron que rota y `aria-expanded`. «Mostrar/Ocultar» queda reservado para «ver más» sobre contenido truncado.
- Expansión independiente de varios grupos, compatible con teclado y con estado accesible.
- Se mantienen las políticas actuales de apertura y filtros de cada módulo: se comparte el mecanismo sin cambiar el flujo.
- Contenido interior específico: contratos, filas o tarjetas de personas.
- La interfaz compartida recibe identidad del grupo, título, cantidad, estado abierto y contenido, y emite la intención de expandir o contraer. El módulo conserva el estado y decide qué datos mostrar.
- Pruebas con nombres largos, cantidades distintas, búsqueda y grupos contraídos.

Se implementa con HTML, CSS y JavaScript, sin framework ni biblioteca externa de interfaz. Se reutilizan los selectores y controladores de carga existentes cuando cumplan el contrato. Los calendarios no forman parte del piloto: al tener varias interfaces, se tratan como familia propia en la Etapa C1.

**Puerta de avance:** Piero valida el piloto renderizado y su equivalente en Figma antes de extenderlo. Criterios: misma anatomía y estados en Figma y código; prueba de reconocimiento superada; contraste AA en verde; fallback de glass comprobado; conteos de acordeones y colores de estado actualizados.

## 9. Fase 4 — Adopción por etapas

Las etapas siguen un orden por defecto que se reordena al cerrar la Fase 0, según la prioridad de la auditoría. Cada etapa se entrega al agente de implementación como brief propio, con su alcance y criterio de aceptación, y nunca el ticket completo de una vez. Cada cambio es pequeño y reversible.

| Etapa | Alcance | Criterio de aceptación | Evidencia |
| --- | --- | --- | --- |
| A | Grupo por área en Contratos y Colaboradores (Fase 3) | Una sola anatomía con teclado y `aria-expanded`; políticas de apertura y filtros intactas | Capturas, pruebas de ambos módulos y validación de Piero |
| B | Patrones compatibles en Pasar lista y Seguimiento diario: acordeón, filas con identidad compartida y superficies | Filas de marcación y de revisión comparten estructura sin compartir acciones | Capturas en tres resoluciones y pruebas de ambas vistas |
| C1 | Tarjetas de indicador (variantes informativa y filtrable) y calendarios y selectores de fecha (día único, rango, con marcas) en las cuatro vistas | Una anatomía por función que reemplaza los diseños actuales; el selector de fecha reutiliza o sustituye a los existentes con un contrato definido | Catálogo, capturas por estado y pruebas de selección de fecha |
| C2 | Filtros (etiquetas, búsqueda, selección, fechas, limpieza, deshabilitado), estados (carga inicial, actualización, vacío confirmado, sin coincidencias, error inicial, error con datos anteriores), campos, avatares y superficies glass | Cada estado existe en catálogo y Figma; los datos válidos se conservan al actualizar y las respuestas tardías se invalidan | Pruebas de comportamiento compartido y verificación de carga lenta y rápida |
| D | Resto de vistas, formularios y modales, incluidas las familias nuevas de la auditoría | Cada vista pasa los guardarraíles; las excepciones quedan registradas con motivo | Matriz de la Fase 0 actualizada |
| E | Retirada de duplicaciones y revisión integral | Conteos de línea base en meta y ninguna discrepancia importante sin registrar | Comparación antes y después, capturas finales e informe único en la ficha |

### Reglas comunes a todas las etapas

- Separar presentación de consultas, permisos, cálculos, exportaciones y escrituras. Los componentes muestran estados recibidos; no deciden reglas de asistencia.
- Conservar las variantes justificadas: una fila de marcación y una de revisión comparten estructura e identidad sin compartir acciones ni todos sus campos.
- Sustituir los estilos antiguos por familia solo después de verificar sus consumidores.
- Actualizar la ficha KJA-051 y el contexto del proyecto sin duplicar el informe.
- Evaluar Code Connect únicamente cuando existan componentes reales; su disponibilidad no bloquea la entrega.

## 10. Gobernanza y mantenimiento

Un sistema de diseño se degrada si cada cambio es opcional. Estas reglas lo mantienen vivo sin añadir burocracia.

### Proceso de cambio de un componente

1. Comprobar si una familia existente cubre la necesidad; si es así, se reutiliza o se extiende.
2. Si no la cubre, proponer el componente o la variante con su función, los usos reales y la diferencia que lo justifica.
3. Implementarlo siguiendo la definición de terminado.
4. Registrar el cambio en la página Cambios de Figma y en el historial del repositorio.

### Definición de terminado de un componente

- Especificación completa según la plantilla de la sección 4.
- Figma con variantes y estados explícitos.
- Código con tokens y sin colores literales.
- Entrada en el catálogo con todos los estados.
- Accesibilidad verificada: contraste AA, teclado, foco visible y nombre accesible.
- Captura de referencia aprobada y registro de correspondencias actualizado.

### Versionado y obsolescencia

- Tokens y componentes llevan versión semántica simple y un registro de cambios.
- Un componente reemplazado se marca como Obsoleto, sus usos se migran por familia y se retira en la Etapa E.

### Regla de mantenimiento

Un cambio de componente actualiza el archivo de tokens (si aplica), Figma, código, catálogo y registro de correspondencias; `DESIGN.md` cambia solo si cambia un principio o una regla. Los guardarraíles detectan desfases, pero no sustituyen la revisión. No hay sincronización automática entre Figma y código.

### Responsables

Piero aprueba la prueba de reconocimiento y las puertas visuales. El autor de este plan es el responsable de tokens y catálogo: mantiene el archivo de tokens, el catálogo y el registro de correspondencias, revisa las solicitudes de cambio y ejecuta la sincronización con Figma.

## 11. Métricas de éxito y riesgos

### Métricas de éxito

La línea base se mide en la Fase 0 y se repite al cerrar la Etapa E. Las metas numéricas se fijan con esos datos.

| Métrica | Cómo se mide | Meta |
| --- | --- | --- |
| Colores distintos en el CSS del panel | Script de línea base | Solo los definidos en el archivo de tokens |
| Valores de radio y de sombra | Script de línea base | Los escalones definidos en la Fase 2 |
| Implementaciones por función (acordeón, calendario, indicador, etiqueta de estado, botón primario) | Matriz de la Fase 0 | Una por función, salvo excepciones registradas |
| Colores literales fuera del archivo de tokens | Verificación automática | Cero |
| Pares de color por debajo de AA | Script de contraste | Cero |
| Componentes con correspondencia entre Figma, catálogo y código | Registro de correspondencias | 100 % |
| Familias que superan la prueba de reconocimiento | Validación de Piero | Todas |

### Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| El pulido altera la identidad | Sección 2, prueba de reconocimiento y validación por familia |
| Las referencias de la Fase 1 amplían el alcance | Tabla de alcance y tickets aparte |
| Regresiones funcionales al sustituir componentes | Separación entre presentación y negocio, pruebas aisladas, etapas pequeñas y reversibles |
| Rendimiento del glass en listas largas | Prueba específica, fallback opaco y glass solo en contenedores |
| Desfase entre Figma y código | Flujo unidireccional, registro de correspondencias y capturas automáticas |
| Sobrescrituras acumuladas | `@layer` o clase de ámbito, retirada por familia y verificación de colores literales |
| Etapas demasiado grandes | División en C1 y C2 y repriorización tras la Fase 0 |
| Permisos de Figma insuficientes | Solicitar un destino editable antes de la Fase 3 |

## 12. Verificación, cierre y supuestos

### Validación visual y accesible

- Revisar 1280 × 720, 1440 × 900 y 1920 × 1080.
- Comprobar pocos registros, listas largas, textos extensos y grupos abiertos y cerrados.
- Verificar teclado, foco visible y conservado, nombres accesibles y contraste WCAG AA.
- Revisar los estados normal, hover, foco, seleccionado, deshabilitado y error según corresponda.

### Validación funcional

- Probar carga lenta y rápida, actualización, cambio de contexto, vacío, error y reintento.
- Conservar los datos válidos durante la actualización e invalidar las respuestas tardías.
- Mantener esqueletos `#e7e7e7`, reflejo blanco y movimiento reducido; conservar 180/300/200 ms y el revelado exclusivo de regiones que mostraron espera.
- Ejecutar las pruebas existentes de cada familia modificada y añadir pruebas de comportamiento compartido cuando aporten cobertura real.
- Comprobar con pruebas aisladas, sin escrituras operativas, que permisos, acciones y cálculos mantienen su comportamiento anterior.

### Criterios de cierre

- Cada componente tiene correspondencia entre Figma, documentación, catálogo y código.
- Cada uso administrativo está migrado o tiene una excepción explícita, y cada función de usuario tiene una sola implementación o diferencias justificadas por escrito.
- Las métricas de la sección 11 alcanzan sus metas y la comparación antes y después queda documentada.
- Todas las familias superan la prueba de reconocimiento.
- No quedan duplicaciones sustituidas ni discrepancias visuales importantes sin registrar.
- La evidencia distingue implementación local, integración y publicación.

### Supuestos y límites

- Se pule y consolida la identidad actual; no hay rediseño de marca ni cambios de layout o navegación.
- Alcance exclusivo de administración en escritorio. Se conservan las adaptaciones móviles existentes.
- No se ejecutan SQL, migraciones ni despliegues de funciones.
- Se preservan asistencia, permisos, historial y hora oficial del servidor en America/Lima.
- Se crea una biblioteca Figma nueva; si los permisos lo impiden, se solicita un destino editable antes de la Fase 3.
- La aprobación visual se hace sobre resultados concretos por familia. Merge y despliegue quedan fuera de este plan hasta una instrucción posterior.
