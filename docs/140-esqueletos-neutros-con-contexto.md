# Esqueletos de administración: Neutro con contexto

Criterio elegido por Piero el 19/11/2026, a partir de la comparación del Resumen operativo con una referencia visual de LinkedIn. Tarea documental: [KJA-036](tasks/KJA-036.md).

**Estado:** Resumen operativo aprobado visualmente por Piero en [KJA-038](tasks/KJA-038.md). Seguimiento diario implementado y verificado localmente en escritorio en [KJA-040](tasks/KJA-040.md), pendiente de revisión. Pasar lista adopta el criterio en [KJA-041](tasks/KJA-041.md), sobre las filas operativas aprobadas por Piero; pendiente de revisión de su esqueleto. Asignaciones lo incorpora en [KJA-044](tasks/KJA-044.md), pendiente de aprobación visual. Las cuatro aplicaciones están incluidas en el PR #196, aún abierto. [KJA-048](tasks/KJA-048.md) convierte localmente Colaboradores, Contratos, Roles y equipos, Mes completo, Reportes Facebook, Ranking mensual y Acceso y marcado. Las siete están verificadas, pendientes de revisión visual y sin publicar. Control diario y Cierres conservan el mecanismo heredado. La referencia orienta el aspecto, no demuestra cómo LinkedIn implementa o anima su carga. Esta decisión no incorpora una biblioteca.

**Actualización de criterio, 21/11/2026:** Piero solicita retirar los avisos visibles de carga y activar reflejo tipo ola. [KJA-049](tasks/KJA-049.md) sustituye el modelo estático por un barrido blanco neutro sobre el gris único en escritorio; con reducir movimiento permanece estático. Los mensajes de error y reintento se conservan. Las evidencias anteriores de ausencia de animación describen sus versiones históricas.

## 1. Principio y alcance

Mantener el contexto que ya se conoce y representar con formas grises simples únicamente el contenido que espera datos. El esqueleto anticipa dónde aparecerá la información, sin simular resultados, estados del negocio ni porcentajes de avance.

Este criterio rige las próximas conversiones de vistas administrativas. Resumen operativo será la primera aplicación; las demás se revisarán individualmente. Diseño y validación solo de escritorio. No extenderlo a móvil, al portal del colaborador ni a otros módulos por iniciativa del agente.

## 2. Decidir qué transformar

Clasificar cada elemento según su dependencia de datos antes de escribir estilos. No convertir indiscriminadamente todo el árbol de la interfaz.

| Elemento | Durante la carga |
| --- | --- |
| Navegación, migas, título fijo, nombre de sección o columna | Conservar texto y posición; no convertirlos en barras. |
| Etiqueta fija de un indicador | Conservarla si su contenido y visibilidad ya están determinados. Si el propio indicador se construye desde datos, reservar su posición con una plantilla representativa. |
| Total, porcentaje, fecha dependiente del servidor, resumen calculado | Sustituir solo el valor o texto pendiente. Nunca mostrar `0`, una fecha local o un estado provisional como resultado real. |
| Contador o etiqueta de estado pendiente | Un bloque gris, sin color de alerta, éxito o prioridad. |
| Identidad de persona, imagen, contenido de una fila | Formas correspondientes a los campos pendientes. No inventar nombres ni resultados. |
| Filtro con etiqueta y opciones locales conocidas | Conservarlo. Deshabilitarlo únicamente si su uso requiere datos aún no disponibles. |
| Opciones de filtro que llegan del servidor | Mantener la etiqueta y el espacio del control; indicar carga sin fingir opciones disponibles. |
| Acción disponible sin esperar datos, como navegar a otra sección | Conservarla operativa y con su texto. No ocultarla con el esqueleto. |
| Acción dependiente de datos, como exportar resultados | Conservar su etiqueta y deshabilitarla durante la espera; no dibujar un botón ficticio. |
| Decoración, brillo, insignia ornamental, ilustración de fondo | No reproducirla en el esqueleto. |

Conservar contexto no autoriza a mostrar secciones o acciones sin permiso. La plantilla debe partir de lo autorizado para la sesión actual.

## 3. Color, superficies y formas

- Un solo relleno común para todos los placeholders: `--kja-sk-base: #e7e7e7` en tema claro. Es un valor elegido para KJA, no una medición del color de LinkedIn.
- No derivarlo de los colores de texto, área, marca o estado. No usar variantes amarillas, verdes, terracota ni azules para distinguir bloques pendientes.
- Fondos de página, tarjetas y separadores son superficies, no placeholders: conservan los tokens del panel. No añadir bandas coloreadas ni sombras para indicar carga. El único degradado admitido es el reflejo blanco neutro solicitado en KJA-049.
- Las tarjetas mantienen su borde y radio normales. Las barras usan radio de 4 px. Base orientativa: 10 px de alto para texto, 16 px para una línea de título dinámico y 24 px para un valor destacado; ajustar a la tipografía real sin alterar su caja de línea.
- Los círculos se reservan para contenido circular real, como avatares o el espacio de un anillo. No añadir avatares a listas que no los tienen.
- Usar anchos consistentes por función; no variar barras al azar ni depender de la longitud de datos personales anteriores.
- No simular barras de gráficos con alturas que parezcan resultados. Reservar el área o representar su estructura de forma neutral, sin escalas ni tendencias ficticias.
- Si se interviene una vista con tema oscuro existente, definir un único relleno neutral legible para ese tema y verificarlo allí. No activar un tema nuevo ni conservar automáticamente el azul del token heredado.

Los colores de datos reales, navegación, acciones disponibles y errores reales conservan su función. La regla monocromática se aplica al contenido pendiente, no a toda la aplicación.

## 4. Geometría y densidad

Conservar columnas, espacios, padding, altura de encabezados y dimensiones de los componentes finales. Simplificar la representación sin rediseñar la pantalla ni agrandar sus áreas durante la espera.

Representar solo los campos necesarios para reconocer cada bloque. Las filas representativas ocupan el área de datos visible, con altura equivalente a las reales; su cantidad no comunica cuántos registros hay. No generar filas fuera de pantalla para llenar toda la colección ni bandas grises grandes en pies de panel.

La altura reservada se libera al terminar. Evitar mínimos globales que introduzcan desplazamiento adicional, contenido cortado o espacios vacíos persistentes. Revisar el caso vacío y el de pocos registros: no exigir que ocupen la altura de una lista llena.

## 5. Comportamiento de carga

| Situación | Regla |
| --- | --- |
| Primera carga sin datos válidos para ese contexto | Contexto fijo visible y esqueletos en las regiones pendientes. |
| Respuesta rápida | Conservar el retraso de 180 ms para no mostrar un parpadeo. |
| Esqueleto que llegó a mostrarse | Conservar los 300 ms mínimos de visibilidad existentes; no añadir otras esperas artificiales ni retrasar el inicio de las consultas. |
| Actualización con datos válidos de la misma cuenta, permisos y filtros | Mantenerlos visibles, sin aviso visual de carga; conservar el anuncio accesible y bloquear acciones dependientes. Evitar sustituir toda la pantalla por esqueletos. |
| Cambio de cuenta, permisos o filtros que vuelve inválidos los datos visibles | Retirar el contenido que ya no corresponde y mostrar espera en la región afectada. No reutilizarlo como resultado actual. |
| Consultas independientes | Revelar cada bloque cuando esté listo, siempre que el flujo real permita separarlas sin mezclar contextos o resultados. No retener todo por un dato secundario. |
| Error | Terminar la espera en el bloque afectado, mostrar mensaje y reintento. Conservar los bloques válidos y distinguir información anterior de datos actualizados. |
| Resultado vacío | Mensaje de estado vacío una vez terminada la consulta. Nunca tratarlo como carga o fallo. |

No actualizar “Actualizado…” hasta confirmar la respuesta correspondiente. Mantener el manejo existente de errores y de respuestas concurrentes; una respuesta antigua no debe reemplazar la selección actual. Una espera prolongada debe comunicar su estado y ofrecer recuperación cuando corresponda; no inventar progreso ni dejar un esqueleto después de un fallo conocido.

## 6. Movimiento y accesibilidad

El modelo vigente tiene **reflejo tipo ola** por solicitud de Piero: barrido blanco neutro sobre el relleno gris, 1,65 s, con transform y recorte dentro de cada placeholder. Se comparte una sola definición entre vistas, sin variantes de color por estado. La transición de aparición conserva los 200 ms existentes. No escalonar filas ni añadir avisos visibles de espera.

El revelado de KJA-050 afecta únicamente a las regiones que mostraron espera: opacidad de 0,65 a 1 en 200 ms, sin mover ni atenuar títulos, filtros o el marco. Si la respuesta llega antes del umbral, o es una actualización con datos válidos, no se aplica ese revelado. No animar alturas para compensar una estructura incorrecta.

Con `prefers-reduced-motion: reduce`, el reflejo se retira y queda el gris estático. Los lectores de pantalla conservan el anuncio común de carga y `aria-busy`; los usuarios visuales reciben el esqueleto sin banners de Actualizando/Consultando ni botones Reintentar mientras una consulta sigue pendiente.

- Marcar ocupada la región cuyos datos se están cargando con `aria-busy` y limpiar ese estado tanto al completar como al fallar.
- Ocultar las formas decorativas a lectores de pantalla. Anunciar la carga una vez por operación, no una vez por barra. Evitar ubicar el anuncio en un subárbol cuya condición de ocupado impida comunicarlo.
- Ningún placeholder recibe foco o responde a clics. Mantener el foco del usuario en controles reales; no robarlo al revelar datos o actualizar una región.
- Mantener contraste del texto de contexto, controles y mensajes. El movimiento y el color no son el único aviso de carga o error.
- Un error con reintento debe ser accesible y operable con teclado. Los avisos de carga deben cesar al resolver la operación.

## 7. Aplicación inicial a Resumen operativo

| Zona | Mantener | Sustituir mientras falten datos |
| --- | --- | --- |
| Marco | Migas, rol ya validado, navegación y acciones disponibles | Solo el estado dependiente de la consulta actual. |
| Encabezado | “Operación de hoy” y “Estado general del equipo”, con la geometría existente | Fecha oficial si aún no está disponible y texto calculado de la jornada. |
| Cuatro indicadores | Posición y tamaño de las tarjetas; etiquetas que ya se conozcan | Anillos y valores pendientes con el mismo gris, sin porciones coloreadas ni porcentajes ficticios. |
| Requieren atención | “PRIORIDAD OPERATIVA”, “Requieren atención” y acceso independiente a la lista | Contador y campos pendientes de filas; sin fondo amarillo ni insignias de alerta provisionales. |
| Solicitudes del personal | “BANDEJA DE DIRECCIÓN” y “Solicitudes del personal” | Contador y campos pendientes de solicitudes. Conservar el texto del botón de actualizar y bloquear el envío duplicado mientras corresponda. |

La maqueta comparada sirve como dirección visual. Su número de filas y medidas no reemplazan las dimensiones de la interfaz real. No aprobar un bloque superior vacío ni conservar manchas beige detrás de los placeholders.

## 8. Procedimiento para convertir otra vista

1. Leer la documentación del módulo y observar sus estados reales. Inventariar regiones, datos pendientes, texto fijo, acciones, permisos y origen de cada consulta.
2. Definir el mapa “mantener / sustituir / deshabilitar” de esa vista y las unidades de carga. Usar la tabla anterior como método, sin copiar la distribución del Resumen a otra pantalla.
3. Reutilizar el controlador de carga y las primitivas comunes. El contrato público existente está en [113-skeleton-loading-panel](113-skeleton-loading-panel.md). No crear otro temporizador, paleta o controlador por vista.
4. Si se conserva el clonado, usarlo como ayuda geométrica y definir explícitamente qué contexto se preserva. No dar por resuelto el diseño porque se hayan reemplazado todos sus nodos de texto. Neutralizar también fondos y pseudo-elementos heredados en las zonas pendientes.
5. Aplicar primero a la vista solicitada. Antes de modificar un token o selector compartido, comprobar qué vistas afecta; no dar por convertidas las restantes ni introducirles cambios visuales sin revisión.
6. Comprobar los estados de la lista siguiente y registrar evidencia por vista. Solo después ampliar la adopción a otra vista solicitada.

### Aplicación a Seguimiento diario

Conservar título, fecha seleccionada, búsqueda, nombres de bandejas, etiquetas de evidencias, cabeceras de columnas y el desplegable del panorama. En escritorio el resumen contiene únicamente Personas y Evidencias, en la misma fila a todo el ancho, con proporción 60/40 tanto al cargar como al recibir datos. La tarjeta Horas válidas se retiró por decisión de Piero; los datos de horas y sus usos fuera de esa tarjeta se conservan. Las bandejas y Descargas que dependen de resultados permanecen deshabilitadas hasta disponer de información válida. El área se sincroniza con las opciones recibidas; no inventar equipos.

Solo contadores, valores, identidades/estados de filas y contenido del panorama reciben formas grises. No mostrar cuatro tarjetas genéricas ni un estado vacío mientras se consulta. La respuesta vacía se distingue de un fallo total; un fallo no se presenta como cero personas. Una actualización fallida conserva los datos anteriores de esa fecha y los identifica como tales, con exportación/escrituras bloqueadas hasta recuperar información completa.

La vista conserva su propio render y sus cuatro fuentes autorizadas; se integra con el controlador común para demora, visibilidad mínima, anuncio y cancelación. No añade un temporizador ni un esquema de colores independiente. El cambio de sesión/fecha invalida los datos previos y las respuestas tardías no deben volver a mostrarlos. La adaptación está limitada a escritorio.

### Aplicación a Pasar lista

Conservar el calendario y la fecha seleccionada, la búsqueda, los nombres de los cinco indicadores, la leyenda fija de asistencia y las etiquetas Entrada/Salida/Evidencia. El selector de área mantiene su etiqueta, pero espera las opciones válidas del servidor. Registrar entrada conserva su texto y el acceso exclusivo de Dirección; permanece deshabilitado mientras no se haya confirmado la información necesaria. Los indicadores que filtran esperan sus datos en la primera carga.

Sustituir valores y totales calculados, nombres de áreas/personas, avatar, modalidad/horario y estado. El estado reserva la columna propia de las filas operativas. Los campos pendientes de entrada/salida/evidencia y acciones usan formas simples. Conservar la superficie blanca y sus separadores; quitar tonos de estado, insignias y progresos ficticios. La plantilla ocupa solo las filas visibles, sin comunicar una cantidad de colaboradores. Avatares y barras comparten el gris neutral; el avatar conserva la forma redondeada de su contenido real.

Asistencia y cierres forman una unidad dependiente: no revelar estados antes de recibir ambas fuentes válidas para la fecha seleccionada. Mantener los datos de la misma cuenta/rol/fecha al actualizar, con «Actualizando…» y acciones de escritura bloqueadas durante la espera. Si falla la actualización, identificarlos como anteriores y ofrecer Reintentar; si no hay datos válidos, mostrar información no disponible sin ceros provisionales. Una respuesta vacía sí termina en el estado vacío real.

El cambio de fecha, cuenta o permisos retira los datos previos; la generación de consulta y la clave de contexto impiden que respuestas antiguas los repongan. La carga usa el controlador común y sus tiempos; la búsqueda no puede adelantar la revelación durante la visibilidad mínima. Formas inertes y ocultas al lector, anuncio único fuera de la región ocupada y foco conservado en búsqueda/filtros. Solo escritorio; la carga móvil heredada sigue separada.

### Aplicación a Asignaciones

Por corrección explícita de Piero, Asignaciones amplía la primera carga a sus tres paneles: mantener encabezado y títulos, pero representar también el cuerpo del formulario y la cuadrícula del calendario con formas grises. Esta excepción visual solo aplica a esta vista: no amplía por sí sola las conversiones anteriores. Mantener el formulario real intacto e inerte bajo su representación, restaurando sus controles y valores al terminar, fallar o cancelar. Al actualizar con datos válidos, conservar formulario, texto escrito, búsqueda y resultados, sin volver a cubrirlos.

El calendario conserva título y navegación. Durante la primera espera, su cuadrícula usa formas decorativas sin fechas ni cantidades provisionales. Revelarlo al resolver su consulta independiente, sin esperar la lista. Mantener datos válidos y borradores al actualizar; distinguir error inicial, actualización fallida con datos anteriores y vacío confirmado. No habilitar escrituras con datos anteriores de un fallo. Invalidar por cuenta/rol/área/fecha o mes y descartar respuestas tardías. Usar el mismo controlador por regiones, sin otros temporizadores. Aplicación local en [KJA-044](tasks/KJA-044.md), pendiente de aprobación visual.

### Aplicación a Gestión del equipo, Reportes y Acceso

[KJA-048](tasks/KJA-048.md) utiliza un adaptador común para las siete vistas restantes de la navegación. Mantiene encabezados, navegación, etiquetas y filtros locales y cubre únicamente sus regiones de datos. Las capas necesitan reserva, posición, recorte y ocultación efectivos: crear bloques sin esos estilos no constituye una conversión terminada. Montar primero la estructura real de escritorio cuando esta antes dependía de la respuesta.

Conservar nodos estructurales que usan los renderizadores (por ejemplo, la tabla de Ranking dentro de su contenedor). Las respuestas rápidas no montan capas; el vacío confirmado libera la reserva. Compartir lectura por contexto, conservar datos válidos al actualizar y recuperar operabilidad al reintentar. La cancelación por una consulta más reciente no es un error y no borra datos compartidos. Invalidar instantáneas y limpiar campos al reiniciar sesión. La ficha contiene la matriz de regiones, ajustes y evidencia.

## 9. Criterios de aceptación por vista

- [ ] Texto fijo, navegación autorizada y acciones independientes permanecen visibles.
- [ ] Todos los placeholders comparten el mismo relleno; no quedan etiquetas coloreadas ni decoraciones heredadas en las regiones pendientes; solo se permite el reflejo blanco común de KJA-049.
- [ ] El contenido final conserva columnas, alineación y posición; no hay salto evitable, corte ni altura mínima sobrante al resolver.
- [ ] Se revisan primera carga lenta, respuesta menor a 180 ms, carga parcial, actualización, cambio de filtro/contexto, vacío, fallo y reintento con datos ficticios.
- [ ] La actualización no oculta datos aún válidos ni presenta datos del contexto anterior como actuales; no se duplican consultas por añadir el esqueleto.
- [ ] Se comprueban teclado, foco, estado ocupado/anuncios y movimiento reducido; el error termina la espera.
- [ ] Revisión visual de escritorio a 1280 × 720, 1440 × 900 y 1920 × 1080, incluyendo pocos registros y listas largas. Sin trabajo móvil.
- [ ] Si cambia CSS común, se revisan las demás vistas afectadas y se documentan límites y pendientes.
- [ ] La evidencia distingue comprobación local, integración y publicación. Ninguna casilla se considera cumplida solo por existir esta guía.

## 10. Fundamento y referencias

- [Carbon — Loading](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading): separar estructura, texto disponible y datos pendientes; no esqueletizar indiscriminadamente controles; carga progresiva y comunicación accesible.
- [Material UI — Skeleton](https://mui.com/material-ui/react-skeleton/): formas acordes con el contenido y variantes con pulso, barrido o sin animación.
- [Ant Design — Skeleton](https://ant.design/components/skeleton/): primera carga de contenido informativo y animación opcional.

Consultadas el 19/11/2026. El gris elegido, los radios, el modelo estático y la conservación de datos al actualizar son decisiones de aplicación para KJA. Los tiempos 180/300/200 ms se conservan de la implementación existente, no se presentan como una norma universal de estas fuentes.
