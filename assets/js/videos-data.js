/* KJA · Videos cortos (reels, TikToks, shorts) de la página videos.html.
 *
 * Para agregar un video, copia un bloque y completa:
 *   titulo      Texto que se muestra en la tarjeta y en el carrusel.
 *   descripcion Una o dos líneas sobre el contenido.
 *   tema        Etiqueta corta (ej. 'Cursos y talleres'). Define el color de la portada generada.
 *   fecha       'AAAA-MM-DD' de publicación. La página ordena sola del más reciente al más antiguo.
 *   duracion    Opcional. 'm:ss' tal como aparece en la red social.
 *   plataforma  'youtube' | 'tiktok' | 'facebook'.
 *   url         Enlace público del video, copiado desde "Compartir → Copiar enlace".
 *               Se puede quitar lo que va después del "?" (códigos de rastreo):
 *                 YouTube   https://www.youtube.com/shorts/ID  (o youtu.be/ID, watch?v=ID)
 *                 TikTok    https://www.tiktok.com/@cuenta/video/NUMERO  (no sirve vm.tiktok.com)
 *                 Facebook  https://www.facebook.com/reel/NUMERO
 *               Instagram no se admite: su reproductor trae el marco de la app.
 *   portada     Imagen de la tarjeta: vertical 9:16 en .webp (ideal 720x1280), dentro de images/videos/.
 *               Ej. 'images/videos/aplicar-una-prueba.webp'. Sin portada se genera una con los colores de KJA.
 *   video       MP4 del video dentro de assets/videos/ (H.264 + AAC, vertical, menos de 8 MB, con "inicio rápido").
 *               Con él se reproduce en la página, solo y con sonido; sin él se usa el reproductor de la red social.
 *   ejemplo     Solo para contenido de prueba: muestra la insignia "Ejemplo".
 *
 * VIDEOS_DEMO = true muestra el aviso "Contenido de ejemplo" sobre la cuadrícula.
 */
const VIDEOS_DEMO = false;

const VIDEO_DATA = [
    {
        titulo: '¿Aplicar una prueba es suficiente para hacer una buena evaluación?',
        descripcion: 'Una evaluación psicológica va más allá de aplicar un instrumento: requiere saber administrarlo, analizar sus resultados e interpretarlos según cada caso.',
        tema: 'Evaluación psicológica',
        fecha: '2026-10-05',
        plataforma: 'facebook',
        url: 'https://www.facebook.com/reel/1350703886928055',
        portada: 'images/videos/aplicar-una-prueba.webp',
        video: 'assets/videos/aplicar-una-prueba.mp4'
    },
    {
        titulo: 'Cursos y talleres especializados: impulsa tu desarrollo profesional',
        descripcion: 'Nuestros programas especializados te dan nuevas herramientas para tu trabajo y te abren oportunidades para seguir creciendo.',
        tema: 'Cursos y talleres',
        fecha: '2026-08-03',
        plataforma: 'facebook',
        url: 'https://www.facebook.com/reel/2272281236852229',
        portada: 'images/videos/cursos-y-talleres.webp',
        video: 'assets/videos/cursos-y-talleres.mp4'
    },
    {
        titulo: 'No capacitarte también tiene un costo',
        descripcion: 'Talleres especializados para estudiantes y profesionales que quieren actualizar sus conocimientos y fortalecer su perfil.',
        tema: 'Capacitación',
        fecha: '2026-07-13',
        plataforma: 'facebook',
        url: 'https://www.facebook.com/reel/4023748227759789',
        portada: 'images/videos/no-capacitarte.webp',
        video: 'assets/videos/no-capacitarte.mp4'
    },
    {
        titulo: '¿Tu equipo está dando su máximo potencial?',
        descripcion: 'Acompañamos a las organizaciones a fortalecer el compromiso, la productividad y el bienestar de sus colaboradores.',
        tema: 'Psicología organizacional',
        fecha: '2026-07-07',
        plataforma: 'facebook',
        url: 'https://www.facebook.com/reel/2011000939584354',
        portada: 'images/videos/equipo-maximo-potencial.webp',
        video: 'assets/videos/equipo-maximo-potencial.mp4'
    },
    {
        titulo: 'Promoción de cursos de psicología con certificado',
        descripcion: 'Cursos 100% asincrónicos con certificado académico de 120 horas, material y acceso ilimitado. Para psicólogos, docentes, terapeutas y estudiantes.',
        tema: 'Promociones',
        fecha: '2025-12-16',
        duracion: '0:45',
        plataforma: 'tiktok',
        url: 'https://www.tiktok.com/@kjaformacionpsicologica/video/7584472729005460754',
        portada: 'images/videos/promocion-cursos-certificado.webp',
        video: 'assets/videos/promocion-cursos-certificado.mp4'
    },
    {
        titulo: 'Capacítate sin gastar de más: pack de cursos grabados',
        descripcion: 'Cursos psicológicos grabados para avanzar a tu ritmo, con certificado, material descargable y acceso inmediato.',
        tema: 'Promociones',
        fecha: '2025-12-16',
        duracion: '0:35',
        plataforma: 'tiktok',
        url: 'https://www.tiktok.com/@kjaformacionpsicologica/video/7584470813835889938',
        portada: 'images/videos/pack-cursos-grabados.webp',
        video: 'assets/videos/pack-cursos-grabados.mp4'
    }
];
