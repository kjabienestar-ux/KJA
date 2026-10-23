/* Cursos grabados de cursos.html: los 20 cursos gratuitos asíncronos de 1 sesión.
 * Fuente: carpeta de Drive "20 CURSOS GRATUITOS ASINCRONOS DE 1 SESIÓN (24 HORAS ACADEMICAS)".
 *
 * - destacado: true  → aparece entre las 3 tarjetas de la página (el resto se ve con la flecha).
 * - cover            → portada 800×450 en images/cursos/grabados/ (se puede reemplazar por la oficial con el mismo nombre).
 * - driveUrl         → enlace del VIDEO del curso (no de la carpeta):
 *                      https://drive.google.com/file/d/ID/view  o  https://drive.google.com/open?id=ID
 *                      El archivo debe estar compartido como "Cualquier persona con el enlace puede ver".
 *                      Mientras esté vacío, el curso se muestra como "Próximamente".
 *                      Pendientes: 10 Estimulación temprana y 19 Rabietas y berrinches.
 * - materiales       → archivos del curso que se listan bajo el video (se abren en Drive en otra pestaña):
 *                      { titulo, tipo: 'PDF' | 'PPT' | 'Video', url: 'https://drive.google.com/file/d/ID/view' }
 *                      Solo materiales propios de KJA (presentaciones y guías de la clase). No se publican
 *                      tests, manuales, láminas, hojas de respuesta, informes ni archivos .rar.
 *
 * Talleres usa su propia biblioteca en cursos-gratuitos-data.js.
 */
const FREE_COURSE_LIBRARY = {
    preview: false,
    courses: [
        { id: 'ados-adi-r', destacado: true, title: 'ADOS y ADI-R', description: 'Cómo se usan el ADOS y la ADI-R en la evaluación del espectro autista.', cover: 'images/cursos/grabados/ados-adi-r.webp', driveUrl: 'https://drive.google.com/file/d/1Unv0ZFjnTWoVEJunAT3lzeYIH6mN_gRB/view',
          materiales: [
            { titulo: 'Entrevista ADI-R', tipo: 'PDF', url: 'https://drive.google.com/file/d/1paW6-MSkkKXNR3K3LGP_8vLluhx-MreX/view' },
            { titulo: 'Entrevista neuropsicológica en niños', tipo: 'PPT', url: 'https://drive.google.com/file/d/1rLgqQe1huQrFgobamYXG0Azo9rk_n7Lq/view' }
          ] },
        { id: 'autoridad-convivencia-escolar', title: 'Autoridad y convivencia escolar', description: 'Herramientas para una autoridad positiva y una mejor convivencia en la escuela.', cover: 'images/cursos/grabados/autoridad-convivencia-escolar.webp', driveUrl: 'https://drive.google.com/file/d/115M34LzwqBke2S28EbmYDpkGii84mPKO/view',
          materiales: [
            { titulo: 'Autoridad y convivencia escolar', tipo: 'PPT', url: 'https://drive.google.com/file/d/1moR_VYxt_iM-39zRpcyLPuk-QnB-DCvj/view' },
            { titulo: 'Tutoría', tipo: 'PPT', url: 'https://drive.google.com/file/d/1X2a-2C9oPYnWurMtFapA3LRQuyE_JKTx/view' }
          ] },
        { id: 'modificacion-conducta', title: 'Casos de modificación de conducta en niños y adolescentes', description: 'Análisis de casos y estrategias de modificación de conducta.', cover: 'images/cursos/grabados/modificacion-conducta.webp', driveUrl: 'https://drive.google.com/file/d/1GDvXYezJmvsVvbec9cGU5wPFSFe1mDxJ/view',
          materiales: [
            { titulo: 'Casos de modificación de conducta en niños y adolescentes', tipo: 'PDF', url: 'https://drive.google.com/file/d/13ohblJqNGE3m4_RsydhSHHXQ1aJTA54x/view' }
          ] },
        { id: 'peabody', title: 'Clase de Peabody', description: 'Uso del Test de Vocabulario en Imágenes Peabody en la evaluación del lenguaje.', cover: 'images/cursos/grabados/peabody.webp', driveUrl: 'https://drive.google.com/file/d/1O_WL0NdE7SV3_mQ2Ug6LP-5pIF5LNiKB/view',
          materiales: [
            { titulo: 'Peabody: presentación de la clase', tipo: 'PPT', url: 'https://drive.google.com/file/d/1t4TN6sepWTKbZTqX61kMx4vpD_RycBdm/view' },
            { titulo: 'Sesiones de terapia de lenguaje', tipo: 'PDF', url: 'https://drive.google.com/file/d/11s4HqnaMXzPt3GsC29EyW4FHukrxrU57/view' },
            { titulo: 'Segundo video de la clase', tipo: 'Video', url: 'https://drive.google.com/file/d/1D2PUxmVTTQSVebW3nP1daWBQf18CiHQT/view' }
          ] },
        { id: 'entrevista-conductual-padres', title: 'Entrevista conductual a padres de familia', description: 'Cómo conducir una entrevista conductual con madres y padres.', cover: 'images/cursos/grabados/entrevista-conductual-padres.webp', driveUrl: 'https://drive.google.com/file/d/1ltFY8mYgyI9VbKBvL5op7wDamuh0MJYx/view',
          materiales: [
            { titulo: 'Técnicas y estrategias en la entrevista conductual a padres', tipo: 'PDF', url: 'https://drive.google.com/file/d/1HjJpAGk7ivrNPt5nt3y4LnEdy5uAz4no/view' }
          ] },
        { id: 'estimulacion-psicomotriz', destacado: true, title: 'Estimulación psicomotriz', description: 'Actividades para favorecer el desarrollo psicomotor en la infancia.', cover: 'images/cursos/grabados/estimulacion-psicomotriz.webp', driveUrl: 'https://drive.google.com/file/d/1q3ws_Rkv0XR286PcA8qBZRD6I3ePbzST/view',
          materiales: [
            { titulo: 'Estimulación temprana y terapia ocupacional en la infancia', tipo: 'PDF', url: 'https://drive.google.com/file/d/1qo4LnAQMbfd1ifRHhbz9ZLQ288pW8k-5/view' },
            { titulo: 'Programa de intervención de estimulación temprana', tipo: 'PDF', url: 'https://drive.google.com/file/d/12dXcr849J7r0FmdAvpiHod9lnF6tmZzX/view' }
          ] },
        { id: 'integracion-sensorial', title: 'Integración sensorial', description: 'Fundamentos de la integración sensorial y su aplicación en terapia.', cover: 'images/cursos/grabados/integracion-sensorial.webp', driveUrl: 'https://drive.google.com/file/d/1Uaf6FYPE5cJwUeVgEEZU8bCBe9HyyuSR/view',
          materiales: [
            { titulo: 'Integración sensorial en la psicomotricidad fina y gruesa (3 a 5 años)', tipo: 'PDF', url: 'https://drive.google.com/file/d/1Q3RZ-NufTf3FCRTORPIu91teao1OyELG/view' },
            { titulo: 'Problemas sensoriales en niños con TEA', tipo: 'PDF', url: 'https://drive.google.com/file/d/1Ds4UvMP1_YhnGq70Wki3fFh94LSZRBC_/view' },
            { titulo: 'Casos expositivos de niños con TEA', tipo: 'PDF', url: 'https://drive.google.com/file/d/1u809sLZA73QSRhA04tyuGeJETrnZEs6M/view' },
            { titulo: 'Actividad sensorial', tipo: 'PPT', url: 'https://drive.google.com/file/d/1Tr8phsL4-HHcr6m4aAq-dUHXxnzEYjor/view' }
          ] },
        { id: 'integracion-sensorial-tea-down', title: 'Integración sensorial en niños con TEA y Down', description: 'Estrategias sensoriales para niños con autismo y síndrome de Down.', cover: 'images/cursos/grabados/integracion-sensorial-tea-down.webp', driveUrl: 'https://drive.google.com/file/d/1mOXRZTkjNs-DepRRCL5gu1aW-2E3o4-n/view',
          materiales: [
            { titulo: 'Integración sensorial en niños con TEA y Down', tipo: 'PDF', url: 'https://drive.google.com/file/d/1vrWmEvPPhYHa_UnLidid_V03sn4WYw9s/view' },
            { titulo: 'Terapia ocupacional en niños con TEA y TDAH (5 a 7 años)', tipo: 'PDF', url: 'https://drive.google.com/file/d/1ZG0zxtsYPX8DTtZXEcz0eb32godSmRq_/view' },
            { titulo: 'Casos prácticos de estimulación temprana', tipo: 'PDF', url: 'https://drive.google.com/file/d/1pECLbiXLhZZdWs3dZycSS9Q4OrbJAgHM/view' }
          ] },
        { id: 'intervencion-psicoterapia', title: 'Intervención en psicoterapia', description: 'Pautas para planificar y conducir la intervención psicoterapéutica.', cover: 'images/cursos/grabados/intervencion-psicoterapia.webp', driveUrl: 'https://drive.google.com/file/d/18oB501SBtpTK2zaaawtEuN_uWHU_7w98/view',
          materiales: [
            { titulo: 'Intervención en psicoterapia con adolescentes (enfoque cognitivo conductual)', tipo: 'PDF', url: 'https://drive.google.com/file/d/1ZtBwxj6BPuMxj0WWf9S91nh6aUrndL4J/view' }
          ] },
        { id: 'estimulacion-temprana', title: 'Introducción a la estimulación temprana', description: 'Bases de la estimulación temprana en los primeros años de vida.', cover: 'images/cursos/grabados/estimulacion-temprana.webp', driveUrl: '',
          materiales: [
            { titulo: 'Materiales para la estimulación temprana', tipo: 'PDF', url: 'https://drive.google.com/file/d/18gSH0-3a2caB_IBp-MUdxnfYLOVHMFw1/view' },
            { titulo: 'El papel de los estimuladores en la terapia ocupacional', tipo: 'PDF', url: 'https://drive.google.com/file/d/1usd3-7LeRjTNpn0uRhnQtZaHFuIKOgDp/view' }
          ] },
        { id: 'maestra-sombra', title: 'Maestra sombra', description: 'El rol de la maestra sombra en la inclusión escolar.', cover: 'images/cursos/grabados/maestra-sombra.webp', driveUrl: 'https://drive.google.com/file/d/1do-PkErUMqYnuZQe5LbtLEfbLR5lJh8x/view',
          materiales: [
            { titulo: 'Maestra sombra: técnicas y estrategias en niños con TEA', tipo: 'PDF', url: 'https://drive.google.com/file/d/1pcElJcbROG7H4KAv8zrrGVdSsOB_8ZUX/view' }
          ] },
        { id: 'maestra-sombra-denver', title: 'Maestra sombra con enfoque Denver', description: 'Acompañamiento de la maestra sombra con el Modelo Denver.', cover: 'images/cursos/grabados/maestra-sombra-denver.webp', driveUrl: 'https://drive.google.com/file/d/10qOhk0wz37o4Yp5M33d9lMI25tU_8KYy/view',
          materiales: [
            { titulo: 'Sesiones de maestra sombra con enfoque Denver', tipo: 'PDF', url: 'https://drive.google.com/file/d/16Y3lRPZ8J7pzam319pv0turMT-PQqs6j/view' },
            { titulo: 'Elaboración de sesiones de maestra sombra', tipo: 'PDF', url: 'https://drive.google.com/file/d/1vFg8BV_9Di7PP9fcpzO_EwFeAlnhZRFF/view' }
          ] },
        { id: 'pautas-crianza', title: 'Pautas de crianza', description: 'Orientaciones para una crianza positiva y consistente.', cover: 'images/cursos/grabados/pautas-crianza.webp', driveUrl: 'https://drive.google.com/file/d/1n3FikxJH41ax5EDa73EMxGhi-2UOoqIo/view',
          materiales: [
            { titulo: 'Pautas de crianza', tipo: 'PDF', url: 'https://drive.google.com/file/d/1Bz__RACZ-pIQIS8mWDgnmoqh1GajRMs2/view' },
            { titulo: 'Cuadernillo de conducta', tipo: 'PDF', url: 'https://drive.google.com/file/d/1ixKwt5QAssFprUUzmW99AmWn9SE0JR3M/view' }
          ] },
        { id: 'terapia-ocupacional', title: 'Terapia ocupacional', description: 'Introducción a la terapia ocupacional y sus áreas de intervención.', cover: 'images/cursos/grabados/terapia-ocupacional.webp', driveUrl: 'https://drive.google.com/file/d/1gWeIrWWNeUCr-_5NwqtMRQR6eWyXmuDd/view',
          materiales: [
            { titulo: 'Terapia ocupacional en niños con TEA y TDAH (5 a 7 años)', tipo: 'PDF', url: 'https://drive.google.com/file/d/1C-TSIGPYDnOsHNo--FxsBVdZu44ah9aY/view' },
            { titulo: 'Integración sensorial en niños con TEA y Down', tipo: 'PDF', url: 'https://drive.google.com/file/d/17Bxjxw8z6ujMByhoztNR6-die2XOsn0p/view' },
            { titulo: 'Casos prácticos de estimulación temprana', tipo: 'PDF', url: 'https://drive.google.com/file/d/1Yq2xoGm-i7ZKAzerDVc_WJErXKcjy0IG/view' }
          ] },
        { id: 'praxias-lenguaje', destacado: true, title: 'Praxias de lenguaje', description: 'Ejercicios de praxias orofaciales para apoyar el habla.', cover: 'images/cursos/grabados/praxias-lenguaje.webp', driveUrl: 'https://drive.google.com/file/d/1ngBa_wSFMd_FdvUUwsSKecW78EUMAeJ_/view',
          materiales: [
            { titulo: 'Praxias de lenguaje', tipo: 'PPT', url: 'https://drive.google.com/file/d/1YR99MorcDkQXefkb9eW9SUQhI0qAGyaz/view' },
            { titulo: 'Cuadernillo de masajes y praxias orofaciales', tipo: 'PDF', url: 'https://drive.google.com/file/d/17SiZJl0wrHW0_mLtdqrOy-0syD3-Yxub/view' }
          ] },
        { id: 'orientacion-vocacional', title: 'Test de orientación vocacional', description: 'Uso de pruebas de orientación vocacional con adolescentes.', cover: 'images/cursos/grabados/orientacion-vocacional.webp', driveUrl: 'https://drive.google.com/file/d/1Tbvu-W3Pom36OMsgPNB8xXZamzVjOu1t/view',
          materiales: [
            { titulo: 'Sesiones de orientación vocacional', tipo: 'PPT', url: 'https://drive.google.com/file/d/1JU0ySK0ZHCRXK4zDGuJnUpYKclzPxhnU/view' },
            { titulo: 'Cuadernillo de orientación vocacional', tipo: 'PDF', url: 'https://drive.google.com/file/d/1sPqHNoSu7hkdZgtm6uQc6mYfm-dvt__u/view' }
          ] },
        { id: 'entrevista-neuropsicologica-infantil', title: 'Entrevista neuropsicológica infantil', description: 'Cómo realizar la entrevista en la evaluación neuropsicológica infantil.', cover: 'images/cursos/grabados/entrevista-neuropsicologica-infantil.webp', driveUrl: 'https://drive.google.com/file/d/1NsLijinq_IPLb7IlYPVUJqPr1W3G0g46/view',
          materiales: [
            { titulo: 'Entrevista neuropsicológica', tipo: 'PDF', url: 'https://drive.google.com/file/d/1hTpZsd5W16ANGkIsf4_S8lT8mfHySQTA/view' },
            { titulo: 'Entrevista de conducta en niños y adolescentes', tipo: 'PDF', url: 'https://drive.google.com/file/d/1-r1FnsN5ptR0QxnshtZoX-8orTXSKkBB/view' }
          ] },
        { id: 'ansiedad-depresion', title: 'Diagnóstico en la ansiedad y depresión', description: 'Criterios y herramientas para el diagnóstico de ansiedad y depresión.', cover: 'images/cursos/grabados/ansiedad-depresion.webp', driveUrl: 'https://drive.google.com/file/d/1KMoBK8mC_3cjjRsrnEnS_cuUmc9jVzHw/view',
          materiales: [
            { titulo: 'Prueba de depresión de Beck (BDI-II)', tipo: 'PDF', url: 'https://drive.google.com/file/d/1HDHjp9hKbBp6WVQiJ8F1OFMpf9pXmWAO/view' }
          ] },
        { id: 'rabietas-berrinches', title: 'Intervención en rabietas y berrinches (TEA y TDAH)', description: 'Estrategias para manejar rabietas y berrinches en niños con TEA y TDAH.', cover: 'images/cursos/grabados/rabietas-berrinches.webp', driveUrl: '', materiales: [] },
        { id: 'entrevista-padres-tea', title: 'Entrevista a padres para indagar sobre el TEA', description: 'Preguntas clave para entrevistar a madres y padres ante la sospecha de autismo.', cover: 'images/cursos/grabados/entrevista-padres-tea.webp', driveUrl: 'https://drive.google.com/file/d/19Afam7X6LIpQEbDxUzN6DsfZM9xksx3d/view',
          materiales: [
            { titulo: 'Pasos para una entrevista con padres sobre el TEA', tipo: 'PDF', url: 'https://drive.google.com/file/d/1M-3bCMaphEwrjzlxMKRKorDfrkUSE2xN/view' }
          ] }
    ]
};
