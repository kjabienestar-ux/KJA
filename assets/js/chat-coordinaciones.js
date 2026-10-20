/* Extiende la mensajería compartida por usuarios y administradores.
   Operate: conserva los colores KJA; acciones junto al mensaje, borrador siempre visible.
   El servidor decide capacidades y permisos. Sin migración se conserva el chat anterior. */
(function(){
  'use strict';
  const MAX=20*1024*1024;
  const types={
    pdf:'application/pdf',txt:'text/plain',csv:'text/csv',doc:'application/msword',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    webm:'video/webm',mp4:'video/mp4',mp3:'audio/mpeg',m4a:'audio/mp4',ogg:'audio/ogg',wav:'audio/wav',
    jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'
  };
  const allowed=new Set([...Object.values(types),'audio/webm']);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const btn=(text,action,cls='chat-action')=>{const n=el('button',cls,text);n.type='button';n.onclick=action;return n};
  const args=w=>w.group?{p_grupo:w.groupId}:{p_contacto:w.id};
  const errorText=e=>e?.code==='P0001'?e.message:'No se pudo completar. Vuelve a intentar.';
  function validateFile(file){
    const mime=(file.type||types[file.name?.split('.').pop().toLowerCase()]||'').split(';')[0];
    if(!allowed.has(mime))throw Error('Elige un documento, imagen, video o audio compatible.');
    if(!file.size||file.size>MAX)throw Error('El archivo debe pesar entre 1 byte y 20 MB.');
    if(!file.name||file.name.length>180)throw Error('Usa un nombre de archivo de hasta 180 caracteres.');
    return mime;
  }
  async function generatePdfThumbnail(fileOrBlob){
    try{
      if(typeof window==='undefined')return null;
      if(!window.pdfjsLib){
        await new Promise((resolve,reject)=>{
          const s=document.createElement('script');
          s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload=()=>{
            if(window.pdfjsLib){
              window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            resolve();
          };
          s.onerror=reject;
          document.head.append(s);
        });
      }
      if(window.pdfjsLib){
        const buffer=await fileOrBlob.arrayBuffer();
        const pdf=await window.pdfjsLib.getDocument({data:buffer}).promise;
        const page=await pdf.getPage(1);
        const viewport=page.getViewport({scale:1.2});
        const canvas=document.createElement('canvas');
        canvas.width=viewport.width;
        canvas.height=viewport.height;
        const ctx=canvas.getContext('2d');
        await page.render({canvasContext:ctx,viewport}).promise;
        return {
          url:canvas.toDataURL('image/jpeg',0.85),
          numPages:pdf.numPages
        };
      }
    }catch(e){}
    return null;
  }
  function createDocMockupCover(name, mime, pages, sizeMb){
    const cover=el('div','chat-doc-mockup');
    const isPdf=mime==='application/pdf'||name?.toLowerCase().endsWith('.pdf');
    const ribbon=el('div','chat-doc-mockup-ribbon',isPdf?'PDF OFICIAL':'DOCUMENTO');
    const logo=el('div','chat-doc-mockup-logo','KJA Bienestar');
    const title=el('div','chat-doc-mockup-title',name.replace(/\.[^.]+$/,''));
    const lines=el('div','chat-doc-mockup-lines');
    for(let i=0;i<4;i++)lines.append(el('span'));
    const footer=el('div','chat-doc-mockup-footer');
    footer.append(el('span','',`${pages||1} ${pages===1?'página':'páginas'}`),el('span','',`${sizeMb} MB`));
    cover.append(ribbon,logo,title,lines,footer);
    return cover;
  }
  function renderDocComposerPreview(w, file, thumbUrl, numPages){
    const card=el('div','chat-doc-composer-preview');
    const coverWrap=el('div','chat-doc-composer-cover');
    if(thumbUrl){
      const img=el('img','chat-doc-cover-img');
      img.src=thumbUrl;img.alt=file.name;
      coverWrap.append(img);
    }else{
      coverWrap.append(createDocMockupCover(file.name,file.type,numPages,(file.size/1024/1024).toFixed(1)));
    }
    const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
    const infoBar=el('div','chat-doc-composer-info');
    const badge=el('span',isPdf?'chat-doc-badge-pdf':'chat-doc-badge-pdf chat-doc-badge-doc',isPdf?'PDF':'DOC');
    const metaWrap=el('div','chat-doc-meta-wrap');
    const title=el('strong','chat-doc-title',file.name);
    const sub=el('span','chat-doc-sub',`${numPages||1} pág · ${(file.size/1024/1024).toFixed(1)} MB · ${isPdf?'pdf':'doc'}`);
    metaWrap.append(title,sub);

    const discard=btn('Quitar',()=>{
      if(w.sending)return;
      clear(w);w.pending=null;w.input.oninput();
    },'chat-doc-discard');
    discard.innerHTML='<span class="sr-only">Quitar</span><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    discard.title='Descartar documento';

    infoBar.append(badge,metaWrap,discard);
    card.append(coverWrap,infoBar);
    w.filePreview.replaceChildren(card);
  }
  function startLiveRecordingUi(w, recording, stream){
    const form=w.el.querySelector('.chat-compose');
    if(form)form.classList.add('is-recording');
    const bar=el('div','chat-recording-bar');
    const discardBtn=btn('Quitar',()=>{
      recording.cancel=true;
      try{if(recording.recorder.state==='recording')recording.recorder.stop()}catch{}
      stream.getTracks().forEach(t=>t.stop());
      recording.cleanUi?.();
      clear(w);
      w.input.oninput();
    },'chat-rec-discard');
    discardBtn.innerHTML='<span class="sr-only">Quitar</span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
    discardBtn.title='Descartar grabación';

    const capsule=el('div','chat-rec-capsule');
    const dot=el('span','chat-rec-dot');
    const timer=el('span','chat-rec-timer','0:00');
    const waveform=el('div','chat-rec-waveform');
    const bars=[];
    for(let i=0;i<24;i++){
      const b=el('span','chat-rec-bar');
      b.style.animationDelay=(i*0.035)+'s';
      waveform.append(b);
      bars.push(b);
    }
    capsule.append(dot,timer,waveform);

    const stopBtn=el('button','chat-rec-stop');
    stopBtn.type='button';
    stopBtn.title='Detener grabación';
    stopBtn.setAttribute('aria-label','Detener grabación');
    stopBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    stopBtn.onclick=()=>{
      if(recording.recorder.state==='recording')recording.recorder.stop();
    };

    bar.append(discardBtn,capsule,stopBtn);
    w.filePreview.replaceChildren(bar);

    const startTime=Date.now();
    const timerInterval=setInterval(()=>{
      if(!w.recording||recording.cancel){clearInterval(timerInterval);return}
      const sec=Math.floor((Date.now()-startTime)/1000);
      timer.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    },500);

    let audioCtx=null,analyserInterval=null;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(AC){
        audioCtx=new AC();
        const srcNode=audioCtx.createMediaStreamSource(stream);
        const analyser=audioCtx.createAnalyser();
        analyser.fftSize=64;
        srcNode.connect(analyser);
        const data=new Uint8Array(analyser.frequencyBinCount);
        analyserInterval=setInterval(()=>{
          if(!w.recording||recording.cancel){clearInterval(analyserInterval);audioCtx?.close().catch(()=>{});return}
          analyser.getByteFrequencyData(data);
          for(let i=0;i<bars.length;i++){
            const val=data[i%data.length]||0;
            const h=Math.max(4,Math.min(24,Math.round(val/255*24)));
            bars[i].style.height=h+'px';
          }
        },70);
      }
    }catch{}

    recording.cleanUi=()=>{
      clearInterval(timerInterval);
      if(analyserInterval)clearInterval(analyserInterval);
      if(audioCtx)audioCtx.close().catch(()=>{});
      if(form)form.classList.remove('is-recording');
    };
  }
  function clear(w){
    w.mediaGeneration=(w.mediaGeneration||0)+1;
    if(w.recording){w.recording.cancel=true;try{if(w.recording.recorder.state!=='inactive')w.recording.recorder.stop()}catch{}w.recording.stream.getTracks().forEach(t=>t.stop());clearTimeout(w.recording.timeout);w.recording.cleanUi?.();w.recording=null}
    if(w.attachment?.url)URL.revokeObjectURL(w.attachment.url);
    w.attachment=null;w.recordingPending=false;
    w.filePreview?.replaceChildren();if(w.fileInput)w.fileInput.value='';
    if(w.mic)w.mic.textContent='Grabar audio';
    const form=w.el?.querySelector('.chat-compose');
    if(form)form.classList.remove('is-recording');
  }
  function mode(w,kind,message){
    if(!w.modeBar||w.sending||w.recording||w.recordingPending)return;
    if(kind==='editar'&&(w.attachment||w.input.value.trim())&&!confirm('¿Reemplazar el borrador para editar este mensaje?'))return;
    if(kind==='editar'){clear(w);w.savedDraft=w.input.value;w.editing=message;w.reply=null;w.input.value=message.contenido}
    else {if(w.editing)w.input.value=w.savedDraft||'';w.editing=null;w.reply=message}
    w.pending=null;
    w.modeBar.replaceChildren(el('span','',`${kind==='editar'?'Editando':'Responder a '+(message.autor||'mensaje')}: ${message.contenido.slice(0,120)}`),
      btn('Cancelar',()=>resetMode(w,true)));
    w.modeBar.hidden=false;w.input.oninput();w.input.focus();
  }
  function resetMode(w,restore=false){
    if(restore&&w.editing)w.input.value=w.savedDraft||'';
    w.editing=null;w.reply=null;w.savedDraft=null;w.pending=null;
    w.modeBar.hidden=true;w.modeBar.replaceChildren();w.input.oninput();
  }
  function statusCheckSvg(mine, read, isGroup){
    if(!mine || isGroup) return '';
    if(read){
      return '<span class="chat-status-check is-read" title="Leído"><svg viewBox="0 0 16 11" width="15" height="11" fill="none"><path d="M11.05.5a.75.75 0 0 0-1.1.06L5.7 6.03 3.65 3.98a.75.75 0 1 0-1.06 1.06l2.6 2.6a.75.75 0 0 0 1.08-.03l4.8-5.75a.75.75 0 0 0-.02-.96z" fill="#53bdeb"/><path d="M15.05.5a.75.75 0 0 0-1.1.06L9.7 6.03l-.78-.79a.75.75 0 1 0-1.06 1.06l1.33 1.33a.75.75 0 0 0 1.08-.03l4.8-5.75a.75.75 0 0 0-.02-.96z" fill="#53bdeb"/></svg></span>';
    }
    return '<span class="chat-status-check" title="Enviado"><svg viewBox="0 0 12 11" width="12" height="11" fill="none"><path d="M11.05.5a.75.75 0 0 0-1.1.06L4.7 7.03 2.15 4.48a.75.75 0 1 0-1.06 1.06l3.1 3.1a.75.75 0 0 0 1.08-.03l5.8-7.25a.75.75 0 0 0-.02-.96z" fill="#8696a0"/></svg></span>';
  }
  function clockIconSvg(){
    return '<span class="chat-clock-icon" title="Enviando…"><svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg></span>';
  }
  function createPendingBubble(w, a, content){
    const entry = el('div', 'chat-message is-pending');
    entry.dataset.mine = 'true';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
    const clockSvg = clockIconSvg();
    const hasCaption = !!content;

    if (a) {
      entry.classList.add('chat-msg-media');
      if (!hasCaption) entry.classList.add('has-media-only');
      else entry.classList.add('has-media-caption');

      const attachment = el('div', 'chat-file');

      if (a.mime?.startsWith('audio/')) {
        entry.classList.add('is-voice-message');
        const voiceBubble = el('div', 'chat-voice-bubble is-uploading');
        const avWrap = el('div', 'chat-voice-avatar-wrap');
        const av = el('span', 'chat-avatar', 'YO');
        av.dataset.tone = '1';
        const micBadge = el('span', 'chat-voice-mic-badge');
        micBadge.innerHTML = '<svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
        avWrap.append(av, micBadge);

        const uploadRing = el('div', 'chat-upload-ring is-audio');
        uploadRing.innerHTML = '<svg viewBox="0 0 36 36" width="34" height="34"><circle class="chat-upload-track" cx="18" cy="18" r="14" fill="none" stroke="rgba(0,168,132,0.25)" stroke-width="3"/><circle class="chat-upload-spin" cx="18" cy="18" r="14" fill="none" stroke="#00a884" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="20" stroke-linecap="round"/></svg><span class="chat-upload-center-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#00a884" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg></span>';

        const body = el('div', 'chat-voice-body');
        const track = el('div', 'chat-voice-track');
        const heights = [6,12,18,8,22,14,10,20,16,24,12,18,8,14,20,10,22,16,8,12,18,14,10,6];
        heights.forEach(h => { const b = el('span', 'chat-voice-bar'); b.style.height = h + 'px'; track.append(b); });

        const meta = el('div', 'chat-voice-meta');
        const time = el('span', 'chat-voice-time', '0:00');
        const speed = el('span', 'chat-voice-speed', '1x');
        const status = el('span', 'chat-voice-status');
        status.innerHTML = `${timeStr} ${clockSvg}`;
        meta.append(time, speed, status);

        body.append(track, meta);
        voiceBubble.append(avWrap, uploadRing, body);
        attachment.append(voiceBubble);
        entry.append(attachment);
      } else if (a.mime?.startsWith('image/')) {
        entry.classList.add('is-image-message');
        const imgWrap = el('div', 'chat-img-wrap is-uploading');
        const img = el('img');
        img.src = a.url || (a.blob ? URL.createObjectURL(a.blob) : '');
        img.alt = a.name || 'Imagen';

        const centerRing = el('div', 'chat-upload-center-ring');
        centerRing.innerHTML = '<div class="chat-upload-ring"><svg viewBox="0 0 36 36" width="40" height="40"><circle class="chat-upload-track" cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3"/><circle class="chat-upload-spin" cx="18" cy="18" r="14" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="20" stroke-linecap="round"/></svg><span class="chat-upload-center-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg></span></div>';

        const badge = el('div', 'chat-img-time-badge');
        badge.innerHTML = `${timeStr} ${clockSvg}`;

        imgWrap.append(img, centerRing, badge);
        attachment.append(imgWrap);
        entry.append(attachment);
      } else {
        entry.classList.add('is-doc-message');
        const isPdf = a.mime === 'application/pdf' || a.name?.toLowerCase().endsWith('.pdf');
        const docWrap = el('div', 'chat-doc-bubble-wrap is-uploading');
        const docCard = el('div', 'chat-doc-card-v2');
        const coverWrap = el('div', 'chat-doc-cover-wrap');
        const mockup = createDocMockupCover(a.name, a.mime, 1, ((a.blob?.size || 0) / 1024 / 1024).toFixed(1));
        const centerRing = el('div', 'chat-upload-center-ring');
        centerRing.innerHTML = '<div class="chat-upload-ring"><svg viewBox="0 0 36 36" width="38" height="38"><circle class="chat-upload-track" cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3"/><circle class="chat-upload-spin" cx="18" cy="18" r="14" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="20" stroke-linecap="round"/></svg><span class="chat-upload-center-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg></span></div>';
        coverWrap.append(mockup, centerRing);

        const infoBar = el('div', 'chat-doc-info-bar');
        const badge = el('span', isPdf ? 'chat-doc-badge-pdf' : 'chat-doc-badge-pdf chat-doc-badge-doc', isPdf ? 'PDF' : 'DOC');
        const details = el('div', 'chat-doc-details');
        const title = el('strong', 'chat-doc-title', a.name);
        const sub = el('span', 'chat-doc-sub', `1 pág · ${((a.blob?.size || 0) / 1024 / 1024).toFixed(1)} MB · ${isPdf ? 'pdf' : 'doc'}`);
        details.append(title, sub);
        const status = el('span', 'chat-doc-status');
        status.innerHTML = `${timeStr} ${clockSvg}`;
        infoBar.append(badge, details, status);

        docCard.append(coverWrap, infoBar);
        docWrap.append(docCard);
        attachment.append(docWrap);
        entry.append(attachment);
      }

      if (hasCaption) {
        const bubble = el('p', 'chat-bubble chat-media-caption', content);
        formatBubble(bubble, content);
        const time = el('time', 'chat-time-pill');
        time.innerHTML = `${timeStr} ${clockSvg}`;
        entry.append(bubble, time);
      }
    } else {
      const bubble = el('p', 'chat-bubble', content);
      formatBubble(bubble, content);
      const time = el('time', 'chat-time-pill');
      time.innerHTML = `${timeStr} ${clockSvg}`;
      entry.append(bubble, time);
    }

    return entry;
  }
  async function send(w,db,user,current){
    if(w.editing){
      const {data,error}=await db.rpc('chat_v2_accion',{p_grupo:w.group,p_id:w.editing.id,p_accion:'editar',p_texto:w.input.value.trim()});
      if(error)throw error;return data;
    }
    const a=w.attachment,pending=w.pending;
    let pendingEl=null;
    if(w.history&&typeof w.history.append==='function'){
      pendingEl=createPendingBubble(w,a,w.input.value.trim());
      if(pendingEl){
        w.history.append(pendingEl);
        w.history.scrollTop=w.history.scrollHeight;
      }
    }
    try{
      if(a&&!pending.uploaded){
        const path=user+'/'+pending.id;
        const {error}=await db.storage.from('chat-archivos').upload(path,a.blob,{contentType:a.mime,upsert:false});
        if(error&&String(error.statusCode)!=='409'&&error.error!=='Duplicate')throw error;
        if(!current(w)){pendingEl?.remove();return null}
        pending.uploaded=true;
      }
      const {data,error}=await db.rpc('chat_v2_enviar',{...args(w),p_cliente_id:pending.id,p_contenido:w.input.value.trim(),
        p_respuesta:w.reply?.id||null,p_archivo:a?user+'/'+pending.id:null,p_nombre:a?.name||null});
      if(error)throw error;
      return data;
    }catch(err){
      pendingEl?.remove();
      throw err;
    }
  }
  function mount(w,form,head,api){
    w.modeBar=el('div','chat-compose-context');w.modeBar.hidden=true;form.before(w.modeBar);
    w.filePreview=el('div','chat-file-preview');form.before(w.filePreview);
    const toolbar=el('div','chat-compose-tools');form.before(toolbar);
    const file=el('input');file.type='file';file.accept=Object.keys(types).map(ext=>'.'+ext).join(',');file.hidden=true;w.fileInput=file;toolbar.append(file);
    async function prepare(f){
      if(w.sending||w.compressing||w.editing||w.recordingPending)return;
      const generation=w.mediaGeneration||0;
      try{
        let mime=validateFile(f);
        if(mime.startsWith('image/')&&window.KJAChatImages){
          w.compressing=true;w.input.oninput();api.note(w,'Preparando imagen…');
          const blob=await window.KJAChatImages.compress(f);
          if(!api.current(w)||(w.mediaGeneration||0)!==generation)return;
          f=new File([blob],f.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});mime='image/jpeg';
        }
        clear(w);w.pending=null;
        w.attachment={blob:f,mime,name:f.name,key:crypto.randomUUID(),url:URL.createObjectURL(f)};
        if(mime.startsWith('audio/')){
          const audioBar=el('div','chat-audio-bar');
          const discardBtn=btn('Quitar',()=>{if(w.sending)return;clear(w);w.pending=null;w.input.oninput()},'chat-audio-discard');
          discardBtn.innerHTML='<span class="sr-only">Quitar</span><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          discardBtn.title='Descartar audio';discardBtn.setAttribute('aria-label','Descartar audio');

          const capsule=el('div','chat-audio-capsule');
          const playBtn=el('button','chat-audio-play');playBtn.type='button';
          playBtn.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';

          const player=el('audio');player.src=w.attachment.url;player.preload='metadata';
          const waveform=el('div','chat-audio-waveform');
          const heights=[6,12,18,8,22,14,10,20,16,24,12,18,8,14,20,10,22,16,8,12,18,14,10,6];
          const bars=heights.map(h=>{const b=el('span','chat-waveform-bar');b.style.height=h+'px';waveform.append(b);return b});

          const timer=el('span','chat-audio-timer','+ 0:00');
          player.onloadedmetadata=()=>{if(player.duration&&isFinite(player.duration)){const s=Math.round(player.duration);timer.textContent='+ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}};
          player.ontimeupdate=()=>{const cur=player.currentTime||0,dur=player.duration||1,s=Math.round(cur);timer.textContent='+ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0');const pct=cur/dur;bars.forEach((b,i)=>b.classList.toggle('is-played',(i/bars.length)<=pct))};
          player.onended=()=>{playBtn.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';bars.forEach(b=>b.classList.remove('is-played'))};
          playBtn.onclick=()=>{
            if(player.paused){player.play().then(()=>{playBtn.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'}).catch(()=>{})}
            else{player.pause();playBtn.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'}
          };
          capsule.append(playBtn,waveform,timer,player);

          const sendVoiceBtn=el('button','chat-audio-send');sendVoiceBtn.type='button';sendVoiceBtn.title='Enviar audio';
          sendVoiceBtn.innerHTML='<span class="sr-only">Enviar audio</span><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
          sendVoiceBtn.onclick=()=>form.requestSubmit();

          audioBar.append(discardBtn,capsule,sendVoiceBtn);
          w.filePreview.replaceChildren(audioBar);
        } else if(mime==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')||mime.startsWith('text/')||mime.includes('document')||mime.includes('sheet')||mime.includes('presentation')||mime.includes('msword')||mime.includes('excel')||mime.includes('powerpoint')){
          renderDocComposerPreview(w,f,null,1);
          if(mime==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){
            const key=w.attachment.key;
            void generatePdfThumbnail(f).then(res=>{
              if(res?.url&&w.attachment?.key===key){
                renderDocComposerPreview(w,f,res.url,res.numPages);
              }
            });
          }
        } else if(mime.startsWith('image/')){
          const previewWrap=el('div','chat-image-preview-tile');
          const img=el('img');img.src=w.attachment.url;img.alt='Imagen adjunta';
          const removeBtn=btn('Quitar',()=>{if(w.sending)return;clear(w);w.pending=null;w.input.oninput()},'chat-image-preview-remove');
          removeBtn.innerHTML='<span class="sr-only">Quitar</span><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          removeBtn.title='Quitar imagen adjunta';removeBtn.setAttribute('aria-label','Quitar imagen adjunta');
          const badge=el('span','chat-image-preview-badge',`${f.name} · ${(f.size/1024/1024).toFixed(1)} MB`);
          previewWrap.append(img,removeBtn,badge);
          w.filePreview.replaceChildren(previewWrap);
        } else {
          const chip=el('div','chat-file-chip');
          const icon=el('span','chat-file-chip-icon');
          icon.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
          const info=el('span','chat-file-chip-info',f.name+' · '+(f.size/1024/1024).toFixed(1)+' MB');
          const remove=btn('Quitar',()=>{if(w.sending)return;clear(w);w.pending=null;w.input.oninput()},'chat-file-chip-remove');
          remove.innerHTML='<span class="sr-only">Quitar</span><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          chip.append(icon,info,remove);
          w.filePreview.replaceChildren(chip);
        }
        w.input.oninput();api.note(w,'');
      }catch(e){if(api.current(w))api.note(w,e.message,true)}
      finally{w.compressing=false;if(api.current(w))w.input.oninput()}
    }
    toolbar.append(btn('Adjuntar',()=>{if(!w.sending&&!w.editing&&!w.recording)file.click()}));
    file.onchange=()=>{if(file.files?.[0])void prepare(file.files[0])};
    w.mic=btn('Grabar audio',async()=>{
      if(w.recording){if(w.recording.recorder.state==='recording'){w.mic.disabled=true;w.recording.recorder.stop()}return}
      if(w.sending||w.compressing||w.editing||w.recordingPending)return;
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){api.note(w,'Este navegador no permite grabar. Puedes adjuntar un audio.',true);return}
      if(w.attachment&&!confirm('¿Reemplazar el archivo adjunto con una nota de voz?'))return;
      clear(w);const generation=w.mediaGeneration;
      w.recordingPending=true;w.input.oninput();w.mic.disabled=true;
      let stream;
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        if(!api.current(w)||generation!==w.mediaGeneration){stream.getTracks().forEach(t=>t.stop());return}
        const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
        if(!mime)throw Error('Formato de grabación no compatible. Adjunta un audio.');
        const recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];
        const recording={recorder,stream,cancel:false,timeout:null};let size=0;
        w.recording=recording;w.recordingPending=false;
        recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>MAX&&recorder.state==='recording')recorder.stop()}};
        recorder.onerror=()=>{recording.cancel=true;clear(w);w.mic.disabled=false;w.input.oninput();api.note(w,'No se pudo grabar. Vuelve a intentar.',true)};
        recorder.onstop=()=>{
          clearTimeout(recording.timeout);stream.getTracks().forEach(t=>t.stop());
          recording.cleanUi?.();
          if(w.recording===recording)w.recording=null;
          if(!api.current(w)||recording.cancel)return;
          w.mic.disabled=false;w.mic.textContent='Grabar audio';
          const base=mime.split(';')[0],ext=base==='audio/mp4'?'m4a':base==='audio/ogg'?'ogg':'webm';
          void prepare(new File(chunks,'Nota de voz.'+ext,{type:base}));w.input.oninput();
        };
        startLiveRecordingUi(w, recording, stream);
        recorder.start(1000);w.mic.textContent='Detener grabación';w.mic.disabled=false;
        recording.timeout=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},120000);
        api.note(w,'Grabando audio · máximo 2 minutos. Pulsa Detener para escucharlo antes de enviar.');w.input.oninput();
      }catch(e){stream?.getTracks().forEach(t=>t.stop());if(api.current(w)){api.note(w,e.name==='NotAllowedError'?'Permite el micrófono en tu navegador para grabar.':e.message,true)}}
      finally{if(api.current(w)&&generation===w.mediaGeneration){w.recordingPending=false;w.mic.disabled=false;w.input.oninput()}}
    });
    toolbar.append(w.mic);
    const searchToggle=btn('Buscar',()=>{searchBox.hidden=!searchBox.hidden;if(!searchBox.hidden)query.focus()},'chat-action chat-search-toggle');toolbar.append(searchToggle);
    const searchBox=el('form','chat-message-search');searchBox.hidden=true;
    const query=el('input');query.type='search';query.maxLength=200;query.placeholder='Buscar en esta conversación';query.setAttribute('aria-label',query.placeholder);
    const submit=el('button','chat-action','Buscar');submit.type='submit';
    const results=el('div','chat-search-results');results.setAttribute('aria-live','polite');
    const close=btn('Cerrar',()=>{w.searchGeneration=(w.searchGeneration||0)+1;submit.disabled=false;searchBox.hidden=true;results.replaceChildren();w.input.focus()});
    searchBox.append(query,submit,close,results);w.history.before(searchBox);
    let before=null;
    async function searchMore(more=false){
      const text=query.value.trim();if(!text)return;
      const request=w.searchGeneration=(w.searchGeneration||0)+1;
      submit.disabled=true;if(!more){results.replaceChildren(el('p','','Buscando…'));before=null}
      try{
        const {data,error}=await api.db.rpc('chat_v2_historial',{...args(w),p_buscar:text,p_antes:more?before:null});
        if(!api.current(w)||request!==w.searchGeneration)return;if(error)throw error;
        if(!more)results.replaceChildren();
        results.querySelector('.chat-search-more')?.remove();
        for(const m of data||[]){
          const item=el('article','chat-search-result');
          item.append(el('small','',(m.autor||'Mensaje')+' · '+new Date(m.creado_at).toLocaleString('es-PE')),el('p','',m.contenido));
          if(m.archivo_nombre)item.append(el('small','',m.archivo_nombre));
          item.append(btn('Responder',()=>{mode(w,'responder',m);searchBox.hidden=true}));results.append(item);
        }
        if(!data?.length&&!more)results.append(el('p','','No hay coincidencias.'));
        if(data?.length===50){before=data.at(-1).id;results.append(btn('Más resultados',()=>void searchMore(true),'chat-action chat-search-more'))}
      }catch(e){if(api.current(w)&&request===w.searchGeneration)results.replaceChildren(el('p','',errorText(e)))}
      finally{if(api.current(w)&&request===w.searchGeneration)submit.disabled=false}
    }
    searchBox.onsubmit=e=>{e.preventDefault();void searchMore()};
    w.modernApi=api;
    if(w.group&&api.capabilities().administrar_grupos)toolbar.append(btn('Integrantes',()=>void groupInfo(w,api),'chat-action'));
    if(api.togglePin){
      const isPinned=api.isPinned?.(w.id);
      const pinBtn=btn(isPinned?'Desfijar':'Fijar',()=>{
        api.togglePin(w.id);
        const p=api.isPinned?.(w.id);
        pinBtn.textContent=p?'Desfijar':'Fijar';
        pinBtn.setAttribute('aria-pressed',String(p));
      },'chat-action chat-pin-btn');
      pinBtn.setAttribute('aria-pressed',String(isPinned));
      pinBtn.title='Fijar conversación arriba en la lista';
      head.append(pinBtn);
    }
    const headSearch=el('button','chat-icon chat-head-search');headSearch.type='button';headSearch.title='Buscar en el chat';
    headSearch.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    headSearch.onclick=()=>{searchBox.hidden=!searchBox.hidden;if(!searchBox.hidden)query.focus()};
    head.append(headSearch);

    const attachBtn=el('button','chat-icon chat-attach-plus');attachBtn.type='button';
    attachBtn.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.2" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    attachBtn.title='Adjuntar';

    const sheet=el('div','chat-attach-sheet');sheet.hidden=true;
    function opt(label,color,iconSvg,action){
      const b=el('button','chat-sheet-item');b.type='button';
      const ic=el('span','chat-sheet-icon');ic.style.color=color;ic.innerHTML=iconSvg;
      b.append(ic,el('span','chat-sheet-label',label));
      b.onclick=(e)=>{e.stopPropagation();sheet.hidden=true;action()};return b;
    }
    sheet.append(
      opt('Fotos y videos','#007aff','<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',()=>{file.accept='image/*,video/*';file.click()}),
      opt('Documento','#0ea5e9','<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',()=>{file.accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';file.click()}),
      opt('Audio','#8b5cf6','<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M10 9v6l5-3-5-3z"/></svg>',()=>{file.accept='audio/*';file.click()}),
      opt('Nota de voz','#10b981','<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',()=>w.mic.click()),
      opt('Buscar','#64748b','<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',()=>searchToggle.click())
    );
    if(w.group&&api.capabilities().administrar_grupos){
      sheet.append(opt('Integrantes','#f59e0b','<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',()=>void groupInfo(w,api)));
    }
    attachBtn.onclick=(e)=>{e.stopPropagation();sheet.hidden=!sheet.hidden};
    w.el.addEventListener('click',(e)=>{if(!sheet.contains(e.target)&&e.target!==attachBtn)sheet.hidden=true});

    const composerMic=el('button','chat-send chat-composer-mic');composerMic.type='button';
    composerMic.title='Grabar nota de voz';composerMic.setAttribute('aria-label','Grabar nota de voz');
    composerMic.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    composerMic.onclick=()=>{if(!w.sending&&!w.compressing)w.mic.click()};

    function updateComposerUi(){
      const hasContent=Boolean(w.input.value.trim()||w.attachment);
      composerMic.hidden=hasContent;
      w.send.hidden=!hasContent;
      if(w.recording){
        composerMic.classList.add('is-recording');
        composerMic.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      }else{
        composerMic.classList.remove('is-recording');
        composerMic.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      }
    }
    const origInput=w.input.oninput;
    w.input.oninput=()=>{if(origInput)origInput();updateComposerUi()};
    w.updateComposerUi=updateComposerUi;
    updateComposerUi();

    form.append(attachBtn,composerMic,sheet);
  }
  function groupPanel(parent,title){
    parent.querySelector('.chat-group-editor')?.remove();
    const box=el('section','chat-group-editor'),heading=el('header'),content=el('div','chat-group-content'),status=el('p','chat-status');
    status.setAttribute('role','status');heading.append(el('strong','',title),btn('Cerrar',()=>box.remove()));
    box.append(heading,content,status);parent.append(box);return {box,content,status};
  }
  function createGroup(parent,api){
    const session=api.session();
    const {box,content,status}=groupPanel(parent,'Crear grupo privado');
    const name=el('input');name.placeholder='Nombre del grupo';name.maxLength=60;name.setAttribute('aria-label','Nombre del grupo');
    const help=el('p','','Solo las personas que agregues podrán ver el grupo y su historial.');
    const people=el('div','chat-group-people'),selected=new Set();
    for(const c of api.contacts().filter(c=>c.activo)){
      const label=el('label'),check=el('input');check.type='checkbox';check.onchange=()=>{if(check.checked)selected.add(c.id);else selected.delete(c.id)};
      label.append(check,el('span','',c.nombre));people.append(label);
    }
    const save=btn('Crear grupo',async()=>{
      if(session!==api.session()||!box.isConnected)return;
      if(!name.value.trim()||!selected.size){status.textContent='Escribe un nombre y selecciona al menos una persona.';return}
      save.disabled=true;status.textContent='Creando grupo…';
      const identity=api.user();
      try{
        const {error}=await api.db.rpc('chat_grupo_crear',{p_nombre:name.value.trim(),p_miembros:[...selected]});
        if(identity!==api.user()||session!==api.session()||!box.isConnected)return;if(error)throw error;
        await api.refresh();box.remove();
      }catch(e){if(identity===api.user()&&session===api.session()&&box.isConnected)status.textContent=errorText(e)}
      finally{save.disabled=false}
    });
    content.append(help,name,people,save);name.focus();
  }
  async function groupInfo(w,api){
    const {box,content,status}=groupPanel(w.el,'Integrantes del grupo');status.textContent='Cargando…';
    try{
      const {data,error}=await api.db.rpc('chat_grupo_detalle',{p_grupo:w.groupId});
      if(!api.current(w)||!box.isConnected)return;if(error)throw error;status.textContent='';
      const owner=data.creador===api.user();
      async function manage(action,id=null,name=null){
        if(w.groupBusy)return;w.groupBusy=true;status.textContent='Guardando…';
        try{
          const {error}=await api.db.rpc('chat_grupo_administrar',{p_grupo:w.groupId,p_accion:action,p_usuario:id,p_nombre:name});
          if(!api.current(w)||!box.isConnected)return;if(error)throw error;await api.refresh();await groupInfo(w,api);
        }catch(e){if(api.current(w)&&box.isConnected)status.textContent=errorText(e)}finally{w.groupBusy=false}
      }
      content.append(el('p','',data.privado?'Grupo privado · Los integrantes pueden consultar el historial compartido.':'Grupo abierto del equipo.'));
      if(owner){
        const name=el('input');name.value=data.nombre;name.maxLength=60;name.setAttribute('aria-label','Nombre del grupo');
        content.append(name,btn('Guardar nombre',()=>void manage('nombre',null,name.value)));
      }
      const people=el('div','chat-group-people');
      for(const person of data.miembros||[]){
        const row=el('div','chat-group-person');row.append(el('span','',person.nombre+(person.id===data.creador?' · Admin. del grupo':'')));
        if(owner&&person.id!==api.user()){
          row.append(btn('Quitar',()=>{if(confirm('¿Quitar a '+person.nombre+' del grupo?'))void manage('quitar',person.id)}));
          if(person.activo)row.append(btn('Hacer admin.',()=>{if(confirm('¿Transferir la administración a '+person.nombre+'?'))void manage('transferir',person.id)}));
        }
        people.append(row);
      }
      content.append(people);
      if(owner){
        const select=el('select');select.setAttribute('aria-label','Persona que se agregará al grupo');
        for(const c of api.contacts().filter(c=>c.activo&&!data.miembros.some(p=>p.id===c.id))){const o=el('option','',c.nombre);o.value=c.id;select.append(o)}
        const add=btn('Agregar persona',()=>{if(select.value)void manage('agregar',select.value)});add.disabled=!select.children.length;content.append(select,add);
      }
    }catch(e){if(api.current(w)&&box.isConnected)status.textContent=errorText(e)}
  }
  function formatBubble(bubble,text){
    if(!text||bubble.dataset.formatted)return;
    if(!/(https?:\/\/|\*|_|~)/i.test(text))return;
    const walker=document.createTreeWalker(bubble,4,null,false);
    const textNodes=[];let current;
    while((current=walker.nextNode()))textNodes.push(current);
    for(const node of textNodes){
      const val=node.nodeValue;
      if(!val||!/(https?:\/\/|\*|_|~)/i.test(val))continue;
      const frag=document.createDocumentFragment();
      const urlRegex=/(https?:\/\/[^\s<>"']+)/i;
      const urlParts=val.split(urlRegex);
      for(const part of urlParts){
        if(!part)continue;
        if(urlRegex.test(part)){
          const a=el('a','chat-link',part);
          a.href=part;a.target='_blank';a.rel='noopener noreferrer';
          frag.append(a);
        }else{
          const fmtRegex=/(\*[^*\n\r]+\*|_[^_\n\r]+_|~[^~\n\r]+~)/;
          const fmtParts=part.split(fmtRegex);
          for(const f of fmtParts){
            if(!f)continue;
            if(f.startsWith('*')&&f.endsWith('*')&&f.length>2){
              frag.append(el('strong','',f.slice(1,-1)));
            }else if(f.startsWith('_')&&f.endsWith('_')&&f.length>2){
              frag.append(el('em','',f.slice(1,-1)));
            }else if(f.startsWith('~')&&f.endsWith('~')&&f.length>2){
              frag.append(el('del','',f.slice(1,-1)));
            }else{
              frag.append(document.createTextNode(f));
            }
          }
        }
      }
      if(node.parentNode)node.parentNode.replaceChild(frag,node);
    }
    bubble.dataset.formatted='true';
  }
  function render(entry,m,w,api){
    entry.dataset.messageId=m.id;
    if(m.editado_at)entry.append(el('small','chat-edited','Editado'));
    if(m.eliminado_at){entry.dataset.deleted='true';return}
    const bubble=entry.querySelector('.chat-bubble');
    if(bubble)formatBubble(bubble,m.contenido);
    if(m.respuesta){
      const quote=el('blockquote','chat-quote');quote.append(el('strong','',m.respuesta.autor||'Mensaje'),el('span','',m.respuesta.contenido));entry.prepend(quote);
    }
    const isMine=m.remitente===api.user();
    const date=new Date(m.creado_at);
    const timeStr=date.toLocaleTimeString('es-PE',{hour:'numeric',minute:'2-digit'});
    const statusSvg=statusCheckSvg(isMine,!!m.leido_at,!!w.group);
    const rootTime=entry.querySelector(':scope > time');
    if(rootTime&&!m.archivo_path){
      rootTime.innerHTML=`${timeStr} ${statusSvg}`;
      rootTime.classList.add('chat-time-pill');
    }
    if(m.archivo_path){
      const hasCaption=m.contenido&&m.contenido!=='Archivo adjunto'&&m.contenido.trim().length>0;
      if(!hasCaption){
        bubble?.remove();
        rootTime?.remove();
        entry.classList.add('chat-msg-media','has-media-only');
      }else{
        entry.classList.add('chat-msg-media','has-media-caption');
        bubble?.classList.add('chat-media-caption');
        if(rootTime){
          rootTime.innerHTML=`${timeStr} ${statusSvg}`;
          rootTime.classList.add('chat-time-pill');
        }
      }
      const attachment=el('div','chat-file');
      if(m.archivo_mime?.startsWith('audio/')){
        entry.classList.add('is-voice-message');
        const voiceBubble=el('div','chat-voice-bubble');
        
        const avWrap=el('div','chat-voice-avatar-wrap');
        const av=el('span','chat-avatar',m.autor?.slice(0,2)?.toUpperCase()||'YO');
        av.dataset.tone=String((m.autor||'').charCodeAt(0)%6);
        const micBadge=el('span','chat-voice-mic-badge');
        micBadge.innerHTML='<svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
        avWrap.append(av,micBadge);
        voiceBubble.append(avWrap);

        const playBtn=el('button','chat-voice-play');playBtn.type='button';
        playBtn.title='Reproducir nota de voz';playBtn.setAttribute('aria-label','Reproducir nota de voz');
        playBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';

        const track=el('div','chat-voice-track');
        const heights=[6,12,18,8,22,14,10,20,16,24,12,18,8,14,20,10,22,16,8,12,18,14,10,6];
        const bars=heights.map(h=>{const b=el('span','chat-voice-bar');b.style.height=h+'px';track.append(b);return b});

        const meta=el('div','chat-voice-meta');
        const time=el('span','chat-voice-time','0:00');
        const speedBtn=el('button','chat-voice-speed','1x');speedBtn.type='button';speedBtn.title='Velocidad de reproducción';
        const vStatus=el('span','chat-voice-status');
        vStatus.innerHTML=`${timeStr} ${statusSvg}`;
        meta.append(time,speedBtn,vStatus);

        const body=el('div','chat-voice-body');body.append(track,meta);
        const audio=el('audio');audio.preload='metadata';
        let signed=null,loading=false;const speeds=[1,1.5,2];let sIdx=0;
        speedBtn.onclick=(e)=>{e.stopPropagation();sIdx=(sIdx+1)%speeds.length;audio.playbackRate=speeds[sIdx];speedBtn.textContent=speeds[sIdx]+'x'};

        async function loadAndPlay(){
          if(loading)return;
          if(!signed){
            loading=true;playBtn.disabled=true;
            try{
              const {data,error}=await api.db.storage.from('chat-archivos').createSignedUrl(m.archivo_path,300);
              if(!api.current(w)||!voiceBubble.isConnected)return;
              if(error||!data?.signedUrl)throw error||Error();
              signed=data.signedUrl;audio.src=signed;
            }catch{if(api.current(w))api.note(w,'No se pudo cargar el audio. Vuelve a intentar.',true);return}
            finally{loading=false;playBtn.disabled=false}
          }
          if(audio.paused){
            audio.play().then(()=>{playBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'}).catch(()=>{});
          }else{
            audio.pause();playBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
          }
        }
        playBtn.onclick=e=>{e.stopPropagation();void loadAndPlay()};
        track.onclick=e=>{
          e.stopPropagation();if(!audio.duration||!isFinite(audio.duration))return;
          const rect=track.getBoundingClientRect();
          const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
          audio.currentTime=pct*audio.duration;
        };
        audio.onloadedmetadata=()=>{if(audio.duration&&isFinite(audio.duration)){const s=Math.round(audio.duration);time.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}};
        audio.ontimeupdate=()=>{const cur=audio.currentTime||0,dur=audio.duration||1,s=Math.round(cur);time.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');const pct=cur/dur;bars.forEach((b,i)=>b.classList.toggle('is-played',(i/bars.length)<=pct))};
        audio.onended=()=>{playBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';bars.forEach(b=>b.classList.remove('is-played'))};

        voiceBubble.append(playBtn,body,audio);
        attachment.append(voiceBubble);
      }else if(m.archivo_mime?.startsWith('image/')){
        entry.classList.add('is-image-message');
        const imgWrap=el('div','chat-img-wrap');
        const badge=el('div','chat-img-time-badge');
        badge.innerHTML=`${timeStr} ${statusSvg}`;
        const load=btn('Ver imagen '+m.archivo_nombre,async()=>{
          load.disabled=true;
          try{
            const {data,error}=await api.db.storage.from('chat-archivos').createSignedUrl(m.archivo_path,300);
            if(!api.current(w)||!imgWrap.isConnected)return;if(error||!data?.signedUrl)throw error||Error();
            const link=el('a','chat-img-link');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';
            link.setAttribute('aria-label','Abrir imagen en tamaño completo');
            const image=el('img');image.src=data.signedUrl;image.alt=m.archivo_nombre;image.loading='lazy';
            image.onerror=()=>{imgWrap.replaceChildren(load,badge);load.disabled=false;load.textContent='Reintentar imagen'};
            link.append(image);imgWrap.replaceChildren(link,badge);
          }catch{if(api.current(w))api.note(w,'No se pudo abrir la imagen.',true)}finally{load.disabled=false}
        },'chat-img-btn');
        imgWrap.append(load,badge);attachment.append(imgWrap);load.click();
      }else{
        entry.classList.add('is-doc-message');
        const isPdf=m.archivo_mime==='application/pdf'||m.archivo_nombre?.toLowerCase().endsWith('.pdf');
        const docWrap=el('div','chat-doc-bubble-wrap');
        
        const fwdBtn=el('button','chat-doc-forward-btn');fwdBtn.type='button';fwdBtn.title='Reenviar documento';
        fwdBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12v-2a4 4 0 014-4h8.5M13 3l5 3-5 3"/><path d="M20 12v2a4 4 0 01-4 4H7.5M11 21l-5-3 5-3"/></svg>';
        fwdBtn.onclick=(e)=>{e.stopPropagation();forward(m,w,api,{open:false})};

        const docCard=el('div','chat-doc-card-v2');
        const coverWrap=el('div','chat-doc-cover-wrap');
        const mockup=createDocMockupCover(m.archivo_nombre,m.archivo_mime,1,(Number(m.archivo_bytes||0)/1024/1024).toFixed(1));
        coverWrap.append(mockup);

        const infoBar=el('div','chat-doc-info-bar');
        const badge=el('span',isPdf?'chat-doc-badge-pdf':'chat-doc-badge-pdf chat-doc-badge-doc',isPdf?'PDF':'DOC');
        const details=el('div','chat-doc-details');
        const title=el('strong','chat-doc-title',m.archivo_nombre);
        const sub=el('span','chat-doc-sub',`1 pág · ${(Number(m.archivo_bytes||0)/1024/1024).toFixed(1)} MB · ${isPdf?'pdf':'doc'}`);
        details.append(title,sub);
        const dStatus=el('span','chat-doc-status');
        dStatus.innerHTML=`${timeStr} ${statusSvg}`;
        infoBar.append(badge,details,dStatus);
        docCard.append(coverWrap,infoBar);

        docCard.onclick=async()=>{
          try{
            const {data,error}=await api.db.storage.from('chat-archivos').createSignedUrl(m.archivo_path,300,{download:m.archivo_nombre});
            if(!api.current(w))return;if(error||!data?.signedUrl)throw error||Error();
            const a=el('a');a.href=data.signedUrl;a.download=m.archivo_nombre;a.target='_blank';a.rel='noopener noreferrer';a.click();
          }catch{if(api.current(w))api.note(w,'No se pudo descargar el archivo.',true)}
        };

        if(isPdf){
          void (async()=>{
            try{
              const {data}=await api.db.storage.from('chat-archivos').createSignedUrl(m.archivo_path,300);
              if(!data?.signedUrl||!docCard.isConnected)return;
              const res=await fetch(data.signedUrl);
              const blob=await res.blob();
              const thumb=await generatePdfThumbnail(blob);
              if(thumb?.url&&docCard.isConnected){
                const img=el('img','chat-doc-cover-img');
                img.src=thumb.url;img.alt=m.archivo_nombre;
                coverWrap.replaceChildren(img);
                if(thumb.numPages){
                  sub.textContent=`${thumb.numPages} ${thumb.numPages===1?'página':'páginas'} · ${(Number(m.archivo_bytes||0)/1024/1024).toFixed(1)} MB · pdf`;
                }
              }
            }catch(e){}
          })();
        }

        docWrap.append(fwdBtn,docCard);
        attachment.append(docWrap);
      }
      if(bubble && bubble.isConnected){
        entry.insertBefore(attachment, bubble);
      } else {
        entry.prepend(attachment);
      }
    }
    const reactions=el('div','chat-reactions');
    async function action(kind,text){
      if(w.actionBusy||w.sending)return;w.actionBusy=true;
      try{
        const {data,error}=await api.db.rpc('chat_v2_accion',{p_grupo:w.group,p_id:m.id,p_accion:kind,p_texto:text??null});
        if(!api.current(w))return;if(error)throw error;w.messages.set(Number(data.id),data);api.render(w);api.note(w,'');
      }catch(e){if(api.current(w))api.note(w,errorText(e),true)}finally{w.actionBusy=false}
    }
    for(const r of m.reacciones||[]){const b=btn(r.emoji+' '+r.total,()=>void action('reaccionar',r.propia?null:r.emoji),'chat-reaction');b.setAttribute('aria-pressed',String(r.propia));b.setAttribute('aria-label',`${r.emoji}: ${r.total} reacciones${r.propia?', incluida la tuya':''}`);reactions.append(b)}
    if(reactions.children.length)entry.append(reactions);
    if(!w.modeBar)return; // Una cuenta desactivada conserva únicamente la consulta del historial.
    const menu=el('details','chat-message-menu'),summary=el('summary','','Opciones');summary.setAttribute('aria-label','Opciones del mensaje');
    const actions=el('div','chat-message-actions');
    actions.append(btn('Responder',()=>{menu.open=false;mode(w,'responder',m)}));
    if(navigator.clipboard)actions.append(btn('Copiar texto',async()=>{try{await navigator.clipboard.writeText(m.contenido);api.note(w,'Texto copiado.');menu.open=false}catch{api.note(w,'El navegador no permitió copiar el texto.',true)}}));
    actions.append(btn('Reenviar',()=>forward(m,w,api,menu)));
    if(m.remitente===api.user()){
      if(Date.now()-Date.parse(m.creado_at)<15*60000)actions.append(btn('Editar',()=>{menu.open=false;mode(w,'editar',m)}));
      const delBtn=btn('Eliminar para todos',()=>{if(confirm('¿Eliminar este mensaje para todos los participantes?'))void action('eliminar')});
      delBtn.dataset.danger='true';
      actions.append(delBtn);
    }
    const choices=el('div','chat-reaction-choices');
    for(const emoji of ['👍','❤️','😂','😮','😢','🙏']){const b=btn(emoji,()=>{menu.open=false;void action('reaccionar',(m.reacciones||[]).some(r=>r.emoji===emoji&&r.propia)?null:emoji)});b.setAttribute('aria-label','Reaccionar con '+emoji);choices.append(b)}
    actions.append(choices);menu.append(summary,actions);entry.append(menu);
  }
  function forward(m,w,api,menu){
    menu.open=false;
    const box=el('div','chat-forward'),label=el('label','','Reenviar a:'),select=el('select');
    select.setAttribute('aria-label','Destinatario del reenvío');
    const myGroups=(api.groups?.()||[]).filter(g=>g.unido);
    if(myGroups.length){
      const gOpt=el('optgroup');gOpt.label='Grupos';
      for(const g of myGroups){const o=el('option','',g.nombre);o.value='g:'+g.id;gOpt.append(o)}
      select.append(gOpt);
    }
    const people=api.contacts().filter(c=>c.activo);
    if(people.length){
      const pOpt=el('optgroup');pOpt.label='Personas';
      for(const c of people){const o=el('option','',c.nombre);o.value=c.id;pOpt.append(o)}
      select.append(pOpt);
    }
    const key=crypto.randomUUID();
    const sendButton=btn('Enviar',async()=>{
      if(!select.value)return;sendButton.disabled=true;select.disabled=true;
      try{
        const isGroup=select.value.startsWith('g:');
        const payload=isGroup
          ? {p_grupo:Number(select.value.slice(2)),p_cliente_id:key,p_contenido:m.contenido}
          : {p_contacto:select.value,p_cliente_id:key,p_contenido:m.contenido};
        const {error}=await api.db.rpc('chat_v2_enviar',payload);
        if(!api.current(w))return;if(error)throw error;box.remove();api.note(w,'Reenviado.');
      }catch(e){if(api.current(w))api.note(w,errorText(e),true)}finally{sendButton.disabled=false;select.disabled=false}
    });
    label.append(select);box.append(label,sendButton,btn('Cancelar',()=>box.remove()));w.el.querySelector('.chat-forward')?.remove();w.modeBar.before(box);select.focus();
  }
  window.KJAChatPlus={validateFile,mount,render,send,clear,resetMode,createGroup};
})();
