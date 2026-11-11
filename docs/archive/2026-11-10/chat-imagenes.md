# Imágenes del chat

Ejecutar `supabase/chat_07_imagenes.sql` después de chat_06 y publicar dashboard.html junto con los módulos y estilos del chat. No se ha ejecutado esta migración en producción desde Codex.

El botón Imagen permite adjuntar un JPG, PNG o WebP (original hasta 20 MB), revisar la miniatura y quitarla antes de enviar. Se admite una imagen por mensaje y texto opcional. Al tocar una imagen recibida se amplía; Escape o Cerrar vuelve al chat.

La compresión recodifica a JPEG sin metadatos, aplana transparencias sobre blanco y reduce el lado mayor a 1600 píxeles. Baja calidad y resolución buscando 150 KiB; el máximo aceptado es 300 KiB. No conserva animaciones ni el archivo original. El peso final se muestra antes de enviar. HEIC, GIF y SVG no se admiten.

El bucket chat-imagenes es privado. Solo permite crear rutas propias, no sobrescribir archivos. La lectura requiere una cuenta activa participante del mensaje, con enlaces temporales de cinco minutos. El servidor verifica ruta, MIME y tamaño al confirmar. Los reintentos conservan el identificador y evitan duplicados. Una carga abandonada puede quedar sin vincular; no es visible a otros usuarios y requiere limpieza administrativa posterior.

Pruebas automatizadas cubren la lógica de compresión con encoder simulado, límites, reintento, fallo de carga y cierre de sesión. No sustituyen una prueba real con dos cuentas, Storage y celulares después de activar la migración.
