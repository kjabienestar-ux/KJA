---
name: "Portal KJA"
description: "Sistema visual cálido-profesional para la operación interna de KJA."
colors:
  institutional-navy: "#09244c"
  institutional-navy-deep: "#061a38"
  action-blue: "#075abc"
  kja-pink: "#ef0b72"
  accent-cyan: "#43c5d1"
  status-success: "#24a68a"
  status-warning: "#c97808"
  status-danger: "#c23b50"
  ink: "#15243a"
  text-muted: "#738095"
  surface-page: "#f6f8fb"
  surface-card: "#ffffff"
  surface-subtle: "#f8fafc"
  divider: "#e3e8ee"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(58px, 6.2vw, 82px)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(30px, 2.1vw, 38px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.14em"
  action:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  shell: "20px"
  card: "16px"
  panel: "12px"
  control: "10px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.surface-card}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface-card}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-muted}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  input-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "0 12px"
    height: "52px"
  card-standard:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  nav-active:
    backgroundColor: "#edf5ff"
    textColor: "{colors.institutional-navy}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "48px"
  status-success:
    backgroundColor: "#e4f7f0"
    textColor: "#08735a"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  status-warning:
    backgroundColor: "#fff0d7"
    textColor: "#79520e"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  status-danger:
    backgroundColor: "#ffe8ed"
    textColor: "#922e43"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
---

# Design System: Portal KJA

## Overview

**Creative North Star: "El Portal Institucional Cálido"**

El sistema combina una base institucional navy con superficies claras, acentos KJA y una presentación editorial contenida. La interfaz prioriza lectura operativa, estados reconocibles y controles cómodos, mientras reserva el carácter expresivo para el acceso, las cabeceras y el ambiente horario.

La densidad es moderada: los datos se organizan en tarjetas y paneles redondeados, con bordes suaves y elevación discreta. En escritorio, el portal puede usar vidrio ambiental y fondos que cambian con la hora o el clima; en móvil, la composición se simplifica en hojas y bloques de una sola columna sin perder jerarquía ni tamaño de toque.

**Key Characteristics:**

- Navy y azul como estructura institucional y acción.
- Rosa KJA y cyan como acentos breves de identidad y orientación.
- Superficies claras, bordes tenues y curvas consistentes.
- Fraunces para momentos editoriales; Inter para la operación cotidiana.
- Estados de asistencia expresados con texto, forma y color.
- Ambiente temporal gradual con alternativas para movimiento y transparencia reducidos.

## Colors

La paleta parte de azules profundos y superficies frías claras; el rosa y el cyan aportan identidad, mientras verde, naranja y rojo comunican estados operativos.

### Primary

- **Navy institucional** (`#09244c`): estructura la navegación, los encabezados, la acción principal y el texto de máxima jerarquía.
- **Navy profundo** (`#061a38`): refuerza fondos oscuros, degradados laterales y escenas nocturnas.
- **Azul de acción** (`#075abc`): identifica enlaces, focos, controles interactivos y estados activos.

### Secondary

- **Rosa KJA** (`#ef0b72`): firma la identidad en el acceso, avatares, énfasis y focos puntuales; no sustituye al navy como estructura.

### Tertiary

- **Cyan de orientación** (`#43c5d1`): acompaña indicadores activos, líneas de progreso y detalles de navegación.
- **Verde de confirmación** (`#24a68a`): comunica registro correcto, seguridad y cierre completo.
- **Naranja de atención** (`#c97808`): comunica tardanza, espera o requisitos pendientes.
- **Rojo de incidencia** (`#c23b50`): comunica error, incompletitud o acciones de riesgo.

### Neutral

- **Tinta operativa** (`#15243a`): texto principal sobre superficies claras.
- **Texto secundario** (`#738095`): ayudas, metadatos y descripciones.
- **Fondo de portal** (`#f6f8fb`): base clara del área de trabajo.
- **Tarjeta blanca** (`#ffffff`): superficie principal de controles, tarjetas y hojas.
- **Superficie tenue** (`#f8fafc`): campos, paneles internos y variaciones tonales.
- **Divisor frío** (`#e3e8ee`): bordes, separadores y estructura de tablas.

### Named Rules

**The Institutional Structure Rule.** El navy organiza la interfaz; el azul indica acción y los acentos KJA señalan momentos concretos, sin competir entre sí.

**The State Redundancy Rule.** Los estados nunca dependen solo del color: se acompañan de texto, icono, punto o forma de píldora.

## Typography

**Display Font:** Fraunces (con Georgia y serif como respaldo)  
**Body Font:** Inter (con `system-ui` y sans-serif como respaldo)  
**Data-entry Fallback:** Poppins aparece en algunos controles administrativos y de evidencias, seguido de Inter y sans-serif.

**Character:** Fraunces aporta calidez editorial a la entrada del portal. Inter mantiene el producto directo, legible y profesional en navegación, datos, formularios y estados; Poppins se conserva donde ya está especificada, sin convertirse en una tercera voz dominante.

### Hierarchy

- **Display** (600, `clamp(58px, 6.2vw, 82px)`, 0.96): titular principal del acceso sobre fotografía institucional.
- **Headline** (700, `clamp(30px, 2.1vw, 38px)`, 1.12): títulos de vistas y jerarquía principal del espacio de trabajo.
- **Title** (700, `20px`, 1.3): títulos de tarjetas, secciones y modales.
- **Body** (400, `14px`, 1.5): instrucciones, descripciones y contenido operativo; los bloques extensos se mantienen cerca de 70 caracteres por línea.
- **Label** (800, `10px`, `0.14em`, mayúsculas cuando corresponde): fechas, categorías, encabezados compactos y metadatos.
- **Action** (800, `13px`, 1.3): botones y acciones de alta prioridad.

### Named Rules

**The Editorial Accent Rule.** Fraunces se reserva para la entrada y los momentos de marca; la operación diaria permanece en Inter.

**The Readable Density Rule.** La información administrativa puede ser compacta, pero no reduce el texto por debajo de la escala legible observada para hacerlo caber.

## Layout

En escritorio, el portal usa un armazón de tres columnas: navegación lateral, espacio de trabajo flexible y una columna contextual. La composición base observada es de `236px / minmax(0, 1fr) / 330px`; la columna contextual desaparece por debajo de `1280px`, y el producto pasa a un flujo de una columna por debajo de `900px`. El área principal limita la lectura a un máximo amplio (`1440px`) y emplea rellenos fluidos entre 26 y 48px.

El espaciado recurrente sigue una cadencia de 4, 8, 12, 16, 24 y 28px. Los paneles operativos suelen usar 20–30px de relleno; controles y filas usan 8–16px. Los puntos de ajuste observados son 1280px, 900px, 650px y 430px, con tratamientos adicionales para pantallas estrechas de 360px y dispositivos táctiles de poca altura.

En móvil, las rejillas se apilan, las tablas densas se convierten en filas rotuladas o zonas desplazables y los modales se presentan como hojas inferiores. Los controles principales mantienen alturas de 44–54px y el contenido conserva márgenes laterales de 14–20px.

**The Progressive Collapse Rule.** Primero se elimina contexto secundario; después se apilan módulos. La acción principal y el estado de la jornada permanecen visibles.

## Elevation & Depth

El sistema combina capas tonales con sombras ambientales suaves. Las tarjetas descansan sobre fondos fríos con bordes translúcidos; las hojas, el acceso y los modales usan una elevación más marcada. En las vistas ambientales, reflejos, blur y degradados cambian con la hora y el clima sin alterar el contraste del contenido.

### Shadow Vocabulary

- **Tarjeta suave** (`0 10px 30px rgba(9,36,76,.055)`): tarjetas y módulos en reposo.
- **Superficie elevada** (`0 18px 50px rgba(9,36,76,.10)`): hojas, paneles y modales.
- **Acción principal** (`0 13px 27px rgba(11,35,71,.21)`): botones de acceso y acciones decisivas.
- **Cabecera ambiental** (`0 9px 24px rgba(7,31,58,.16)`): separa cabeceras oscuras del fondo horario.

### Named Rules

**The Soft Depth Rule.** La profundidad debe separar funciones, no decorar cada bloque; las superficies internas se distinguen primero por tono y borde.

**The Ambient Continuity Rule.** Cuando está activo el ambiente horario, fondo, cabeceras y vidrio comparten la misma fuente de luz y transición.

## Shapes

La forma base es suavemente redondeada y jerárquica. Los armazones y hojas usan curvas amplias (20px), las tarjetas principales curvas medias (16px), los paneles internos 12px y los controles 10px. Píldoras, estados y avatares circulares usan radio completo (`999px` o 50%). Los bordes son finos y fríos; los recortes más expresivos se reservan para la hoja móvil del acceso y los fondos atmosféricos.

**The Radius Hierarchy Rule.** El radio disminuye con la escala del objeto: armazón, tarjeta, panel, control y píldora mantienen una relación reconocible.

## Components

### Buttons

- **Shape:** controles compactos y táctiles con curva de 10–13px y altura habitual de 44–54px.
- **Primary:** fondo navy, texto blanco, peso alto y sombra breve; el acceso usa 52px de alto y relleno horizontal de 16px.
- **Hover / Focus:** el hover cambia a azul y puede elevarse 1px; el foco usa un contorno azul de 3px, o rosa en el acceso. El estado activo reduce la escala a 0.98.
- **Secondary:** superficie blanca, borde frío y texto gris azulado; el hover refuerza azul y fondo tenue.
- **Disabled:** fondo gris claro, texto atenuado y cursor no disponible; no conserva elevación.

### Chips

- **Style:** píldoras compactas con fondo tonal, texto de alta legibilidad y, cuando corresponde, un punto o icono.
- **State:** verde para completo/listo, naranja para pendiente o tarde, rojo para incompleto/error y gris para espera o sin entrada.

### Cards / Containers

- **Corner Style:** curva media (16px) para tarjetas; 12px para subpaneles.
- **Background:** blanco o superficie clara translúcida sobre el ambiente horario.
- **Shadow Strategy:** sombra de tarjeta suave y borde tenue; los módulos internos prefieren separación tonal.
- **Border:** línea fría de baja opacidad.
- **Internal Padding:** normalmente 20–28px en tarjetas y 12–18px en subpaneles.

### Inputs / Fields

- **Style:** campo blanco o gris muy claro, borde frío, altura de 44–52px y curva de 9–12px.
- **Focus:** borde azul en el portal y rosa en el acceso, con anillo visible de 3px.
- **Error / Disabled:** mensajes rojos sobre fondo rosado claro; controles deshabilitados usan grises y mantienen la etiqueta explicativa.

### Navigation

La navegación lateral usa Inter seminegrita, iconos lineales y filas de al menos 48px. El estado activo se expresa con fondo azul muy claro, texto navy, icono azul y una barra vertical cyan/verde azulado. En móvil, la navegación se convierte en cabecera compacta y panel lateral; los accesos rápidos se presentan como tarjetas táctiles.

### Daily Status and Closure

La jornada combina cronología, acción y checklist. La tarjeta derecha muestra siempre el panel operativo de pendientes: primero la entrada, luego las evidencias y finalmente la salida. No usa ilustraciones promocionales. Cada requisito usa una marca cuadrada redondeada, texto principal, explicación y estado; al activarlo abre un modal de carga enfocado. La salida solo se habilita cuando la evidencia requerida está lista. Los mensajes de éxito o error mantienen texto explícito y no se limitan a una variación cromática.

**The In-Place Closure Rule.** El panel de pendientes ocupa desde el inicio el lugar de la antigua tarjeta de marcado y se estira hasta igualar la altura del horario contiguo. Una guía de tres etapas comunica entrada, evidencias y salida; solo el paso activo pulsa suavemente. Los formularios de evidencia se resuelven en modal de escritorio y hoja inferior móvil; nunca se insertan como bloques largos dentro de la página.

**Private Evidence Review.** La revisión vive dentro de Administración como una mesa de trabajo, no como una tabla de enlaces. Dirección abre una persona, cambia entre sus entregas, inspecciona las imágenes sobre una superficie oscura y decide en el panel lateral. Pendiente usa ámbar, aprobado verde y corrección rojo; el texto siempre acompaña al color. Las URLs son temporales y solo aparecen durante una revisión autorizada. En móvil, galería y decisión forman un único flujo vertical desplazable.

**Area-scoped Read-only Review.** En `Mi equipo`, el líder técnico ve la misma evidencia visual de los miembros de su área, acompañada por una marca explícita de `Solo lectura`. Las decisiones permanecen ausentes y un mensaje explica que solo Dirección aprueba u observa. La separación por área se aplica en RPC y Storage, no solo en la interfaz.

**Daily Exception Control.** Dirección recibe un tablero operativo separado de las acciones de cierre. Las excepciones aparecen primero, con una línea semántica discreta, estado escrito y cifras filtrables. La exportación conserva exactamente el conjunto visible. El tablero nunca transporta rutas privadas de evidencias: para inspeccionar o actuar, conduce a `Cierres y entregables` manteniendo fecha y área.

**Fair Assignment Preview.** Los sorteos de entregables nunca se confirman a ciegas. Dirección primero ve nombres, cantidad disponible y carga individual de los últimos 30 días; después confirma esa selección exacta. La previsualización permanece dentro del formulario de asignación y desaparece cuando cambia cualquier criterio relevante.

**Impediment Is Information, Not Completion.** El aviso de impedimento vive dentro del requisito pendiente y usa ámbar para comunicar atención sin confundirse con un error técnico. Siempre explica que la evidencia y la salida continúan pendientes. Dirección lo incorpora a su control diario y el líder técnico lo ve únicamente dentro de su área; ninguna de esas vistas convierte el aviso en aprobación, asistencia u horas.

**Recognizable Evidence Tasks.** Los requisitos del cierre no comparten un indicador genérico: Facebook conserva su azul e ícono, RPE usa ámbar cuando requiere acción y la fotografía de salida usa cyan. Al completarse, todos convergen en verde y texto `Completo`. La evidencia de hora de salida aparece desde el inicio, pero declara `Al finalizar` hasta que comienza su ventana permitida.

## Do's and Don'ts

### Do:

- **Do** usar navy para estructura y acciones de máxima prioridad, azul para interacción y rosa/cyan como acentos limitados.
- **Do** conservar la jerarquía de radios de 20, 16, 12, 10px y radio completo para estados.
- **Do** mantener controles táctiles de al menos 44px en flujos principales y modales.
- **Do** acompañar verde, naranja y rojo con texto, iconos o indicadores de forma.
- **Do** respetar `prefers-reduced-motion` y `prefers-reduced-transparency` en efectos ambientales y vidrio.
- **Do** simplificar la composición por debajo de 900px sin ocultar la acción principal ni el estado de la jornada.

### Don't:

- **Don't** usar Fraunces para tablas, formularios o navegación operativa.
- **Don't** convertir el rosa KJA en el color estructural dominante del dashboard.
- **Don't** aplicar sombras fuertes a cada subpanel; reservar la elevación marcada para hojas, modales y acciones decisivas.
- **Don't** comunicar asistencia, error o completitud únicamente mediante color.
- **Don't** comprimir tipografía administrativa para evitar un scroll o un cambio de composición.
- **Don't** introducir una nueva escala de curvas o colores cuando los tokens incumbentes cubren el caso.

## KJA Precision — alcance exclusivo de `dashboard.html`

`KJA Precision` es una capa visual local aplicada únicamente a `dashboard.html`; no modifica ni sustituye el sistema de diseño global descrito en este documento. Usa tipografía del sistema (`-apple-system`, BlinkMacSystemFont, `Segoe UI`, `system-ui`, sans-serif), canvas `#f5f5f7`, superficies blancas e tinta `#1d1d1f`. El azul `#0066cc` se reserva para interacción, mientras éxito, advertencia y peligro conservan colores semánticos acompañados de texto o forma. La composición se apoya en hairlines, radio principal de `18px` y sombras mínimas; hover y tap nunca aplican zoom. Los modales emplean blur funcional para separar contexto y, en móvil, los accesos principales se organizan en una cuadrícula de dos columnas.

## Chat — alcance exclusivo de la mensajería flotante

La superficie implementada en `assets/css/paginas/dashboard-chat.css` y `assets/js/dashboard-chat.js` trabaja en modo **operate**: conserva la identidad institucional navy/azul e Inter, con superficies blancas, iconos SVG lineales y avatares de iniciales. Las cabeceras y el acceso usan navy; los mensajes propios y las acciones usan azul. El texto secundario (`#526279`) y las insignias de mensajes sin leer (`#c9005e`, con texto blanco) son ajustes locales de contraste del chat; no redefinen tokens globales ni valores de `.impeccable/design.json`.

El acceso y el directorio flotan abajo a la derecha. El directorio mide 330px, las conversaciones de escritorio 310px y se mantienen como máximo dos ventanas abiertas, con minimizar/restaurar y cerrar. Por debajo de 1050px, abrir el directorio oculta visualmente las conversaciones; hasta 700px se muestra solo la última ventana, con ancho limitado al viewport y separación de la navegación inferior y del área segura. Los paneles blancos usan curvas de 14–16px y sombra para distinguir la capa flotante.

La búsqueda por persona y los filtros Equipo/Dirección mantienen la navegación compacta. Los controles incluyen etiquetas accesibles, foco azul visible de 3px, anuncios de nuevos mensajes y estados escritos. Enter envía y Shift + Enter inserta una línea; Escape cierra el directorio o minimiza la conversación enfocada. La consulta periódica ocurre cada 5 segundos y se suspende cuando la página está oculta. Los estados de conexión, historial vacío, envío, error y cuenta desactivada conservan explicaciones textuales.

No se incorporaron imágenes raster ni existe una composición visual aprobada. El navegador no estuvo disponible: la comprobación visual y de interacción en escritorio/móvil sigue pendiente. Las pruebas de comportamiento del código y las pruebas SQL aisladas pasaron; no acreditan validación visual ni activación en producción. El contexto específico se conserva en `.impeccable/chat-brief.md`.

## Zoom — gestión y agenda semanal

La vista de Zoom usa una superficie blanca, tipografía del sistema, controles de 8 px y azul #0b5cff para acciones principales, con enlaces #075abc. Esta revisión queda limitada a Zoom y no redefine los tokens globales. Las reuniones vinculadas y sus acciones aparecen antes de la agenda; al abrir el formulario, se ocultan temporalmente las listas y la conexión para concentrar la edición. En escritorio las etiquetas y los campos se alinean en dos columnas; hasta 700 px se apilan.

La agenda presenta siete filas de lunes a domingo con controles Anterior, Esta semana y Siguiente, fecha y sesiones en dos columnas y apilado móvil. Solo muestra fechas sincronizadas de Zoom en hora de Lima. Los estados describen el horario programado, nunca acreditan presencia del anfitrión. El contenedor de trabajo de Zoom restaura el desplazamiento vertical en escritorio frente al recorte del armazón administrativo; hasta 900 px vuelve al flujo de página. Revisión de código realizada; el desplazamiento real, la composición y la interacción visual siguen pendientes de comprobar por falta de navegador disponible.

La adaptación móvil de Zoom, hasta 900 px, elimina el margen lateral del espacio de trabajo y deja un único desplazamiento de página, con separación para la navegación inferior y las áreas seguras. Las acciones se distribuyen en rejillas, los campos usan texto de 16 px y altura mínima de 48 px, y la agenda apila fecha, hora y sesión. Guardar y cancelar permanecen en el flujo del formulario para evitar una barra fija junto al teclado; el diálogo de cancelación limita su altura y permite desplazamiento interno. La hoja se publica con una nueva versión de caché. La revisión de cascada no sustituye la comprobación pendiente en un navegador móvil.

La revisión móvil posterior protege el margen interior de Zoom con 20 px laterales frente a las reglas del armazón administrativo. La cabecera conserva únicamente Actualizar; Configuración y ayuda agrupa los controles de vinculación, creación y conexión en un desplegable inicialmente cerrado. Cada reunión mantiene Iniciar reunión o Unirme como acción principal y reserva la gestión para Opciones de la reunión. La ayuda aclara que las salas internas se administran dentro de Zoom y que el portal no comprueba su apertura. Estos cambios se revisaron en código; la composición final y el comportamiento táctil permanecen sin validación visual por falta de navegador disponible.

## Zoom — piloto Meeting SDK en computadora

`zoom-sala.html` es una pantalla aislada del dashboard para iniciar una reunión de ensayo mediante Zoom Meeting SDK. Conserva una superficie clara, tipografía del sistema, acciones azules y estados escritos. Lista las reuniones autorizadas y mantiene deshabilitado el inicio fuera de la reunión piloto, sin configuración o desde celulares y tabletas. La delegación otorga permiso de anfitrión para una reunión específica, sin acceso general a la administración; retirar ese permiso bloquea nuevos inicios y no expulsa una sesión abierta.

Tras entrar, el SDK proporciona la interfaz de reunión y un desplegable Control KJA permite consultar las salas y solicitar su apertura cuando el estado recibido lo permite. La ayuda dirige la recuperación de preasignaciones y la autoselección al panel de Zoom. La revisión cubre únicamente código y estados de interfaz: las salas, los permisos efectivos, la autoselección y la convivencia visual con el SDK todavía requieren un ensayo real en computadora. No existe validación visual del piloto.


### Actualización del lobby Zoom

La pantalla previa a la reunión usa navegación blanca, canvas #f5f5f7 y contenido de hasta 1156 px. Las reuniones comparten una superficie con separadores: título, disponibilidad escrita, explicación, acción a la derecha y responsables en una lista que permite saltos de línea. Administrar responsables permanece en un details nativo; el formulario usa dos columnas y se apila hasta 640 px, con campos de 16 px y controles de 48 px en móvil. Los estilos están limitados al lobby y Control KJA; la interfaz de la reunión sigue perteneciendo al SDK. Colores locales: interacción #075bb5, hover #064a94, texto #1d2635, secundario #526176, disponibilidad #146445, mensaje #e9f1fb con texto #234973. Tipografía local 12–19 px y título fluido 28–36 px; controles 8 px y superficies 16 px.

Las tres pruebas simuladas de interfaz pasan. La revisión estática no encontró defectos materiales nuevos; el revisor no completó su informe final por límite de uso. El detector funcionó en modo degradado y solo informó diferencias con el sistema global. No hay validación visual en navegador disponible. El usuario confirmó previamente el inicio delegado, el ingreso a salas y la selección de sala mediante el engranaje del SDK; eso valida el ensayo funcional anterior, no el nuevo diseño visual.


La agenda Zoom revisada presenta una columna de fechas con numeral de 26 px, día y mes; el día actual tiene fondo azul suave. Las sesiones separan hora, duración legible en horas/minutos y título. Los días vacíos conservan el contexto de semana con texto corto; la explicación de sincronización se concentra en un details. Hasta 700 px se apilan fecha y sesiones, manteniendo hora y título alineados. Fechas completas accesibles mediante aria-label. Pruebas de navegación semanal: 9 aprobadas. Validación visual pendiente por ausencia de navegador disponible.


El acceso personal de Zoom en Inicio reemplaza la franja superior por un botón flotante azul de cámara blanca (58 px, 54 px en móvil), situado encima de Mensajes. Abre un dialog nativo con reuniones autorizadas, hora y acción Unirme; siempre usa el acceso de participante. Escape/cierre nativo y limpieza al cerrar sesión. El modal tiene ancho máximo 520 px, scroll interno y acciones de ancho completo en móvil. La apertura del enlace depende de la asociación de Zoom y del permiso del navegador. Pruebas simuladas de modal y logout; visual pendiente.


### Zoom SDK: refinamiento de acceso
Cabecera azul Zoom con cámara blanca, título y explicación juntos. Reunión con título de 24px, disponibilidad separada del estado en vivo, acción principal de 50px y responsables en etiquetas compactas. Información de prueba fuera de la cabecera para mantenerla legible. En móvil: cabecera compacta, botón de ancho completo y columna única; a 380px la cámara pasa encima del título. Se conservan permisos y lógica SDK. Verificación funcional automatizada; revisión visual en navegador pendiente por falta de navegador disponible en la sesión.

## Dirección visual de administración · KJA-051

Piero eligió la superficie A para el piloto de escritorio: crema translúcida sin desenfoque, con alternativa opaca. El grupo por área muestra el nombre, el conteo con su unidad y un chevron; la cabecera completa admite clic y teclado. La política inicial de apertura y las acciones interiores corresponden a la vista.

[Catálogo del piloto](docs/auditorias/KJA-051/catalogo.html) · [Tokens fuente](assets/admin-tokens.json) · [Biblioteca editable en Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP). Regenerar CSS con `node scripts/generate-admin-tokens.cjs`. Componentes de Figma: grupo 1:15, botones 3:8 y etiqueta 3:17. La aprobación de superficie precede a la revisión del piloto.

### Búsqueda y filtros de área en escritorio

En administración, los campos de búsqueda y el selector de área comparten superficie crema, altura mínima de 42 px y foco visible. El menú permite buscar sin distinguir tildes y recorrer opciones con las flechas. Enter confirma y devuelve el foco al botón. En Pasar lista, elegir Todas las áreas restablece el alcance de la lista para el día consultado. [Referencia visual](docs/auditorias/KJA-051/filtro-area.png).

### Acciones de Pasar lista en escritorio

La acción principal usa fondo terracota cuando es el único camino para recuperar la lista. Actualizar, Quitar filtros y el reintento con datos previos usan superficie crema y texto verde. Los controles comparten una altura mínima de 38 px y un contorno de foco visible. [Variantes en Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=3-8).

**Contrato de acciones (escritorio).** Las cuatro jerarquías primario, secundario, terciario y destructivo comparten cinco estados: normal, hover, presionado, foco y deshabilitado. Primario y destructivo oscurecen el fondo mediante sus tokens `action-*-hover` y `action-*-pressed`; las variantes de superficie usan `surface-hover` y `action-neutral-pressed`. El foco agrega el anillo verde, sin halo de campo. Deshabilitado usa `action-disabled-bg` y `action-disabled-text`, con opacidad completa y sin respuesta de hover o pulsación; conserva el texto legible. La base usa `action-radius` de 10 px, altura mínima de 38 px, borde de 1 px y padding 8 × 14 px; los formularios de 44 px y las acciones compactas mantienen su densidad justificada. No usar el estado presionado como selección persistente. [Matriz de 20 variantes](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=128-362).

**Filtros de selección.** Facebook usa pastillas de 32 px y Ranking segmentos compactos de 30 px. Ambos tienen seis estados explícitos (normal, hover, presionado, seleccionado, foco, deshabilitado) con los tokens comunes, sin confundir selección con pulsación. La selección permanece estable al pasar el puntero. El fondo de contador seleccionado de Facebook usa `filter-selected-count-bg` con texto blanco y contraste AA; el segmento de Ranking usa superficie opaca y texto terracota sobre el fondo neutro del grupo. Las alturas, radios y padding horizontal están ligados a sus variables de familia. [Matriz editable de 12 estados](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=133-394) · [Catálogo](docs/auditorias/KJA-051/catalogo.html#estados-filtros).

**Pestañas de línea y selectores comunes.** Las pestañas de Colaboradores, Acceso, perfil, edición y Seguimiento usan un indicador activo terracota de 3 px, asociado a `tab-indicator-width` y `tab-indicator-color`. Las pestañas simples comparten altura mínima 44 px, separación 24 px y padding horizontal 5 px; los pasos de alta, las tarjetas de actividad y los segmentos compactos conservan su anatomía propia. El foco interior de 2 px evita el recorte de un contorno exterior en las bandas desplazables. El selector común usa radio 10 px, altura mínima 42 px (44 px en formularios), borde neutro de 1 px y subrayado de selección de 2 px, que no desaparece al enfocar. Al abrir, el foco pasa al buscador y el chevron gira, sin un segundo contorno en el disparador. Las opciones del menú (36 px, radio 9 px) distinguen hover, foco virtual y check persistente. Su elevación usa `selector-menu-shadow`. [Matriz editable](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=144-457).

**Geometría y elevación de superficies.** En escritorio, `radius-control` (10 px) es la base de acciones y selectores; `radius-compact-card` (12 px) se usa en subtarjetas, `radius-card` (16 px) en tarjetas, `selector-menu-radius` (18 px) en menús flotantes, `radius-dialog` (20 px) en diálogos y `radius-pill` (999 px) en píldoras. Los radios compactos de iconos y opciones se justifican por su densidad. Las tarjetas elevadas usan `surface-card-shadow` (0 2 4 px, marrón al 2,4 %), menús `selector-menu-shadow` (0 16 38 px, marrón al 14 %) y diálogos `surface-dialog-shadow` (0 20 60 px, marrón al 18 %). Las filas, divisores y tarjetas estructurales no ganan sombras por fuerza. Acceso adopta la superficie cálida sin desenfoque, con alternativa opaca; la escala de espaciado estructural se aplica donde corresponde con 12, 16 y 24 px. Las barras y puntos del Resumen consumen los tokens semánticos de gráfico, conservando texto y porcentajes para no depender solo del color. [Fundamentos visuales](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=153-534).

**Tipografía operativa.** `font-ui` = Inter, con fallback del sistema; `font-display` = Fraunces, Georgia y serif como fallback. Caption 11 px, pequeño 12 px, control 13 px, cuerpo/acción 14 px, sección 16 px y título display de referencia 28 px; el interlineado habitual es 1,4. Las opciones compactas conservan 12,5 px, los nombres de colaborador su jerarquía de 14,5 px y los títulos mayores pueden crecer según contexto. En escritorio no reducir texto informativo por debajo de 11 px para encajar; las iniciales decorativas de avatares de tamaño reducido admiten 10 px porque el nombre completo está presente. Se conservan los tamaños de cifras y la jerarquía especializada por pantalla. Aplicar los estilos de texto en Figma con sus nombres semánticos, no fuentes sustitutas importadas. [Escala y estilos editables](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=157-285).

**Espaciado y tinta secundaria.** Los tokens estructurales `space-4`, `space-8`, `space-12`, `space-16`, `space-20`, `space-24` y `space-32` forman la escala base de escritorio. Los componentes compactos conservan el padding de su familia, los valores ópticos y los tamaños de icono justificados. `text-secondary` (`#5c564f`) reemplaza los grises heredados para descripciones, metadatos y leyendas; no confundir texto auxiliar con texto deshabilitado ni con tintas de estado. Los códigos informativos de Pasar lista conservan sus letras P/T/J/NG y usan fondos oscuros semánticos con texto claro: éxito, advertencia, justificado y neutro. En Ranking, las etiquetas de empate del podio usan pares claros oro, plata y bronce con tinta oscura; el puesto sigue identificado por texto y contexto. El botón Nueva asignación mantiene el texto blanco sobre la acción terracota. [Espaciado](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=163-285) · [Leyendas e indicadores](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=169-250).

**Paleta y fondos complejos.** `surface-canvas` (#f0ece5) representa el fondo cálido de trabajo; `surface-accent-tint` (#f2e2d5), el tinte de acento, y `divider-subtle` (#ded6cb), los separadores decorativos. El divisor no reemplaza `field-border`, que delimita controles interactivos. `text-secondary` también se usa en placeholders y encabezados cortos del calendario. El campo de búsqueda de Asignaciones tiene radio de control y borde neutro; el reintento del calendario reutiliza la acción primaria y permanece visible en escritorio, incluso cuando el mensaje informativo normal se oculta por densidad. Al reintentar por teclado se devuelve el foco al calendario o al reintento si persiste el fallo. [Paleta y controles](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=180-209). Para validar fondos degradados o imágenes que axe no resuelve, se mide el fondo renderizado bajo los glifos en una captura de ensayo, sin asumir que un resultado no calculable cumple AA.

### Estado de jornada en Pasar lista

La etiqueta informativa incluye el nombre completo del estado y un punto del mismo color. La jornada completa o regularizada comparte el verde de confirmación. El cierre incompleto usa rojo, la tardanza ámbar y la justificación violeta. El turno por comenzar y la salida lista llevan contorno. Las marcas de asistencia se operan desde el grupo de botones al final de la fila. [Variantes en Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=20-26).

### Selección de asistencia

Pasar lista muestra cuatro controles con nombre accesible completo. Un visto junto a la abreviatura identifica la selección. P usa verde, T ámbar, J violeta y NG gris. El foco de teclado rodea un control; durante una actualización el grupo deshabilitado muestra un contorno discontinuo y mantiene legible su selección.

### Avatar en las filas principales

En Pasar lista y Seguimiento diario, el avatar de escritorio ocupa 40 × 40 px, con radio de 12 px. Las iniciales se centran en el mismo espacio que la foto y usan los colores compartidos de identidad. El nombre adyacente identifica a la persona para lectores de pantalla.

### Resultados vacíos de Pasar lista

Una consulta resuelta sin colaboradores muestra la indicación de elegir otra fecha. Cuando hay personas y el filtro las excluye a todas, la superficie muestra los criterios aplicados y la acción Quitar filtros. Al activarla se conserva la fecha y el foco vuelve al buscador.

### Fallo de actualización con datos anteriores

Pasar lista conserva la consulta de la misma fecha y muestra un aviso ámbar con borde neutro uniforme de 1 px encima de las filas. El título informa del fallo y el texto explica el bloqueo temporal de la marcación. Reintentar usa el botón secundario.

### Filas durante la consulta de asistencia

Al abrir una fecha, cada dato pendiente ocupa su posición en gris neutro. Las etiquetas Entrada, Salida y Evidencia siguen visibles. En la actualización de la misma fecha se conserva el contenido consultado y se bloquea la marcación hasta resolver la petición. Con movimiento reducido, las reservas de espacio quedan estáticas.

### Campos de Registrar entrada

En escritorio, los campos de Datos de la jornada comparten relleno crema opaco y el color de borde de los filtros. El foco de teclado usa el contorno verde de 2 px separado del borde por 2 px, con un halo verde centrado de baja opacidad definido en el token de foco de campos. Fecha y hora mantienen sus controles nativos.

**Contrato transversal de interacción (escritorio).** El borde normal de campos usa `field-border` y `field-border-width` (1 px). El foco visible conserva este borde y añade un único anillo exterior `focus` (#527966), `focus-ring-width` (2 px) y `focus-ring-offset` (2 px); los campos editables y selectores añaden `field-focus-shadow`. Para un campo compuesto, el anillo y el halo pertenecen al contenedor, no al control interno. Los botones no requieren halo; los grupos de área, indicadores y controles numéricos compactos pueden usar el mismo ancho con desplazamiento interior para evitar recorte. La selección persistente es independiente del foco: `selection-border` comparte actualmente el verde, pero utiliza un borde de 1 px y no un halo permanente; donde el patrón aprobado usa selección terracota, se conserva. En Figma los colores y grosores comunes se vinculan a variables, el halo al estilo Campos / Halo de foco. [Patrón editable de foco y selección](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=124-26).

**Controles compuestos y casillas.** En escritorio, solo un selector de área debe estar visible y ser alcanzable; el anterior queda oculto e inerte al activar el selector compartido. La búsqueda y el selector mensual tienen un único fondo opaco y borde exterior; las piezas internas son transparentes y no dibujan un segundo campo. Las casillas de filtros tienen 18 × 18 px, radio de 4 px, borde de campo de 1 px y marca blanca sobre terracota en estado marcado. El foco de teclado rodea la casilla (2 px de grosor y 2 px de separación), sin halo ni cambio de tamaño; se conserva el control nativo en colores forzados. Nueva asignación usa la acción primaria sin sombra ni transformación en normal, hover y activo, con transición limitada a colores, sin animar elevación. Estas reglas no cambian los controles móviles.

**Foco en superficies de acento.** Un campo compuesto sobre terracota conserva el anillo verde con soporte opaco crema para que el contorno se distinga; la acción Copiar embebida tiene contorno blanco interior de 2 px (foco inverso), independiente del foco del campo de solo lectura. Las unidades auxiliares y coordenadas usan tinta secundaria y al menos 11 px.

### Evidencia recibida en Registrar entrada

El selector vacío muestra un borde discontinuo y los formatos y tamaño admitidos. Al adjuntar una imagen, el borde pasa a continuo y la acción Cambiar imagen usa el marrón oscuro del texto principal junto a la vista previa. El foco de teclado rodea el selector completo con el mismo halo de los demás campos.

### Diálogo de registro de entrada

El encabezado identifica la operación. Los datos de jornada y la evidencia forman dos columnas con títulos propios; el pie conserva Cancelar y la acción principal Registrar entrada. El mensaje de validación aparece sobre las acciones y el formulario conserva los datos durante la corrección. [Vista de escritorio](docs/auditorias/KJA-051/registrar-entrada.png).

### Carga delegada de evidencia

La columna izquierda identifica el requisito y la derecha contiene los archivos y los datos de la entrega. La selección usa superficie verde tenue. La nota y la hora comparten borde y foco con Registrar entrada. Al alcanzar el límite del requisito, el selector reaparece al quitar un archivo. La miniatura muestra la imagen completa; el botón principal indica que Dirección carga en nombre del colaborador.

### Decisión de Dirección en Seguimiento

Aprobar evidencia usa la acción principal. Solicitar corrección usa la secundaria y requiere una observación de al menos tres caracteres. Si falta, el foco vuelve al campo. Al completarlo, se retira el aviso. La observación sigue siendo opcional al aprobar.

### Entregas con varios archivos en Cierres

La observación corresponde a la entrega. Revisar otro archivo de esa entrega conserva el texto. Elegir una entrega distinta abre su propio contexto. Las flechas recorren las pestañas; Inicio y Fin seleccionan los extremos. Dirección dispone de Aprobar evidencia y Solicitar corrección. La consulta privada de área presenta archivos, comentarios e historial.
La pestaña activa da nombre al panel de la entrega para lectores de pantalla, también al cambiar entre entregas.

En escritorio, el selector de archivo ocupa su propia fila. La vista previa aprovecha el alto restante y mantiene visibles el contador y la acción de apertura. El PDF reserva espacio para su pie.

### Días libres

Cantidad y Motivo comparten el estilo de campos de escritorio. La acción principal indica el movimiento seleccionado (Agregar días o Descontar días). Cancelar usa la acción secundaria. [Vista del formulario](docs/auditorias/KJA-051/dias-libres.png).

### Plazo de cierre en Asignaciones

Las flechas recorren los márgenes predefinidos. Otro abre el campo de minutos y lleva el foco a él. El ejemplo horario se actualiza al escribir. Guardar se habilita cuando el valor es válido y distinto del margen vigente. [Portal](docs/auditorias/KJA-051/plazo-cierre.png) · [Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=48-36).

### Tipo de entregable y destino

Nueva asignación tiene dos grupos independientes de selección única. Tab entra por la opción seleccionada. Las flechas cambian de opción e Inicio y Fin recorren los extremos. La selección usa fondo crema y borde terracota; el foco verde identifica el control que recibe el teclado. [Vista en el portal](docs/auditorias/KJA-051/asignacion-selectores.png).

### Destinatarios en Nueva asignación

El selector muestra nombre y área al elegir una persona. Su buscador admite texto sin tildes, anuncia la búsqueda vacía y permite recorrer resultados con las flechas. Enter elige y Escape vuelve al control de origen. El título y las indicaciones comparten la superficie y el foco de los campos administrativos. [Vista de escritorio](docs/auditorias/KJA-051/asignacion-destinatario.png).

### Propuesta de sorteo

La previsualización recibe el foco y agrupa a las personas con su carga reciente. El botón de confirmación indica cuántas asignaciones se crearán. Editar el formulario invalida la propuesta. [Vista de escritorio](docs/auditorias/KJA-051/sorteo-propuesta.png).

### Asignaciones del día

Entregada identifica una entrega recibida que espera revisión. Concluida identifica la aprobación. El contador del listado responde a la búsqueda y el resumen conserva los totales de la fecha. La lista distingue una fecha vacía de una búsqueda sin coincidencias. [Vista de escritorio](docs/auditorias/KJA-051/asignaciones-dia.png).

### Calendario de Asignaciones

La fecha seleccionada usa un círculo terracota y los días con entregables llevan un punto. Hoy recupera el mes y la fecha de trabajo actuales. El resumen presenta Asignadas, Pendientes, Por revisar y Concluidas en tarjetas de altura natural. [Vista de escritorio](docs/auditorias/KJA-051/calendario-asignaciones.png).

### Calendario individual de Mes completo

Cada día conserva el color de su estado: verde para presente/compartido, ámbar para tardanza/pendiente, morado para justificado, rojo para incidencia y fondo neutro para días sin estado. En escritorio, hover cambia el borde a tinta secundaria sin alterar el relleno; la selección persistente usa un contorno terracota de 2 px interior, y el foco de teclado un anillo verde de 2 px separado 2 px. Las etiquetas usan al menos 11 px y los días futuros permanecen deshabilitados. Seleccionar por teclado no cierra el modal; Escape y el clic fuera sí lo cierran y recuperan el disparador. La acción Ver mes permanece dentro de la columna del colaborador incluso a 1024 px. Se conserva la presentación azul del calendario personal/administrativo móvil existente. [Catálogo](docs/auditorias/KJA-051/catalogo.html#mes-ranking) · [26 variantes en Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=194-211).

**Superficies especializadas (tokens v0.7.0).** `surface-white` es blanco puro reservado para QR y superficies de carga; `surface-scrim` es el fondo cálido semitransparente de un diálogo; `loading-shine` es el blanco translúcido del reflejo de carga, manteniendo el gris `loading-neutral` y las reglas de movimiento reducido. La elevación de tarjetas, diálogos y menús usa sus respectivos tokens; las acciones primarias no adquieren sombras al pasar el cursor.

**Reconciliación semántica v0.7.1.** El fondo y texto deshabilitados y el fondo neutro presionado son alias de los estados neutros; el indicador de pestaña es alias de la acción primaria. Figma usa las mismas variables, con los estilos de texto y efecto para los tokens que no se representan como variables de color/número. Las superficies de tarjetas usan 16 px, los controles 10 px, los grupos segmentados 8 px y los menús flotantes 18 px; las esquinas exteriores del anillo de foco se calculan con el radio del control más la separación y el grosor, no se confunden con la geometría del control. Las marcas de gráficos y barras pueden conservar sus radios funcionales, no son elevación. La acción global Actualizar es secundaria en todas las secciones de Gestión: fondo opaco, tinta verde, borde neutro, sin sombra y foco exterior común. Los símbolos de evidencia Sí/No usan tinta blanca sobre el fondo de estado oscuro, no sobre los colores reservados a gráficos.

En hojas con consumidores compartidos, el alias `var(--kja-rol, valor-anterior)` conserva el valor heredado fuera del alcance de escritorio administrativo. Las excepciones y sus consumidores se registran y verifican; un valor no observado no se declara automáticamente fuera de alcance. Las comprobaciones de cierre deben ejecutarse sobre el mismo código y distinguir colores realmente pintados de propiedades computadas sin impacto visual.

**Geometría v0.7.2.** Se usan 3 px para marcas de gráficos, 4 px para indicadores y 6 px para etiquetas compactas; el radio del workbench es alias de los 20 px de diálogo. Las acciones no tienen sombra. La elevación corresponde a superficies, menús y diálogos; un anillo de selección o foco no es elevación. La identidad por área, las ilustraciones de ranking y los fondos ambientales tienen tratamiento explícito y no autorizan introducir colores literales en controles comunes. El [registro de correspondencias](docs/auditorias/KJA-051/correspondencias.json) vincula familias, secciones del catálogo, capas editables de Figma y consumidores de código; cualquier variante nueva debe añadir su referencia y sus pruebas. El informe de asistencia en pantalla usa la misma jerarquía y estados semánticos del panel, sin cambiar el formato de descarga.

**Cierre v0.7.3.** Los cuatro indicadores circulares de Resumen operativo usan la paleta de series `chart-overview-*`, con los seis valores ya aprobados (verde, terracota, ocre, azul grisáceo, neutro y sin datos), separados de los colores de estados y de los gráficos de detalle. El anillo mantiene los datos y su leyenda textual accesible con hover y foco. En Figma existen doce variantes y cuatro instancias de ejemplo; los valores y resúmenes editables se vinculan por tipo para no propagar números incorrectos a otras variantes. [Componente](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=225-140) · [Ejemplo](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=225-395).

El selector compacto de Roles usa el radio de segmento de 8 px y el menú del calendario mensual, el radio de menú de 18 px. Los avatares de Ranking usan el mismo fondo neutro de persona; el distintivo de medalla conserva su función gráfica. Las excepciones funcionales pintadas son el círculo geométrico (50 %), la marca de área de 2 px, divisores, indicadores de selección y los adornos de medalla. La evidencia de compatibilidad, medios, gráficos de identidad y marcas externas está limitada por archivo, selector y propiedad. No son una vía para agregar colores arbitrarios.

Antes de cerrar una modificación del sistema, regenerar tokens y catálogo, ejecutar el guardarraíl de colores, las auditorías de diseño y consumidores, la comparación contra la referencia aprobada y `node scripts/audit-admin-closeout.mjs --check`. La puerta exige la misma huella, correspondencias completas, cero usos administrativos pendientes, contraste y geometría pintada clasificados; una diferencia visual relevante requiere revisión documentada. [Cierre técnico local](docs/auditorias/KJA-051/cierre-final.json).

### Verificación de contraste y accesibilidad

Ejecutar `npm run test:contraste` al modificar tokens compartidos. La matriz exige al menos 4,5:1 para las combinaciones de texto y 3:1 para foco y bordes necesarios para identificar campos. La prueba calcula la luminancia sRGB y evalúa el caso más desfavorable de la superficie translúcida sobre cualquier color de fondo. El borde decorativo de contenedores y la sombra de foco cumplen funciones diferentes del contorno del campo. [Contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Contraste de componentes](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Ejecutar `npm run test:accesibilidad-catalogo` para revisar el catálogo HTML con axe-core en tres tamaños de escritorio. Se abre el catálogo local, se alternan los grupos por teclado y se recorren las cuatro vistas de comparación. En Windows se usa Edge instalado. En otros entornos se puede indicar un Chromium local mediante `KJA_BROWSER_EXECUTABLE`. La revisión de las pantallas del portal y su reconocimiento visual se registran por separado en KJA-051.

### Colores en las hojas de estilo de administración

Usar las variables compartidas para los colores nuevos. Ejecutar `npm run test:colores` para comprobar los estilos locales enlazados desde el dashboard y sus importaciones. Se revisan las hojas específicas de administración y los selectores administrativos de las hojas compartidas. El control excluye las reglas exclusivas de móvil y la hoja de tokens generada. Cada uso heredado queda limitado al archivo, contexto, selector y propiedad registrados. Después de sustituir un valor heredado por una variable, ejecutar `npm run test:colores -- --prune` para retirar su excepción.

Los menús que se montan sobre `body` (`.af-popup`, `.role-picker-popup`) y los diálogos de ficha o jornada deben heredar los mismos tokens en escritorio que su campo de origen. El menú usa superficie opaca, radio 18 px y elevación de menú; sus opciones de 36 px conservan la selección cálida y dibujan el foco verde de 2 px hacia dentro para que el scroll no lo recorte. La apertura del campo es distinta del foco. El selector de Roles incluye avatar compacto de 22 px y búsqueda cuando hay más de cinco opciones: las flechas, Inicio y Fin recorren resultados, Enter elige, Escape vuelve al campo sin cerrar la ficha y la elección no se guarda hasta confirmar. En la navegación lateral el foco verde exterior mide 2 px con separación de 2 px; la selección activa conserva el acento terracota. [Patrón de Roles](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=199-326).

`node scripts/audit-admin-css-consumers.mjs` separa reglas de otras vistas explícitas, reglas observadas en administración con tokens heredados y reglas no observadas. La ausencia en una muestra no autoriza eliminar una regla ni extender los tokens al panel personal o móvil; revisar el contexto y los estados antes de cada sustitución.

En reglas compartidas que también deben funcionar fuera del escritorio, `var(--kja-rol, valor-anterior)` conserva el valor de respaldo exacto; se admite únicamente si el selector tiene un anclaje demostrado y los tokens solo existen en administración de escritorio. El respaldo sigue visible para el guardarraíl de colores. `node scripts/reconcile-admin-shared-tokens.mjs` propone sustituciones inequívocas, sin tocar consultas exclusivas de móvil, selectores mixtos, gradientes o estados ambiguos.

### Comprobación visual de escritorio

Ejecutar `npm run test:visual-catalogo` con Edge en Windows para comparar los recortes del piloto con las referencias de 1280 × 720, 1440 × 900 y 1920 × 1080. Revisar la imagen esperada, la obtenida y la diferencia antes de renovar una referencia por un cambio de diseño aprobado. Si la hoja incrustada está desactualizada, regenerar el catálogo. Las vistas ilustradas se comparan como imágenes; las interacciones de Asignaciones se comprueban en el portal con datos de prueba.

Ejecutar `npm run test:fluidez-lista` para medir el desplazamiento con 1.000 filas. El ensayo compara la superficie aprobada, la alternativa opaca y un desenfoque experimental solo en el contenedor. Los tiempos dependen del equipo y del navegador.

### Indicadores y calendarios de escritorio

| Uso en el portal | Comportamiento | Referencia editable |
| --- | --- | --- |
| Contratos | La cifra informa sobre el equipo. | [Informativo](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=10-17) |
| Colaboradores y Pasar lista | Pulsar el indicador filtra los resultados. La selección se expone mediante aria-pressed. | [Normal](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=10-20) · [Seleccionado](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=10-23) |
| Seguimiento | Las bandejas de Personas filtran. Los totales compactos de Evidencias informan. | [Resumen compacto](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=67-18) |
| Pasar lista y Seguimiento | Elegir el día actualiza la consulta. | [Consulta de día](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=12-16) |
| Descargas | Elegir ambos extremos prepara el intervalo. Aplicar lo confirma. | [Rango de descarga](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=67-67) |
| Asignaciones | Las marcas identifican días con entregables. Seleccionar fecha actualiza el resumen. | [Calendario y resumen](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=58-65) |

### Resultados vacíos y recuperación en escritorio

En Colaboradores y Contratos se distingue el directorio sin personas de una búsqueda sin coincidencias. Quitar filtros restablece la vista y devuelve el foco al buscador. Si el directorio contiene únicamente bajas, la acción las hace visibles. En Seguimiento se diferencia la consulta vacía confirmada de una respuesta incompleta y del filtro sin resultados. En Pasar lista se conserva la fecha al quitar los filtros. Una actualización fallida del mismo contexto conserva las últimas filas válidas y permite reintentar.

[Ejemplos del directorio](docs/auditorias/KJA-051/catalogo.html#vacios-directorio) · [Patrón de vacío en Figma](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=24-16)

En Pasar lista, el selector de área se deshabilita mientras se obtiene el directorio inicial. Una carga fallida sin filas ofrece Reintentar como acción primaria. Si la actualización falla y las filas siguen visibles, Reintentar aparece como acción secundaria. El catálogo reúne las capturas del portal y los componentes editables para los seis estados de consulta. [Referencias de filtros, campos y estados](docs/auditorias/KJA-051/catalogo.html#referencias-c2)

### Roles y liderazgo en escritorio

La ficha de área muestra el líder y los dos cupos de co-liderazgo. La confirmación identifica a la persona, al área y el efecto del cambio. Para retirar un liderazgo, la acción usa el color de peligro y el foco inicial recae en Cancelar. Escape cierra la confirmación y devuelve el foco a Quitar. Al cerrar la ficha de área, el foco vuelve al botón de la lista. [Ejemplos del portal y referencias editables](docs/auditorias/KJA-051/catalogo.html#roles-liderazgo)

### Reglas de Acceso

La tolerancia muestra los minutos dentro del control y un único contorno verde de foco en escritorio. La evidencia obligatoria se identifica como regla fija. Guardar reglas es la acción primaria. Buscar dirección, reintentar el mapa y usar la ubicación son acciones secundarias. Si el mapa falla, las coordenadas exactas siguen disponibles. La actualización de la misma vista conserva el punto pendiente y su indicación de guardado. [Portal y referencia editable](docs/auditorias/KJA-051/catalogo.html#acceso-reglas)

### Filtros del reporte de Facebook

El período y el área delimitan el reporte. En Personalizado, Aplicar confirma las fechas y Escape cierra el calendario conservando el período anterior. En la vista Por persona, Quitar filtros restablece el nombre y el estado de evidencia, conserva el período y el área, y devuelve el foco al buscador. [Ejemplos del portal](docs/auditorias/KJA-051/catalogo.html#facebook-filtros) · Figma [Período y área](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=96-97) y [Filtros por persona](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=96-132)

### Mes completo y Ranking

En escritorio, Mes completo conserva sus controles de 44 px y Ranking su barra compacta de 40 px. Los campos usan el borde y la superficie compartidos. El foco visible es verde y el buscador compuesto de Ranking muestra un solo halo exterior. El filtro de clasificación conserva el foco en la opción seleccionada después de actualizar la lista. Quitar búsqueda y filtros conserva el mes y el área y devuelve el foco al buscador. Las exportaciones del libro usan la acción primaria terracota. [Capturas y referencias editables](docs/auditorias/KJA-051/catalogo.html#mes-ranking).

### Formularios y diálogos auxiliares

Alta y edición de colaboradores comparten campos y acciones; el alta mantiene sus pasos y la edición sus pestañas. Los diálogos de cuentas, feriados, solicitudes de días libres, resumen operativo y Ranking usan la superficie cálida y foco verde. Los controles numéricos compuestos muestran el halo exterior. Ranking y Resumen conservan el foco dentro del diálogo hasta cerrarlo y recuperan su disparador con Escape. Ranking coloca el diálogo sobre la navegación lateral y permite que los valores textuales largos usen el espacio completo de la tarjeta. Las ayudas y los visores mantienen su densidad según el módulo. [Variantes y referencias editables](docs/auditorias/KJA-051/catalogo.html#dialogos-auxiliares).

La ficha de Colaboradores usa la pestaña de línea común, con selección terracota y contorno verde interior de 2 px simultáneos si recibe foco. La tabla semanal distingue cabecera, días laborables y no laborables por texto y superficie. Sus acciones de consulta conservan el borde de campo y el botón compacto Cambiar jornada ocupa 36 px. El directorio resalta la fila editada durante 2,6 segundos con tinte y barra estáticos; evita el parpadeo de la sombra y respeta la preferencia de movimiento reducido al desplazar la lista. [Vista editable de Jornada](https://www.figma.com/design/vCCr04oB3V2IowbO10ttAP?node-id=203-285).
