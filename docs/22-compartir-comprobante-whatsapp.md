# Comprobante de comparticiones para WhatsApp

Implementado localmente. Requiere aplicar `supabase/dashboard_62_compartir_comprobante.sql` después de las migraciones existentes y publicar los archivos del portal. La migración no se ha ejecutado en Supabase desde esta sesión.

## Uso

También está disponible el botón verde **Compartir por WhatsApp de escritorio**: requiere la aplicación instalada y abre el selector de Windows para elegir WhatsApp y el grupo. Entrega imagen y texto al sistema, pero WhatsApp puede separarlos; el portal no confirma el envío. Se impiden llamadas simultáneas mientras una siga pendiente. Las opciones de descarga, copia y WhatsApp Web se conservan.

1. Subir las evidencias y abrir **Ver comprobante de evidencias**.
2. Introducir **Cantidad de comparticiones** (entero de 1 a 99999, independiente del número de capturas).
3. Pulsar **Guardar y preparar comprobante**. La cantidad se guarda por entrega; se genera un JPEG solo con las capturas, sin datos añadidos, recortes ni barras del navegador. Nombre, cantidad, fecha, hora, área y código se preparan como texto separado para la descripción de la foto.
4. Pulsar **Descargar imagen y copiar descripción**. Se inicia la descarga y se copia el texto; si se deniega el portapapeles, el texto queda seleccionado para copiar manualmente.
5. Abrir WhatsApp Web con el enlace, o la aplicación en el celular. Entrar al grupo, adjuntar primero la imagen y pegar el texto en la descripción de la foto antes de enviarla. Así aparece la imagen arriba y el texto debajo en un solo mensaje. También están disponibles Descargar imagen y Copiar mensaje por separado.

La fecha corresponde a la entrega; la hora es la del registro en Lima. Nombre y área provienen del comprobante autenticado. La cantidad es declarada por el colaborador, no verificada a partir de las imágenes. No se comparten enlaces privados ni DNI. La imagen usa un ancho fijo de 1200 píxeles y una cuadrícula de tres columnas en todos los equipos. Con muchas capturas se obtiene una imagen larga; WhatsApp puede reducir su resolución, por lo que debe comprobarse su legibilidad real.

## Verificación en teléfonos (a cargo del usuario)

Probar con HTTPS en Android/Chrome e iPhone/Safari:

- Abrir, preparar y compartir entregas con una captura, varias capturas y la cantidad máxima habitual.
- Verificar que las evidencias estén completas, en orden y legibles al ampliar en WhatsApp.
- Pegar el texto en la descripción y confirmar que llegue debajo de la imagen, con nombre, cantidad, área, fecha y hora correctos.
- Cambiar la cantidad, volver a preparar y confirmar que la descripción muestre el valor nuevo.
- Cerrar y reabrir el comprobante: debe recuperar la cantidad guardada.
- Confirmar que no se abre el selector nativo y probar la copia manual con el portapapeles denegado.
- Probar descarga, copia del mensaje, mala conexión y cierre del modal durante la preparación.
- Comparar el contenido generado desde PC con el del teléfono.

El portal no adjunta archivos automáticamente en WhatsApp Web ni confirma la entrega. No hay navegador conectado en el entorno de esta sesión: la revisión visual y el envío real quedan pendientes. Las pruebas automatizadas cubren descarga, copia y portapapeles denegado sin llamadas al selector nativo, validación, mensaje, guardado fallido, respuestas obsoletas y composición de las imágenes.

## Selector nativo opcional

Tras los bloqueos reportados, la descarga y copia siguen disponibles sin invocar el selector. A petición del usuario se restauró navigator.share exclusivamente en un botón separado, verde y rotulado para WhatsApp de escritorio. Si Windows se bloquea, usar las alternativas. La página no puede cerrar una ventana del sistema trabada. Las pruebas automatizadas verifican archivo y texto, cancelación, compatibilidad y bloqueo de llamadas simultáneas; falta verificar el selector real en el equipo del usuario.
