/* Selección local de reseñas públicas de Google Maps, extraída el 7 de octubre de 2026. */
(function () {
    const board = document.getElementById('nos-testimonials-board');
    const status = document.getElementById('nos-testimonials-status');
    const retry = document.getElementById('nos-testimonials-retry');
    let loaded = false, pending = false;
    const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';

    function card(t) {
        const article = document.createElement('article');
        article.className = 'nos-testimonial';
        const header = document.createElement('div');
        header.className = 'nos-testimonial-person';
        const avatar = document.createElement('span');
        avatar.className = 'nos-testimonial-avatar';
        avatar.innerHTML = USER_ICON;
        if (t.avatar) {
            const img = document.createElement('img');
            img.src = t.avatar; img.alt = ''; img.width = 64; img.height = 64; img.loading = 'lazy';
            img.addEventListener('error', () => img.remove());
            avatar.append(img);
        }
        const identity = document.createElement('div');
        const name = document.createElement('h3'); name.textContent = t.name;
        const source = document.createElement('span'); source.className = 'nos-testimonial-source';
        source.textContent = 'Reseña en Google Maps';
        identity.append(name, source); header.append(avatar, identity);
        const stars = document.createElement('div'); stars.className = 'nos-testimonial-stars';
        stars.setAttribute('aria-label', t.rating + ' de 5 estrellas');
        stars.textContent = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
        const quote = document.createElement('blockquote'); quote.textContent = t.text;
        const footer = document.createElement('div'); footer.className = 'nos-testimonial-footer';
        const mark = document.createElement('span'); mark.className = 'nos-testimonial-quote';
        mark.setAttribute('aria-hidden', 'true'); mark.textContent = '”';
        const link = document.createElement('a');
        link.className = 'nos-testimonial-google';
        link.href = t.profile; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = 'Google Maps ↗';
        link.setAttribute('aria-label', 'Ver reseñas de ' + t.name + ' en Google Maps');
        footer.append(mark, link); article.append(header, stars, quote, footer);
        return article;
    }
    function render(reviews) {
        // Prioriza las fotos disponibles, conservando el orden dentro de cada grupo.
        const selected = reviews.slice()
            .sort((a, b) => Number(Boolean(b.avatar)) - Number(Boolean(a.avatar)))
            .slice(0, 6);
        board.replaceChildren(...selected.map(card));
        return selected;
    }
    async function load() {
        if (loaded || pending) return;
        pending = true; board.setAttribute('aria-busy', 'true'); retry.hidden = true;
        status.textContent = 'Cargando opiniones de nuestra comunidad…';
        try {
            const response = await fetch('assets/data/google-reviews.json?v=1', {
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error('No se pudieron cargar las reseñas');
            const data = await response.json();
            if (!Array.isArray(data.reviews)) throw new Error('Formato de reseñas inválido');
            const reviews = data.reviews.filter(t => typeof t.name === 'string' && typeof t.text === 'string')
                .map(t => ({ ...t, rating: Math.min(5, Math.max(0, parseInt(t.rating, 10) || 0)) }));
            render(reviews); loaded = true;
            status.textContent = 'Experiencias compartidas por nuestra comunidad en Google Maps.';
        } catch (error) {
            status.textContent = 'No pudimos cargar las reseñas. Vuelve a intentarlo.';
            retry.hidden = false;
        } finally {
            pending = false; board.setAttribute('aria-busy', 'false');
        }
    }
    render([]);
    board.setAttribute('aria-busy', 'false');
    retry.addEventListener('click', load);
    window.KJATestimonios = { load };
    if (document.getElementById('about-testimonios').classList.contains('active')) load();
})();
