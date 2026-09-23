/* Áreas de cursos y talleres. Contenido proporcionado por KJA. */
const COURSE_DATA = {
    'tea-autismo': {
        title: 'TEA / Autismo',
        image: 'images/cursos/news/tea-autismo.webp',
        description: 'Cursos y talleres sobre ADOS-2 y ADI-R, informes psicopedagógicos en autismo, terapia de lenguaje en niños con TEA y dificultades en sesiones ocupacionales y psicoeducación para padres.',
        learn: [
            'Dificultades en sesión ocupacional y psicoeducación en padres con dificultades en TEA',
            'Cómo elaborar un informe psicopedagógico en autismo',
            'Test de ADI-R en niños con autismo',
            'Test de ADOS-2',
            'Cómo elaborar un cuaderno de terapia de lenguaje en niños con TEA'
        ]
    },
    'terapia-ocupacional-integracion-sensorial': {
        title: 'Terapia Ocupacional e Integración Sensorial',
        image: 'images/cursos/news/terapia-ocupacional-integracion-sensorial.webp',
        description: 'Cursos y talleres sobre intervención en terapia ocupacional, integración sensorial y estimulación temprana en niños neurodivergentes. Incluye elaboración de sesiones y cuadernos de trabajo e intervención con enfoque ABA.',
        learn: [
            'Programa de intervención de terapia ocupacional',
            'Elaboración de sesiones para estimulación e integración sensorial en niños de 2 años',
            'Pasos para abordar una terapia de integración sensorial en niños neurodivergentes',
            'Intervención en la terapia ocupacional e integración sensorial con el enfoque ABA',
            'Elaboración de sesiones de estimulación temprana en niños neurodivergentes',
            'Cómo elaborar un cuaderno de terapia de estimulación temprana e integración sensorial'
        ]
    },
    'terapia-lenguaje': {
        title: 'Terapia de Lenguaje',
        image: 'images/cursos/news/terapia-lenguaje.webp',
        description: 'Cursos y talleres sobre sesiones y cuadernos de estimulación del lenguaje, intervención mediante el juego y terapia de lenguaje y conductual. Incluye sesiones para niños de 3 a 6 años con dificultades en el lenguaje.',
        learn: [
            'Trastorno de Terapia de Lenguaje',
            'Cómo elaborar sesiones de un cuaderno de estimulación de lenguaje',
            'Taller de intervención en la terapia de lenguaje mediante la terapia del juego',
            'Elaboración de sesiones en la terapia de lenguaje en niños de 3 a 6 años con dificultades en el lenguaje',
            'Cómo elaborar un cuaderno de terapia de lenguaje y conductual'
        ]
    },
    'psicoterapia-tcc': {
        title: 'Psicoterapia y Terapia Cognitivo-Conductual',
        image: 'images/cursos/news/psicoterapia-tcc.webp',
        description: 'Cursos y talleres sobre psicoterapia en niños, adolescentes y adultos, TCC integrativa y terapia de esquemas. Incluye sesiones y cuadernos de psicoterapia, técnicas lúdicas para el manejo emocional infantil e intervención conductual mediante el juego.',
        learn: [
            'Psicología clínica y salud mental en adolescentes enfocado en TCC',
            'Elaboración de sesiones de psicoterapia en niños y adolescentes',
            'Psicoterapia cognitivo-conductual integrativa (TCC integrativa)',
            'Terapia cognitivo-conductual y terapia de esquemas',
            'Técnicas lúdicas en TCC para el manejo emocional infantil',
            'Intervención terapéutica en TCC en niños y adolescentes',
            'Elaboración de un cuaderno de psicoterapia en niños y adolescentes',
            'Intervención en la terapia de esquemas en niños y adolescentes (TCC)',
            'Intervención en la terapia de juego en niños neurodiversos en el área conductual',
            'Técnicas psicoterapéuticas en adolescentes y adultos'
        ]
    },
    'neuropsicologia': {
        title: 'Neuropsicología',
        image: 'images/cursos/news/neuropsicologia.webp',
        description: 'Cursos y talleres sobre casos conductuales en niños neurodivergentes y elaboración de informes clínicos y neuropsicológicos. Incluye WISC-V, test de Bender y test de Machover en el ámbito emocional.',
        learn: [
            'Cómo abordar casos conductuales en niños neurodivergentes en el área neuropsicológica',
            'Cómo elaborar un cuaderno de informe neuropsicológico en niños neurodiversos',
            'Cómo elaborar un informe clínico y neuropsicológico en niños neurodiversos',
            'El test de Bender',
            'WISC-V: innovaciones, alcances y desafíos del WISC-V',
            'Test de Machover en el ámbito emocional'
        ]
    },
    'adultos-mayores-psicooncologia': {
        title: 'Adultos Mayores y Psicooncología',
        image: 'images/cursos/news/adultos-mayores-psicooncologia.webp',
        description: 'Cursos y talleres sobre psicología clínica, salud mental y abordaje cognitivo en adultos mayores. Incluye psicooncología, programas de intervención en adultos mayores e intervención terapéutica en pacientes oncológicos.',
        learn: [
            'Psicología clínica y salud mental en adultos mayores',
            'Cómo abordar el área cognitiva en pacientes adultos mayores',
            'Programa de intervención de psicooncología en adultos mayores',
            'Psicooncología',
            'Intervención terapéutica en pacientes oncológicos'
        ]
    },
    'evaluacion-psicologica-clinica': {
        title: 'Evaluación Psicológica Clínica',
        image: 'images/cursos/news/evaluacion-psicologica-clinica.webp',
        description: 'Cursos y talleres sobre calificación, procesamiento de resultados y elaboración del informe psicológico, así como pruebas de ansiedad y depresión.',
        learn: [
            'Calificación de procesos de resultados e informe psicológico',
            'Pruebas de ansiedad y depresión'
        ]
    },
    'psicologia-organizacional': {
        title: 'Psicología Organizacional y Selección de Personal',
        image: 'images/cursos/news/psicologia-organizacional.webp',
        description: 'Cursos y talleres sobre entrevistas por competencias, perfiles de puesto, pruebas de selección de personal y elaboración de informes psicolaborales. Incluye bienestar psicológico del personal.',
        learn: [
            'Psicología organizacional, entrevista por competencias y perfiles de puesto',
            'Cómo elaborar un informe psicolaboral en selección de personal',
            'Prueba de selección del personal',
            'Pruebas de selección de personal',
            'Bienestar psicológico del personal'
        ]
    },
    'salud-ocupacional-bienestar': {
        title: 'Salud Ocupacional y Bienestar',
        image: 'images/cursos/news/salud-ocupacional-bienestar.webp',
        description: 'Cursos y talleres sobre pruebas psicológicas en salud ocupacional y bienestar psicológico en el ámbito de la salud.',
        learn: [
            'Pruebas psicológicas en salud ocupacional',
            'Bienestar psicológico en la salud',
            'Pruebas de salud ocupacional'
        ]
    }
};
