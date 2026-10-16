/* Extensión del portal. El servidor valida cada operación y el permiso de publicación. */
(function(){
  'use strict';
  // Pausa temporal de Publicaciones. Cambiar a true para volver a habilitarla.
  const PUBLICACIONES_HABILITADAS=true;
  const el=id=>document.getElementById('marketing-'+id);
  const keys=['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje','facebook_url'];
  const optionKeys=['certificado','material','peru','vacantes'];
  let id=null,imageURL='',busy=false,dirty=false,saved=false,locked=false,extraction=null,config={ia:false,facebook:false,puede_publicar:false},available=false;
  let shortLink='',shortFor='',automaticMessage='';
  let deletion=null,deleting=false;
  let historyRows=[],historyFilter='all',historyOffset=0,historyMore=false;
  const draftCache=new Map();
  let historyGeneration=0,splashUpdate=null;
  let analysisProgress=false;
  let quotaTimerInterval=null;
  function formatTimeRemaining(isoDate){
    if(!isoDate)return 'Cuota completa (24h)';
    const target=new Date(isoDate).getTime();
    if(Number.isNaN(target))return 'Cuota completa (24h)';
    const diff=target-Date.now();
    if(diff<=0)return 'Renovando ahora…';
    const totalMinutes=Math.ceil(diff/60000);
    const hours=Math.floor(totalMinutes/60);
    const minutes=totalMinutes%60;
    if(hours>0){
      return '1ª renueva en '+hours+'h '+(minutes<10?'0':'')+minutes+'m';
    }
    return '1ª renueva en '+minutes+' min';
  }
  function renderQuota(cuota){
    const widget=el('quota-widget');
    if(!widget)return;
    const q=cuota||config?.cuota||{usadas:0,limite:200,disponibles:200,proxima_renovacion:null};
    const limite=Number(q.limite)||200;
    const usadas=Math.max(0,Number(q.usadas)||0);
    const disponibles=Math.max(0,q.disponibles!=null?Number(q.disponibles):(limite-usadas));
    const usedEl=el('quota-used');
    const totalEl=el('quota-total');
    const remEl=el('quota-remaining');
    const pillEl=el('quota-pill');
    const barEl=el('quota-bar');
    const timerEl=el('quota-timer');
    if(usedEl)usedEl.textContent=String(usadas);
    if(totalEl)totalEl.textContent=String(limite);
    if(remEl)remEl.textContent=String(disponibles);
    const pct=Math.min(100,Math.max(0,Math.round((usadas/limite)*100)));
    const level=disponibles<=0?'exhausted':disponibles<20?'low':disponibles<50?'warn':'normal';
    if(barEl){
      if(barEl.style)barEl.style.width=pct+'%';
      barEl.dataset.level=level;
    }
    if(pillEl){
      pillEl.dataset.level=level;
    }
    const updateTimer=()=>{
      if(!timerEl)return;
      if(usadas===0||!q.proxima_renovacion){
        timerEl.textContent='Cuota completa (24h)';
        return;
      }
      const text=formatTimeRemaining(q.proxima_renovacion);
      timerEl.textContent=disponibles<=0?'Límite · '+text:text;
    };
    updateTimer();
    if(quotaTimerInterval){clearInterval(quotaTimerInterval);quotaTimerInterval=null;}
    if(q.proxima_renovacion&&typeof setInterval==='function'){
      quotaTimerInterval=setInterval(updateTimer,30000);
    }
  }
  function progress(value){
    el('progress-bar').value=value;
    el('progress-value').textContent=value+'%';
  }
  function askConfirm(message,{title='¿Estás seguro?',confirmText='Continuar',cancelText='Cancelar',danger=false,type='warning'}={}){
    if(typeof HTMLDialogElement!=='function'){
      return Promise.resolve(Boolean(confirm(message)));
    }
    const dialog=el('confirm-dialog');
    if(!dialog||typeof dialog.showModal!=='function')return Promise.resolve(confirm(message));
    return new Promise(resolve=>{
      const titleEl=el('confirm-title'),msgEl=el('confirm-message'),cancelBtn=el('confirm-cancel'),acceptBtn=el('confirm-accept'),iconWrap=el('confirm-icon');
      if(titleEl)titleEl.textContent=title;
      if(msgEl)msgEl.textContent=message;
      if(cancelBtn)cancelBtn.textContent=cancelText;
      if(acceptBtn){acceptBtn.textContent=confirmText;acceptBtn.className='marketing-btn primary'+(danger?' danger':'');}
      if(iconWrap)iconWrap.dataset.type=danger?'danger':type;
      let settled=false;
      const cleanup=result=>{
        if(settled)return;settled=true;
        dialog.removeEventListener('close',onClose);
        cancelBtn?.removeEventListener('click',onCancel);
        acceptBtn?.removeEventListener('click',onAccept);
        dialog.removeEventListener('click',onBackdrop);
        if(dialog.open)dialog.close();
        resolve(result);
      };
      const onAccept=()=>cleanup(true);
      const onCancel=()=>cleanup(false);
      const onClose=()=>cleanup(false);
      const onBackdrop=e=>{if(e.target===dialog)cleanup(false);};
      acceptBtn?.addEventListener('click',onAccept,{once:true});
      cancelBtn?.addEventListener('click',onCancel,{once:true});
      dialog.addEventListener('close',onClose,{once:true});
      dialog.addEventListener('click',onBackdrop);
      dialog.showModal();
      cancelBtn?.focus();
    });
  }
  function withConfirm(condition,message,options,action){
    if(!condition)return action();
    if(typeof HTMLDialogElement!=='function'){
      if(confirm(message))return action();
      return;
    }
    const dialog=el('confirm-dialog');
    if(!dialog||typeof dialog.showModal!=='function'){
      if(confirm(message))return action();
      return;
    }
    askConfirm(message,options).then(ok=>{if(ok)action()});
  }
  const missingFlyer='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#e4eaf3"/><g fill="none" stroke="#526277" stroke-width="2"><rect x="16" y="13" width="32" height="38" rx="3"/><circle cx="25" cy="24" r="3"/><path d="m17 42 10-11 8 8 5-5 8 9"/></g></svg>');
  const signature=d=>KJAMarketing.phoneCandidates(d.telefono)[0]+'\n'+d.mensaje.trim();
  const chosenLink=d=>shortLink&&shortFor===signature(d)?shortLink:KJAMarketing.link(d.telefono,d.mensaje);
  function applyLink(d,next){
    const old=el('link').href;let copy=el('copy').value;
    if(old)copy=copy.split(old).join(next);
    if(copy)copy=copy.replace(/https:\/\/wa\.me\/[^\s<)]+/g,next);
    const line=KJAMarketing.contactLine(d,next);
    if(/^📲 (?:Inscríbete directamente aquí|Contáctanos al WhatsApp):.*$/m.test(copy))copy=copy.replace(/^📲 (?:Inscríbete directamente aquí|Contáctanos al WhatsApp):.*$/m,line);
    else if(/^📩 Solicita información aquí:.*$/m.test(copy))copy=copy.replace(/^📩 Solicita información aquí:.*$/m,line);
    else if(!copy.includes(next))copy+='\n\n'+line;
    el('copy').value=copy;el('link').href=next;el('short-url').value=next;changed();
  }
  async function shorten(){
    if(!id)return;
    const d=data();KJAMarketing.link(d.telefono,d.mensaje);
    if(shortLink&&shortFor===signature(d)){applyLink(d,shortLink);return;}
    const result=await call('enlace',{id,telefono:KJAMarketing.phoneCandidates(d.telefono)[0],mensaje:d.mensaje});
    if(!/^https:\/\/www\.kjadmb\.com\/w\.html\?k=[A-Za-z0-9_-]{16}$/.test(result?.enlace||''))throw new Error('No se recibió un enlace corto válido.');
    shortLink=result.enlace;shortFor=signature(d);applyLink(d,shortLink);
  }
  let errorDismissTimer=null;
  function status(text,error=false){
    if(errorDismissTimer){clearTimeout(errorDismissTimer);errorDismissTimer=null}
    const statusEl=el('status');
    statusEl.textContent=text;
    statusEl.dataset.error=String(error);
    if(error&&typeof document.createElement==='function'&&statusEl.append){
      try{
        const btn=document.createElement('button');
        btn.type='button';btn.className='marketing-status-dismiss';btn.setAttribute('aria-label','Cerrar mensaje de error');
        btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
        btn.onclick=()=>{
          statusEl.dataset.error='false';
          status(id?'Continúa editando tu publicación.':'Selecciona un flyer para comenzar.');
        };
        statusEl.append(btn);
        if(typeof setTimeout==='function'){
          errorDismissTimer=setTimeout(()=>{
            if(statusEl.dataset.error==='true'){
              statusEl.dataset.error='false';
              status(id?'Continúa editando tu publicación.':'Selecciona un flyer para comenzar.');
            }
          },15000);
        }
      }catch{}
    }
    if(busy){el('loading-text').textContent=text;if(splashUpdate&&text.endsWith('…'))splashUpdate(text)}
  }
  function showToast(title,message='',type='info',duration=4000){
    if(typeof document==='undefined'||!document.body)return;
    let container=document.body.querySelector?document.body.querySelector('.marketing-toast-container'):null;
    if(!container){
      container=document.createElement('div');
      container.className='marketing-toast-container';
      document.body.append(container);
    }
    const toast=document.createElement('div');
    toast.className='marketing-toast';
    toast.dataset.type=type;
    const icons={
      success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
      warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    toast.innerHTML=`<div class="marketing-toast-icon">${icons[type]||icons.info}</div><div class="marketing-toast-body"><div class="marketing-toast-title">${title}</div>${message?`<div class="marketing-toast-message">${message}</div>`:''}</div><button type="button" class="marketing-toast-close" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    const dismiss=()=>{
      if(toast.classList?.contains('dismissing'))return;
      toast.classList?.add('dismissing');
      setTimeout(()=>toast.remove?.(),260);
    };
    const closeBtn=toast.querySelector?.('.marketing-toast-close');
    if(closeBtn)closeBtn.onclick=dismiss;
    container.append(toast);
    if(duration>0&&typeof setTimeout==='function')setTimeout(dismiss,duration);
  }
  let previewActive=false;
  function updateFbPreview(){
    const copy=el('copy')?.value||'';
    const renderEl=document.getElementById('marketing-fb-copy-render');
    if(renderEl){
      const div=document.createElement('div');
      div.textContent=copy;
      let text=div.innerHTML||div.textContent||'';
      text=text.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      text=text.replace(/(^|\s)(#[a-zA-Z0-9_\u00C0-\u017F]+)/g,'$1<span class="fb-hashtag">$2</span>');
      renderEl.innerHTML=text;
    }
    const authorEl=document.getElementById('marketing-fb-author');
    if(authorEl)authorEl.textContent=config.pagina||'KJA Bienestar';
    const mediaEl=document.getElementById('marketing-fb-media');
    const imgEl=document.getElementById('marketing-fb-flyer-img');
    if(mediaEl&&imgEl){
      if(imageURL){
        imgEl.src=imageURL;
        mediaEl.hidden=false;
      }else{
        mediaEl.hidden=true;
      }
    }
  }
  function setPreviewMode(preview){
    previewActive=preview;
    const copyTextarea=el('copy');
    const previewCard=document.getElementById('marketing-fb-preview');
    const editBtn=document.getElementById('marketing-mode-edit');
    const previewBtn=document.getElementById('marketing-mode-preview');
    if(!copyTextarea||!previewCard)return;
    if(preview){
      updateFbPreview();
      copyTextarea.hidden=true;
      previewCard.hidden=false;
      if(editBtn){editBtn.classList?.remove('active');editBtn.setAttribute('aria-selected','false');}
      if(previewBtn){previewBtn.classList?.add('active');previewBtn.setAttribute('aria-selected','true');}
    }else{
      copyTextarea.hidden=false;
      previewCard.hidden=true;
      if(editBtn){editBtn.classList?.add('active');editBtn.setAttribute('aria-selected','true');}
      if(previewBtn){previewBtn.classList?.remove('active');previewBtn.setAttribute('aria-selected','false');}
    }
  }
  function step(n){document.querySelectorAll('.marketing-steps li').forEach((li,i)=>{if(i===n-1)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current')})}
  function data(){return {...Object.fromEntries(keys.map(k=>[k,el(k).value.trim()])),opciones:Object.fromEntries(optionKeys.map(k=>[k,el('option-'+k).checked]))}}
  function restoreOptions(options={}){optionKeys.forEach(k=>el('option-'+k).checked=options[k]===true)}
  function syncWhatsApp(){el('whatsapp-phone').value=el('telefono').value;el('whatsapp-message').value=el('mensaje').value}
  function sync(){
    renderPhoneChoices();
    el('loading').hidden=!busy||(!analysisProgress&&typeof withActionLoader==='function');
    el('file').disabled=busy;
    ['mode-image','mode-text','source-text','organize'].forEach(k=>el(k).disabled=busy||locked);
    el('analyze').disabled=busy||!id||(!config.ia&&!extraction)||locked;
    el('analyze').textContent=extraction?'Generar copy con lectura guardada':'Analizar flyer y generar copy';
    el('generate').disabled=busy||locked;
    el('refresh-all').disabled=busy||locked||!id;
    el('refresh-all').textContent=busy?'Actualizando…':'Actualizar texto y enlace';
    el('save').disabled=busy||!id||!el('copy').value.trim()||locked;
    if(el('save-later'))el('save-later').disabled=busy||!id||locked;
    el('publish').disabled=busy||!id||!el('copy').value.trim()||!el('checked').checked||!config.facebook||!config.puede_publicar||locked;
    el('copy-button').disabled=busy||!el('copy').value.trim();
    el('copy-ready').disabled=busy||!el('copy').value.trim();
    el('download').disabled=busy||!imageURL;
    ['whatsapp-phone','whatsapp-message','update-link','apply-template','regenerate-message','refine-submit','refine-prompt'].forEach(k=>{const node=el(k);if(node)node.disabled=busy||locked||(k.startsWith('refine')&&!id);});
    optionKeys.forEach(k=>el('option-'+k).disabled=busy||locked);
    el('facebook-status').textContent=config.facebook?(config.puede_publicar?'Puedes publicar un post nuevo en '+config.pagina+'.':'Tu cuenta puede preparar el texto, pero no publicar directamente.'):'La publicación directa está pendiente de conectar Facebook. Puedes copiar el texto y descargar el flyer para actualizarlo en Facebook.';
    el('new').disabled=busy;
    el('retry').disabled=busy;
    ['tab-prepare','back-prepare','back-data','return-review'].forEach(k=>el(k).disabled=busy);
    ['tab-publish','to-publish'].forEach(k=>el(k).disabled=busy||!el('copy').value.trim());
    el('tab-review').disabled=busy||!el('copy').value.trim();
    keys.forEach(k=>el(k).disabled=busy||locked);
    el('copy').disabled=busy||locked;el('checked').disabled=busy||locked;
    document.querySelectorAll('[data-marketing-draft]').forEach(b=>b.disabled=busy);
    document.querySelectorAll('.marketing-history-delete').forEach(button=>{
      button.disabled=busy||button.dataset.deletable!=='true';
      button.title=button.dataset.deletable!=='true'?'Verifica primero el envío a Facebook':busy?'Espera a que termine la operación':'Eliminar del portal';
    });
    el('editor').setAttribute('aria-busy',String(busy));
    el('history-more').disabled=busy;
    el('copy-count').textContent=el('copy').value.length.toLocaleString('es-PE')+' caracteres';
    el('save-state').textContent=locked?'Registro protegido':dirty?'Cambios sin guardar':saved?'Guardado':'Borrador';
    document.querySelectorAll('[data-marketing-draft]').forEach(b=>{const active=b.dataset.marketingDraft===id;b.setAttribute('aria-current',String(active));if(b.parentElement)b.parentElement.dataset.active=String(active);});
  }
  function changed(){dirty=true;saved=false;el('checked').checked=false;el('copy-button').textContent='Copiar texto';el('copy-ready').textContent='Copiar texto para Facebook';if(previewActive)updateFbPreview();sync()}
  function renderPhoneChoices(){
    const container=el('phone-choices');if(!container)return;
    const candidates=[...new Set([...KJAMarketing.contactNumbers(el('telefono').value),...KJAMarketing.contactNumbers(extraction?.telefono)])];
    container.replaceChildren();container.hidden=candidates.length<2;
    if(container.hidden)return;
    const label=document.createElement('p');label.textContent=candidates.some(number=>number.startsWith('0'))?'Puedes conservar ambos contactos. El número con código de país abrirá WhatsApp; el teléfono local aparecerá solo en el texto.':'Puedes mostrar ambos teléfonos. El primero será el destino del enlace de WhatsApp:';container.append(label);
    candidates.forEach(number=>{
      if(number.startsWith('0'))return;
      const button=document.createElement('button');button.type='button';button.className='marketing-secondary';
      button.textContent='Solo +'+number;button.disabled=busy||locked;
      button.onclick=()=>{el('telefono').value=number;syncWhatsApp();changed();status('WhatsApp seleccionado. Pulsa Actualizar copy para continuar.');el('telefono').focus()};
      container.append(button);
      if(candidates.length===2){
        const both=document.createElement('button');both.type='button';both.disabled=busy||locked;
        both.textContent='Ambos · enlace a +'+number;
        both.onclick=()=>{el('telefono').value=[number,...candidates.filter(n=>n!==number)].join(' / ');syncWhatsApp();changed();status('Ambos teléfonos seleccionados. Pulsa Actualizar copy para incorporarlos.');el('telefono').focus()};
        container.append(both);
      }
    });
  }
  function showPanel(panel){
    if(panel==='publish'){
      el('publish-copy').textContent=el('copy').value;
      el('publish-image').hidden=!imageURL;
      if(imageURL)el('publish-image').src=imageURL;else el('publish-image').removeAttribute('src');
    }
    if(panel!=='review')setPreviewMode(false);
    if(el('draft-actions'))el('draft-actions').hidden=panel==='review';
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
    if(['guardar','guardar_borrador','eliminar'].includes(accion))window.KJAMarketingTeam?.refresh();
    return result;
  }
  async function run(task,withProgress=false){
    if(busy)return;busy=true;analysisProgress=task===readFlyer||withProgress;
    el('progress').hidden=!analysisProgress;progress(5);
    el('loading-text').textContent='Cargando publicación…';sync();
    const execute=async update=>{splashUpdate=update||null;await task()};
    try{if(!analysisProgress&&typeof withActionLoader==='function')await withActionLoader('Cargando publicación…',execute);else await execute()}
    catch(error){status(error.message,true)}finally{splashUpdate=null;busy=false;analysisProgress=false;sync()}
  }
  async function readFlyer(){
    progress(10);
    const hintEl=el('progress-hint');
    if(hintEl)hintEl.textContent='Conservamos tu flyer. Espera sin recargar mientras preparamos el contenido.';
    status(extraction?'Recuperando los datos guardados…':'Leyendo la información del flyer…');
    let estimate=10;
    const timer=typeof setInterval==='function'?setInterval(()=>{
      estimate=Math.min(80,estimate+Math.max(1,Math.round((80-estimate)/12)));progress(estimate);
      if(estimate>=70)el('loading-text').textContent='Gemini sigue procesando el flyer. Espera sin recargar…';
    },1000):null;
    let result;
    try{result=extraction?{datos:extraction,cache:true}:await call('analizar',{id})}
    finally{if(timer!==null)clearInterval(timer)}
    extraction=result.datos;progress(85);status('Preparando el texto de tu publicación…');
    keys.forEach(k=>el(k).value=result.datos[k]||'');changed();el('copy').value='';el('review').hidden=true;
    generateCopy();progress(92);status('Preparando el enlace de WhatsApp…');await shorten();
    progress(100);el('loading-text').textContent='Texto y enlace listos';
    if(typeof setTimeout==='function')await new Promise(resolve=>setTimeout(resolve,350));
    status(result.cache?'Copy generado con la lectura guardada, sin consumir otra lectura. Revisa el texto y el WhatsApp.':'Copy generado. Revisa el texto y el WhatsApp antes de publicar.');
    showToast('Contenido listo',result.cache?'Copy generado con lectura previa':'Datos extraídos y copy preparado','info');
    if(!result.cache&&config?.cuota){
      config.cuota.usadas=Math.min(config.cuota.limite||200,(config.cuota.usadas||0)+1);
      config.cuota.disponibles=Math.max(0,(config.cuota.limite||200)-config.cuota.usadas);
      if(!config.cuota.proxima_renovacion){
        config.cuota.proxima_renovacion=new Date(Date.now()+86400000).toISOString();
      }
      renderQuota(config.cuota);
    }
  }
  function setImage(url){
    url=url||'';if(imageURL.startsWith('blob:'))URL.revokeObjectURL(imageURL);imageURL=url;
    ['image','preview-image'].forEach(key=>{if(url)el(key).src=url;else el(key).removeAttribute('src');el(key).hidden=!url});
    el('preview').hidden=!url;
    if(url)el('preview-link').href=url;else el('preview-link').removeAttribute('href');
    el('file-label').textContent=url?'Cambiar flyer':'Sube el flyer de tu campaña';
    if(previewActive)updateFbPreview();
  }
  function reset(){setPreviewMode(false);el('short-url').value='';id=null;shortLink='';shortFor='';automaticMessage='';locked=false;dirty=false;saved=false;extraction=null;keys.forEach(k=>el(k).value='');restoreOptions();syncWhatsApp();el('source-text').value='';el('copy').value='';el('checked').checked=false;el('review').hidden=true;el('post').hidden=true;el('post').removeAttribute('href');el('link').removeAttribute('href');el('file').value='';el('extra').open=false;setImage('');step(1);showPanel('prepare');sync()}
  const stateLabel=row=>({borrador:row.copy?'Texto preparado':'Por preparar',publicando:'Verificar envío',publicado:'Publicado',verificar:'Por verificar'}[row.estado]||'Borrador');
  function renderHistory(){
    const query=el('search').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const rows=historyRows.filter(row=>{
      const title=(row.datos?.titulo||row.extraccion?.titulo||'Flyer sin título').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      return title.includes(query)&&(historyFilter==='all'||(historyFilter==='drafts'?row.estado==='borrador':row.estado==='publicado'));
    });
    el('history').replaceChildren();
    el('history-summary').textContent=rows.length+' '+(rows.length===1?'publicación':'publicaciones')+(query||historyFilter!=='all'?' en esta vista':' disponibles')+(historyMore?' · Hay anteriores por cargar':'');
    el('history-more').hidden=!historyMore;
    if(!rows.length){const empty=document.createElement('li');empty.className='marketing-empty';empty.textContent=historyRows.length?'No hay coincidencias. Prueba otro nombre o filtro.':'Tu próxima campaña empieza aquí. Crea una publicación y quedará guardada en este historial.';el('history').append(empty)}
    rows.forEach(row=>{
      const item=document.createElement('li'),button=document.createElement('button'),thumb=document.createElement('img'),title=document.createElement('span'),badge=document.createElement('span'),date=document.createElement('small');
      button.type='button';button.dataset.marketingDraft=row.id;button.setAttribute('aria-current',String(row.id===id));button.disabled=busy;item.dataset.active=String(row.id===id);
      title.className='marketing-history-title';title.textContent=row.datos?.titulo||row.extraccion?.titulo||'Flyer sin título';
      title.title=title.textContent;
      thumb.className='marketing-history-thumb';thumb.src=row.imagen||missingFlyer;thumb.alt=row.imagen?'':'Flyer pendiente de cargar';thumb.loading='lazy';thumb.onerror=()=>{thumb.onerror=null;thumb.src=missingFlyer;thumb.alt='Flyer no disponible';};
      badge.className='marketing-badge';badge.dataset.state=row.estado;badge.textContent=stateLabel(row);
      date.textContent=row.creado_at?new Date(row.creado_at).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Lima'}):'Sin fecha';
      button.append(thumb,title,badge,date);item.append(button);el('history').append(item);
      button.onclick=()=>openDraft(row);
      const trash=document.createElement('button');trash.type='button';trash.className='marketing-history-delete';
      trash.setAttribute('aria-label','Eliminar '+title.textContent);trash.title='Eliminar del portal';
      trash.dataset.deletable=String(['borrador','publicado'].includes(row.estado));
      trash.disabled=busy||trash.dataset.deletable!=='true';
      trash.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="marketing-trash-lid" d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="m6 7 .8 12a2 2 0 0 0 2 1.9h6.4a2 2 0 0 0 2-1.9L18 7"/><path d="M10 11v6M14 11v6"/></svg>';
      trash.onclick=()=>requestDeletion(row.id,title.textContent,trash);item.className='marketing-history-entry';item.append(trash);
    });
  }
  async function history(append=false){
    const generation=++historyGeneration;
    const result=await call('listar',{offset:append?historyOffset:0});
    if(generation!==historyGeneration)return;
    if(!append){historyRows=[];historyOffset=0;draftCache.clear()}
    historyOffset+=result.items.length;
    for(const row of result.items){
      const index=historyRows.findIndex(item=>item.id===row.id);if(index<0)historyRows.push(row);else historyRows[index]=row;
      if(typeof row.copy==='string'&&row.imagen)draftCache.set(row.id,{borrador:row,imagen:row.imagen,at:Date.now()});
    }
    historyMore=!!result.has_more;el('history-count').textContent=String(result.total??historyRows.length);renderHistory();
    // Compatible con el servicio anterior: cargar ya devuelve una URL privada firmada.
    // Tres lecturas simultáneas como máximo, sin analizar ni modificar publicaciones.
    const pending=historyRows.filter(row=>!row.imagen);let cursor=0,failed=0;
    const worker=async()=>{
      while(cursor<pending.length&&generation===historyGeneration){
        const row=pending[cursor++];
        try{
          const loaded=await call('cargar',{id:row.id});
          if(generation!==historyGeneration)return;
          if(!loaded.imagen){failed++;continue}
          Object.assign(row,loaded.borrador,{imagen:loaded.imagen});
          draftCache.set(row.id,{...loaded,at:Date.now()});
        }catch{failed++}
      }
    };
    await Promise.all(Array.from({length:Math.min(3,pending.length)},worker));
    if(generation!==historyGeneration)return;
    if(pending.length)renderHistory();
    if(failed){el('history-summary').textContent='Algunos flyers no se pudieron cargar. Reintenta la conexión.';el('retry').hidden=false}
  }
  function openDraft(row){
    if(busy)return;
    return withConfirm(dirty,'Hay cambios sin guardar. ¿Quieres descartarlos y abrir otro borrador?',{title:'¿Abrir otro borrador?',confirmText:'Descartar cambios',cancelText:'Seguir editando',danger:true},()=>{
      return run(async()=>{
        status('Abriendo publicación…');
        const cached=draftCache.get(row.id);
        const result=cached&&row.id!==id&&Date.now()-cached.at<60000?cached:await call('cargar',{id:row.id});
        draftCache.set(row.id,{...result,at:Date.now()});
        reset();id=row.id;const d=result.borrador;
        extraction=d.extraccion||null;
        const stored=Object.keys(d.datos||{}).length?d.datos:(extraction||{});
        keys.forEach(k=>el(k).value=stored[k]||'');el('copy').value=d.copy||'';locked=d.estado!=='borrador';saved=!!d.copy;setImage(result.imagen);
        restoreOptions(stored.opciones);syncWhatsApp();
        if(stored.titulo&&stored.mensaje===KJAMarketing.whatsappMessage(stored.titulo,stored.facebook_url||'',stored))automaticMessage=stored.mensaje;
        if(d.enlace?.startsWith('https://www.kjadmb.com/w.html?k=')){
          shortLink=d.enlace;shortFor=signature(data());
          if(el('copy').value)el('copy').value=el('copy').value.replace(/https:\/\/wa\.me\/[^\s<)]+/g,d.enlace);
        }
        if(d.copy)showPanel(locked?'publish':'review');else if(d.datos?.guardado_parcial)showPanel('data');else if(stored.titulo)generateCopy();else showPanel('prepare');
        if(d.enlace){el('link').href=d.enlace;el('short-url').value=d.enlace;el('link').textContent='Probar WhatsApp ↗'}
        if(d.estado==='publicado'&&d.facebook_id){el('post').href='https://www.facebook.com/'+encodeURIComponent(d.facebook_id);el('post').hidden=false}
        status(locked?'Registro protegido: '+stateLabel(d)+'. Puedes copiar el texto y descargar el flyer.':'Publicación abierta. Continúa donde la dejaste.');
        el('destination').textContent='WhatsApp de ventas: '+el('telefono').value;
      });
    });
  }
  async function open(){
    if(!PUBLICACIONES_HABILITADAS||!available)return;
    window.KJAMarketingTeam?.refresh();
    paintShell('marketing');closeMenu();
    await run(async()=>{
      el('connection').textContent='Comprobando conexiones…';el('retry').hidden=true;
      const results=await Promise.allSettled([call('estado'),history()]);
      if(results[0].status==='fulfilled'){
        config=results[0].value;
        renderQuota(config.cuota);
        el('connection').textContent=(config.ia?'Lectura de flyers disponible.':'Puedes preparar el contenido pegando el texto.')+' '+(config.facebook?'Facebook: '+config.pagina+'.':'Facebook: comparte con Copiar texto y Descargar flyer.');
      }else{
        config={ia:false,facebook:false,puede_publicar:false};renderQuota(null);el('connection').textContent='Conexión no disponible. Puedes preparar el texto manualmente.';el('retry').hidden=false;
      }
      if(results[1].status==='rejected'){el('history-summary').textContent='No se pudo actualizar el historial. Reintenta la conexión.';el('retry').hidden=false;throw results[1].reason}
      if(results[0].status==='rejected')throw results[0].reason;
      status('Sube un flyer para comenzar o retoma uno de tus borradores.');
    });
  }
  window.KJAMarketingPortal={
    async init(){
      if(!PUBLICACIONES_HABILITADAS){available=false;document.getElementById('nav-marketing').hidden=true;return;}
      const {data:permission,error}=await db.rpc('marketing_permiso');
      available=!error&&!!permission?.acceso;
      document.getElementById('nav-marketing').hidden=!available;
      window.KJAMarketingTeam?.init(error?null:permission);
    },open
  };
  document.getElementById('nav-marketing').onclick=open;
  el('retry').onclick=open;
  el('search').oninput=renderHistory;
  ['all','drafts','published'].forEach(filter=>el('filter-'+filter).onclick=()=>{historyFilter=filter;['all','drafts','published'].forEach(key=>el('filter-'+key).setAttribute('aria-pressed',String(key===filter)));renderHistory()});
  el('history-more').onclick=()=>run(()=>history(true));
  el('tab-prepare').onclick=()=>showPanel('prepare');
  el('back-prepare').onclick=el('return-review').onclick=()=>showPanel(el('copy').value.trim()?'review':'prepare');
  el('back-data').onclick=()=>showPanel('data');
  el('tab-publish').onclick=el('to-publish').onclick=()=>{if(el('copy').value.trim()){showPanel('publish');if(!id)status('Adjunta el flyer para guardar y publicar este post con imagen.',true)}};
  el('tab-review').onclick=()=>{if(el('copy').value.trim())showPanel('review')};
  el('mode-image').onchange=()=>selectMethod(false);
  el('mode-text').onchange=()=>selectMethod(true);
  el('source-text').oninput=()=>{dirty=true};
  el('organize').onclick=()=>{
    if(locked)return;
    try{
      const parsed=KJAMarketing.parseText(el('source-text').value);
      withConfirm(keys.some(k=>el(k).value),'Organizar el texto reemplazará los campos actuales. ¿Continuar?',{title:'¿Organizar texto?',confirmText:'Reemplazar campos',cancelText:'Cancelar'},async()=>{
        keys.forEach(k=>el(k).value=parsed[k]||'');el('copy').value='';el('review').hidden=true;changed();step(2);
        generateCopy();await shorten();
        status('Copy generado sin consumir Gemini. Revisa el texto; los datos ausentes se omiten.');
      });
    }catch(error){status(error.message,true)}
  };
  el('new').onclick=()=>withConfirm(dirty,'¿Descartar los cambios sin guardar y comenzar otra publicación?',{title:'¿Descartar cambios actuales?',confirmText:'Descartar y comenzar',cancelText:'Seguir editando',danger:true},()=>{reset();status('Selecciona el flyer de la nueva publicación.')});
  el('file').onchange=()=>{
    const file=el('file').files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880){status('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.',true);el('file').value='';return}
    withConfirm(id&&dirty,'El nuevo flyer reemplazará los cambios sin guardar. ¿Continuar?',{title:'¿Reemplazar flyer?',confirmText:'Reemplazar flyer',cancelText:'Cancelar',danger:true},()=>{
      run(async()=>{
        status('Optimizando el peso del flyer…');
        const optimized=await KJAMarketing.compressFlyer(file);
        const savings=Math.round((1-optimized.size/file.size)*100);
        const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(optimized)});
        const carry=!id?{datos:data(),source:el('source-text').value,copy:el('copy').value,automaticMessage,dirty}:null;
        const created=await call('crear',{imagen:base64});reset();id=created.id;setImage(URL.createObjectURL(optimized));
        if(carry){keys.forEach(k=>el(k).value=carry.datos[k]);restoreOptions(carry.datos.opciones);syncWhatsApp();el('source-text').value=carry.source;dirty=carry.dirty}
        if(carry?.datos.titulo){
          if(carry.copy.trim()){
            el('copy').value=carry.copy;automaticMessage=carry.automaticMessage;
            el('link').href=chosenLink(data());showPanel('review');changed();
          }else generateCopy();
          await shorten();
        }
        status('Flyer guardado ('+Math.ceil(optimized.size/1024)+' KB'+(savings>0?' · '+savings+'% menos peso':' · ya tenía un peso menor')+'). Elige analizar la imagen o pegar el texto. La carga no consume lecturas de Gemini.');await history();
      });
    });
  };
  const dropZone=el('file').parentElement;
  if(dropZone){
    dropZone.addEventListener('dragover',event=>{event.preventDefault();if(!busy)dropZone.dataset.drag='true'});
    dropZone.addEventListener('dragleave',()=>delete dropZone.dataset.drag);
    dropZone.addEventListener('drop',event=>{event.preventDefault();delete dropZone.dataset.drag;if(busy)return;const files=event.dataTransfer?.files;if(files?.length){el('file').files=files;el('file').onchange()}});
  }
  el('analyze').onclick=()=>withConfirm(keys.some(k=>el(k).value),extraction?'Recuperar los datos originales reemplazará tus campos actuales, sin consumir otra lectura. ¿Continuar?':'La lectura con IA reemplazará los campos actuales. ¿Continuar?',{title:extraction?'¿Recuperar lectura original?':'¿Analizar flyer con IA?',confirmText:'Continuar',cancelText:'Cancelar'},()=>run(readFlyer));
  keys.forEach(k=>el(k).addEventListener('input',()=>{changed();if(k==='telefono'||k==='mensaje')syncWhatsApp();if(!el('review').hidden)status('Los datos cambiaron. Vuelve a generar el copy y revísalo antes de guardar.')}));
  el('copy').oninput=changed;
  function generateCopy(){
      const completed=KJAMarketing.completeCourseData(data());
      ['descripcion','publico','temario'].forEach(key=>{el(key).value=completed[key]||''});
        el('short-url').value='';
      const d=data();
      if(!d.titulo){showPanel('data');throw new Error('No se encontró el nombre del curso. Corrige solo ese dato para generar el copy.')}
      if(!d.telefono){d.telefono='51988918238';el('telefono').value=d.telefono}
      if(!d.mensaje||d.mensaje===automaticMessage||/^Hola, vi la publicación de .+\. Quisiera información sobre el precio, las fechas y la inscripción\.$/.test(d.mensaje)){
        d.mensaje=KJAMarketing.whatsappMessage(d.titulo,d.facebook_url,d);automaticMessage=d.mensaje;el('mensaje').value=d.mensaje;
      }
      try{KJAMarketing.link(d.telefono,d.mensaje)}catch(error){showPanel('data');throw error}
      const link=chosenLink(d);el('copy').value=KJAMarketing.compose(d,link);el('link').href=link;el('link').textContent='Probar chat de WhatsApp';el('review').hidden=false;changed();step(3);status('Borrador generado. Puedes editar el copy y probar el enlace antes de guardarlo.');el('copy').focus();
        syncWhatsApp();el('short-url').value=link;
      showPanel('review');el('copy').focus();el('destination').textContent='WhatsApp de ventas: '+d.telefono+' · Puedes cambiarlo en Corregir información.';
  }
  el('generate').onclick=()=>run(async()=>{generateCopy();await shorten();});
  el('refresh-all').onclick=()=>{
    if(busy||locked||!id)return;
    return withConfirm(Boolean(el('copy').value.trim()),'Se volverán a generar el texto y el mensaje de WhatsApp con los datos actuales del flyer. Esto reemplazará tus ediciones manuales. ¿Continuar?',{title:'¿Regenerar texto y mensaje?',confirmText:'Sí, regenerar',cancelText:'Cancelar'},()=>{
      return run(async()=>{
        const d=data();
        d.telefono=d.telefono||'51988918238';
        d.mensaje=KJAMarketing.whatsappMessage(d.titulo,d.facebook_url,d);
        KJAMarketing.link(d.telefono,d.mensaje);
        status('Actualizando el texto y el enlace corto de KJA…');
        const result=await call('enlace',{id,telefono:KJAMarketing.phoneCandidates(d.telefono)[0],mensaje:d.mensaje});
        if(!/^https:\/\/www\.kjadmb\.com\/w\.html\?k=[A-Za-z0-9_-]{16}$/.test(result?.enlace||''))throw new Error('No se pudo actualizar el enlace corto. Tu texto anterior se conserva; vuelve a intentarlo.');
        // Solo reemplazar las ediciones después de obtener el enlace válido.
        shortLink=result.enlace;shortFor=signature(d);automaticMessage=d.mensaje;
        el('telefono').value=d.telefono;el('mensaje').value=d.mensaje;
        generateCopy();
        status('Texto, mensaje de WhatsApp y enlace corto actualizados. Revisa el resultado y guarda los cambios.');
      });
    });
  };
  const handleRefine=async customPrompt=>{
    const promptInput=el('refine-prompt');
    const promptText=String(customPrompt||promptInput?.value||'').trim();
    if(!promptText){
      status('Escribe una indicación o selecciona una sugerencia para moldear el texto.',true);
      promptInput?.focus();
      return;
    }
    const currentCopy=el('copy').value.trim();
    if(!currentCopy){
      status('Genera o escribe un texto primero antes de moldearlo con IA.',true);
      return;
    }
    if(busy||locked||!id)return;
    const refineTask=async()=>{
      progress(12);
      el('loading-text').textContent='Gemini está moldeando el texto con tu indicación…';
      const hintEl=el('progress-hint');
      if(hintEl)hintEl.textContent='Interpretando tu indicación y adaptando el texto con IA. Espera sin recargar…';
      status('Gemini está moldeando el texto con tu indicación…');
      let estimate=12;
      const timer=typeof setInterval==='function'?setInterval(()=>{
        estimate=Math.min(85,estimate+Math.max(1,Math.round((85-estimate)/8)));
        progress(estimate);
        if(estimate>=60)el('loading-text').textContent='Gemini sigue perfeccionando el texto. Espera sin recargar…';
      },650):null;
      const submitBtn=el('refine-submit');
      if(submitBtn)submitBtn.disabled=true;
      if(promptInput)promptInput.disabled=true;
      const statusBox=el('refine-status');
      if(statusBox){statusBox.hidden=false;statusBox.textContent='Aplicando cambios con IA…';statusBox.dataset.type='info';}
      let result;
      try{
        result=await call('moldear',{id,copy:currentCopy,prompt:promptText});
      }catch(err){
        if(statusBox){
          statusBox.hidden=false;
          statusBox.dataset.type='error';
          statusBox.textContent=err?.message||'No se pudo moldear el texto.';
        }
        throw err;
      }finally{
        if(timer!==null)clearInterval(timer);
      }
      progress(95);
      el('loading-text').textContent='Aplicando el texto moldeado…';
      if(!result?.copy)throw new Error('No se recibió el texto moldeado.');
      el('copy').value=result.copy;
      changed();
      if(result.cuota){
        config.cuota=result.cuota;
        renderQuota(config.cuota);
      }
      if(typeof updateFbPreview==='function'&&previewActive)updateFbPreview();
      if(promptInput)promptInput.value='';
      progress(100);
      el('loading-text').textContent='¡Texto moldeado listo!';
      if(typeof setTimeout==='function')await new Promise(resolve=>setTimeout(resolve,350));
      status('Texto moldeado con éxito con tus indicaciones. Revisa los cambios.');
      showToast('Texto moldeado','Se aplicaron tus indicaciones con IA','success');
      if(statusBox){
        statusBox.textContent='✓ Texto actualizado con éxito';
        statusBox.dataset.type='success';
        if(typeof setTimeout==='function')setTimeout(()=>{if(statusBox)statusBox.hidden=true;},3500);
      }
    };
    try{
      await run(refineTask,true);
    }finally{
      const submitBtn=el('refine-submit');
      if(submitBtn)submitBtn.disabled=busy||locked;
      if(promptInput)promptInput.disabled=busy||locked;
    }
  };
  if(el('refine-submit'))el('refine-submit').onclick=()=>handleRefine();
  if(el('refine-prompt'))el('refine-prompt').onkeydown=event=>{
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();handleRefine();}
  };
  if(typeof document!=='undefined'&&document.querySelectorAll){
    const chips=document.querySelectorAll('.marketing-ai-chip');
    if(chips?.length)chips.forEach(chip=>{
      chip.onclick=()=>{
        chips.forEach(c=>c.classList?.remove?.('is-active'));
        chip.classList?.add?.('is-active');
        const promptInput=el('refine-prompt');
        if(promptInput){
          promptInput.value=chip.dataset?.prompt||chip.textContent.trim();
          promptInput.focus();
        }
      };
    });
  }
  if(el('refine-prompt')){
    const origInput=el('refine-prompt').oninput;
    el('refine-prompt').oninput=ev=>{
      if(typeof origInput==='function')origInput(ev);
      const chips=typeof document!=='undefined'&&document.querySelectorAll?document.querySelectorAll('.marketing-ai-chip'):null;
      if(chips?.length)chips.forEach(c=>c.classList?.remove?.('is-active'));
    };
  }

  // ── Selector de Emojis estilo iOS / WhatsApp Web ───────────────────────
  const EMOJI_CATEGORIES=[
    {
      id:'destacados',name:'Destacados KJA & Marketing',
      emojis:[
        {e:'⚡',n:'rayo energia rapido directo'},{e:'🔥',n:'fuego ventas urgente tendencia'},{e:'💡',n:'foco idea tip aprendizaje'},{e:'🎯',n:'diana objetivo meta precision'},
        {e:'🏆',n:'trofeo premio logro exito'},{e:'🌟',n:'estrella destacada calidad'},{e:'✨',n:'destellos magia nuevo especial'},{e:'🚀',n:'cohete impulso despegue exito'},
        {e:'📲',n:'celular whatsapp movil contacto'},{e:'📩',n:'mensaje correo sobre inscripcion'},{e:'📞',n:'telefono llamada atencion'},{e:'💬',n:'burbuja chat conversacion consulta'},
        {e:'📍',n:'ubicacion pin presencial lima peru'},{e:'🗓️',n:'calendario fecha dia horario'},{e:'⏰',n:'reloj alarma hora tiempo'},{e:'⏳',n:'reloj arena cupos limitados'},
        {e:'🎓',n:'birrete curso diplomado formacion psicologia'},{e:'📚',n:'libros temario lectura estudio'},{e:'📖',n:'libro abierto guia manual'},{e:'📝',n:'lapiz papel informe evaluacion test'},
        {e:'📋',n:'portapapeles requisitos lista'},{e:'📌',n:'chincheta nota importante pin'},{e:'🧠',n:'cerebro mente psicologia neuro'},{e:'🩺',n:'estetoscopio clinica salud evaluacion'},
        {e:'🧸',n:'osito peluche terapia infantil ninos'},{e:'🎨',n:'arte paleta colores estimulacion ninos'},{e:'🧩',n:'rompecabezas pieza autismo tea inclusion'},{e:'🤝',n:'apreton manos acuerdo confianza'},
        {e:'✅',n:'check verificado aprobado correcto si'},{e:'🔔',n:'campana notificacion aviso alerta'},{e:'📣',n:'megafono anuncio comunicado'},{e:'🏷️',n:'etiqueta descuento promocion precio'}
      ]
    },
    {
      id:'caras',name:'Caras & Emociones',
      emojis:[
        {e:'😀',n:'sonrisa alegre cara'},{e:'😃',n:'sonrisa grande feliz'},{e:'😄',n:'sonrisa ojos felices'},{e:'😁',n:'sonrisa radiante'},
        {e:'😆',n:'risa carcajada divertida'},{e:'😅',n:'alivio risa sudor'},{e:'🤣',n:'carcajada rodar risa'},{e:'😂',n:'llorar de risa alegria'},
        {e:'🙂',n:'leve sonrisa amable'},{e:'🙃',n:'al reves ironia'},{e:'😉',n:'guiño confianza'},{e:'😊',n:'sonrojo amable calido'},
        {e:'😇',n:'angel inocente bondad'},{e:'🥰',n:'enamorado corazones carino'},{e:'😍',n:'ojos corazones amor me encanta'},{e:'🤩',n:'ojos estrellas fascinado'},
        {e:'😘',n:'beso corazon carino'},{e:'😗',n:'beso'},{e:'😚',n:'beso ternura'},{e:'😙',n:'beso sonrisa'},
        {e:'😋',n:'rico sabroso lengua'},{e:'😛',n:'lengua fuera juego'},{e:'😜',n:'lengua guiño loco'},{e:'🤪',n:'loco broma divertido'},
        {e:'😝',n:'lengua ojos risa'},{e:'🤑',n:'dinero dolares rico'},{e:'🤗',n:'abrazo acogida afecto'},{e:'🤭',n:'mano en boca risita'},
        {e:'🤫',n:'silencio secreto callar'},{e:'🤔',n:'pensativo duda analisis'},{e:'🤐',n:'boca cremallera silencio'},{e:'🤨',n:'ceja duda esceptico'},
        {e:'😐',n:'cara neutra'},{e:'😑',n:'inexpresivo'},{e:'😶',n:'sin boca mudo'},{e:'😏',n:'picaro astuto'},
        {e:'😒',n:'descontento disgusto'},{e:'🙄',n:'ojos arriba fastidio'},{e:'😬',n:'mueca incomodo'},{e:'😌',n:'alivio paz sereno'},
        {e:'😔',n:'triste reflexivo desanimo'},{e:'😴',n:'durmiendo zzz descanso'},{e:'😷',n:'mascarilla salud medico'},{e:'🤒',n:'termometro enfermo salud'},
        {e:'🤕',n:'vendaje herido golpe'},{e:'🥳',n:'fiesta celebracion cumpleanos'},{e:'😎',n:'gafas sol estilo genial'},{e:'🤓',n:'nerd empollon gafas sabio'},
        {e:'🧐',n:'monoculo detalle examen'},{e:'🥺',n:'suplicante tierno por favor'},{e:'😢',n:'lagrima triste pena'},{e:'😭',n:'llanto desconsolado pena dolor'},
        {e:'😱',n:'grito susto terror'},{e:'🥱',n:'bostezo sueno cansado'},{e:'😤',n:'humo nariz orgullo triunfo'},{e:'😡',n:'enojado furia rabia'},{e:'😠',n:'enfadado ceño fruncido'}
      ]
    },
    {
      id:'gestos',name:'Gestos & Personas',
      emojis:[
        {e:'👋',n:'hola saludo adios mano'},{e:'🤚',n:'dorso mano alto'},{e:'🖐️',n:'mano abierta cinco'},{e:'✋',n:'mano levantada stop alto'},
        {e:'👌',n:'ok perfecto genial si'},{e:'🤌',n:'pellizco que dices italia'},{e:'🤏',n:'poquito pellizco corto'},{e:'✌️',n:'paz amor victoria dos'},
        {e:'🤞',n:'dedos cruzados suerte'},{e:'🤟',n:'te quiero amor rock'},{e:'🤙',n:'llamame shaka relax'},{e:'👈',n:'apuntar izquierda aca'},
        {e:'👉',n:'apuntar derecha clic aqui enlace'},{e:'👆',n:'apuntar arriba atencion'},{e:'👇',n:'apuntar abajo link boton inscribete'},{e:'☝️',n:'un momento atencion'},
        {e:'👍',n:'pulgar arriba like me gusta aprobado'},{e:'👎',n:'pulgar abajo dislike no'},{e:'👏',n:'aplausos bravo felicitaciones palmas'},{e:'🙌',n:'manos arriba celebracion exito viva'},
        {e:'👐',n:'manos abiertas acogida'},{e:'🤝',n:'apreton manos acuerdo trato confianza'},{e:'🙏',n:'gracias por favor rezo respeto'},{e:'✍️',n:'escribir apuntes firma nota'},
        {e:'💪',n:'musculo fuerza animo motivacion'},{e:'🧠',n:'cerebro mente psicologia'},{e:'👀',n:'ojos mirar atencion ver'},{e:'👶',n:'bebe infantil nino crianza'},
        {e:'👧',n:'nina nina infancia'},{e:'👦',n:'nino nino infancia'},{e:'👩',n:'mujer adulta femenina'},{e:'👨',n:'hombre adulto masculino'},
        {e:'👩‍⚕️',n:'doctora psicologa terapeuta salud'},{e:'👨‍⚕️',n:'doctor psicologo terapeuta salud'},{e:'👩‍🏫',n:'profesora docente maestra'},{e:'👨‍🏫',n:'profesor docente maestro'},
        {e:'👩‍👧‍👦',n:'familia madre hijos padres'},{e:'👨‍👩‍👧‍👦',n:'familia completa padres hijos hogar'},{e:'🫂',n:'abrazo personas carino apoyo'}
      ]
    },
    {
      id:'simbolos',name:'Corazones & Símbolos',
      emojis:[
        {e:'❤️',n:'corazon rojo amor pasion'},{e:'🧡',n:'corazon naranja energia amistad'},{e:'💛',n:'corazon amarillo alegria felicidad'},{e:'💚',n:'corazon verde salud esperanza'},
        {e:'💙',n:'corazon azul confianza kja calma'},{e:'💜',n:'corazon morado espiritualidad'},{e:'🤍',n:'corazon blanco pureza paz'},{e:'🤎',n:'corazon marron tierra'},
        {e:'🖤',n:'corazon negro elegancia'},{e:'💔',n:'corazon roto duelo'},{e:'❣️',n:'exclamacion corazon enfasis'},{e:'💕',n:'dos corazones carino ternura'},
        {e:'💖',n:'corazon destellos brillante'},{e:'💘',n:'flecha cupido enamorado'},{e:'💝',n:'corazon lazo regalo'},{e:'✨',n:'destellos estrellas brillo magico'},
        {e:'⭐',n:'estrella dorada favorito'},{e:'🌟',n:'estrella brillante calidad'},{e:'⚡',n:'rayo energia electricidad rapido'},{e:'⚠️',n:'advertencia aviso alerta cuidado'},
        {e:'⛔',n:'prohibido no alto'},{e:'🚫',n:'prohibido denegado'},{e:'✅',n:'check verificado aprobado correcto'},{e:'❌',n:'cruz error falso no'},
        {e:'❓',n:'pregunta duda interrogacion'},{e:'❗',n:'exclamacion importante atencion'},{e:'💯',n:'cien puntos perfecto excelente'},{e:'🔴',n:'circulo rojo'},
        {e:'🔵',n:'circulo azul'},{e:'🟢',n:'circulo verde activo online'},{e:'🟡',n:'circulo amarillo aviso'},{e:'🔗',n:'enlace link cadena web'},
        {e:'➡️',n:'flecha derecha siguiente'},{e:'⬅️',n:'flecha izquierda atras'},{e:'⬆️',n:'flecha arriba'},{e:'⬇️',n:'flecha abajo'},{e:'↗️',n:'flecha diagonal enlace externo'}
      ]
    },
    {
      id:'objetos',name:'Educación & Objetos',
      emojis:[
        {e:'🎓',n:'birrete titulo diploma curso psicologia'},{e:'📚',n:'libros estudio lectura formacion'},{e:'📖',n:'libro abierto manual temario'},{e:'📝',n:'lapiz papel informe evaluacion test'},
        {e:'📋',n:'portapapeles requisitos lista'},{e:'💼',n:'maletin profesional empleo negocio'},{e:'📊',n:'grafico barras estadistica investigacion'},{e:'📈',n:'grafico subida crecimiento exito'},
        {e:'💻',n:'laptop pc zoom virtual online'},{e:'🖥️',n:'pantalla escritorio clase grabada'},{e:'📱',n:'movil telefono smartphone whatsapp'},{e:'🎥',n:'camara sesion zoom video'},
        {e:'🔔',n:'campana aviso notificacion'},{e:'📣',n:'megafono aviso difusion publicidad'},{e:'📢',n:'altavoz anuncio comunicado'},{e:'✉️',n:'carta sobre correo email'},
        {e:'📧',n:'email correo electronico'},{e:'🏷️',n:'etiqueta oferta descuento promocion'},{e:'💰',n:'bolsa dinero inversion costo precio'},{e:'💳',n:'tarjeta credito debito pago yape'},
        {e:'🔒',n:'candado seguridad confidencial'},{e:'🔑',n:'llave clave acceso clave'},{e:'🛡️',n:'escudo proteccion bienestar'},{e:'🩺',n:'estetoscopio salud clinica'}
      ]
    },
    {
      id:'celebracion',name:'Fiesta & Naturaleza',
      emojis:[
        {e:'🎉',n:'corneta fiesta celebracion exito felicidades'},{e:'🎊',n:'bola confeti fiesta evento apertura'},{e:'🎈',n:'globo fiesta infantil cumpleanos'},{e:'🎁',n:'regalo sorpresa obsequio bono'},
        {e:'🎂',n:'torta pastel cumpleanos'},{e:'🥂',n:'copas brindis celebracion exito salud'},{e:'☕',n:'cafe taza pausa relajacion'},{e:'🍎',n:'manzana salud nutricion educacion'},
        {e:'🌈',n:'arcoiris esperanza inclusion diversidad'},{e:'☀️',n:'sol radiante dia clima'},{e:'🌤️',n:'sol nubes buen dia'},{e:'🌱',n:'brote planta crecimiento desarrollo'},
        {e:'🌿',n:'hierba hoja naturaleza bienestar verde'},{e:'🌸',n:'flor cerezo primavera belleza'},{e:'🌻',n:'girasol alegria energia sol'},{e:'🍀',n:'trebol suerte cuatro hojas'},
        {e:'🧸',n:'osito peluche juego ninos terapia'},{e:'🧩',n:'rompecabezas pieza autismo tea'},{e:'🎨',n:'paleta pintura creatividad ninos'},{e:'⚽',n:'pelota futbol juego ninos'},{e:'✈️',n:'avion viaje internacional lima peru'}
      ]
    }
  ];

  let activeEmojiTarget=el('copy');
  function setEmojiTarget(target){
    if(!target)return;
    activeEmojiTarget=target;
    const label=el('emoji-target-label');
    if(label){
      if(target===el('refine-prompt'))label.textContent='Prompt de IA';
      else if(target===el('whatsapp-message'))label.textContent='WhatsApp de campaña';
      else label.textContent='Texto de publicación';
    }
  }

  ['copy','refine-prompt','whatsapp-message'].forEach(k=>{
    const node=el(k);
    if(node){
      if(typeof node.addEventListener==='function'){
        node.addEventListener('focus',()=>setEmojiTarget(node));
        node.addEventListener('click',()=>setEmojiTarget(node));
      }
    }
  });

  function insertEmoji(emoji){
    const target=activeEmojiTarget||el('copy');
    if(!target)return;
    const val=target.value||'';
    const start=typeof target.selectionStart==='number'?target.selectionStart:val.length;
    const end=typeof target.selectionEnd==='number'?target.selectionEnd:val.length;
    target.value=val.slice(0,start)+emoji+val.slice(end);
    const nextPos=start+emoji.length;
    if(typeof target.setSelectionRange==='function'){
      target.setSelectionRange(nextPos,nextPos);
    }
    if(typeof target.focus==='function')target.focus();
    if(target===el('copy')){
      changed();
    }else if(target===el('whatsapp-message')){
      el('mensaje').value=target.value;
      changed();
    }
  }

  function renderEmojis(query=''){
    const list=el('emoji-list');
    if(!list)return;
    list.replaceChildren();
    const q=String(query||'').trim().toLowerCase();
    if(q){
      const matched=[];
      EMOJI_CATEGORIES.forEach(cat=>{
        cat.emojis.forEach(item=>{
          if(item.e.includes(q)||item.n.includes(q)){
            if(!matched.some(m=>m.e===item.e))matched.push(item);
          }
        });
      });
      if(!matched.length){
        const empty=document.createElement('div');
        empty.className='marketing-emoji-empty';
        empty.textContent='No se encontraron emojis con "'+query+'"';
        list.append(empty);
        return;
      }
      const title=document.createElement('div');
      title.className='marketing-emoji-category-title';
      title.textContent='RESULTADOS ('+matched.length+')';
      list.append(title);
      const grid=document.createElement('div');
      grid.className='marketing-emoji-grid';
      matched.forEach(item=>{
        const btn=document.createElement('button');
        btn.type='button';btn.className='marketing-emoji-item';
        btn.textContent=item.e;btn.title=item.e+' · '+item.n.split(' ')[0];
        btn.onclick=()=>insertEmoji(item.e);
        grid.append(btn);
      });
      list.append(grid);
      return;
    }
    EMOJI_CATEGORIES.forEach(cat=>{
      const title=document.createElement('div');
      title.className='marketing-emoji-category-title';
      title.textContent=cat.name;
      title.id='mk-cat-'+cat.id;
      list.append(title);
      const grid=document.createElement('div');
      grid.className='marketing-emoji-grid';
      cat.emojis.forEach(item=>{
        const btn=document.createElement('button');
        btn.type='button';btn.className='marketing-emoji-item';
        btn.textContent=item.e;btn.title=item.e+' · '+item.n.split(' ')[0];
        btn.onclick=()=>insertEmoji(item.e);
        grid.append(btn);
      });
      list.append(grid);
    });
  }

  function toggleEmojiPicker(open,explicitTarget){
    const popover=el('emoji-popover');
    if(!popover)return;
    const nextState=typeof open==='boolean'?open:Boolean(popover.hidden);
    popover.hidden=!nextState;
    const triggerBtn=el('emoji-btn');
    if(triggerBtn)triggerBtn.classList?.toggle?.('is-active',nextState);
    if(nextState){
      if(explicitTarget)setEmojiTarget(explicitTarget);
      else setEmojiTarget(activeEmojiTarget||el('copy'));
      renderEmojis('');
      const search=el('emoji-search');
      if(search){search.value='';if(typeof search.focus==='function')search.focus();}
      const clearBtn=el('emoji-search-clear');
      if(clearBtn)clearBtn.hidden=true;
    }
  }

  if(el('emoji-btn'))el('emoji-btn').onclick=()=>toggleEmojiPicker();
  if(el('prompt-emoji-btn'))el('prompt-emoji-btn').onclick=()=>toggleEmojiPicker(true,el('refine-prompt'));
  if(el('emoji-close'))el('emoji-close').onclick=()=>toggleEmojiPicker(false);

  if(el('emoji-search')){
    el('emoji-search').oninput=e=>{
      const q=e.target?.value||'';
      const clearBtn=el('emoji-search-clear');
      if(clearBtn)clearBtn.hidden=!q;
      renderEmojis(q);
    };
  }
  if(el('emoji-search-clear')){
    el('emoji-search-clear').onclick=()=>{
      const search=el('emoji-search');
      if(search){search.value='';if(typeof search.focus==='function')search.focus();}
      el('emoji-search-clear').hidden=true;
      renderEmojis('');
    };
  }

  if(typeof document!=='undefined'&&document.querySelectorAll){
    const tabs=document.querySelectorAll('.marketing-emoji-tab');
    if(tabs?.length){
      tabs.forEach(tab=>{
        tab.onclick=()=>{
          tabs.forEach(t=>t.classList?.remove?.('is-active'));
          tab.classList?.add?.('is-active');
          const catId=tab.dataset?.cat;
          const targetEl=document.getElementById('mk-cat-'+catId);
          if(targetEl&&typeof targetEl.scrollIntoView==='function'){
            targetEl.scrollIntoView({behavior:'smooth',block:'start'});
          }
        };
      });
    }

    if(typeof document.addEventListener==='function'){
      document.addEventListener('click',event=>{
        const popover=el('emoji-popover');
        if(!popover||popover.hidden)return;
        const btn1=el('emoji-btn');
        const btn2=el('prompt-emoji-btn');
        if(popover.contains?.(event.target)||btn1?.contains?.(event.target)||btn2?.contains?.(event.target))return;
        toggleEmojiPicker(false);
      });
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'){
          const popover=el('emoji-popover');
          if(popover&&!popover.hidden)toggleEmojiPicker(false);
        }
      });
    }
  }

  el('apply-template').onclick=()=>withConfirm(Boolean(el('copy').value.trim()),'Aplicar el formato vuelve a generar el texto con los datos y opciones actuales. ¿Continuar?',{title:'¿Aplicar formato al copy?',confirmText:'Aplicar formato',cancelText:'Cancelar'},()=>run(async()=>{generateCopy();await shorten();}));
  optionKeys.forEach(k=>el('option-'+k).onchange=()=>{changed();status('Opciones de campaña cambiadas. Pulsa Aplicar formato para incluirlas en el texto.');});
  ['whatsapp-phone','whatsapp-message'].forEach((k,i)=>el(k).oninput=()=>{el(i?'mensaje':'telefono').value=el(k).value;changed();status('Pulsa Actualizar enlace para incorporar este WhatsApp al texto.');});
  el('facebook_url').oninput=()=>{
    try{if(!el('mensaje').value||el('mensaje').value===automaticMessage){automaticMessage=KJAMarketing.whatsappMessage(el('titulo').value,el('facebook_url').value.trim(),data());el('mensaje').value=automaticMessage;syncWhatsApp();}changed();status('Pulsa Generar enlace corto para incluir la publicación en el mensaje.');}catch(error){status(error.message,true)}
  };
  el('regenerate-message').onclick=()=>run(async()=>{automaticMessage=KJAMarketing.whatsappMessage(el('titulo').value,el('facebook_url').value.trim(),data());el('mensaje').value=automaticMessage;syncWhatsApp();changed();await shorten();status('Mensaje específico del flyer y enlace corto actualizados.');});
  el('update-link').onclick=()=>run(async()=>{const d=data();applyLink(d,KJAMarketing.link(d.telefono,d.mensaje));await shorten();el('destination').textContent='WhatsApp de ventas: '+d.telefono;status(id?'Enlace corto actualizado. Tus ediciones del texto se conservan.':'Adjunta un flyer para crear su enlace corto.');});
  el('save').onclick=()=>run(async()=>{
    const d=data(),link=chosenLink(d);
    if(!el('copy').value.includes(link))throw new Error('El enlace cambió. Vuelve a generar el copy antes de guardarlo.');
    await call('guardar',{id,datos:d,enlace:shortLink||undefined,copy:el('copy').value});dirty=false;saved=true;el('link').href=link;el('link').textContent='Probar chat de WhatsApp';el('checked').checked=false;status('Borrador guardado. Revisa el flyer, el copy y el destino de WhatsApp para habilitar la publicación.');showToast('Borrador guardado','Cambios guardados en tu cuenta.','success');await history();
  });
  if(el('save-later'))el('save-later').onclick=()=>run(async()=>{
    if(!id||locked)return;
    const result=await call('guardar_borrador',{id,datos:data(),copy:el('copy').value});
    if(!result?.ok)throw new Error('No se pudo confirmar el guardado. Reintenta.');
    draftCache.delete(id);dirty=false;saved=true;el('checked').checked=false;
    await history();status('Guardado para más tarde. Lo encontrarás en Mis publicaciones → Borradores.');showToast('Guardado','Disponible en Mis publicaciones → Borradores.','success');
  });
  function requestDeletion(targetId,title,trigger){
    if(busy||deletion||!targetId)return;
    deletion={id:targetId,trigger};el('delete-name').textContent=title;
    el('delete-unsaved').hidden=targetId!==id||!dirty;el('delete-error').textContent='';
    el('delete-dialog').showModal();el('delete-cancel').focus();
  }
  el('delete-cancel').onclick=()=>{if(!deleting)el('delete-dialog').close()};
  el('delete-dialog').oncancel=event=>{if(deleting)event.preventDefault()};
  el('delete-dialog').onclose=()=>{const trigger=deletion?.trigger;deletion=null;if(trigger?.isConnected)trigger.focus();else el('search').focus()};
  el('delete-confirm').onclick=async()=>{
    if(!deletion||deleting)return;
    deleting=true;busy=true;sync();el('delete-confirm').disabled=true;el('delete-cancel').disabled=true;
    el('delete-confirm').textContent='Eliminando…';el('delete-error').textContent='';
    let removed=false;
    try{
      const removedId=deletion.id,result=await call('eliminar',{id:removedId});
      if(!result?.ok)throw new Error('No se pudo confirmar la eliminación. Reintenta.');
      removed=true;draftCache.delete(removedId);if(removedId===id)reset();
      historyRows=historyRows.filter(row=>row.id!==removedId);renderHistory();
      el('delete-dialog').close();await history();status('Publicación eliminada del portal.');showToast('Publicación eliminada','Se removió del portal.','info');
    }catch(error){if(removed)status('Publicación eliminada. Actualiza el historial para consultar la lista.',true);else el('delete-error').textContent=error.message}
    finally{deleting=false;busy=false;el('delete-confirm').disabled=false;el('delete-cancel').disabled=false;el('delete-confirm').textContent='Eliminar publicación';sync()}
  };
  el('checked').onchange=sync;
  el('publish').onclick=()=>run(async()=>{
    if(!id||!el('checked').checked||!config.facebook||!config.puede_publicar||locked)return;
    const d=data(),link=chosenLink(d);
    if(!el('copy').value.includes(link))throw new Error('El enlace cambió. Actualiza el copy antes de publicar.');
    await call('guardar',{id,datos:d,enlace:shortLink||undefined,copy:el('copy').value});dirty=false;saved=true;
    status('Publicando en '+config.pagina+'…');
    // Bloquear localmente incluso ante una respuesta perdida; al recargar se consulta el estado real.
    locked=true;
    const result=await call('publicar',{id,revisado:true,copy:el('copy').value});
    step(3);status('Publicación confirmada por Facebook.');showToast('Publicación confirmada','El post ya está visible en Facebook.','success');dirty=false;
    el('post').href='https://www.facebook.com/'+encodeURIComponent(result.facebook_id);el('post').hidden=false;await history();
  });
  el('copy-button').onclick=()=>run(async()=>{
    if(!locked&&id&&(!shortLink||shortFor!==signature(data())))throw new Error('Pulsa Generar enlace corto para guardar el mensaje actual antes de copiar.');
    if(!locked&&!el('copy').value.includes(chosenLink(data())))throw new Error('El WhatsApp cambió. Pulsa Generar enlace corto antes de copiar el texto.');
    await navigator.clipboard.writeText(el('copy').value);el('copy-button').textContent='Texto copiado ✓';el('copy-ready').textContent='Texto copiado ✓';status('Texto copiado. Puedes pegarlo junto con el flyer en Facebook.');showToast('Texto copiado','Listo para compartir en Facebook con tu flyer.','success');
  });
  el('copy-ready').onclick=()=>el('copy-button').onclick();
  el('download').onclick=()=>run(async()=>{
    const response=await fetch(imageURL);if(!response.ok)throw new Error('No se pudo descargar el flyer. Vuelve a abrir el borrador.');
    const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='flyer-kja.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[blob.type]||'jpg');
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('Flyer descargado. Puedes adjuntarlo en una publicación nueva o actualizar la existente en Facebook.');showToast('Flyer descargado','La imagen se guardó en tu dispositivo.','success');
  });
  window.addEventListener('beforeunload',event=>{if(dirty||analysisProgress){event.preventDefault();event.returnValue=''}});
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){historyGeneration++;reset();available=false;config={ia:false,facebook:false,puede_publicar:false};el('history').replaceChildren();historyRows=[];draftCache.clear();historyOffset=0;historyMore=false;el('search').value='';historyFilter='all';el('history-count').textContent='0';document.getElementById('nav-marketing').hidden=true;}});
  if(typeof APP!=='undefined'&&APP.inicio)void window.KJAMarketingPortal.init();
  const editTabBtn=document.getElementById('marketing-mode-edit');
  const previewTabBtn=document.getElementById('marketing-mode-preview');
  if(editTabBtn)editTabBtn.onclick=()=>setPreviewMode(false);
  if(previewTabBtn)previewTabBtn.onclick=()=>setPreviewMode(true);
  window.addEventListener('keydown',event=>{
    const marketingView=document.getElementById('view-marketing');
    if(!marketingView||marketingView.hidden)return;
    if((event.ctrlKey||event.metaKey)&&event.key==='s'){
      event.preventDefault();
      if(!el('save').disabled)el('save').click();
      else if(el('save-later')&&!el('save-later').disabled)el('save-later').click();
    }
  });
  selectMethod(false);
  showPanel('prepare');
  renderQuota();
  sync();
})();
