# Guardar para más tarde y eliminar del portal

Los controles están al pie del editor y permanecen disponibles en los tres pasos. Guardar para más tarde necesita un flyer ya adjunto, pero acepta campos y texto incompletos. El borrador aparece en Mis publicaciones → Borradores. No analiza el flyer ni publica en Facebook. Antes de publicar, se validan de nuevo los datos y el enlace.

Eliminar del portal pide confirmación. Solo el autor puede eliminar su registro; se bloquea durante un envío o cuando falta verificar el resultado en Facebook. La eliminación es lógica: no borra archivos ni enlaces compartidos y no llama a Facebook para retirar el post. Se conserva la cuota de cargas original.

## Activación pendiente

1. Ejecutar `supabase/marketing_05_eliminar_publicaciones.sql` en SQL Editor de Supabase.
2. Desplegar la función:

```powershell
npx supabase functions deploy marketing-publicaciones --project-ref xadxmfgdxwplmhijagix --use-api
```

3. Publicar los archivos web, o recargar con Ctrl + Shift + R si se usa el servidor local.

No se ejecutaron migraciones ni despliegues reales en esta sesión. La función nueva necesita la columna antes de desplegarse.

Validación local: 47 pruebas aprobadas de publicaciones, teléfonos, borradores parciales, confirmación y cancelación de eliminación. Sin verificación visual ni mutaciones reales en Supabase/Facebook.
