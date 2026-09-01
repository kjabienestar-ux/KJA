# Modalidad diaria y geocerca presencial

Esta fase instala el selector **Virtual / Presencial** y hace que Supabase valide el radio presencial de 1 km. La ubicación del navegador nunca decide por sí sola: el servidor vuelve a calcular la distancia antes de insertar la asistencia.

## Activación

1. Ejecutar completo `supabase/dashboard_13_modalidad_y_geocerca.sql` en el SQL Editor de Supabase.
2. Confirmar cinco filas `OK` y una fila `PENDIENTE` para “punto de oficina”.
3. Ejecutar completo `supabase/dashboard_14_mapa_oficina_auditable.sql` y confirmar sus dos filas `OK`.
4. Publicar `dashboard.html`, `assets/js/dashboard.js`, `assets/js/dashboard-admin-acceso.js` y `assets/css/paginas/dashboard.css`.
5. Ingresar como Dirección y abrir **Gestión → Marcado propio**.
6. En “Ubicación de la oficina”, buscar una dirección, tocar el mapa, arrastrar el marcador o pulsar **Usar mi ubicación actual**.
7. Revisar el círculo de 1 km y pulsar **Guardar reglas**. Si ya existía un punto, confirmar su reemplazo.
8. Volver a ejecutar únicamente la consulta final del SQL 13 si se desea comprobar que “punto de oficina” cambió a `OK`.

La captura del punto oficial requiere HTTPS o `localhost`. Si la precisión supera 150 m, la interfaz pide mejorar la señal antes de guardarlo.

El mapa usa Leaflet 1.9.4 y carga mosaicos de OpenStreetMap solamente cuando Dirección abre esta sección. La búsqueda se ejecuta únicamente al pulsar **Buscar**, se limita a una solicitud por segundo y conserva resultados durante 30 días. Si los servicios cartográficos no están disponibles, las coordenadas exactas y el GPS del dispositivo continúan funcionando.

## Pruebas mínimas

- Virtual: permite marcar dentro del horario con evidencia y no solicita ubicación.
- Presencial dentro del radio: solicita ubicación, muestra la distancia y habilita el registro con evidencia.
- Presencial fuera del radio: informa la distancia y mantiene deshabilitada la confirmación.
- Ubicación denegada o imprecisa: no permite marcar presencial y explica cómo recuperarse.
- Modalidad marcada: el selector queda bloqueado y el historial conserva la modalidad efectiva.
- Dashboard antiguo: el protocolo anterior es rechazado; el portal anterior ya no tiene permiso para insertar asistencias.
- Cambio administrativo: reemplazar el punto exige confirmación y registra las coordenadas anteriores y nuevas en la auditoría.

## Alcance de seguridad

La geocerca del navegador reduce marcaciones accidentales o desde ubicaciones lejanas, pero no prueba presencia física absoluta: un dispositivo manipulado puede falsificar GPS. Para un control antifraude más fuerte se recomienda combinarla posteriormente con QR rotativo dentro de la oficina, red Wi‑Fi corporativa o un dispositivo de marcación administrado.
