# Fase 5 — Comunicación de impedimentos

**Migración:** `supabase/dashboard_25_impedimentos_cierre.sql`

## Resultado

Cuando una evidencia continúa pendiente, el colaborador puede abrirla y usar
**¿No podrás completarlo hoy?** para explicar el motivo. El aviso:

- queda asociado a la persona, fecha y requisito exacto;
- puede actualizarse mientras la jornada siga abierta;
- aparece en **Control diario** para Dirección;
- aparece en **Mi equipo** para el líder técnico de esa misma área;
- se resuelve automáticamente cuando la evidencia correspondiente se entrega.

Informar un impedimento no marca la evidencia como completa, no habilita la
salida y no acredita asistencia ni horas. Es una constancia operativa, no una
justificación automática.

## Despliegue

1. Si la fase 4 todavía no fue instalada, ejecutar primero
   `supabase/dashboard_24_sorteo_entregables.sql`.
2. Ejecutar `supabase/dashboard_25_impedimentos_cierre.sql` completo.
3. Confirmar estas tres filas:

   - `tabla de impedimentos`: 1/1
   - `RPC de impedimentos`: 3/3
   - `resolución automática`: 1/1

4. Publicar `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-control.js` y
   `assets/css/paginas/dashboard.css`.
5. Hacer `Ctrl + F5` en cada perfil de prueba.

No se vuelve a desplegar la función `dash-entrega` y no se repiten las
migraciones que ya terminaron correctamente.

## Prueba mínima

1. Ingresar como colaborador, marcar entrada y abrir una evidencia pendiente.
2. Abrir **¿No podrás completarlo hoy?**, escribir al menos 10 caracteres y
   enviar el aviso.
3. Comprobar que el requisito muestre **Informado**, continúe pendiente y la
   salida permanezca bloqueada.
4. Ingresar como Dirección y abrir **Administración → Control diario**. Usar el
   filtro **Impedimento informado** y comprobar el motivo.
5. Ingresar como líder técnico del área y abrir **Mi equipo**. La persona debe
   mostrar **Impedimento informado** y el detalle, sin controles de aprobación.
6. Entregar la evidencia desde el colaborador. Al refrescar, el aviso debe
   desaparecer de pendientes y el requisito debe seguir el flujo normal de
   revisión.
7. Ingresar con un líder de otra área: no debe recibir ese aviso.
