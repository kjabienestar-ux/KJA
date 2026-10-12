# Zoom dentro del dashboard

Iniciar reunión monta `zoom-sala.html?embedded=1&meeting=…` en un iframe del mismo origen. El anfitrión confirma Iniciar y abrir salas dentro del panel y conserva los controles del Meeting SDK Client View existente. No se inicia una reunión al cargar el dashboard.

El iframe se conserva al actualizar la lista o cambiar de sección. Ampliar Zoom solicita pantalla completa. Cerrar panel pide confirmación y desconecta ese cliente; no equivale a Finalizar para todos. Cerrar sesión elimina el iframe. La misma reunión no se recarga si se vuelve a pulsar Iniciar; otra reunión no reemplaza la conexión existente.

El modo integrado oculta los enlaces que abrían otro dashboard y vuelve al lobby integrado al salir de Zoom. Los mensajes de estado entre marcos verifican origen y ventana emisora; no contienen firma, ZAK ni contraseña. La autorización y obtención de credenciales siguen en la Edge Function existente.

Despliegue: publicar dashboard.html, zoom-sala.html, los JS/CSS modificados y vercel.json. La política de micrófono debe permitir self en /dashboard y /dashboard.html; el iframe delega cámara, micrófono, pantalla y pantalla completa. No requiere una migración SQL nueva.

Validación pendiente en producción: iniciar una reunión autorizada con permisos de cámara/micrófono, confirmar las salas existentes, compartir pantalla, cambiar de sección y volver, salir de Zoom y comprobar el retorno al lobby. En móvil y pestañas en segundo plano, el navegador puede limitar audio/vídeo. No se ha iniciado una reunión real durante el desarrollo.

Referencia: https://developers.zoom.us/blog/meeting-sdk-iframe/
