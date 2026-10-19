# Activar wa.kjadmb.com

El portal admite `https://wa.kjadmb.com/CODIGO` y mantiene los enlaces anteriores
`https://www.kjadmb.com/w.html?k=CODIGO`. Se conserva el código de 16 caracteres
de la campaña: no hay migración de base de datos ni cambios en sus permisos.

## Activación

1. Desplegar la web con el `vercel.json` actualizado y la función Supabase
   `marketing-publicaciones` con `kja-links.mjs`.
2. En el proyecto Vercel de KJA, abrir Settings → Domains y añadir
   `wa.kjadmb.com` al mismo proyecto, sin redirigirlo a www.
3. En el proveedor DNS de `kjadmb.com`, crear el registro CNAME con nombre `wa`
   y el destino exacto que indique Vercel para ese proyecto. No sustituir los
   registros del dominio principal o del correo.
4. Esperar a que Vercel confirme el dominio y HTTPS. Probar con el código de
   una campaña existente: `https://wa.kjadmb.com/CODIGO`. Debe abrir el mismo
   número y mensaje que su enlace anterior.
5. Solo después, configurar en los secretos de Supabase:
   `MARKETING_WHATSAPP_ORIGIN=https://wa.kjadmb.com`.
6. En Publicaciones, pulsar Generar enlace corto. Confirmar el dominio nuevo
   en el copy, probar WhatsApp y guardar el borrador.

Sin ese secreto se siguen generando enlaces en el dominio anterior. Para revertir
la generación, quitar el secreto; conservar el subdominio activo para que los
enlaces ya compartidos sigan funcionando.

Documentación de DNS: https://vercel.com/docs/domains/working-with-domains/add-a-domain
