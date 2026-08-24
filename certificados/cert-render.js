/* ══════════════════════════════════════════════════════════════════════
   KJACert — motor compartido de dibujo de certificados (canvas WYSIWYG)
   Lo usan: certificados/generador-demo.html (admin) y certificado.html (público)

   API:
     KJACert.basePath   → prefijo para las imágenes de plantilla
                          ('' desde la carpeta certificados, 'certificados/' desde la raíz)
     KJACert.verifyBase → URL pública a la que apunta el QR
     KJACert.TIPOS      → configuración por tipo
     KJACert.preloadFonts() → Promise; carga las fuentes antes de dibujar
     KJACert.render(canvas, datos) → dibuja en el canvas (2000x1414)
     KJACert.exportar(canvas, nombreArchivo, formato 'png'|'pdf')
     KJACert.fechaLarga(iso), KJACert.codigoDe(numero, emisionISO)

   datos = {tipo, nombre, titulo, duracion, fechaInicio, fechaFin, fechaEmision, codigo}
           (fechas en formato ISO 'YYYY-MM-DD')
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  /* Lienzo por defecto: los cuatro certificados clásicos son apaisados y
     comparten medida. Un tipo puede traer el suyo en `lienzo:{w,h}` — hace
     falta para los documentos en A4 vertical, que no son certificados
     decorados sino hojas con membrete. */
  const W=2000, H=1414;
  const lienzoDe = cfg => (cfg && cfg.lienzo) || {w:W, h:H};
  const SCRIPT="'Damion',cursive";        // nombre cursivo (≈ Adam Script de Canva)
  const SANS="'Poppins',sans-serif";      // párrafo / código / emisión
  const ROMANA="'Cinzel',serif";          // nombre del Taller

  /* Fuentes elegibles para el nombre (datos.fontNombre guarda solo el nombre de la familia) */
  const FUENTES_NOMBRE={
    'Damion':"'Damion',cursive",
    'Great Vibes':"'Great Vibes',cursive",
    'Alex Brush':"'Alex Brush',cursive",
    'Allura':"'Allura',cursive",
    'Pinyon Script':"'Pinyon Script',cursive",
    'Sacramento':"'Sacramento',cursive",
    'Playfair Display':"'Playfair Display',serif",
    'Cormorant Garamond':"'Cormorant Garamond',serif",
    'Cinzel':"'Cinzel',serif"
  };

  const TIPOS = {
    taller:{
      plantilla:'Certificado_taller/PLANTILLA_CERTIFICADO_TALLER.webp?v=6',
      etiquetaTitulo:'Nombre del taller', fechas:'simple',
      nombre:{cx:1000, cy:675, maxW:1600, font:ROMANA, size:108, weight:400, color:'#071F70', upper:true, lh:108, align:'center'},
      cuerpo:{x:234, topY:912, maxW:1532, size:31, lh:46, color:'#2b2b2b', align:'justify'},
      emision:{cx:1554, cy:1006, size:31, color:'#2b2b2b', align:'center'},
      codigo:{cx:1700, cy:153, size:30, color:'#2b2b2b', weight:500, align:'center'},
      qr:{left:1617, top:213, size:165},
      runs:(d)=>[{t:'Quién concluyó con el taller : '},{t:`"${d.titulo}"`,b:1},
                 {t:` con una duración de ${d.duracion} horas académicas, realizado durante el periodo del ${d.fInicio}.`}]
    },
    curso:{
      plantilla:'Certificado_cursos/PLANTILLA_CERTIFICADO_CURSOS.webp?v=5',
      etiquetaTitulo:'Nombre del curso', fechas:'rango',
      nombre:{cx:780, cy:662, maxW:1340, font:SCRIPT, size:104, weight:400, color:'#000000', lh:110, align:'center'},
      cuerpo:{x:120, topY:800, maxW:1300, size:31, lh:46, color:'#2b2b2b', align:'justify'},
      emision:{x:120, cy:945, size:31, color:'#2b2b2b', weight:700, align:'left'},
      codigo:{cx:1685, cy:150, size:30, color:'#ffffff', weight:600, align:'center'},
      qr:{left:1610, top:215, size:150, frame:{color:'#c9a227', width:7, gap:11}},
      runs:(d)=>[{t:'Quién concluyó con el curso : '},{t:`"${d.titulo}"`,b:1},
                 {t:` con una duración de ${d.duracion} horas académicas, realizado durante el periodo del ${d.fInicio}, hasta el ${d.fFin}.`}]
    },
    especializacion:{
      plantilla:'Certiicado_curso_especializacion/PLANTILLA_CERTIFICADO_CURSO_ESPECIALIZACION.webp?v=5',
      etiquetaTitulo:'Nombre del curso de especialización', fechas:'rango',
      nombre:{cx:1005, cy:615, maxW:1700, font:SCRIPT, size:96, weight:400, color:'#1a1a1a', lh:100, align:'center'},
      cuerpo:{x:256, topY:725, maxW:1490, size:31, lh:46, color:'#2b2b2b', align:'justify'},
      emision:{cx:1575, cy:829, size:31, color:'#2b2b2b', align:'center'},
      codigo:{cx:1785, cy:1090, size:23, color:'#2b2b2b', weight:500, align:'center'},
      qr:{left:1696, top:1132, size:177},
      runs:(d)=>[{t:'Quién concluyó con el Curso: '},{t:`"${d.titulo}"`,b:1},
                 {t:` con una duración de ${d.duracion} horas académicas, realizado durante el periodo del ${d.fInicio}, hasta el ${d.fFin}.`}]
    },
    constancia:{
      plantilla:'Certificado_constancia_taller_presencial/PLANTILLA_CERTIFICADO_TALLER_PRESENCIAL.webp?v=5',
      etiquetaTitulo:'Nombre del taller', fechas:'simple',
      nombre:{cx:780, cy:660, maxW:1450, font:SCRIPT, size:92, weight:400, color:'#000000', lh:96, align:'center'},
      cuerpo:{x:160, topY:790, maxW:1380, size:31, lh:46, color:'#2b2b2b', align:'justify'},
      emision:{cx:1321, cy:930, size:31, color:'#2b2b2b', align:'center'},
      codigo:{cx:1745, cy:135, size:28, color:'#ffffff', weight:600, align:'center'},
      qr:{left:1647, top:200, size:196, frame:{color:'#ffffff', width:7, gap:14}},
      runs:(d)=>[{t:'Por haber participado satisfactoriamente en el taller: '},{t:`"${d.titulo}"`,b:1},
                 {t:` con una duración de ${d.duracion} horas académicas, realizado durante el ${d.fInicio}.`}]
    },
    constancia_charlas:{
      /* Hoja A4 vertical a 300 dpi. No lleva nombre en grande ni párrafo
         único: es una carta con membrete, así que usa `campos:'documento'`.
         Las coordenadas son provisionales hasta que llegue la plantilla
         definitiva; el fondo se dibuja en blanco si la imagen no está. */
      plantilla:'Constancia_charlas/PLANTILLA_CONSTANCIA_CHARLAS.webp?v=1',
      etiqueta:'Constancia de charlas',
      etiquetaTitulo:'Proceso realizado (ej. evaluación psicológica)',
      campos:'documento', fechas:'rango',
      lienzo:{w:2480, h:3508},
      lema:{cx:1240, cy:415, maxW:1900, size:44, color:'#1a1a1a', font:"'Poppins',sans-serif", weight:600, align:'center'},
      titulo:{cx:1240, cy:640, maxW:1900, size:96, color:'#000000', font:"'Cinzel',serif", weight:700, align:'center'},
      cuerpo:{x:300, topY:980, maxW:1880, size:48, lh:78, color:'#1a1a1a', align:'justify', espacio:44},
      emision:{x:300, cy:0, maxW:1880, size:48, color:'#1a1a1a', weight:700, align:'left'},
      codigo:{cx:1240, cy:3380, size:34, color:'#555555', weight:500, align:'center'},
      qr:{left:2050, top:3080, size:230},
      /* Cada entrada es un párrafo. El domicilio se omite si no viene: la RPC
         pública no lo emite, y no puede salir "con domicilio en undefined". */
      parrafos:(d)=>{
        const x = d.datos || {};
        const p1 = [{t:'El Centro Psicológico '},{t:'KJA – Desarrollando Mi Bienestar',b:1},
                    {t:' deja constancia de que el estudiante '},{t:d.nombre||'',b:1}];
        if(x.dni||d.dni) p1.push({t:', identificado con DNI N.° '},{t:String(x.dni||d.dni),b:1});
        if(x.edad)       p1.push({t:', de '},{t:String(x.edad),b:1},{t:' años de edad'});
        if(x.grado)      p1.push({t:', cursante del '},{t:x.grado,b:1});
        if(x.colegio)    p1.push({t:' en la Institución Educativa '},{t:x.colegio,b:1});
        if(x.turno)      p1.push({t:', turno '},{t:x.turno,b:1});
        if(x.domicilio)  p1.push({t:', con domicilio en '},{t:x.domicilio,b:1});
        p1.push({t:', ha participado en un proceso de '},{t:x.proceso||d.titulo||'',b:1},
                {t:' en nuestra institución.'});

        const p2 = [{t:'Dicho proceso fue realizado a solicitud de '},
                    {t:x.solicitante||'la institución educativa',b:1},
                    {t:', iniciándose el día '},{t:d.fInicio||'',b:1},
                    {t:' y culminando el día '},{t:d.fFin||'',b:1},
                    {t:', habiendo cumplido con las sesiones programadas correspondientes.'}];

        const p3 = [{t:'Se expide la presente constancia a solicitud del interesado, para los fines que estime pertinentes.'}];
        return [p1, p2, p3];
      }
    }
  };

  const MESES=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const MESES_LARGO=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const fechaLarga = iso => { if(!iso) return ''; const [a,m,d]=iso.split('-').map(Number); return `${String(d).padStart(2,'0')} de ${MESES_LARGO[m-1]} del ${a}`; };
  const codigoDe = (numero, emisionISO) => {
    const [a,m] = emisionISO ? emisionISO.split('-').map(Number) : [new Date().getFullYear(),1];
    return `KJA ${MESES[m-1]}-${numero||'0000'}-${a}`;
  };

  const imgCache={};
  function cargarImg(src){
    return imgCache[src] || (imgCache[src]=new Promise((res,rej)=>{
      const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src;
    }));
  }

  function dibujarSimple(ctx, texto, c){
    ctx.font=`${c.weight||400} ${c.size}px ${c.font||SANS}`;
    ctx.fillStyle=c.color; ctx.textBaseline='middle';
    let txt = c.upper ? (texto||'').toUpperCase() : (texto||'');
    const palabras=txt.split(/\s+/).filter(Boolean);
    const lineas=[]; let linea='';
    for(const p of palabras){
      const test=linea?linea+' '+p:p;
      if(ctx.measureText(test).width>(c.maxW||ctx.canvas.width) && linea){ lineas.push(linea); linea=p; }
      else linea=test;
    }
    if(linea) lineas.push(linea);
    const lh=c.lh||c.size*1.2, n=lineas.length, cyTop=c.cy-(n-1)*lh/2;
    lineas.forEach((ln,i)=>{
      const y=cyTop+i*lh;
      if(c.align==='left'){ ctx.textAlign='left'; ctx.fillText(ln,c.x,y); }
      else { ctx.textAlign='center'; ctx.fillText(ln,c.cx,y); }
    });
  }

  function dibujarParrafo(ctx, runs, c){
    const fam=c.font||SANS;
    const ratio=(c.lh||c.size*1.2)/c.size;   // mantiene la proporción interlínea/tamaño al reducir
    /* Un fragmento que no empieza con espacio va PEGADO al anterior: si no,
       `{t:nombre,b:1}` seguido de `{t:', identificado'}` se dibujaba como
       "Nombre , identificado", con el espacio delante de la coma. */
    const tokens=[];
    let cierraAnterior=true;        // el primer fragmento nunca va pegado a nada
    runs.forEach(r=>{
      const abre=/^\s/.test(r.t);
      const pega = !abre && !cierraAnterior && tokens.length>0;
      r.t.split(/\s+/).forEach((w,i)=>{
        if(!w.length) return;
        tokens.push({text:w, bold:!!r.b, pegado: i===0 && pega});
      });
      // ¿este fragmento deja el separador puesto para el siguiente?
      if(r.t.length) cierraAnterior=/\s$/.test(r.t);
    });

    // Envuelve el texto con un tamaño dado; devuelve las líneas y ayudantes de medición
    function envolver(size){
      const fontW=w=>`${w?700:400} ${size}px ${fam}`;
      const wWidth=tk=>{ ctx.font=fontW(tk.bold); return ctx.measureText(tk.text).width; };
      ctx.font=fontW(false); const spaceW=ctx.measureText(' ').width;
      const lineas=[]; let cur=[], curW=0;
      for(const tk of tokens){
        const tw=wWidth(tk); const add=(cur.length && !tk.pegado ? spaceW : 0)+tw;
        if(curW+add>c.maxW && cur.length){ lineas.push({tokens:cur,width:curW}); cur=[tk]; curW=tw; }
        else { cur.push(tk); curW+=add; }
      }
      if(cur.length) lineas.push({tokens:cur,width:curW});
      return {lineas, spaceW, wWidth, fontW};
    }

    // Auto-ajuste: si hay un piso (c.maxY, la línea de la fecha) y el texto lo pasaría,
    // se reduce el tamaño hasta que la última línea quede por encima de la fecha.
    let size=c.size, r=envolver(size);
    if(c.maxY){
      while(size>20 && (c.topY + (r.lineas.length-1)*(size*ratio)) > c.maxY){
        size-=1; r=envolver(size);
      }
    }
    const lh=size*ratio;
    const alto=(r.lineas.length-1)*lh;   // lo que ocupa, para apilar párrafos debajo
    ctx.fillStyle=c.color; ctx.textBaseline='middle'; ctx.textAlign='left';
    r.lineas.forEach((ln,i)=>{
      const y=c.topY+i*lh; const last=i===r.lineas.length-1;
      let x=c.x, gap=r.spaceW;
      const huecos=ln.tokens.slice(1).filter(t=>!t.pegado).length;
      if(c.align==='justify' && !last && huecos>0){
        gap=(c.maxW - ln.tokens.reduce((s,t)=>s+r.wWidth(t),0))/huecos;
      } else if(c.align==='center'){ x=c.x+(c.maxW-ln.width)/2; }
      else if(c.align==='right'){ x=c.x+(c.maxW-ln.width); }
      ln.tokens.forEach((tk,j)=>{
        if(j>0 && !tk.pegado) x+=gap;
        ctx.font=r.fontW(tk.bold); ctx.fillText(tk.text,x,y); x+=r.wWidth(tk);
      });
    });
    return {lineas:r.lineas.length, lh, alto};
  }

  /* ── Documentos (hoja A4 con membrete) ──
     No son certificados decorados sino cartas: varios párrafos justificados,
     uno debajo del otro, con negritas en línea. Se apilan reusando el mismo
     dibujarParrafo, avanzando la Y con lo que cada uno ocupó. */
  function dibujarDocumento(ctx, parrafos, c){
    let y=c.topY;
    for(const runs of parrafos){
      if(!runs || !runs.length) continue;
      const r=dibujarParrafo(ctx, runs, {...c, topY:y});
      y += r.alto + r.lh + (c.espacio||0);
    }
    return y;
  }

  async function render(canvas, datos){
    const cfg=TIPOS[datos.tipo]; if(!cfg) return;
    const L=lienzoDe(cfg);
    // El lienzo lo manda el tipo: cambiarlo también limpia el canvas
    if(canvas.width!==L.w || canvas.height!==L.h){ canvas.width=L.w; canvas.height=L.h; }
    const ctx=canvas.getContext('2d');
    const d={
      ...datos,
      fInicio:fechaLarga(datos.fechaInicio),
      fFin:fechaLarga(datos.fechaFin),
      fEmision:fechaLarga(datos.fechaEmision)
    };
    ctx.clearRect(0,0,L.w,L.h);
    /* Si la plantilla todavía no existe (o no cargó), se dibuja la hoja en
       blanco en vez de reventar: así el formulario se puede seguir usando y
       se ve el texto colocado. */
    let bg=null;
    try{ bg=await cargarImg(KJACert.basePath+cfg.plantilla); }catch(e){ bg=null; }
    if(bg) ctx.drawImage(bg,0,0,L.w,L.h);
    else { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,L.w,L.h); }

    /* Los documentos (hoja A4 con membrete) se pintan distinto: no tienen el
       nombre en grande ni un párrafo único, sino título y párrafos apilados. */
    if(cfg.campos==='documento') return dibujarDoc(ctx, cfg, d, L);

    let cfgNombre = cfg.nombre;
    if (d.fontSizeNombre) {
      cfgNombre = { ...cfg.nombre, size: d.fontSizeNombre, lh: d.fontSizeNombre };
    }
    if (d.fontNombre && FUENTES_NOMBRE[d.fontNombre]) {
      cfgNombre = { ...cfgNombre, font: FUENTES_NOMBRE[d.fontNombre] };
      // asegura que la fuente elegida esté cargada antes de dibujar en el canvas
      try { await document.fonts.load(`${cfgNombre.weight||400} ${cfgNombre.size}px '${d.fontNombre}'`); } catch(e) {}
    }

    dibujarSimple(ctx, d.nombre, cfgNombre);
    // El párrafo no debe pisar la línea "Lima, [fecha]": se le pasa como piso la Y de la fecha
    // menos una interlínea de aire; si el texto es largo, dibujarParrafo lo reduce para caber.
    const cuerpoCfg = { ...cfg.cuerpo, maxY: cfg.emision.cy - (cfg.cuerpo.lh||46) };
    dibujarParrafo(ctx, cfg.runs(d), cuerpoCfg);
    dibujarSimple(ctx, `Lima, ${d.fEmision}`, cfg.emision);
    dibujarSimple(ctx, d.codigo, cfg.codigo);
    // QR
    const q=cfg.qr;
    const qc=document.createElement('canvas');
    new QRious({element:qc, value:`${KJACert.verifyBase}?id=${encodeURIComponent(d.codigo)}`,
                size:600, background:'white', foreground:'#000000', level:'M'});
    ctx.drawImage(qc, q.left, q.top, q.size, q.size);
    if(q.frame){
      const o=q.frame.gap;
      ctx.strokeStyle=q.frame.color; ctx.lineWidth=q.frame.width;
      ctx.strokeRect(q.left-o, q.top-o, q.size+2*o, q.size+2*o);
    }
  }

  /* Pinta un documento A4: lema del año, título, párrafos, lugar y fecha,
     código y QR. La fecha va debajo del último párrafo, no en una Y fija:
     el largo del cuerpo depende de cuántos datos traiga el estudiante. */
  function dibujarDoc(ctx, cfg, d, L){
    const x=d.datos||{};
    if(cfg.lema && (x.lema||d.lema)) dibujarSimple(ctx, x.lema||d.lema, cfg.lema);
    if(cfg.titulo) dibujarSimple(ctx, x.encabezado||'CONSTANCIA', cfg.titulo);

    const finY = dibujarDocumento(ctx, cfg.parrafos(d), cfg.cuerpo);
    dibujarSimple(ctx, `${x.lugar||'Lima'}, ${d.fEmision}`,
                  {...cfg.emision, cy: finY + (cfg.cuerpo.espacio||0)});

    if(cfg.codigo) dibujarSimple(ctx, d.codigo, cfg.codigo);
    if(cfg.qr){
      const q=cfg.qr, qc=document.createElement('canvas');
      new QRious({element:qc, value:`${KJACert.verifyBase}?id=${encodeURIComponent(d.codigo)}`,
                  size:600, background:'white', foreground:'#000000', level:'M'});
      ctx.drawImage(qc, q.left, q.top, q.size, q.size);
    }
  }

  function exportar(canvas, nombreArchivo, formato){
    const url=canvas.toDataURL('image/png');
    if(formato==='png'){
      const a=document.createElement('a'); a.href=url; a.download=nombreArchivo+'.png'; a.click();
    }else{
      /* La medida y la orientación salen del canvas que se dibujó, no de una
         constante: así un documento en A4 vertical sale vertical en el PDF. */
      const w=canvas.width, h=canvas.height;
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation: w>=h ? 'landscape' : 'portrait', unit:'px', format:[w,h], compress:false});
      pdf.addImage(url,'PNG',0,0,w,h,undefined,'NONE');
      pdf.save(nombreArchivo+'.pdf');
    }
  }

  /* ════════════ TEMARIO (segunda página, para Curso/Especialización) ════════════
     datos.temario = { modulos:[{titulo, fechaInicio, fechaFin, horas}], nota } */
  const TEMARIO = {
    plantilla:'Certificado_cursos/PLANTILLA_TEMARIO_CURSOS.webp',
    /* Ajustes propios de cada tipo. Si un tipo no está aquí, usa el diseño de
       cursos. Si su plantilla aún no existe, cae en la de cursos (fondoTemario). */
    porTipo:{
      especializacion:{
        plantilla:'Certiicado_curso_especializacion/PLANTILLA_TEMARIO_ESPECIALIZACION.webp?v=1',
        soloTitulos:true,          // este diseño no lleva columnas de fecha/horas
        notaEnPlantilla:true,      // la etiqueta "Nota Final" ya viene dibujada
        nota:{ valueX:1249, cy:1163 },
        area:{ left:310, right:1850, top:360, bottom:1050 },
        codigo:{ cx:1772, cy:1304, size:26, color:'#2b2b2b' },
      }
    },
    cols:{ ini:1320, fin:1591, hrs:1858 },               // centros X de las columnas (bajo los íconos)
    bar:{ left:175, right:1260, areaTop:495, areaBottom:875, maxGap:125 },
    ordinalX:325, tituloX:975, tituloW:560,
    total:{ cx:1088, cy:986 },
    nota:{ labelX:735, valueX:1290, cy:1150 }
  };
  const ORD=['1er','2do','3er','4to','5to','6to','7mo','8vo','9no','10mo'];
  const ordModulo = n => (ORD[n-1]||(n+'°'))+' Módulo';
  const fechaCorta = iso => { if(!iso) return ''; const [a,m,d]=iso.split('-'); return `${d}/${m}/${a}`; };
  const horasTotal = mods => mods.reduce((s,m)=>s+(parseInt(m.horas,10)||0),0);

  function roundRect(ctx,x,y,w,h,r){
    if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); return; }
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function pill(ctx, cx, cy, text, o){
    const w=o.w, h=o.h||50, r=h/2;
    roundRect(ctx, cx-w/2, cy-h/2, w, h, r);
    ctx.fillStyle='#ffffff'; ctx.fill();
    ctx.strokeStyle='#1d4ed8'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#1d4ed8'; ctx.font=`600 ${o.size||25}px ${SANS}`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text, cx, cy+1);
  }
  function wrapTem(ctx, text, cx, cy, maxW, font, lh, color){
    ctx.font=font; ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
    const words=(text||'').split(/\s+/).filter(Boolean); const lines=[]; let ln='';
    for(const w of words){ const t=ln?ln+' '+w:w; if(ctx.measureText(t).width>maxW && ln){lines.push(ln);ln=w;} else ln=t; }
    if(ln) lines.push(ln);
    const top=cy-(lines.length-1)*lh/2;
    lines.forEach((l,i)=>ctx.fillText(l,cx,top+i*lh));
  }

  /* Elige el fondo del temario por tipo. Si esa plantilla aún no está subida,
     cae en la de cursos para no romper la generación. */
  async function fondoTemario(cfg){
    if(cfg.plantilla){
      try{ return await cargarImg(KJACert.basePath+cfg.plantilla); }
      catch(e){ console.warn('[KJACert] no se pudo cargar '+cfg.plantilla+', se usa el temario de cursos'); }
    }
    return cargarImg(KJACert.basePath+TEMARIO.plantilla);
  }

  async function renderTemario(canvas, datos){
    const t=TEMARIO, ctx=canvas.getContext('2d');
    const cfg=TEMARIO.porTipo[datos.tipo]||{};      // ajustes del diseño de ese tipo
    const mods=(datos.modulos||[]).slice(0,8);
    const solo=cfg.soloTitulos || !!datos.soloTitulos;   // sin fechas/horas/total
    ctx.clearRect(0,0,W,H);
    const bg=await fondoTemario(cfg);
    ctx.drawImage(bg,0,0,W,H);

    // los tipos con plantilla propia ya traen el fondo limpio: no hay que tapar nada
    if(solo && !cfg.plantilla){
      // tapar (con blanco, el fondo ahí es blanco puro) los íconos de columnas y la caja de total
      ctx.fillStyle='#ffffff';
      ctx.fillRect(1228, 278, 752, 218);   // íconos fecha/fecha/hora
      ctx.fillRect(688, 932, 800, 110);     // caja "Total de horas"
    }

    const n=Math.max(mods.length,1);
    // En "solo títulos" usamos el espacio del total (oculto): barras y texto crecen
    // automáticamente cuando hay pocos módulos, para llenar el espacio disponible.
    const A = cfg.area || {};
    const areaTop = A.top ?? t.bar.areaTop;
    const areaBottom = A.bottom ?? (solo ? 960 : t.bar.areaBottom);
    const span=areaBottom-areaTop;
    const gap=Math.min(solo?200:t.bar.maxGap, span/n);
    const startY=(areaTop+areaBottom)/2 - gap*n/2 + gap/2;
    const barH=solo ? Math.min(150, gap*0.82, gap-14) : Math.min(96, gap-14);
    // En "solo títulos" no existen las columnas de fechas/horas: la barra se extiende
    // hasta el borde derecho útil (antes quedaba un vacío feo de 1260 a ~1830).
    const barLeft  = A.left ?? t.bar.left;
    const barRight = A.right ?? (solo ? 1830 : t.bar.right);
    const barW=barRight-barLeft;
    // Ordinal a la izquierda y título centrado en la barra extendida (sin chocar con el ordinal).
    const ordinalX = solo ? barLeft+155 : t.ordinalX;
    const tituloX = solo ? (barLeft+barRight)/2 + 145 : t.tituloX;
    const tituloW = solo ? barW-490 : t.tituloW;
    const ordSize = solo ? Math.min(50, Math.max(32, barH*0.42)) : Math.min(48, barH*0.52);
    // tituloSize: tamaño manual elegido en el admin (campo "Tamaño Letra"); si no se elige, se autoajusta.
    const titSize = datos.tituloSize || (solo ? Math.min(42, Math.max(24, barH*0.34)) : 24);
    const titLh = Math.round(titSize*1.22);
    const titColor = solo ? '#2c326c' : '#3a5588';

    mods.forEach((m,i)=>{
      const cy=startY+i*gap;
      roundRect(ctx, barLeft, cy-barH/2, barW, barH, 16);
      const g=ctx.createLinearGradient(barLeft,0,barRight,0);
      g.addColorStop(0,'#d7ddec'); g.addColorStop(1,'#fbfcff');
      ctx.fillStyle=g; ctx.fill();
      ctx.fillStyle='#15317e'; ctx.font=`400 ${ordSize}px ${SCRIPT}`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ordModulo(i+1), ordinalX, cy);
      wrapTem(ctx, m.titulo, tituloX, cy, tituloW, `600 ${titSize}px ${SANS}`, titLh, titColor);
      if(!solo){
        pill(ctx, t.cols.ini, cy, fechaCorta(m.fechaInicio), {w:180});
        pill(ctx, t.cols.fin, cy, fechaCorta(m.fechaFin),    {w:180});
        pill(ctx, t.cols.hrs, cy, (m.horas||'')+' hrs',      {w:130});
      }
    });

    if(!solo){
      ctx.fillStyle='#15317e'; ctx.font=`700 30px ${SANS}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`Total de horas académicas = ${horasTotal(mods)} hrs`, t.total.cx, t.total.cy);
    }

    const N = cfg.nota || t.nota;
    ctx.fillStyle='#15317e'; ctx.textAlign='center'; ctx.textBaseline='middle';
    // algunas plantillas ya traen dibujada la etiqueta "Nota Final"
    if(!cfg.notaEnPlantilla){
      ctx.font=`400 60px ${SCRIPT}`;
      ctx.fillText('Nota Final', N.labelX ?? t.nota.labelX, N.cy);
    }
    ctx.font=`700 74px ${SANS}`;
    ctx.fillText(String(datos.nota||''), N.valueX, N.cy);

    // código de verificación (el mismo del certificado), si el diseño lo lleva
    if(cfg.codigo && datos.codigo){
      const C=cfg.codigo;
      ctx.fillStyle=C.color||'#2b2b2b'; ctx.font=`500 ${C.size||26}px ${SANS}`;
      ctx.textAlign='center'; ctx.fillText(datos.codigo, C.cx, C.cy);
    }
  }

  /* PDF de varias páginas (ej. certificado + temario) */
  function exportarMulti(canvases, nombreArchivo){
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'landscape',unit:'px',format:[W,H],compress:false});
    canvases.forEach((c,i)=>{ if(i) pdf.addPage([W,H],'landscape');
      pdf.addImage(c.toDataURL('image/png'),'PNG',0,0,W,H,undefined,'NONE'); });
    pdf.save(nombreArchivo+'.pdf');
  }

  function preloadFonts(){
    const fuentes=["400 108px 'Cinzel'","700 108px 'Cinzel'","400 31px 'Poppins'","600 24px 'Poppins'",
                   "700 31px 'Poppins'","500 30px 'Poppins'","400 96px 'Damion'"];
    return Promise.all(fuentes.map(f=>document.fonts.load(f).catch(()=>{}))).then(()=>document.fonts.ready);
  }

  window.KJACert = {
    W, H, TIPOS, MESES,
    basePath:'', verifyBase:'https://www.kjadmb.com/certificado.html',
    fechaLarga, codigoDe, fechaCorta, horasTotal, render, renderTemario, exportar, exportarMulti, preloadFonts
  };
})();
