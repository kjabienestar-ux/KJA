(function(root){
  'use strict';
  function link(phone,message){
    const number=String(phone||'').replace(/[\s()+-]/g,'');
    if(!/^[1-9]\d{7,14}$/.test(number))throw new Error('Ingresa un teléfono con código de país, por ejemplo 51988918238.');
    if(!String(message||'').trim())throw new Error('Escribe el mensaje de WhatsApp.');
    return 'https://wa.me/'+number+'?text='+encodeURIComponent(message.trim());
  }
  function compose(data,url){
    const parts=[data.titulo];
    if(data.descripcion)parts.push(data.descripcion);
    if(data.publico)parts.push('👥 ¿A QUIÉN VA DIRIGIDO?\n'+data.publico);
    if(data.temario)parts.push('📋 TEMARIO DEL CURSO:\n'+data.temario.split('\n').filter(x=>x.trim()).map((x,i)=>(i+1)+'. '+x.replace(/^\s*\d+[.)]\s*/, '')).join('\n'));
    if(data.modalidad)parts.push('💻 MODALIDAD:\n'+data.modalidad);
    if(data.beneficios)parts.push('📚 BENEFICIOS:\n'+data.beneficios);
    if(data.detalles)parts.push(data.detalles);
    parts.push('📩 Solicita información aquí: '+url);
    if(data.correo)parts.push('Correo: '+data.correo);
    parts.push('💙 KJA: Desarrollando mi bienestar.');
    return parts.filter(Boolean).join('\n\n');
  }
  function parseText(text){
    if(!String(text||'').trim())throw new Error('Pega el texto del flyer para organizarlo.');
    if(text.length>20000)throw new Error('El texto puede tener hasta 20 000 caracteres.');
    const data=Object.fromEntries(['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje'].map(k=>[k,'']));
    const aliases={titulo:['titulo','nombre del curso','curso'],descripcion:['descripcion','presentacion'],publico:['a quien va dirigido','dirigido a','publico objetivo','publico'],temario:['temario del curso','temario','contenido'],modalidad:['modalidad'],beneficios:['beneficios incluidos','beneficios'],detalles:['fechas','fecha','precio','inversion','condiciones','detalles','modalidad y beneficios'],telefono:['telefono de contacto','telefono','whatsapp de ventas','whatsapp','contactanos al'],correo:['correo electronico','correo','email'],mensaje:['mensaje de whatsapp','mensaje']};
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
  root.KJAMarketing={link,compose,parseText,serviceError};
  if(typeof module!=='undefined')module.exports={link,compose,parseText,serviceError};
})(typeof window==='undefined'?globalThis:window);
