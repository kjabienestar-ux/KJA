# KJA-028 — auditoría de Colaboradores

Fecha: 2026-11-04. Estado: REVISAR, código local verificado; revisión del usuario y activación publicada pendientes. Implementación de escritorio basada en propuesta A de KJA-027, con componentes HTML/CSS/JS existentes y datos ficticios. No se afirma equivalencia completa con una sesión real de Supabase.

## Resultado visual

Directorio con tarjetas por área y ficha modal; pestañas Equipo, Informes y Áreas; filtros secundarios plegables; indicadores con alcance explícito; formularios de jornada con revisión previa. Fondo marfil, superficies claras y acción terracota, sin ampliar el diseño móvil.

| Hallazgo observado durante la implementación | Corrección verificada |
|---|---|
| El contenedor heredado compartía columnas con otras vistas y desperdiciaba espacio | Colaboradores ocupa la superficie disponible; otras vistas quedan bajo su navegación existente |
| La estructura flex comprimía los indicadores | Altura mínima y contracción desactivada en bloques principales |
| Reinicializar podía duplicar pestañas | Inicialización idempotente |
| Nombres y datos de diferente longitud desalineaban tarjetas | Dos líneas de nombre y filas constantes; datos completos en ficha |
| Borde del buscador insuficiente | Contraste corregido de 1,38:1 a 3,17:1 |
| Horas del formulario podían confundirse | Etiquetas visibles de entrada, salida y modalidad |
| Pasar a revisión desplazaba el encabezado fuera del modal | Reinicio del desplazamiento y foco sin movimiento de página |
| Editores anteriores perdían el recorrido de teclado | Foco contenido, cierre y retorno al control de origen |
| Respuestas tardías podían sustituir otra ficha o edición | Identificador de petición e invalidación al cerrar/cambiar sesión/persona |
| Guardar identidad podía reenviar una agenda Facebook sin cambios | Guardado independiente solo cuando su agenda se modifica |
| Un error de guardado podía dificultar reintentar | Formulario y motivo conservados; botón recuperado; envío único |
| Colores heredados en Áreas y acciones de edición rompían la continuidad | Acciones y bordes armonizados; rojo reservado para eliminación |

## Mediciones y recorridos

Edge con componentes reales y RPC simuladas; 1440×900 y 1280×800. Sin errores JavaScript ni desbordamiento horizontal en las superficies medidas. Tres tarjetas por fila a 1440; dos a 1280. El desplazamiento vertical del directorio es intencional.

| Elemento | Contraste medido |
|---|---|
| Nombre / blanco | 15,10:1 |
| Secundario / blanco | 5,93:1 |
| Blanco / acción terracota | 5,06:1 |
| Borde del buscador / superficie | 3,17:1 |

Recorridos comprobados: directorio, filtros ampliados, vacío, ficha/resumen/jornada, temporal/configuración/revisión, error/reintento/éxito, principal indeterminado, informes, áreas, usuario de lectura, edición heredada y días libres. Se comprobó foco contenido y restaurado; ninguna acción de mutación visible para lectura. Estas mediciones no sustituyen una auditoría integral de accesibilidad ni la revisión con las sesiones reales.

## Evidencia reproducible

- [Directorio, 1440](../../output/kja-028/01-directorio-1440.png), [1280](../../output/kja-028/02-directorio-1280.png).
- [Ficha de jornada](../../output/kja-028/04-ficha-jornada.png), [configuración temporal](../../output/kja-028/05-temporal-configurar.png), [revisión](../../output/kja-028/06-temporal-revision.png), [error](../../output/kja-028/07-temporal-error.png), [principal indeterminado](../../output/kja-028/08-principal-indeterminado.png).
- [Informes](../../output/kja-028/09-informes.png), [Áreas](../../output/kja-028/10-areas.png), [solo lectura](../../output/kja-028/12-solo-lectura.png), [editor](../../output/kja-028/14-editor.png), [días libres](../../output/kja-028/15-dias-libres.png).
- Mediciones: `output/kja-028/auditoria.json`. Generación: `node output/kja-028/generar-fixture.mjs`; revisión: `node output/kja-028/auditar.cjs` (requiere Playwright disponible como módulo o mediante `NODE_PATH`, y Edge instalado).

## Pruebas funcionales y alcance pendiente

58/58 de Colaboradores y 26/26 de calendario aprobadas. Sintaxis JavaScript y `git diff --check` aprobados. Suite general: 337/353; los 16 fallos se reproducen en la base con la misma suite y entorno, sin nuevos fallos en esa comparación. Nombres y método en `output/kja-028/regresion-general.json`; no se presentan como aprobadas las comprobaciones generales fallidas.

Piero informó la ejecución del SQL 132. Comprobación posterior de solo lectura en su sesión: período 05/11–31/12 con lunes–viernes 08:00–14:00 y jueves 05/11 programado en Mes completo. Se añadió aviso visible del próximo cambio y su semana para distinguirlo del vigente hoy; prueba de transición 04/11→05/11 aprobada. Pendientes marcado efectivo, validación remota completa y revisión de Piero. El agente no modificó una base remota ni publicó este avance. Operación y límites: [jornadas con vigencia](../jornadas-vigencias.md).
