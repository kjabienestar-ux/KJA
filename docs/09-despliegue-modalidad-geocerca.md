# Modalidad diaria y geocerca presencial

Esta fase instala el selector **Virtual / Presencial** y hace que Supabase valide el radio presencial de 1 km. La ubicación del navegador nunca decide por sí sola: el servidor vuelve a calcular la distancia antes de insertar la asistencia.

## Activación

1. Ejecutar completo `supabase/dashboard_13_modalidad_y_geocerca.sql` en el SQL Editor de Supabase.
2. Confirmar cinco filas `OK` y una fila `PENDIENTE` para “punto de oficina”.
3. Ejecutar completo `supabase/dashboard_14_mapa_oficina_auditable.sql` y confirmar sus dos filas `OK`.
4. Ejecutar completo `supabase/dashboard_15_ruta_presencial.sql` y confirmar su fila `OK`.
5. Publicar `dashboard.html`, `assets/js/dashboard.js`, `assets/js/dashboard-maps.js`, `assets/js/dashboard-admin-acceso.js` y `assets/css/paginas/dashboard.css`.
6. Ingresar como Dirección y abrir **Gestión → Marcado propio**.
7. En “Ubicación de la oficina”, buscar una dirección, tocar el mapa, arrastrar el marcador o pulsar **Usar mi ubicación actual**.
8. Revisar el círculo de 1 km y pulsar **Guardar reglas**. Si ya existía un punto, confirmar su reemplazo.
9. Volver a ejecutar únicamente la consulta final del SQL 13 si se desea comprobar que “punto de oficina” cambió a `OK`.

La captura del punto oficial requiere HTTPS o `localhost`. Si la precisión supera 150 m, la interfaz pide mejorar la señal antes de guardarlo.

Los mapas usan Leaflet 1.9.4 y cargan mosaicos de OpenStreetMap solamente cuando Dirección abre la configuración o un colaborador inicia un marcado presencial. La búsqueda administrativa se ejecuta únicamente al pulsar **Buscar**, se limita a una solicitud por segundo y conserva resultados durante 30 días. Si los servicios cartográficos no están disponibles, las coordenadas exactas, el GPS del dispositivo y la validación de Supabase continúan funcionando.

En el modal presencial, la oficina aparece con un pin rosa, el usuario con un pin azul y el círculo conserva el radio configurado de 1 km. La línea del mapa representa la distancia directa que valida Supabase; el botón **Abrir indicaciones** entrega ambos puntos a Google Maps para calcular el recorrido vial y navegar. KJA no almacena el recorrido.

## Pruebas mínimas

- Virtual: permite marcar dentro del horario con evidencia y no solicita ubicación.
- Presencial dentro del radio: solicita ubicación, muestra la distancia y habilita el registro con evidencia.
- Presencial fuera del radio: informa la distancia y mantiene deshabilitada la confirmación.
- Ruta presencial: muestra ambos pines, el círculo de geocerca y abre Google Maps con el origen y destino correctos.
- Ubicación denegada o imprecisa: no permite marcar presencial y explica cómo recuperarse.
- Modalidad marcada: el selector queda bloqueado y el historial conserva la modalidad efectiva.
- Dashboard antiguo: el protocolo anterior es rechazado; el portal anterior ya no tiene permiso para insertar asistencias.
- Cambio administrativo: reemplazar el punto exige confirmación y registra las coordenadas anteriores y nuevas en la auditoría.

## Alcance de seguridad

La geocerca del navegador reduce marcaciones accidentales o desde ubicaciones lejanas, pero no prueba presencia física absoluta: un dispositivo manipulado puede falsificar GPS. Para un control antifraude más fuerte se recomienda combinarla posteriormente con QR rotativo dentro de la oficina, red Wi‑Fi corporativa o un dispositivo de marcación administrado.
