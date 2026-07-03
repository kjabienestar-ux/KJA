$files = Get-ChildItem -Filter *.html | Where-Object { $_.Name -ne 'index.html' }
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, $utf8NoBom)

    $pattern = '(?s)<nav class="nav-desktop-only">.*?</nav>'
    
    $nav = @"
        <nav class="nav-desktop-only">
            <!-- Left: Logo -->
            <div class="nav-left logo-container">
                <a href="index.html">
                    <img src="images/logo/kja.webp" alt="KJA Logo" class="logo-img">
                </a>
            </div>
            
            <!-- Center: Links -->
            <ul class="nav-center nav-links-center">
                <li><a href="index.html">Inicio</a></li>
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
        </nav>
"@

    if ($file.Name -eq 'terapia.html') { $nav = $nav -replace '__ACTIVE_TERAPIA__', 'active' }
    if ($file.Name -eq 'cursos.html') { $nav = $nav -replace '__ACTIVE_CURSOS__', 'active' }
    if ($file.Name -eq 'certificado.html') { $nav = $nav -replace '__ACTIVE_CERTIFICADO__', 'active' }
    if ($file.Name -eq 'nosotros.html') { $nav = $nav -replace '__ACTIVE_NOSOTROS__', 'active' }
    
    $nav = $nav -replace ' class="__ACTIVE_[A-Z]+__"', ''
    
    if ($content -match $pattern) {
        $content = $content -replace $pattern, $nav
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Host "Updated $($file.Name)"
    }
}
