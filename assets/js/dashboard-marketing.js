/* Extensión del portal. El servidor valida cada operación y el permiso de publicación. */
(function(){
  'use strict';
  // Pausa temporal de Publicaciones. Cambiar a true para volver a habilitarla.
  const PUBLICACIONES_HABILITADAS=true;
  const el=id=>document.getElementById('marketing-'+id);
  const keys=['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje','facebook_url'];
  const optionKeys=['certificado','material','peru','vacantes'];
  let id=null,imageURL='',busy=false,dirty=false,saved=false,locked=false,extraction=null,config={ia:false,facebook:false,puede_publicar:false},available=false;
  let isAdmin=false,adminScope='me',selectedAuthor='todos',teamAuthors=[];
  let shortLink='',shortFor='',automaticMessage='';
  const isKjaLink=url=>/^(?:https:\/\/www\.kjadmb\.com\/w\.html\?k=|https:\/\/wa\.kjadmb\.com\/)(?:[A-Za-z0-9_-]{6}|[A-Za-z0-9_-]{8}|[A-Za-z0-9_-]{16})$/.test(url||'');
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
    if(/^📲 WhatsApp:.*$/m.test(copy)){
      copy=copy.replace(/^📲 WhatsApp:.*$/m,'📲 WhatsApp: '+next);
      const phones=KJAMarketing.contactNumbers(d.telefono).map(number=>/^51\d{9}$/.test(number)?'(51) '+number.slice(2).replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):number).join(' / ');
      copy=copy.replace(/^📞 Teléfono de contacto:.*$/m,'📞 Teléfono de contacto: '+phones);
    }
    else if(/^📲 (?:Inscríbete directamente aquí|Contáctanos al WhatsApp):.*$/m.test(copy))copy=copy.replace(/^📲 (?:Inscríbete directamente aquí|Contáctanos al WhatsApp):.*$/m,line);
    else if(/^📩 Solicita información aquí:.*$/m.test(copy))copy=copy.replace(/^📩 Solicita información aquí:.*$/m,line);
    else if(!copy.includes(next))copy+='\n\n'+line;
    el('copy').value=copy;el('link').href=next;el('short-url').value=next;changed();
  }
  async function shorten(){
    if(!id)return;
    const d=data();KJAMarketing.link(d.telefono,d.mensaje);
    if(shortLink&&shortFor===signature(d)){applyLink(d,shortLink);return;}
    const result=await call('enlace',{id,telefono:KJAMarketing.phoneCandidates(d.telefono)[0],mensaje:d.mensaje});
    if(!isKjaLink(result?.enlace))throw new Error('No se recibió un enlace corto válido.');
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
      success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
      info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
      warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    toast.innerHTML=`<div class="marketing-toast-icon">${icons[type]||icons.info}</div><div class="marketing-toast-body"><div class="marketing-toast-title">${title}</div>${message?`<div class="marketing-toast-message">${message}</div>`:''}</div><button type="button" class="marketing-toast-close" aria-label="Cerrar notificación" title="Cerrar"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button><div class="marketing-toast-progress" style="animation-duration:${Math.max(1000,duration)}ms" aria-hidden="true"></div>`;
    const dismiss=()=>{
      if(toast.classList?.contains('dismissing'))return;
      toast.classList?.add('dismissing');
      setTimeout(()=>toast.remove?.(),280);
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
  function data(){return {...Object.fromEntries(keys.map(k=>[k,el(k).value.trim()])),acortador:'kja',opciones:Object.fromEntries(optionKeys.map(k=>[k,el('option-'+k).checked]))}}
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
  function reset(){setPreviewMode(false);el('short-url').value='';id=null;shortLink='';shortFor='';automaticMessage='';locked=false;dirty=false;saved=false;extraction=null;keys.forEach(k=>el(k).value='');restoreOptions();syncWhatsApp();el('source-text').value='';el('copy').value='';el('checked').checked=false;el('review').hidden=true;el('post').hidden=true;el('post').removeAttribute('href');el('link').removeAttribute('href');el('file').value='';el('extra').open=false;if(el('author-banner'))el('author-banner').hidden=true;setImage('');step(1);showPanel('prepare');sync()}
  const stateLabel=row=>({borrador:row.copy?'Texto preparado':'Por preparar',publicando:'Verificar envío',publicado:'Publicado',verificar:'Por verificar'}[row.estado]||'Borrador');
  function updateTeamAuthors(autores){
    teamAuthors=Array.isArray(autores)?autores:[];
    const select=el('author-select');
    if(!select)return;
    const currentVal=select.value||selectedAuthor;
    select.replaceChildren();
    const allOpt=document.createElement('option');
    allOpt.value='todos';
    allOpt.textContent='Todos los colaboradores ('+teamAuthors.length+')';
    select.append(allOpt);
    teamAuthors.forEach(a=>{
      const opt=document.createElement('option');
      opt.value=a.id;
      opt.textContent=a.nombre;
      select.append(opt);
    });
    if(teamAuthors.some(a=>a.id===currentVal)||currentVal==='todos'){
      select.value=currentVal;
      selectedAuthor=currentVal;
    }else{
      select.value='todos';
      selectedAuthor='todos';
    }
  }
  function renderHistory(){
    const query=el('search').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const rows=historyRows.filter(row=>{
      const title=(row.datos?.titulo||row.extraccion?.titulo||'Flyer sin título').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      return title.includes(query)&&(historyFilter==='all'||(historyFilter==='drafts'?row.estado==='borrador':row.estado==='publicado'));
    });
    el('history').replaceChildren();
    const scopeLabel=adminScope==='team'?'del equipo':'';
    el('history-summary').textContent=rows.length+' '+(rows.length===1?'publicación':'publicaciones')+(scopeLabel?' '+scopeLabel:'')+(query||historyFilter!=='all'?' en esta vista':' disponibles')+(historyMore?' · Hay anteriores por cargar':'');
    el('history-more').hidden=!historyMore;
    if(!rows.length){const empty=document.createElement('li');empty.className='marketing-empty';empty.textContent=historyRows.length?'No hay coincidencias. Prueba otro nombre o filtro.':(adminScope==='team'?'No hay publicaciones del equipo en esta selección.':'Tu próxima campaña empieza aquí. Crea una publicación y quedará guardada en este historial.');el('history').append(empty)}
    rows.forEach(row=>{
      const item=document.createElement('li'),button=document.createElement('button'),thumb=document.createElement('img'),title=document.createElement('span'),badge=document.createElement('span'),date=document.createElement('small');
      button.type='button';button.dataset.marketingDraft=row.id;button.setAttribute('aria-current',String(row.id===id));button.disabled=busy;item.dataset.active=String(row.id===id);
      title.className='marketing-history-title';title.textContent=row.datos?.titulo||row.extraccion?.titulo||'Flyer sin título';
      title.title=title.textContent;
      thumb.className='marketing-history-thumb';thumb.src=row.imagen||missingFlyer;thumb.alt=row.imagen?'':'Flyer pendiente de cargar';thumb.loading='lazy';thumb.onerror=()=>{thumb.onerror=null;thumb.src=missingFlyer;thumb.alt='Flyer no disponible';};
      badge.className='marketing-badge';badge.dataset.state=row.estado;badge.textContent=stateLabel(row);
      date.textContent=row.creado_at?new Date(row.creado_at).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Lima'}):'Sin fecha';
      button.append(thumb,title,badge);
      if(row.autor_nombre&&(adminScope==='team'||!row.es_propio)){
        const authorBadge=document.createElement('span');
        authorBadge.className='marketing-history-author-badge';
        authorBadge.textContent=(row.es_propio?'👤 ':'👥 ')+row.autor_nombre;
        authorBadge.title='Autor: '+row.autor_nombre;
        button.append(authorBadge);
      }
      button.append(date);
      item.append(button);el('history').append(item);
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
    const targetAutor=(isAdmin&&adminScope==='team')?selectedAuthor:'me';
    const result=await call('listar',{offset:append?historyOffset:0,autor:targetAutor});
    if(generation!==historyGeneration)return;
    if(!append){historyRows=[];historyOffset=0;draftCache.clear()}
    historyOffset+=result.items.length;
    for(const row of result.items){
      const index=historyRows.findIndex(item=>item.id===row.id);if(index<0)historyRows.push(row);else historyRows[index]=row;
      if(typeof row.copy==='string'&&row.imagen)draftCache.set(row.id,{borrador:row,imagen:row.imagen,at:Date.now()});
    }
    historyMore=!!result.has_more;el('history-count').textContent=String(result.total??historyRows.length);
    if(result.autores&&Array.isArray(result.autores))updateTeamAuthors(result.autores);
    renderHistory();
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
          Object.assign(row,loaded.borrador,{imagen:loaded.imagen,autor_nombre:loaded.autor_nombre||row.autor_nombre,es_propio:loaded.es_propio??row.es_propio});
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
        restoreOptions(stored.opciones);
        if(!el('telefono').value&&stored.telefono)el('telefono').value=stored.telefono;
        if(!el('telefono').value)el('telefono').value='51988918238';
        if(!el('mensaje').value&&stored.titulo){
          el('mensaje').value=KJAMarketing.whatsappMessage(stored.titulo,stored.facebook_url||'',stored);
          automaticMessage=el('mensaje').value;
        }else if(stored.titulo&&stored.mensaje===KJAMarketing.whatsappMessage(stored.titulo,stored.facebook_url||'',stored)){
          automaticMessage=stored.mensaje;
        }
        syncWhatsApp();
        if(isKjaLink(d.enlace)){
          shortLink=d.enlace;shortFor=signature(data());
          if(el('copy').value)el('copy').value=el('copy').value.replace(/https:\/\/wa\.me\/[^\s<)]+/g,d.enlace);
        }
        if(d.copy){
          showPanel(locked?'publish':'review');
        }else if(d.datos?.guardado_parcial){
          showPanel('data');
        }else if(stored.titulo){
          generateCopy();
        }else{
          showPanel('prepare');
        }
        if(d.enlace){el('link').href=d.enlace;el('short-url').value=d.enlace;el('link').textContent='Probar WhatsApp ↗'}
        if(d.estado==='publicado'&&d.facebook_id){el('post').href='https://www.facebook.com/'+encodeURIComponent(d.facebook_id);el('post').hidden=false}
        const authorName=result.autor_nombre||row.autor_nombre;
        const isOtherAuthor=result.es_propio===false||row.es_propio===false;
        if(isOtherAuthor&&authorName){
          el('author-banner').hidden=false;
          el('author-banner-name').textContent=authorName;
          status('Publicación de '+authorName+' abierta. Puedes revisar el copy, copiarlo o moldearlo.');
        }else{
          el('author-banner').hidden=true;
          status(locked?'Registro protegido: '+stateLabel(d)+'. Puedes copiar el texto y descargar el flyer.':'Publicación abierta. Continúa donde la dejaste.');
        }
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
      isAdmin=!error&&Boolean(permission?.administrar);
      document.getElementById('nav-marketing').hidden=!available;
      if(el('scope-container'))el('scope-container').hidden=!isAdmin;
      if(el('scope-me'))el('scope-me').setAttribute('aria-selected','true');
      if(el('scope-team'))el('scope-team').setAttribute('aria-selected','false');
      if(el('author-wrap'))el('author-wrap').hidden=adminScope!=='team';
      if(!isAdmin){
        adminScope='me';
        if(el('history-title'))el('history-title').textContent='Mis publicaciones';
      }
      window.KJAMarketingTeam?.init(error?null:permission);
    },open
  };
  function setAdminScope(scope){
    if(adminScope===scope)return;
    adminScope=scope;
    if(el('scope-me')){el('scope-me').classList.toggle('active',scope==='me');el('scope-me').setAttribute('aria-selected',String(scope==='me'));}
    if(el('scope-team')){el('scope-team').classList.toggle('active',scope==='team');el('scope-team').setAttribute('aria-selected',String(scope==='team'));}
    if(el('author-wrap'))el('author-wrap').hidden=scope!=='team';
    if(el('history-title'))el('history-title').textContent=scope==='team'?'Publicaciones del equipo':'Mis publicaciones';
    historyRows=[];historyOffset=0;draftCache.clear();
    run(()=>history(false));
  }
  if(el('scope-me'))el('scope-me').onclick=()=>setAdminScope('me');
  if(el('scope-team'))el('scope-team').onclick=()=>setAdminScope('team');
  if(el('author-select'))el('author-select').onchange=()=>{
    selectedAuthor=el('author-select').value;
    historyRows=[];historyOffset=0;draftCache.clear();
    run(()=>history(false));
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
        if(!isKjaLink(result?.enlace))throw new Error('No se pudo actualizar el enlace corto. Tu texto anterior se conserva; vuelve a intentarlo.');
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

  // ── Selector de Emojis estilo iOS 27 / Apple Keyboard ─────────────────
  function normalizeSearchText(str){
    return String(str||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase();
  }

  const EMOJI_CATEGORIES=[
    {
      id:'destacados',name:'Destacados KJA & Marketing',
      emojis:[
        {e:'⚡',n:'rayo energia rapido directo potencia'},
        {e:'🔥',n:'fuego ventas urgente tendencia oferta caliente exito'},
        {e:'💡',n:'foco idea tip aprendizaje clave consejo solucion'},
        {e:'🎯',n:'diana objetivo meta precision atencion enfoque'},
        {e:'🏆',n:'trofeo premio logro exito reconocimiento ganador'},
        {e:'🌟',n:'estrella destacada calidad brillo premium'},
        {e:'✨',n:'destellos magia nuevo especial brillo novedad'},
        {e:'🚀',n:'cohete impulso despegue exito crecer lanzamiento'},
        {e:'📲',n:'celular whatsapp movil contacto smartphone link'},
        {e:'📩',n:'mensaje correo sobre inscripcion bandeja entrada'},
        {e:'📞',n:'telefono llamada atencion contacto hablar asesoria'},
        {e:'💬',n:'burbuja chat conversacion consulta pregunta mensaje'},
        {e:'📍',n:'ubicacion pin presencial lima peru direccion sede local'},
        {e:'🇵🇪',n:'peru perú lima bandera nacional peruana centro kja'},
        {e:'🗓️',n:'calendario fecha dia horario cronograma agenda'},
        {e:'⏰',n:'reloj alarma hora tiempo puntual limite'},
        {e:'⏳',n:'reloj arena cupos limitados tiempo agotandose prisa'},
        {e:'🎓',n:'birrete curso diplomado formacion psicologia titulo graduacion'},
        {e:'📚',n:'libros temario lectura estudio material guia biblioteca'},
        {e:'📖',n:'libro abierto guia manual temario leccion'},
        {e:'📝',n:'lapiz papel informe evaluacion test redaccion ficha'},
        {e:'📋',n:'portapapeles requisitos lista checklist tareas temario'},
        {e:'📌',n:'chincheta nota importante pin fijar destacar'},
        {e:'🧠',n:'cerebro mente psicologia neuro cognicion salud mental'},
        {e:'🩺',n:'estetoscopio clinica salud evaluacion medico consulta kja'},
        {e:'🧸',n:'osito peluche terapia infantil ninos juego estimulacion'},
        {e:'🎨',n:'arte paleta colores estimulacion ninos creatividad taller'},
        {e:'🧩',n:'rompecabezas pieza autismo tea inclusion terapia juego logica'},
        {e:'🤝',n:'apreton manos acuerdo confianza convenio equipo alianza'},
        {e:'✅',n:'check verificado aprobado correcto si aceptado confirmado'},
        {e:'🔔',n:'campana notificacion aviso alerta recordatorio suscribete'},
        {e:'📣',n:'megafono anuncio comunicado difusion aviso llamado'},
        {e:'🏷️',n:'etiqueta descuento promocion precio rebaja oferta especial'},
        {e:'💰',n:'bolsa dinero costo inversion soles dolares precio matricula'},
        {e:'💳',n:'tarjeta credito debito pago yape plin transferencia pos'},
        {e:'❤️',n:'corazon rojo amor empatia calidez cuidado afecto'},
        {e:'💖',n:'corazon destellos brillante carino pasion gratitud'},
        {e:'👍',n:'pulgar arriba me gusta like si aprobado gracias bien'},
        {e:'🙌',n:'manos arriba celebracion exito felicidades bienvenida bravo'},
        {e:'🎉',n:'fiesta corneta celebracion inauguracion evento felicitaciones'}
      ]
    },
    {
      id:'caras',name:'Caras & Emociones',
      emojis:[
        {e:'😀',n:'sonrisa alegre cara cara feliz'},{e:'😃',n:'sonrisa grande ojos abiertos feliz'},{e:'😄',n:'sonrisa ojos felices contento'},{e:'😁',n:'sonrisa radiante dientes feliz'},
        {e:'😆',n:'risa carcajada divertida risotada'},{e:'😅',n:'alivio risa sudor nervios gota'},{e:'🤣',n:'carcajada rodar de risa divertido chistoso'},{e:'😂',n:'llorar de risa lagrimas alegria'},
        {e:'🙂',n:'leve sonrisa amable agradable cordial'},{e:'🙃',n:'al reves ironia sarcasmo broma'},{e:'🫠',n:'derretirse calor timidez pena derretido'},{e:'😉',n:'guino confianza complicidad picaro'},
        {e:'😊',n:'sonrojo amable calido simpatia agradecido'},{e:'😇',n:'angel inocente bondad halo bendicion'},{e:'🥰',n:'enamorado corazones carino ternura amor'},{e:'😍',n:'ojos corazones amor me encanta fascinado'},
        {e:'🤩',n:'ojos estrellas fascinado deslumbrado emocionado'},{e:'😘',n:'beso corazon carino amoroso beso'},{e:'😗',n:'beso silbar cara silbido'},{e:'😚',n:'beso ternura ojos cerrados'},
        {e:'😙',n:'beso sonrisa amigable cordial'},{e:'😋',n:'rico sabroso lengua delicioso antojo'},{e:'😛',n:'lengua fuera juego ninos broma'},{e:'😜',n:'lengua guino loco travieso chiste'},
        {e:'🤪',n:'loco broma divertido alocado disparatado'},{e:'😝',n:'lengua ojos cerrados risa burla juego'},{e:'🤑',n:'dinero dolares rico plata ganancias soles'},{e:'🤗',n:'abrazo acogida afecto recibimiento calidez'},
        {e:'🤭',n:'mano en boca risita secreto pena ups'},{e:'🫢',n:'boca tapada asombro sorpresa shock oop'},{e:'🫣',n:'ojo espiando timidez mirar con miedo oculto'},{e:'🤫',n:'silencio secreto callar guardar secreto'},
        {e:'🤔',n:'pensativo duda analisis pensar reflexion consulta'},{e:'🫡',n:'saludo militar respeto orden cumplimiento entendido'},{e:'🤐',n:'boca cremallera silencio mudo confidencial'},{e:'🤨',n:'ceja levantada duda esceptico sospecha'},
        {e:'😐',n:'cara neutra sin comentarios serio plomo'},{e:'😑',n:'inexpresivo fastidio resignado cansancio'},{e:'😶',n:'sin boca mudo en silencio reserva'},{e:'🫥',n:'linea de puntos invisible desaparecido fantasma'},
        {e:'😏',n:'picaro astuto sonrisa ladeada confianza'},{e:'😒',n:'descontento disgusto desagrado fastidio'},{e:'🙄',n:'ojos arriba fastidio desden aburrimiento'},{e:'😬',n:'mueca incomodo verguenza ajena tension'},
        {e:'🤥',n:'mentira pinocho mentiroso nariz larga'},{e:'😌',n:'alivio paz sereno tranquilo relajado calma'},{e:'😔',n:'triste reflexivo desanimo cabizbajo pesar'},{e:'😪',n:'somnoliento sueno cansado bostezo'},
        {e:'🤤',n:'babeando antojo apetito sueno delicia'},{e:'😴',n:'durmiendo zzz descanso dormir noche'},{e:'😷',n:'mascarilla salud medico proteccion pandemia'},{e:'🤒',n:'termometro enfermo salud fiebre clinica'},
        {e:'🤕',n:'vendaje herido golpe accidente salud'},{e:'🤢',n:'nauseas asco disgusto mareo indigestos'},{e:'🤮',n:'vomito enfermo asco intoxicado'},{e:'🤧',n:'estornudo resfriado alergia panuelo'},
        {e:'🥵',n:'calor sofoco sofocado transpirado verano'},{e:'🥶',n:'frio congelado helado invierno temblando'},{e:'🥴',n:'aturdido mareado confundido achispado'},{e:'😵',n:'ojos espirales mareado noqueado sorpresa'},
        {e:'🤯',n:'cabeza explotando mente rota shock increible idea'},{e:'🤠',n:'vaquero sombrero vaquera estilo aventura'},{e:'🥳',n:'fiesta celebracion cumpleanos pito gorrito exito'},{e:'🥸',n:'disfraz bigote gafas encubierto comico'},
        {e:'😎',n:'gafas de sol estilo genial crack cool profesional'},{e:'🤓',n:'nerd empollon gafas sabio intelectual lectura'},{e:'🧐',n:'monoculo detalle examen minucioso peritaje'},{e:'😕',n:'confundido perplejo duda desacuerdo'},
        {e:'🫤',n:'boca torcida resignado esceptico bueno'},{e:'😟',n:'preocupado inquieto desasosiego ansiedad temores'},{e:'🙁',n:'triste ceno leve pesar amargura'},{e:'😮',n:'boca abierta asombro sorpresa novedad wow'},
        {e:'😯',n:'sorprendido admirado boca pequena'},{e:'😲',n:'asombrado impactado sorprendido shock'},{e:'😳',n:'sonrojado verguenza pena asombrado ojazos'},{e:'🥺',n:'suplicante tierno por favor ojos tiernos pena'},
        {e:'🥹',n:'lagrimas de emocion conmovido orgullo gratitud'},{e:'😦',n:'boca abierta preocupacion miedo alerta'},{e:'😧',n:'angustiado preocupado desesperacion susto'},{e:'😨',n:'asustado miedo temor panico alarma'},
        {e:'😰',n:'sudor frio ansiedad estres apuro temor'},{e:'😥',n:'aliviado pero triste lagrima desanimo'},{e:'😢',n:'lagrima triste pena llanto dolor desahogo'},{e:'😭',n:'llanto desconsolado pena tristeza quebranto'},
        {e:'😱',n:'grito susto terror espanto grito munich'},{e:'😖',n:'cara frustrada impotencia esfuerzo tension'},{e:'😣',n:'perseverante aguantando dolor sufrimiento'},{e:'😞',n:'decepcionado desilusionado triste desanimo'},
        {e:'😓',n:'sudor frio cansancio agobio esfuerzo'},{e:'😩',n:'cansado fatigado no puedo mas queja'},{e:'😫',n:'exhausto agotamiento desesperado cansado'},{e:'🥱',n:'bostezo sueno cansado aburrido letargo'},
        {e:'😤',n:'humo nariz orgullo triunfo resoplido fuerza'},{e:'😡',n:'enojado furia rabia enfado colorado rojo'},{e:'😠',n:'enfadado ceno fruncido molesto enojo'},{e:'🤬',n:'maldicion insulto censurado furioso rabioso'},
        {e:'😈',n:'diablillo morado travieso picaro sonrisa'},{e:'👿',n:'demonio morado enfado enojado villano'},{e:'💀',n:'calavera muerte susto agotado muerto risa'},{e:'💩',n:'caca popo humor divertido risas'},
        {e:'🤡',n:'payaso circo comico bromista risa'},{e:'👻',n:'fantasma susto noche halloween divertido'},{e:'👽',n:'alien ovni extraterrestre tecnologia misterio'},{e:'🤖',n:'robot bot ia inteligencia artificial automatizacion'}
      ]
    },
    {
      id:'personas',name:'Personas & Gestos',
      emojis:[
        {e:'👋',n:'hola saludo adios bienvenida mano chao'},{e:'🤚',n:'dorso de la mano alto palma dorso'},{e:'🖐️',n:'mano abierta cinco dedos saludo alto'},{e:'✋',n:'mano levantada stop alto detente pausa'},
        {e:'🖖',n:'saludo vulcano prosperidad spock paz'},{e:'🫱',n:'mano derecha ofrecer saludar'},{e:'🫲',n:'mano izquierda alcanzar'},{e:'🫳',n:'mano palma abajo soltar dejar caer'},
        {e:'🫴',n:'mano palma arriba pedir invitar ofrecer'},{e:'👌',n:'ok perfecto genial entendido aprobado si'},{e:'🤌',n:'pellizco que dices dedos juntos atencion'},{e:'🤏',n:'poquito un poco pellizco corto medida'},
        {e:'✌️',n:'paz amor victoria dos dedos triunfo exito'},{e:'🤞',n:'dedos cruzados suerte ojala bendicion deseo'},{e:'🫰',n:'dedos corazon amor coreano chasquido dinero'},{e:'🤟',n:'te quiero te amo rock lengua senas afecto'},
        {e:'🤘',n:'cuernos rock metal concierto energia'},{e:'🤙',n:'llamame shaka relax buena vibra surfer'},{e:'👈',n:'apuntar izquierda mira aca hacia la izquierda'},{e:'👉',n:'apuntar derecha clic aqui enlace ir link ver'},
        {e:'👆',n:'apuntar arriba atencion leer arriba mira arriba'},{e:'👇',n:'apuntar abajo link boton inscribete descarga enlace'},{e:'☝️',n:'un momento atencion dedo indice primero'},{e:'🫵',n:'tu senalarte a ti te buscamos convocatoria'},
        {e:'👍',n:'pulgar arriba me gusta like si aprobado de acuerdo'},{e:'👎',n:'pulgar abajo dislike no desaprobado malo'},{e:'✊',n:'puno cerrado fuerza lucha resistencia poder'},{e:'👊',n:'puno al frente choque punos saludo amistad fuerza'},
        {e:'🤛',n:'puno izquierda choque'},{e:'🤜',n:'puno derecha choque acuerdo'},{e:'👏',n:'aplausos bravo felicitaciones palmas ovacion'},{e:'🙌',n:'manos arriba celebracion exito viva aleluya'},
        {e:'🫶',n:'manos formando corazon amor carino gratitud'},{e:'👐',n:'manos abiertas acogida abrazo apertura libro'},{e:'🤲',n:'palmas arriba rezo ofrenda suplica recibir'},{e:'🤝',n:'apreton de manos acuerdo trato confianza convenio'},
        {e:'🙏',n:'gracias por favor rezo respeto agradecimiento namaste'},{e:'✍️',n:'escribir apuntes firma nota redactar tareas'},{e:'💅',n:'pintarse unas esmalte estilo belleza arreglarse'},{e:'🤳',n:'selfie autofoto camara foto celular recuerdo'},
        {e:'💪',n:'musculo fuerza animo motivacion salud fitness'},{e:'🧠',n:'cerebro mente psicologia neuro cognicion pensamiento'},{e:'🫀',n:'corazon organo medicina cardiologia salud anatomia'},{e:'🫁',n:'pulmones respiracion salud neumologia oxigeno aire'},
        {e:'🦷',n:'diente muela odontologia sonrisa salud higiene'},{e:'🦴',n:'hueso ortopedia esqueleto firmeza anatomia'},{e:'👀',n:'ojos mirar atencion ver observar alerta curiosidad'},{e:'👁️',n:'ojo vista vision atencion mirada evaluacion'},
        {e:'👶',n:'bebe nene infantil recien nacido estimulacion temprana'},{e:'🧒',n:'infante nino pequeno desarrollo psicomotriz ninos'},{e:'👦',n:'nino varon hijo alumno escolar infancia'},{e:'👧',n:'nina nena hija alumna escolar infancia'},
        {e:'🧑',n:'persona joven adulto neutral individuo ser'},{e:'👱',n:'persona rubia rubio pelo claro'},{e:'👨',n:'hombre adulto masculino padre varon'},{e:'🧔',n:'hombre con barba barba caballero estilo'},
        {e:'👩',n:'mujer adulta femenina madre dama profesional'},{e:'🧓',n:'adulto mayor tercera edad vejez sabiduria anciano'},{e:'👴',n:'abuelo anciano viejo tercera edad sabiduria don'},{e:'👵',n:'abuela anciana viejita tercera edad carino dona'},
        {e:'👩‍⚕️',n:'doctora psicologa terapeuta especialista clinica salud medico'},{e:'👨‍⚕️',n:'doctor psicologo terapeuta especialista clinica salud medico'},{e:'👩‍🏫',n:'profesora docente maestra educadora formadora escuela'},{e:'👨‍🏫',n:'profesor docente maestro educador formador colegio'},
        {e:'👩‍🎓',n:'graduada licenciada egresada diplomada estudiante exito'},{e:'👨‍🎓',n:'graduado licenciado egresado diplomado estudiante exito'},{e:'👩‍💼',n:'profesional mujer ejecutiva oficina marketing gestion'},{e:'👨‍💼',n:'profesional hombre ejecutivo oficina administracion'},
        {e:'👩‍💻',n:'programadora informatica virtual zoom tecnologica online'},{e:'👨‍💻',n:'programador informatico virtual zoom tecnologico sistemas'},{e:'👩‍🔬',n:'cientifica investigadora quimica evaluadora laboratorio'},{e:'👨‍🔬',n:'cientifico investigador evaluador laboratorio ciencia'},
        {e:'👩‍🎨',n:'artista pintora creatividad arte taller expresion'},{e:'👨‍🎨',n:'artista pintor creatividad arte taller dibujo'},{e:'👩‍👧‍👦',n:'madre con hijos familia monoparental crianza hogar'},{e:'👨‍👩‍👧‍👦',n:'familia completa padres hijos hogar amor crianza'},
        {e:'👨‍👦',n:'padre e hijo papa varones union familia'},{e:'👩‍👦',n:'madre e hijo mama varon afecto crianza'},{e:'👩‍👧',n:'madre e hija mama nina carino hogar'},{e:'👨‍👧',n:'padre e hija papa nina carino proteccion'},
        {e:'🫂',n:'abrazo contencion soporte emocional psicologia apoyo'}
      ]
    },
    {
      id:'animales',name:'Animales & Naturaleza',
      emojis:[
        {e:'🐶',n:'perro perrito cachorro mascota lealtad canino'},{e:'🐱',n:'gato gatito minino mascota felino'},{e:'🐭',n:'raton ratoncito roedor tierno'},{e:'🐹',n:'hamster cobayo roedor mascota'},
        {e:'🐰',n:'conejo conejito pascua ternura orejas'},{e:'🦊',n:'zorro zorrito astuto bosque fauna'},{e:'🐻',n:'oso osito fuerza abrazo bosque'},{e:'🐼',n:'oso panda ternura china tierno'},
        {e:'🐨',n:'koala australia calma ternura abrazo'},{e:'🐯',n:'tigre felino fuerza rayas salvaje'},{e:'🦁',n:'leon rey fuerza liderazgo selva fauna'},{e:'🐮',n:'vaca ternero campo granja lechera'},
        {e:'🐷',n:'cerdito chanchito granja tierno'},{e:'🐸',n:'rana sapo naturaleza anfibio salto'},{e:'🐵',n:'mono monito selva travesura selva'},{e:'🙈',n:'mono tapandose ojos no ver verguenza ciego'},
        {e:'🙉',n:'mono tapandose orejas no oir sordo musica'},{e:'🙊',n:'mono tapandose boca no hablar silencio secreto'},{e:'🦉',n:'buho lechuza sabiduria inteligencia educacion noche'},{e:'🦅',n:'aguila vision vuelo altura libertad poder'},
        {e:'🐦',n:'pajaro ave cantar libertad vuelo trinar'},{e:'🐧',n:'pinguino frio polo ternura simpatia'},{e:'🦆',n:'pato patito laguna lago granja'},{e:'🦋',n:'mariposa transformacion cambio evolucion belleza psicologia'},
        {e:'🐝',n:'abeja laboriosidad miel polen trabajo equipo'},{e:'🐢',n:'tortuga perseverancia calma paciencia lento constante'},{e:'🐬',n:'delfin mar alegria inteligencia terapia marina'},{e:'🐳',n:'ballena gigante mar oceano paz libertad'},
        {e:'🐠',n:'pez tropical acuario pececito colores'},{e:'🐙',n:'pulpo multitarea inteligencia mar ocho brazos'},{e:'🦮',n:'perro guia soporte lazarillo terapia asistencia'},{e:'🐕',n:'perro canino mascota companero fiel'},
        {e:'🌱',n:'brote plantita semilla crecimiento desarrollo inicio florecer'},{e:'🌿',n:'hierba rama hojas naturaleza ecologia bienestar verde'},{e:'☘️',n:'trebol verde hoja naturaleza suerte'},{e:'🍀',n:'trebol cuatro hojas suerte bendicion prosperidad'},
        {e:'🎍',n:'bambu decoracion planta prosperidad'},{e:'🪴',n:'planta en maceta hogar cuidado verde decoracion'},{e:'🎋',n:'arbol de los deseos festival fiesta tanabata'},{e:'🍃',n:'hojas al viento brisa otono naturaleza aire fresco'},
        {e:'🍂',n:'hojas secas otono cambio estacion clima'},{e:'🍁',n:'hoja de arce maple otono canada hoja'},{e:'🍄',n:'hongo champinon bosque naturaleza mario'},{e:'🌾',n:'espiga trigo cosecha abundancia tierra pan'},
        {e:'💐',n:'ramo flores regalo detalle felicitaciones agradecimiento amor'},{e:'🌷',n:'tulipan flor primavera elegancia aroma belleza'},{e:'🌹',n:'rosa roja flor amor romance pasion carino'},{e:'🥀',n:'rosa marchita tristeza desamor duelo fin'},
        {e:'🌺',n:'hibisco flor tropical hawaii belleza selva'},{e:'🌸',n:'flor de cerezo sakura primavera japon delicado'},{e:'🌼',n:'flor margarita floracion pureza alegria'},{e:'🌻',n:'girasol alegria sol luz positividad energia vital'},
        {e:'🌞',n:'sol con cara calidez brillo buen dia manana sonriente'},{e:'🌝',n:'luna llena cara noche serenidad luz de luna'},{e:'🌛',n:'luna creciente cara cuarto menguante noche'},{e:'🌜',n:'luna cuarto creciente cara descanso sueno'},
        {e:'🌚',n:'luna nueva cara misterio picardia noche'},{e:'🌕',n:'luna llena brillante noche astronimia cielo'},{e:'🌑',n:'luna nueva oscura noche cielo astros'},{e:'🪐',n:'saturno planeta anillo universo espacio cosmos'},
        {e:'💫',n:'estrella fugaz vertigo mareo ilusion magia chispas'},{e:'⭐️',n:'estrella dorada favorito calificacion premio 5 estrellas'},{e:'🌟',n:'estrella brillante destello luz exito especial'},{e:'✨',n:'destellos magia resplandor limpio nuevo nuevo'},
        {e:'⚡',n:'rayo relampago tormenta electricidad energia rapidez'},{e:'💥',n:'colision choque explosion impacto boom impacto'},{e:'🔥',n:'fuego llama ardor calor pasion encendido hoguera'},{e:'🌪️',n:'tornado remolino tormenta viento fuerte huracan'},
        {e:'🌈',n:'arcoiris esperanza diversidad inclusion colores despues de lluvia'},{e:'☀️',n:'sol radiante despejado dia caluroso verano soleado'},{e:'🌤️',n:'sol entre nubes agradable clima templado manana'},{e:'⛅',n:'sol con nubes nublado suave tiempo cielo'},
        {e:'🌥️',n:'nublado sol timido gris tiempo clima'},{e:'☁️',n:'nube cielo nublado algodon esponjoso nubosidad'},{e:'🌦️',n:'lluvia con sol arcoiris clima variable'},{e:'🌧️',n:'lluvia paraguas gotas agua chubasco precipitaciones'},
        {e:'⛈️',n:'tormenta electrica truenos rayos relampagos lluvia fuerte'},{e:'🌨️',n:'nieve copos de nieve frio invierno nevada blanca'},{e:'❄️',n:'copo de nieve frio invierno helada clima congelado'},{e:'☃️',n:'muneco de nieve invierno navidad nieve divertido'},
        {e:'🌬️',n:'viento soplido brisa aire frescura respiracion'},{e:'💨',n:'rapido humo velocidad escape corriendo veloz'},{e:'💧',n:'gota de agua liquido pureza sudor refresco'},{e:'💦',n:'gotas de agua salpicadura esfuerzo sudor hidrata'},
        {e:'🌊',n:'ola de mar oceano tsunami agua fuerza marea playa'}
      ]
    },
    {
      id:'comida',name:'Comida & Bebidas',
      emojis:[
        {e:'🍏',n:'manzana verde manzana fruta fresca nutricion salud'},{e:'🍎',n:'manzana roja salud fruta fresca educacion bienestar'},{e:'🍐',n:'pera fruta jugosa dulce verde fibra'},{e:'🍊',n:'mandarina naranja citrico vitamina c fruta'},
        {e:'🍋',n:'limon limonada citrico acido fresco ceviche'},{e:'🍌',n:'platano banana fruta potasio energia merienda'},{e:'🍉',n:'sandia fruta verano hidratacion fresca dulce'},{e:'🍇',n:'uvas racimo fruta vino vendimia dulzura'},
        {e:'🍓',n:'fresa frutilla roja dulzura postre fruta'},{e:'🫐',n:'arandanos blueberries antioxidante salud fruta azul'},{e:'🍈',n:'melon fruta fresca dulce verano'},{e:'🍒',n:'cerezas fruta roja dulzura postre'},
        {e:'🍑',n:'durazno melocoton fruta suave dulce piel'},{e:'🥭',n:'mango fruta dulce tropical selva delicioso'},{e:'🍍',n:'pina anana fruta tropical diuretica fresca'},{e:'🥥',n:'coco agua de coco tropical playa palmera'},
        {e:'🥝',n:'kiwi fruta verde vitamina salud acido'},{e:'🍅',n:'tomate ensalada verdura salsa cocina fresca'},{e:'🥑',n:'palta aguacate crema ensalada saludable grasa buena'},{e:'🥦',n:'brocoli verdura salud nutricion verde almuerzo'},
        {e:'🌽',n:'choclo maiz maicena choclo peruano grano alimento'},{e:'🥕',n:'zanahoria verdura vista conejo nutricion ensalada'},{e:'🍞',n:'pan pan blanco desayuno tostada panaderia'},{e:'🥐',n:'medialuna croissant panaderia desayuno cafe'},
        {e:'🥖',n:'baguette pan frances panaderia cena crujiente'},{e:'🧀',n:'queso trozo de queso lacteo aperitivo piqueo'},{e:'🥚',n:'huevo proteina desayuno cocina alimento'},{e:'🍳',n:'huevo frito sarten desayuno proteina manana'},
        {e:'🥞',n:'panqueques pancakes desayuno miel jarabe dulce'},{e:'🧇',n:'waffles gofres desayuno dulce merienda'},{e:'🍕',n:'pizza porcion comida rapida cena fin de semana'},{e:'🍔',n:'hamburguesa burger comida rapida queso almuerzo'},
        {e:'🍟',n:'papas fritas papas crocantes comida rapida combo'},{e:'🥪',n:'sandwich emparedado lonche merienda refrigerio'},{e:'🌮',n:'taco comida mexicana almuerzo sazon antojito'},{e:'🌯',n:'burrito comida almuerzo enrollado'},
        {e:'🥗',n:'ensalada saludable dieta nutricion fresca almuerzo liviano'},{e:'🍝',n:'espaguetis fideos pasta salsa italiana almuerzo'},{e:'🍜',n:'ramen sopa fideos calientes sopa tallarines chifa'},{e:'🍲',n:'olla sopa guiso comida casera caliente olla'},
        {e:'🍛',n:'arroz con curry arroz comida caliente almuerzo'},{e:'🍣',n:'sushi maki pescado comida japonesa almuerzo roll'},{e:'🍱',n:'bento caja comida japonesa almuerzo ordenado'},{e:'🥟',n:'empanada dumpling dim sum comida masa bocado'},
        {e:'🍤',n:'langostino frito camarones tempura mariscos cebiche'},{e:'🍙',n:'onigiri bola de arroz comida merienda snack'},{e:'🍚',n:'arroz blanco tazon de arroz basico comida'},{e:'🍰',n:'torta porcion pastel dulce cumpleanos postre celebracion'},
        {e:'🎂',n:'torta de cumpleanos velas fiesta celebracion pastel anivesario'},{e:'🧁',n:'cupcake quequito dulce postre glaseado merienda'},{e:'🥧',n:'pie tarta pays manzana dulce postre'},{e:'🍦',n:'helado de cono barquillo vainilla postre frio'},
        {e:'🍧',n:'raspado helado de nieve postre hielo raspadilla'},{e:'🍨',n:'helado en copa dulce postre heladeria refresco'},{e:'🍩',n:'dona rosquilla dulce glaseado merienda antojo'},{e:'🍪',n:'galleta cookie con chispas de chocolate merienda'},
        {e:'🍫',n:'chocolate barra de chocolate cacao dulce regalo premio'},{e:'🍬',n:'caramelo dulce golosina ninos fiesta pinata'},{e:'🍭',n:'paleta chupetin chupete dulce ninos fiesta'},{e:'🍮',n:'flan crema volteada postre caramelo dulce'},
        {e:'🍯',n:'miel tarro de miel dulce natural abeja garganta'},{e:'🍿',n:'popcorn canchita palomitas cine pelicula merienda'},{e:'☕',n:'cafe taza pausa relajacion caliente coffee break manana desayuno'},{e:'🫖',n:'tetera te infusion caliente manzanilla relaxing'},
        {e:'🍵',n:'te verde infusion te caliente taza relajacion te'},{e:'🧃',n:'cajita de jugo bebida juguito ninos lonchera merienda'},{e:'🥤',n:'vaso con sorbete gaseosa refresco vaso frio bebida'},{e:'🧋',n:'bubble tea te de burbujas boba bebida merienda'},
        {e:'🥛',n:'vaso de leche calcio desayuno bebida lactea salud'},{e:'🍼',n:'biberon mamadera leche bebe lactancia crianza nene'},{e:'🥂',n:'copas de champan brindis celebracion exito salud chin chin'},{e:'🍷',n:'copa de vino tinto cena brindis celebracion noche'},
        {e:'🍾',n:'botella champan descorche brindis fiesta ano nuevo triunfo'},{e:'🍻',n:'cervezas brindis chop amigos fiesta encuentro fin de semana'}
      ]
    },
    {
      id:'actividades',name:'Actividades & Deportes',
      emojis:[
        {e:'⚽',n:'pelota futbol juego ninos partido gol deporte cancha'},{e:'🏀',n:'baloncesto basket pelota encestar deporte partido'},{e:'🏈',n:'futbol americano balon deporte partido touchdown'},{e:'⚾',n:'beisbol pelota bate deporte juego carrera'},
        {e:'🎾',n:'tenis raqueta pelota match punto cancha deporte'},{e:'🏐',n:'voleibol voley pelota remate bloqueo deporte voley'},{e:'🏉',n:'rugby balon deporte try contacto scrum'},{e:'🥏',n:'frisbee disco volador juego parque mascota diversion'},
        {e:'🎱',n:'billar bola 8 juego mesa bar taco punteria'},{e:'🏓',n:'ping pong tenis de mesa raqueta juego agilidad mesa'},{e:'🏸',n:'badminton pluma raqueta volante juego parque'},{e:'🥊',n:'guante de box boxeo lucha combate fuerza gimnasio'},
        {e:'🥋',n:'artes marciales judo karate taekwondo kimono disciplina cinturon'},{e:'🛹',n:'skate patineta tabla deporte urbano jovenes saltos'},{e:'🛼',n:'patines patinaje ruedas diversion deporte parque'},{e:'🏋️‍♂️',n:'levantamiento pesas hombre gimnasio fuerza musculos entrenamiento'},
        {e:'🏋️‍♀️',n:'levantamiento pesas mujer gimnasio fuerza entrenamiento fitness'},{e:'🤸‍♂️',n:'gimnasia voltereta pirueta elasticidad agilidad acrobacia'},{e:'🤸‍♀️',n:'gimnasia mujer voltereta pirueta agilidad acrobacia taller'},{e:'🧘‍♂️',n:'meditacion hombre yoga mindfulness relajacion calma mente'},
        {e:'🧘‍♀️',n:'meditacion mujer yoga mindfulness relajacion zen respiracion antiestres'},{e:'🏃‍♂️',n:'correr hombre atletismo maraton deporte velocidad cardio'},{e:'🏃‍♀️',n:'correr mujer atletismo maraton deporte ejercicio activa'},{e:'🚴‍♂️',n:'ciclismo hombre bicicleta pedalear paseo deporte aire libre'},
        {e:'🚴‍♀️',n:'ciclismo mujer bicicleta paseo deporte ruta salud'},{e:'🏊‍♂️',n:'natacion hombre nadar piscina agua deporte braza'},{e:'🏊‍♀️',n:'natacion mujer nadar piscina deporte agua aqua'},{e:'🧗‍♂️',n:'escalada alpinismo subida esfuerzo meta roca'},
        {e:'🧗‍♀️',n:'escalada mujer alpinismo montana esfuerzo cumbre'},{e:'🏆',n:'trofeo premio victoria copa campeon ganador reconocimiento'},{e:'🥇',n:'medalla de oro primer lugar primer puesto premio campeon ganadores'},{e:'🥈',n:'medalla de plata segundo puesto premio logro finalista'},
        {e:'🥉',n:'medalla de bronce tercer puesto podio premio reconocimiento'},{e:'🏅',n:'medalla deportiva honor merito logro participacion distincion'},{e:'🎖️',n:'medalla militar condecoracion merito honor servicio'},{e:'🏵️',n:'roseta premio cucarda flor condecoracion distincion'},
        {e:'🎫',n:'ticket entrada boleto pase inscripcion cupo evento pase libre'},{e:'🎟️',n:'boletos entradas cine teatro rifa sorteo evento ticket'},{e:'🎪',n:'carpa de circo espectaculo entretenimiento show ninos magia'},{e:'🎭',n:'mascaras de teatro drama comedia arte actuacion representacion psicologia'},
        {e:'🎨',n:'paleta de pintura arte oleo acuarela dibujo ninos creatividad terapia'},{e:'🎬',n:'claqueta cine pelicula video grabacion accion toma rodaje'},{e:'🎤',n:'microfono cantar voz conferencia discurso charla locucion'},{e:'🎧',n:'audifonos auriculares musica podcast concentracion audio escuchar'},
        {e:'🎼',n:'pentagrama notas musicales partitura solfeo composicion arte'},{e:'🎹',n:'teclado piano musica instrumento melodia notas clasico'},{e:'🥁',n:'tambor percusion ritmo bateria musica fiesta'},{e:'🎷',n:'saxofon jazz musica viento melodia instrumento'},
        {e:'🎺',n:'trompeta fanfarria aviso alerta musica sonido'},{e:'🎸',n:'guitarra rock acustica cuerda musica instrumento cancion'},{e:'🎻',n:'violin cuerda clasico orquesta musica elegancia'},{e:'🎲',n:'dado juego de mesa azar ludo probabilidad diversion'},
        {e:'♟️',n:'ajedrez peon estrategia inteligencia pensamiento tactica logica'},{e:'🎯',n:'diana con dardo punteria objetivo meta acierto precision'},{e:'🎳',n:'bowling bolos chuza juego diversion strikes'},{e:'🎮',n:'videojuegos mando control gamer consola play diversion ninos'},
        {e:'🧩',n:'rompecabezas pieza autismo puzzle logica encaje inclusion tea'},{e:'🎪',n:'circo espectaculo ilusion magia show'},{e:'🎡',n:'rueda de la fortuna parque atracciones vuelta diversion feria'},{e:'🎢',n:'montana rusa adrenalina emociones sube y baja parque feria'},
        {e:'🎠',n:'carrusel caballitos juegos mecanicos ninos infancia parque'}
      ]
    },
    {
      id:'viajes',name:'Viajes, Lugares & Banderas',
      emojis:[
        {e:'🇵🇪',n:'peru perú lima bandera nacional peruana centro kja patria peruano cusco arequipa'},
        {e:'🇲🇽',n:'mexico méxico bandera norteamerica cdmx azteca'},
        {e:'🇨🇴',n:'colombia bandera bogota sudamerica medellin'},
        {e:'🇦🇷',n:'argentina bandera buenos aires sudamerica'},
        {e:'🇨🇱',n:'chile bandera santiago sudamerica'},
        {e:'🇪🇸',n:'espana españa bandera madrid europa hispano peninsula'},
        {e:'🇺🇸',n:'usa estados unidos bandera american dolares norteamerica'},
        {e:'🇧🇷',n:'brasil bandera rio sao paulo sudamerica verdeamarela'},
        {e:'🏁',n:'bandera a cuadros meta final carrera llegada victoria inicio'},
        {e:'🚩',n:'bandera roja alerta punto bandera hito senalizar'},
        {e:'🏳️',n:'bandera blanca paz tregua calma rendicion armonia'},
        {e:'🏳️‍🌈',n:'bandera arcoiris orgullo lgtb diversidad inclusion respeto'},
        {e:'✈️',n:'avion vuelo viaje internacional lima peru pasaje aerolinea'},
        {e:'🛫',n:'despegue avion salida viaje partida inicio vuelo'},
        {e:'🛬',n:'aterrizaje avion llegada arribo retorno vuelta peru lima'},
        {e:'🛩️',n:'avioneta avion pequeno vuelo charter selva viaje'},
        {e:'🚀',n:'cohete despegue impulso lanzamiento velocidad futuro exito'},
        {e:'🚁',n:'helicoptero vuelo rescate transporte aereo'},
        {e:'🚂',n:'tren locomotora viaje ferrocarril paseo rieles'},
        {e:'🚆',n:'tren rapido expreso metro transporte viaje pasajeros'},
        {e:'🚇',n:'metro subterraneo tren electrico estacion lima transporte linea 1'},
        {e:'🚌',n:'autobus bus transporte publico colectivo viaje ruta paradero'},
        {e:'🚐',n:'furgoneta van combi colectivo transporte viaje grupo movilidad'},
        {e:'🚑',n:'ambulancia emergencia salud clinica urgencia medico auxilio socorro'},
        {e:'🚒',n:'bomberos camion de bomberos incendio rescate auxilio socorro 116'},
        {e:'🚓',n:'policia patrullero patrulla seguridad ciudadana auxilio 105'},
        {e:'🚕',n:'taxi taxi amarillo viaje movilidad traslado aeropuerto'},
        {e:'🚗',n:'auto carro coche vehiculo particular viaje transporte auto'},
        {e:'🚙',n:'camioneta suv vehiculo 4x4 viaje paseo familiar'},
        {e:'🚚',n:'camion transporte entrega delivery carga paquete logistica'},
        {e:'🏍️',n:'moto motocicleta transporte rapido velocidad delivery'},
        {e:'🛵',n:'scooter motito delivery pedidos reparto delivery'},
        {e:'🚲',n:'bicicleta ciclista ecologico dos ruedas paseo transporte salud'},
        {e:'🚏',n:'parada de bus paradero autobus estacion esperar transporte'},
        {e:'⛽',n:'gasolinera grifo combustible gasolina energia tanqueo petroleo'},
        {e:'🚨',n:'sirena policial luz roja giratoria emergencia alarma aviso urgente'},
        {e:'🚥',n:'semaforo luz verde luz roja transito senal vial cruce'},
        {e:'🛑',n:'stop senal de pare alto detente parada roja octogono'},
        {e:'🚧',n:'obras construccion desvio mantenimiento cuidado precaucion cono'},
        {e:'⚓',n:'ancla puerto barco mar firmeza marina fondeo amarre'},
        {e:'⛵',n:'velero barco vela mar paseo navegacion viento playa'},
        {e:'🚤',n:'lancha bote motor agua velocidad paseo laguna'},
        {e:'🛳️',n:'crucero barco transatlantico viaje oceano vacaciones turismo'},
        {e:'🚢',n:'barco de carga vapor buque navegacion puerto callao'},
        {e:'🗺️',n:'mapa mundi territorio guia ubicacion ruta geografia direccion'},
        {e:'🧭',n:'brujula orientacion norte guia direccion rumbo rumbo seguro'},
        {e:'🏔️',n:'montana con nieve cumbre nevado cordillera andes cusco huanuco'},
        {e:'⛰️',n:'montana cerro paisaje naturaleza senderismo trekking sierra'},
        {e:'🏖️',n:'playa sombrilla arena mar vacaciones sol verano descanso costa'},
        {e:'🏝️',n:'isla desierta palmera mar tropical escape descanso selva'},
        {e:'🏕️',n:'campamento carpa fogata naturaleza acampar noche estrellas'},
        {e:'🏛️',n:'edificio clasico columnas palacio institucion museo universidad corte'},
        {e:'🏗️',n:'construccion grua edificio en obra proyecto arquitectura base'},
        {e:'🏠',n:'casa hogar vivienda domicilio familia calor de hogar departamento'},
        {e:'🏡',n:'casa con jardin hogar calido familia vivienda residencia'},
        {e:'🏢',n:'oficina edificio rascacielos empresa corporativo trabajo sede'},
        {e:'🏥',n:'hospital salud clinica consultorio terapia medicina kja emergencias'},
        {e:'🏦',n:'banco dinero finanzas entidad prestamo deposito ventanilla'},
        {e:'🏨',n:'hotel hospedaje alojamiento descanso turismo viaje habitacion'},
        {e:'🏪',n:'tienda 24 horas tambo minimarket abierta comercio bodega'},
        {e:'🏫',n:'escuela colegio educacion primaria secundaria academia aula clases'},
        {e:'🏬',n:'centro comercial mall tiendas departamentos compras galeria'},
        {e:'🏰',n:'castillo fortaleza cuento historia arquitectura clasico'},
        {e:'💒',n:'iglesia de bodas matrimonio capilla amor celebracion nupcial'},
        {e:'⛪',n:'iglesia templo capilla fe oracion culto comunidad'},
        {e:'⛲',n:'fuente de agua parque plaza pileta centro lima chorros'},
        {e:'🌃',n:'noche estrellada ciudad nocturno rascacielos estrellas luces'},
        {e:'🏙️',n:'paisaje urbano rascacielos ciudad moderna skyline lima metropolis'},
        {e:'🌅',n:'amanecer puesta sol atardecer ocaso cielo colores playa litoral'},
        {e:'🌐',n:'globo terraqueo meridianos internet web mundial internacional online'},
        {e:'🌎',n:'planeta tierra america peru sudamerica mundo mapa global continente'}
      ]
    },
    {
      id:'objetos',name:'Objetos & Tecnología',
      emojis:[
        {e:'💻',n:'laptop computadora portatil pc zoom online virtual curso remoto'},
        {e:'🖥️',n:'computadora de escritorio monitor pantalla mac pc aula informatica'},
        {e:'🖨️',n:'impresora imprimir documentos material fisico guia ficha separata'},
        {e:'⌨️',n:'teclado escribir tipeo computacion atajos redaccion'},
        {e:'🖱️',n:'mouse raton clic cursor boton seleccionar puntero'},
        {e:'💾',n:'disquete guardar salvar datos respaldo archivo backup memoria'},
        {e:'💿',n:'disco cd software musica instalador material digital'},
        {e:'📱',n:'celular movil smartphone telefono whatsapp app red social contacto'},
        {e:'📲',n:'celular llamada flecha mensaje entrante whatsapp contacto link'},
        {e:'☎️',n:'telefono fijo llamada oficina atencion al cliente recepcion'},
        {e:'📞',n:'auricular telefono llamada recepcion soporte contactanos informes'},
        {e:'🔋',n:'bateria energia carga porcentaje pila durabilidad poder'},
        {e:'🔌',n:'enchufe electrico cable conexion corriente enchufe energia'},
        {e:'💡',n:'foco bombilla idea iluminacion tip consejo clave ingenio luz'},
        {e:'🔦',n:'linterna luz iluminar buscar guiar exploracion foco'},
        {e:'🕯️',n:'vela luz calidez tranquilidad paz meditacion esperanza veladora'},
        {e:'💵',n:'billete dolar dinero efectivo pago precio costo soles inversion'},
        {e:'🪙',n:'moneda soles ahorro precio costo inversion cambio vuelto'},
        {e:'💰',n:'bolsa de dinero costo inversion ganancia sueldo presupuesto precio'},
        {e:'💳',n:'tarjeta debito credito visa mastercard pago pos yape plin transferencia'},
        {e:'💎',n:'diamante joya valor valioso exclusivo premium lujo brillo'},
        {e:'⚖️',n:'balanza justicia equilibrio evaluacion ponderacion equidad derecho'},
        {e:'🪜',n:'escalera ascenso peldanos subir progreso crecimiento superacion nivel'},
        {e:'🧰',n:'caja de herramientas recursos utilidades pack kit instrumentos solucion'},
        {e:'🔧',n:'llave inglesa reparacion ajuste soporte mantenimiento tecnica tuerca'},
        {e:'🔨',n:'martillo construccion accion golpe trabajo esfuerzo clavo'},
        {e:'🛠️',n:'herramientas martillo y llave tecnicas habilidades recursos aplicacion'},
        {e:'⚙️',n:'engranaje configuracion ajustes proceso mecanica sistema soporte'},
        {e:'🧲',n:'iman atraccion atraer prospectos clientes atencion jalar magnetismo'},
        {e:'🛡️',n:'escudo proteccion defensa seguridad blindaje amparo bienestar kja'},
        {e:'🔑',n:'llave clave acceso contrasena contrasena solucion apertura ingreso'},
        {e:'🗝️',n:'llave antigua secreta historia clave profunda misterio'},
        {e:'🔒',n:'candado cerrado seguridad privacidad confidencial protegido reserva'},
        {e:'🔓',n:'candado abierto disponible libre desbloqueado acceso permitido'},
        {e:'🔔',n:'campana notificacion alerta aviso campana recordatorio aviso'},
        {e:'🔕',n:'campana tachada silencio no molestar modo silencio pausa concentracion'},
        {e:'📣',n:'megafono aviso difusion publicidad llamado a la accion altavoz'},
        {e:'📢',n:'altavoz comunicado voz alta atencion urgente informe aviso publico'},
        {e:'💬',n:'burbuja chat texto mensaje conversacion comentario testimonio opinion'},
        {e:'💭',n:'burbuja de pensamiento sueno idea reflexion pensar imaginacion'},
        {e:'✉️',n:'sobre carta correo mensaje correspondencia email atencion'},
        {e:'📧',n:'email correo electronico contacto mensaje digital bandeja'},
        {e:'📨',n:'sobre entrando correo recibido inbox correspondencia recibida'},
        {e:'📩',n:'sobre con flecha enviar formulario inscripcion correo enviado remite'},
        {e:'📦',n:'paquete caja envio entrega delivery encomienda empaque producto'},
        {e:'🏷️',n:'etiqueta descuento rebaja precio promocion especial oferta tag'},
        {e:'📜',n:'pergamino diploma certificado historia ley acreditacion acta titulo'},
        {e:'📃',n:'pagina enrollada curriculum reporte carta documento leccion'},
        {e:'📄',n:'pagina documento hoja oficio archivo informe escrito texto'},
        {e:'📑',n:'marcadores pestanas separador indice fichas etiquetas temario'},
        {e:'🧾',n:'recibo factura comprobante pago voucher constancia cancelado'},
        {e:'📊',n:'grafico barras estadistica investigacion resultados progreso metricas evaluacion'},
        {e:'📈',n:'grafico subida alza crecimiento exito rentabilidad incremento mejora'},
        {e:'📉',n:'grafico bajada disminucion reduccion caida descenso'},
        {e:'🗒️',n:'bloc de notas libreta espiral apuntes notas borrador agenda'},
        {e:'🗓️',n:'calendario hojas dias agenda cita reunion fecha cronograma'},
        {e:'📅',n:'calendario fecha dia evento cronograma inicio fecha limite'},
        {e:'📋',n:'portapapeles planilla tabla checklist requisitos orden lista de cotejo'},
        {e:'📁',n:'carpeta archivos folder documentos expediente legajo organizacion'},
        {e:'📂',n:'carpeta abierta archivos seleccionados ver documentos material'},
        {e:'📰',n:'periodico diario titular prensa noticia novedades comunicado'},
        {e:'📓',n:'cuaderno libreta apuntes notas diario de campo registro'},
        {e:'📚',n:'libros estudio educacion psicologia biblioteca material lectura temario'},
        {e:'📖',n:'libro abierto lectura leccion capitulo manual lectura reflexiva'},
        {e:'🔖',n:'marcador de pagina libro lectura recordar capitulo'},
        {e:'🔗',n:'enlace link hipervinculo cadena conexion web url acortador'},
        {e:'📎',n:'clip sujetapapeles documento adjunto archivo clip oficina papel'},
        {e:'📐',n:'escuadra regla triangulo precision diseno medicion geometria'},
        {e:'📏',n:'regla medida tamano medicion exactitud lineal centimetro'},
        {e:'📌',n:'chincheta fija tachuela pin fijar destacar nota corcho'},
        {e:'📍',n:'pin rojo ubicacion mapa sede presencial lima direccion'},
        {e:'🔍',n:'lupa buscar examen investigacion evaluacion rastreo detalle'},
        {e:'🔎',n:'lupa derecha buscar rastrear analisis detalle hallazgo'},
        {e:'🔬',n:'microscopio ciencia laboratorio analisis clinico estudio celulas'},
        {e:'🔭',n:'telescopio vision futuro mirar lejos astronomia horizonte'},
        {e:'💉',n:'jeringa inyeccion vacuna salud medicina clinica tratamiento dosis'},
        {e:'💊',n:'pastilla capsula medicina tratamiento farmacia medicamento receta'},
        {e:'🩹',n:'curita venda bendita herida sanar recuperacion salud botiquin'},
        {e:'🩺',n:'estetoscopio medico doctor especialista salud consulta auscultacion kja'},
        {e:'🚪',n:'puerta entrada oportunidad acceso apertura ingreso bienvenida'},
        {e:'🪟',n:'ventana vista panorama oportunidad claridad luz abrirse'},
        {e:'🛒',n:'carrito de compras comprar tienda catalogo productos ecommerce adquirir'}
      ]
    },
    {
      id:'simbolos',name:'Símbolos & Corazones',
      emojis:[
        {e:'❤️',n:'corazon rojo amor carino pasion salud afecto empatia'},
        {e:'🩷',n:'corazon rosa tierno dulce amabilidad afecto calidez'},
        {e:'🧡',n:'corazon naranja energia vitalidad calor entusiasmo creatividad'},
        {e:'💛',n:'corazon amarillo amistad alegria felicidad luz gratitud'},
        {e:'💚',n:'corazon verde salud esperanza naturaleza bienestar vida ecologia'},
        {e:'💙',n:'corazon azul confianza lealtad kja tranquilidad calma seguridad serenidad'},
        {e:'🩵',n:'corazon celeste serenidad frescura cielo armonia paz'},
        {e:'💜',n:'corazon morado creatividad sabiduria espiritual respeto magia'},
        {e:'🤎',n:'corazon marron tierra cafe calidez naturaleza firmeza'},
        {e:'🖤',n:'corazon negro elegancia luto noche seriedad estilo'},
        {e:'🩶',n:'corazon gris neutralidad serenidad equilibrio plata'},
        {e:'🤍',n:'corazon blanco pureza paz sinceridad luz tranquilidad'},
        {e:'💔',n:'corazon roto dolor duelo quiebre herida tristeza separacion'},
        {e:'❤️‍🔥',n:'corazon en fuego pasion motivacion encendido entusiasmo ardor'},
        {e:'❤️‍🩹',n:'corazon sanando recuperacion superacion terapia resiliencia curar'},
        {e:'❣️',n:'exclamacion de corazon enfasis amoroso atencion carino vital'},
        {e:'💕',n:'dos corazones carino ternura romance afecto mutuo complicidad'},
        {e:'💞',n:'corazones girando emocion amor mutuo conexion sentimiento'},
        {e:'💓',n:'corazon latiendo emocion vida latido pulso vitalidad'},
        {e:'💗',n:'corazon creciendo agrandandose afecto amor inmenso ternura'},
        {e:'💖',n:'corazon brillante destellos magia especial carino deslumbrante'},
        {e:'💘',n:'flecha de cupido flechazo enamorarse amor sorpresa atraccion'},
        {e:'💝',n:'corazon con lazo regalo especial obsequio detalle para ti'},
        {e:'💟',n:'decoracion de corazon adorno marco amoroso violeta'},
        {e:'✨',n:'destellos magia brillo estrellas nuevo especial calidad'},
        {e:'⭐',n:'estrella dorada favorito evaluacion distincion calificacion'},
        {e:'🌟',n:'estrella brillante destello luz resplandor exito meta'},
        {e:'⚡',n:'rayo energia electricidad rapido poder inmediato'},
        {e:'☀️',n:'sol radiante dia luz resplandor calidez optimismo'},
        {e:'💥',n:'explosion choque boom impacto sorpresa fuerza'},
        {e:'⚠️',n:'advertencia peligro alerta precaucion cuidado aviso atencion'},
        {e:'⛔',n:'prohibido el paso no entrar cerrado restriccion alto'},
        {e:'🚫',n:'prohibido cancelado no permitido restringido denegado'},
        {e:'🛑',n:'stop pare detente alto senal roja freno pausa'},
        {e:'✅',n:'check verde verificado confirmado correcto si aprobado realizado'},
        {e:'✔️',n:'check marca visto bueno confirmado listo aprobado comprobado'},
        {e:'☑️',n:'casilla marcada check lista checklist aprobado completado'},
        {e:'❌',n:'cruz roja error falso denegado fallo equivocacion no incorrecto'},
        {e:'❓',n:'signo de interrogacion rojo duda consulta pregunta ayuda que es'},
        {e:'❔',n:'signo de interrogacion blanco pregunta duda consulta'},
        {e:'❗',n:'signo de exclamacion rojo alerta importante advertencia atencion'},
        {e:'❕',n:'signo de exclamacion blanco atencion nota aviso'},
        {e:'‼️',n:'doble exclamacion urgente atencion maxima imperdible anuncio clave'},
        {e:'⁉️',n:'interrogacion y exclamacion sorpresa incredulidad que paso duda asombro'},
        {e:'💯',n:'cien puntos perfecto sobresaliente maxima nota 100 por ciento total'},
        {e:'🆒',n:'cool genial chevere excelente estilo bacan'},
        {e:'🆓',n:'free gratis gratuito sin costo beca libre sin pagar'},
        {e:'🆕',n:'new nuevo novedad estreno recien llegado primicia'},
        {e:'🔝',n:'top lo mejor arriba destacado numero uno primer puesto excelencia'},
        {e:'🆙',n:'up arriba subir mejora promocion ascender subir nivel'},
        {e:'🆗',n:'ok de acuerdo perfecto aprobado si todo bien correcto'},
        {e:'🆘',n:'sos auxilio emergencia ayuda socorro urgencia pedido'},
        {e:'🔗',n:'enlace link cadena web url hipervinculo conectar'},
        {e:'➡️',n:'flecha derecha siguiente continuar adelante enlace ir avanzar'},
        {e:'⬅️',n:'flecha izquierda atras volver regresar retorno retroceder'},
        {e:'⬆️',n:'flecha arriba subir ascenso arriba hacia arriba'},
        {e:'⬇️',n:'flecha abajo descarga link enlace inscribete abajo ver abajo'},
        {e:'↗️',n:'flecha diagonal arriba derecha enlace externo abrir web whatsapp link'},
        {e:'⤵️',n:'flecha curva abajo bajar clic aqui descargar registrarte'},
        {e:'🔄',n:'flechas giratorias actualizar recargar sincronizar refrescar ciclo'},
        {e:'➕',n:'suma agregar mas anadir nuevo extra beneficio suma'},
        {e:'➖',n:'resta menos quitar reducir descuento rebaja'},
        {e:'♾️',n:'infinito ilimitado para siempre continuo permanente sin limite'},
        {e:'💲',n:'signo de dolar precio costo dinero valor inversion soles'},
        {e:'🔴',n:'circulo rojo punto advertencia vivo en directo atencion'},
        {e:'🔵',n:'circulo azul kja confianza punto azul sede color'},
        {e:'🟢',n:'circulo verde activo online disponible abierto en linea matricula'},
        {e:'🟡',n:'circulo amarillo aviso precaucion pendiente en espera'},
        {e:'🟠',n:'circulo naranja energia atencion punto naranja color'},
        {e:'🟣',n:'circulo morado violeta distincion punto color'}
      ]
    }
  ];

  let activeEmojiTarget=el('copy');
  function setEmojiTarget(target){
    if(!target)return;
    activeEmojiTarget=target;
    const label=el('emoji-target-label');
    const isPrompt=target===el('refine-prompt');
    const isWa=target===el('whatsapp-message');
    if(label){
      if(isPrompt)label.textContent='Prompt de IA';
      else if(isWa)label.textContent='WhatsApp de campaña';
      else label.textContent='Texto de publicación';
    }
    const btnCopy=el('emoji-target-copy');
    const btnPrompt=el('emoji-target-prompt');
    const btnWa=el('emoji-target-whatsapp');
    if(btnCopy)btnCopy.classList?.toggle?.('is-active',!isPrompt&&!isWa);
    if(btnPrompt)btnPrompt.classList?.toggle?.('is-active',isPrompt);
    if(btnWa)btnWa.classList?.toggle?.('is-active',isWa);
  }

  if(el('emoji-target-copy'))el('emoji-target-copy').onclick=()=>{setEmojiTarget(el('copy'));el('copy')?.focus?.();};
  if(el('emoji-target-prompt'))el('emoji-target-prompt').onclick=()=>{setEmojiTarget(el('refine-prompt'));el('refine-prompt')?.focus?.();};
  if(el('emoji-target-whatsapp'))el('emoji-target-whatsapp').onclick=()=>{setEmojiTarget(el('whatsapp-message'));el('whatsapp-message')?.focus?.();};

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
    }else if(target===el('refine-prompt')){
      const chips=typeof document!=='undefined'&&document.querySelectorAll?document.querySelectorAll('.marketing-ai-chip'):null;
      if(chips?.length)chips.forEach(c=>c.classList?.remove?.('is-active'));
    }
  }

  function renderEmojis(query=''){
    const list=el('emoji-list');
    if(!list)return;
    list.replaceChildren();
    const rawQ=String(query||'').trim();
    const q=normalizeSearchText(rawQ);
    if(q){
      const matched=[];
      EMOJI_CATEGORIES.forEach(cat=>{
        cat.emojis.forEach(item=>{
          const nameNorm=normalizeSearchText(item.n);
          if(item.e.includes(rawQ)||nameNorm.includes(q)){
            if(!matched.some(m=>m.e===item.e))matched.push(item);
          }
        });
      });
      if(!matched.length){
        const empty=document.createElement('div');
        empty.className='marketing-emoji-empty';
        const emptyIcon=document.createElement('span');
        emptyIcon.className='marketing-emoji-empty-icon';
        emptyIcon.textContent='🔍';
        const emptyText=document.createElement('span');
        emptyText.textContent='No se encontraron emojis con "'+rawQ+'"';
        empty.append(emptyIcon,emptyText);
        list.append(empty);
        return;
      }
      const title=document.createElement('div');
      title.className='marketing-emoji-category-title';
      const titleText=document.createElement('span');
      titleText.textContent='RESULTADOS DE BÚSQUEDA';
      const badge=document.createElement('span');
      badge.className='marketing-emoji-category-count';
      badge.textContent=String(matched.length);
      title.append(titleText,badge);
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
      title.id='mk-cat-'+cat.id;
      const titleText=document.createElement('span');
      titleText.textContent=cat.name;
      const badge=document.createElement('span');
      badge.className='marketing-emoji-category-count';
      badge.textContent=String(cat.emojis.length);
      title.append(titleText,badge);
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
          const search=el('emoji-search');
          if(search&&search.value){
            search.value='';
            const clearBtn=el('emoji-search-clear');
            if(clearBtn)clearBtn.hidden=true;
            renderEmojis('');
          }
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
  el('update-link').onclick=()=>run(async()=>{const d=data();KJAMarketing.link(d.telefono,d.mensaje);await shorten();el('destination').textContent='WhatsApp de ventas: '+d.telefono;status(id?'Enlace corto actualizado. Tus ediciones del texto se conservan.':'Adjunta un flyer para crear su enlace corto.');});
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
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){historyGeneration++;reset();available=false;isAdmin=false;adminScope='me';selectedAuthor='todos';teamAuthors=[];if(el('scope-container'))el('scope-container').hidden=true;if(el('author-wrap'))el('author-wrap').hidden=true;if(el('history-title'))el('history-title').textContent='Mis publicaciones';config={ia:false,facebook:false,puede_publicar:false};el('history').replaceChildren();historyRows=[];draftCache.clear();historyOffset=0;historyMore=false;el('search').value='';historyFilter='all';el('history-count').textContent='0';document.getElementById('nav-marketing').hidden=true;}});
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
