# Integración de Zoom en el Portal KJA

Estado: implementación local preparada. No se ha conectado la cuenta de Zoom, aplicado la migración ni desplegado la función. La conexión real y la revisión visual en escritorio/móvil siguen pendientes.

## Objetivo solicitado y alcance pendiente

El requisito confirmado es iniciar automáticamente la reunión existente, abrir sus salas y permitir la elección de sala a una hora programada, desde la nube y sin intervención humana. **La implementación local actual no cumple todavía ese requisito.** Véase la [evaluación de automatización en la nube](43-zoom-automatizacion-nube.md), con la limitación de soporte encontrada y la consulta técnica preparada para Zoom.

## Flujo manual disponible en el código local: reunión principal con salas de grupo

La captura del usuario muestra salas de grupo reducido dentro de una reunión ya creada: Ingeniería, Clínica, Marketing, etc. Esas salas se reutilizan diariamente dentro de la misma reunión.

1. Vincular una sola vez el ID de la **reunión principal**, conservando su configuración. Si todos los chicos entran a esa reunión, seleccionar «Todos los colaboradores».
2. Dirección pulsa **Iniciar reunión** desde el dashboard. Se obtiene un acceso vigente de anfitrión y se abre Zoom.
3. Dentro de Zoom, el anfitrión o coanfitrión pulsa **Abrir todas las salas**.
4. Los colaboradores pulsan **Unirme** desde su portal y entran a la reunión principal. Pasan al grupo por asignación o elección propia, si Zoom tiene habilitada esa opción.

Las áreas/personas seleccionadas en el formulario controlan quién ve el acceso en KJA; no realizan asignación automática a salas de grupo. No se generan enlaces individuales a los grupos internos.

Vincular e iniciar solo consultan Zoom: no crean otra reunión, no alteran la recurrencia y no escriben la configuración de salas. Crear otra reunión permanece como acción secundaria. Las reuniones recurrentes mantienen el botón Unirme aunque Zoom no devuelva próximas fechas; la admisión y la vigencia real las controla Zoom.

La integración REST actual no ejecuta «Abrir todas las salas» ni certifica que los grupos estén abiertos. Una Zoom App usada por el anfitrión puede controlar salas dentro de la reunión, pero no resuelve por sí sola el inicio desatendido desde la nube. No hay un ejecutor automático implementado en esta entrega.

Referencias: [gestión de salas de grupo](https://support.zoom.com/hc/pb/article?id=zm_kb&sysparm_article=KB0062540) y [Zoom Apps para salas de grupo](https://developers.zoom.us/docs/zoom-apps/guides/breakout-rooms/).

## Qué incluye

- Acceso «Reuniones Zoom» en la navegación y «Mis reuniones Zoom» en el inicio personal.
- Dirección con nivel Sistemas y acceso al panel puede crear, vincular por ID, editar, sincronizar y cancelar reuniones.
- Varias salas con diferentes anfitriones, horarios y destinatarios: todos, áreas seleccionadas o personas seleccionadas.
- Creación de una fecha o serie semanal de 1–50 sesiones, con hora de Lima. Nombre permanente y fecha/hora presentadas automáticamente en el portal.
- Edición de nombre y destinatarios conservando la programación; reprogramación opcional de toda la serie. No se cambia de anfitrión al editar.
- Vinculación de reuniones existentes de tipo 2, 3 u 8: conserva enlace, recurrencia y ajustes de Zoom. Las de tipo 3 aparecen como salas sin horario fijo.
- Botón «Unirme» para participantes. «Iniciar reunión» solo para administradores autorizados, obteniendo el enlace de inicio en ese momento.
- Registro privado de operaciones, control de versión para ediciones simultáneas y recuperación de fallos sin reintentar automáticamente la creación.

La integración usa una cuenta institucional de Zoom. Los anfitriones deben pertenecer a esa cuenta. No conecta cuentas independientes mediante OAuth individual.

## Activación

### 1. Crear la aplicación en Zoom

El propietario o administrador de la cuenta debe crear una aplicación **Server-to-Server OAuth** en Zoom App Marketplace, permitir su administración y activarla.

Añadir estos permisos granulares de cuenta:

| Permiso | Uso |
|---|---|
| user:read:list_users:admin | Listar anfitriones activos |
| user:read:user:admin | Validar pertenencia y estado del anfitrión |
| meeting:read:meeting:admin | Consultar datos y accesos de una reunión |
| meeting:write:meeting:admin | Crear reuniones |
| meeting:update:meeting:admin | Editar reuniones |
| meeting:delete:meeting:admin | Cancelar reuniones |

Referencias oficiales verificadas al implementar: [aplicaciones internas](https://developers.zoom.us/docs/internal-apps/), [API de reuniones](https://developers.zoom.us/docs/api/meetings/), [API de usuarios](https://developers.zoom.us/docs/api/users/), [recurrencia](https://developers.zoom.us/docs/api/references/recurrence-object-definitions/).

### 2. Configurar los secretos en Supabase

En el proyecto institucional, abrir **Edge Functions → Secrets** y registrar:

- ZOOM_ACCOUNT_ID
- ZOOM_CLIENT_ID
- ZOOM_CLIENT_SECRET

Los valores salen de la aplicación de Zoom. Guardarlos únicamente como secretos del servidor. No pegarlos en el chat, HTML, JavaScript público, SQL ni Git. SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los proporciona el entorno de Edge Functions.

### 3. Aplicar la migración

Ejecutar **supabase/dashboard_109_zoom.sql** en el SQL Editor del proyecto, después de las migraciones actuales hasta 108.

Crea zoom_reuniones, zoom_eventos y tres RPC de lectura/autorización. No cambia las reglas de asistencia ni activa reuniones existentes. La migración es reejecutable.

Comprobar la existencia de funciones y permisos:

~~~sql
select to_regclass('public.zoom_reuniones'),
       to_regclass('public.zoom_eventos');
select has_table_privilege('authenticated','public.zoom_reuniones','select') as lectura_directa,
       has_function_privilege('anon','public.dash_zoom_listar()','execute') as acceso_anonimo;
-- Ambas columnas de permisos deben ser false.
~~~

### 4. Desplegar función y frontend

Desde el proyecto, con Supabase CLI autenticado:

~~~powershell
supabase functions deploy zoom-reuniones --project-ref xadxmfgdxwplmhijagix
~~~

supabase/config.toml declara verify_jwt = false para compatibilidad con el patrón existente; el manejador llama obligatoriamente auth.getUser() y comprueba permisos antes de cualquier consulta privilegiada. No es una función pública sin autenticación.

Publicar mediante el flujo habitual del sitio los cambios de dashboard.html, assets/js/dashboard.js, assets/js/dashboard-zoom.js, assets/js/zoom-model.js y assets/css/paginas/dashboard-zoom.css.

### 5. Vincular las salas actuales

1. Entrar con una cuenta activa de Dirección, nivel Sistemas y acceso al panel.
2. Abrir **Reuniones Zoom → Comprobar conexión**.
3. Elegir **Vincular reunión existente**, introducir el ID de Zoom y seleccionar las áreas o personas.
4. Verificar nombre, anfitrión y próxima sesión. Cambiar el nombre una sola vez a uno permanente, por ejemplo «Reunión General KJA»; el portal presenta el día y la hora.
5. Entrar con un colaborador destinatario y comprobar **Unirme**.
6. Entrar con un colaborador de otra área y comprobar que esa sala no aparece.
7. Para una reunión general, elegir «Todos los colaboradores».

Antes del uso diario, realizar una reunión de prueba y comprobar edición, cancelación de una serie de prueba, teclado y vista móvil de 360 px/escritorio. No usar la serie real para probar la cancelación.

## Uso y límites

- Los cambios guardados desde el dashboard se escriben en Zoom y se consultan nuevamente para actualizar el portal.
- «Actualizar lista» consulta Supabase. «Actualizar desde Zoom», en cada sala, recupera cambios hechos fuera del dashboard. Esta entrega no incorpora webhooks ni sincronización automática de cambios externos.
- El portal consulta su lista cada minuto mientras está visible en Inicio o Zoom, sin formulario abierto. Usa la hora entregada por el servidor para presentar las sesiones.
- «En horario» significa que el horario programado está transcurriendo; no certifica que el anfitrión haya iniciado la reunión.
- Las nuevas series semanales tienen un máximo conservador de 50 sesiones. No hay renovación automática: al finalizar se pueden reprogramar desde Editar. Una serie existente conserva su configuración al vincularla.
- Los límites de duración, participantes y reuniones simultáneas dependen de la cuenta/licencias de Zoom; la integración no los amplía.
- Se abre el enlace de Zoom. No se incrusta la videollamada dentro del portal ni se registra asistencia por pulsar el botón.
- El acceso del portal se filtra en el servidor. Un enlace recibido puede compartirse fuera del portal; la sala de espera y las políticas de admisión de Zoom siguen aplicando.
- Cancelar elimina toda la serie en Zoom y retira el acceso del portal. Archivar una solicitud sin ID solo oculta esa solicitud del portal; no elimina una posible sala remota.
- No se editan grabaciones, transcripciones ni opciones avanzadas de Zoom desde este módulo.

## Recuperación de errores

- Si existe ID de Zoom, usar **Actualizar desde Zoom**. Una reunión eliminada externamente pasa a cancelada.
- Si una creación queda sin ID por falta de confirmación, comprobar primero en Zoom si se creó. Usar **Vincular ID para recuperar** sobre la solicitud pendiente. No crear otra inmediatamente.
- Si se confirmó que la solicitud ya no se necesita, **Archivar solicitud**. Si la sala se creó, archivarla no la elimina de Zoom.
- Un bloqueo de operación dura dos minutos. Después se permite recuperar la fila; cada escritura confirma que conserva el identificador de operación.
- Una edición con versión antigua se rechaza. Actualizar la lista, cerrar el formulario y volver a abrir Editar.
- Los errores mantienen la sala fuera de la lista de participantes hasta su recuperación para evitar mostrar datos parcialmente actualizados.
- Un ID remoto único impide vincular la misma sala a dos entradas: editar sus destinatarios en la entrada existente.

## Seguridad

Las tablas no tienen permisos directos para anon/authenticated y tienen RLS habilitada. Las RPC autorizan cuentas activas; los participantes también deben ser colaboradores activos. Cada solicitud de acceso vuelve a comprobar su audiencia. Los listados nunca incluyen join_url ni enlaces de anfitrión.

Los tokens de Zoom y la clave de servicio quedan en Edge Functions. start_url nunca se guarda en la base y solo se devuelve a un administrador autorizado al iniciar. Las respuestas tienen Cache-Control: no-store. Se validan HTTPS y dominios oficiales de Zoom antes de abrir enlaces. No se registran tokens ni enlaces en la bitácora.

## Validación local

~~~powershell
npm run test:zoom
~~~

- 26 pruebas nuevas aprobadas: programación, medianoche de Lima, enlaces, OAuth, permisos SQL, idempotencia de migración, duplicados, errores parciales, bloqueo concurrente, cancelación y comportamiento de la interfaz con DOM simulado.
- Regresión de admin-entry, dashboard-mobile y dashboard-close: 65 pasan y 12 fallan. Los mismos 12 fallos se reprodujeron con los archivos de dashboard de HEAD anteriores al cambio.
- JavaScript comprobado con node --check; git diff --check sin errores.
- No hubo navegador disponible para revisión visual. No hubo llamadas reales a la cuenta Zoom ni despliegue.

## Agenda semanal

El frontend incluye una agenda de lunes a domingo con navegación entre semanas, fechas y horas de Lima. Presenta las ocurrencias sincronizadas de las reuniones vinculadas y autorizadas para cada usuario; no lista automáticamente todas las reuniones de la cuenta Zoom. No crea ni cambia reuniones. Mantiene el título original: se recomienda un título permanente como Reunión General KJA. Si faltan fechas, usar Actualizar desde Zoom; no se extrapolan fechas a partir de la recurrencia. Las salas sin horario fijo permanecen en la lista inferior.

Esta actualización solo requiere publicar dashboard.html, assets/js/zoom-model.js, assets/js/dashboard-zoom.js y assets/css/paginas/dashboard-zoom.css. No requiere nuevo SQL ni redespliegue de Edge Functions. 28 pruebas locales aprobadas; revisión visual pendiente.

## Ajuste visual y desplazamiento

La vista Zoom restaura el desplazamiento vertical del workspace en escritorio, que el shell admin-wide ocultaba. Reuniones vinculadas aparece antes de la agenda. El módulo usa fondo blanco y formularios alineados siguiendo la referencia Zoom aportada; al editar oculta temporalmente el listado y la agenda. En móvil el contenido usa el desplazamiento de la página. Actualización de frontend, sin nuevo SQL ni cambios en Zoom. Las 9 pruebas de interfaz pasan; no se pudo verificar en navegador porque no hay sesión disponible.

## Adaptación móvil

Hasta 900 px, Zoom usa desplazamiento de página, acciones distribuidas en rejilla, inicio/unión a todo el ancho, campos de 16 px y controles de al menos 46 px. Guardar queda en el flujo del formulario para evitar una barra fija junto al teclado. La agenda se apila y los diálogos largos permiten desplazamiento. CSS versión 4; sin cambios SQL ni Edge Functions. Nueve pruebas de interfaz pasan; validación visual en teléfono pendiente.

## Corrección tras prueba móvil real

El usuario confirmó que el responsable que no encuentra controles de salas entra desde celular. Zoom documenta que su app móvil permite participar en grupos, pero no administrarlos: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0062540. El dashboard no elimina esa limitación ni comprueba si los grupos están abiertos. Probar el enlace de inicio en computadora y verificar el rol de anfitrión; si no carga la configuración, usar Cargar salas preasignadas antes de abrirlas. No se amplían permisos del portal para resolver una limitación del cliente Zoom.

La pantalla prioriza la reunión e inicio: configuración y ayuda, y opciones de cada reunión, son desplegables. Márgenes móviles de 20 px protegidos de la cascada global. Aviso junto al acceso del anfitrión en móvil. La sincronización desde Zoom sigue siendo manual; no hay sincronización de grupos internos en tiempo real. Validación: nueve pruebas de UI pasan, comprobación visual pendiente (browser sin sesión; Computer Use sin pipe).
