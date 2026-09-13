/* Extensión del portal. El servidor valida cada operación y el permiso de publicación. */
(function(){
  'use strict';
  const el=id=>document.getElementById('marketing-'+id);
  const keys=['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje'];
  let id=null,imageURL='',busy=false,dirty=false,saved=false,locked=false,extraction=null,config={ia:false,facebook:false,puede_publicar:false},available=false;
  function status(text,error=false){el('status').textContent=text;el('status').dataset.error=String(error);if(busy)el('loading-text').textContent=text}
  function step(n){document.querySelectorAll('.marketing-steps li').forEach((li,i)=>{if(i===n-1)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current')})}
  function data(){return Object.fromEntries(keys.map(k=>[k,el(k).value.trim()]))}
  function sync(){
    el('loading').hidden=!busy;
    el('file').disabled=busy;
    ['mode-image','mode-text','source-text','organize'].forEach(k=>el(k).disabled=busy||locked);
    el('analyze').disabled=busy||!id||(!config.ia&&!extraction)||locked;
    el('analyze').textContent=extraction?'Generar copy con lectura guardada':'Analizar flyer y generar copy';
    el('generate').disabled=busy||locked;
    el('save').disabled=busy||!id||!el('copy').value.trim()||locked;
    el('publish').disabled=busy||!id||!el('copy').value.trim()||!el('checked').checked||!config.facebook||!config.puede_publicar||locked;
    el('copy-button').disabled=busy||!el('copy').value.trim();
    el('new').disabled=busy;
    el('retry').disabled=busy;
    ['tab-prepare','back-prepare','back-data','return-review'].forEach(k=>el(k).disabled=busy);
    ['tab-publish','to-publish'].forEach(k=>el(k).disabled=busy||!el('copy').value.trim()||locked);
    el('tab-review').disabled=busy||!el('copy').value.trim();
    keys.forEach(k=>el(k).disabled=busy||locked);
    el('copy').disabled=busy||locked;el('checked').disabled=busy||locked;
    document.querySelectorAll('[data-marketing-draft]').forEach(b=>b.disabled=busy);
    el('editor').setAttribute('aria-busy',String(busy));
  }
  function changed(){dirty=true;saved=false;el('checked').checked=false;sync()}
  function showPanel(panel){
    el('prepare-panel').hidden=panel!=='prepare';el('data-panel').hidden=panel!=='data';el('review').hidden=panel!=='review';
    el('publish-panel').hidden=panel!=='publish';
    ['prepare','review','publish'].forEach(key=>{if(key===(panel==='data'?'review':panel))el('tab-'+key).setAttribute('aria-current','step');else el('tab-'+key).removeAttribute('aria-current')});
    step(panel==='prepare'?1:panel==='publish'?3:2);
  }
  function selectMethod(manual){
    el('mode-text').checked=manual;el('mode-image').checked=!manual;
    el('text-method').hidden=!manual;el('image-method').hidden=manual;
  }
  async function call(accion,values={}){
    const {data:result,error}=await db.functions.invoke('marketing-publicaciones',{body:{accion,...values}});
    if(error){let detail;try{detail=await error.context?.json()}catch{}throw new Error(KJAMarketing.serviceError(error,detail))}
    if(result?.error)throw new Error(result.error);
    return result;
  }
  async function run(task){if(busy)return;busy=true;el('loading-text').textContent='Procesando…';sync();try{await task()}catch(error){status(error.message,true)}finally{busy=false;sync()}}
  async function readFlyer(){
    status(extraction?'Recuperando los datos guardados…':'Leyendo la información del flyer…');
    const result=extraction?{datos:extraction,cache:true}:await call('analizar',{id});extraction=result.datos;
    keys.forEach(k=>el(k).value=result.datos[k]||'');changed();el('copy').value='';el('review').hidden=true;
    generateCopy();
    status(result.cache?'Copy generado con la lectura guardada, sin consumir otra lectura. Revisa el texto y el WhatsApp.':'Copy generado. Revisa el texto y el WhatsApp antes de publicar.');
  }
  function setImage(url){if(imageURL.startsWith('blob:'))URL.revokeObjectURL(imageURL);imageURL=url;el('image').src=url;el('image').hidden=!url}
  function reset(){id=null;locked=false;dirty=false;saved=false;extraction=null;keys.forEach(k=>el(k).value='');el('source-text').value='';el('copy').value='';el('checked').checked=false;el('review').hidden=true;el('post').hidden=true;el('post').removeAttribute('href');el('link').removeAttribute('href');el('file').value='';el('extra').open=false;setImage('');step(1);showPanel('prepare');sync()}
  async function history(){
    const result=await call('listar');el('history').replaceChildren();
    if(!result.items.length){const item=document.createElement('li');item.textContent='Tus borradores aparecerán aquí.';el('history').append(item)}
    for(const row of result.items){
      const item=document.createElement('li'),button=document.createElement('button'),label=document.createElement('span'),meta=document.createElement('small');
      button.type='button';button.dataset.marketingDraft=row.id;label.textContent=row.datos.titulo||row.extraccion?.titulo||'Flyer sin título';
      meta.textContent=({borrador:'Borrador',publicando:'Enviando · verificar en Facebook',publicado:'Publicado',verificar:'Pendiente de verificar en Facebook'}[row.estado]||row.estado)+' · '+new Date(row.creado_at).toLocaleDateString('es-PE');
      button.append(label,meta);item.append(button);el('history').append(item);
      button.onclick=()=>{if(dirty&&!confirm('Hay cambios sin guardar. ¿Quieres descartarlos y abrir otro borrador?'))return;run(async()=>{
        const result=await call('cargar',{id:row.id});reset();id=row.id;const d=result.borrador;
        extraction=d.extraccion||null;
        const stored=Object.keys(d.datos||{}).length?d.datos:(extraction||{});
        keys.forEach(k=>el(k).value=stored[k]||'');el('copy').value=d.copy;locked=d.estado!=='borrador';saved=!!d.copy;setImage(result.imagen);el('review').hidden=!d.copy;
        if(d.copy)showPanel(locked?'publish':'review');else if(stored.titulo)generateCopy();else showPanel('prepare');
        if(d.enlace){el('link').href=d.enlace;el('link').textContent='Probar chat de WhatsApp'}
        if(d.estado==='publicado'&&d.facebook_id){el('post').href='https://www.facebook.com/'+encodeURIComponent(d.facebook_id);el('post').hidden=false}
        status(locked?'Estado: '+meta.textContent+'. Este registro está protegido contra nuevos envíos.':'Borrador recuperado. Revisa el copy antes de publicar.');
        el('destination').textContent='WhatsApp de ventas: '+el('telefono').value;
      })};
    }
  }
  async function open(){
    if(!available)return;
    paintShell('marketing');closeMenu();
    await run(async()=>{
      el('connection').textContent='Comprobando conexiones…';el('retry').hidden=true;
      try{
        config=await call('estado');el('connection').textContent=(config.ia?'Clave de Gemini configurada; se validará al analizar.':'Gemini pendiente de configuración; puedes usar texto manual.')+' '+(config.facebook?'Destino: '+config.pagina+'.':'Facebook pendiente de conexión.')+(config.puede_publicar?'':' Sin permiso para publicar.');
      }catch(error){config={ia:false,facebook:false,puede_publicar:false};el('connection').textContent='Conexión no disponible. Puedes preparar el texto; guardar requiere restablecer el servicio.';el('retry').hidden=false;throw error}
      try{await history()}catch(error){el('retry').hidden=false;throw error}
      status('Sube un flyer para comenzar o retoma uno de tus borradores.');
    });
  }
  window.KJAMarketingPortal={
    async init(){
      const {data:permission,error}=await db.rpc('marketing_permiso');
      available=!error&&!!permission?.acceso;
      document.getElementById('nav-marketing').hidden=!available;
    },open
  };
  document.getElementById('nav-marketing').onclick=open;
  el('retry').onclick=open;
  el('tab-prepare').onclick=()=>showPanel('prepare');
  el('back-prepare').onclick=el('return-review').onclick=()=>showPanel(el('copy').value.trim()?'review':'prepare');
  el('back-data').onclick=()=>showPanel('data');
  el('tab-publish').onclick=el('to-publish').onclick=()=>{if(el('copy').value.trim()){showPanel('publish');if(!id)status('Adjunta el flyer para guardar y publicar este post con imagen.',true)}};
  el('tab-review').onclick=()=>{if(el('copy').value.trim())showPanel('review')};
  el('mode-image').onchange=()=>selectMethod(false);
  el('mode-text').onchange=()=>selectMethod(true);
  el('source-text').oninput=()=>{dirty=true};
  el('organize').onclick=()=>{
    if(busy||locked)return;
    try{
      const parsed=KJAMarketing.parseText(el('source-text').value);
      if(keys.some(k=>el(k).value)&&!confirm('Organizar el texto reemplazará los campos actuales. ¿Continuar?'))return;
      keys.forEach(k=>el(k).value=parsed[k]||'');el('copy').value='';el('review').hidden=true;changed();step(2);
      generateCopy();
      status('Copy generado sin consumir Gemini. Revisa el texto; los datos ausentes se omiten.');
    }catch(error){status(error.message,true)}
  };
  el('new').onclick=()=>{if(dirty&&!confirm('¿Descartar los cambios sin guardar y comenzar otra publicación?'))return;reset();status('Selecciona el flyer de la nueva publicación.')};
  el('file').onchange=()=>{
    const file=el('file').files[0];if(!file)return;
    if(id&&dirty&&!confirm('El nuevo flyer reemplazará los cambios sin guardar. ¿Continuar?')){el('file').value='';return}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880){status('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.',true);el('file').value='';return}
    run(async()=>{
      status('Guardando el flyer…');
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(file)});
      const carry=!id?{datos:data(),source:el('source-text').value,dirty}:null;
      const created=await call('crear',{imagen:base64});reset();id=created.id;setImage(URL.createObjectURL(file));
      if(carry){keys.forEach(k=>el(k).value=carry.datos[k]);el('source-text').value=carry.source;dirty=carry.dirty}
      if(carry?.datos.titulo)generateCopy();
      status('Flyer guardado. Elige analizar la imagen o pegar el texto. La carga no consume lecturas de Gemini.');await history();
    });
  };
  el('analyze').onclick=()=>{
    if(keys.some(k=>el(k).value)&&!confirm(extraction?'Recuperar los datos originales reemplazará tus campos actuales, sin consumir otra lectura. ¿Continuar?':'La lectura reemplazará los campos actuales. ¿Continuar?'))return;
    run(readFlyer);
  };
  keys.forEach(k=>el(k).addEventListener('input',()=>{changed();if(!el('review').hidden)status('Los datos cambiaron. Vuelve a generar el copy y revísalo antes de guardar.')}));
  el('copy').oninput=changed;
  function generateCopy(){
      const d=data();
      if(!d.titulo){showPanel('data');throw new Error('No se encontró el nombre del curso. Corrige solo ese dato para generar el copy.')}
      if(!d.telefono){d.telefono='51988918238';el('telefono').value=d.telefono}
      if(!d.mensaje){d.mensaje='Hola, vi la publicación de '+d.titulo+'. Quisiera información sobre el precio, las fechas y la inscripción.';el('mensaje').value=d.mensaje}
      try{KJAMarketing.link(d.telefono,d.mensaje)}catch(error){showPanel('data');throw error}
      const link=KJAMarketing.link(d.telefono,d.mensaje);el('copy').value=KJAMarketing.compose(d,link);el('link').href=link;el('link').textContent='Probar chat de WhatsApp';el('review').hidden=false;changed();step(3);status('Borrador generado. Puedes editar el copy y probar el enlace antes de guardarlo.');el('copy').focus();
      showPanel('review');el('copy').focus();el('destination').textContent='WhatsApp de ventas: '+d.telefono+' · Puedes cambiarlo en Corregir información.';
  }
  el('generate').onclick=()=>{try{generateCopy()}catch(error){status(error.message,true)}};
  el('save').onclick=()=>run(async()=>{
    const d=data(),link=KJAMarketing.link(d.telefono,d.mensaje);
    if(!el('copy').value.includes(link))throw new Error('El enlace cambió. Vuelve a generar el copy antes de guardarlo.');
    await call('guardar',{id,datos:d,copy:el('copy').value});dirty=false;saved=true;el('link').href=link;el('link').textContent='Probar chat de WhatsApp';el('checked').checked=false;status('Borrador guardado. Revisa el flyer, el copy y el destino de WhatsApp para habilitar la publicación.');await history();
  });
  el('checked').onchange=sync;
  el('publish').onclick=()=>run(async()=>{
    if(!id||!el('checked').checked||!config.facebook||!config.puede_publicar||locked)return;
    const d=data(),link=KJAMarketing.link(d.telefono,d.mensaje);
    if(!el('copy').value.includes(link))throw new Error('El enlace cambió. Actualiza el copy antes de publicar.');
    await call('guardar',{id,datos:d,copy:el('copy').value});dirty=false;saved=true;
    status('Publicando en '+config.pagina+'…');
    // Bloquear localmente incluso ante una respuesta perdida; al recargar se consulta el estado real.
    locked=true;
    const result=await call('publicar',{id,revisado:true,copy:el('copy').value});
    step(3);status('Publicación confirmada por Facebook.');dirty=false;
    el('post').href='https://www.facebook.com/'+encodeURIComponent(result.facebook_id);el('post').hidden=false;await history();
  });
  el('copy-button').onclick=()=>run(async()=>{await navigator.clipboard.writeText(el('copy').value);status('Copy copiado. Puedes pegarlo junto con el flyer en Facebook.')});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){reset();available=false;config={ia:false,facebook:false,puede_publicar:false};el('history').replaceChildren();document.getElementById('nav-marketing').hidden=true;}});
  if(typeof APP!=='undefined'&&APP.inicio)void window.KJAMarketingPortal.init();
  selectMethod(false);
  showPanel('prepare');
  sync();
})();
