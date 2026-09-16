# Diagramas de secuencia — Administración (PlantUML)

Cada bloque es independiente: copia desde `@startuml` hasta `@enduml` en
PlantUML para renderizarlo.

## 1. Entrada al dominio Administración y carga del resumen

```plantuml
@startuml
title Entrada al dominio Administración y carga del resumen
actor Administrador as Admin
participant "Dashboard web" as Web
participant "Supabase Auth" as Auth
participant "RPC de Supabase" as RPC

Admin -> Web: Abre Gestión
Web -> Auth: Obtiene sesión e identidad
Auth --> Web: rol, nivel, acceso_panel, puede_editar
alt acceso_panel = false
  Web --> Admin: Oculta Gestión / acceso denegado
else acceso_panel = true
  Web -> Web: Activa vista y pestaña Resumen
  par Carga concurrente
    Web -> RPC: Colaboradores y registros
  else
    Web -> RPC: Solicitudes y cierres
  else
    Web -> RPC: Equipo, mes y control diario
  else
    Web -> RPC: Roles (Dirección + Sistemas)
  end
  RPC --> Web: Datos permitidos por RLS y rol
  Web --> Admin: KPIs, prioridades y accesos
end
@enduml
```

## 2. Pasar lista: marcar, corregir o retirar una asistencia

```plantuml
@startuml
title Pasar lista: asistencia
actor "Administrador con edición" as Admin
participant "Dashboard web" as Web
participant "RPC administrativa" as RPC
database "asis_registros y evidencias" as DB

Admin -> Web: Selecciona fecha y pulsa P, T, J o NG
Web -> RPC: dash_admin_guardar_estado(colaborador, fecha, estado)
RPC -> DB: Valida rol, contrato, fecha y día laborable
alt Validación correcta
  RPC -> DB: Inserta o actualiza marca
  RPC --> Web: ok + estado actualizado
  Web -> Web: Recarga lista y cierres
  Web --> Admin: Muestra nueva marca
else Regla no satisfecha
  RPC --> Web: sin_permiso / no_labora / fecha / antes_contrato
  Web --> Admin: Explica el rechazo
end

Admin -> Web: Pulsa estado activo para retirarlo
Web --> Admin: Solicita confirmación si afecta evidencia
Admin -> Web: Confirma
Web -> RPC: dash_admin_quitar_estado(...)
RPC -> DB: Retira marca según reglas
RPC --> Web: Resultado
Web --> Admin: Lista actualizada
@enduml
```

## 3. Gestión mensual: excepción, feriado o corrección

```plantuml
@startuml
title Gestión mensual
actor "Administrador con edición" as Admin
participant "Mes completo" as Web
participant "RPC administrativa" as RPC
database "Calendario y registros" as DB

Admin -> Web: Abre una celda
Web -> RPC: dash_admin_mes(año, mes, incluir bajas)
RPC --> Web: Estado, horario, cierre, notas y evidencia
Web --> Admin: Modal de detalle
alt Corregir asistencia
  Admin -> Web: Elige P, T, J o NG
  Web -> RPC: dash_admin_guardar_estado(...)
else Habilitar día o registrar permiso
  Admin -> Web: Elige excepción
  Web -> RPC: dash_admin_guardar_excepcion(...)
else Restablecer horario
  Admin -> Web: Quita excepción
  Web -> RPC: dash_admin_quitar_excepcion(...)
else Gestionar feriado
  Admin -> Web: Agrega o quita feriado
  Web -> RPC: dash_admin_guardar_feriado / quitar_feriado
end
RPC -> DB: Valida permiso y persiste cambio
RPC --> Web: Resultado actualizado
Web --> Admin: Recarga grilla y KPIs
@enduml
```

## 4. Cierre normal de jornada por el colaborador

```plantuml
@startuml
title Cierre normal de jornada
actor Colaborador as Colab
participant "Portal KJA" as Web
participant "Storage privado" as Storage
participant "RPC de cierre" as RPC
database "Registros y entregas" as DB

Colab -> Web: Marca entrada
Web -> RPC: Registra asistencia
RPC -> DB: Valida horario, modalidad, geocerca y reglas
RPC --> Web: Entrada registrada o motivo

Colab -> Web: Adjunta evidencia
Web -> RPC: Solicita ruta temporal
RPC --> Web: Permiso de carga limitado
Web -> Storage: Sube archivo
Web -> RPC: dash_confirmar_entrega(datos, rutas)
RPC -> DB: Valida y guarda entrega con archivos
RPC --> Web: Resumen actualizado

Colab -> Web: Marca salida
Web -> RPC: dash_marcar_salida(dispositivo)
RPC -> DB: Valida entrada, horario y requisitos
alt Jornada completa
  RPC -> DB: Guarda salida y horas efectivas
  RPC --> Web: Jornada completa
else Pendientes
  RPC --> Web: Pendientes y motivo
end
Web --> Colab: Estado y próximos pasos
@enduml
```

## 5. Revisión de evidencias desde Cierres y entregables

```plantuml
@startuml
title Revisión de evidencias
actor Dirección as Dir
participant "Cierres y entregables" as Web
participant "RPC de Supabase" as RPC
participant "Storage privado" as Storage
database "Entregas y revisiones" as DB

Dir -> Web: Filtra por fecha, área o colaborador
par Carga de tablero
  Web -> RPC: dash_admin_cierres(fecha)
else
  Web -> RPC: dash_admin_revision_entregas(fecha)
end
RPC --> Web: Jornadas, requisitos y entregas activas
Web --> Dir: Progreso y bandeja de revisión
Dir -> Web: Abre evidencia pendiente
Web -> Storage: Solicita URL firmada temporal
Storage --> Web: URL de lectura limitada
Web --> Dir: Archivo y decisión
alt Aprueba
  Dir -> Web: Aprueba entrega
  Web -> RPC: dash_admin_revisar_entrega(entrega, aprobada)
else Observa
  Dir -> Web: Escribe nota de al menos 3 caracteres
  Web -> RPC: dash_admin_revisar_entrega(entrega, observada, nota)
end
RPC -> DB: Verifica Dirección y registra auditoría
RPC --> Web: Estado actualizado
Web --> Dir: Actualiza contador, evidencia y jornada
@enduml
```

## 6. Dirección carga una evidencia recibida por otro canal

```plantuml
@startuml
title Carga administrativa de evidencia
actor Dirección as Dir
participant "Cierres y entregables" as Web
participant "Edge Function dash-entrega" as Edge
participant "RPC administrativa" as RPC
participant "Storage privado" as Storage
database "Entregas y registros" as DB

Dir -> Web: Pulsa Subir faltante
Web -> Web: Calcula requisitos permitidos
alt Jornada J (justificada)
  Web --> Dir: Ofrece solo Comparticiones Facebook
else Jornada ordinaria
  Web --> Dir: Ofrece requisitos pendientes
end
Dir -> Web: Selecciona archivos y datos
loop Por cada archivo
  Web -> Edge: Solicita carga administrativa
  Edge -> RPC: dash_admin_entrega_permiso(...)
  RPC --> Edge: Ruta autorizada o rechazo
  Edge --> Web: URL/ruta temporal
  Web -> Storage: Sube archivo
end
Web -> RPC: dash_admin_confirmar_entrega(...)
RPC -> DB: Revalida rol, archivo, fecha, requisito y estado J
alt Evidencia válida
  RPC -> DB: Guarda entrega, archivos y auditoría
  opt No está justificada y completa salida
    RPC -> DB: Regulariza salida acreditada
  end
  RPC --> Web: ok + resumen actualizado
  Web --> Dir: Recarga progreso y estado
else Validación falla
  RPC --> Web: Motivo específico
  Web --> Dir: Muestra recuperación posible
end
@enduml
```

## 7. Crear una asignación o realizar un sorteo

```plantuml
@startuml
title Asignación directa o por sorteo
actor "Administrador con edición" as Admin
actor Dirección as Dir
participant Asignaciones as Web
participant "RPC de asignaciones" as RPC
database "Asignaciones y carga de 30 días" as DB

Admin -> Web: Define fecha, destino, tipo y contenido
alt Persona o área
  Admin -> Web: Confirma asignación
  Web -> RPC: dash_admin_asignar_entregable(...)
  RPC -> DB: Valida permisos, programación y destinatarios
  RPC -> DB: Crea asignación activa
  RPC --> Web: Resultado
else Sorteo
  Dir -> Web: Indica área y cantidad
  Web -> RPC: dash_admin_previsualizar_sorteo(...)
  RPC -> DB: Calcula elegibles y carga de 30 días
  RPC --> Web: Selección equilibrada
  Web --> Dir: Muestra previsualización
  Dir -> Web: Confirma sin cambiar parámetros
  Web -> RPC: dash_admin_confirmar_sorteo(...)
  RPC -> DB: Revalida y crea asignaciones
  RPC --> Web: Cantidad creada
end
Web --> Admin: Lista, estado y calendario actualizados
@enduml
```

## 8. Retiro de una asignación y limpieza de archivos

```plantuml
@startuml
title Retiro de asignación y limpieza
actor "Administrador con edición" as Admin
participant Asignaciones as Web
participant "Edge Function dash-entrega" as Edge
participant "RPC de retiro" as RPC
database "Asignaciones y entregas" as DB
participant "Storage privado" as Storage

Admin -> Web: Pulsa Quitar
Web --> Admin: Advierte anulación y borrado de archivos
Admin -> Web: Confirma retiro
Web -> Edge: eliminar_asignacion(asignación)
Edge -> RPC: dash_admin_retirar_archivos(asignación)
RPC -> DB: Desactiva asignación y anula entregas
RPC -> DB: Registra rutas pendientes
RPC --> Edge: Rutas a borrar
loop Cada ruta exclusiva
  Edge -> Storage: Elimina archivo
end
Edge -> DB: Confirma limpieza o deja reintento pendiente
Edge --> Web: Resultado
Web --> Admin: Recarga lista y estado
@enduml
```

## 9. Alta o actualización de colaborador

```plantuml
@startuml
title Gestión de colaborador
actor "Administrador con edición" as Admin
participant Colaboradores as Web
participant "RPC de equipo" as RPC
database "Personas, contratos y horarios" as DB

Admin -> Web: Abre formulario
Web -> RPC: dash_admin_equipo(incluir bajas)
RPC --> Web: Áreas, personas, contratos y permisos
Admin -> Web: Completa identidad, contrato, jornada y Facebook
opt Persona existente
  Admin -> Web: Indica motivo obligatorio
end
Web -> RPC: dash_admin_guardar_colaborador(datos, motivo)
RPC -> DB: Valida rol, datos, fechas y horas
RPC -> DB: Crea o actualiza persona, contrato y horarios
opt Edición
  RPC -> DB: Registra historial auditable
end
RPC --> Web: Persona actualizada
Web --> Admin: Recarga tarjetas, contratos y filtros
@enduml
```

## 10. Marcado propio: reglas, PIN y solicitud de horario

```plantuml
@startuml
title Administración del marcado propio
actor Dirección as Dir
participant "Marcado propio" as Web
participant "RPC de marcado" as RPC
database "Configuración, PIN y solicitudes" as DB

Dir -> Web: Abre Marcado propio
par Carga de configuración
  Web -> RPC: dash_admin_marcado()
else
  Web -> RPC: dash_admin_geocerca()
end
RPC --> Web: Reglas, accesos, PIN, sesiones y solicitudes
Web --> Dir: Salud operativa, mapa y directorio
alt Guardar política
  Dir -> Web: Ajusta tolerancia, evidencia y geocerca
  Web -> RPC: dash_admin_guardar_reglas(...)
  RPC -> DB: Valida Dirección y guarda reglas
else Reiniciar PIN
  Dir -> Web: Confirma reinicio
  Web -> RPC: dash_admin_reiniciar_pin(colaborador)
  RPC -> DB: Revoca PIN y sesiones aplicables
else Resolver solicitud de horario
  Dir -> Web: Aplicar o descartar
  Web -> RPC: dash_admin_resolver_horario(id, aplicada)
  RPC -> DB: Actualiza solicitud y, si corresponde, horario
end
RPC --> Web: Resultado actualizado
Web --> Dir: Confirmación y auditoría
@enduml
```

## 11. Asignar, reemplazar o retirar liderazgo

```plantuml
@startuml
title Roles y liderazgo
actor "Dirección con nivel Sistemas" as Sys
participant "Roles y liderazgo" as Web
participant "RPC de roles" as RPC
database "Áreas, liderazgos y auditoría" as DB

Sys -> Web: Abre Roles y liderazgo
Web -> RPC: dash_admin_roles()
RPC -> DB: Verifica Dirección + nivel Sistemas
RPC --> Web: Áreas, líderes, co-líderes y auditoría
Web --> Sys: Mapa organizacional
alt Líder
  Sys -> Web: Asignar, reemplazar o retirar líder
  Web --> Sys: Confirmación y efecto
  Sys -> Web: Confirma
  Web -> RPC: dash_admin_asignar_lider(area, persona o null)
else Co-líder
  Sys -> Web: Asignar, reemplazar o retirar co-líder
  Web --> Sys: Confirmación y límite de 2
  Sys -> Web: Confirma
  Web -> RPC: dash_admin_asignar_colider(area, persona o null, anterior)
end
RPC -> DB: Valida alcance, límite y disponibilidad
RPC -> DB: Actualiza rol y auditoría
RPC --> Web: Resultado
Web --> Sys: Mapa y bitácora actualizados
@enduml
```
