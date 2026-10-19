(function(root){
  'use strict';
  async function compressFlyer(file,env=root){
    if(!env.createImageBitmap||!env.document)throw new Error('Tu navegador no permite optimizar imágenes. Usa una versión reciente de Chrome, Edge o Firefox.');
    const bitmap=await env.createImageBitmap(file);
    let canvas;
    try{
      if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('El flyer supera los 40 megapíxeles. Exporta una imagen de menor resolución antes de subirla.');
      canvas=env.document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar el flyer.');
      context.drawImage(bitmap,0,0);
      // Mantener todos los píxeles y elegir la versión que realmente pese menos.
      const compressed=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.86));
      return compressed?.type==='image/webp'&&compressed.size>0&&compressed.size<file.size?compressed:file;
    }finally{bitmap.close();if(canvas){canvas.width=0;canvas.height=0;}}
  }
  function contactNumbers(phone){
    const single=String(phone||'').replace(/[\s()+-]/g,'');
    if(/^[1-9]\d{7,14}$|^0\d{7,10}$/.test(single))return [single];
    const parts=String(phone||'').trim().split(/\s*(?:[\/;,|\n]+|\s+[yo]\s+)\s*|(?=\+\d|\(\d{1,3}\))/i).filter(Boolean);
    const numbers=parts.map(part=>part.replace(/[\s()+-]/g,''));
    if(numbers.length>2||numbers.some(number=>! /^[1-9]\d{7,14}$|^0\d{7,10}$/.test(number)))return [];
    return [...new Set(numbers)];
  }
  function phoneCandidates(phone){return contactNumbers(phone).filter(number=>!number.startsWith('0'));}
  function link(phone,message){
    const number=phoneCandidates(phone)[0]||'';
    if(!/^[1-9]\d{7,14}$/.test(number))throw new Error('Ingresa un teléfono con código de país, por ejemplo 51988918238.');
    if(!String(message||'').trim())throw new Error('Escribe el mensaje de WhatsApp.');
    return 'https://wa.me/'+number+'?text='+encodeURIComponent(message.trim());
  }
  function isTherapy(data){
    if(/^TCC aplicada al tratamiento de (?:la )?depresi[oó]n en adolescentes$/i.test(String(data.titulo||'').trim()))return false;
    if(/curso|taller|diplomado|formaci[oó]n|capacitaci[oó]n|certificaci[oó]n/i.test(data.titulo||''))return false;
    return /terapia|atenci[oó]n psicol[oó]gica|consulta psicol[oó]gica/i.test([data.titulo,data.descripcion,data.temario,data.modalidad].filter(Boolean).join(' '));
  }
  function whatsappMessage(title,post='',context={}){
    const name=String(title||'').replace(/^[^\p{L}\p{N}]+/u,'').trim().toUpperCase();
    if(!name)throw new Error('Completa el nombre del flyer para generar su mensaje.');
    const article=/^(TERAPIA|FORMACIÓN|EVALUACIÓN|CAPACITACIÓN)\b/u.test(name)?'la ':/^(CURSO|TALLER|DIPLOMADO)\b/u.test(name)?'el ':'';
    if(post){const url=new URL(post);if(url.protocol!=='https:'||url.username||url.password||!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','fb.watch'].includes(url.hostname))throw new Error('Pega un enlace HTTPS de la publicación en Facebook.');}
    const therapy=isTherapy({...context,titulo:title});
    return 'Hola KJA 👋\nVengo de Facebook, deseo información sobre '+article+name+'.\n\n'+(therapy?'¿Me pueden orientar sobre la atención, el costo y los horarios disponibles?':'¿Me comparten el precio, las próximas fechas y cómo inscribirme?')+(post?'\n\nVi la siguiente publicación: '+post:'')+'\n¡Gracias!';
  }
  function contactLine(data,url,cta=''){
    const prefix=cta||'📲 Contáctanos al WhatsApp: ';
    const all=contactNumbers(data.telefono),local=all.filter(number=>number.startsWith('0'));
    if(local.length){
      const international=all.filter(number=>!number.startsWith('0'));
      const format=number=>/^51\d{9}$/.test(number)?'(51) '+number.slice(2).replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):'+'+number;
      return prefix+url+(international.length?' ('+international.map(format).join(' · ')+')':'')+' · Teléfono: '+local.map(number=>/^01\d{7}$/.test(number)?number.slice(0,2)+' '+number.slice(2):number).join(' · ');
    }
    const contacts=phoneCandidates(data.telefono);
    if(contacts.length>1)return prefix+contacts.map(number=>/^51\d{9}$/.test(number)?'(51) '+number.slice(2).replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):'+'+number).join(' · ')+' / '+url;
    const number=String(data.telefono||'').replace(/[\s()+-]/g,'');
    const visible=/^51\d{9}$/.test(number)?'(51) '+number.slice(2).replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):number;
    return prefix+url+(visible?' (o al WhatsApp '+visible+')':'');
  }
  function completeCourseData(data){
    const title=String(data.titulo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^[^a-z0-9]+/i,'').trim();
    if(/^TCC aplicada al tratamiento de (?:la )?depresion en adolescentes$/i.test(title)){
      const result={...data};
      if(!String(result.publico||'').trim())result.publico='Psicólogos clínicos, psicoterapeutas, psicólogos educativos, orientadores escolares, profesionales de la salud mental y estudiantes de psicología interesados en la intervención terapéutica en adolescentes.';
      if(!String(result.temario||'').trim())result.temario='Evaluación y conceptualización TCC: identificación de distorsiones cognitivas, sintomatología depresiva y evaluación del estado afectivo en adolescentes.\nTécnicas y herramientas terapéuticas: activación conductual, reestructuración cognitiva, solución de problemas y regulación emocional.\nPlan de tratamiento e intervención familiar: diseño de sesiones clínicas, prevención de recaídas y pautas de soporte para padres y tutores.';
      const original='¿Buscas profundizar en las estrategias cognitivo-conductuales orientadas al abordaje de la depresión en la etapa adolescente? Esta propuesta formativa se enfoca en herramientas prácticas aplicables a la psicología clínica y educativa. Te invitamos a comunicarte con nosotros para brindarte todos los detalles del curso.';
      if(!String(result.descripcion||'').trim()||result.descripcion.trim()===original)result.descripcion='Profundiza en el abordaje de la depresión adolescente con herramientas de Terapia Cognitivo-Conductual. Revisa la evaluación del caso, la activación conductual y la reestructuración cognitiva, junto con la planificación de sesiones y el acompañamiento familiar.';
      return result;
    }
    if(/^psicologia para el abordaje del comportamiento suicida$/i.test(title)){
      const result={...data};
      if(!String(result.publico||'').trim())result.publico='Psicólogos clínicos, psicoterapeutas, profesionales de la salud mental, médicos, trabajadores sociales, orientadores y estudiantes de psicología interesados en la gestión de crisis y prevención del suicidio.';
      if(!String(result.temario||'').trim())result.temario='Evaluación y Detección del Riesgo Suicida: identificación de factores de riesgo, señales de alerta e instrumentos de tamizaje clínico.\nProtocolos de Intervención e Intervención en Crisis: estrategias de contención inmediata, planes de seguridad y abordaje psicoterapéutico.\nPrevención y Postvención Psicológica: herramientas para la sensibilización, apoyo a familiares y manejo emocional del profesional.';
      if(!String(result.descripcion||'').trim())result.descripcion='Aprende a identificar, evaluar e intervenir de manera oportuna y basada en evidencia científica ante la ideación y conducta suicida, adquiriendo herramientas clínicas cruciales para la prevención, manejo de crisis y soporte psicológico integral.';
      return result;
    }
    if(/autoestima.*ni[nñ]os|terapia emocional.*autoestima|autoestima.*adolescentes/i.test(title)){
      const result={...data};
      if(!String(result.publico||'').trim())result.publico='Niños y adolescentes que necesitan apoyo profesional para fortalecer su autoconfianza, gestionar sus emociones y superar dificultades en su autoestima.';
      if(!String(result.temario||'').trim())result.temario='Evaluación Emocional: Comprensión y análisis del estado emocional actual del menor para un abordaje adecuado.\nEstrategias de Intervención: Herramientas clínicas personalizadas para el fortalecimiento de la autoconfianza y la expresión emocional.\nAcompañamiento Integral: Pautas y orientación continua para guiar al niño o adolescente hacia su bienestar psicológico.';
      const oldGeneric='¿Tu hijo presenta dificultades con su autoestima y necesitas un espacio de acompañamiento profesional? Este servicio de terapia emocional aborda las necesidades afectivas y el autoconcepto en etapas de desarrollo clave. Consulta más información para conocer los detalles de la atención.';
      if(!String(result.descripcion||'').trim()||result.descripcion.trim()===oldGeneric)result.descripcion='Brindamos un espacio seguro y profesional con estrategias, herramientas y técnicas clínicas especializadas para ayudar a niños y adolescentes a superar sus dificultades de autoestima y bienestar emocional. 🧩🤝';
      return result;
    }
    return {...data};
  }
  function compose(data,url){
    data=completeCourseData(data);
    const options=data.opciones||{};
    const title=String(data.titulo||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
    const therapy=isTherapy(data);
    const family=/familia|pareja/i.test(title);
    const titleEmoji=family?'👨‍👩‍👧‍👦':/terapia|emocional|autoestima|depresi[oó]n|ansiedad|suicid|duelo|conductual/i.test(title)?'🧠':/escolar|educativ|aprendizaje/i.test(title)?'🏫':/neuro|psico|cogniti/i.test(title)?'🧠':therapy?'🧠':'📚';
    const parts=[titleEmoji+' '+title.toUpperCase()];
    if(therapy){
      const lines=String(data.temario||'').split(/\n|;\s*/).map(x=>x.replace(/^[^\p{L}\p{N}]+/u,'').trim()).filter(Boolean);
      const explain=line=>{
        if(line.length>110||line.includes(':'))return line;
        const text=line.replace(/[.]+$/,'');
        if(/cognitivo.*conductual/i.test(text))return text+': Un espacio para explorar pensamientos, emociones y formas de relacionarse.';
        if(/terapia.*pareja.*familia/i.test(text))return text+': Un espacio para conversar sobre los vínculos, la comunicación y la convivencia.';
        if(/comunicaci[oó]n|celos|infidelidad|dependencia/i.test(text))return text+': Orientación para abordar estas dificultades en las relaciones.';
        if(/bienestar.*emocional/i.test(text))return text+': Atención centrada en el bienestar y las relaciones personales.';
        return line;
      };
      const icon=(line,i)=>['🧩','💡','🤝'][i%3];
      parts.push('SERVICIO DE TERAPIA PSICOLÓGICA: 🧠✨');
      const intro=String(data.descripcion||'').trim();
      parts.push(intro||'Brindamos un espacio seguro y profesional con estrategias, herramientas y técnicas clínicas especializadas para acompañarte en tu proceso y fortalecer tu bienestar emocional. 🧩🤝');
      if(data.publico)parts.push('🧑‍🦲 ¿A QUIÉN ESTÁ DIRIGIDO?\n'+data.publico);
      if(lines.length)parts.push('📋 ¿EN QUÉ CONSISTE ESTA TERAPIA?\n'+lines.map((line,i)=>icon(line,i)+' '+explain(line)).join('\n'));
      if(data.modalidad)parts.push('📍 Modalidad: '+data.modalidad);
      if(data.beneficios)parts.push(data.beneficios);
      if(data.detalles){
        const detailLines=String(data.detalles).split('\n').filter(Boolean);
        const nonClosing=detailLines.filter(x=>!/^(?:solo )?válido en perú\.?$|^¡?vacantes limitadas[!.]?$/i.test(x.trim()));
        if(nonClosing.length)parts.push(nonClosing.map(line=>(/calle|direcci[oó]n|ubicaci[oó]n|avenida|\burb\b/i.test(line)?'📍 ':'ℹ️ ')+line).join('\n'));
      }
      parts.push('🇵🇪 Solo válido en Perú.');
      parts.push(contactLine(data,url,'📲 Inscríbete directamente aquí: '));
      parts.push('📧 Correo: kjabienestar@escuelakja.net');
      parts.push('🌐 Página Web: https://www.kjadmb.com/');
      parts.push('💙 KJA: Centro de Capacitación y Formación Psicológica (Desarrollando mi bienestar).');
      parts.push('🚨 ¡VACANTES LIMITADAS! Asegura tu cupo hoy mismo. 🚨');
      return parts.join('\n\n');
    }
    return composeCourse(data,url,title);
  }
  function composeCourse(data,url,title){
    const courseTitle=title.replace(/^curso\s*(?:(?:online|virtual|en línea)\s*)?(?:(?:de|en|sobre)\s*:?|:)\s*/i,'');
    const modality=String(data.modalidad||'').trim();
    const heading=/presencial/i.test(modality)?'CURSO '+modality.toUpperCase()+' DE:':'CURSO ONLINE DE:';
    const parts=['🎒 '+heading+' '+courseTitle.toUpperCase()];
    if(data.descripcion)parts.push(data.descripcion.trim().replace(/\s*💡✨$/u,'')+' 💡✨');
    if(data.publico)parts.push('👩‍⚕️ ¿A QUIÉN VA DIRIGIDO?\n'+data.publico.trim());
    if(data.temario){
      const clean=x=>x.replace(/^[^\p{L}\p{N}]+/u,'').replace(/^\d+[.)-]\s*/,'').trim();
      const lines=String(data.temario).split(/\n|;\s*/).map(clean).filter(Boolean);
      const icons=['🔍','🧠','💡','📌','🎯','🧩','📝','📊','🔬','✨'];
      const formatted=lines.map((line,i)=>icons[i%icons.length]+' '+line).join('\n');
      if(formatted)parts.push('📋 ¿QUÉ APRENDERÁS EN ESTA FORMACIÓN?\n'+formatted);
    }
    const isPresencial=/presencial/i.test(modality);
    const zoomLine=isPresencial?'':'💻 Clases en vivo vía Zoom\n';
    parts.push('🎁 TE BRINDAMOS:\n🏷️ Descuento de 50% disponible\n🎁 ¡GRATIS! 1 curso gratis grabado (6 H.A)\n⏱️ 300 horas académicas\n📜 Certificado académico (incluye QR)\n'+zoomLine+'📖 Material académico digital completo\n🇵🇪 Solo válido en Perú');
    const phones=contactNumbers(data.telefono||'51988918238');
    const visible=phones.map(number=>/^51\d{9}$/.test(number)?'(51) '+number.slice(2).replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):number).join(' / ');
    parts.push('📩 INSCRÍBETE DIRECTAMENTE AQUÍ:\n📲 WhatsApp: '+url+'\n📞 Teléfono de contacto: '+visible+'\n📧 Correo: '+(data.correo||'kjabienestar@escuelakja.net')+'\n🌐 Página Web: https://www.kjadmb.com/');
    parts.push('💙 KJA - Centro de Capacitación y Formación Psicológica');
    parts.push('🚨 ¡APROVECHA EL 50% DE DESCUENTO Y POTENCIA TU PERFIL HOY MISMO! 🚨');
    return parts.join('\n\n');
  }
  function parseText(text){
    if(!String(text||'').trim())throw new Error('Pega el texto del flyer para organizarlo.');
    if(text.length>20000)throw new Error('El texto puede tener hasta 20 000 caracteres.');
    const data=Object.fromEntries(['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje'].map(k=>[k,'']));
    const aliases={titulo:['titulo','nombre del curso','curso'],descripcion:['descripcion','presentacion'],publico:['a quien va dirigido','dirigido a','publico objetivo','publico','a quien esta dirigido'],temario:['que aprenderas en esta formacion','temario del curso','temario','contenido','en que consiste esta terapia','que abordamos en las sesiones','opciones de atencion'],modalidad:['modalidad'],beneficios:['beneficios exclusivos','beneficios incluidos','beneficios'],detalles:['fechas','fecha','precio','inversion','condiciones','detalles','modalidad y beneficios'],telefono:['telefono de contacto','telefono','whatsapp de ventas','whatsapp','contactanos al'],correo:['correo electronico','correo','email'],mensaje:['mensaje de whatsapp','mensaje']};
    const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!]/g,'').trim();
    const append=(field,value)=>{if(value)data[field]+=(data[field]?'\n':'')+value};
    let section='descripcion',hasHeading=false;
    for(const original of text.replace(/\r\n?/g,'\n').split('\n')){
      const line=original.replace(/[\u2800]/g,'').trim();if(!line)continue;
      const clean=line.replace(/^[^\p{L}\p{N}¿]+/u,'').replace(/\*\*/g,'').trim();
      if(!clean)continue;
      const colon=clean.indexOf(':');
      const heading=normalize(colon<0?clean:clean.slice(0,colon));
      const field=Object.keys(aliases).find(k=>aliases[k].includes(heading));
      if(field){
        hasHeading=true;section=field;const value=colon<0?'':clean.slice(colon+1).trim();
        append(field,field==='detalles'?clean:value);continue;
      }
      if(/^servicio de terapia psicol[oó]gica|^centro de atenci[oó]n psicol[oó]gica/i.test(clean)) continue;
      if(!data.modalidad&&/^(?:curso|taller|diplomado|modalidad)?\s*(?:online|presencial|semipresencial|virtual|en vivo|en linea)$/i.test(clean)){
        data.modalidad=clean.replace(/^(?:curso|taller|diplomado|modalidad)\s*:?\s*/i,'').trim();
        continue;
      }
      if(/^visita nuestra p[aá]gina web|^p[aá]gina web oficial|^https:\/\/www\.kjadmb\.com/i.test(clean)) continue;
      if(/^kja:\s*centro de capacitaci[oó]n/i.test(clean)) continue;
      if(/^¡?vacantes limitadas[!.]?|^asegura tu (?:cupo|vacante|lugar)/i.test(clean)){
        append('detalles','Vacantes limitadas');
        continue;
      }
      if(/^(?:inscr[ií]bete|contacta|escr[ií]benos|solicita).*https?:\/\/wa\.(?:link|me)\/|wa\.link|wa\.me/i.test(clean)){
        const matchPhone=clean.match(/\b51\d{9}\b/);
        if(matchPhone&&!data.telefono) data.telefono=matchPhone[0];
        continue;
      }
      if(!data.correo&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)){data.correo=clean;continue}
      if(!hasHeading&&!data.titulo){data.titulo=clean;continue}
      append(section,line);
    }
    // No deducir el país ni convertir líneas ambiguas en un teléfono.
    if(data.telefono&&!phoneCandidates(data.telefono).length){
      append('detalles','Contacto: '+data.telefono);data.telefono='';
    }
    const limits={titulo:300,descripcion:3000,publico:3000,temario:6000,modalidad:300,beneficios:3000,detalles:3000,telefono:100,correo:250,mensaje:2000};
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
  root.KJAMarketing={link,compose,parseText,serviceError,contactLine,whatsappMessage,compressFlyer,phoneCandidates,contactNumbers,completeCourseData};
  if(typeof module!=='undefined')module.exports={link,compose,parseText,serviceError,contactLine,whatsappMessage,compressFlyer,phoneCandidates,contactNumbers,completeCourseData};
})(typeof window==='undefined'?globalThis:window);
