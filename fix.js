const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KJA - Centro de Atención Psicológica Integral</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="shared.css">
</head>
<body>

    <header>
        <nav>
            <div class="logo-container">
                <h1>KJA</h1>
                <span>CENTRO DE<br>ATENCIÓN<br>PSICOLÓGICA<br>INTEGRAL</span>
            </div>
            <ul class="nav-links" id="nav-menu">
                <li><a href="index.html" class="active">Inicio</a></li>
                <li><a href="terapia.html">Terapia</a></li>
                <li><a href="cursos.html">Cursos</a></li>
                <li><a href="nosotros.html">Nosotros</a></li>
                <li><a href="#ubicanos">Ubícanos</a></li>
            </ul>
            <div class="hamburger" id="hamburger" onclick="toggleMenu()">
                <span></span><span></span><span></span>
            </div>
        </nav>
    </header>

    <!-- ===== HERO CAROUSEL ===== -->
    <section id="inicio" class="hero-carousel" aria-label="Carrusel principal KJA">

        <!-- SLIDE BACKGROUNDS (separados para Ken Burns) -->
        <div class="carousel-bg-track" id="carouselBgTrack">
            <div class="carousel-bg active" style="background-image: url('https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1400&q=80')"></div>
            <div class="carousel-bg" style="background-image: url('https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1400&q=80')"></div>
            <div class="carousel-bg" style="background-image: url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1400&q=80')"></div>
            <div class="carousel-bg" style="background-image: url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80')"></div>
        </div>

        <!-- OVERLAY CINEMATOGRÁFICO -->
        <div class="carousel-overlay"></div>

        <!-- CONTENIDO DE SLIDES -->
        <div class="carousel-track" id="carouselTrack">

            <div class="carousel-slide active" data-index="0">
                <div class="carousel-content">
                    <span class="carousel-eyebrow">Centro Psicológico KJA</span>
                    <h2 class="carousel-title">Descúbrete<br><em>y crece sin</em><br>límites.</h2>
                    <p class="carousel-desc">Tu bienestar emocional es nuestra prioridad. Terapias personalizadas para toda la familia.</p>
                    <div class="carousel-actions">
                        <a href="terapia.html" class="hero-cta">Agenda tu cita</a>
                        <a href="#terapia" class="carousel-link">Nuestros servicios →</a>
                    </div>
                </div>
            </div>

            <div class="carousel-slide" data-index="1">
                <div class="carousel-content">
                    <span class="carousel-eyebrow">Terapia Familiar</span>
                    <h2 class="carousel-title">Juntos somos<br><em>más</em><br>fuertes.</h2>
                    <p class="carousel-desc">Fortalecemos los vínculos familiares y abrimos canales de comunicación saludables para todos.</p>
                    <div class="carousel-actions">
                        <a href="terapia.html" class="hero-cta">Ver terapias</a>
                        <a href="nosotros.html" class="carousel-link">Sobre KJA →</a>
                    </div>
                </div>
            </div>

            <div class="carousel-slide" data-index="2">
                <div class="carousel-content">
                    <span class="carousel-eyebrow">Jóvenes y Adolescentes</span>
                    <h2 class="carousel-title">Cada etapa<br><em>merece</em><br>apoyo.</h2>
                    <p class="carousel-desc">Acompañamos a los adolescentes en su búsqueda de identidad y bienestar emocional.</p>
                    <div class="carousel-actions">
                        <a href="terapia.html" class="hero-cta">Conoce más</a>
                        <a href="terapia.html" class="carousel-link">Ver todas las terapias →</a>
                    </div>
                </div>
            </div>

            <div class="carousel-slide" data-index="3">
                <div class="carousel-content">
                    <span class="carousel-eyebrow">Capacitación y Talleres</span>
                    <h2 class="carousel-title">Aprende, crece<br><em>y</em><br>transforma.</h2>
                    <p class="carousel-desc">Cursos y talleres especializados en salud mental y desarrollo humano para profesionales.</p>
                    <div class="carousel-actions">
                        <a href="cursos.html" class="hero-cta">Ver cursos</a>
                        <a href="nosotros.html" class="carousel-link">Sobre nosotros →</a>
                    </div>
                </div>
            </div>

        </div><!-- /carousel-track -->

        <!-- HUD INFERIOR: contador + progress bars + flechas -->
        <div class="carousel-hud">

            <!-- Contador elegante -->
            <div class="carousel-counter">
                <span class="counter-current" id="counterCurrent">01</span>
                <span class="counter-sep"></span>
                <span class="counter-total">04</span>
            </div>

            <!-- Barras de progreso (reemplazan los dots) -->
            <div class="carousel-progress-bars" id="carouselDots" role="tablist">
                <button class="carousel-bar active" data-index="0" aria-label="Slide 1" role="tab" aria-selected="true">
                    <span class="bar-fill" id="barFill0"></span>
                </button>
                <button class="carousel-bar" data-index="1" aria-label="Slide 2" role="tab" aria-selected="false">
                    <span class="bar-fill" id="barFill1"></span>
                </button>
                <button class="carousel-bar" data-index="2" aria-label="Slide 3" role="tab" aria-selected="false">
                    <span class="bar-fill" id="barFill2"></span>
                </button>
                <button class="carousel-bar" data-index="3" aria-label="Slide 4" role="tab" aria-selected="false">
                    <span class="bar-fill" id="barFill3"></span>
                </button>
            </div>

            <!-- Flechas dentro del HUD -->
            <div class="carousel-hud-arrows">
                <button class="carousel-arrow carousel-arrow--prev" id="prevBtn" aria-label="Slide anterior">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button class="carousel-arrow carousel-arrow--next" id="nextBtn" aria-label="Slide siguiente">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>

        </div><!-- /carousel-hud -->

        <!-- Scroll hint -->
        <div class="scroll-hint" aria-hidden="true">
            <span>Scroll</span>
            <div class="scroll-hint-line"></div>
        </div>

    </section><!-- /hero-carousel -->

    <!-- ===== PROMO BANNER ===== -->
    <div class="promo-banner">
        20% DE DESCUENTO
        <span>EN TU PRIMERA SESIÓN</span>
    </div>

    <!-- ===== ¿POR QUÉ ELEGIR KJA? — MARKETING STRIP ===== -->
    <section class="why-kja-strip" id="por-que-kja">
        <div class="container">
            <div class="why-strip-header">
                <p class="why-strip-eyebrow">¿Por qué elegirnos?</p>
                <h2 class="why-strip-title">La diferencia <em>KJA</em></h2>
                <p class="why-strip-sub">Más de 5 años acompañando familias, niños, jóvenes y adultos hacia su bienestar emocional.</p>
            </div>
            <div class="why-strip-grid">
                <div class="why-card">
                    <div class="why-card-icon">🎓</div>
                    <h3>Terapeutas Certificados</h3>
                    <p>Equipo de psicólogos colegiados con especialización en diversas corrientes terapéuticas validadas.</p>
                </div>
                <div class="why-card">
                    <div class="why-card-icon">🎯</div>
                    <h3>Enfoque Personalizado</h3>
                    <p>Cada plan terapéutico es único. Diseñado exclusivamente para ti, tus necesidades y tus metas.</p>
                </div>
                <div class="why-card">
                    <div class="why-card-icon">🔒</div>
                    <h3>Espacio 100% Confidencial</h3>
                    <p>Privacidad y ética profesional garantizadas en cada sesión, presencial o en línea.</p>
                </div>
                <div class="why-card">
                    <div class="why-card-icon">💻</div>
                    <h3>Atención Presencial y Online</h3>
                    <p>Agenda desde la comodidad de tu hogar o visítanos en San Luis, Lima. Tú eliges.</p>
                </div>
                <div class="why-card">
                    <div class="why-card-icon">👨‍👩‍👧</div>
                    <h3>Para Toda la Familia</h3>
                    <p>Niños, adolescentes, adultos y parejas. Atendemos a todos los miembros del hogar.</p>
                </div>
                <div class="why-card">
                    <div class="why-card-icon">⭐</div>
                    <h3>Resultados Comprobados</h3>
                    <p>Cientos de pacientes han transformado su bienestar emocional con nuestra metodología.</p>
                </div>
            </div>
            <div class="why-strip-cta">
                <a href="terapia.html" class="hero-cta">Empieza hoy tu proceso</a>
            </div>
        </div>
    </section>

    <!-- ===== SERVICIOS ===== -->
    <section id="terapia" class="container section-padding">

        <div class="service-row">
            <div class="service-text">
                <h3>TERAPIAS PSICOLÓGICAS</h3>
                <p>Es un proceso personal y especializado donde el consultante, junto con el terapeuta especializado, forma una mirada distinta de su malestar emocional mediante estrategias de intervención diseñadas para mejorar su calidad de vida.</p>
            </div>
            <div class="service-image">
                <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80" alt="Terapia Psicológica" />
            </div>
        </div>

        <div class="service-row">
            <div class="service-text">
                <h3>TERAPIAS PARA NIÑOS</h3>
                <p>La terapia infantil es un espacio seguro donde los niños aprenden a identificar y gestionar sus emociones a través del juego. Trabajamos junto a la familia para resolver dificultades de conducta, miedos o ansiedad, brindándoles herramientas para crecer felices y seguros.</p>
                <a href="terapia.html#ninos" class="btn btn-outline-pink">Ver mas...</a>
            </div>
            <div class="service-image">
                <img src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80" alt="Terapia para Niños" />
            </div>
        </div>

        <div class="service-row">
            <div class="service-text">
                <h3>TERAPIAS PARA ADOLESCENTES</h3>
                <p>La adolescencia es una etapa de transición, búsqueda de identidad y emociones intensas. Ofrecemos un espacio confidencial y libre de juicios donde el adolescente puede expresarse abiertamente.</p>
                <a href="terapia.html#adolescentes" class="btn btn-outline-pink">Ver mas...</a>
            </div>
            <div class="service-image">
                <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80" alt="Terapia para Adolescentes" />
            </div>
        </div>

        <div class="service-row">
            <div class="service-text">
                <h3>TERAPIAS PARA ADULTOS</h3>
                <p>La vida adulta conlleva múltiples responsabilidades que a veces pueden desbordarnos. Ofrecemos un espacio de pausa y reflexión para trabajar sobre el estrés, la ansiedad y el agotamiento.</p>
                <a href="terapia.html#adultos" class="btn btn-outline-pink">Ver mas...</a>
            </div>
            <div class="service-image">
                <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&q=80" alt="Terapia para Adultos" />
            </div>
        </div>

        <div class="service-row">
            <div class="service-text">
                <h3>TERAPIAS DE PAREJA</h3>
                <p>Las relaciones pasan por etapas difíciles donde la comunicación parece romperse. La terapia de pareja ofrece un espacio neutral y seguro para que ambos puedan expresarse y reconstruir vínculos.</p>
                <a href="terapia.html#adultos" class="btn btn-outline-pink">Ver mas...</a>
            </div>
            <div class="service-image">
                <img src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80" alt="Terapia de Pareja" />
            </div>
        </div>

        <div class="service-row">
            <div class="service-text">
                <h3>TERAPIAS DE FAMILIA</h3>
                <p>La familia es nuestro primer equipo, pero a veces la convivencia se vuelve difícil. Creamos un espacio seguro para que todos los miembros puedan escucharse y entenderse mejor.</p>
                <a href="terapia.html#familia" class="btn btn-outline-pink">Ver mas...</a>
            </div>
            <div class="service-image">
                <img src="https://images.unsplash.com/photo-1609220136736-443140cffec6?w=600&q=80" alt="Terapia de Familia" />
            </div>
        </div>
    </section>

    <!-- CURSOS -->
    <section class="container section-padding" id="cursos">
        <div class="capacitacion-banner">
            <h2>BRINDAMOS:</h2>
            <p>KJA - Centro de Capacitación y Formación Psicológica</p>
            <div class="capacitacion-grid">
                <div class="cap-tag">CURSOS</div>
                <div class="cap-tag">ASESORÍAS</div>
                <div class="cap-tag">TALLERES</div>
                <div class="cap-tag">ESPECIALIZACIONES</div>
                <div class="cap-tag">CHARLAS</div>
                <div class="cap-tag">CONFERENCIAS</div>
            </div>
        </div>
    </section>

    <!-- ===== FAQ PREMIUM ===== -->
    <section class="faq-premium-section" id="faq">
        <div class="container">
            <div class="faq-premium-header">
                <p class="faq-eyebrow">¿Tienes dudas?</p>
                <h2>Preguntas <em>Frecuentes</em></h2>
                <p class="faq-sub">Resolvemos las dudas más comunes. Si no encuentras tu respuesta, escríbenos.</p>
            </div>
            <div class="faq-premium-grid">

                <div class="faq-premium-item" id="faqItem0">
                    <button class="faq-premium-btn" onclick="toggleFaqPremium(0)" aria-expanded="false">
                        <span class="faq-premium-num">01</span>
                        <span class="faq-premium-q">¿Cómo es la primera sesión?</span>
                        <span class="faq-premium-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </button>
                    <div class="faq-premium-answer">
                        <p>La primera sesión, también llamada sesión de consulta psicológica, tiene una duración de 45 minutos y está enfocada en conocerte, entender tu situación actual y definir los objetivos del proceso terapéutico.</p>
                    </div>
                </div>

                <div class="faq-premium-item" id="faqItem1">
                    <button class="faq-premium-btn" onclick="toggleFaqPremium(1)" aria-expanded="false">
                        <span class="faq-premium-num">02</span>
                        <span class="faq-premium-q">¿Cómo agendo mi cita?</span>
                        <span class="faq-premium-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </button>
                    <div class="faq-premium-answer">
                        <p>Agendar tu sesión es muy sencillo. Puedes contactarnos directamente por WhatsApp al <strong>+51 988 918 238</strong> o escribirnos a nuestro correo y te asignaremos un horario disponible.</p>
                    </div>
                </div>

                <div class="faq-premium-item" id="faqItem2">
                    <button class="faq-premium-btn" onclick="toggleFaqPremium(2)" aria-expanded="false">
                        <span class="faq-premium-num">03</span>
                        <span class="faq-premium-q">¿Tengo que entrar yo o solo mi hijo?</span>
                        <span class="faq-premium-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </button>
                    <div class="faq-premium-answer">
                        <p>Depende del tipo de terapia. Para terapia infantil, generalmente los padres participan en las primeras sesiones y en sesiones de seguimiento. Para terapia individual, el consultante asiste solo. Te orientaremos según tu caso.</p>
                    </div>
                </div>

                <div class="faq-premium-item" id="faqItem3">
                    <button class="faq-premium-btn" onclick="toggleFaqPremium(3)" aria-expanded="false">
                        <span class="faq-premium-num">04</span>
                        <span class="faq-premium-q">¿Qué precios manejan?</span>
                        <span class="faq-premium-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </button>
                    <div class="faq-premium-answer">
                        <p>Manejamos diferentes precios según modalidad y tipo de terapia. Contáctanos para recibir información personalizada sobre nuestras tarifas y <strong>promociones vigentes</strong>.</p>
                    </div>
                </div>

                <div class="faq-premium-item" id="faqItem4">
                    <button class="faq-premium-btn" onclick="toggleFaqPremium(4)" aria-expanded="false">
                        <span class="faq-premium-num">05</span>
                        <span class="faq-premium-q">¿Ofrecen sesiones en línea?</span>
                        <span class="faq-premium-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </button>
                    <div class="faq-premium-answer">
                        <p>Sí. Ofrecemos sesiones 100% online a través de videollamada para que puedas acceder a tu terapia desde cualquier lugar del mundo, con la misma calidad y privacidad que las sesiones presenciales.</p>
                    </div>
                </div>

            </div>

            <div class="faq-premium-contact">
                <p>¿Tienes otra pregunta?</p>
                <a href="https://wa.me/51988918238" target="_blank" class="hero-cta">Escríbenos al WhatsApp</a>
            </div>
        </div>
    </section>

    <!-- NOSOTROS -->
    <section id="nosotros" class="container about-section text-center">
        <h2 class="about-main-title">SOBRE KJA</h2>
        <div class="about-grid" style="display: block; max-width: 800px; margin: 0 auto;">
            <p style="font-size: 1.1rem; color: #555; margin-bottom: 30px;">KJA Desarrollando mi Bienestar S.A.C. es un centro psicológico en San Luis, Lima, Perú, fundado el 13 de octubre de 2020. Se especializa en el bienestar mental de niños, adolescentes y adultos, ofreciendo terapias presenciales y en línea, además de talleres de desarrollo humano y capacitación empresarial.</p>
            <a href="nosotros.html" class="btn btn-pink">Conoce más sobre nosotros</a>
        </div>
    </section>

    <!-- ===== UBÍCANOS PREMIUM ===== -->
    <section id="ubicanos" class="ubicanos-section">
        <div class="ubicanos-premium-inner container">

            <!-- Info card -->
            <div class="ubicanos-info-card">
                <p class="ubicanos-eyebrow">📍 Encuéntranos</p>
                <h2>Estamos<br><em>cerca de ti</em></h2>

                <div class="ubicanos-contact-list">
                    <a href="https://maps.google.com/?q=Jr.+Río+Amazonas+214,+San+Luis,+Lima" target="_blank" class="ubicanos-contact-item">
                        <div class="ubicanos-icon-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <div>
                            <span class="ubicanos-label">Dirección</span>
                            <span class="ubicanos-value">Jr. Río Amazonas 214, San Luis, Lima, Perú</span>
                        </div>
                    </a>
                    <a href="tel:+51988918238" class="ubicanos-contact-item">
                        <div class="ubicanos-icon-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </div>
                        <div>
                            <span class="ubicanos-label">Teléfono / WhatsApp</span>
                            <span class="ubicanos-value">+51 988 918 238</span>
                        </div>
                    </a>
                    <a href="mailto:kjabienestar@escuelakja.net" class="ubicanos-contact-item">
                        <div class="ubicanos-icon-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </div>
                        <div>
                            <span class="ubicanos-label">Correo</span>
                            <span class="ubicanos-value">kjabienestar@escuelakja.net</span>
                        </div>
                    </a>
                </div>

                <div class="ubicanos-schedule">
                    <div class="schedule-icon">🕒</div>
                    <div>
                        <strong>Horario de atención</strong>
                        <p>Lun – Vie: 9:00 am – 7:00 pm</p>
                        <p>Sáb: 9:00 am – 1:00 pm</p>
                    </div>
                </div>

                <a href="https://wa.me/51988918238" target="_blank" class="hero-cta ubicanos-wa-btn">
                    Agenda tu cita por WhatsApp
                </a>
            </div>

            <!-- Mapa -->
            <div class="ubicanos-map-modern">
                <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.589773826282!2d-76.9942!3d-12.0632!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105c7b7f6d76fed%3A0x4b3a6a0d6a0d6a0d!2sSan%20Luis%2C%20Lima!5e0!3m2!1ses!2spe!4v1700000000000"
                    allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade">
                </iframe>
            </div>

        </div>
    </section>

    <footer>
        <div class="footer-content">
            <div class="footer-logo">
                <h2>KJA</h2>
                <span>CENTRO DE ATENCIÓN PSICOLÓGICA INTEGRAL</span>
            </div>
            <div class="footer-info">
                <p><strong>SÍGUENOS EN NUESTRAS REDES SOCIALES</strong></p>
                <div class="social-icons">
                    <a href="#" title="TikTok">TT</a>
                    <a href="#" title="Facebook" class="fb">FB</a>
                    <a href="#" title="Instagram">IG</a>
                </div>
            </div>
            <div class="footer-info">
                <p>📍 Jr. Río Amazonas 214, San Luis,<br>Lima, Perú</p>
                <p>📞 +51 988 918 238</p>
            </div>
        </div>
        <div class="copyright">
            &copy; 2026 KJA Desarrollando mi Bienestar S.A.C. Todos los derechos reservados.
        </div>
    </footer>

    <a href="https://wa.me/51988918238" class="whatsapp-float" target="_blank" title="WhatsApp">W</a>

    <script src="script.js"></script>
    <script>
        function toggleFaqPremium(index) {
            const items = document.querySelectorAll('.faq-premium-item');
            const btn   = items[index].querySelector('.faq-premium-btn');
            const isOpen = items[index].classList.contains('open');

            // Cerrar todos
            items.forEach(item => {
                item.classList.remove('open');
                item.querySelector('.faq-premium-btn').setAttribute('aria-expanded', 'false');
            });

            // Abrir el clickeado si no estaba abierto
            if (!isOpen) {
                items[index].classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
        }
    </script>
</body>
</html>`;

fs.writeFileSync('index.html', html, 'utf8');
