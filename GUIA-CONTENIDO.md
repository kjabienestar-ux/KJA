# Guía de Contenido — KJA Plataforma Web

> **Audiencia:** Equipo de Marketing, Dirección, y cualquier persona que necesite actualizar contenido sin depender del equipo de desarrollo.

## ¿Qué puedo actualizar sin un programador?

| Acción | ¿Requiere programador? | Instrucciones abajo |
|--------|:---------------------:|:-------------------:|
| Agregar un nuevo curso/taller/charla | ❌ No | Sección 1 |
| Cambiar un flyer o imagen | ❌ No | Sección 2 |
| Agregar link de Zoom | ❌ No | Sección 3 |
| Agregar un código QR | ❌ No | Sección 4 |
| Cambiar textos de terapias | ❌ No | Sección 5 |
| Cambiar textos legales | ⚠️ Coordinar con Legal | Sección 6 |

---

## 1. Agregar un Nuevo Curso / Taller / Charla

Abre el archivo `cursos.html` y busca la sección que dice:

```
var cursosData = [
```

Ahí verás una lista de objetos. Para agregar uno nuevo, **copia y pega** este template al final de la lista (antes del `];`):

```javascript
{
    tipo: 'curso',                    // Opciones: 'curso' | 'especializacion' | 'taller' | 'charla'
    modalidad: 'vivo',               // Opciones: 'vivo' | 'grabado' | 'zoom' | 'presencial' | 'presencial-virtual'
    titulo: 'Nombre del curso aquí',
    descripcion: 'Descripción corta del curso (2-3 líneas máximo).',
    duracion: '8 horas',
    audiencia: 'Grupos (5-10 personas)',
    imagen: 'https://...',           // URL de la imagen o ruta local (ej: 'images/cursos/mi-flyer.jpg')
    dias: ['lun', 'mié', 'sáb'],    // Dejar vacío [] si no aplica
    zoomUrl: '',                      // URL de Zoom, o vacío si no aplica
    qrSrc: '',                        // Ruta a imagen QR, o vacío si no aplica
    flyerSrc: '',                     // Ruta al flyer, o vacío. Si se llena, REEMPLAZA la imagen
    waText: 'Hola KJA, quisiera más información sobre [nombre del curso]'
},
```

### Campos explicados:

| Campo | Qué poner | Ejemplo |
|-------|-----------|---------|
| `tipo` | Tipo de servicio educativo | `'taller'` |
| `modalidad` | Cómo se imparte | `'zoom'` |
| `titulo` | Nombre que aparecerá en la card | `'Regulación Emocional'` |
| `descripcion` | Texto descriptivo (corto) | `'Aprende a gestionar...'` |
| `duracion` | Duración total | `'4 horas'` |
| `audiencia` | A quién va dirigido | `'Grupos (5-10 personas)'` |
| `imagen` | URL de Unsplash o ruta local | `'images/cursos/foto.jpg'` |
| `dias` | Días de la semana (array) | `['sáb', 'dom']` o `[]` |
| `zoomUrl` | Link de Zoom (opcional) | `'https://zoom.us/j/123...'` |
| `qrSrc` | Imagen QR (opcional) | `'images/qr/curso-x.png'` |
| `flyerSrc` | Flyer (reemplaza `imagen`) | `'images/flyers/junio.jpg'` |
| `waText` | Texto preconfigurado de WhatsApp | `'Hola KJA, quisiera...'` |

### Valores de `tipo`:
- `'curso'` → Aparece en la pestaña "Cursos"
- `'especializacion'` → Aparece en "Especializaciones"
- `'taller'` → Aparece en "Talleres"
- `'charla'` → Aparece en "Charlas y Conferencias"

### Valores de `modalidad`:
- `'vivo'` → Badge rojo con punto parpadeante "En Vivo"
- `'grabado'` → Badge morado "📹 Grabado"
- `'zoom'` → Badge azul "💻 Zoom"
- `'presencial'` → Badge verde "📍 Presencial"
- `'presencial-virtual'` → Ambos badges (verde + azul)

---

## 2. Cambiar un Flyer o Imagen

### Opción A: Subir imagen local
1. Guarda tu imagen en la carpeta `images/` (crea subcarpetas si quieres, ej: `images/flyers/`)
2. En el objeto del curso, cambia `imagen` o `flyerSrc`:
   ```javascript
   imagen: 'images/flyers/mi-flyer-junio.jpg',
   ```

### Opción B: Usar URL externa
1. Sube la imagen a tu hosting o usa un link de Google Drive público
2. Pega el URL:
   ```javascript
   imagen: 'https://drive.google.com/uc?export=view&id=TU_ID_AQUI',
   ```

> **Nota:** Si llenas `flyerSrc`, esa imagen se usará EN LUGAR de `imagen`.

---

## 3. Agregar Link de Zoom

En el objeto del curso, llena el campo `zoomUrl`:

```javascript
zoomUrl: 'https://zoom.us/j/1234567890?pwd=abc123',
```

Esto hará que aparezca un botón azul "Unirse a Zoom" dentro de la card.

Para quitarlo, simplemente deja el campo vacío:
```javascript
zoomUrl: '',
```

---

## 4. Agregar Código QR

1. Guarda la imagen del QR en `images/qr/` (ej: `images/qr/taller-junio.png`)
2. Llena el campo `qrSrc`:
   ```javascript
   qrSrc: 'images/qr/taller-junio.png',
   ```

El QR aparecerá dentro de la card como una imagen adicional.

---

## 5. Cambiar Textos de Terapias

Los textos de las terapias están directamente en `terapia.html`. Abre el archivo y busca el texto que quieras cambiar (ej: busca "Manejo del Estrés"). Modifica el contenido dentro de las etiquetas `<p>` y `<h4>`.

---

## 6. Textos Legales

Los archivos `terminos-condiciones.html` y `politica-privacidad.html` contienen textos legales. Cualquier cambio en estos archivos **debe ser validado por el área Legal/Contable** antes de publicar.

Busca los comentarios `<!-- PENDIENTE VALIDACIÓN LEGAL -->` para identificar las secciones que aún necesitan revisión.

---

## Checklist Rápido para Marketing

Antes de publicar un cambio:

- [ ] ¿El texto no tiene errores ortográficos?
- [ ] ¿Las imágenes se ven bien en el navegador?
- [ ] ¿El link de WhatsApp tiene el texto correcto?
- [ ] ¿El link de Zoom es el correcto (si aplica)?
- [ ] ¿Probaste en el navegador abriendo `cursos.html`?

---

*Última actualización: Junio 2026*
