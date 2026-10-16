(function () {
  'use strict';
  var SB = 'https://xadxmfgdxwplmhijagix.supabase.co';
  var HDR = { apikey: 'sb_publishable_0j8mktN5G8BXS9r8tl9ETw_-GSBMkub', 'Content-Type': 'application/json' };
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var key = params.get('k') || '';
  var LABELS = { terapia: 'Terapia', curso: 'Curso', taller: 'Taller' };
  var servicio = LABELS[(params.get('s') || '').toLowerCase()] ? (params.get('s') || '').toLowerCase() : '';
  var PUBLICO = !key;            // sin ?k= → enlace general (servicio opcional; ?s= lo preselecciona)
  var t0 = Date.now();
  var estrellas = 0, recomienda = null;
  var TXT = ['', 'Muy malo', 'Podría mejorar', 'Bien', 'Muy bueno', 'Excelente'];
  var form = $('op-form');

  function rpc(fn, body) {
    return fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: HDR, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); });
  }
  function estado(titulo, texto) {
    var e = $('op-estado');
    e.innerHTML = '';
    var s = document.createElement('strong'); s.textContent = titulo;
    e.appendChild(s); e.appendChild(document.createTextNode(texto));
    e.hidden = false; form.hidden = true;
  }
  function aviso(t) { var m = $('op-msg'); m.textContent = t; m.className = 'op-msg' + (t ? ' error' : ''); }

  /* ── Vista previa en vivo (panel lateral) ── */
  function iniciales(n) { return n.trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || 'KJ'; }
  function preview() {
    var n = $('op-nombre').value.trim(), t = $('op-texto').value.trim();
    $('op-p-name').textContent = n || 'Tu nombre';
    $('op-p-av').textContent = iniciales(n);
    $('op-p-stars').textContent = '★★★★★'.slice(0, estrellas) + '☆☆☆☆☆'.slice(estrellas);
    $('op-p-text').textContent = '“' + (t || 'Tu comentario aparecerá aquí…') + '”';
    // Etiqueta "en qué participó": la elegida en el selector, o la del enlace único.
    var tag = PUBLICO ? (LABELS[servicio] || '') : ($('op-serv').hidden ? '' : $('op-serv').textContent);
    if (tag !== 'Curso' && tag !== 'Taller') tag = '';
    $('op-p-tag').textContent = tag; $('op-p-tag').hidden = !tag;
  }

  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  var starsBox = $('op-stars');
  for (var i = 1; i <= 5; i++) (function (n) {
    var b = document.createElement('button');
    b.type = 'button'; b.innerHTML = STAR; b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', n + (n === 1 ? ' estrella' : ' estrellas')); b.setAttribute('aria-checked', 'false');
    b.addEventListener('click', function () { estrellas = n; pintarEstrellas(); preview(); });
    starsBox.appendChild(b);
  })(i);
  function pintarEstrellas() {
    Array.prototype.forEach.call(starsBox.children, function (b, idx) {
      b.classList.toggle('on', idx < estrellas); b.setAttribute('aria-checked', String(idx + 1 === estrellas));
    });
    $('op-star-txt').textContent = TXT[estrellas] || '';
  }
  var npsBox = $('op-nps');
  for (var j = 0; j <= 10; j++) (function (n) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = n; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    b.addEventListener('click', function () {
      recomienda = n;
      Array.prototype.forEach.call(npsBox.children, function (x, k) { x.classList.toggle('on', k === n); x.setAttribute('aria-checked', String(k === n)); });
    });
    npsBox.appendChild(b);
  })(j);
  $('op-texto').addEventListener('input', function () { $('op-cnt').textContent = this.value.length; preview(); });
  $('op-nombre').addEventListener('input', preview);

  /* ── Pasos (solo móvil y tableta; en escritorio se ve todo junto) ── */
  function paso(n) {
    form.dataset.step = n;
    var dots = form.querySelectorAll('.op-steps i');
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k < n);
    aviso('');
  }
  function validar1() {
    if ($('op-nombre').value.trim().length < 2) return aviso('Escribe tu nombre.'), false;
    if (!estrellas) return aviso('Elige una calificación de 1 a 5 estrellas.'), false;
    if ($('op-texto').value.trim().length < 10) return aviso('Cuéntanos un poco más (mínimo 10 caracteres).'), false;
    aviso(''); return true;
  }
  $('op-next').addEventListener('click', function () { if (validar1()) paso(2); });
  $('op-back').addEventListener('click', function () { paso(1); });

  // El título se adapta a lo que elija el cliente; sin elección queda general.
  var TITULOS = { '': ['¿Qué te pareció ', 'el curso o taller'], curso: ['¿Qué te pareció ', 'el curso'],
    taller: ['¿Qué te pareció ', 'el taller'], terapia: ['¿Cómo fue ', 'tu terapia'] };
  function titulo() {
    var t = TITULOS[servicio] || TITULOS[''], h = $('op-titulo');
    h.textContent = t[0]; var em = document.createElement('em'); em.textContent = t[1];
    h.appendChild(em); h.appendChild(document.createTextNode('?'));
  }
  function elegirServicio(s) {
    servicio = servicio === s ? '' : s;   // opcional: un segundo clic lo desmarca
    Array.prototype.forEach.call($('op-svc').querySelectorAll('button'), function (b) {
      var on = b.dataset.s === servicio; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    });
    titulo(); preview();
  }
  Array.prototype.forEach.call($('op-svc').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () { elegirServicio(b.dataset.s); });
  });

  if (PUBLICO) {
    $('op-estado').hidden = true; form.hidden = false;
    $('op-svc').hidden = false;
    if (servicio) { var pre = servicio; servicio = ''; elegirServicio(pre); }
    preview();
  } else if (!/^[A-Za-z0-9_-]{16}$/.test(key)) {
    estado('Enlace no válido', 'Solicita a KJA un enlace actualizado para dejar tu opinión.');
  } else {
    rpc('opinion_resolver', { p_clave: key }).then(function (r) {
      if (r.estado === 'ok') {
        $('op-estado').hidden = true; form.hidden = false;
        if (r.cliente) $('op-nombre').value = r.cliente;
        if (r.servicio) { $('op-serv').textContent = r.servicio; $('op-serv').hidden = false; }
        preview();
      } else if (r.estado === 'usado') estado('Este enlace ya fue utilizado', 'Gracias por tu opinión, ya la recibimos.');
      else if (r.estado === 'expirado') estado('Este enlace venció', 'Solicita a KJA un enlace nuevo para dejar tu opinión.');
      else estado('Enlace no válido', 'Solicita a KJA un enlace actualizado para dejar tu opinión.');
    }).catch(function () { estado('No pudimos verificar tu enlace', 'Revisa tu conexión e inténtalo nuevamente.'); });
  }

  function exito() { form.hidden = true; $('op-exito').hidden = false; }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if ($('op-web').value) { exito(); return; } // honeypot
    if (!validar1()) { paso(1); return; }
    var nombre = $('op-nombre').value.trim(), texto = $('op-texto').value.trim();
    aviso('');
    var btn = $('op-enviar'); btn.disabled = true; btn.classList.add('sending'); $('op-enviar-txt').textContent = 'Enviando…';
    var base = { p_nombre: nombre, p_mensaje: texto, p_estrellas: estrellas, p_recomienda: recomienda, p_nota: $('op-nota').value.trim() || null };
    var envio = PUBLICO
      ? rpc('opinion_enviar_publico', Object.assign({ p_servicio: servicio, p_tiempo_ms: Date.now() - t0 }, base))
      : rpc('opinion_enviar', Object.assign({ p_clave: key }, base));
    envio.then(function (r) {
      if (r && r.ok) return exito();
      var m = { usado: 'Este enlace ya fue utilizado.', expirado: 'Este enlace venció.', invalido: 'Enlace no válido.', datos: 'Revisa los datos e inténtalo de nuevo.',
        limite: 'Ya recibimos varias opiniones desde esta red. Inténtalo de nuevo más tarde.', rapido: 'Revisa tu opinión un momento y vuelve a enviar.',
        duplicado: 'Ya recibimos una opinión con ese mismo texto.' };
      throw new Error(m[r && r.error] || 'No se pudo enviar.');
    }).catch(function (e) {
      aviso(e.message === 'http' ? 'No se pudo enviar. Inténtalo nuevamente.' : e.message);
      btn.disabled = false; btn.classList.remove('sending'); $('op-enviar-txt').textContent = 'Enviar mi opinión';
    });
  });
})();
