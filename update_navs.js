const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.html') && f !== 'index.html');

const newNavTemplate = `        <nav class="nav-desktop-only">
            <!-- Left: Logo -->
            <div class="nav-left logo-container">
                <a href="index.html">
                    <img src="images/logo/kja.webp" alt="KJA Logo" class="logo-img">
                </a>
            </div>
            
            <!-- Center: Links -->
            <ul class="nav-center nav-links-center">
                <li><a href="index.html" class="__ACTIVE_INDEX__">Inicio</a></li>
                <li><a href="terapia.html" class="__ACTIVE_TERAPIA__">Terapia</a></li>
                <li><a href="cursos.html" class="__ACTIVE_CURSOS__">Cursos</a></li>
                <li><a href="certificado.html" class="__ACTIVE_CERTIFICADO__">Certificados</a></li>
                <li><a href="nosotros.html" class="__ACTIVE_NOSOTROS__">Nosotros</a></li>
                <li><a href="index.html#ubicanos">Ubícanos</a></li>
            </ul>
            
            <!-- Right: Button -->
            <div class="nav-right">
                <a href="terapia.html" class="nav-cta-btn">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    Agendar cita
                </a>
            </div>
        </nav>`;

files.forEach(file => {
    let content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const pattern = /<nav class="nav-desktop-only">[\s\S]*?<\/nav>/;
    
    let nav = newNavTemplate;
    if (file === 'terapia.html') nav = nav.replace('__ACTIVE_TERAPIA__', 'active');
    if (file === 'cursos.html') nav = nav.replace('__ACTIVE_CURSOS__', 'active');
    if (file === 'certificado.html') nav = nav.replace('__ACTIVE_CERTIFICADO__', 'active');
    if (file === 'nosotros.html') nav = nav.replace('__ACTIVE_NOSOTROS__', 'active');
    
    // clean up unused placeholders
    nav = nav.replace(/ class="__ACTIVE_[A-Z]+__"/g, '');

    if (pattern.test(content)) {
        content = content.replace(pattern, nav);
        fs.writeFileSync(path.join(__dirname, file), content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
