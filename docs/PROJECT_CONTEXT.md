# KJA — contexto vigente

Actualizado: 20/11/2026. Este contexto recoge lo comprobado en esta copia; no reconstruye el estado global de producción.

## Base y restricciones

- Rama autorizada: `feat/pierokja`. Base actual: `254ecddb97f569ff2a02d20e990633cb03f1def3`, merge del PR #195. La rama local y `origin/feat/pierokja` apuntan a esa base. Los cambios de esqueletos/documentación siguen locales, sin commit ni publicación.
- Copia autorizada en este equipo: `KJA-trabajo-limpio`. La copia original `KJA` conserva cambios ajenos y no se debe intervenir. Usar la raíz real de la copia autorizada, sin convertir esta ubicación local en una dependencia portable.
- Aplicación estática con Supabase. Leer [PRODUCT](../PRODUCT.md) y la documentación del módulo. Conservar asistencia, permisos, historial, activaciones y hora oficial del servidor en America/Lima.
- Administración: diseño y validación solo de escritorio por instrucción de Piero; no ampliar ni eliminar adaptaciones móviles existentes. Sin migraciones ni despliegue de funciones para tareas documentales.

## Trabajo vigente

[KJA-036](tasks/KJA-036.md): **HECHO en alcance documental**. La norma elegida por Piero y sus motivos están en [140-esqueletos-neutros-con-contexto](140-esqueletos-neutros-con-contexto.md).

[KJA-038](tasks/KJA-038.md): **HECHO local**; Piero aprobó el aspecto de Resumen operativo y pidió seguir con Seguimiento diario usando el portal completo. La revisión aislada anterior en puerto 3010 sigue como herramienta de prueba, no como entorno principal.

[KJA-040](tasks/KJA-040.md): **REVISAR**. Antes de implementar, se incorporó PR #195 por avance directo, sin conflictos, recuperando los cambios locales y conservando su respaldo Git. Seguimiento ya aplica el criterio en escritorio. Comprobados 29/29 casos específicos, la suite amplia con el mismo fallo heredado de sidebar (53/54) y ambos módulos en tres tamaños de escritorio. En el navegador se observó una sesión real existente, su listado y la nueva carga tras recargar; sin escrituras operativas ni publicación. Evidencia y límites en la ficha.

Entorno principal: `http://localhost:3000/dashboard`, portal completo servido desde esta copia sin fixtures. Arranque: `npx --yes serve@14.2.8 . -l tcp://127.0.0.1:3000`. Usa el acceso y backend normales. Las pruebas simulan servicios solo dentro de Playwright. [113-skeleton-loading-panel](113-skeleton-loading-panel.md) distingue las dos vistas convertidas del mecanismo heredado de las restantes.

[KJA-041](tasks/KJA-041.md): **REVISAR**. Piero aprobó las filas operativas y la columna propia de estados. Su esqueleto ya aplica Neutro con contexto en escritorio: etiquetas/calendario visibles, gris único estático, consultas dependientes, datos válidos conservados al actualizar y errores/reintento diferenciados del vacío. Verificados 43/43 casos específicos y diez estados en cuatro tamaños de escritorio; filas de 1/5/6 personas sin superposición. Localhost recargado y comprobado con la sesión existente. Recursos `contexto-41-1`, reglas de negocio conservadas. Pendiente aprobación visual del esqueleto.

Los índices [documentación](README.md) y [tareas](tasks/README.md) permiten abrir referencias concretas. Los estados y evidencias de tareas anteriores se consultan en sus fichas; no se reinterpretan aquí.

[KJA-042](tasks/KJA-042.md): **HECHO en preparación del SQL**, sin ejecución remota. Ajustes fechados Carlos 20/11 y Doris 21/11, 08:00–13:00, sin cambiar sus jornadas habituales. Identidades/esquema contrastados por lectura real; prueba PostgreSQL local aprobada, incluyendo retorno automático, idempotencia y reversión. Entregable y límite de modalidad en la ficha.

[KJA-043](tasks/KJA-043.md): **HECHO**. Excel del 17/10 al 20/11/2026 para las mismas nueve personas de UTP Lima Centro del archivo aportado. Tres hojas y formato conservados; 315 fechas/persona, fuente Supabase de solo lectura con corte 20/11 09:03 Lima. Datos y totales conciliados, revisión visual y validación del XLSX final. La jornada del 20/11 estaba en curso al consultar. Entregable en la ficha.

## Siguiente acción

[KJA-044](tasks/KJA-044.md): **REVISAR**. Piero rechazó la primera presentación por dejar casi toda la vista completa. La revisión amplía la primera carga a los tres paneles: cuerpo del formulario y cuadrícula del calendario en gris estático, conservando encabezado/títulos. El formulario real y sus valores se restauran al resolver; al actualizar se conservan datos y borrador. Calendario independiente, errores/reintentos separados del vacío. Revisión comprobada con 24 pruebas y nueve estados en cuatro tamaños; evidencia anterior de 61 casos en la ficha. Sin cambios de backend ni publicación; pendiente aprobación de la nueva captura.

[KJA-045](tasks/KJA-045.md): **REVISAR**. Formulario de Asignaciones con espaciado 8/16/24 y título centrado. Sin scroll interno, aviso de fecha ni subtítulo; cuerpo y acción en flujo natural. Las tres columnas comparten altura, ampliando Resumen del día. Recursos `espaciado-45-4`. La comprobación final de cuatro tamaños incluye Sorteo expandido, ausencia de scroll interno y acceso por teclado; las capturas anteriores con fecha/scroll no representan el resultado final.

[KJA-046](tasks/KJA-046.md): **HECHO local**. Los tres accesos Contactar a Ingeniería dirigen a Piero, WhatsApp 945322994, mediante modal propio del portal con horario lunes a viernes 08:00–13:00, hora de Perú. Escape/Cancelar y destino comprobados en Edge sin abrir WhatsApp ni enviar mensajes.

Validación previa al PR: 51/51 pruebas seleccionadas de esqueletos/panel y formulario en cuatro tamaños. Se amplió la ventana temporal de una prueba para evitar un fallo por carga del entorno, sin cambiar tiempos de producción. No se acredita la suite histórica completa ni despliegue. Reportes, capturas temporales y SQL de horarios quedan fuera del cambio de producto. Siguiente acción: revisión del PR de `feat/pierokja` a `master`.
