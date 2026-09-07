# Extensión de fase 2 — consulta de evidencias por líder técnico

**Migración:** `supabase/dashboard_22_lider_revision_solo_lectura.sql`

## Resultado

Cada líder técnico puede abrir desde **Mi equipo** las evidencias enviadas por
los colaboradores activos de su propia área. La lista distingue quién aún no
entregó, quién tiene archivos en revisión, quién debe corregir y quién ya fue
revisado.

El acceso del líder es estrictamente de consulta:

- no puede aprobar ni observar entregas;
- no puede asignar requisitos ni administrar colaboradores;
- no recibe entregas de otras áreas;
- no puede generar enlaces de Storage para archivos de otra área.

Dirección conserva acceso a todas las áreas y es el único rol que puede aprobar
o solicitar una corrección. Editores y visores no reciben acceso a imágenes.

## Despliegue

1. En Supabase SQL Editor, ejecutar completo
   `supabase/dashboard_22_lider_revision_solo_lectura.sql`.
2. Confirmar estas dos filas:

   - `RPC líder por área`: 1/1
   - `lectura privada líder`: 1/1

3. Publicar `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-cierre.js` y
   `assets/css/paginas/dashboard.css`.
4. Iniciar sesión con un líder y hacer una recarga forzada (`Ctrl + F5`).

No es necesario volver a desplegar la Edge Function `dash-entrega` ni repetir
las migraciones 19, 20 o 21.

## Prueba de permisos

1. Entrar como líder del área A y abrir **Mi equipo**.
2. Verificar que solo aparezcan personas del área A.
3. Abrir **Ver evidencias** y comprobar que la galería indique **Solo lectura**,
   sin botones de aprobar u observar.
4. Confirmar que cada persona muestre su situación: falta, en revisión,
   corrección pendiente o revisada.
5. Entrar como líder del área B y comprobar que no aparecen personas ni
   evidencias del área A.
6. Entrar como Dirección y comprobar que la revisión completa continúa
   disponible para todas las áreas.
