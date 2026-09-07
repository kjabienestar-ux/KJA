# Fase 2 — Revisión administrativa de evidencias

**Migración:** `supabase/dashboard_21_revision_evidencias.sql`
**Frontend:** `dashboard.html`, `assets/js/dashboard.js`,
`assets/js/dashboard-admin-cierre.js` y `assets/css/paginas/dashboard.css`

## Qué incorpora

- Dirección puede abrir las imágenes privadas de cada entrega mediante enlaces
  temporales de 15 minutos.
- Cada entrega queda como `pendiente`, `aprobada` u `observada`.
- Aprobar conserva el requisito completo.
- Observar exige una explicación, anula únicamente esa entrega y vuelve a
  habilitar el requisito para que el colaborador lo corrija.
- El colaborador ve **En revisión** después de subir y **Corregir** junto con la
  observación cuando Dirección solicita un nuevo envío.
- Cada decisión queda registrada en `asis_entrega_revisiones` con actor y fecha.

Las entregas existentes pasan a `pendiente`, pero continúan contando como
completas. Instalar esta fase no elimina imágenes, no modifica entradas ni
salidas y no recalcula horas.

## Permisos

| Rol | Estado del equipo | Abrir imágenes | Aprobar/observar |
|---|---:|---:|---:|
| Dirección | Sí, todas las áreas | Sí | Sí |
| Editor con panel | Sí, todas las áreas | No | No |
| Visor con panel | Sí, todas las áreas | No | No |
| Líder técnico | Sí, solo su área | Sí, solo lectura* | No |
| Colaborador | Solo su jornada | Solo sus propios archivos* | No |

`*` El acceso del líder se incorpora con
`dashboard_22_lider_revision_solo_lectura.sql`; la RPC y Storage comprueban de
nuevo que el colaborador pertenezca a su área. El colaborador conserva acceso
únicamente a sus propios archivos.

Las rutas no se devuelven a editores ni visores. La autorización se verifica
nuevamente en las RPC y en Storage; ocultar botones no es el control de
seguridad.

## Orden de despliegue

1. Abrir el SQL Editor del proyecto de Supabase.
2. Ejecutar completo `supabase/dashboard_21_revision_evidencias.sql`.
3. Confirmar cuatro filas con estado `OK`:

   - `columnas de revisión`: 4/4
   - `tabla de auditoría`: 1/1
   - `RPC de revisión`: 3/3
   - `lectura privada Dirección`: 1/1

4. Publicar juntos los cuatro archivos de frontend indicados arriba.
5. Hacer recarga forzada del dashboard (`Ctrl + F5`).

No es necesario volver a desplegar `dash-entrega` ni ejecutar otra migración.

## Piloto mínimo

1. Ingresar como colaborador de prueba, marcar entrada y subir Facebook y RPE.
2. Confirmar que ambos requisitos indiquen **En revisión** y permitan el cierre
   según las reglas vigentes.
3. Ingresar como Dirección y abrir **Gestión de asistencia → Cierres y
   entregables**.
4. Confirmar que el resumen muestre dos pendientes y que **Revisar** abra las
   imágenes privadas.
5. Aprobar Facebook y comprobar que el estado cambie a **Aprobada**.
6. Observar RPE con una explicación antes de que el colaborador marque salida.
7. Volver al portal del colaborador y comprobar que RPE muestre **Corregir**, la
   explicación de Dirección y la salida bloqueada.
8. Subir el RPE corregido, aprobarlo y completar la salida.
9. Probar un editor, un visor y un líder: ninguno debe obtener rutas ni abrir
   imágenes.
10. Intentar observar después de una salida: debe responder que la jornada ya
    está cerrada, sin alterar horas ni evidencias.

## Retorno seguro

Si la nueva vista presenta un problema, no reviertas columnas ni elimines
entregas. Retira temporalmente los archivos nuevos del frontend o evita usar la
acción de revisión mientras se corrige. La Fase 1 seguirá considerando como
completas las entregas `pendiente` y `aprobada`; solo una observación confirmada
reabre el requisito.
