# Diagramas de secuencia — Administración

Estos diagramas describen el comportamiento implementado en el panel de
Administración. Están escritos en Mermaid y pueden visualizarse en GitHub,
GitLab, Notion o cualquier editor compatible.

Los participantes se agrupan así: **Administrador** es una cuenta con acceso al
panel; **Dirección** es la única cuenta que puede revisar evidencias, operar
sorteos o cambiar reglas de marcado; **Supabase** representa Auth, RPC y las
tablas protegidas por RLS.

## 1. Entrada al dominio Administración y carga del resumen

```mermaid
sequenceDiagram
    actor Admin as Administrador
    participant Web as Dashboard web
    participant Auth as Supabase Auth
    participant RPC as RPC de Supabase

    Admin->>Web: Abre Gestión
    Web->>Auth: Obtiene sesión e identidad
    Auth-->>Web: rol, nivel, acceso_panel, puede_editar
    alt acceso_panel = false
        Web-->>Admin: Oculta Gestión / muestra acceso denegado
    else acceso_panel = true
        Web->>Web: Activa vista única y pestaña Resumen
        par Carga inicial concurrente
            Web->>RPC: asis_colaboradores / asis_registros
            Web->>RPC: solicitudes y cierres
            Web->>RPC: equipo, mes y control diario
            Web->>RPC: roles (solo Dirección + Sistemas)
        end
        RPC-->>Web: Datos permitidos por RLS y rol
        Web-->>Admin: KPIs, prioridades y accesos disponibles
    end
```

## 2. Pasar lista: marcar, corregir o retirar una asistencia

```mermaid
sequenceDiagram
    actor Admin as Administrador con edición
    participant Web as Dashboard web
    participant RPC as dash_admin_guardar_estado / quitar_estado
    participant DB as asis_registros y evidencias

    Admin->>Web: Selecciona fecha y pulsa P, T, J o NG
    Web->>RPC: Guardar estado(colaborador, fecha, estado)
    RPC->>DB: Valida rol, contrato, fecha y día laborable
    alt Validación correcta
        RPC->>DB: Inserta o actualiza la marca
        RPC-->>Web: ok + estado actualizado
        Web->>Web: Recarga lista y cierres
        Web-->>Admin: Muestra la nueva marca
    else Sin permiso, fecha inválida o no labora
        RPC-->>Web: motivo de rechazo
        Web-->>Admin: Muestra explicación sin cambiar la lista
    end

    Admin->>Web: Pulsa el estado ya activo para retirarlo
    Web->>Admin: Pide confirmación si puede borrar evidencia asociada
    Admin->>Web: Confirma
    Web->>RPC: Quitar estado(colaborador, fecha, evidencia_eliminada)
    RPC->>DB: Elimina marca según las reglas vigentes
    RPC-->>Web: Resultado
    Web-->>Admin: Lista actualizada
```

## 3. Gestión mensual: excepción, feriado o corrección

```mermaid
sequenceDiagram
    actor Admin as Administrador con edición
    participant Web as Mes completo
    participant RPC as RPC administrativa
    participant DB as Calendario y registros

    Admin->>Web: Abre una celda del calendario
    Web->>RPC: dash_admin_mes(año, mes, incluir bajas)
    RPC-->>Web: Estado, horario, cierre, notas y evidencia
    Web-->>Admin: Modal de detalle de la jornada
    alt Corregir asistencia
        Admin->>Web: Elige P, T, J o NG
        Web->>RPC: dash_admin_guardar_estado(...)
    else Habilitar día o registrar permiso
        Admin->>Web: Elige tipo de excepción
        Web->>RPC: dash_admin_guardar_excepcion(...)
    else Restablecer horario normal
        Admin->>Web: Quita excepción
        Web->>RPC: dash_admin_quitar_excepcion(...)
    else Gestionar feriado
        Admin->>Web: Agrega o quita feriado
        Web->>RPC: dash_admin_guardar_feriado / quitar_feriado
    end
    RPC->>DB: Valida permiso y persiste el cambio
    RPC-->>Web: Resultado actualizado
    Web-->>Admin: Recarga grilla y KPIs
```

## 4. Cierre normal de jornada por el colaborador

```mermaid
sequenceDiagram
    actor Colab as Colaborador
    participant Web as Portal KJA
    participant Storage as Storage privado
    participant RPC as RPC de cierre
    participant DB as Registros y entregas

    Colab->>Web: Marca entrada
    Web->>RPC: Registra asistencia
    RPC->>DB: Valida horario, modalidad, geocerca y reglas
    RPC-->>Web: Entrada registrada o motivo de bloqueo

    Colab->>Web: Adjunta evidencia (RPE, Facebook o asignación)
    Web->>RPC: Solicita ruta temporal de carga
    RPC-->>Web: Permiso de carga de uso limitado
    Web->>Storage: Sube archivo a ruta autorizada
    Web->>RPC: dash_confirmar_entrega(datos, rutas)
    RPC->>DB: Valida archivos, requisitos y estado de la entrega
    RPC->>DB: Guarda entrega y archivos
    RPC-->>Web: Resumen actualizado

    Colab->>Web: Marca salida
    Web->>RPC: dash_marcar_salida(dispositivo)
    RPC->>DB: Valida entrada, horario y requisitos de jornada
    alt Jornada completa
        RPC->>DB: Guarda salida y horas efectivas
        RPC-->>Web: Jornada completa
    else Falta requisito
        RPC-->>Web: Pendientes y motivo
    end
    Web-->>Colab: Estado de la jornada y próximos pasos
```

## 5. Revisión de evidencias desde Cierres y entregables

```mermaid
sequenceDiagram
    actor Dir as Dirección
    participant Web as Cierres y entregables
    participant RPC as RPC de Supabase
    participant Storage as Storage privado
    participant DB as Entregas y revisiones

    Dir->>Web: Filtra por fecha, área o colaborador
    par Carga de tablero
        Web->>RPC: dash_admin_cierres(fecha)
        Web->>RPC: dash_admin_revision_entregas(fecha)
    end
    RPC-->>Web: Jornadas, requisitos y entregas activas
    Web-->>Dir: Progreso, estado de jornada y bandeja de revisión

    Dir->>Web: Abre una evidencia pendiente
    Web->>Storage: Solicita URL firmada temporal
    Storage-->>Web: URL de lectura limitada
    Web-->>Dir: Muestra archivo y formulario de decisión
    alt Aprueba
        Dir->>Web: Aprueba entrega
        Web->>RPC: dash_admin_revisar_entrega(entrega, aprobada)
    else Observa
        Dir->>Web: Escribe nota de al menos 3 caracteres
        Web->>RPC: dash_admin_revisar_entrega(entrega, observada, nota)
    end
    RPC->>DB: Verifica rol Dirección y registra auditoría
    RPC-->>Web: Estado de revisión actualizado
    Web-->>Dir: Actualiza contador, evidencia y jornada
```

## 6. Dirección carga una evidencia recibida por otro canal

```mermaid
sequenceDiagram
    actor Dir as Dirección
    participant Web as Cierres y entregables
    participant Edge as Edge Function dash-entrega
    participant RPC as RPC administrativa
    participant Storage as Storage privado
    participant DB as Entregas y registros

    Dir->>Web: Pulsa “Subir faltante”
    Web->>Web: Calcula los requisitos pendientes permitidos
    alt Jornada marcada J (justificada)
        Web-->>Dir: Solo ofrece Comparticiones de Facebook
    else Jornada ordinaria
        Web-->>Dir: Ofrece requisitos realmente pendientes
    end
    Dir->>Web: Selecciona archivos y, si aplica, hora de salida
    loop Por cada archivo
        Web->>Edge: Solicita carga administrativa
        Edge->>RPC: dash_admin_entrega_permiso(...)
        RPC-->>Edge: Ruta autorizada o rechazo
        Edge-->>Web: URL/ruta temporal
        Web->>Storage: Sube archivo
    end
    Web->>RPC: dash_admin_confirmar_entrega(...)
    RPC->>DB: Revalida rol, archivos, fecha, requisito y estado J
    alt Evidencia válida
        RPC->>DB: Guarda entrega, archivos y auditoría de Dirección
        opt Jornada no justificada y ya reúne requisitos de salida
            RPC->>DB: Regulariza salida con hora acreditada
        end
        RPC-->>Web: ok + resumen actualizado
        Web-->>Dir: Recarga progreso y estado
    else Validación falla
        RPC-->>Web: motivo específico
        Web-->>Dir: Muestra recuperación posible
    end
```

## 7. Crear una asignación o realizar un sorteo

```mermaid
sequenceDiagram
    actor Admin as Administrador con edición
    actor Dir as Dirección
    participant Web as Asignaciones
    participant RPC as RPC de asignaciones
    participant DB as Asignaciones y carga de 30 días

    Admin->>Web: Define fecha, destino, tipo, título e indicaciones
    alt Destino: persona o área
        Admin->>Web: Confirma asignación
        Web->>RPC: dash_admin_asignar_entregable(...)
        RPC->>DB: Valida permisos, programación y destinatarios
        RPC->>DB: Crea asignación activa
        RPC-->>Web: Resultado
    else Destino: sorteo
        Dir->>Web: Indica área y cantidad
        Web->>RPC: dash_admin_previsualizar_sorteo(...)
        RPC->>DB: Calcula personas elegibles y carga de 30 días
        RPC-->>Web: Selección equilibrada propuesta
        Web-->>Dir: Muestra previsualización
        Dir->>Web: Confirma sin cambiar parámetros
        Web->>RPC: dash_admin_confirmar_sorteo(...)
        RPC->>DB: Revalida elegibilidad y crea asignaciones
        RPC-->>Web: Cantidad creada
    end
    Web-->>Admin: Lista, estado y calendario actualizados
```

## 8. Retiro de una asignación y limpieza de archivos

```mermaid
sequenceDiagram
    actor Admin as Administrador con edición
    participant Web as Asignaciones
    participant Edge as Edge Function dash-entrega
    participant RPC as RPC de retiro
    participant DB as Asignaciones y entregas
    participant Storage as Storage privado

    Admin->>Web: Pulsa “Quitar”
    Web-->>Admin: Explica que se anularán entregas y archivos
    Admin->>Web: Confirma retiro
    Web->>Edge: eliminar_asignacion(asignación)
    Edge->>RPC: dash_admin_retirar_archivos(asignación)
    RPC->>DB: Desactiva asignación y anula entregas relacionadas
    RPC->>DB: Registra rutas pendientes de limpieza
    RPC-->>Edge: Rutas a borrar
    loop Cada ruta exclusiva de la asignación
        Edge->>Storage: Elimina archivo
    end
    Edge->>DB: Confirma limpieza o deja pendiente para reintento
    Edge-->>Web: Resultado
    Web-->>Admin: Recarga la lista y comunica el estado
```

## 9. Alta o actualización de colaborador

```mermaid
sequenceDiagram
    actor Admin as Administrador con edición
    participant Web as Colaboradores
    participant RPC as RPC de equipo
    participant DB as Personas, contratos y horarios

    Admin->>Web: Abre formulario de colaborador
    Web->>RPC: dash_admin_equipo(incluir bajas)
    RPC-->>Web: Áreas, personas, contratos y permisos
    Admin->>Web: Completa identidad, contrato, jornada y Facebook
    opt Está editando una persona existente
        Admin->>Web: Indica motivo obligatorio del cambio
    end
    Web->>RPC: dash_admin_guardar_colaborador(datos, motivo)
    RPC->>DB: Valida rol, datos, fechas, horas y área
    RPC->>DB: Crea/actualiza persona, contrato y horarios
    opt Edición
        RPC->>DB: Guarda historial auditable del cambio
    end
    RPC-->>Web: Persona actualizada
    Web-->>Admin: Recarga tarjetas, contratos y filtros
```

## 10. Marcado propio: reglas, PIN y solicitud de horario

```mermaid
sequenceDiagram
    actor Dir as Dirección
    participant Web as Marcado propio
    participant RPC as RPC de marcado
    participant DB as Configuración, PIN y solicitudes

    Dir->>Web: Abre Marcado propio
    par Carga de configuración
        Web->>RPC: dash_admin_marcado()
        Web->>RPC: dash_admin_geocerca()
    end
    RPC-->>Web: Reglas, accesos, PIN, sesiones y solicitudes
    Web-->>Dir: Salud operativa, mapa y directorio

    alt Guardar política de marcado
        Dir->>Web: Ajusta tolerancia, evidencia y geocerca
        Web->>RPC: dash_admin_guardar_reglas(...)
        RPC->>DB: Valida rol Dirección y persiste reglas
    else Reiniciar PIN
        Dir->>Web: Confirma reinicio para una persona
        Web->>RPC: dash_admin_reiniciar_pin(colaborador)
        RPC->>DB: Revoca PIN y sesiones aplicables
    else Resolver solicitud de horario
        Dir->>Web: Aplicar o descartar solicitud
        Web->>RPC: dash_admin_resolver_horario(id, aplicada)
        RPC->>DB: Actualiza solicitud y horario si fue aprobada
    end
    RPC-->>Web: Resultado y datos actualizados
    Web-->>Dir: Muestra confirmación y auditoría
```

## 11. Asignar, reemplazar o retirar liderazgo

```mermaid
sequenceDiagram
    actor Sys as Dirección con nivel Sistemas
    participant Web as Roles y liderazgo
    participant RPC as RPC de roles
    participant DB as Áreas, liderazgos y auditoría

    Sys->>Web: Abre Roles y liderazgo
    Web->>RPC: dash_admin_roles()
    RPC->>DB: Verifica Dirección + nivel Sistemas
    RPC-->>Web: Áreas, líderes, co-líderes y auditoría
    Web-->>Sys: Mapa organizacional

    alt Líder
        Sys->>Web: Selecciona asignar, reemplazar o retirar líder
        Web-->>Sys: Presenta confirmación y efecto del cambio
        Sys->>Web: Confirma
        Web->>RPC: dash_admin_asignar_lider(area, persona o null)
    else Co-líder
        Sys->>Web: Selecciona asignar, reemplazar o retirar co-líder
        Web-->>Sys: Presenta confirmación y límite de 2 co-líderes
        Sys->>Web: Confirma
        Web->>RPC: dash_admin_asignar_colider(area, persona o null, anterior)
    end
    RPC->>DB: Valida alcance, límites y disponibilidad
    RPC->>DB: Actualiza rol y registra auditoría
    RPC-->>Web: Resultado
    Web-->>Sys: Mapa y bitácora actualizados
```

## Reglas transversales que aplican a todos los diagramas

- El frontend decide qué controles mostrar; el servidor vuelve a validar cada
  operación. Alterar HTML o conocer una URL no concede permiso.
- Las operaciones de lectura y mutación pasan por RPC protegidas por sesión,
  rol, nivel y RLS.
- Las evidencias privadas no exponen una ruta pública: se cargan con permisos
  temporales y se consultan con URL firmadas de duración limitada.
- Las acciones que retiran datos, reinician PIN o cambian responsables piden
  confirmación antes de enviar la mutación.
- La jornada `J` conserva su registro y sus evidencias; en Cierres solo queda
  exigible la compartición de Facebook cuando corresponde al horario.
