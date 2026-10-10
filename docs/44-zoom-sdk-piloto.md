# Zoom dentro del portal: piloto con un responsable presente

## Estado

Implementado localmente, pendiente de configurar y probar con Zoom real. No está desplegado por este cambio.
El responsable pulsa Iniciar ensayo desde una computadora y el servidor autoriza el SDK con la identidad del anfitrión institucional. No necesita recibir su contraseña de Zoom. Esto no es un servicio que abre salas solo por horario.

La prueba admite únicamente el ID configurado en ZOOM_SDK_TEST_MEETING_ID. No usar la reunión habitual 97271980453 para el primer ensayo.

## Activación, en orden

1. Ejecutar supabase/dashboard_110_zoom_operadores.sql después de la migración 109.
2. En Zoom App Marketplace, dentro de la misma cuenta institucional, crear una **General App** y activar **Features → Embed → Meeting SDK**. Usar su Client ID y Client Secret. Son credenciales distintas de la aplicación Server-to-Server que ya existe.
3. En la aplicación Server-to-Server existente, agregar **user:read:token:admin** (Get a user's token). Mantener los permisos actuales de lectura de reunión y usuario; reactivar la app si Zoom lo solicita.
4. Crear una reunión de ensayo en esa cuenta, con salas preasignadas de prueba. Vincularla desde el dashboard. Evitar un horario en que el anfitrión esté usando la reunión habitual: las restricciones de sesiones simultáneas de Zoom siguen aplicando.
5. En Supabase → Edge Functions → Secrets guardar:
   - ZOOM_MEETING_SDK_KEY: Client ID de la General App con Meeting SDK.
   - ZOOM_MEETING_SDK_SECRET: Client Secret de esa misma app.
   - ZOOM_SDK_TEST_MEETING_ID: ID numérico de la reunión de ensayo, sin espacios.
   No cambiar ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET existentes y no pegar secretos en HTML, Git, capturas o el chat.
6. Desplegar la función actualizada:

   npx supabase functions deploy zoom-reuniones --project-ref xadxmfgdxwplmhijagix

7. Publicar los archivos del frontend, incluyendo zoom-sala.html, sus JS/CSS y vercel.json, o probar con Live Server en localhost. Usar el mismo origen que el dashboard para compartir su sesión.
8. Entrar al dashboard → Reuniones Zoom → Configuración y ayuda → Administrar Zoom dentro del portal.
9. Sistemas usa **Asignar un responsable**, elige la reunión de ensayo y escribe el correo de la cuenta del portal. Ese usuario no necesita el rol general de administrador.
10. Con la cuenta del responsable, abrir la misma pantalla desde una computadora y pulsar **Iniciar ensayo dentro del portal**.

La General App debe pertenecer a la cuenta que aloja la reunión. Este piloto no implementa autorización de reuniones externas, OAuth para cuentas ajenas ni publicación en Marketplace.

## Qué verificar en el ensayo

- El responsable obtiene el rol de anfitrión sin introducir la contraseña institucional.
- Zoom recupera las salas preasignadas. Si no lo hace, revisar la recuperación de preasignación en el panel nativo de salas; el piloto no recrea ni reemplaza salas.
- Control KJA muestra los nombres y el estado devueltos por el SDK. Si la respuesta no se reconoce, indica que hay que revisar el panel nativo, sin inventar estado.
- Abrir salas existentes solicita la apertura y vuelve a consultar el estado. Un callback exitoso por sí solo no muestra “Abiertas”.
- En el panel nativo de Zoom comprobar la opción de elección de sala por participante. RoomOption del SDK no documenta un parámetro de autoselección: **no se automatiza ni se promete en esta versión**.
- Una segunda persona ingresa como participante y efectivamente entra a una sala.
- Finalizar usando el control de Zoom. Revocar el permiso en el portal impide nuevas autorizaciones, pero no termina sesiones ya abiertas ni invalida inmediatamente tokens emitidos.
- El botón de ensayo queda deshabilitado en celulares/tabletas hasta una validación específica.

La consulta cada 15 segundos solo lee las salas de la sesión SDK abierta; no sincroniza toda la cuenta de Zoom ni reemplaza Actualizar desde Zoom en el catálogo del dashboard.

## Seguridad y alcance

Permiso específico por reunión en zoom_operadores, RLS sin acceso directo, otorgamiento/revocación solo por Dirección/Sistemas. Cada autorización verifica sesión, perfil/colaborador activo, permiso, reunión de ensayo y anfitrión perteneciente a la cuenta institucional. La firma fija reunión y rol en servidor; no acepta host, rol o número arbitrarios del navegador.

El ZAK identifica al anfitrión institucional: delegar debe reservarse a responsables de confianza. La firma y ZAK llegan al navegador autorizado solo para iniciar la sesión y no se guardan en tablas, URLs o logs. La auditoría registra actor e issuance, no confirma por sí misma que Zoom inició.

El SDK se carga bajo demanda, versión fijada 5.1.4, en una página aislada de los estilos del dashboard. Solo esa ruta habilita micrófono en Vercel; cámara/micrófono siguen requiriendo permiso del navegador.

## Validación técnica

40 pruebas automatizadas Zoom: lógica existente, permisos SQL en PGlite, revocación, firma HMAC, rechazo de reuniones fuera del piloto, auditoría y flujo UI simulado. No sustituyen el ensayo real del SDK ni una revisión visual en navegador.

## Referencias oficiales

- [Credenciales y General App con Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/get-credentials/)
- [Firma y ZAK](https://developers.zoom.us/docs/meeting-sdk/auth/)
- [Iniciar como anfitrión](https://developers.zoom.us/docs/meeting-sdk/web/client-view/meetings-webinars/)
- [Abrir salas](https://marketplacefront.zoom.us/sdk/meeting/web/functions/ZoomMtg.openBreakoutRooms.html)
- [Opciones públicas de salas](https://marketplacefront.zoom.us/sdk/meeting/web/interfaces/RoomOption.html)
- [Estados de salas](https://marketplacefront.zoom.us/sdk/meeting/web/enums/BreakoutRoomControlStatus.html)
- [Get a user's token](https://developers.zoom.us/docs/api/users/)
