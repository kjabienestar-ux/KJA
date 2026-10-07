# Portada del perfil

Aplicar `dashboard_104_portada_perfil.sql` después de la 103. Publicar dashboard.html, dashboard.js y dashboard-profile-cover.css.

En **Mi perfil**, cada colaborador puede subir una portada con imagen, al estilo de Facebook. Ocupa el borde superior de la tarjeta de identidad; la foto de perfil se monta sobre su borde inferior y el nombre queda debajo. Se adapta a escritorio y móvil con la misma proporción 8:3.

La imagen se elige en JPG, PNG o WebP (máximo 3 MB en origen), se recorta en 8:3, se reduce a 1200×450 y se comprime a un máximo de 300 KB antes de subirla. Se guarda en el bucket privado `perfil-fotos` como `<id>/portada.webp` o `<id>/portada.jpg`.

Solo la propia persona puede leer, subir, reemplazar o quitar su portada: las políticas nuevas aceptan únicamente esas dos rutas y no cambian las de la foto de perfil. Dirección y el resto del equipo no la ven.

Si no hay imagen, se mantiene el fondo de color del selector **Fondo de color** (Cielo, Jardín o Noche), guardado en el navegador. Las cuentas de administración sin colaborador vinculado conservan solo ese selector.

En escritorio la cabecera sigue el estilo de Facebook: la foto se monta sobre el borde de la portada y el nombre, el área y el vínculo quedan anclados al pie de la foto. Si la tarjeta mide al menos 820 px, el lado derecho muestra los accesos **Editar foto** y **Cambiar portada**; desde unos 1100 px añade chips con horario, días, meta de horas y vigencia, tomados de los datos del perfil ya cargados (sin consultas nuevas). En móvil la cabecera no cambia.

No ejecutar migraciones anteriores después de la 104.

Verificación local: pruebas de rutas y de pintado de la portada. Revisión visual en escritorio, tablet y móvil con una imagen de prueba; la subida real requiere aplicar la migración en Supabase.
