# Chat interno del portal

Implementación local en `dashboard.html`. Para habilitarla en el sistema desplegado es necesario ejecutar la migración y publicar los archivos actualizados. No se ha aplicado a Supabase desde esta sesión.

## Funciones

- Botón **Mensajes** en la esquina inferior derecha, disponible después de entrar al portal.
- Acceso amarillo **#FEBC1C**, con icono y texto **Mensajes**. Panel minimalista con lista a la izquierda y conversación a la derecha; en celular se navega entre ambas mediante **Volver a las personas**.
- Pestaña **Mis chats** para recuperar conversaciones guardadas. Al cerrar una ventana se conserva en memoria el historial cargado de hasta 20 conversaciones de la cuenta actual; al salir de la cuenta se limpia esa memoria y al volver a ingresar se recupera el historial desde Supabase. No se borran mensajes al cerrar ventanas.
- Fotos de perfil existentes en la lista, con iniciales como alternativa. Requiere `chat_03_fotos_perfil.sql` y los archivos del chat actualizados. Usa la asociación real `asis_perfiles.colaborador_id`; las cuentas administrativas sin colaborador asociado conservan iniciales. El bucket permanece privado: solo se autoriza leer el avatar actual de colaboradores activos con cuenta activa. No amplía acceso a evidencias ni datos laborales.
- Directorio de cuentas activas, búsqueda por nombre y filtro **Dirección**. Después de `chat_02_direccion_contactos.sql`, este filtro muestra únicamente a Yeiser y Erika, siempre que sus cuentas estén activas y conserven el rol Dirección. La selección se fija por UUID; los demás administradores permanecen en Equipo con sus permisos actuales. No es un buzón compartido ni un envío a toda Dirección.
- Una conversación visible dentro del panel, con minimizar, restaurar y cerrar. La interfaz conserva hasta dos conversaciones abiertas en memoria; se recuperan seleccionando a la persona en el directorio y el historial sigue guardado en Supabase.
- Mensajes de texto de hasta 4000 caracteres, historial paginado de 50 en 50 y contadores sin leer. Enter envía y Shift + Enter agrega una línea.
- Confirmación **Enviado** al guardar en el servidor y **Leído** cuando el destinatario enfoca la conversación visible y llega al final. No se afirma entrega al dispositivo.
- **En línea** y punto verde solo con presencia vigente confirmada por el servidor. Cada pestaña visible envía una señal cada 25 segundos; caduca a los 70 segundos sin señal. Al ocultar la pestaña intenta retirar su presencia; una desconexión brusca puede tardar hasta 70 segundos en desaparecer, más el siguiente refresco visual. No equivale a monitoreo continuo del dispositivo. Si falla la consulta, se oculta el punto y aparece **Estado no disponible**. Las cuentas sin presencia no llevan círculo verde.
- Sincronización cada cinco segundos mientras la página está visible; se recupera al volver a la pestaña. El historial también se puede actualizar manualmente. Esta versión usa consultas periódicas, no WebSockets ni notificaciones push.
- Las preferencias de ventanas se guardan por cuenta en `sessionStorage`. Los mensajes se guardan en Supabase y se recuperan al volver a ingresar; no se guardan sus cuerpos en almacenamiento del navegador. Los borradores sin enviar permanecen en memoria y se advierte antes de cerrar la página o descartarlos desde una ventana.

## Activación

1. Verificar que existe `asis_perfiles` con la identidad y los roles del dashboard; dependencia: `dashboard_01_identidad_y_roles.sql`.
2. Ejecutar **`supabase/chat_01_mensajes.sql`** completo en Supabase SQL Editor. Es transaccional y admite reejecución. Crea una tabla nueva y cinco funciones; no modifica asistencia ni publicaciones.
   Después ejecutar **`supabase/chat_02_direccion_contactos.sql`** para limitar el filtro Dirección a Yeiser y Erika. Si el chat ya está habilitado, basta ejecutar este segundo archivo. Valida que los nombres actuales identifiquen una sola cuenta administrativa activa por persona; si hay ambigüedad, revierte la operación. La propia cuenta no aparece en su directorio.
3. Publicar `dashboard.html`, `assets/js/dashboard.js`, `assets/js/dashboard-chat.js` y `assets/css/paginas/dashboard-chat.css`.
   Para mostrar fotos, ejecutar antes **`supabase/chat_03_fotos_perfil.sql`** (requiere `dashboard_10_fotos_perfil.sql`). Los enlaces se firman por una hora, se reutilizan hasta 50 minutos y los cambios de foto se consultan cada 30 segundos mientras el portal está visible. Un fallo al cargar fotos no bloquea los mensajes.
   Para activar los indicadores verdes, ejecutar **`supabase/chat_04_presencia.sql`**. Las pestañas de una misma cuenta se registran por separado: cerrar una no desconecta las demás. No permite actualizar presencia de otro usuario ni consultar la tabla directamente. Sin esta migración, los mensajes siguen funcionando y no se inventan estados de conexión.
4. Entrar con dos cuentas en sesiones separadas. Desde una, buscar a la otra, enviar un mensaje y comprobar llegada, respuesta y lectura. Recargar ambas páginas y confirmar que el historial permanece.
5. Verificar Dirección con una cuenta que tenga realmente ese rol y revisar la presentación en escritorio y celular.

No se requieren secretos nuevos, buckets, Edge Functions ni activar Realtime. Si la migración falta, el chat muestra que debe habilitarse y permite reintentar sin bloquear el resto del portal. El directorio incluye cuentas ya creadas; no da de alta usuarios que aún no tienen cuenta.

## Privacidad y controles

`chat_mensajes` tiene RLS habilitada y no concede lectura, escritura, actualización ni borrado directo a `anon` o `authenticated`. Se accede exclusivamente mediante RPC con permisos explícitos. Las funciones obtienen al remitente de `auth.uid()` y exigen un perfil activo.

Solo los dos participantes pueden consultar la conversación. Ser Dirección o Sistemas no otorga acceso a conversaciones ajenas. El directorio expone identificador, nombre, indicador de Dirección, disponibilidad y resumen de la conversación propia; no expone DNI, PIN ni correo.

El servidor valida contenido, destinatario y un máximo de 30 mensajes por minuto por remitente. Un identificador generado por el cliente evita duplicados cuando se reintenta un envío cuya respuesta se perdió. Las cuentas desactivadas con conversación previa se conservan para consultar el historial; no pueden usar el chat ni recibir mensajes nuevos.

## Verificación realizada

- `npm test`: incluye pruebas de filtrado, contenido como texto, reintentos, envíos simultáneos, cierre de sesión con operaciones pendientes, lectura, preferencias y recuperación de más de 50 mensajes, incluso al enviar antes de sincronizar.
- `tests/chat-sql-check.mjs`: ejecutado con [PGlite](https://pglite.dev/docs/) en una base PostgreSQL temporal en memoria, con tres identidades ficticias. Comprueba migración repetible, permisos anónimos/directos, aislamiento, lectura, idempotencia, límites, paginación e inactivación. No conecta a Supabase.
- Para repetir esa comprobación aislada: instalar `@electric-sql/pglite` en una carpeta temporal y ejecutar `node tests/chat-sql-check.mjs <ruta-a-pglite/dist/index.js>`.
- Revisión de código independiente y detector de diseño: correcciones de recuperación de historial, foco y contraste; avisos de diseño solo orientativos sobre escalas y colores heredados.
- Pendiente: ejecución sobre Supabase real y revisión visual/asistiva en navegador, no disponible en esta sesión.

Esta entrega cubre comunicación de texto. Adjuntos, grupos y nuevos flujos de trabajos/pendientes requieren su propia implementación posterior.

El panel amarillo (`dashboard-chat.js` y CSS versión 6) requiere publicar `dashboard.html` y ambos archivos del chat, más la migración 04 para presencia. La columna de 360px y las tres posiciones iguales mantienen **Equipo**, **Dirección** y **Mis chats** alineados y completos junto al buscador. Las pruebas incluyen historial, navegación del panel, expiración sin interacción, fallos de conexión y ocultación durante peticiones pendientes. Presentación final pendiente de comprobar en navegador.
# Abrir desde Cierres y entregables

Ejecutar `supabase/chat_05_abrir_colaborador.sql` después de chat_04. El botón «Mensaje» ahora llama a `KJAChat.openCollaborator(colaboradorId)` y abre la conversación flotante. La RPC resuelve el ID de colaborador a la cuenta activa vinculada, sin buscar por nombre; solo Dirección activa puede utilizar ese acceso. Si no tiene cuenta vinculada, está desactivado o es la misma cuenta, muestra un aviso. No se envía nada hasta que el usuario escriba y pulse Enviar. Se conserva el historial y los borradores existentes, y en móvil se mantiene el comportamiento sin teclado automático.

Esta integración cambia el acceso desde el botón, no convierte las notificaciones privadas anteriores en mensajes de chat ni elimina su historial. Pruebas de apertura, reentrada, falta de cuenta, cierre de sesión, concurrencia y permisos SQL aislados.
