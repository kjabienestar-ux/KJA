import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// DOM de eventos acotado: comprueba comportamiento, no sustituye revisión visual.
function harness({failSend=false,waitSend=null,waitContacts=null,waitHistory=null,photos=[],photoError=false,presenceRows=[],presenceError=false}={}){
  let document;
  let clock=Date.now();class ChatDate extends Date{static now(){return clock}}
  const connection={rows:presenceRows,error:presenceError},documentEvents={};
  class Element{
    children=[];attrs={};dataset={};listeners={};hidden=false;disabled=false;value='';textContent='';className='';scrollHeight=0;scrollTop=0;clientHeight=0;
    append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.children.push(n)}}
    replaceChildren(...nodes){this.children.forEach(n=>n.parent=null);this.children=[];this.append(...nodes)}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null}
    setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}
    addEventListener(k,fn){this.listeners[k]=fn}
    contains(n){return n===this||this.children.some(c=>c.contains(n))}
    focus(){document.activeElement=this}
    getClientRects(){return [{}]}
    requestSubmit(){return this.onsubmit({preventDefault(){}})}
  }
  document={hidden:false,activeElement:null,hasFocus:()=>true,createElement:()=>new Element(),createElementNS:(ns)=>{const e=new Element();e.namespaceURI=ns;return e},addEventListener:(event,fn)=>documentEvents[event]=fn,body:new Element()};
  const calls=[],timers=new Map(),storage=new Map();let authHandler,uuid=0;
  const contacts=[{id:'peer',nombre:'Ana <img src=x>',direccion:false,activo:true,no_leidos:1},{id:'director',nombre:'Dirección de prueba',direccion:true,activo:true,no_leidos:0}];
  const incoming={id:1,remitente:'peer',destinatario:'me',contenido:'Hola <script>bad()</script>',creado_at:'2026-09-12T12:00:00Z',leido_at:null};
  const messages=[incoming];
  const context=vm.createContext({document,console,crypto:{randomUUID:()=>`uuid-${++uuid}`},getComputedStyle:()=>({visibility:'visible'}),sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)},setInterval:fn=>{timers.set(1,fn);return 1},clearInterval:id=>timers.delete(id),addEventListener(){},confirm:()=>true,db:{storage:{from:bucket=>({createSignedUrls:async paths=>{calls.push({name:'signPhotos',args:{bucket,paths}});return photoError?{error:{message:'denied'}}:{data:paths.map(path=>({signedUrl:'https://example.test/'+path+'?token=test'}))}}})},auth:{onAuthStateChange:fn=>authHandler=fn},rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='chat_presencia')return connection.error?{error:{message:'presence unavailable'}}:{data:connection.rows};
    if(name==='chat_contactos'){if(waitContacts)await waitContacts;return connection.contactsError?{error:{message:'contacts unavailable'}}:{data:contacts}}
    if(name==='chat_fotos')return {data:photos};
    if(name==='chat_historial'){const rows=args.p_contacto==='peer'?messages.filter(m=>!args.p_antes||m.id<args.p_antes).sort((a,b)=>b.id-a.id).slice(0,50).map(m=>({...m})):[];if(waitHistory){const pending=waitHistory;waitHistory=null;await pending}return {data:rows}}
    if(name==='chat_leer')return {data:null};
    if(name==='chat_enviar'){
      if(waitSend)await waitSend;
      if(failSend){failSend=false;return {error:{message:'network'}}}
      const sent={id:Math.max(...messages.map(m=>m.id))+1,remitente:'me',destinatario:args.p_contacto,contenido:args.p_contenido,creado_at:'2026-09-12T12:01:00Z',leido_at:null};messages.push(sent);return {data:sent};
    }
    throw Error(name);
  }}});
  context.window=context;
  context.Date=ChatDate;
  vm.runInContext(fs.readFileSync(new URL('../assets/js/dashboard-chat.js',import.meta.url),'utf8'),context);
  function find(cls,root=document.body){return [root,...root.children.flatMap(c=>find('*',c))].filter(e=>cls==='*'||e.className.split(' ').includes(cls))}
  const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
  return {context,document,calls,timers,storage,find,settle,messages,incoming,connection,documentEvents,advance:ms=>clock+=ms,logout:()=>authHandler('SIGNED_OUT'),async start(){await context.KJAChat.init('me')},async open(){find('chat-contact')[0].onclick();await settle()},async send(text){const input=find('chat-compose')[0].children[0];input.value=text;input.oninput();return find('chat-compose')[0].requestSubmit()}};
}

test('directory filters Dirección and renders names/messages as text',async()=>{
  const h=harness();await h.start();assert.equal(h.find('chat-contact').length,2);
  const tabs=h.find('chat-tabs')[0];tabs.children[1].onclick();assert.equal(h.find('chat-contact').length,1);assert.match(h.find('chat-person')[0].children[0].textContent,/Dirección/);
  tabs.children[0].onclick();await h.open();assert.equal(h.find('chat-bubble')[0].textContent,'Hola <script>bad()</script>');assert.equal(h.find('chat-bubble')[0].children.length,0);
});

test('ambiguous send preserves text and reuses idempotency key on retry',async()=>{
  const h=harness({failSend:true});await h.start();await h.open();await h.send('Mensaje de prueba');
  assert.equal(h.find('chat-compose')[0].children[0].value,'Mensaje de prueba');
  await h.send('Mensaje de prueba');const sent=h.calls.filter(c=>c.name==='chat_enviar');assert.equal(sent.length,2);assert.equal(sent[0].args.p_cliente_id,sent[1].args.p_cliente_id);assert.equal(h.find('chat-compose')[0].children[0].value,'');
});

test('blocks duplicate in-flight submissions and empty messages',async()=>{
  let resolve;const waiting=new Promise(r=>resolve=r);const h=harness({waitSend:waiting});await h.start();await h.open();await h.send('   ');assert.equal(h.calls.filter(c=>c.name==='chat_enviar').length,0);
  const first=h.send('Hola');const second=h.send('Hola');assert.equal(h.calls.filter(c=>c.name==='chat_enviar').length,1);resolve();await Promise.all([first,second]);
});

test('sign-out removes windows, stops polling and ignores an in-flight send',async()=>{
  let resolve;const h=harness({waitSend:new Promise(r=>resolve=r)});await h.start();await h.open();const pending=h.send('Pendiente');h.logout();resolve();await pending;await h.settle();
  assert.equal(h.find('kja-chat')[0].hidden,true);assert.equal(h.find('chat-window').length,0);assert.equal(h.timers.size,0);
});

test('sign-out during initialization cannot restore another account contacts',async()=>{
  let resolve;const h=harness({waitContacts:new Promise(r=>resolve=r)});const pending=h.start();h.logout();resolve();await pending;
  assert.equal(h.find('chat-contact').length,0);assert.equal(h.timers.size,0);assert.equal(h.find('kja-chat')[0].hidden,true);
});

test('read receipt requires focused, visible conversation',async()=>{
  const h=harness();await h.start();h.document.hidden=true;await h.open();assert.equal(h.calls.filter(c=>c.name==='chat_leer').length,0);
  h.document.hidden=false;h.find('chat-window')[0].listeners.focusin();await h.settle();assert.equal(h.calls.filter(c=>c.name==='chat_leer').length,1);
});

test('window preferences contain identifiers only, never message bodies',async()=>{
  const h=harness();await h.start();await h.open();await h.send('Texto privado');const value=h.storage.get('kja-chat-windows:me');assert.match(value,/peer/);assert.doesNotMatch(value,/Texto privado|contenido|Hola/);
});

test('reconnect backfills 60 arrivals before marking the latest read',async()=>{
  const h=harness();await h.start();await h.open();h.document.hidden=true;
  for(let id=2;id<=61;id++)h.messages.push({...h.incoming,id,contenido:'Mensaje '+id});
  h.document.hidden=false;h.timers.get(1)();await h.settle();
  assert.equal(h.find('chat-bubble').length,61);
  const reads=h.calls.filter(c=>c.name==='chat_leer');assert.equal(reads.at(-1).args.p_hasta,61);
  assert.ok(h.calls.some(c=>c.name==='chat_historial'&&c.args.p_antes===12));
  assert.match(h.find('chat-announcer')[0].textContent,/60 mensajes nuevos/);
});

test('directory polling preserves keyboard focus on the contact',async()=>{
  const h=harness();await h.start();h.find('chat-contact')[1].focus();h.timers.get(1)();await h.settle();
  assert.equal(h.document.activeElement,h.find('chat-contact')[1]);assert.equal(h.document.activeElement.dataset.contact,'director');
});

test('sending before reconnect catch-up does not skip 60 earlier arrivals',async()=>{
  const h=harness();await h.start();await h.open();
  for(let id=2;id<=61;id++)h.messages.push({...h.incoming,id,contenido:'Pendiente '+id});
  await h.send('Mi respuesta antes de sincronizar');await h.settle();
  assert.equal(h.find('chat-bubble').length,62);assert.ok(h.find('chat-bubble').some(b=>b.textContent==='Pendiente 2'));
});

test('directory uses private signed photos and falls back to initials on image error',async()=>{
  const h=harness({photos:[{id:'peer',foto_path:'7/avatar.webp',foto_actualizada_at:'2026-09-12'}]});await h.start();await h.settle();
  const img=h.find('chat-avatar-photo')[0];assert.ok(img);assert.match(img.src,/7\/avatar.webp\?token=test&v=2026-09-12/);
  assert.equal(h.calls.find(c=>c.name==='signPhotos').args.bucket,'perfil-fotos');assert.equal(h.find('chat-avatar')[1].children.length,0);
  img.onerror();assert.equal(h.find('chat-avatar-photo').length,0);assert.ok(h.find('chat-avatar')[0].textContent);
  h.timers.get(1)();await h.settle();assert.equal(h.calls.filter(c=>c.name==='signPhotos').length,1);
  h.logout();assert.equal(h.find('chat-avatar-photo').length,0);
});

test('storage failure does not block contacts or messaging',async()=>{
  const h=harness({photos:[{id:'peer',foto_path:'7/avatar.jpg'}],photoError:true});await h.start();await h.settle();assert.equal(h.find('chat-avatar-photo').length,0);await h.open();await h.send('Sin foto');assert.ok(h.calls.some(c=>c.name==='chat_enviar'));
});

test('closing and reopening keeps the loaded conversation and Mis chats finds it',async()=>{
  const h=harness();await h.start();await h.open();await h.send('Historial conservado');await h.settle();
  h.find('chat-window')[0].children[0].children[2].onclick();
  h.find('chat-tabs')[0].children[2].onclick();assert.equal(h.find('chat-contact').length,1);
  h.find('chat-contact')[0].onclick();assert.ok(h.find('chat-bubble').some(b=>b.textContent==='Historial conservado'));
  await h.settle();assert.equal(h.find('chat-bubble').filter(b=>b.textContent==='Historial conservado').length,1);
});

test('history is recovered from the server after signing out and back in',async()=>{
  const h=harness();await h.start();await h.open();await h.send('Guardado en el servidor');await h.settle();h.logout();
  assert.equal(h.find('chat-bubble').length,0);await h.start();await h.settle();
  assert.ok(h.find('chat-bubble').some(b=>b.textContent==='Guardado en el servidor'));
});

test('sending during initial history load keeps older messages reachable',async()=>{
  let resolve;const h=harness({waitHistory:new Promise(r=>resolve=r)});await h.start();
  for(let id=2;id<=60;id++)h.messages.push({...h.incoming,id,contenido:'Anterior '+id});
  await h.open();await h.send('Enviado durante la carga');resolve();await h.settle();
  const older=h.find('chat-history')[0].children[0];assert.equal(older.hidden,false);await older.onclick();await h.settle();
  assert.equal(h.find('chat-bubble').length,61);assert.ok(h.find('chat-bubble').some(b=>b.textContent===h.incoming.contenido));
});

test('unified panel opens a conversation, returns to people and minimizes without losing history',async()=>{
  const h=harness();await h.start();assert.equal(h.find('chat-panel')[0].hidden,true);
  h.find('chat-launcher')[0].onclick();assert.equal(h.find('chat-panel')[0].hidden,false);assert.equal(h.find('chat-panel')[0].dataset.conversation,'false');
  await h.open();assert.equal(h.find('chat-panel')[0].dataset.conversation,'true');
  h.find('chat-back')[0].onclick();assert.equal(h.find('chat-panel')[0].dataset.conversation,'false');
  await h.open();h.find('chat-window')[0].children[0].children[1].onclick();assert.equal(h.find('chat-panel')[0].hidden,true);
  h.find('chat-launcher')[0].onclick();assert.equal(h.find('chat-panel')[0].dataset.conversation,'true');assert.equal(h.find('chat-bubble')[0].textContent,h.incoming.contenido);
});

test('green dot belongs only to server-confirmed online contacts and disappears on expiry',async()=>{
  const h=harness({presenceRows:[{id:'peer',vigencia_segundos:70}]});await h.start();await h.settle();
  assert.equal(h.find('chat-online-dot').length,1);assert.equal(h.find('chat-online-dot')[0].parent.dataset.contact,'peer');
  await h.open();assert.equal(h.find('chat-peer-state')[0].textContent,'En línea');
  h.advance(71000);h.find('chat-tools')[0].children[0].oninput();assert.equal(h.find('chat-online-dot').length,0);assert.equal(h.find('chat-peer-state')[0].textContent,'Sin conexión');
});

test('presence failures remove online indicators without blocking messages',async()=>{
  const h=harness({presenceRows:[{id:'peer',vigencia_segundos:70}]});await h.start();await h.settle();h.connection.error=true;h.advance(26000);h.timers.get(1)();await h.settle();
  assert.equal(h.find('chat-online-dot').length,0);await h.open();assert.equal(h.find('chat-peer-state')[0].textContent,'Estado no disponible');await h.send('Disponible para escribir');
  assert.ok(h.calls.some(c=>c.name==='chat_enviar'));
});

test('hiding the page withdraws only this presence session and returning reuses it',async()=>{
  const h=harness();await h.start();await h.settle();const first=h.calls.find(c=>c.name==='chat_presencia');
  h.document.hidden=true;h.documentEvents.visibilitychange();await h.settle();const hidden=h.calls.filter(c=>c.name==='chat_presencia').at(-1);assert.equal(hidden.args.p_visible,false);assert.equal(hidden.args.p_sesion,first.args.p_sesion);
  h.document.hidden=false;h.documentEvents.visibilitychange();await h.settle();assert.equal(h.calls.filter(c=>c.name==='chat_presencia').at(-1).args.p_visible,true);
});

test('expired dots disappear on timer ticks even if contact and presence requests fail',async()=>{
  const h=harness({presenceRows:[{id:'peer',vigencia_segundos:70}]});await h.start();await h.settle();assert.equal(h.find('chat-online-dot').length,1);
  h.connection.contactsError=true;h.connection.error=true;h.advance(71000);h.timers.get(1)();
  assert.equal(h.find('chat-online-dot').length,0);await h.settle();assert.equal(h.find('chat-online-dot').length,0);
});

test('contacts response arriving after tab hides cannot republish visible presence',async()=>{
  let resolve;const h=harness({waitContacts:new Promise(r=>resolve=r)});const start=h.start();await h.settle();
  h.document.hidden=true;h.documentEvents.visibilitychange();await h.settle();const before=h.calls.filter(c=>c.name==='chat_presencia').length;
  resolve();await start;await h.settle();const requests=h.calls.filter(c=>c.name==='chat_presencia');assert.equal(requests.length,before);assert.equal(requests.at(-1).args.p_visible,false);
});
