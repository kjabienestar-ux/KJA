# Chat KJA para coordinaciones

Implementación en la rama `feat/chat-coordinaciones`. Comparte la misma interfaz y
las mismas funciones de mensajería entre colaboradores y administradores. El rol
administrativo del portal no permite leer conversaciones ajenas.

## Funciones implementadas

- Responder a un mensaje con referencia al original, en privado y en grupos.
- Editar mensajes propios durante 15 minutos. El servidor controla el plazo.
- Eliminar mensajes propios para todos: el historial conserva «Mensaje eliminado»,
  se retiran las reacciones y se revoca la posibilidad de firmar nuevos enlaces a
  sus adjuntos. Las respuestas muestran el estado actualizado del original.
- Seis reacciones, una por persona y mensaje; se puede cambiar o retirar la propia.
- Copiar texto y reenviar a personas o grupos seleccionados (organizados en el selector), con envío explícito.
- Formato de texto estilo WhatsApp: negrita (*texto*), cursiva (_texto_), tachado (~texto~) y enlaces web (URLs) convertidos automáticamente en hipervínculos seguros con apertura en nueva pestaña (`rel="noopener noreferrer"`).
- Fijar conversaciones (Pin): botón «Fijar» en la cabecera del chat para fijar conversaciones prioritarias arriba en la lista, con icono 📌 y persistencia local por usuario.
- Buscar todo el historial de la conversación en el servidor, de 50 en 50.
- Adjuntar documentos PDF, Word, Excel, PowerPoint, TXT/CSV, imágenes, audio y
  videos MP4/WebM, hasta 20 MB por archivo. Se conserva el archivo si falla el envío.
- Las imágenes JPG/PNG/WebP se comprimen y recodifican antes de subirse, como en el
  chat anterior. Las imágenes nuevas tienen vista previa en el historial.
- Grabar notas de voz de hasta dos minutos, escucharlas antes de enviarlas,
  quitarlas o enviarlas. Requiere HTTPS, soporte de MediaRecorder y permiso del
  micrófono. Cerrar la conversación o la sesión detiene las pistas del micrófono.
- Grupos abiertos por área, extraídos de la propuesta existente, y grupos privados
  nuevos con selección de integrantes. Cualquier cuenta activa puede crear un
  grupo privado. Su creador puede renombrarlo, agregar o retirar personas y
  transferir la administración. Un administrador del grupo debe transferirla
  antes de salir. Los nuevos integrantes pueden consultar el historial previo.
- Panel más amplio y control Ampliar/Reducir en escritorio.
- Avisos opcionales del navegador mientras KJA siga abierto. Solo muestran un
  aviso genérico, sin cuerpo del mensaje. El usuario activa el permiso mediante
  «Avisos»; no se solicita automáticamente.

Se mantienen emojis, mensajes a varios, lista de contactos, imágenes anteriores,
presencia, lectura, historial paginado y notificaciones Realtime existentes.

## Activación

1. Sobre una instalación que ya tenga `chat_01` a `chat_09`, ejecutar en orden:
   - `supabase/chat_10_grupos.sql`
   - `supabase/chat_11_coordinaciones.sql`
   - `supabase/chat_12_grupos_privados.sql`
2. Publicar `dashboard.html`, `assets/js/dashboard-chat.js`,
   `assets/js/chat-coordinaciones.js` y `assets/css/paginas/chat-coordinaciones.css`.
   Conservar los archivos existentes de imágenes y estilos del chat.
3. Recargar el portal o cerrar y volver a abrir la sesión. La RPC
   `chat_capacidades` habilita las funciones instaladas. No hace falta una bandera
   manual para activar grupos. Si la RPC no existe o falla, se mantiene el chat
   anterior y la detección se vuelve a intentar al iniciar una nueva sesión.
4. Probar con dos cuentas reales en navegadores separados: envío/lectura, edición,
   respuestas, adjuntos, nota de voz y búsqueda. Crear un grupo privado e intentar
   consultarlo con una tercera cuenta no incluida. Revisar escritorio y móvil,
   teclado en pantalla, permiso denegado de micrófono y desconexiones.

Las migraciones están probadas en PostgreSQL local mediante PGlite, incluida su
reejecución. **No se han aplicado al proyecto Supabase de producción ni se han
publicado los cambios de esta rama.**

## Seguridad y comportamiento

Las nuevas tablas no permiten acceso directo desde clientes. Las RPC obtienen la
identidad desde `auth.uid()`, comprueban cuenta activa, autor y pertenencia al
grupo. Los archivos están en el bucket privado `chat-archivos`; solo los
participantes autorizados pueden obtener un enlace temporal de cinco minutos.
Los enlaces ya emitidos pueden durar hasta su vencimiento tras una eliminación o
retiro del grupo.

Eliminar un mensaje no borra físicamente el objeto de Storage. Los objetos de
mensajes eliminados y las cargas sin mensaje confirmado requieren una política
de retención/limpieza administrada por Sistemas. No hay un borrado automático de
objetos en esta entrega.

El texto se inserta con `textContent`; no se interpreta HTML enviado por usuarios.
El envío conserva la clave de idempotencia durante reintentos. Las actualizaciones
de mensajes y reacciones se recuperan con la sincronización de cinco segundos,
incluidas las páginas de historial ya cargadas. Los eventos Realtime actuales
siguen avisando de mensajes nuevos. Una pestaña oculta depende de Realtime para
recibir avisos; al regresar se recupera el historial.

## Alcance frente a WhatsApp

Esta entrega amplía la mensajería de coordinación; no constituye paridad completa
con WhatsApp. No incluye llamadas/videollamadas, cifrado de extremo a extremo,
notificaciones push con el navegador cerrado, sincronización offline de envíos,
estados, ubicación en vivo, encuestas, stickers personalizados, mensajes
temporales, fijar/archivar/silenciar conversaciones ni indicador «escribiendo».
El reenvío actual es de texto; no copia adjuntos de otras conversaciones.

Antes de retirar WhatsApp como canal operativo conviene validar la entrega en
dispositivos reales y acordar cómo recibir avisos con el portal cerrado.

## Validación

Con Node.js 22 actualizado:

```sh
npm run test:chat
```

Si el Node global es antiguo:

```sh
npx --yes --package=node@22 node --test tests/chat.test.mjs tests/chat-images.test.mjs tests/chat-coordinaciones.test.mjs tests/chat-coordinaciones-sql.test.mjs
```

El proyecto ya depende de jsdom 29, que no funciona con el Node 20.10.0 instalado
en este entorno. Se utilizó Node 22 para las nuevas pruebas de DOM, sin cambiar
la instalación global.

48 pruebas aprobadas. Las pruebas SQL incluyen aislamiento entre terceros,
idempotencia, referencias cruzadas inválidas, autoría de ediciones, búsqueda
literal, acceso a archivos, grupos privados y transferencia de administración.
Las pruebas DOM incluyen compatibilidad sin migración, operaciones pendientes al
salir, respuestas, edición, eliminación, búsqueda, reacciones, micrófono,
formato estilo WhatsApp (enlaces y negrita), fijación de chats y reenvío a grupos.
También verifican que un formulario de grupo no sobreviva al cambio de cuenta
y que un contacto inactivo conserve su historial sin acciones de envío.

La revisión independiente calificó como resueltos esos dos últimos hallazgos
(`ship` exclusivamente sobre sus correcciones); no otorgó aprobación visual.

Revisión visual en navegador y prueba con Supabase real pendientes: el conector
de navegador de esta sesión no ofrece navegadores y rechazó crear uno.
