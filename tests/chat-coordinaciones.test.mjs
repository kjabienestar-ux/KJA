import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

async function setup({capable=true,active=true,waitSend,waitMic,groupsList=[]}={}){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://kja.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],contacts=[{id:'peer',nombre:'Ana',activo:active,no_leidos:0}];
 const rows=[{id:1,remitente:'peer',destinatario:'me',autor:'Ana',contenido:'Reunión de equipo',creado_at:new Date().toISOString(),reacciones:[]}];
 w.matchMedia=()=>({matches:false});w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 if(waitMic){Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:()=>waitMic}});w.MediaRecorder=class{static isTypeSupported(){return true}}}
 w.db={auth:{onAuthStateChange(){}},storage:{from:()=>({upload:async()=>({}),createSignedUrls:async()=>({data:[]})})},rpc:async(name,args={})=>{
  calls.push({name,args});
  if(name==='chat_capacidades')return capable?{data:{version:2,administrar_grupos:true}}:{error:{code:'PGRST202'}};
  if(name==='chat_contactos')return {data:contacts};
  if(name==='chat_grupos')return {data:groupsList};
  if(name==='chat_fotos'||name==='chat_presencia')return {data:[]};
  if(name==='chat_leer')return {data:null};
  if(name==='chat_v2_historial'||name==='chat_historial')return {data:rows.filter(m=>!args.p_buscar||m.contenido.includes(args.p_buscar)).map(m=>({...m}))};
  if(name==='chat_v2_enviar'){
   if(waitSend)await waitSend;
   const m={id:rows.length+1,remitente:'me',destinatario:'peer',autor:'Yo',contenido:args.p_contenido,creado_at:new Date().toISOString(),reacciones:[],
     respuesta:args.p_respuesta?{id:1,autor:'Ana',contenido:rows[0].contenido}:null};
   rows.push(m);return {data:m};
  }
  if(name==='chat_v2_accion'){
   const m=rows.find(m=>m.id===args.p_id);
   if(args.p_accion==='editar'){m.contenido=args.p_texto;m.editado_at=new Date().toISOString()}
   if(args.p_accion==='eliminar'){m.contenido='Mensaje eliminado';m.eliminado_at=new Date().toISOString()}
   if(args.p_accion==='reaccionar')m.reacciones=args.p_texto?[{emoji:args.p_texto,total:1,propia:true}]:[];
   return {data:{...m}};
  }
  if(name==='chat_grupo_crear')return {data:10};
  throw Error(name);
 }};
 w.eval(fs.readFileSync('assets/js/chat-coordinaciones.js','utf8'));
 w.eval(fs.readFileSync('assets/js/dashboard-chat.js','utf8'));
 const tick=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r))};
 await w.KJAChat.init('me');w.document.querySelector('.chat-contact').click();await tick();
 const q=s=>w.document.querySelector(s),button=(text,root=w.document)=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
 const send=async text=>{q('.chat-compose textarea').value=text;q('.chat-compose textarea').dispatchEvent(new w.Event('input'));q('.chat-compose').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick()};
 return {w,q,calls,rows,tick,send,button,close:()=>{w.KJAChat.destroy();w.close()}};
}
test('responder envía referencia real, renderiza cita y limpia el contexto',async()=>{
 const h=await setup();try{
  h.button('Responder').click();assert.equal(h.q('.chat-compose-context').hidden,false);
  await h.send('Confirmado');
  assert.equal(h.calls.find(c=>c.name==='chat_v2_enviar').args.p_respuesta,1);
  assert.match(h.q('.chat-quote').textContent,/Reunión de equipo/);
  assert.equal(h.q('.chat-compose-context').hidden,true);
 }finally{h.close()}
});
test('editar actualiza el mensaje; eliminar retira sus acciones',async()=>{
 const h=await setup();try{
  await h.send('Borrador');h.button('Editar').click();await h.send('Corregido');
  assert.equal(h.calls.filter(c=>c.name==='chat_v2_enviar').length,1);
  assert.equal(h.calls.find(c=>c.name==='chat_v2_accion').args.p_accion,'editar');
  assert.ok(h.q('.chat-edited'));h.button('Eliminar para todos').click();await h.tick();
  assert.match(h.q('[data-deleted=true]').textContent,/Mensaje eliminado/);
  assert.equal(h.q('[data-deleted=true] .chat-message-menu'),null);
 }finally{h.close()}
});
test('reacciones y búsqueda se consultan en el servidor, contenido inseguro queda como texto',async()=>{
 const h=await setup();try{
  h.button('👍').click();await h.tick();assert.equal(h.q('.chat-reaction').getAttribute('aria-pressed'),'true');
  h.q('.chat-reaction').click();await h.tick();assert.equal(h.q('.chat-reaction'),null);
  h.q('.chat-search-toggle').click();h.q('.chat-message-search input').value='Reunión';
  h.q('.chat-message-search').dispatchEvent(new h.w.Event('submit',{cancelable:true}));await h.tick();
  assert.equal(h.calls.filter(c=>c.name==='chat_v2_historial').at(-1).args.p_buscar,'Reunión');
  assert.ok(h.q('.chat-search-result'));
  await h.send('<img src=x onerror=alert(1)>');assert.equal(h.q('.chat-message img'),null);
 }finally{h.close()}
});
test('sin migración conserva historial y envío legacy, sin ofrecer acciones nuevas',async()=>{
 const h=await setup({capable:false});try{
  assert.ok(h.calls.some(c=>c.name==='chat_historial'));assert.equal(h.q('.chat-message-menu'),null);assert.equal(h.q('.chat-compose-tools'),null);
 }finally{h.close()}
});
test('cierre de sesión durante envío no restaura mensajes privados',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const h=await setup({waitSend:pending});
 try{
  const task=h.send('Pendiente');h.w.KJAChat.destroy();resolve();await task;
  assert.equal(h.q('.kja-chat').hidden,true);assert.equal(h.q('.chat-window'),null);
 }finally{h.close()}
});
test('solicitud pendiente de micrófono se descarta y libera pistas al salir',async()=>{
 let resolve,stopped=0;const pending=new Promise(r=>resolve=r);const h=await setup({waitMic:pending});
 try{
  h.button('Grabar audio').click();await h.tick();h.w.KJAChat.destroy();
  resolve({getTracks:()=>[{stop(){stopped++}}]});await h.tick();assert.equal(stopped,1);
 }finally{h.close()}
});
test('validación de adjuntos rechaza tipos activos, vacíos y tamaños excesivos',async()=>{
 const h=await setup();try{
  const v=h.w.KJAChatPlus.validateFile;
  assert.equal(v({name:'nota.webm',type:'audio/webm;codecs=opus',size:100}),'audio/webm');
  assert.throws(()=>v({name:'pagina.html',type:'text/html',size:10}));
  assert.throws(()=>v({name:'datos.pdf',type:'application/pdf',size:21*1024*1024}));
  assert.throws(()=>v({name:'datos.pdf',type:'application/pdf',size:0}));
 }finally{h.close()}
});
test('contacto inactivo permite consultar mensajes sin acciones que requieren un editor',async()=>{
 const h=await setup({active:false});try{
  assert.match(h.q('.chat-bubble').textContent,/Reunión/);
  assert.equal(h.q('.chat-compose textarea').disabled,true);
  assert.equal(h.q('.chat-message-menu'),null);assert.equal(h.q('.chat-compose-tools'),null);
 }finally{h.close()}
});
test('editor de grupo se elimina al salir y sus acciones antiguas no sirven en otra sesión',async()=>{
 const h=await setup();try{
  h.q('.chat-new-btn').click();
  const create=[...h.w.document.querySelectorAll('.chat-newchat-option')].find(b=>b.textContent.includes('Crear grupo privado'))
    ||[...h.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear grupo privado'));
  create.click();const box=h.q('.chat-group-editor');assert.ok(box);
  box.querySelector('input').value='Grupo anterior';const check=box.querySelector('input[type=checkbox]');check.checked=true;check.dispatchEvent(new h.w.Event('change'));
  const save=h.button('Crear grupo',box);
  h.w.KJAChat.destroy();assert.equal(h.q('.chat-group-editor'),null);
  await h.w.KJAChat.init('otra-cuenta');save.click();await h.tick();
  assert.equal(h.calls.filter(c=>c.name==='chat_grupo_crear').length,0);
  assert.equal(h.w.document.body.textContent.includes('Grupo anterior'),false);
 }finally{h.close()}
});
test('formato estilo WhatsApp convierte enlaces en etiquetas seguras y texto en negrita',async()=>{
 const h=await setup();try{
  await h.send('Enlace https://zoom.us/j/12345 y aviso *urgente*');
  const bubble=[...h.w.document.querySelectorAll('.chat-bubble')].at(-1);
  assert.ok(bubble);
  const link=bubble.querySelector('a.chat-link');
  assert.ok(link);
  assert.equal(link.href,'https://zoom.us/j/12345');
  assert.equal(link.target,'_blank');
  assert.equal(link.rel,'noopener noreferrer');
  const strong=bubble.querySelector('strong');
  assert.ok(strong);
  assert.equal(strong.textContent,'urgente');
 }finally{h.close()}
});
test('fijar conversación actualiza el botón, persiste y posiciona arriba',async()=>{
 const h=await setup();try{
  const pin=h.button('Fijar');
  assert.ok(pin);
  pin.click();await h.tick();
  assert.equal(h.button('Desfijar').getAttribute('aria-pressed'),'true');
  assert.ok(h.w.localStorage.getItem('kja-chat-pinned:me').includes('peer'));
  assert.ok(h.q('.chat-contact .chat-pin-badge'));
  h.button('Desfijar').click();await h.tick();
  assert.equal(h.button('Fijar').getAttribute('aria-pressed'),'false');
  assert.equal(h.q('.chat-contact .chat-pin-badge'),null);
 }finally{h.close()}
});
test('reenviar incluye grupos y personas y envía con el identificador correspondiente',async()=>{
 const h=await setup({groupsList:[{id:7,nombre:'Coordinación KJA',unido:true,activo:true,miembros:2}]});try{
  const forwardBtn=h.button('Reenviar');
  assert.ok(forwardBtn);
  forwardBtn.click();await h.tick();
  const select=h.q('.chat-forward select');
  assert.ok(select);
  const groupOpt=select.querySelector('optgroup[label=Grupos] option[value="g:7"]');
  assert.ok(groupOpt);
  select.value='g:7';
  h.button('Enviar',h.q('.chat-forward')).click();await h.tick();
  const forwardCall=h.calls.find(c=>c.name==='chat_v2_enviar'&&c.args.p_grupo===7);
  assert.ok(forwardCall);
  assert.equal(forwardCall.args.p_contenido,'Reunión de equipo');
 }finally{h.close()}
});
test('envío de archivo limpia la previsualización del compositor inmediatamente',async()=>{
 let resolveSend;
 const waitSend=new Promise(r=>resolveSend=r);
 const h=await setup({waitSend});
 try{
  const file=new h.w.File(['test-content'],'documento.pdf',{type:'application/pdf'});
  const fileInput=h.q('input[type=file]');
  Object.defineProperty(fileInput,'files',{value:[file],writable:true});
  fileInput.dispatchEvent(new h.w.Event('change'));
  await h.tick();
  assert.ok(h.q('.chat-file-preview .chat-doc-composer-preview'));
  h.q('.chat-compose').dispatchEvent(new h.w.Event('submit',{cancelable:true}));
  await h.tick();
  assert.equal(h.q('.chat-file-preview').childNodes.length,0);
  assert.ok(h.q('.chat-history .chat-doc-bubble-wrap.is-uploading'));
  resolveSend();
  await h.tick();
 }finally{h.close()}
});
test('renderizado de nota de voz incluye cápsula estructurada e icono de micrófono relleno',async()=>{
 const h=await setup();
 try{
  const voiceMsg={id:2,remitente:'peer',destinatario:'me',autor:'Ana',contenido:'',creado_at:new Date().toISOString(),reacciones:[],archivo_path:'audios/nota.webm',archivo_mime:'audio/webm',archivo_nombre:'nota.webm'};
  h.rows.push(voiceMsg);
  await h.w.KJAChat.init('me');
  h.q('.chat-contact').click();
  await h.tick();
  const bubble=h.q('.chat-voice-bubble');
  assert.ok(bubble);
  const micBadge=bubble.querySelector('.chat-voice-mic-badge');
  assert.ok(micBadge);
  assert.ok(micBadge.querySelector('svg path[d*="M8 11a3 3 0"]'));
 }finally{h.close()}
});
