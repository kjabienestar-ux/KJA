# Despliegue · cierre de jornada y evidencias diarias

**Migración:** `supabase/dashboard_19_cierre_jornada.sql`

**Edge Function:** `supabase/functions/dash-entrega`
**Frontend:** `dashboard.html`, `assets/js/dashboard.js`,
`assets/js/dashboard-close-model.js`, `assets/js/dashboard-admin-cierre.js`,
`assets/js/dashboard-admin-mes.js` y `assets/css/paginas/dashboard.css`

## Alcance de esta entrega

- Muestra el área del colaborador junto al saludo.
- Conserva `marcado_at` como entrada.
- Exige comparticiones y RPE antes de permitir la salida; desde la migración 70,
  RPE aplica únicamente a jornadas virtuales.
- Admite cinco capturas de comparticiones o una imagen tipo collage.
- Muestra entregables particulares cuando han sido asignados.
- Añade en Administración la vista **Cierres y entregables** para asignar por
  persona o área y revisar el estado diario.
- Registra la salida con la hora del servidor en Lima.
- Una jornada sin salida conserva su entrada, queda incompleta y no suma horas.
- Equipo, Pasar lista, Mes completo y Resumen mensual distinguen entrada de
  jornada completa.
- Los registros anteriores al 7 de septiembre de 2026 conservan su validez.

Los videos, la revisión administrativa de evidencias y el sorteo automático de
PPT quedan fuera de esta primera entrega.

## Orden obligatorio

1. Ejecutar `supabase/dashboard_19_cierre_jornada.sql` completo en el SQL
   Editor de Supabase.
2. Confirmar que las cuatro comprobaciones finales devuelvan `OK`.
3. Desplegar la función:

   ```bash
   npx supabase@latest functions deploy dash-entrega \
     --project-ref xadxmfgdxwplmhijagix --use-api
   ```

4. Publicar juntos:

   - `dashboard.html`
   - `assets/js/dashboard.js`
   - `assets/js/dashboard-close-model.js`
   - `assets/js/dashboard-admin-cierre.js`
   - `assets/js/dashboard-admin-mes.js`
   - `assets/css/paginas/dashboard.css`

5. No publicar el frontend antes de la migración y la Edge Function. Si se
   hiciera accidentalmente, el portal ocultará el bloque nuevo cuando la RPC
   todavía no exista, pero no será posible usar el cierre.

## Configuración inicial

La migración instala estos valores:

| Parámetro | Valor inicial |
|---|---:|
| Activado | Sí |
| Obligatorio desde | 2026-09-07 |
| Salida anticipada | 15 minutos |
| Gracia posterior | 120 minutos |
| Capturas individuales | 5 |
| Collage | Permitido |

El servidor reserva permisos de carga dentro de una transacción serializada.
El margen diario crece con la cantidad de entregables asignados, de modo que la
protección no impida completar el cierre. Si una confirmación falla, la Edge
Function elimina los objetos no vinculados; además, cada ejecución depura hasta
100 permisos huérfanos con más de dos horas de antigüedad.

Dirección puede revisar la configuración con:

```sql
select * from public.asis_cierre_config where id = 1;
```

Para una contingencia real de Storage puede desactivarse temporalmente:

```sql
update public.asis_cierre_config
   set habilitado = false,
       actualizado_at = now()
 where id = 1;
```

Esta acción debe comunicarse al equipo y volver a activarse después del
incidente. Las jornadas iniciadas mientras el cierre estaba activo requieren
revisión si quedaron con cero horas.

## Asignación de entregables

Desde **Administración → Cierres y entregables**, un editor o Dirección puede:

- seleccionar la fecha;
- asignar a una persona o a toda un área;
- elegir PPT, GPT, inducción u otro entregable;
- escribir instrucciones;
- cancelar la asignación mientras nadie la haya completado.

La operación utiliza esta RPC protegida:

```sql
select public.dash_admin_asignar_entregable(
  current_date,
  123,          -- colaborador; usar null si se asigna a un área
  null,         -- área
  'ppt',
  'PPT de inducción',
  'Adjunta el PPT asignado antes de marcar tu salida.'
);
```

La función exige exactamente un destino: colaborador o área. La pantalla
también consume `dash_admin_cierres()` para presentar entrada, evidencias,
salida y estado de jornada sin consultar tablas directamente.

## Piloto mínimo

1. Ingresar con una cuenta de colaborador de prueba.
2. Confirmar que el área correcta aparece junto al saludo.
3. Marcar la entrada mediante el flujo actual.
4. Subir cinco capturas de comparticiones.
5. Subir al menos una imagen de RPE.
6. Confirmar que la salida continúa bloqueada antes de la ventana configurada.
7. Dentro de la ventana, marcar salida y verificar:

   ```sql
   select fecha, marcado_at, salida_at, horas_programadas, horas_efectivas, horas
     from public.asis_registros
    where colaborador_id = 123
    order by fecha desc
    limit 3;
   ```

8. Repetir con un entregable asignado y confirmar que bloquea solo al destino.
9. Verificar que otra cuenta no pueda confirmar ni consultar entregas ajenas.
10. Probar el flujo desde 360 px y desde escritorio.

## Regresión obligatoria

- Entrada virtual con evidencia.
- Entrada presencial con geocerca.
- Historial mensual y suma de horas.
- Acceso por DNI y PIN.
- `marcar.html` como contingencia.
- Panel administrativo existente.
- Módulo de certificados.

## Prueba local

```bash
npm test
```

La prueba valida sintaxis del JavaScript, identificadores HTML únicos, piezas
obligatorias de la migración, el flujo privado de subida y limpieza, las ramas
de estado visual, la configuración de collage y el consumo de cierres en las
vistas operativas.
