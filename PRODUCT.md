# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Colaboradores de KJA que registran su jornada desde celular o escritorio.
- Líderes que consultan el cumplimiento de las personas de su área.
- Dirección y Sistemas, que administran asistencia, asignaciones y regularizaciones.

## Product Purpose

El Portal KJA centraliza la identidad laboral y el control diario de asistencia. Una jornada válida debe conservar una entrada, las evidencias obligatorias aplicables y una salida registrada con la hora oficial del servidor.

## Positioning

El portal conecta el marcado de asistencia con la evidencia real de la gestión diaria: comparticiones, reporte RPE y entregables asignados por persona o área.

## Operating Context

- Cada colaborador pertenece a un área de KJA.
- La entrada mantiene las reglas actuales de horario, modalidad, geocerca y evidencia.
- Todos deben presentar evidencias de comparticiones y del trabajo realizado durante el día.
- Los PPT, GPT, inducciones u otros entregables solo son obligatorios cuando han sido asignados.
- Si no existe marca de salida, la entrada se conserva para auditoría, pero la jornada queda incompleta y no cuenta como asistencia válida.

## Capabilities and Constraints

- Aplicación web estática con HTML, CSS y JavaScript, respaldada por Supabase Auth, PostgreSQL, Storage y Edge Functions.
- La fecha y hora válidas son las del servidor en `America/Lima`.
- Las evidencias son privadas y deben subirse mediante permisos firmados de uso limitado.
- Las imágenes se comprimen antes de subirlas para controlar el consumo de Storage.
- La primera entrega admite imágenes. El video corto requiere una fase posterior con una estrategia de transcodificación y cuotas.
- Los registros anteriores a la fecha de activación del cierre obligatorio no deben perder validez.
- `marcar.html`, el panel administrativo existente y el dominio de certificados deben seguir funcionando.

## Brand Commitments

- Nombre: KJA.
- Idioma principal: español claro y directo.
- Mantener la identidad visual vigente del dashboard y sus activos institucionales.

## Evidence on Hand

- Implementación vigente en `dashboard.html`, `assets/js/dashboard.js` y `assets/css/paginas/dashboard.css`.
- Esquema y migraciones de asistencia en `supabase/`.
- Comunicado institucional aportado por el usuario con el formato RPE y la obligatoriedad de registrar salida.
- Conversación interna aportada por el usuario sobre comparticiones, RPE y asignaciones rotativas.

## Product Principles

- Conservar siempre la trazabilidad de lo ocurrido, incluso cuando la jornada sea incompleta.
- Una indicación visual nunca sustituye una validación en el servidor.
- Mostrar al colaborador exactamente qué falta y cómo resolverlo.
- Aplicar a todos solo los requisitos realmente comunes; los entregables particulares nacen de una asignación.
- Proteger el historial y los flujos existentes durante la transición.

## Accessibility & Inclusion

La interfaz debe aspirar a WCAG 2.1 AA, funcionar con teclado, comunicar estados sin depender solo del color y adaptarse desde 360 px hasta escritorio.
