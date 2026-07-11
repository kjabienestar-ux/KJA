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
  const W=2000, H=1414;
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
      plantilla:'Certificado_taller/PLANTILLA_CERTIFICADO_TALLER.webp',
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
      plantilla:'Certificado_cursos/PLANTILLA_CERTIFICADO_CURSOS.webp',
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
      plantilla:'Certiicado_curso_especializacion/PLANTILLA_CERTIFICADO_CURSO_ESPECIALIZACION.webp',
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
      plantilla:'Certificado_constancia_taller_presencial/PLANTILLA_CERTIFICADO_TALLER_PRESENCIAL.webp',
      etiquetaTitulo:'Nombre del taller', fechas:'simple',
      nombre:{cx:780, cy:660, maxW:1450, font:SCRIPT, size:92, weight:400, color:'#000000', lh:96, align:'center'},
      cuerpo:{x:160, topY:790, maxW:1380, size:31, lh:46, color:'#2b2b2b', align:'justify'},
      emision:{cx:1321, cy:930, size:31, color:'#2b2b2b', align:'center'},
      codigo:{cx:1745, cy:135, size:28, color:'#ffffff', weight:600, align:'center'},
      qr:{left:1647, top:200, size:196, frame:{color:'#ffffff', width:7, gap:14}},
      runs:(d)=>[{t:'Por haber participado satisfactoriamente en el taller: '},{t:`"${d.titulo}"`,b:1},
                 {t:` con una duración de ${d.duracion} horas académicas, realizado durante el ${d.fInicio}.`}]
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
      if(ctx.measureText(test).width>(c.maxW||W) && linea){ lineas.push(linea); linea=p; }
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
    const fam=c.font||SANS, size=c.size;
    ctx.fillStyle=c.color; ctx.textBaseline='middle'; ctx.textAlign='left';
    const fontW=w=>`${w?700:400} ${size}px ${fam}`;
    const tokens=[];
    runs.forEach(r=>{ r.t.split(/\s+/).forEach(w=>{ if(w.length) tokens.push({text:w,bold:!!r.b}); }); });
    const wWidth=tk=>{ ctx.font=fontW(tk.bold); return ctx.measureText(tk.text).width; };
    ctx.font=fontW(false); const spaceW=ctx.measureText(' ').width;
    const lineas=[]; let cur=[], curW=0;
    for(const tk of tokens){
      const tw=wWidth(tk); const add=(cur.length?spaceW:0)+tw;
      if(curW+add>c.maxW && cur.length){ lineas.push({tokens:cur,width:curW}); cur=[tk]; curW=tw; }
      else { cur.push(tk); curW+=add; }
    }
    if(cur.length) lineas.push({tokens:cur,width:curW});
    lineas.forEach((ln,i)=>{
      const y=c.topY+i*c.lh; const last=i===lineas.length-1;
      let x=c.x, gap=spaceW;
      if(c.align==='justify' && !last && ln.tokens.length>1){
        gap=(c.maxW - ln.tokens.reduce((s,t)=>s+wWidth(t),0))/(ln.tokens.length-1);
      } else if(c.align==='center'){ x=c.x+(c.maxW-ln.width)/2; }
      else if(c.align==='right'){ x=c.x+(c.maxW-ln.width); }
      for(const tk of ln.tokens){ ctx.font=fontW(tk.bold); ctx.fillText(tk.text,x,y); x+=wWidth(tk)+gap; }
    });
  }

  async function render(canvas, datos){
    const cfg=TIPOS[datos.tipo]; if(!cfg) return;
    const ctx=canvas.getContext('2d');
    const d={
      ...datos,
      fInicio:fechaLarga(datos.fechaInicio),
      fFin:fechaLarga(datos.fechaFin),
      fEmision:fechaLarga(datos.fechaEmision)
    };
    ctx.clearRect(0,0,W,H);
    const bg=await cargarImg(KJACert.basePath+cfg.plantilla);
    ctx.drawImage(bg,0,0,W,H);
    
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
    dibujarParrafo(ctx, cfg.runs(d), cfg.cuerpo);
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

  function exportar(canvas, nombreArchivo, formato){
    const url=canvas.toDataURL('image/png');
    if(formato==='png'){
      const a=document.createElement('a'); a.href=url; a.download=nombreArchivo+'.png'; a.click();
    }else{
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'landscape',unit:'px',format:[W,H],compress:false});
      pdf.addImage(url,'PNG',0,0,W,H,undefined,'NONE');
      pdf.save(nombreArchivo+'.pdf');
    }
  }

  /* ════════════ TEMARIO (segunda página, para Curso/Especialización) ════════════
     datos.temario = { modulos:[{titulo, fechaInicio, fechaFin, horas}], nota } */
  const TEMARIO = {
    plantilla:'Certificado_cursos/PLANTILLA_TEMARIO_CURSOS.webp',
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

  async function renderTemario(canvas, datos){
    const t=TEMARIO, ctx=canvas.getContext('2d');
    const mods=(datos.modulos||[]).slice(0,8);
    const solo=!!datos.soloTitulos;   // temario de solo títulos (sin fechas/horas/total)
    ctx.clearRect(0,0,W,H);
    const bg=await cargarImg(KJACert.basePath+t.plantilla);
    ctx.drawImage(bg,0,0,W,H);

    if(solo){
      // tapar (con blanco, el fondo ahí es blanco puro) los íconos de columnas y la caja de total
      ctx.fillStyle='#ffffff';
      ctx.fillRect(1228, 278, 752, 218);   // íconos fecha/fecha/hora
      ctx.fillRect(688, 932, 800, 110);     // caja "Total de horas"
    }

    const n=Math.max(mods.length,1);
    // En "solo títulos" usamos el espacio del total (oculto): barras y texto crecen
    // automáticamente cuando hay pocos módulos, para llenar el espacio disponible.
    const areaTop=t.bar.areaTop, areaBottom = solo ? 960 : t.bar.areaBottom;
    const span=areaBottom-areaTop;
    const gap=Math.min(solo?200:t.bar.maxGap, span/n);
    const startY=(areaTop+areaBottom)/2 - gap*n/2 + gap/2;
    const barH=solo ? Math.min(150, gap*0.82, gap-14) : Math.min(96, gap-14);
    const barW=t.bar.right-t.bar.left;
    // En "solo títulos" se achica la columna del ordinal (para que no choque con el título)
    // y se ensancha/recorre el título hacia la derecha, para que use más espacio y no se vea apretado.
    const ordinalX = solo ? 310 : t.ordinalX;
    const tituloX = solo ? 865 : t.tituloX;
    const tituloW = solo ? 780 : t.tituloW;
    const ordSize = solo ? Math.min(50, Math.max(32, barH*0.42)) : Math.min(48, barH*0.52);
    // tituloSize: tamaño manual elegido en el admin (campo "Tamaño Letra"); si no se elige, se autoajusta.
    const titSize = datos.tituloSize || (solo ? Math.min(42, Math.max(24, barH*0.34)) : 24);
    const titLh = Math.round(titSize*1.22);
    const titColor = solo ? '#2c326c' : '#3a5588';

    mods.forEach((m,i)=>{
      const cy=startY+i*gap;
      roundRect(ctx, t.bar.left, cy-barH/2, barW, barH, 16);
      const g=ctx.createLinearGradient(t.bar.left,0,t.bar.right,0);
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

    ctx.fillStyle='#15317e'; ctx.font=`400 60px ${SCRIPT}`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Nota Final', t.nota.labelX, t.nota.cy);
    ctx.font=`700 74px ${SANS}`; ctx.fillText(String(datos.nota||''), t.nota.valueX, t.nota.cy);
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
