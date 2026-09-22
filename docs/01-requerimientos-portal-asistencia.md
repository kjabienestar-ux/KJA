# Especificación de requerimientos — Portal personal y asistencia KJA

**Versión:** 1.0

**Fecha:** 22 de septiembre de 2026

**Estado:** Línea base para revisión y aprobación
**Sistema:** Portal personal, dashboard y módulo de asistencia KJA

## 1. Propósito y alcance

Especificar el Portal KJA: acceso, asistencia, administración, solicitudes,
modalidad y geocerca, cierre, evidencias, asignaciones, supervisión, ranking,
reportes Facebook, chat y publicaciones. Corte documental: código local hasta
`dashboard_70`, `chat_07` y `marketing_02`, consultado el 22/09/2026.

Esta revisión conserva RF-001–RF-125 y RNF-001–RNF-068 y amplía el catálogo.
La matriz enlaza requisitos, secuencias, fuentes y verificación. No acredita
despliegue, aprobación del negocio ni pruebas de aceptación en producción.

## 2. Límites

Certificados y web pública se consideran sistemas relacionados: se documenta
su separación y compatibilidad, pero su catálogo interno queda fuera de esta
revisión. También quedan fuera planillas, pagos, vacaciones como módulo integral,
aplicación móvil nativa y firma digital. Las solicitudes de permiso existentes
sí forman parte del portal. H.U., casos de uso, Gantt y sprints se actualizarán
en una etapa posterior; no se les asignan identificadores ficticios aquí.

## 3. Actores y autorización

| Actor | Alcance |
|---|---|
| Colaborador | Acceso personal y operaciones propias con ficha activa. |
| Líder / co-líder técnico | Consulta y supervisión de su área; no implica permiso de edición o aprobación. |
| Sistemas | Visibilidad global según nivel; las mutaciones exigen además el rol correspondiente. |
| Dirección | Administración y acciones exclusivas, con perfil activo y acceso al panel. |
| Editor / visor | Edición administrativa autorizada / consulta sin escritura. |
| Marketing | Preparación de publicaciones; publicar exige permiso específico. |
| Supabase Auth, PostgreSQL y Storage | Identidad, autorización, reglas y persistencia privada. |
| Servicios externos | Gemini, Facebook y servicios de mapas, solo en los flujos que los necesitan. |

Los rótulos del producto no sustituyen `nivel`, `rol`, `activo`, `acceso_panel`
ni los permisos propios de Marketing y chat. Auth autentica; el perfil y las
funciones de negocio resuelven permisos.

## 4. Convenciones y evidencia

- **Must / Should / Could:** prioridad heredada o propuesta; pendiente de ratificar por Dirección.
- **Código local:** flujo contrastado con fuentes locales; integración y despliegue pendientes de verificar.
- **Base previa:** requisito heredado; no se certifica su cumplimiento en esta revisión.
- **Parcial:** existe parte del flujo y se indica el faltante.
- **Planificado:** objetivo sin implementación acreditada.
- **Por verificar:** requiere inspección o ejecución adicional antes de declarar cumplimiento.

Los RNF son obligaciones u objetivos de aceptación, no certificaciones. Los
objetivos de rendimiento, disponibilidad y recuperación siguen propuestos.
Los criterios de cada fila constituyen casos de aceptación pendientes de
ejecutar, salvo que exista un acta de prueba identificada. Una referencia a
`tests/` indica cobertura disponible, nunca un resultado ejecutado en esta revisión.

Documentos asociados: [secuencias Mermaid](20-diagramas-secuencia-administracion.md),
[secuencias PlantUML](21-diagramas-secuencia-administracion-plantuml.md) y
[matriz de trazabilidad](27-matriz-requerimientos.md).

## 5. Requerimientos funcionales

### 5.1 Identidad, acceso y sesión

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-001 | El colaborador debe ingresar con su DNI de 8 dígitos y PIN de 4 dígitos. | Must | Base previa | Un DNI y PIN válidos permiten abrir el portal; una combinación inválida no entrega sesión. |
| RF-002 | El sistema debe aceptar únicamente colaboradores activos. | Must | Base previa | Una ficha inactiva no puede iniciar sesión. |
| RF-003 | El DNI debe ser único después de normalizar caracteres no numéricos. | Must | Base previa | La base rechaza dos colaboradores con el mismo DNI normalizado. |
| RF-004 | El sistema debe validar el PIN usando la huella y sal existentes, sin recuperar el PIN en texto plano. | Must | Base previa | La validación ocurre en SQL y el navegador nunca recibe sal ni huella. |
| RF-005 | Después de cinco PIN incorrectos, el acceso debe bloquearse durante 15 minutos. | Must | Base previa | El sexto intento dentro del bloqueo responde indicando el tiempo de espera. |
| RF-006 | En el primer ingreso válido se debe crear automáticamente una cuenta técnica de Supabase Auth. | Must | Base previa | El colaborador entra sin que Dirección cree correo o contraseña manualmente. |
| RF-007 | La cuenta técnica debe vincularse con una sola ficha de colaborador. | Must | Base previa | `asis_perfiles.colaborador_id` identifica de manera única al colaborador. |
| RF-008 | La contraseña técnica debe derivarse en el servidor usando `DASH_PIN_SECRET` y no debe mostrarse ni almacenarse en el cliente. | Must | Base previa | No existe contraseña técnica en HTML, JavaScript, tablas de negocio ni respuestas HTTP. |
| RF-009 | La sesión personal debe tener una vigencia máxima de ocho horas. | Must | Base previa | Cumplidas ocho horas, las funciones y políticas dejan de entregar datos. |
| RF-010 | El portal debe mostrar el tiempo restante de la sesión. | Should | Base previa | La cabecera presenta horas y minutos restantes. |
| RF-011 | El usuario debe poder cerrar su sesión manualmente. | Must | Base previa | Cerrar sesión elimina la sesión local y regresa al acceso. |
| RF-012 | Dirección debe ingresar con el correo y contraseña que ya utiliza en el panel administrativo. | Must | Base previa | La pestaña Dirección autentica con Supabase Auth. |
| RF-013 | Una persona vinculada a una cuenta administrativa no debe recibir una segunda identidad personal. | Must | Base previa | El acceso DNI + PIN responde que debe utilizar su cuenta de Dirección. |
| RF-014 | Un colaborador sin PIN debe recibir una instrucción para completar el alta mediante el flujo vigente. | Should | Base previa | El portal informa que debe crear el PIN desde el enlace de marcado. |
| RF-015 | El sistema debe permitir recuperación o activación de acceso por correo. | Could | Planificado | El colaborador puede verificar su correo y recuperar el acceso sin intervención manual. |

### 5.2 Inicio y resumen personal

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-016 | El inicio debe saludar al usuario y mostrar la fecha actual en la zona horaria de Lima. | Should | Base previa | Nombre, saludo y fecha corresponden a la sesión y al día vigente. |
| RF-017 | El inicio debe mostrar hora de entrada, hora de salida, modalidad y tolerancia. | Must | Base previa | La jornada usa el horario configurado para el día de la semana. |
| RF-018 | El inicio debe mostrar si la asistencia está pendiente, presente, tardía, justificada o no gestionada. | Must | Base previa | El estado coincide con el registro vigente de `asis_registros`. |
| RF-019 | El sistema debe representar visualmente el avance de la hora actual dentro de la jornada. | Should | Base previa | La línea de jornada posiciona “Ahora” entre entrada y salida. |
| RF-020 | El usuario debe visualizar sus horas acumuladas y su meta contractual. | Must | Base previa | El total considera horas previas y registros válidos. |
| RF-021 | El usuario debe visualizar el indicador de asistencia mensual calculado por el servidor. | Should | Código local | El indicador coincide con la respuesta vigente; su fórmula se distingue del porcentaje administrativo RF-099 y del ranking RF-157. |
| RF-022 | El inicio debe mostrar un resumen de la semana vigente. | Should | Base previa | Se presentan siete días con estado y resaltado del día actual. |
| RF-023 | El dashboard debe mostrar un calendario lateral y la agenda de la jornada en escritorio. | Should | Base previa | La columna derecha contiene perfil, calendario, entrada, asistencia y salida. |
| RF-024 | El dashboard debe actualizarse cuando un registro sea cambiado desde el panel administrativo. | Should | Parcial | Actualmente requiere recargar la página; se acepta cuando actualice al recuperar foco o mediante tiempo real. |

### 5.3 Marcación de asistencia

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-025 | El colaborador debe poder marcar asistencia desde su dashboard personal. | Must | Base previa | El botón se habilita cuando corresponde y crea un registro válido. |
| RF-026 | La marcación debe utilizar la fecha y hora del servidor en `America/Lima`. | Must | Base previa | Cambiar el reloj del dispositivo no cambia la hora registrada. |
| RF-027 | La marcación debe habilitarse solo en un día laborable. | Must | Base previa | Un día no laborable responde `no_labora` y no crea registro. |
| RF-028 | La entrada debe respetar la ventana vigente del protocolo de marcado seguro. | Must | Código local | Antes de la apertura o después del cierre aplicable el servidor rechaza; se consideran las ampliaciones autorizadas de entrada tardía. |
| RF-029 | El sistema debe clasificar como presente una marca dentro de la tolerancia. | Must | Base previa | Desde la entrada hasta el límite se registra estado `P`. |
| RF-030 | El sistema debe clasificar como tardanza una marca posterior a la tolerancia y anterior al cierre. | Must | Base previa | Dentro de ese tramo se registra estado `T`. |
| RF-031 | Solo debe existir una marca por colaborador y fecha. | Must | Base previa | Un segundo intento responde `ya_marcado`; la base conserva una sola fila. |
| RF-032 | Una marca realizada desde el portal personal debe registrar el origen `dashboard`. | Must | Base previa | La fila creada contiene `origen = 'dashboard'`. |
| RF-033 | El protocolo vigente debe exigir evidencia de entrada verificada. | Must | Código local | Una llamada directa sin archivo autorizado y verificado no crea la marca; no basta ocultar el botón. |
| RF-034 | El usuario debe poder tomar una foto o elegir una imagen existente. | Should | Base previa | Ambas opciones generan una vista previa antes de registrar. |
| RF-035 | La imagen debe comprimirse antes de la subida. | Should | Base previa | El navegador reduce dimensiones y calidad antes de enviar. |
| RF-036 | La evidencia debe llevar una marca con nombre, fecha, hora del servidor y KJA. | Should | Base previa | El archivo almacenado contiene el sello visible. |
| RF-037 | La evidencia debe almacenarse en la ruta autorizada por el servidor. | Must | Código local | La ruta pertenece al usuario, fecha y permiso emitido; el cliente no impone una ruta histórica fija ni otra extensión. |
| RF-038 | La carga debe utilizar un permiso temporal limitado a una ruta y una confirmación validada por servidor. | Must | Código local | Una ruta ajena o sin permiso no se confirma; no se atribuye a toda URL firmada una propiedad universal de un solo uso. |
| RF-039 | El marcado presencial debe exigir ubicación y precisión válidas dentro de la geocerca; el virtual sigue su protocolo sin GPS obligatorio. | Could | Código local | Denegar ubicación impide el marcado presencial; SQL revalida coordenadas y distancia. |
| RF-040 | Después de marcar, el dashboard debe actualizar estado, calendario, horas y porcentaje. | Must | Base previa | La interfaz refleja el nuevo registro sin volver a iniciar sesión. |

### 5.4 Historial y perfil

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-041 | El usuario debe consultar su historial en un calendario mensual. | Must | Base previa | Cada día representa su estado, condición laborable y si es futuro. |
| RF-042 | El usuario debe navegar a meses anteriores y no más allá del mes actual. | Should | Base previa | El control de mes futuro permanece deshabilitado. |
| RF-043 | El historial debe diferenciar presente, tardanza, justificación, no gestión y día no laborable. | Must | Base previa | Leyenda, color y etiqueta corresponden al estado almacenado. |
| RF-044 | El historial debe resumir presentes, tardanzas, justificaciones, no gestiones y horas. | Must | Base previa | Los totales mensuales coinciden con `asis_registros`. |
| RF-045 | El usuario debe consultar su perfil laboral sin editar directamente identidad, contrato ni horario. | Must | Código local | Los datos laborales son de consulta; la fotografía personal y las solicitudes usan flujos separados RF-127 y RF-128. |
| RF-046 | El usuario debe disponer de un canal para comunicar datos incorrectos. | Should | Base previa | “Informar un cambio” abre el canal de contacto de Dirección. |
| RF-047 | El usuario debe poder solicitar un cambio de horario desde el portal. | Should | Parcial | La RPC y la tabla existen; falta incorporar el formulario a la interfaz. |
| RF-048 | Solo debe existir una solicitud de horario pendiente por colaborador. | Should | Base previa | Una segunda solicitud no crea otro pendiente. |

### 5.5 Roles, permisos y equipo

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-049 | Un miembro solo debe consultar sus propios datos. | Must | Base previa | RLS impide leer fichas o registros de otras personas. |
| RF-050 | Un líder debe consultar únicamente colaboradores de su área. | Must | Base previa | Personas de otras áreas no aparecen ni son accesibles por llamada directa. |
| RF-051 | Sistemas debe poder consultar todas las áreas desde el dashboard. | Must | Base previa | El nivel `sistemas` supera la restricción de área para lectura. |
| RF-052 | El dashboard debe separar nivel de consulta y permiso administrativo. | Must | Base previa | `nivel` controla visibilidad; `rol/acceso_panel` controla edición del panel. |
| RF-053 | Las cuentas técnicas creadas por DNI + PIN no deben obtener acceso al panel administrativo. | Must | Base previa | Nacen con `acceso_panel = false`. |
| RF-054 | Líderes y Sistemas deben visualizar un resumen del equipo autorizado. | Should | Base previa | Se muestran personas visibles, registrados, tardanzas y pendientes. |
| RF-055 | El resumen de equipo debe mostrar persona, área, hora y estado de asistencia del día. | Should | Base previa | Cada fila contiene los datos permitidos por RLS. |
| RF-056 | El líder sin permiso administrativo de edición debe consultar asistencia y evidencias de su área sin modificarlas. | Must | Código local | El nivel líder por sí solo no habilita correcciones ni aprobación de entregas. |
| RF-057 | Dirección debe administrar colaboradores, horarios, contratos, estados y marcas desde `asistencia.html`. | Must | Base previa | El panel existente conserva sus operaciones y permisos. |

### 5.6 Compatibilidad, continuidad e integración

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-058 | La ruta anterior debe conservar el alta de PIN y la transición permitida sin eludir el protocolo actual. | Must | Código local | No se promete marcado anónimo como contingencia: el protocolo de modalidad/geocerca rechaza el marcado anterior. |
| RF-059 | El dashboard y el panel administrativo deben utilizar la misma fuente de asistencia. | Must | Código local | Las operaciones autorizadas consultan asis_registros; las rutas antiguas no obtienen permiso por compartir tablas. |
| RF-060 | El panel debe distinguir el origen panel, portal o dashboard. | Should | Base previa | La interfaz administrativa etiqueta `origen = 'dashboard'` como automarcación. |
| RF-061 | Los cambios del dashboard no deben alterar certificados, clientes o perfiles del módulo de certificados. | Must | Base previa | Las migraciones del dashboard solo operan sobre `asis_*`, `dash_*` y Storage de evidencias. |
| RF-062 | El portal debe disponer de la ruta /dashboard además de dashboard.html. | Should | Código local | vercel.json declara la ruta; su disponibilidad HTTPS se verifica al desplegar. |
| RF-063 | La integración futura con certificados debe realizarse mediante un puente de identidad independiente. | Could | Planificado | El módulo se integra sin mezclar `perfiles` con `asis_perfiles`. |

### 5.7 Centro de gestión administrativa

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-064 | El dashboard debe mostrar una zona de Gestión de asistencia únicamente a cuentas con `acceso_panel = true`. | Must | Base previa | Un colaborador técnico no visualiza la navegación y una apertura directa es rechazada. |
| RF-065 | El Centro de gestión debe resumir colaboradores activos, registrados, tardanzas y personas sin registro del día. | Should | Base previa | Los indicadores se calculan desde `asis_colaboradores` y `asis_registros` del día en Lima. |
| RF-066 | El Centro de gestión debe mostrar el estado reciente del equipo y las solicitudes de horario pendientes. | Should | Base previa | La vista presenta persona, área, hora, origen, estado y solicitudes vigentes. |
| RF-067 | El administrador debe acceder a las herramientas nativas de gestión según su rol. | Must | Código local | Lista, mes, colaboradores, contratos y marcado propio se abren en el dashboard; los enlaces anteriores solo cumplen una función de transición. |
| RF-068 | `asistencia.html` debe aceptar navegación profunda mediante un parámetro `modo` validado. | Should | Base previa | Solo los modos permitidos cambian la vista inicial; valores desconocidos llevan a Inicio. |
| RF-069 | `asistencia.html` debe comprobar explícitamente `activo = true` y `acceso_panel = true` antes de cargar datos. | Must | Base previa | Una cuenta personal autenticada no entra al panel aunque conozca la URL. |
| RF-070 | La gestión nativa debe reutilizar las reglas centrales de asistencia, contrato, evidencia y permisos. | Must | Código local | No se considera terminado el retiro del panel antiguo sin regresión y decisión documentada. |
| RF-071 | El Centro de gestión debe cargar la lista administrativa para una fecha seleccionada aplicando días laborables, contrato y excepciones en el servidor. | Must | Base previa | La RPC `dash_admin_lista` solo devuelve colaboradores que laboran en la fecha y cuyo contrato ya inició. |
| RF-072 | El administrador debe buscar colaboradores y filtrar la lista por área sin recargar la página. | Should | Base previa | La lista se filtra por nombre y área conservando los datos de la fecha cargada. |
| RF-073 | La lista debe mostrar horario, modalidad, horas, estado y hora registrada de cada colaborador. | Must | Base previa | Cada fila presenta la jornada y el registro congelado correspondiente. |
| RF-074 | `editor` y `direccion` deben crear o corregir estados `P`, `T`, `J` y `NG` desde el dashboard. | Must | Base previa | La RPC valida el rol y calcula la hora coherente con el estado usando Lima y la tolerancia vigente. |
| RF-075 | Un usuario `visor` debe consultar la lista sin poder modificar estados ni borrar evidencias. | Must | Base previa | Los controles aparecen deshabilitados y Supabase rechaza escrituras y borrados directos. |
| RF-076 | Corregir una marca debe conservar su nota y evidencia existentes. | Must | Base previa | El `upsert` actualiza estado, actor, hora, origen, horas y vínculo sin sobrescribir nota ni evidencia. |
| RF-077 | El personal administrativo debe abrir una evidencia mediante un enlace privado temporal. | Should | Base previa | Storage crea una URL firmada con vigencia de una hora para el objeto solicitado. |
| RF-078 | Quitar una marca con evidencia debe eliminar primero la imagen y después el registro, previa confirmación. | Must | Base previa | Si Storage falla, la marca se conserva; el registro solo se elimina después de confirmar el borrado de la foto. |
| RF-079 | El dashboard debe ofrecer directorios nativos de Colaboradores y Contratos a las cuentas con acceso al panel. | Must | Base previa | Ambas secciones se abren dentro de Gestión y conservan enlaces al panel anterior. |
| RF-080 | La ficha administrativa debe mostrar si el colaborador tiene DNI, PIN y una cuenta técnica creada, sin exponer la huella del PIN. | Must | Base previa | La RPC devuelve únicamente indicadores booleanos y nunca consulta la sal o huella hacia el cliente. |
| RF-081 | `editor` y `direccion` deben crear y editar colaboradores desde el dashboard. | Must | Base previa | La RPC valida y guarda identidad, área, vínculo, horario y contrato en una sola transacción. |
| RF-082 | Todo DNI administrativo no vacío debe normalizarse a ocho dígitos y ser único. | Must | Base previa | La función rechaza formatos inválidos y duplicados antes de escribir; el índice normalizado permanece como segunda barrera. |
| RF-083 | Dar de baja a un colaborador debe conservar sus marcas, horas, contrato e historial. | Must | Base previa | La operación cambia `activo`, revoca sesiones personales y no elimina ninguna fila de asistencia. |
| RF-084 | El personal con permiso de edición debe crear áreas y asignarlas en la ficha. | Should | Base previa | El nombre se valida y no permite duplicados sin distinguir mayúsculas. |
| RF-085 | El horario semanal debe admitir modalidad, entrada, salida y vínculo por día, rechazando salidas anteriores o iguales a la entrada. | Must | Base previa | El servidor normaliza los siete días y deriva `dias_laborables` del horario válido. |
| RF-086 | La ficha debe gestionar inicio, fin de referencia, meta, horas previas, contrato pendiente y meta de voluntariado. | Must | Base previa | Los campos se guardan juntos y el dato de voluntariado solo aplica a vínculos mixtos. |
| RF-087 | El seguimiento contractual debe calcularse en el servidor. | Must | Base previa | La RPC entrega horas cumplidas, faltantes, horas semanales, alertas, cumplimiento y término estimado. |
| RF-088 | Los cambios de horario, metas, fechas, identidad y estado deben quedar en una bitácora con actor y motivo. | Must | Base previa | La actualización y sus entradas de historial se confirman o revierten dentro de la misma transacción. |
| RF-089 | Un `visor` debe consultar colaboradores, contratos e historial sin poder crear, editar, dar de baja o crear áreas. | Must | Base previa | La interfaz oculta acciones y todas las RPC de escritura vuelven a validar el rol. |
| RF-090 | Corregir el DNI no debe crear otra identidad ni alterar el PIN o el historial del colaborador. | Must | Base previa | La cuenta técnica está vinculada al ID interno; el DNI funciona como identificador de entrada y puede corregirse de forma segura. |

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-091 | El dashboard debe ofrecer una grilla mensual nativa sin abandonar el Centro de gestión. | Must | Base previa | La sección Mes completo presenta todos los días y personas del periodo con cabecera y nombre fijos. |
| RF-092 | La consulta mensual debe resolver horario, inicio de contrato, feriado y excepción personal en el servidor. | Must | Base previa | `dash_admin_mes` entrega por celda si labora, motivo, modalidad, marca y metadatos aplicando la prioridad vigente. |
| RF-093 | La grilla debe distinguir `P`, `T`, `J`, `NG`, día pendiente, no laborable, feriado, preinicio, evidencia y excepción. | Must | Base previa | Cada condición tiene texto accesible y representación visual; las marcas reales no se ocultan aunque el día no sea laborable. |
| RF-094 | El administrador debe navegar por mes, buscar por nombre, filtrar por área e incluir bajas. | Should | Base previa | Los filtros se aplican sin recargar y las bajas solo se consultan al solicitarlas. |
| RF-095 | `editor` y `direccion` deben gestionar feriados y excepciones personales desde la grilla. | Must | Base previa | Las RPC vuelven a validar el rol y no eliminan marcas al cambiar la condición del día. |
| RF-096 | La grilla debe permitir crear, corregir o quitar una marca reutilizando las operaciones seguras de la fase 2. | Must | Base previa | Se usan `dash_admin_guardar_estado` y `dash_admin_quitar_estado`, incluida la coordinación con evidencia privada. |
| RF-097 | Un `visor` debe consultar el mes, detalles y exportaciones sin modificar marcas, feriados o excepciones. | Must | Base previa | La interfaz oculta acciones y Supabase rechaza llamadas de escritura sin `asis_puede_editar()`. |
| RF-098 | El resumen mensual debe mostrar conteos por persona de `P`, `T`, `J`, `NG`, programados, pendientes, horas y porcentaje de asistencia. | Must | Base previa | Los indicadores llegan calculados en la misma respuesta consolidada del mes. |
| RF-099 | El porcentaje administrativo debe distinguirse del cierre de jornada y del ranking. | Must | Código local | La base histórica de dash_admin_mes usa (P + T) / (P + T + J); NG y ausencia de marca no entran en esa fórmula. El cierre se consulta por separado. |
| RF-100 | Mes completo y Resumen deben exportarse en CSV compatible con Excel. | Should | Base previa | El archivo usa UTF-8 con BOM, separador punto y coma y respeta los filtros visibles. |
| RF-101 | El panel anterior debe permanecer disponible como contingencia durante el piloto de la fase 4. | Must | Base previa | Ambas vistas conservan un enlace directo a su equivalente en `asistencia.html`. |

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-102 | El dashboard debe integrar Marcado propio como módulo nativo exclusivo de Dirección. | Must | Base previa | La navegación y la RPC rechazan a `editor`, `visor` y cuentas sin acceso al panel. |
| RF-103 | El módulo debe distinguir el Portal KJA de uso diario y el enlace anterior utilizado para crear el PIN. | Must | Base previa | La interfaz presenta ambas rutas como pasos diferentes y genera el QR únicamente para el portal oficial. |
| RF-104 | Dirección debe copiar la ruta del portal, copiar la activación y descargar un QR del dashboard. | Should | Base previa | Las acciones no incluyen credenciales personales ni escriben información en Supabase. |
| RF-105 | Dirección debe configurar la tolerancia y las reglas vigentes sin desactivar la evidencia obligatoria del protocolo seguro. | Must | Código local | La tolerancia válida se comprueba en servidor; la configuración no permite una marca sin evidencia requerida. |
| RF-106 | Dirección debe habilitar o cerrar el enlace anterior sin afectar el dashboard, los PIN ni las asistencias. | Must | Base previa | `activo` conserva su semántica histórica sobre `/marcar`; el portal autenticado continúa separado. |
| RF-107 | Regenerar el enlace anterior debe exigir confirmación y no modificar PIN, sesiones, colaboradores o marcas. | Must | Base previa | Solo cambia `asis_portal_config.clave` y registra el evento sin guardar la clave en la bitácora. |
| RF-108 | El módulo debe mostrar personas activas, PIN configurados, pendientes, bloqueos, DNI y estado del primer ingreso. | Must | Base previa | Una RPC consolidada consulta claves sin devolver sal ni huella. |
| RF-109 | Reiniciar un PIN debe eliminar únicamente su huella y cerrar las sesiones personales vigentes. | Must | Base previa | La cuenta técnica y el historial permanecen; la persona debe crear nuevamente su PIN. |
| RF-110 | Si existen personas sin PIN, cerrar la activación anterior debe mostrar una advertencia explícita. | Must | Base previa | Dirección debe confirmar conociendo cuántas personas quedarían pendientes de activación. |
| RF-111 | Los avisos de horario deben abrir la ficha del colaborador y permitir cerrarlos como atendidos o descartados. | Should | Base previa | La resolución vuelve a validar Dirección y conserva actor, fecha y resultado. |
| RF-112 | Los cambios de configuración, regeneraciones, reinicios de PIN y resoluciones de horario deben quedar auditados. | Must | Base previa | `asis_admin_eventos` permanece privada y registra únicamente metadatos operativos. |
| RF-113 | El panel anterior no debe retirarse automáticamente al instalar la fase 5. | Must | Base previa | El retiro queda sujeto a regresión completa, periodo estable y aprobación expresa de Dirección. |

### 5.8 Gobierno de roles y liderazgo

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-114 | El portal debe diferenciar Colaborador, Líder, Co-líder y Sistemas, además de los permisos administrativos. | Must | Código local | Las etiquetas y menús corresponden a la identidad y no conceden facultades adicionales. |
| RF-115 | Una cuenta sin colaborador vinculado debe ocultar Inicio, Mi asistencia y Mi perfil. | Must | Base previa | Un administrador exclusivamente administrativo entra directamente a Gestión. |
| RF-116 | Un administrador de sistemas vinculado a un colaborador debe conservar su espacio personal y visualizar Administración como grupo separado. | Should | Base previa | Las opciones personales solo aparecen si `colaborador_id` existe. |
| RF-117 | Mi equipo debe mostrarse solamente al líder técnico y limitarse a su área. | Must | Base previa | Sistemas usa Gestión y no recibe una opción redundante de Mi equipo; RLS mantiene el alcance del líder. |
| RF-118 | Solo un administrador de sistemas con permiso Dirección debe administrar líderes. | Must | Base previa | La interfaz oculta el módulo y las RPC devuelven `sin_permiso` ante cualquier otra combinación. |
| RF-119 | Cada área debe admitir como máximo un líder técnico y dos co-líderes. | Must | Código local | Las RPC rechazan asignaciones que excedan los límites y conservan las existentes al fallar. |
| RF-120 | El administrador debe asignar, reemplazar o retirar al líder de un área desde el dashboard. | Must | Base previa | El mapa de áreas realiza el cambio en una única RPC y vuelve a cargar el estado confirmado. |
| RF-121 | Solo puede designarse líder a una persona activa, perteneciente al área y con cuenta personal activada. | Must | Base previa | El servidor rechaza personas de otra área, bajas o sin primer ingreso. |
| RF-122 | Retirar el liderazgo debe conservar la cuenta personal, el PIN, las sesiones permitidas, el contrato y la asistencia histórica. | Must | Base previa | Únicamente `nivel` cambia de `lider` a `miembro`. |
| RF-123 | Un contrato vencido o una cuenta inactiva debe señalar que el liderazgo requiere revisión, sin reemplazarlo automáticamente. | Should | Base previa | El mapa muestra la alerta y Dirección decide quién asumirá el área. |
| RF-124 | Toda asignación, reemplazo o retiro de liderazgo debe registrar actor, área, persona anterior, persona nueva y fecha. | Must | Base previa | La bitácora privada `asis_roles_eventos` conserva la trazabilidad. |
| RF-125 | El líder técnico debe abrir el perfil laboral y la asistencia mensual de las personas de su área sin capacidad de edición. | Must | Base previa | Mi equipo consulta `dash_historial` por persona; la RPC y RLS rechazan integrantes de otras áreas. |


### 5.9 Modalidad, perfil y solicitudes

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-126 | El sistema debe permitir al colaborador seleccionar modalidad diaria antes de marcar y conservar la modalidad registrada. | Must | Código local | Después de marcar no se cambia la modalidad de esa asistencia; la modalidad marcada prevalece sobre elección diaria y horario. |
| RF-127 | El sistema debe cargar, consultar y quitar la fotografía personal mediante almacenamiento privado. | Should | Código local | La operación aplica solo al perfil autorizado y no modifica los datos laborales. |
| RF-128 | El sistema debe crear solicitudes personales con tipo, fechas, detalle y evidencia cuando corresponda. | Must | Código local | Una solicitud válida aparece en el historial propio; datos o fechas inválidos se rechazan. |
| RF-129 | El sistema debe permitir a Dirección aprobar o rechazar solicitudes personales y consultar días libres. | Must | Código local | La decisión guarda respuesta y actor; el colaborador consulta su estado sin aprobar su propia solicitud. |
| RF-130 | El sistema debe configurar y auditar el punto de oficina y validar la geocerca presencial en servidor. | Must | Código local | Fuera del radio o con ubicación inválida se rechaza; cambiar el punto deja valores anteriores y nuevos en auditoría. |
| RF-131 | El sistema debe rechazar protocolos antiguos de marcación y explicar cómo actualizar el portal. | Must | Código local | Una petición con protocolo no admitido no inserta asistencia aunque tenga sesión válida. |

### 5.10 Jornada, evidencias y excepciones

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-132 | El sistema debe mostrar los requisitos aplicables y el estado del cierre diario. | Must | Código local | Se distinguen asistencia, salida, RPE, comparticiones y asignaciones sin presentar un requisito exento como pendiente. |
| RF-133 | El sistema debe conservar la entrada de una jornada incompleta y aplicar el cierre obligatorio desde su fecha de activación. | Must | Código local | No se borra la entrada por falta de salida ni se invalida retroactivamente un registro anterior a la activación. |
| RF-134 | El sistema debe registrar salida en su ventana autorizada, con entrada previa y requisitos laborales completos. | Must | Código local | Sin entrada, fuera de ventana, con salida duplicada o requisitos laborales pendientes se devuelve un motivo; Facebook se evalúa por su agenda independiente. |
| RF-135 | El sistema debe registrar evidencia de salida y permitir cierre automático cuando se cumplen sus condiciones. | Must | Código local | La evidencia conserva hora acreditada y origen; si faltan requisitos se conserva lo registrado sin simular un cierre completo. |
| RF-136 | El sistema debe confirmar evidencias solo después de verificar los archivos cargados y su requisito. | Must | Código local | Una carga fallida, ruta ajena, MIME incorrecto o archivo no verificado no completa el requisito. |
| RF-137 | El sistema debe permitir corregir una entrega dentro de las reglas y reiniciar su revisión cuando corresponda. | Must | Código local | La nueva versión se convierte en vigente; la revisión anterior no aprueba automáticamente contenido cambiado. |
| RF-138 | El sistema debe aceptar documentos PDF, Word y PowerPoint en asignaciones según extensiones y límites autorizados. | Must | Código local | Un documento autorizado de menos de 10 MB conserva extensión y MIME; se rechaza donde solo corresponde imagen. |
| RF-139 | El sistema debe permitir video opcional en RPE exigible y asignaciones, sin sustituir evidencia principal. | Should | Código local | Solo MP4/WebM de hasta 30 segundos y 8 MB conforme al flujo; no reemplaza capturas Facebook ni foto de salida. |
| RF-140 | El sistema debe eximir del RPE a jornadas presenciales desde la fecha de política configurada. | Must | Código local | El resumen informa requiere_rpe=false y rpe_exento_presencial=true; carga y revisión directa rechazan rpe_no_requerido_presencial cuando corresponde. |
| RF-141 | El sistema debe conservar las evidencias RPE históricas al aplicar la exención presencial. | Must | Código local | No se borran archivos; las entregas exentas dejan de figurar como pendientes y no bloquean salida. |
| RF-142 | El sistema debe aplicar la excepción individual de Alviery a cierre, historial, calendario mensual y ranking. | Must | Código local | Exige asistencia en días laborales y Facebook según agenda; no exige salida, RPE ni asignaciones. Otra persona conserva sus reglas. |
| RF-143 | El sistema debe tratar jornadas justificadas sin exigir evidencias laborales ordinarias. | Must | Código local | Se conserva la marca J y sus archivos; solo se exige Facebook si corresponde a su agenda. |
| RF-144 | El sistema debe evaluar Facebook con agenda y vencimiento independientes de la jornada. | Must | Código local | Puede existir obligación de compartir en un día sin trabajo; lo vencido queda pendiente según política sin borrar una salida ya registrada. |
| RF-145 | El sistema debe aceptar evidencia de Facebook desde una imagen y hasta el máximo autorizado de 50 imágenes. | Must | Código local | Una imagen válida permite registrar la entrega; un collage no se interpreta como varias publicaciones verificadas. |
| RF-146 | El sistema debe eliminar una imagen guardada de Facebook mediante confirmación y limpieza recuperable. | Must | Código local | Con imágenes restantes se reinicia revisión; al eliminar la última se anula la entrega y vuelve a pendiente; un fallo de Storage deja limpieza pendiente. |
| RF-147 | El sistema debe generar y compartir un comprobante de Facebook mediante acción explícita del usuario. | Should | Código local | Se obtiene el comprobante autorizado y se ofrece compartir o descargar; no se envía automáticamente un mensaje de WhatsApp. |

### 5.11 Asignaciones, revisión y supervisión

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-148 | El sistema debe crear asignaciones directas por persona o área con fecha, contenido y obligatoriedad. | Must | Código local | El servidor valida destino y programación; una asignación opcional no bloquea como obligatoria. |
| RF-149 | El sistema debe previsualizar y confirmar sorteos equilibrados de asignaciones. | Must | Código local | Dirección revisa elegibles y carga de 30 días; confirmar revalida los parámetros y evita crear fuera del alcance. |
| RF-150 | El sistema debe consultar asignaciones en lista y calendario con su estado vigente. | Must | Código local | Fecha, destinatario y estado coinciden con el servidor; una asignación cancelada no aparece como obligación activa. |
| RF-151 | El sistema debe retirar asignaciones anulando sus entregas y limpiando archivos exclusivos con reintento. | Must | Código local | La anulación persiste aunque Storage falle; las rutas compartidas no se eliminan indiscriminadamente. |
| RF-152 | El sistema debe permitir a Dirección aprobar u observar entregas con una nota cuando se observa. | Must | Código local | Una observación exige al menos tres caracteres; el líder consulta sin resolver; las canceladas y RPE exentos se excluyen de revisión aplicable. |
| RF-153 | El sistema debe permitir carga administrativa auditada de evidencias faltantes para una fecha y persona. | Must | Código local | Dirección revalida requisito y archivos; J solo admite Facebook y presencial exento rechaza RPE; la salida se regulariza solo si corresponde. |
| RF-154 | El sistema debe registrar impedimentos asociados a fecha y requisito sin justificar automáticamente la ausencia de evidencia. | Must | Código local | El detalle exige al menos diez caracteres; informar no completa ni habilita salida y la entrega resuelve el impedimento. |
| RF-155 | El sistema debe ofrecer control diario a Dirección y supervisión del área a líderes y co-líderes autorizados. | Must | Código local | El tablero muestra pendientes, entregas e impedimentos dentro del ámbito permitido; una llamada ajena se rechaza. |
| RF-156 | El sistema debe consultar, marcar leídas y retirar notificaciones internas de revisión. | Should | Código local | Las acciones solo afectan notificaciones propias y no cambian el resultado de revisión ni envían mensajes externos. |

### 5.12 Ranking y reportes Facebook

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-157 | El sistema debe consultar ranking mensual provisional para Dirección con desglose por criterio y área. | Should | Código local | La fórmula vigente muestra entrada 25, RPE 25, Facebook 30 y salida 20; solo ventanas cerradas hasta ayer, con denominadores independientes. |
| RF-158 | El sistema debe aplicar aprobación de evidencia y excepciones al cálculo del ranking. | Must | Código local | Presencial exento se excluye del denominador RPE; periodo solo presencial recibe crédito neutral. J/NG y excepción individual conservan su tratamiento específico. |
| RF-159 | El sistema debe descontar asignaciones obligatorias activas incumplidas y permitir simulación local de pesos. | Should | Código local | Descuento de 3 por incumplimiento con tope 15; pendientes de revisión no penalizan. Cambiar pesos no guarda una política oficial. |
| RF-160 | El sistema debe consultar reportes Facebook por corte lunes/jueves, mes o rango personalizado. | Must | Código local | Rango personalizado máximo 93 días; actividad hasta hoy en Lima y corte hasta mañana; fecha efectiva y provisionalidad visibles. |
| RF-161 | El sistema debe clasificar cada persona y fecha del reporte por evidencia registrada o causa de exclusión. | Must | Código local | Sí exige última entrega completa con imagen incluso pendiente u observada; No no prueba ausencia de publicación externa. Exclusiones no suman al total evaluado. |
| RF-162 | El sistema debe exportar reporte Facebook a XLSX real respetando el filtro de área. | Must | Código local | Incluye Resumen y Detalle, fechas, leyenda y provisionalidad; totales corresponden al periodo consultado. |
| RF-163 | El sistema debe descargar PDF completo de todas las áreas con ranking por total de Sí. | Must | Código local | Ignora el filtro de área de pantalla de forma anunciada, repite nombres por bloques de fechas y comparte puesto en empates 1,1,3. |
| RF-164 | El sistema debe registrar la institución del colaborador y mostrarla en la ficha correspondiente. | Must | Código local | La edición autorizada conserva el dato y la consulta de perfil respeta los permisos existentes. |

### 5.13 Chat privado

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-165 | El sistema debe consultar contactos y conversaciones privadas con filtros Equipo, Dirección y Mis chats. | Must | Código local | Solo cuentas activas permitidas aparecen; las ventanas conservan historial por interlocutor. |
| RF-166 | El sistema debe enviar texto y recuperar historial, lectura y actualizaciones de conversaciones. | Must | Código local | Solo participantes leen; el identificador del cliente permite reintentar sin duplicar mensajes. |
| RF-167 | El sistema debe enviar una imagen privada por mensaje con texto opcional y vista previa. | Must | Código local | JPG/PNG/WebP original hasta 20 MB; el resultado JPEG debe ser como máximo 300 KiB; una ruta ajena o inválida se rechaza. |
| RF-168 | El sistema debe abrir desde Cierres el chat del colaborador para Dirección. | Should | Código local | Se resuelve la cuenta por identificador; falta de cuenta, baja o cuenta propia da aviso. Abrir no envía mensajes. |
| RF-169 | El sistema debe actualizar presencia y limpiar vistas del chat al cerrar o vencer la sesión. | Should | Código local | Respuestas tardías no repueblan conversaciones privadas después del cierre de sesión. |

### 5.14 Publicaciones de Marketing

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RF-170 | El sistema debe restringir preparación y publicación a los permisos específicos de Marketing. | Must | Código local | Una cuenta preparadora guarda borradores propios pero no publica; se revalida propiedad y permiso en cada operación. |
| RF-171 | El sistema debe preparar copy desde texto manual o lectura explícita de un flyer. | Must | Código local | Subir imagen no llama a Gemini; sin configuración o cuota se mantiene el modo manual y se omiten datos no confirmados. |
| RF-172 | El sistema debe guardar borradores y reutilizar la extracción ya persistida. | Should | Código local | Abrir o editar no consume otra lectura; se recuperan los últimos 30 registros propios según el flujo. |
| RF-173 | El sistema debe revisar el copy y el enlace de WhatsApp antes de publicar. | Should | Código local | Cambiar contenido invalida revisión; guardar para después no publica y el enlace incluye teléfono internacional y texto codificado. |
| RF-174 | El sistema debe publicar el borrador revisado en la página de Facebook configurada. | Must | Código local | El servidor reclama el borrador una sola vez y comprueba permisos; solo confirma publicación cuando tiene resultado válido del proveedor. |
| RF-175 | El sistema debe mantener un resultado incierto de publicación pendiente de comprobación sin reintento automático. | Must | Código local | Timeout ambiguo deja verificar/publicando; se comprueba el resultado externo antes de habilitar otro envío. |

## 6. Requerimientos no funcionales

Los valores numéricos marcados como **objetivo inicial** deben confirmarse con
Dirección antes de convertirse en un SLA contractual.

### 6.1 Seguridad y control de acceso

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-001 | Todas las operaciones privadas deben ejecutarse sobre HTTPS. | Producción no sirve formularios, tokens ni evidencias mediante HTTP. |
| RNF-002 | La autorización debe aplicarse en la base mediante RLS y funciones, no solo ocultando elementos de interfaz. | Una llamada directa con otro `colaborador_id` devuelve cero filas o `sin_permiso`. |
| RNF-003 | `SUPABASE_SERVICE_ROLE_KEY` debe existir únicamente en Edge Functions. | No aparece en HTML, JavaScript público, repositorio ni respuestas. |
| RNF-004 | `DASH_PIN_SECRET` debe administrarse como secreto y no versionarse. | El valor solo existe en Secrets de Supabase. |
| RNF-005 | La rotación de `DASH_PIN_SECRET` requiere un procedimiento de actualización de cuentas técnicas. | No se cambia el secreto directamente en producción sin plan de migración. |
| RNF-006 | Los PIN deben persistirse únicamente con sal y huella, sin almacenarse en texto plano. | Tablas, logs y respuestas no contienen el PIN original; su envío al endpoint de autenticación ocurre exclusivamente mediante HTTPS. |
| RNF-007 | Las evidencias deben permanecer en un bucket privado. | No se puede descargar una foto mediante URL pública permanente. |
| RNF-008 | Las URL deben expirar y los permisos deben limitar ruta, finalidad y usuario. | Una URL de lectura puede reutilizarse hasta caducar; una confirmación de carga verifica su permiso y archivo. |
| RNF-009 | Los mensajes de acceso no deben revelar si un DNI existe antes de validar credenciales. | DNI inexistente y PIN incorrecto producen un mensaje equivalente. |
| RNF-010 | El portal debe prevenir fuerza bruta de PIN. | Se verifica el bloqueo de cinco intentos y 15 minutos. |
| RNF-011 | El cierre y vencimiento deben invalidar el acceso a datos privados. | Una sesión vencida no puede invocar RPC aunque conserve la pestaña. |
| RNF-012 | CORS de producción debe limitarse a dominios autorizados cuando se cierre la etapa piloto. | Objetivo pendiente: reemplazar `*` por dominios KJA y entornos aprobados. |

### 6.2 Privacidad y protección de datos

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-013 | La interfaz debe mostrar únicamente los datos personales necesarios para la tarea. | El DNI se presenta enmascarado dentro del perfil. |
| RNF-014 | La ubicación debe solicitarse con consentimiento del navegador. | Denegar ubicación no entrega coordenadas falsas. |
| RNF-015 | KJA debe definir y comunicar finalidad, acceso y conservación de fotografías y ubicación. | Existe una política aprobada antes del despliegue general. |
| RNF-016 | Debe definirse un plazo de retención y eliminación de evidencias. | Requisito pendiente: política automática o procedimiento documentado. |
| RNF-017 | Los logs no deben contener PIN, tokens, secretos ni imágenes completas. | Revisión de logs de Edge Functions confirma ausencia de secretos. |

### 6.3 Integridad y consistencia

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-018 | DNI, relación de perfil y asistencia diaria deben protegerse con restricciones únicas. | La base rechaza duplicados en los tres casos. |
| RNF-019 | Las decisiones de fecha, hora y ventana deben calcularse en el servidor con `America/Lima`. | Relojes de cliente alterados no cambian el resultado. |
| RNF-020 | Las migraciones deben ser aditivas, reejecutables cuando corresponda y transaccionales. | Un error revierte la ejecución sin dejar una migración parcialmente aplicada. |
| RNF-021 | Una falla al subir evidencia no debe crear una marca que incumpla la configuración obligatoria. | Con evidencia obligatoria y subida fallida no aparece asistencia. |
| RNF-022 | Los sistemas de asistencia y certificados deben conservar tablas y permisos separados. | Ninguna migración del dashboard modifica tablas del módulo de certificados. |

### 6.4 Rendimiento y capacidad

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-023 | El dashboard debe mostrar el contenido principal en un máximo objetivo de 3 segundos en conexión 4G estable. | Medición p95 del piloto, sin contar la primera carga en frío de proveedores externos. |
| RNF-024 | El inicio de sesión debe responder en un máximo objetivo de 2 segundos p95, salvo arranque en frío. | Métricas de `dash-entrar` durante el piloto. |
| RNF-025 | Una marcación sin evidencia debe responder en un máximo objetivo de 2 segundos p95. | Medición desde confirmación hasta respuesta del servidor. |
| RNF-026 | Una marcación con evidencia debe completarse en un máximo objetivo de 8 segundos en conexión 4G estable. | Medición incluyendo compresión y subida. |
| RNF-027 | Las imágenes deben reducirse a un tamaño objetivo aproximado de 180 KB cuando sea técnicamente posible. | La mayoría de evidencias del piloto permanece cerca o debajo del objetivo. |
| RNF-028 | El sistema debe soportar inicialmente 500 colaboradores activos y 50 marcaciones concurrentes sin rediseño. | Objetivo inicial sujeto a prueba de carga antes de escalar. |
| RNF-029 | Consultas frecuentes deben contar con índices por DNI, perfil, colaborador, fecha y sesión. | El plan de consulta no realiza barridos completos innecesarios en tablas crecientes. |

### 6.5 Disponibilidad, respaldo y recuperación

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-030 | El objetivo inicial de disponibilidad mensual debe ser 99.5%, condicionado por Supabase, hosting y conectividad. | Se registran incidentes y minutos de indisponibilidad. |
| RNF-031 | La contingencia debe conservar acceso administrativo autorizado sin prometer marcado antiguo incompatible. | Ante caída del frontend se ensaya el panel compatible; una caída de Supabase afecta también esa alternativa. |
| RNF-032 | Debe existir respaldo de base de datos acorde al plan contratado. | Dirección conoce frecuencia, retención y procedimiento de restauración de Supabase. |
| RNF-033 | Objetivo inicial de pérdida máxima de datos (RPO): 24 horas. | El esquema de respaldo permite recuperar al menos el último respaldo diario. |
| RNF-034 | Objetivo inicial de recuperación (RTO): 4 horas para incidentes controlables por KJA. | Existe un procedimiento ensayado de restauración y republicación. |

### 6.6 Usabilidad, accesibilidad y compatibilidad

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-035 | La interfaz debe estar en español claro y utilizar términos conocidos por el equipo. | Controles y errores describen la acción o solución sin jerga técnica. |
| RNF-036 | Marcar asistencia debe requerir como máximo tres acciones después de iniciar sesión. | Inicio → marcar → confirmar; evidencia añade solo selección/captura. |
| RNF-037 | Toda operación debe mostrar estado de carga, éxito o error accionable. | Ningún botón crítico queda sin respuesta visible. |
| RNF-038 | El diseño debe adaptarse desde 360 px hasta pantallas de escritorio. | No existe desplazamiento horizontal involuntario en anchos objetivo. |
| RNF-039 | Deben soportarse las dos últimas versiones estables de Chrome, Edge, Firefox y Safari. | Prueba manual de acceso, calendario, sesión y marcación. |
| RNF-040 | La interfaz debe cumplir el objetivo de accesibilidad WCAG 2.1 AA en los flujos críticos. | Pendiente de auditoría: teclado completo, foco visible, nombres accesibles, contraste y estados sin depender solo de color; no se declara conformidad certificada. |
| RNF-041 | Las animaciones deben respetar `prefers-reduced-motion`. | Con reducción activa, transiciones y animaciones no interfieren. |
| RNF-042 | Cámara, archivos y geolocalización deben degradar de forma comprensible si el dispositivo no los soporta. | El usuario recibe una alternativa o mensaje claro. |

### 6.7 Mantenibilidad y despliegue

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-043 | El frontend debe mantener separación entre estructura, estilos y comportamiento. | HTML, CSS y JavaScript permanecen en archivos diferenciados. |
| RNF-044 | Las migraciones y Edge Functions deben documentar requisitos y orden de despliegue. | Un responsable puede reproducir el despliegue usando `docs/dashboard-base.md`. |
| RNF-045 | Los archivos estáticos deben utilizar versión de caché al cambiar CSS o JavaScript. | La publicación referencia una versión nueva y evita servir recursos antiguos. |
| RNF-046 | Debe existir un entorno de prueba separado antes de cambios de alto riesgo. | Planificado: proyecto o rama de Supabase para migraciones y pruebas destructivas. |
| RNF-047 | Cada despliegue debe contar con una lista mínima de pruebas de regresión. | Se validan acceso, permisos, marcado, evidencia, historial, panel anterior y certificados. |
| RNF-048 | Los cambios no deben sobrescribir modificaciones ajenas o datos de producción sin respaldo. | Se revisan diferencias y alcance antes de migrar o publicar. |

### 6.8 Observabilidad y auditoría

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-049 | Cada asistencia debe conservar fecha, hora, origen, dispositivo y actor cuando corresponda. | La fila permite diferenciar panel, portal y dashboard. |
| RNF-050 | Las funciones deben devolver motivos de error estables para soporte. | Casos como sesión, bloqueo, ventana, evidencia y duplicado son distinguibles. |
| RNF-051 | Deben revisarse logs de Edge Functions y errores de base durante el piloto. | Existe una rutina de revisión y registro de incidentes. |
| RNF-052 | Las acciones administrativas sensibles deben conservar trazabilidad de actor, fecha, motivo y cambio. | Hay bitácoras locales de administración, ficha, roles y revisión; queda por auditar cobertura de cada mutación y política de retención. |

### 6.9 Consulta mensual y exportación

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-053 | La carga de un mes debe resolverse con una sola RPC y sin consultas por persona o por día desde el navegador. | La traza de red muestra una llamada `dash_admin_mes` por periodo y condición de bajas. |
| RNF-054 | La respuesta mensual debe soportar inicialmente 500 personas por 31 días sin cambiar el contrato de la API. | La consulta produce hasta 15 500 celdas en una respuesta consolidada y usa índices de fecha, ámbito, persona y área. |
| RNF-055 | La grilla ancha debe usar desplazamiento horizontal intencional, nombre fijo y cabecera fija, sin expandir el documento completo. | En escritorio y móvil el desplazamiento queda dentro del libro mensual. |
| RNF-056 | Las exportaciones deben generarse localmente y no crear tablas, archivos públicos ni copias persistentes en Supabase. | La descarga se construye como `Blob` en el navegador y no produce escrituras de red. |

### 6.10 Cierre de transición y operación sensible

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-057 | El centro de acceso debe consolidar datos sensibles mediante RPC exclusiva de Dirección. | dash_admin_marcado entrega configuración y directorio; la geocerca puede requerir una RPC adicional. Toda llamada revalida permisos. |
| RNF-058 | La bitácora administrativa debe permanecer inaccesible mediante consultas directas del navegador. | La tabla tiene RLS, no posee políticas públicas y no concede privilegios a `authenticated`. |
| RNF-059 | Ninguna respuesta debe exponer PIN, sal, huella ni contraseña técnica. | La RPC entrega únicamente estados booleanos, fechas y contadores de intentos. |
| RNF-060 | Regenerar un enlace o reiniciar un PIN debe ser una acción explícita, confirmada y recuperable mediante el flujo de activación. | No existe ejecución automática durante migración, carga o actualización de pantalla. |
| RNF-061 | El QR oficial debe codificar solo una URL pública del dashboard. | Inspeccionar el QR no revela clave de activación, DNI, PIN ni identificador personal. |
| RNF-062 | El retiro del panel anterior requiere una matriz de regresión aprobada y un periodo estable documentado. | Existe evidencia de pruebas por rol, módulo, navegador y contingencia antes de retirar rutas. |

### 6.11 Gobierno de roles

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-063 | Los cambios de liderazgo deben ser atómicos. | Una falla revierte tanto el retiro anterior como la nueva asignación. |
| RNF-064 | La autorización de roles debe validarse en Supabase y no depender de menús ocultos. | Una llamada directa sin nivel `sistemas`, rol `direccion` y `acceso_panel` activo devuelve `sin_permiso`. |
| RNF-065 | La instalación de la fase de roles no debe modificar asignaciones existentes. | Ejecutar la migración solo crea tabla, índice y RPC; ningún `nivel` cambia hasta una acción confirmada. |
| RNF-066 | La bitácora de liderazgo debe ser privada. | RLS está activa y `authenticated` no posee acceso directo a la tabla. |
| RNF-067 | Promover o retirar un líder no debe modificar PIN, asistencia, contrato ni certificados. | Las funciones de escritura solo actualizan `asis_perfiles.nivel` e insertan un evento. |
| RNF-068 | La navegación debe fallar de forma segura ante una vista no autorizada. | Las aperturas programáticas se rechazan además de mantener oculto el botón. |


### 6.12 Calidad de los módulos incorporados

| ID | Requerimiento no funcional | Criterio verificable |
|---|---|---|
| RNF-069 | Los resúmenes de cierre, historial y ranking deben aplicar las mismas excepciones vigentes. | Comparar virtual, presencial antes/después de la fecha de exención, J y excepción individual; diferencias de métricas se explican sin exigir RPE exento. |
| RNF-070 | La eliminación entre PostgreSQL y Storage debe ser recuperable. | Simular fallo de Storage: permanece cola privada, la anulación no se revierte silenciosamente y un reintento limpia sin afectar rutas ajenas. |
| RNF-071 | Los reintentos de chat y publicación deben evitar efectos duplicados. | Dos solicitudes del mismo identificador de chat generan un mensaje; dos reclamos del mismo borrador no inician dos publicaciones. Resultado incierto no se reenvía automáticamente. |
| RNF-072 | Los archivos deben validarse por ruta autorizada, MIME, extensión y tamaño según módulo. | Probar archivo válido y tipo/tamaño rechazado en entrada, RPE, asignación, video, chat y Marketing; no se utiliza un límite global incorrecto. |
| RNF-073 | Las imágenes de chat deben recodificarse sin metadatos y reducir su peso. | JPEG de lado mayor máximo 1600 px, objetivo 150 KiB y techo 300 KiB; transparencia sobre blanco, sin conservar animación ni original. |
| RNF-074 | Las respuestas asíncronas desactualizadas no deben reemplazar el estado vigente. | Cambiar periodo, conversación o sesión durante una petición no mezcla datos ni descarga un reporte del periodo anterior. |
| RNF-075 | La cuota de lectura de flyers debe reservarse de forma atómica y reutilizar resultados. | Máximo interno 20 intentos/24 h y 5/minuto por modelo; solicitudes concurrentes de un borrador no duplican lectura, 429 no reintenta automáticamente. No es garantía de cuota del proveedor. |
| RNF-076 | Los secretos de Gemini y Facebook deben permanecer en el servidor. | Tráfico al cliente y archivos públicos no contienen claves ni tokens de página; los errores no reproducen credenciales o mensajes sensibles del proveedor. |
| RNF-077 | Las exportaciones deben preservar integridad, alcance y texto seguro. | XLSX y PDF corresponden a la misma consulta; el primero respeta filtro y el segundo informa todas las áreas. Nombres no se interpretan como fórmulas y no se transmiten a un generador externo. |
| RNF-078 | Las políticas de cierre deben tener fecha efectiva y conservar datos históricos. | Reaplicar la migración 70 no mueve una fecha ya guardada; la exención no borra RPE. Documentar uso de áreas y horarios actuales en reportes, sin llamarlos instantáneas históricas. |
| RNF-079 | La documentación debe mantener trazabilidad e identificadores estables. | Todo RF/RNF tiene fila única en matriz, fuente y criterio; solo los flujos aplicables llevan secuencia. Cambios no renumeran requisitos previos. |
| RNF-080 | Las dependencias cartográficas deben fallar de forma comprensible sin sustituir la autorización del servidor. | Si no carga el mapa, no se inventan coordenadas ni se omite geocerca; los datos válidos y la validación siguen independientes de las teselas. |
| RNF-081 | El despliegue debe coordinar versiones de SQL, Edge Functions y frontend. | Comprobar orden de dependencias y contrato de rutas/extensiones antes de publicar; un fallo de versión explica actualización necesaria sin ampliar permisos. |

## 7. Reglas de negocio vigentes

1. Sesión, persona activa, rol, nivel y permiso de módulo se validan en servidor.
2. La fecha y hora oficial se calculan en Lima; no se acepta el reloj local como autoridad.
3. El protocolo seguro exige evidencia de entrada; presencial añade ubicación y geocerca.
4. Una entrada no equivale por sí sola a una jornada completa desde la activación del cierre obligatorio.
5. RPE, evidencia de salida y asignaciones conservan reglas laborales; Facebook sigue una agenda independiente y no integra el bloqueo laboral de la RPC de salida vigente.
6. Desde `rpe_presencial_exento_desde`, presencial no exige RPE. La fecha se fija al instalar la migración, no se presupone que sea el 22/09/2026.
7. La modalidad marcada prevalece sobre la elección diaria y el horario. Los RPE históricos se conservan.
8. La excepción individual de Alviery se limita a esa persona: asistencia y Facebook; no salida, RPE ni asignaciones. No es un permiso general configurable.
9. Una jornada J conserva registros; Facebook puede seguir siendo exigible según agenda.
10. Informar un impedimento no aprueba evidencia ni justifica automáticamente la jornada.
11. El reporte Facebook mide evidencia registrada, no publicaciones verificadas en la red social. El ranking exige además revisión aprobada para puntuar evidencias.
12. El ranking de desempeño es provisional; las simulaciones no aprueban premios ni políticas.
13. El ranking por áreas del PDF Facebook ordena total de Sí; es distinto del ranking mensual de desempeño.
14. El chat es privado entre participantes. Abrir una conversación no envía un mensaje.
15. Publicar en Facebook exige revisión y permiso explícito; un resultado incierto se comprueba antes de reintentar.
16. Los permisos de carga no reemplazan la validación del archivo al confirmar; PostgreSQL y Storage no comparten una transacción de borrado.

## 8. Dependencias y activación

La evidencia está en `supabase/`, `assets/js/`, `dashboard.html` y las guías
por módulo. El corte incluye migraciones `dashboard_01`–`dashboard_70`,
`chat_01`–`chat_07`, `marketing_01`–`marketing_02` y las Edge Functions
`dash-entrar`, `dash-evidencia`, `dash-entrega`, `marketing-publicaciones`.
No todos los SQL son instalaciones genéricas: hay diagnósticos y cambios
dirigidos a personas. Se debe revisar el orden y alcance antes de ejecutarlos.

Fuentes de activación: [base](dashboard-base.md),
[documentos en asignaciones](asignaciones-documentos-activacion.md),
[chat](19-chat-interno.md), [imágenes del chat](chat-imagenes.md),
[Marketing](18-publicaciones-marketing.md), [reportes](24-reportes-facebook.md),
[excepción individual](25-alviery-asistencia-comparticiones.md),
[RPE presencial](26-rpe-presencial.md).

## 9. Pendientes y límites de la revisión

- No se consultó ni modificó Supabase remoto. Código local y guías de despliegue no prueban activación.
- RF-015 y RF-063 permanecen planificados. RF-024 y RF-047 conservan revisión pendiente de su alcance específico; las solicitudes personales nuevas no prueban por sí solas el formulario antiguo de horario.
- RF-061 y RNF-022 se refieren al aislamiento del dominio: no certifican por inspección que nunca haya existido una migración ajena al dashboard en el repositorio.
- RF-008/RNF-059 prohíben exponer la contraseña técnica, sal y huella; el flujo sí entrega tokens de sesión y recibe el PIN por HTTPS para validarlo. RNF-006 no debe interpretarse como ausencia del PIN en la petición de autenticación autorizada.
- La cobertura heredada Base previa requiere revisar y ejecutar sus criterios antes de declarar cumplimiento.
- Rendimiento, carga, accesibilidad, navegadores, privacidad, retención, respaldos y restauración requieren evidencia específica; no son SLA aprobados.
- No volver a ejecutar dashboard_03 sobre cuentas técnicas ni rotar DASH_PIN_SECRET sin procedimiento de migración.
- H.U., casos de uso, Gantt y sprints no se actualizan en esta entrega.

## 10. Aceptación de esta línea base

Dirección debe ratificar alcance, prioridades, excepciones y objetivos RNF.
La validación posterior debe registrar entorno, versión, ejecutor, fecha,
resultado y evidencia de cada criterio AC-RF/AC-RNF de la matriz, incluyendo
rechazos por rol, fallos de red/Storage y conservación de histórico. Una
validación documental correcta no sustituye las pruebas del sistema.

## 11. Control de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.6 | 27/08/2026 | Base previa de acceso, asistencia y administración. |
| 1.0 | 22/09/2026 | Alcance ampliado, corrección de reglas heredadas, RF/RNF nuevos, secuencias vinculadas y matriz con estado de verificación explícito. |
