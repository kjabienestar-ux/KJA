# Especificación de requerimientos — Portal personal y asistencia KJA

**Versión:** 0.6

**Fecha:** 27 de agosto de 2026

**Estado:** Línea base para revisión y aprobación
**Sistema:** Portal personal, dashboard y módulo de asistencia KJA

## 1. Propósito

Este documento define los requerimientos funcionales y no funcionales de la
primera etapa del Portal KJA. Su finalidad es permitir que colaboradores,
líderes y Dirección consulten y gestionen la asistencia con una identidad
segura, sin crear manualmente una cuenta y contraseña para cada persona.

La especificación describe tanto lo implementado como lo pendiente. No debe
interpretarse que un requisito marcado como **Planificado** ya está disponible.

## 2. Alcance de esta etapa

El alcance comprende:

- acceso personal mediante DNI y PIN de asistencia;
- creación automática de una identidad técnica;
- sesión autenticada y controlada por roles;
- consulta de jornada, asistencia, horas y perfil laboral;
- marcación desde el dashboard con evidencia cuando corresponda;
- calendario e historial mensual;
- visibilidad por equipo para líderes y Sistemas/Dirección;
- centro administrativo y Pasar lista nativo para cuentas del panel;
- coexistencia temporal con `marcar.html` y `asistencia.html`;
- protección e independencia del sistema de certificados.

Quedan fuera de esta primera etapa:

- recuperación o activación por correo para colaboradores;
- edición directa del perfil por el colaborador;
- integración del módulo de certificados dentro del dashboard;
- planillas, pagos, vacaciones y cálculo de remuneraciones;
- aplicación móvil nativa;
- notificaciones automáticas por correo, WhatsApp o push;
- firma digital de contratos;
- analítica avanzada y exportaciones gerenciales.

## 3. Actores

| Actor | Descripción |
|---|---|
| Colaborador | Persona activa con ficha en `asis_colaboradores`, DNI y PIN. |
| Líder | Colaborador autorizado para consultar a las personas de su área. |
| Sistemas | Cuenta con visibilidad global del dashboard y soporte operativo. |
| Dirección/Administrador | Cuenta con correo y contraseña que administra asistencia desde `asistencia.html`. |
| Supabase | Proveedor de identidad, base de datos, RLS, funciones y almacenamiento. |

## 4. Convenciones

**Prioridad**

- **Must:** necesario para operar la primera versión.
- **Should:** importante, puede entregarse después del núcleo.
- **Could:** mejora deseable para una fase posterior.

**Estado**

- **Implementado:** disponible en el código y backend actual.
- **Parcial:** existe una parte, pero falta completar el flujo.
- **Planificado:** aún no implementado.

## 5. Requerimientos funcionales

### 5.1 Identidad, acceso y sesión

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-001 | El colaborador debe ingresar con su DNI de 8 dígitos y PIN de 4 dígitos. | Must | Implementado | Un DNI y PIN válidos permiten abrir el portal; una combinación inválida no entrega sesión. |
| RF-002 | El sistema debe aceptar únicamente colaboradores activos. | Must | Implementado | Una ficha inactiva no puede iniciar sesión. |
| RF-003 | El DNI debe ser único después de normalizar caracteres no numéricos. | Must | Implementado | La base rechaza dos colaboradores con el mismo DNI normalizado. |
| RF-004 | El sistema debe validar el PIN usando la huella y sal existentes, sin recuperar el PIN en texto plano. | Must | Implementado | La validación ocurre en SQL y el navegador nunca recibe sal ni huella. |
| RF-005 | Después de cinco PIN incorrectos, el acceso debe bloquearse durante 15 minutos. | Must | Implementado | El sexto intento dentro del bloqueo responde indicando el tiempo de espera. |
| RF-006 | En el primer ingreso válido se debe crear automáticamente una cuenta técnica de Supabase Auth. | Must | Implementado | El colaborador entra sin que Dirección cree correo o contraseña manualmente. |
| RF-007 | La cuenta técnica debe vincularse con una sola ficha de colaborador. | Must | Implementado | `asis_perfiles.colaborador_id` identifica de manera única al colaborador. |
| RF-008 | La contraseña técnica debe derivarse en el servidor usando `DASH_PIN_SECRET` y no debe mostrarse ni almacenarse en el cliente. | Must | Implementado | No existe contraseña técnica en HTML, JavaScript, tablas de negocio ni respuestas HTTP. |
| RF-009 | La sesión personal debe tener una vigencia máxima de ocho horas. | Must | Implementado | Cumplidas ocho horas, las funciones y políticas dejan de entregar datos. |
| RF-010 | El portal debe mostrar el tiempo restante de la sesión. | Should | Implementado | La cabecera presenta horas y minutos restantes. |
| RF-011 | El usuario debe poder cerrar su sesión manualmente. | Must | Implementado | Cerrar sesión elimina la sesión local y regresa al acceso. |
| RF-012 | Dirección debe ingresar con el correo y contraseña que ya utiliza en el panel administrativo. | Must | Implementado | La pestaña Dirección autentica con Supabase Auth. |
| RF-013 | Una persona vinculada a una cuenta administrativa no debe recibir una segunda identidad personal. | Must | Implementado | El acceso DNI + PIN responde que debe utilizar su cuenta de Dirección. |
| RF-014 | Un colaborador sin PIN debe recibir una instrucción para completar el alta mediante el flujo vigente. | Should | Implementado | El portal informa que debe crear el PIN desde el enlace de marcado. |
| RF-015 | El sistema debe permitir recuperación o activación de acceso por correo. | Could | Planificado | El colaborador puede verificar su correo y recuperar el acceso sin intervención manual. |

### 5.2 Inicio y resumen personal

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-016 | El inicio debe saludar al usuario y mostrar la fecha actual en la zona horaria de Lima. | Should | Implementado | Nombre, saludo y fecha corresponden a la sesión y al día vigente. |
| RF-017 | El inicio debe mostrar hora de entrada, hora de salida, modalidad y tolerancia. | Must | Implementado | La jornada usa el horario configurado para el día de la semana. |
| RF-018 | El inicio debe mostrar si la asistencia está pendiente, presente, tardía, justificada o no gestionada. | Must | Implementado | El estado coincide con el registro vigente de `asis_registros`. |
| RF-019 | El sistema debe representar visualmente el avance de la hora actual dentro de la jornada. | Should | Implementado | La línea de jornada posiciona “Ahora” entre entrada y salida. |
| RF-020 | El usuario debe visualizar sus horas acumuladas y su meta contractual. | Must | Implementado | El total considera horas previas y registros válidos. |
| RF-021 | El usuario debe visualizar el porcentaje de asistencia del mes. | Should | Implementado | El porcentaje se calcula sobre los días laborables transcurridos. |
| RF-022 | El inicio debe mostrar un resumen de la semana vigente. | Should | Implementado | Se presentan siete días con estado y resaltado del día actual. |
| RF-023 | El dashboard debe mostrar un calendario lateral y la agenda de la jornada en escritorio. | Should | Implementado | La columna derecha contiene perfil, calendario, entrada, asistencia y salida. |
| RF-024 | El dashboard debe actualizarse cuando un registro sea cambiado desde el panel administrativo. | Should | Parcial | Actualmente requiere recargar la página; se acepta cuando actualice al recuperar foco o mediante tiempo real. |

### 5.3 Marcación de asistencia

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-025 | El colaborador debe poder marcar asistencia desde su dashboard personal. | Must | Implementado | El botón se habilita cuando corresponde y crea un registro válido. |
| RF-026 | La marcación debe utilizar la fecha y hora del servidor en `America/Lima`. | Must | Implementado | Cambiar el reloj del dispositivo no cambia la hora registrada. |
| RF-027 | La marcación debe habilitarse solo en un día laborable. | Must | Implementado | Un día no laborable responde `no_labora` y no crea registro. |
| RF-028 | La marcación debe respetar la ventana entre la hora de entrada y la hora de salida. | Must | Implementado | Antes de la entrada o después de la salida no se crea registro. |
| RF-029 | El sistema debe clasificar como presente una marca dentro de la tolerancia. | Must | Implementado | Desde la entrada hasta el límite se registra estado `P`. |
| RF-030 | El sistema debe clasificar como tardanza una marca posterior a la tolerancia y anterior al cierre. | Must | Implementado | Dentro de ese tramo se registra estado `T`. |
| RF-031 | Solo debe existir una marca por colaborador y fecha. | Must | Implementado | Un segundo intento responde `ya_marcado`; la base conserva una sola fila. |
| RF-032 | Una marca realizada desde el portal personal debe registrar el origen `dashboard`. | Must | Implementado | La fila creada contiene `origen = 'dashboard'`. |
| RF-033 | Cuando la configuración lo exija, el usuario debe adjuntar evidencia antes de marcar. | Must | Implementado | Sin evidencia requerida, el servidor rechaza la operación. |
| RF-034 | El usuario debe poder tomar una foto o elegir una imagen existente. | Should | Implementado | Ambas opciones generan una vista previa antes de registrar. |
| RF-035 | La imagen debe comprimirse antes de la subida. | Should | Implementado | El navegador reduce dimensiones y calidad antes de enviar. |
| RF-036 | La evidencia debe llevar una marca con nombre, fecha, hora del servidor y KJA. | Should | Implementado | El archivo almacenado contiene el sello visible. |
| RF-037 | La evidencia debe almacenarse en una ruta por año, mes, colaborador y fecha. | Must | Implementado | La ruta sigue `AAAA/MM/<colaborador>/<fecha>.jpg`. |
| RF-038 | La subida de evidencia debe utilizar un permiso firmado de un solo uso. | Must | Implementado | El cliente no recibe acceso general de escritura al bucket. |
| RF-039 | El sistema debe poder registrar ubicación si el usuario concede permiso. | Could | Implementado | Latitud y longitud se guardan cuando el navegador las entrega; la denegación no bloquea por sí sola. |
| RF-040 | Después de marcar, el dashboard debe actualizar estado, calendario, horas y porcentaje. | Must | Implementado | La interfaz refleja el nuevo registro sin volver a iniciar sesión. |

### 5.4 Historial y perfil

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-041 | El usuario debe consultar su historial en un calendario mensual. | Must | Implementado | Cada día representa su estado, condición laborable y si es futuro. |
| RF-042 | El usuario debe navegar a meses anteriores y no más allá del mes actual. | Should | Implementado | El control de mes futuro permanece deshabilitado. |
| RF-043 | El historial debe diferenciar presente, tardanza, justificación, no gestión y día no laborable. | Must | Implementado | Leyenda, color y etiqueta corresponden al estado almacenado. |
| RF-044 | El historial debe resumir presentes, tardanzas, justificaciones, no gestiones y horas. | Must | Implementado | Los totales mensuales coinciden con `asis_registros`. |
| RF-045 | El usuario debe consultar su información laboral sin poder editarla. | Must | Implementado | Se muestran DNI enmascarado, área, vínculo, horario, días, contrato y horas. |
| RF-046 | El usuario debe disponer de un canal para comunicar datos incorrectos. | Should | Implementado | “Informar un cambio” abre el canal de contacto de Dirección. |
| RF-047 | El usuario debe poder solicitar un cambio de horario desde el portal. | Should | Parcial | La RPC y la tabla existen; falta incorporar el formulario a la interfaz. |
| RF-048 | Solo debe existir una solicitud de horario pendiente por colaborador. | Should | Implementado en backend | Una segunda solicitud no crea otro pendiente. |

### 5.5 Roles, permisos y equipo

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-049 | Un miembro solo debe consultar sus propios datos. | Must | Implementado | RLS impide leer fichas o registros de otras personas. |
| RF-050 | Un líder debe consultar únicamente colaboradores de su área. | Must | Implementado | Personas de otras áreas no aparecen ni son accesibles por llamada directa. |
| RF-051 | Sistemas debe poder consultar todas las áreas desde el dashboard. | Must | Implementado | El nivel `sistemas` supera la restricción de área para lectura. |
| RF-052 | El dashboard debe separar nivel de consulta y permiso administrativo. | Must | Implementado | `nivel` controla visibilidad; `rol/acceso_panel` controla edición del panel. |
| RF-053 | Las cuentas técnicas creadas por DNI + PIN no deben obtener acceso al panel administrativo. | Must | Implementado | Nacen con `acceso_panel = false`. |
| RF-054 | Líderes y Sistemas deben visualizar un resumen del equipo autorizado. | Should | Implementado | Se muestran personas visibles, registrados, tardanzas y pendientes. |
| RF-055 | El resumen de equipo debe mostrar persona, área, hora y estado de asistencia del día. | Should | Implementado | Cada fila contiene los datos permitidos por RLS. |
| RF-056 | El líder no debe modificar asistencia desde el dashboard personal. | Must | Implementado | El dashboard de equipo ofrece consulta, no edición. |
| RF-057 | Dirección debe administrar colaboradores, horarios, contratos, estados y marcas desde `asistencia.html`. | Must | Implementado | El panel existente conserva sus operaciones y permisos. |

### 5.6 Compatibilidad, continuidad e integración

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-058 | `marcar.html` debe continuar operativo durante la transición. | Must | Implementado | El flujo con enlace y PIN sigue creando registros. |
| RF-059 | El portal anterior y el dashboard deben utilizar la misma fuente de asistencia. | Must | Implementado | Ambos escriben y consultan `asis_registros`. |
| RF-060 | El panel debe distinguir el origen panel, portal o dashboard. | Should | Implementado | La interfaz administrativa etiqueta `origen = 'dashboard'` como automarcación. |
| RF-061 | Los cambios del dashboard no deben alterar certificados, clientes o perfiles del módulo de certificados. | Must | Implementado | Las migraciones del dashboard solo operan sobre `asis_*`, `dash_*` y Storage de evidencias. |
| RF-062 | El sistema debe publicar el portal mediante `/dashboard` además de `dashboard.html`. | Should | Preparado | La ruta existe en `vercel.json`; falta publicar la versión web actual. |
| RF-063 | La integración futura con certificados debe realizarse mediante un puente de identidad independiente. | Could | Planificado | El módulo se integra sin mezclar `perfiles` con `asis_perfiles`. |

### 5.7 Centro de gestión administrativa

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-064 | El dashboard debe mostrar una zona de Gestión de asistencia únicamente a cuentas con `acceso_panel = true`. | Must | Implementado | Un colaborador técnico no visualiza la navegación y una apertura directa es rechazada. |
| RF-065 | El Centro de gestión debe resumir colaboradores activos, registrados, tardanzas y personas sin registro del día. | Should | Implementado | Los indicadores se calculan desde `asis_colaboradores` y `asis_registros` del día en Lima. |
| RF-066 | El Centro de gestión debe mostrar el estado reciente del equipo y las solicitudes de horario pendientes. | Should | Implementado | La vista presenta persona, área, hora, origen, estado y solicitudes vigentes. |
| RF-067 | El administrador debe acceder desde el dashboard a Pasar lista, Mes completo, Colaboradores, Contratos, Resumen y Marcado propio según su rol. | Must | Implementado en transición | Cada herramienta abre directamente su modo correspondiente del panel vigente. |
| RF-068 | `asistencia.html` debe aceptar navegación profunda mediante un parámetro `modo` validado. | Should | Implementado | Solo los modos permitidos cambian la vista inicial; valores desconocidos llevan a Inicio. |
| RF-069 | `asistencia.html` debe comprobar explícitamente `activo = true` y `acceso_panel = true` antes de cargar datos. | Must | Implementado | Una cuenta personal autenticada no entra al panel aunque conozca la URL. |
| RF-070 | Los módulos administrativos deben migrarse al dashboard sin duplicar reglas de horario, contrato, evidencia o permisos. | Must | Parcial | Durante la transición el panel vigente permanece operativo; cada módulo se extrae y valida antes de retirar el original. |
| RF-071 | El Centro de gestión debe cargar la lista administrativa para una fecha seleccionada aplicando días laborables, contrato y excepciones en el servidor. | Must | Implementado localmente | La RPC `dash_admin_lista` solo devuelve colaboradores que laboran en la fecha y cuyo contrato ya inició. |
| RF-072 | El administrador debe buscar colaboradores y filtrar la lista por área sin recargar la página. | Should | Implementado localmente | La lista se filtra por nombre y área conservando los datos de la fecha cargada. |
| RF-073 | La lista debe mostrar horario, modalidad, horas, estado y hora registrada de cada colaborador. | Must | Implementado localmente | Cada fila presenta la jornada y el registro congelado correspondiente. |
| RF-074 | `editor` y `direccion` deben crear o corregir estados `P`, `T`, `J` y `NG` desde el dashboard. | Must | Implementado localmente | La RPC valida el rol y calcula la hora coherente con el estado usando Lima y la tolerancia vigente. |
| RF-075 | Un usuario `visor` debe consultar la lista sin poder modificar estados ni borrar evidencias. | Must | Implementado localmente | Los controles aparecen deshabilitados y Supabase rechaza escrituras y borrados directos. |
| RF-076 | Corregir una marca debe conservar su nota y evidencia existentes. | Must | Implementado localmente | El `upsert` actualiza estado, actor, hora, origen, horas y vínculo sin sobrescribir nota ni evidencia. |
| RF-077 | El personal administrativo debe abrir una evidencia mediante un enlace privado temporal. | Should | Implementado localmente | Storage crea una URL firmada con vigencia de una hora para el objeto solicitado. |
| RF-078 | Quitar una marca con evidencia debe eliminar primero la imagen y después el registro, previa confirmación. | Must | Implementado localmente | Si Storage falla, la marca se conserva; el registro solo se elimina después de confirmar el borrado de la foto. |
| RF-079 | El dashboard debe ofrecer directorios nativos de Colaboradores y Contratos a las cuentas con acceso al panel. | Must | Implementado localmente | Ambas secciones se abren dentro de Gestión y conservan enlaces al panel anterior. |
| RF-080 | La ficha administrativa debe mostrar si el colaborador tiene DNI, PIN y una cuenta técnica creada, sin exponer la huella del PIN. | Must | Implementado localmente | La RPC devuelve únicamente indicadores booleanos y nunca consulta la sal o huella hacia el cliente. |
| RF-081 | `editor` y `direccion` deben crear y editar colaboradores desde el dashboard. | Must | Implementado localmente | La RPC valida y guarda identidad, área, vínculo, horario y contrato en una sola transacción. |
| RF-082 | Todo DNI administrativo no vacío debe normalizarse a ocho dígitos y ser único. | Must | Implementado localmente | La función rechaza formatos inválidos y duplicados antes de escribir; el índice normalizado permanece como segunda barrera. |
| RF-083 | Dar de baja a un colaborador debe conservar sus marcas, horas, contrato e historial. | Must | Implementado localmente | La operación cambia `activo`, revoca sesiones personales y no elimina ninguna fila de asistencia. |
| RF-084 | El personal con permiso de edición debe crear áreas y asignarlas en la ficha. | Should | Implementado localmente | El nombre se valida y no permite duplicados sin distinguir mayúsculas. |
| RF-085 | El horario semanal debe admitir modalidad, entrada, salida y vínculo por día, rechazando salidas anteriores o iguales a la entrada. | Must | Implementado localmente | El servidor normaliza los siete días y deriva `dias_laborables` del horario válido. |
| RF-086 | La ficha debe gestionar inicio, fin de referencia, meta, horas previas, contrato pendiente y meta de voluntariado. | Must | Implementado localmente | Los campos se guardan juntos y el dato de voluntariado solo aplica a vínculos mixtos. |
| RF-087 | El seguimiento contractual debe calcularse en el servidor. | Must | Implementado localmente | La RPC entrega horas cumplidas, faltantes, horas semanales, alertas, cumplimiento y término estimado. |
| RF-088 | Los cambios de horario, metas, fechas, identidad y estado deben quedar en una bitácora con actor y motivo. | Must | Implementado localmente | La actualización y sus entradas de historial se confirman o revierten dentro de la misma transacción. |
| RF-089 | Un `visor` debe consultar colaboradores, contratos e historial sin poder crear, editar, dar de baja o crear áreas. | Must | Implementado localmente | La interfaz oculta acciones y todas las RPC de escritura vuelven a validar el rol. |
| RF-090 | Corregir el DNI no debe crear otra identidad ni alterar el PIN o el historial del colaborador. | Must | Implementado localmente | La cuenta técnica está vinculada al ID interno; el DNI funciona como identificador de entrada y puede corregirse de forma segura. |

| RF-091 | El dashboard debe ofrecer una grilla mensual nativa sin abandonar el Centro de gestión. | Must | Implementado localmente | La sección Mes completo presenta todos los días y personas del periodo con cabecera y nombre fijos. |
| RF-092 | La consulta mensual debe resolver horario, inicio de contrato, feriado y excepción personal en el servidor. | Must | Implementado localmente | `dash_admin_mes` entrega por celda si labora, motivo, modalidad, marca y metadatos aplicando la prioridad vigente. |
| RF-093 | La grilla debe distinguir `P`, `T`, `J`, `NG`, día pendiente, no laborable, feriado, preinicio, evidencia y excepción. | Must | Implementado localmente | Cada condición tiene texto accesible y representación visual; las marcas reales no se ocultan aunque el día no sea laborable. |
| RF-094 | El administrador debe navegar por mes, buscar por nombre, filtrar por área e incluir bajas. | Should | Implementado localmente | Los filtros se aplican sin recargar y las bajas solo se consultan al solicitarlas. |
| RF-095 | `editor` y `direccion` deben gestionar feriados y excepciones personales desde la grilla. | Must | Implementado localmente | Las RPC vuelven a validar el rol y no eliminan marcas al cambiar la condición del día. |
| RF-096 | La grilla debe permitir crear, corregir o quitar una marca reutilizando las operaciones seguras de la fase 2. | Must | Implementado localmente | Se usan `dash_admin_guardar_estado` y `dash_admin_quitar_estado`, incluida la coordinación con evidencia privada. |
| RF-097 | Un `visor` debe consultar el mes, detalles y exportaciones sin modificar marcas, feriados o excepciones. | Must | Implementado localmente | La interfaz oculta acciones y Supabase rechaza llamadas de escritura sin `asis_puede_editar()`. |
| RF-098 | El resumen mensual debe mostrar conteos por persona de `P`, `T`, `J`, `NG`, programados, pendientes, horas y porcentaje de asistencia. | Must | Implementado localmente | Los indicadores llegan calculados en la misma respuesta consolidada del mes. |
| RF-099 | El porcentaje mensual debe conservar la fórmula histórica `(P + T) / (P + T + J)`. | Must | Implementado localmente | `NG` y días sin marca no alteran el denominador; cuando no existe base se muestra sin porcentaje. |
| RF-100 | Mes completo y Resumen deben exportarse en CSV compatible con Excel. | Should | Implementado localmente | El archivo usa UTF-8 con BOM, separador punto y coma y respeta los filtros visibles. |
| RF-101 | El panel anterior debe permanecer disponible como contingencia durante el piloto de la fase 4. | Must | Implementado | Ambas vistas conservan un enlace directo a su equivalente en `asistencia.html`. |

| RF-102 | El dashboard debe integrar Marcado propio como módulo nativo exclusivo de Dirección. | Must | Implementado localmente | La navegación y la RPC rechazan a `editor`, `visor` y cuentas sin acceso al panel. |
| RF-103 | El módulo debe distinguir el Portal KJA de uso diario y el enlace anterior utilizado para crear el PIN. | Must | Implementado localmente | La interfaz presenta ambas rutas como pasos diferentes y genera el QR únicamente para el portal oficial. |
| RF-104 | Dirección debe copiar la ruta del portal, copiar la activación y descargar un QR del dashboard. | Should | Implementado localmente | Las acciones no incluyen credenciales personales ni escriben información en Supabase. |
| RF-105 | Dirección debe configurar la tolerancia entre 0 y 120 minutos y la obligatoriedad de evidencia. | Must | Implementado localmente | La validación ocurre en cliente y servidor; ambas reglas siguen alimentando el marcado anterior y el dashboard. |
| RF-106 | Dirección debe habilitar o cerrar el enlace anterior sin afectar el dashboard, los PIN ni las asistencias. | Must | Implementado localmente | `activo` conserva su semántica histórica sobre `/marcar`; el portal autenticado continúa separado. |
| RF-107 | Regenerar el enlace anterior debe exigir confirmación y no modificar PIN, sesiones, colaboradores o marcas. | Must | Implementado localmente | Solo cambia `asis_portal_config.clave` y registra el evento sin guardar la clave en la bitácora. |
| RF-108 | El módulo debe mostrar personas activas, PIN configurados, pendientes, bloqueos, DNI y estado del primer ingreso. | Must | Implementado localmente | Una RPC consolidada consulta claves sin devolver sal ni huella. |
| RF-109 | Reiniciar un PIN debe eliminar únicamente su huella y cerrar las sesiones personales vigentes. | Must | Implementado localmente | La cuenta técnica y el historial permanecen; la persona debe crear nuevamente su PIN. |
| RF-110 | Si existen personas sin PIN, cerrar la activación anterior debe mostrar una advertencia explícita. | Must | Implementado localmente | Dirección debe confirmar conociendo cuántas personas quedarían pendientes de activación. |
| RF-111 | Los avisos de horario deben abrir la ficha del colaborador y permitir cerrarlos como atendidos o descartados. | Should | Implementado localmente | La resolución vuelve a validar Dirección y conserva actor, fecha y resultado. |
| RF-112 | Los cambios de configuración, regeneraciones, reinicios de PIN y resoluciones de horario deben quedar auditados. | Must | Implementado localmente | `asis_admin_eventos` permanece privada y registra únicamente metadatos operativos. |
| RF-113 | El panel anterior no debe retirarse automáticamente al instalar la fase 5. | Must | Implementado | El retiro queda sujeto a regresión completa, periodo estable y aprobación expresa de Dirección. |

### 5.8 Gobierno de roles y liderazgo

| ID | Requerimiento | Prioridad | Estado | Criterio de aceptación |
|---|---|---:|---|---|
| RF-114 | El producto debe presentar tres roles comprensibles: Administrador de sistemas, Líder técnico y Colaborador. | Must | Implementado localmente | La navegación y las etiquetas traducen `sistemas`, `lider` y `miembro` sin exponer la complejidad interna de permisos. |
| RF-115 | Una cuenta sin colaborador vinculado debe ocultar Inicio, Mi asistencia y Mi perfil. | Must | Implementado localmente | Un administrador exclusivamente administrativo entra directamente a Gestión. |
| RF-116 | Un administrador de sistemas vinculado a un colaborador debe conservar su espacio personal y visualizar Administración como grupo separado. | Should | Implementado localmente | Las opciones personales solo aparecen si `colaborador_id` existe. |
| RF-117 | Mi equipo debe mostrarse solamente al líder técnico y limitarse a su área. | Must | Implementado localmente | Sistemas usa Gestión y no recibe una opción redundante de Mi equipo; RLS mantiene el alcance del líder. |
| RF-118 | Solo un administrador de sistemas con permiso Dirección debe administrar líderes. | Must | Implementado localmente | La interfaz oculta el módulo y las RPC devuelven `sin_permiso` ante cualquier otra combinación. |
| RF-119 | Cada área debe tener como máximo un líder técnico. | Must | Implementado | El disparador existente y la asignación transaccional impiden dos líderes simultáneos. |
| RF-120 | El administrador debe asignar, reemplazar o retirar al líder de un área desde el dashboard. | Must | Implementado localmente | El mapa de áreas realiza el cambio en una única RPC y vuelve a cargar el estado confirmado. |
| RF-121 | Solo puede designarse líder a una persona activa, perteneciente al área y con cuenta personal activada. | Must | Implementado localmente | El servidor rechaza personas de otra área, bajas o sin primer ingreso. |
| RF-122 | Retirar el liderazgo debe conservar la cuenta personal, el PIN, las sesiones permitidas, el contrato y la asistencia histórica. | Must | Implementado localmente | Únicamente `nivel` cambia de `lider` a `miembro`. |
| RF-123 | Un contrato vencido o una cuenta inactiva debe señalar que el liderazgo requiere revisión, sin reemplazarlo automáticamente. | Should | Implementado localmente | El mapa muestra la alerta y Dirección decide quién asumirá el área. |
| RF-124 | Toda asignación, reemplazo o retiro de liderazgo debe registrar actor, área, persona anterior, persona nueva y fecha. | Must | Implementado localmente | La bitácora privada `asis_roles_eventos` conserva la trazabilidad. |
| RF-125 | El líder técnico debe abrir el perfil laboral y la asistencia mensual de las personas de su área sin capacidad de edición. | Must | Implementado localmente | Mi equipo consulta `dash_historial` por persona; la RPC y RLS rechazan integrantes de otras áreas. |

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
| RNF-006 | Los PIN deben permanecer con sal y huella; nunca en texto plano. | Auditoría de tablas y tráfico no encuentra el PIN original. |
| RNF-007 | Las evidencias deben permanecer en un bucket privado. | No se puede descargar una foto mediante URL pública permanente. |
| RNF-008 | Las URL de evidencia deben ser temporales o de un solo uso. | El permiso de subida no permite otra ruta ni reutilización indefinida. |
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
| RNF-031 | El portal anterior debe permanecer como contingencia durante el piloto. | Una caída del dashboard no impide usar el enlace vigente si Supabase continúa disponible. |
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
| RNF-040 | La interfaz debe aspirar a WCAG 2.1 nivel AA. | Contraste, foco visible, etiquetas, teclado y mensajes son auditados antes del despliegue general. |
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
| RNF-052 | Acciones administrativas sensibles deben evolucionar hacia una bitácora de auditoría. | Planificado: registrar quién cambió o eliminó marcas, contratos y perfiles. |

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
| RNF-057 | El centro de acceso debe cargar mediante una sola RPC exclusiva de Dirección. | La traza de red muestra `dash_admin_marcado` y una llamada sin rol Dirección devuelve `sin_permiso`. |
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

## 7. Reglas de negocio consolidadas

1. El DNI identifica el acceso, pero no reemplaza el ID interno del colaborador.
2. El PIN continúa siendo el mismo del sistema de marcación existente.
3. `DASH_PIN_SECRET` no modifica los PIN; genera contraseñas técnicas internas.
4. Cinco intentos incorrectos bloquean el acceso durante 15 minutos.
5. La sesión personal dura como máximo ocho horas.
6. Solo se marca en día laborable y dentro de la jornada configurada.
7. Desde la entrada hasta el límite de tolerancia corresponde `P`.
8. Después de la tolerancia y hasta la salida corresponde `T`.
9. Solo existe una asistencia por colaborador y fecha.
10. La hora válida es la del servidor en Lima.
11. Si la evidencia es obligatoria, no se registra sin una ruta válida.
12. Miembros ven lo propio; líderes ven su área; Sistemas ve todo.
13. La capacidad de consulta no concede acceso de edición al panel.
14. Las cuentas técnicas del dashboard nacen sin acceso administrativo.
15. Asistencia y certificados permanecen como dominios de datos separados.
16. El Portal KJA es la ruta diaria; `/marcar` conserva temporalmente la
    creación inicial del PIN y la contingencia.
17. Desactivar o regenerar `/marcar` no modifica PIN ni acceso al dashboard.
18. Reiniciar un PIN revoca sesiones personales, pero conserva identidad,
    cuenta técnica, asistencia, contrato e historial.
19. No se debe cerrar la activación anterior mientras existan personas sin PIN,
    salvo decisión consciente de Dirección y un canal alternativo de alta.

## 8. Dependencias

- proyecto Supabase `kja-certificados`;
- migraciones de asistencia 1 a 14;
- migraciones `dashboard_01`, `dashboard_03` y `dashboard_04`;
- migraciones administrativas `dashboard_05`, `dashboard_06`, `dashboard_07`, `dashboard_08` y `dashboard_09`;
- Edge Functions `dash-entrar` y `dash-evidencia`;
- secreto `DASH_PIN_SECRET`;
- bucket privado `asis-evidencias`;
- hosting web y ruta `/dashboard`;
- disponibilidad de navegador, cámara y conexión de cada usuario.

## 9. Restricciones operativas conocidas

- No volver a ejecutar `dashboard_03_cerrar_panel.sql` después de crear cuentas
  técnicas, porque marcaría como administrativas todas las cuentas existentes.
- No rotar `DASH_PIN_SECRET` sin actualizar las contraseñas técnicas.
- La versión web actual debe publicarse antes de comunicar `/dashboard` al
  equipo completo.
- Los cambios administrativos todavía no actualizan en tiempo real una pestaña
  del dashboard que ya estaba abierta; se requiere recarga.
- La retención de evidencias y el respaldo dependen del plan contratado y de
  una política que Dirección aún debe aprobar.

## 10. Criterio de salida de la primera versión

La primera versión puede considerarse lista para uso general cuando:

1. los RF marcados como **Must** estén implementados y probados;
2. no existan fallos críticos de permisos o exposición de datos;
3. se complete un piloto con colaborador, líder y Dirección;
4. se verifique acceso, bloqueo, vencimiento, marcado, evidencia e historial;
5. `marcar.html` y `asistencia.html` continúen operativos;
6. se confirme que certificados y sus usuarios no fueron alterados;
7. se publique `/dashboard` con HTTPS;
8. Dirección apruebe privacidad y retención de evidencias;
9. exista un procedimiento básico de respaldo, recuperación y soporte.
