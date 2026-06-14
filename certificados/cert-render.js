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

  function preloadFonts(){
    const fuentes=["400 108px 'Cinzel'","700 108px 'Cinzel'","400 31px 'Poppins'",
                   "700 31px 'Poppins'","500 30px 'Poppins'","400 96px 'Damion'"];
    return Promise.all(fuentes.map(f=>document.fonts.load(f).catch(()=>{}))).then(()=>document.fonts.ready);
  }

  window.KJACert = {
    W, H, TIPOS, MESES,
    basePath:'', verifyBase:'https://yeiserdev.github.io/KJA/certificado.html',
    fechaLarga, codigoDe, render, exportar, preloadFonts
  };
})();
