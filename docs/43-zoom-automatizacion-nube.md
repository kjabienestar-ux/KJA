# Automatización de Zoom en la nube: viabilidad pendiente

Estado: evaluación técnica; no implementada ni desplegada. Revisión: 2026-10-09.

## Requisito confirmado

KJA reutiliza una reunión principal con salas de grupo reducido ya configuradas por área. A la hora programada debe iniciarse esa reunión, abrirse sus salas existentes y habilitarse que los participantes elijan sala, también cuando llegan tarde. Debe funcionar sin una persona conectada, sin una PC local encendida y sin tener abierto el dashboard.

El acceso de los colaboradores se ofrece desde el portal. No se deben crear reuniones independientes por área ni reemplazar la serie existente.

## Resultado de la investigación

La integración REST local descrita en [42-integracion-zoom.md](42-integracion-zoom.md) gestiona reuniones y obtiene enlaces. Su acción start entrega un enlace de anfitrión al navegador: no mantiene un anfitrión conectado ni abre salas.

La documentación revisada no permite acreditar que un cron que consulte ese enlace pueda cumplir el requisito. La [API de reuniones](https://developers.zoom.us/docs/api/meetings/) ofrece gestión de reuniones; obtener un start_url no equivale a iniciar una sesión de cliente.

[Zoom Apps](https://developers.zoom.us/docs/zoom-apps/guides/breakout-rooms/) permite administrar salas cuando la aplicación es usada por el propietario en la reunión. Esto podría reducir pasos para una persona conectada, pero no demuestra ejecución desatendida en un servidor.

El [Meeting SDK nativo](https://developers.zoom.us/docs/meeting-sdk/linux/custom-ui/advanced-features/breakout-rooms/) documenta controles para iniciar salas y permitir elegirlas. Sin embargo, la [política actual del Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/) indica: “The Meeting SDK is designed for human use cases and does not support bots or AI notetakers.” La existencia de métodos técnicos no acredita soporte para este anfitrión desatendido. Debe aclararse con Zoom si existe un producto o modalidad autorizada para este caso de administración interna.

No se ha confirmado una solución soportada que ejecute el flujo completo. Esto no demuestra imposibilidad absoluta, pero impide presentarlo como una integración disponible o lista para activar.

## Arquitectura candidata, condicionada a viabilidad

1. El dashboard conserva el ID de la reunión existente y permite configurar días, hora de apertura y zona America/Lima.
2. Un programador del servidor dispara una ejecución única por reunión y fecha local.
3. Un servicio persistente en la nube utiliza el mecanismo de anfitrión que Zoom confirme como admitido. La autenticación del servidor por sí sola no sustituye ese cliente.
4. El servicio confirma que la reunión inició, recupera sus salas existentes, habilita la elección de sala y abre las salas.
5. Publica estados verificados: iniciando, reunión iniciada, salas abiertas o error. Un horario transcurrido no equivale a salas abiertas.
6. Se supervisan desconexiones, reinicios y conflictos con un anfitrión humano. No se debe cerrar una reunión en curso ni duplicar la sesión para recuperarla.

El repositorio actual no contiene este servicio. Vercel sirve el portal y Supabase gestiona datos y funciones; falta un ejecutor persistente de la sesión de anfitrión. No se ha seleccionado proveedor ni contratado infraestructura.

Una máquina virtual con el cliente de Zoom y automatización visual es una alternativa experimental a evaluar, no una solución validada: faltan confirmar soporte, comportamiento sin sesión interactiva y recuperación tras actualizaciones o solicitudes de acceso. No se ha instalado ni programado.

Zoom Rooms es otro producto distinto de las salas de grupo reducido. Su [inicio automático por calendario](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0061517) no demuestra apertura automática de estas salas. No se recomienda adquirirlo para este fin sin confirmar el flujo completo.

## Consulta preparada para Zoom — no enviada

Asunto: Inicio desatendido de reunión propia y apertura de breakout rooms desde la nube

Somos KJA y usamos una reunión recurrente de nuestra cuenta institucional, con salas de grupo reducido ya creadas por área. Necesitamos que un servicio alojado en la nube, a una hora programada y sin un usuario humano conectado, inicie esa misma reunión, abra todas las salas existentes y permita que los participantes elijan sala, incluidos quienes ingresen después.

No necesitamos grabar, transcribir ni capturar audio o video. Consultamos la política actual del Meeting SDK que limita su uso a casos humanos y no admite bots.

¿Existe un producto, API o modalidad admitida para este anfitrión desatendido de reuniones de nuestra propia cuenta? Si existe, agradeceremos confirmar:

- Mecanismo para iniciar como anfitrión y sostener la sesión en infraestructura de nube.
- Soporte para recuperar las salas ya configuradas, abrirlas sin participantes presentes y permitir elección a participantes que llegan después.
- Licencia, autenticación, revisión de aplicación y restricciones de alojamiento necesarias.
- Comportamiento soportado ante reinicios del servicio o ingreso posterior del anfitrión humano.
- Si Meeting SDK no admite este caso, qué alternativa de Zoom cumple el flujo completo.

## Prueba de aceptación antes de activación

Usar una reunión de prueba equivalente, sin alterar la serie de producción.

- Todos los navegadores de KJA cerrados y ningún anfitrión humano conectado.
- A la hora programada, comprobar en Zoom que la reunión realmente inició.
- Comprobar que aparecen y se abren las salas preexistentes, sin duplicarlas.
- Entrar con dos participantes después de la apertura; comprobar elección y entrada a sus salas.
- Reiniciar el servicio; verificar recuperación sin crear otra reunión ni expulsar participantes.
- Disparar dos veces la misma programación; verificar una sola ejecución efectiva.
- Simular credencial expirada y pérdida de conexión; comprobar estado de error sin indicar falsamente salas abiertas.
- Confirmar que los colaboradores nunca reciben credenciales ni enlaces de anfitrión.
- Verificar que un administrador puede intervenir y que el servicio no revierte sus cambios de forma inesperada.

Pendiente después de confirmar la viabilidad: horario exacto, días y feriados aplicables, conducta de cierre al terminar la jornada, proveedor y presupuesto. La hora de una captura no se considera autorización de programación.

## Alcance entregado hasta ahora

El código local del portal y la integración REST permiten vincular reuniones, filtrar destinatarios y ofrecer accesos de anfitrión/participante. Sus pruebas locales no validan automatización en la nube. No se han configurado secretos, aplicado SQL, desplegado servicios, contactado a Zoom ni modificado reuniones reales.


## Piloto de operación humana dentro del portal

Ver [44-zoom-sdk-piloto.md](44-zoom-sdk-piloto.md). Añade Meeting SDK y un permiso por reunión para responsables. Requiere configurar credenciales nuevas y validar con una reunión de ensayo; no activa la apertura desatendida por horario.
