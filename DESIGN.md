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
