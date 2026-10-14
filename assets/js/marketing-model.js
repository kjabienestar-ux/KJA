(function(root){
  'use strict';
  function link(phone,message){
    const number=String(phone||'').replace(/[\s()+-]/g,'');
    if(!/^[1-9]\d{7,14}$/.test(number))throw new Error('Ingresa un teléfono con código de país, por ejemplo 51988918238.');
    if(!String(message||'').trim())throw new Error('Escribe el mensaje de WhatsApp.');
    return 'https://wa.me/'+number+'?text='+encodeURIComponent(message.trim());
  }
  function whatsappMessage(title,post=''){
    const name=String(title||'').replace(/^[^\p{L}\p{N}]+/u,'').trim().toUpperCase();
    if(!name)throw new Error('Completa el nombre del flyer para generar su mensaje.');
    const article=/^(TERAPIA|FORMACIÓN|EVALUACIÓN|CAPACITACIÓN)\b/u.test(name)?'la ':/^(CURSO|TALLER|DIPLOMADO)\b/u.test(name)?'el ':'';
    if(post){const url=new URL(post);if(url.protocol!=='https:'||url.username||url.password||!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','fb.watch'].includes(url.hostname))throw new Error('Pega un enlace HTTPS de la publicación en Facebook.');}
    return 'Hola KJA. Vengo de Facebook, deseo información sobre '+article+name+(post?' de la siguiente publicación: '+post:'.');
  }
  function contactLine(data,url){
    const number=String(data.telefono||'').replace(/[\s()+-]/g,'');
    const visible=/^51\d{9}$/.test(number)?number.slice(2).replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):number;
    return '📲 Contáctanos al WhatsApp: '+url+(visible?' (o al número '+visible+')':'');
  }
  function compose(data,url){
    const options=data.opciones||{};
    const title=String(data.titulo||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
    const therapy=/terapia|atención psicológica|consulta psicológica/i.test(title)&&! /curso|taller|diplomado|formación/i.test(title);
    const family=/familia|pareja/i.test(title);
    const titleEmoji=therapy?(family?'👨‍👩‍👧‍👦':'💙'):/escolar|educativ|aprendizaje/i.test(title)?'🏫':/neuro|psico|cogniti/i.test(title)?'🧠':'📚';
    const parts=[titleEmoji+' '+title.toUpperCase()];
    if(data.descripcion)parts.push(data.descripcion);
    if(data.publico)parts.push('👩‍⚕️ ¿A QUIÉN VA DIRIGIDO?\n'+data.publico);
    const clean=x=>x.replace(/^[^\p{L}\p{N}]+/u,'').replace(/^\d+[.)]\s*/,'').trim();
    const lines=value=>String(value||'').split(/\n|;\s*|,\s*(?=(?:material|incluye|certificado|válido|solo válido|vacantes|\d+\s*horas)\b)/i).map(clean).filter(Boolean);
    if(data.temario)parts.push((therapy?'📋 ¿QUÉ ABORDAMOS EN LAS SESIONES?':'📋 ¿QUÉ APRENDERÁS EN ESTA FORMACIÓN?')+'\n'+lines(data.temario).map((x,i)=>(therapy?['🗣️','🤝','❤️']:['🧩','💡','🤝'])[i%3]+' '+x).join('\n'));
    if(data.modalidad)parts.push('👤 MODALIDAD'+(therapy?' Y ENFOQUE':'')+':\n'+(/online|virtual|en l[ií]nea/i.test(data.modalidad)?'💻':'🏫')+' '+data.modalidad);
    const benefits=lines(data.beneficios);
    if(options.certificado&&!benefits.some(x=>/certificad/i.test(x)))benefits.push('Certificado Académico (con QR) respaldado por el Centro de Capacitación y Formación Psicológica (KJA).');
    if(options.material&&!benefits.some(x=>/material/i.test(x)))benefits.push('Material académico digital para apoyar tu aprendizaje.');
    const detailLines=lines(data.detalles),closing=[...benefits,...detailLines];
    const isClosing=x=>/^(?:solo )?válido en perú\.?$|^¡?vacantes limitadas[!.]?$/i.test(x);
    const emoji=x=>/certificad|diploma/i.test(x)?'📜':/material/i.test(x)?'📚':/horas/i.test(x)?'⏱️':/concursos/i.test(x)?'✅':/descuento|%|inversión|precio/i.test(x)?'💰':'✨';
    if(benefits.filter(x=>!isClosing(x)).length)parts.push('✨ BENEFICIOS'+(therapy?'': ' EXCLUSIVOS')+':\n'+benefits.filter(x=>!isClosing(x)).map(x=>emoji(x)+' '+x).join('\n'));
    if(detailLines.filter(x=>!isClosing(x)).length)parts.push(detailLines.filter(x=>!isClosing(x)).map(x=>emoji(x)+' '+x).join('\n'));
    if(options.peru||closing.some(x=>/^(?:solo )?válido en perú\.?$/i.test(x)))parts.push('🇵🇪 Solo válido en Perú.');
    parts.push(contactLine(data,url));
    if(data.correo)parts.push('📧 '+data.correo);
    parts.push(therapy?'💙 KJA: Centro de Atención Psicológica Integral.':'💙 KJA: Desarrollando mi bienestar.');
    if(options.vacantes||closing.some(x=>/^¡?vacantes limitadas[!.]?$/i.test(x)))parts.push('🚨 ¡VACANTES LIMITADAS! Asegura tu '+(therapy?'espacio':'cupo')+' hoy mismo. 🚨');
    return parts.filter(Boolean).join('\n\n');
  }
  function parseText(text){
    if(!String(text||'').trim())throw new Error('Pega el texto del flyer para organizarlo.');
    if(text.length>20000)throw new Error('El texto puede tener hasta 20 000 caracteres.');
    const data=Object.fromEntries(['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje'].map(k=>[k,'']));
    const aliases={titulo:['titulo','nombre del curso','curso'],descripcion:['descripcion','presentacion'],publico:['a quien va dirigido','dirigido a','publico objetivo','publico'],temario:['que aprenderas en esta formacion','temario del curso','temario','contenido'],modalidad:['modalidad'],beneficios:['beneficios exclusivos','beneficios incluidos','beneficios'],detalles:['fechas','fecha','precio','inversion','condiciones','detalles','modalidad y beneficios'],telefono:['telefono de contacto','telefono','whatsapp de ventas','whatsapp','contactanos al'],correo:['correo electronico','correo','email'],mensaje:['mensaje de whatsapp','mensaje']};
    const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!]/g,'').trim();
    const append=(field,value)=>{if(value)data[field]+=(data[field]?'\n':'')+value};
    let section='descripcion',hasHeading=false;
    for(const original of text.replace(/\r\n?/g,'\n').split('\n')){
      const line=original.trim();if(!line)continue;
      const clean=line.replace(/^[^\p{L}\p{N}¿]+/u,'').replace(/\*\*/g,'').trim();
      const colon=clean.indexOf(':');
      const heading=normalize(colon<0?clean:clean.slice(0,colon));
      const field=Object.keys(aliases).find(k=>aliases[k].includes(heading));
      if(field){
        hasHeading=true;section=field;const value=colon<0?'':clean.slice(colon+1).trim();
        // Mantener etiquetas de fecha/precio y títulos combinados para no perder contexto.
        append(field,field==='detalles'?clean:value);continue;
      }
      if(!data.correo&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)){data.correo=clean;continue}
      if(!hasHeading&&!data.titulo){data.titulo=line;continue}
      append(section,line);
    }
    // No deducir el país ni convertir líneas ambiguas en un teléfono.
    if(data.telefono&&!/^[+\d\s()-]+$/.test(data.telefono)){
      append('detalles','Contacto: '+data.telefono);data.telefono='';
    }
    const limits={titulo:300,descripcion:3000,publico:3000,temario:6000,modalidad:300,beneficios:3000,detalles:3000,telefono:30,correo:250,mensaje:2000};
    for(const [field,limit] of Object.entries(limits))if(data[field].length>limit)throw new Error('La sección '+field+' es demasiado larga. Separa el texto con encabezados antes de organizarlo.');
    return data;
  }
  function serviceError(error,detail){
    if(typeof detail?.error==='string')return detail.error;
    const code=error?.context?.status;
    if(code===404)return 'El servicio de publicaciones aún no está activado. Contacta a Sistemas para completar la activación.';
    if(code===401)return 'Tu sesión no pudo validarse. Cierra sesión y vuelve a entrar.';
    if(code===403)return 'Tu cuenta no tiene permiso para esta operación. Contacta a Sistemas.';
    if(code===429)return 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.';
    return 'No se pudo conectar con Publicaciones. Revisa tu conexión y pulsa Reintentar conexión.';
  }
  root.KJAMarketing={link,compose,parseText,serviceError,contactLine,whatsappMessage};
  if(typeof module!=='undefined')module.exports={link,compose,parseText,serviceError,contactLine,whatsappMessage};
})(typeof window==='undefined'?globalThis:window);
