import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {link,compose,parseText,whatsappMessage}=require('../assets/js/marketing-model.js');

test('every generated course and therapy copy includes institutional contact details once',()=>{
  for(const titulo of ['Curso de evaluación','Terapia familiar']){
    const copy=compose({titulo,telefono:'51988918238'},'https://wa.me/51988918238');
    assert.equal(copy.split('📧 Correo: kjabienestar@escuelakja.net').length-1,1);
    assert.equal(copy.split('🌐 Página Web: https://www.kjadmb.com/').length-1,1);
  }
});

test('WhatsApp message uses this flyer and its exact Facebook post',()=>{
  const post='https://www.facebook.com/photo?fbid=122194279262870132&set=a.122125263440870132&locale=es_LA';
  const message=whatsappMessage('TERAPIA FAMILIAR Y DE PAREJA',post);
  assert.match(message,/Hola KJA 👋\n/);
  assert.match(message,/sobre la TERAPIA FAMILIAR Y DE PAREJA/);
  assert.match(message,/costo y los horarios/);
  assert.ok(message.includes(post));
  assert.equal(new URL(link('51988918238',message)).searchParams.get('text'),message);
  assert.match(whatsappMessage('Gestión escolar'),/GESTIÓN ESCOLAR/);
  assert.throws(()=>whatsappMessage('Terapia','https://facebook.com.evil.test/post'));
});

test('WhatsApp preserves accents, punctuation and campaign text without query injection',()=>{
  const message='Información de ADOS-2 & ADI-R: ¿precio? #KJA';
  const url=new URL(link('+51 988 918 238',message));
  assert.equal(url.pathname,'/51988918238');
  assert.equal(url.searchParams.get('text'),message);
  assert.equal([...url.searchParams].length,1);
  assert.throws(()=>link('988','Hola'));
  assert.throws(()=>link('51988918238',' '));
});
test('template omits facts not present in the supplied flyer',()=>{
  const copy=compose({titulo:'ADOS-2 y ADI-R',temario:'Entrevista ADI-R.\nTécnicas del test de ADOS II.'},'https://wa.me/51988918238?text=Hola');
  assert.match(copy,/🧩 Entrevista ADI-R/);
  assert.match(copy,/💡 Técnicas/);
  assert.doesNotMatch(copy,/online|VACANTES|beneficios|certifica|PSICÓLOGOS/i);
});

test('campaign format includes only confirmed benefits and the current WhatsApp',()=>{
  const d={titulo:'Pruebas neuropsicológicas',modalidad:'Online',descripcion:'Descripción confirmada',publico:'Psicólogos',temario:'Fundamentos\nAplicación\nInforme',telefono:'51988918238',opciones:{certificado:true,material:true,peru:true,vacantes:true}};
  const copy=compose(d,link(d.telefono,'Hola, quiero inscribirme'));
  assert.match(copy,/🧠 PRUEBAS NEUROPSICOLÓGICAS/);assert.match(copy,/💻 Online/);
  assert.match(copy,/¿QUÉ APRENDERÁS EN ESTA FORMACIÓN/);assert.match(copy,/Certificado Académico \(con QR\)/);assert.match(copy,/Material académico digital/);
  assert.match(copy,/Solo válido en Perú/);assert.match(copy,/Contáctanos al WhatsApp: https:\/\/wa.me\//);assert.match(copy,/988 918 238/);assert.match(copy,/VACANTES LIMITADAS/);
  const plain=compose({...d,opciones:{}},link(d.telefono,'Hola'));
  assert.doesNotMatch(plain,/Certificado|Material académico|Solo válido|VACANTES LIMITADAS/);
});

test('therapy follows the example order without course language or fabricated facts',()=>{
  const copy=compose({titulo:'TERAPIA FAMILIAR Y DE PAREJA',descripcion:'La familia unida es más fuerte, ¡trabajemos juntos!',temario:'Mejora de la comunicación y la empatía en el hogar.\nGestión de desacuerdos, crisis familiares y de pareja.\nBienestar emocional.',modalidad:'Presencial',detalles:'Solo válido en Perú, Vacantes limitadas',telefono:'51988918238'},'https://example.test/chat');
  assert.match(copy,/👨‍👩‍👧‍👦 TERAPIA/);assert.match(copy,/SERVICIO DE TERAPIA PSICOLÓGICA: 🧠✨/);
  assert.match(copy,/📋 ¿EN QUÉ CONSISTE ESTA TERAPIA\?/);
  assert.match(copy,/🧩 Mejora/);assert.match(copy,/💡 Gestión/);assert.match(copy,/🤝 Bienestar/);
  assert.doesNotMatch(copy,/\bCURSO\b|BENEFICIOS DE ESTA FORMACIÓN|certificado|material digital/i);
  const sections=['TERAPIA FAMILIAR','SERVICIO DE TERAPIA PSICOLÓGICA','La familia','¿EN QUÉ CONSISTE ESTA TERAPIA?','Modalidad:','Solo válido en Perú','📲','💙 KJA','VACANTES LIMITADAS'];
  sections.forEach((part,i)=>{assert.ok(copy.includes(part));if(i)assert.ok(copy.indexOf(part)>copy.indexOf(sections[i-1]));});
});

test('therapy flyer for autoestima in children and adolescents outputs the exact Facebook copy structure',()=>{
  const copy=compose({titulo:'Terapia emocional con dificultades en el autoestima en niños y adolescentes',telefono:'51988918238'},'https://wa.link/ycm0no');
  assert.match(copy,/🧠 TERAPIA EMOCIONAL CON DIFICULTADES EN EL AUTOESTIMA EN NIÑOS Y ADOLESCENTES/);
  assert.match(copy,/SERVICIO DE TERAPIA PSICOLÓGICA: 🧠✨/);
  assert.match(copy,/Brindamos un espacio seguro y profesional/);
  assert.match(copy,/🧑‍🦲 ¿A QUIÉN ESTÁ DIRIGIDO\?/);
  assert.match(copy,/Niños y adolescentes que necesitan apoyo profesional para fortalecer su autoconfianza/);
  assert.match(copy,/📋 ¿EN QUÉ CONSISTE ESTA TERAPIA\?/);
  assert.match(copy,/🧩 Evaluación Emocional: Comprensión y análisis/);
  assert.match(copy,/💡 Estrategias de Intervención: Herramientas clínicas/);
  assert.match(copy,/🤝 Acompañamiento Integral: Pautas y orientación/);
  assert.match(copy,/🇵🇪 Solo válido en Perú\./);
  assert.match(copy,/📲 Inscríbete directamente aquí: https:\/\/wa\.link\/ycm0no \(o al WhatsApp \(51\) 988 918 238\)/);
  assert.match(copy,/💙 KJA: Centro de Capacitación y Formación Psicológica \(Desarrollando mi bienestar\)\./);
  assert.match(copy,/🚨 ¡VACANTES LIMITADAS! Asegura tu cupo hoy mismo\. 🚨/);
});

test('cached comma-separated flyer benefits become emoji lines without duplication',()=>{
  const copy=compose({titulo:'Gestión y convivencia escolar',modalidad:'Curso online',beneficios:'300 horas académico, Material académico, Incluye certificado (con QR), Válido concursos públicos y privados',detalles:'Solo válido en Perú, Vacantes limitadas',opciones:{material:true,certificado:true}},'https://example.test/chat');
  assert.match(copy,/🏫 GESTIÓN/);assert.match(copy,/⏱️ 300 horas académico\n📚 Material académico\n📜 Incluye certificado \(con QR\)\n✅ Válido concursos/);
  assert.equal((copy.match(/certificado/gi)||[]).length,1);assert.equal((copy.match(/Material académico/gi)||[]).length,1);
  assert.match(copy,/🇵🇪 Solo válido en Perú/);assert.match(copy,/🚨 ¡VACANTES LIMITADAS!/);
});

// Harness de eventos, sin navegador ni servicios externos; no valida layout.
test('refresh beside the link regenerates copy and message together without Gemini',async()=>{
  const e=editor();await e.load();
  e.get('titulo').value='TERAPIA FAMILIAR Y DE PAREJA';
  e.get('copy').value='Texto antiguo';e.get('mensaje').value='Mensaje antiguo';
  e.get('checked').checked=true;
  await e.get('refresh-all').onclick();
  assert.match(e.get('copy').value,/TERAPIA FAMILIAR Y DE PAREJA/);
  assert.doesNotMatch(e.get('copy').value,/Texto antiguo|wa\.me/);
  assert.match(e.get('mensaje').value,/sobre la TERAPIA FAMILIAR/);
  assert.equal(e.get('short-url').value,'https://www.kjadmb.com/w.html?k=abcdefghijklmnop');
  assert.equal(e.get('checked').checked,false);
  assert.equal(e.calls.filter(c=>c.accion==='analizar'||c.accion==='publicar').length,0);
});

test('refresh cancellation or link failure preserves prior edits',async()=>{
  const e=editor();await e.load();e.get('copy').value='Conservar texto';e.get('mensaje').value='Conservar mensaje';
  e.context.confirm=()=>false;
  await e.get('refresh-all').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='enlace').length,0);
  e.context.confirm=()=>true;
  e.context.db.functions.invoke=async()=>({data:{error:'No se pudo generar el enlace.'}});
  await e.get('refresh-all').onclick();
  assert.equal(e.get('copy').value,'Conservar texto');assert.equal(e.get('mensaje').value,'Conservar mensaje');
  assert.match(e.get('status').textContent,/No se pudo/);
  assert.equal(e.get('refresh-all').disabled,false);
});

test('refresh cannot modify a published campaign',async()=>{
  const e=editor({publicado:true});await e.load();
  assert.equal(e.get('refresh-all').disabled,true);
  await e.get('refresh-all').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='enlace').length,0);
});

function editor({facebook=true,publicar=true,publicado=false,extracted=false,ia=true,quotaError=false,connectionError=false,analysisWait,legacy=false,fullHistory=false}={}){
  class Element{
    value='';hidden=false;disabled=false;checked=false;dataset={};children=[];attrs={};listeners={};textContent='';files=[];
    append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}
    setAttribute(k,v){this.attrs[k]=v}removeAttribute(k){delete this.attrs[k];if(k==='href')this.href=''}
    addEventListener(k,fn){this.listeners[k]=fn}focus(){}
    showModal(){this.open=true}close(){this.open=false;this.onclose?.()}
  }
  const html=fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const steps=Array.from({length:3},()=>new Element());
  const get=id=>elements.get('marketing-'+id);
  const calls=[];let onAuth;
  const draft={id:'1',datos:{titulo:'ADOS-2',telefono:'51988918238',mensaje:'Hola ADOS'},copy:'',estado:'borrador',enlace:''};
  if(legacy){draft.enlace=link(draft.datos.telefono,draft.datos.mensaje);draft.copy='Texto editado por dirección\n\n📩 Solicita información aquí: '+draft.enlace;}
  if(publicado){draft.estado='publicado';draft.copy='Publicado';draft.facebook_id='123_456'}
  if(extracted){draft.datos={};draft.extraccion={titulo:'Lectura persistida',telefono:'51988918238',mensaje:'Hola'}}
  if(fullHistory){draft.imagen='https://example.test/flyer.png';draft.copy='Texto guardado';}
  const context=vm.createContext({console,URL,confirm:()=>true,document:{getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelectorAll:selector=>selector==='.marketing-steps li'?steps:selector==='.marketing-history-delete'?get('history').children.flatMap(row=>row.children).filter(button=>button.className==='marketing-history-delete'):[]},navigator:{clipboard:{writeText:async()=>{}}},paintShell:()=>{},closeMenu:()=>{},db:{auth:{onAuthStateChange:fn=>onAuth=fn},rpc:async()=>({data:{acceso:true}}),functions:{invoke:async(name,{body})=>{
    calls.push(body);
    if(body.accion==='analizar'&&analysisWait)await analysisWait;
    if(connectionError&&body.accion==='estado')return {error:{context:{status:404,json:async()=>({message:'Function not found'})}}};
    if(quotaError&&body.accion==='analizar')return {data:{error:'El equipo alcanzó las 20 lecturas nuevas en las últimas 24 horas.'}};
    const results={enlace:{enlace:'https://www.kjadmb.com/w.html?k=abcdefghijklmnop'},estado:{ia,facebook,puede_publicar:publicar,pagina:'Página de prueba'},listar:{items:[draft]},cargar:{borrador:draft,imagen:'https://example.test/flyer.png'},crear:{id:'2'},analizar:{datos:{titulo:'Curso leído',telefono:'51988918238',temario:'Tema confirmado'}},guardar:{ok:true},guardar_borrador:{ok:true},eliminar:{ok:true},publicar:{ok:true,facebook_id:'123_456'}};
    return {data:results[body.accion]};
  }}},addEventListener:()=>{}});
  context.window=context;
  context.FileReader=class {readAsDataURL(){this.result='data:image/png;base64,AA==';this.onload()}};
  vm.runInContext(fs.readFileSync(new URL('../assets/js/marketing-model.js',import.meta.url),'utf8'),context);
  context.KJAMarketing.compressFlyer=async file=>file;
  vm.runInContext(fs.readFileSync(new URL('../assets/js/dashboard-marketing.js',import.meta.url),'utf8'),context);
  const settle=async()=>{for(let n=0;n<6;n++)await new Promise(resolve=>setImmediate(resolve))};
  return {get,calls,context,settle,onSignOut:()=>onAuth('SIGNED_OUT'),async load(){await context.KJAMarketingPortal.init();await context.KJAMarketingPortal.open();get('history').children[0].children[0].onclick();await settle()}};
}
test('save for later accepts incomplete fields without analyzing or publishing',async()=>{
  const e=editor();await e.load();e.get('titulo').value='Avance';e.get('telefono').value='';e.get('copy').value='Sin terminar';
  await e.get('save-later').onclick();
  const call=e.calls.find(c=>c.accion==='guardar_borrador');assert.equal(call.datos.telefono,'');assert.equal(call.copy,'Sin terminar');
  assert.equal(e.calls.filter(c=>c.accion==='publicar'||c.accion==='analizar').length,0);
});
test('delete calls the portal action and cancellation sends no mutation',async()=>{
  const e=editor();await e.load();await e.get('history').children[0].children[1].onclick();
  assert.equal(e.get('delete-dialog').open,true);e.get('delete-cancel').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='eliminar').length,0);
  await e.get('history').children[0].children[1].onclick();await e.get('delete-confirm').onclick();assert.equal(e.calls.filter(c=>c.accion==='eliminar').length,1);
  assert.equal(e.get('delete-dialog').open,false);
});
test('history trash opens named dialog without navigating and errors preserve edits',async()=>{
  const e=editor();await e.load();e.get('copy').value='Conservar mi trabajo';
  const trash=e.get('history').children[0].children[1];assert.match(trash.attrs['aria-label'],/Eliminar/);
  trash.onclick();assert.equal(e.get('delete-dialog').open,true);assert.ok(e.get('delete-name').textContent);
  e.context.db.functions.invoke=async()=>({data:{error:'No se pudo eliminar'}});
  await e.get('delete-confirm').onclick();assert.equal(e.get('delete-dialog').open,true);
  assert.match(e.get('delete-error').textContent,/No se pudo eliminar/);assert.equal(e.get('copy').value,'Conservar mi trabajo');
  assert.equal(e.get('delete-confirm').disabled,false);
});
test('history trash is re-enabled after loading, successful operations and failures',async()=>{
  const e=editor();await e.load();
  const trash=e.get('history').children[0].children[1];assert.equal(trash.disabled,false);
  const invoke=e.context.db.functions.invoke;let complete;
  e.context.db.functions.invoke=(name,args)=>args.body.accion==='enlace'?new Promise(resolve=>{complete=resolve}):invoke(name,args);
  const pending=e.get('update-link').onclick();assert.equal(trash.disabled,true);
  complete({data:{enlace:'https://www.kjadmb.com/w.html?k=abcdefghijklmnop'}});await pending;
  assert.equal(trash.disabled,false);
  e.get('whatsapp-message').value='Otro mensaje';e.get('whatsapp-message').oninput();
  e.context.db.functions.invoke=async()=>({data:{error:'Error de prueba'}});
  await e.get('update-link').onclick();assert.equal(trash.disabled,false);
  trash.onclick();assert.equal(e.get('delete-dialog').open,true);
});
test('publishing requires saving and reviewing; edits invalidate approval',async()=>{
  const e=editor();await e.load();await e.get('generate').onclick();
  assert.equal(e.get('publish').disabled,true);
  await e.get('save').onclick();e.get('checked').checked=true;e.get('checked').onchange();
  assert.equal(e.get('publish').disabled,false);
  e.get('copy').value+='\nTexto revisado';e.get('copy').oninput();
  assert.equal(e.get('publish').disabled,true);assert.equal(e.get('checked').checked,false);
  await e.get('save').onclick();e.get('checked').checked=true;e.get('checked').onchange();
  await e.get('publish').onclick();await e.get('publish').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='publicar').length,1);
  assert.equal(e.get('post').hidden,false);
  e.onSignOut();assert.equal(e.get('copy').value,'');assert.equal(e.get('post').hidden,true);
});

test('opening a legacy draft is read-only; shortening happens only on request',async()=>{
  const e=editor({legacy:true});await e.load();
  assert.match(e.get('copy').value,/Texto editado por dirección/);
  assert.match(e.get('copy').value,/wa\.me/);
  assert.equal(e.calls.filter(c=>c.accion==='enlace').length,0);
  assert.equal(e.calls.filter(c=>c.accion==='analizar'||c.accion==='guardar'||c.accion==='publicar').length,0);
  await e.get('update-link').onclick();
  assert.match(e.get('copy').value,/Texto editado por dirección/);
  assert.doesNotMatch(e.get('copy').value,/wa\.me|text=/);
  assert.equal(e.get('short-url').value,'https://www.kjadmb.com/w.html?k=abcdefghijklmnop');
});

test('complete history opens instantly without a load or analysis request',async()=>{
  const e=editor({fullHistory:true});await e.load();
  assert.equal(e.get('copy').value,'Texto guardado');
  assert.equal(e.calls.filter(c=>['cargar','analizar','enlace'].includes(c.accion)).length,0);
  assert.equal(e.get('review').hidden,false);
  e.onSignOut();assert.equal(e.get('history').children.length,0);
});

test('legacy history recovers six real flyer thumbnails with bounded concurrent reads',async()=>{
  const e=editor();let active=0,peak=0,loads=0;
  const rows=Array.from({length:6},(_,i)=>({id:String(i+1),datos:{titulo:'Flyer '+i},estado:'borrador',copy:''}));
  e.context.db.functions.invoke=async(name,{body})=>{
    if(body.accion==='estado')return {data:{ia:true,facebook:false}};
    if(body.accion==='listar')return {data:{items:rows}};
    assert.equal(body.accion,'cargar');active++;peak=Math.max(peak,active);loads++;
    await new Promise(resolve=>setImmediate(resolve));active--;
    return {data:{borrador:rows.find(row=>row.id===body.id),imagen:'https://example.test/'+body.id+'.png'}};
  };
  await e.context.KJAMarketingPortal.init();await e.context.KJAMarketingPortal.open();
  assert.equal(loads,6);assert.equal(peak,3);
  assert.deepEqual(e.get('history').children.map(li=>li.children[0].children[0].src),rows.map(row=>'https://example.test/'+row.id+'.png'));
});

test('selected flyer appears beside the editor and clears for a new campaign',async()=>{
  const e=editor();await e.load();
  assert.equal(e.get('preview').hidden,false);
  assert.equal(e.get('preview-image').src,'https://example.test/flyer.png');
  assert.equal(e.get('preview-link').href,e.get('preview-image').src);
  e.get('new').onclick();assert.equal(e.get('preview').hidden,true);assert.equal(e.get('preview-link').href,'');
});

test('uses the portal splash during work and releases it on service failure',async()=>{
  const e=editor({connectionError:true});let visible=false,closed=false;
  e.context.withActionLoader=async(label,task)=>{visible=true;assert.match(label,/Cargando/);try{return await task(()=>{})}finally{visible=false;closed=true}};
  const invoke=e.context.db.functions.invoke;
  e.context.db.functions.invoke=async(...args)=>{assert.equal(visible,true);assert.equal(e.get('loading').hidden,true);return invoke(...args)};
  await e.context.KJAMarketingPortal.init();await e.context.KJAMarketingPortal.open();
  assert.equal(visible,false);assert.equal(closed,true);assert.equal(e.get('retry').disabled,false);
});

test('reopening the current publication checks the server and recovers after a rejected send',async()=>{
  const e=editor();await e.load();await e.get('generate').onclick();await e.get('save').onclick();
  const invoke=e.context.db.functions.invoke;
  e.context.db.functions.invoke=async(name,args)=>args.body.accion==='publicar'?{data:{error:'Envío no confirmado'}}:invoke(name,args);
  e.get('checked').checked=true;e.get('checked').onchange();await e.get('publish').onclick();assert.equal(e.get('save').disabled,true);
  const before=e.calls.filter(c=>c.accion==='cargar').length;
  await e.get('history').children[0].children[0].onclick();
  assert.equal(e.calls.filter(c=>c.accion==='cargar').length,before+1);
  assert.equal(e.get('save').disabled,false);
});

test('history search and status filters preserve the open editor',async()=>{
  const e=editor();await e.load();const copy=e.get('copy').value;
  e.get('search').value='no existe';e.get('search').oninput();assert.match(e.get('history').children[0].textContent,/No hay coincidencias/);
  e.get('search').value='ados';e.get('search').oninput();assert.equal(e.get('history').children[0].children[0].dataset.marketingDraft,'1');
  e.get('filter-published').onclick();assert.match(e.get('history').children[0].textContent,/No hay coincidencias/);
  e.get('filter-drafts').onclick();assert.equal(e.get('history').children.length,1);
  assert.equal(e.get('copy').value,copy);
});

test('history remains available when connection status fails',async()=>{
  const e=editor({connectionError:true,fullHistory:true});await e.context.KJAMarketingPortal.init();await e.context.KJAMarketingPortal.open();
  assert.equal(e.get('history').children[0].children[0].dataset.marketingDraft,'1');
  await e.get('history').children[0].children[0].onclick();assert.equal(e.get('copy').value,'Texto guardado');
});

test('loading older history preserves prior rows and removes duplicates',async()=>{
  const e=editor({fullHistory:true});await e.load();
  e.context.db.functions.invoke=async(name,{body})=>{assert.equal(body.offset,1);return {data:{items:[{id:'2',datos:{titulo:'Campaña anterior'},estado:'publicado',copy:'Anterior',imagen:'https://example.test/2.png'}],total:2,has_more:false}}};
  await e.get('history-more').onclick();assert.equal(e.get('history').children.length,2);assert.equal(e.get('history-more').hidden,true);
});
test('missing Facebook configuration or publishing permission keeps the action disabled',async()=>{
  for(const config of [{facebook:false},{publicar:false}]){
    const e=editor(config);await e.load();await e.get('generate').onclick();await e.get('save').onclick();e.get('checked').checked=true;e.get('checked').onchange();
    assert.equal(e.get('publish').disabled,true);await e.get('publish').onclick();assert.equal(e.calls.filter(c=>c.accion==='publicar').length,0);
  }
});
test('a changed WhatsApp message cannot save a copy with the obsolete link',async()=>{
  const e=editor();await e.load();await e.get('generate').onclick();e.get('mensaje').value='Mensaje nuevo';
  await e.get('save').onclick();assert.equal(e.calls.filter(c=>c.accion==='guardar').length,0);
  assert.match(e.get('status').textContent,/enlace cambió/);
});
test('published history keeps the post link and cannot send again',async()=>{
  const e=editor({publicado:true});await e.load();
  assert.equal(e.get('post').hidden,false);assert.equal(e.get('post').href,'https://www.facebook.com/123_456');
  assert.equal(e.get('publish').disabled,true);await e.get('publish').onclick();assert.equal(e.calls.filter(c=>c.accion==='publicar').length,0);
});
test('reading a flyer clears absent facts and invalidates a previously reviewed copy',async()=>{
  const e=editor();await e.load();await e.get('generate').onclick();await e.get('save').onclick();e.get('checked').checked=true;
  e.get('analyze').onclick();await e.settle();
  assert.equal(e.get('titulo').value,'Curso leído');assert.equal(e.get('modalidad').value,'');assert.equal(e.get('beneficios').value,'');
  assert.match(e.get('copy').value,/CURSO LEÍDO/);assert.equal(e.get('review').hidden,false);assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('checked').checked,false);assert.equal(e.get('publish').disabled,true);
});
test('loading stays visible during analysis, prevents duplicate calls and clears on success or error',async()=>{
  for(const quotaError of [false,true]){
    let finish;const analysisWait=new Promise(resolve=>{finish=resolve});
    const e=editor({quotaError,analysisWait});await e.load();
    assert.equal(e.get('loading').hidden,true);
    e.get('analyze').onclick();e.get('analyze').onclick();
    assert.equal(e.get('loading').hidden,false);
    assert.match(e.get('loading-text').textContent,/Leyendo/);
    assert.equal(e.get('analyze').disabled,true);
    finish();await e.settle();
    assert.equal(e.get('loading').hidden,true);
    assert.equal(e.get('analyze').disabled,false);
    assert.equal(e.calls.filter(c=>c.accion==='analizar').length,1);
    if(quotaError)assert.match(e.get('status').textContent,/20 lecturas/);
  }
});
test('opening and recovering a persisted extraction makes no new analysis call',async()=>{
  const e=editor({extracted:true});await e.load();
  assert.equal(e.get('titulo').value,'Lectura persistida');
  e.get('analyze').onclick();await e.settle();
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
  assert.match(e.get('status').textContent,/sin consumir otra lectura/);
});

test('analysis progress is capped while waiting and completes only after the link succeeds',async()=>{
  for(const failure of ['none','analysis','link']){
    let finish,tick,cleared=false,finishLink;
    const analysisWait=new Promise(resolve=>{finish=resolve});
    const e=editor({quotaError:failure==='analysis',analysisWait});await e.load();
    e.context.setInterval=fn=>{tick=fn;return 1};
    e.context.clearInterval=timer=>{assert.equal(timer,1);cleared=true};
    e.context.withActionLoader=()=>assert.fail('analysis uses its percentage splash');
    const invoke=e.context.db.functions.invoke;
    e.context.db.functions.invoke=(name,args)=>args.body.accion==='enlace'?new Promise(resolve=>{finishLink=()=>resolve(failure==='link'?{data:{error:'No se pudo generar el enlace.'}}:{data:{enlace:'https://www.kjadmb.com/w.html?k=abcdefghijklmnop'}})}):invoke(name,args);
    e.get('analyze').onclick();
    assert.equal(e.get('progress').hidden,false);
    assert.equal(e.get('progress-bar').value,10);
    for(let i=0;i<100;i++)tick();
    assert.equal(e.get('progress-bar').value,80);
    assert.equal(e.get('loading').hidden,false);
    finish();await e.settle();assert.equal(cleared,true);
    if(failure!=='analysis'){
      assert.equal(e.get('progress-bar').value,92);
      assert.equal(e.get('loading').hidden,false);
      finishLink();await e.settle();
    }
    assert.equal(e.get('loading').hidden,true);
    assert.equal(e.get('progress-bar').value,failure==='none'?100:failure==='analysis'?80:92);
  }
});
test('repeated recovery in the same session reuses the first analysis',async()=>{
  const e=editor();await e.load();e.get('analyze').onclick();await e.settle();e.get('analyze').onclick();await e.settle();
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,1);
});
test('manual parser maps explicit headings and preserves ambiguous content',()=>{
  const d=parseText('Título: ADOS-2\nDescripción: Curso de evaluación\n👥 ¿A QUIÉN VA DIRIGIDO?\nPsicólogos\n📋 TEMARIO DEL CURSO:\nEntrevista\nCasos\nModalidad: Online\nPrecio: S/ 100\nFecha: 15 de octubre\nWhatsApp: +51 988 918 238\nCorreo: ventas@example.com');
  assert.equal(d.titulo,'ADOS-2');assert.equal(d.publico,'Psicólogos');assert.equal(d.temario,'Entrevista\nCasos');
  assert.equal(d.modalidad,'Online');assert.match(d.detalles,/Precio: S\/ 100\nFecha: 15 de octubre/);
  assert.equal(new URL(link(d.telefono,'Hola')).pathname,'/51988918238');assert.equal(d.correo,'ventas@example.com');
  assert.equal(d.beneficios,'');
});
test('unstructured text stays visible and parser neither invents missing fields nor truncates',()=>{
  const d=parseText('Curso de formación\nIncluye material\nDatos adicionales');
  assert.equal(d.titulo,'Curso de formación');assert.equal(d.descripcion,'Incluye material\nDatos adicionales');assert.equal(d.telefono,'');
  assert.throws(()=>parseText(' '));assert.throws(()=>parseText('Título\n'+'x'.repeat(4000)),/demasiado larga/);
  assert.equal(parseText('Temario:\nEntrevista\nCasos').titulo,'');
});
test('manual text works without Gemini and can generate and save a copy without analysis',async()=>{
  const e=editor({ia:false});await e.load();e.get('mode-text').onchange();
  assert.equal(e.get('text-method').hidden,false);assert.equal(e.get('image-method').hidden,true);
  e.get('source-text').value='Título: Curso manual\nTemario:\nEntrevista\nWhatsApp: 51988918238';await e.get('organize').onclick();
  assert.equal(e.get('titulo').value,'Curso manual');await e.get('generate').onclick();await e.get('save').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);assert.equal(e.calls.filter(c=>c.accion==='guardar').length,1);
});
test('upload never starts Gemini and preserves manual text prepared before the first flyer',async()=>{
  const e=editor();await e.load();e.get('new').onclick();e.get('mode-text').onchange();
  e.get('source-text').value='Título: Preparado antes de subir\nWhatsApp: 51988918238';await e.get('organize').onclick();
  e.get('copy').value+='\nUna invitación escrita y revisada por marketing.';e.get('copy').oninput();
  e.get('file').files=[new Blob(['image'],{type:'image/png'})];e.get('file').onchange();await e.settle();
  assert.equal(e.calls.filter(c=>c.accion==='crear').length,1);assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
  assert.equal(e.get('titulo').value,'Preparado antes de subir');assert.match(e.get('source-text').value,/Preparado/);
  assert.match(e.get('copy').value,/Una invitación escrita y revisada por marketing/);
  assert.match(e.get('copy').value,/https:\/\/www.kjadmb.com\/w.html/);
  e.get('mode-image').onchange();assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
});
test('after an exhausted Gemini quota, manual entry still saves without retrying analysis',async()=>{
  const e=editor({quotaError:true});await e.load();e.get('analyze').onclick();await e.settle();
  assert.match(e.get('status').textContent,/20 lecturas/);
  e.get('mode-text').onchange();e.get('source-text').value='Título: Manual después del límite\nWhatsApp: 51988918238';
  await e.get('organize').onclick();await e.get('generate').onclick();await e.get('save').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,1);assert.equal(e.calls.filter(c=>c.accion==='guardar').length,1);
});
test('compact editor shows one panel and preserves data when moving back and forth',async()=>{
  const e=editor();await e.load();
  assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('prepare-panel').hidden,true);assert.equal(e.get('review').hidden,false);
  e.get('tab-prepare').onclick();assert.equal(e.get('prepare-panel').hidden,false);assert.equal(e.get('data-panel').hidden,true);
  e.get('tab-review').onclick();assert.equal(e.get('titulo').value,'ADOS-2');
  await e.get('generate').onclick();assert.equal(e.get('review').hidden,false);assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('prepare-panel').hidden,true);
  e.get('back-data').onclick();assert.equal(e.get('review').hidden,true);assert.match(e.get('copy').value,/ADOS-2/);
  e.get('tab-review').onclick();assert.equal(e.get('review').hidden,false);
});
test('failed connection exits loading and offers retry without disabling manual preparation',async()=>{
  const e=editor({connectionError:true});await e.context.KJAMarketingPortal.init();await e.context.KJAMarketingPortal.open();
  assert.match(e.get('status').textContent,/aún no está activado/);assert.doesNotMatch(e.get('connection').textContent,/Comprobando/);
  assert.equal(e.get('retry').hidden,false);assert.equal(e.get('retry').disabled,false);
  e.get('mode-text').onchange();e.get('source-text').value='Título: Manual durante fallo';await e.get('organize').onclick();
  assert.equal(e.get('titulo').value,'Manual durante fallo');assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('review').hidden,false);
});
test('limited text creates the copy directly, omits absent facts and publishes without a separate save step',async()=>{
  const e=editor({ia:false});await e.load();e.get('tab-prepare').onclick();e.get('mode-text').onchange();
  e.get('source-text').value='Título: Curso breve\nTemario: Entrevista';await e.get('organize').onclick();
  assert.equal(e.get('review').hidden,false);assert.equal(e.get('data-panel').hidden,true);
  assert.equal(e.get('telefono').value,'51988918238');assert.match(e.get('copy').value,/CURSO BREVE/);
  assert.doesNotMatch(e.get('copy').value,/MODALIDAD|BENEFICIOS|DIRIGIDO/);
  e.get('to-publish').onclick();assert.equal(e.get('publish-panel').hidden,false);
  e.get('checked').checked=true;e.get('checked').onchange();await e.get('publish').onclick();
  const actions=e.calls.filter(c=>['guardar','publicar'].includes(c.accion)).map(c=>c.accion);
  assert.deepEqual(actions,['guardar','publicar']);assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
});

test('updating WhatsApp preserves edited copy and does not make another Gemini request',async()=>{
  const e=editor({facebook:false});await e.load();await e.get('generate').onclick();
  e.get('copy').value+='\nMi texto revisado';e.get('copy').oninput();
  e.get('whatsapp-message').value='Hola, quiero información de este curso 📊';e.get('whatsapp-message').oninput();
  await e.get('copy-ready').onclick();assert.match(e.get('status').textContent,/Generar enlace corto/);
  e.get('whatsapp-phone').value='51999111222';e.get('whatsapp-phone').oninput();await e.get('update-link').onclick();
  assert.match(e.get('copy').value,/Mi texto revisado/);assert.match(e.get('copy').value,/999 111 222/);
  const url=new URL(e.get('link').href);assert.equal(url.pathname,'/w.html');
  const request=e.calls.filter(c=>c.accion==='enlace').at(-1);assert.equal(request.telefono,'51999111222');assert.equal(request.mensaje,e.get('whatsapp-message').value);
  assert.doesNotMatch(e.get('copy').value,/wa.me\/51988918238/);assert.equal(e.get('checked').checked,false);
  await e.get('copy-ready').onclick();assert.match(e.get('status').textContent,/copiado/);
  assert.equal(e.calls.filter(c=>c.accion==='analizar'||c.accion==='publicar').length,0);
});

test('manual Facebook route works without Facebook credentials and saves confirmed campaign options',async()=>{
  const e=editor({facebook:false});await e.load();await e.get('generate').onclick();
  e.get('option-certificado').checked=true;e.get('option-certificado').onchange();await e.get('apply-template').onclick();
  assert.match(e.get('copy').value,/con QR/);e.get('to-publish').onclick();
  assert.equal(e.get('copy-ready').disabled,false);assert.equal(e.get('publish').disabled,true);assert.match(e.get('facebook-status').textContent,/pendiente de conectar/);
  await e.get('save').onclick();const saved=e.calls.find(c=>c.accion==='guardar');assert.equal(saved.datos.opciones.certificado,true);assert.equal(saved.datos.opciones.vacantes,false);
});

test('manual route downloads the original flyer without posting or calling Gemini',async()=>{
  const e=editor({facebook:false});await e.load();
  const clicked=[],revoked=[];
  e.context.fetch=async url=>{assert.equal(url,'https://example.test/flyer.png');return {ok:true,blob:async()=>({type:'image/png'})}};
  e.context.URL={createObjectURL:()=> 'blob:download',revokeObjectURL:url=>revoked.push(url)};
  e.context.setTimeout=fn=>fn();
  e.context.document.body={append:anchor=>clicked.push(anchor)};
  e.context.document.createElement=()=>({click(){this.clicked=true},remove(){this.removed=true}});
  await e.get('download').onclick();
  assert.equal(clicked[0].download,'flyer-kja.png');assert.equal(clicked[0].clicked,true);assert.equal(clicked[0].removed,true);assert.deepEqual(revoked,['blob:download']);
  assert.equal(e.calls.filter(c=>c.accion==='publicar'||c.accion==='analizar').length,0);
});

test('message regeneration inserts the specific Facebook URL and preserves manual edits until requested',async()=>{
  const e=editor();await e.load();e.get('titulo').value='TERAPIA FAMILIAR Y DE PAREJA';e.get('mensaje').value='';await e.get('generate').onclick();
  assert.match(e.get('whatsapp-message').value,/sobre la TERAPIA FAMILIAR Y DE PAREJA/);
  e.get('facebook_url').value='https://www.facebook.com/photo?fbid=123';e.get('facebook_url').oninput();
  assert.match(e.get('whatsapp-message').value,/siguiente publicación: https:\/\/www.facebook.com\/photo\?fbid=123/);
  await e.get('update-link').onclick();assert.match(e.get('copy').value,/https:\/\/www.kjadmb.com\/w.html\?k=/);assert.doesNotMatch(e.get('copy').value,/wa.me/);
  e.get('whatsapp-message').value='Un mensaje escrito por marketing';e.get('whatsapp-message').oninput();await e.get('generate').onclick();assert.equal(e.get('mensaje').value,'Un mensaje escrito por marketing');
  await e.get('regenerate-message').onclick();assert.match(e.get('mensaje').value,/TERAPIA FAMILIAR Y DE PAREJA/);
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
});

test('quota widget renders used count, remaining pill and renewal countdown timer',async()=>{
  const e=editor();
  const future=new Date(Date.now()+3.5*3600000).toISOString();
  const prevInvoke=e.context.db.functions.invoke;
  e.context.db.functions.invoke=async(name,args)=>{
    if(args.body.accion==='estado'){
      return {data:{ia:true,facebook:true,puede_publicar:true,pagina:'KJA',cuota:{usadas:15,limite:200,disponibles:185,proxima_renovacion:future}}};
    }
    return prevInvoke(name,args);
  };
  await e.load();
  assert.equal(e.get('quota-used').textContent,'15');
  assert.equal(e.get('quota-total').textContent,'200');
  assert.equal(e.get('quota-remaining').textContent,'185');
  assert.match(e.get('quota-timer').textContent,/1ª renueva en 3h \d\dm/);
});

test('refine submit invokes moldear action, updates copy and decrements quota',async()=>{
  const e=editor();
  await e.load();
  e.get('copy').value='Texto preliminar del curso';
  const prevInvoke=e.context.db.functions.invoke;
  e.context.db.functions.invoke=async(name,args)=>{
    if(args.body.accion==='moldear'){
      assert.equal(args.body.prompt,'Hazlo más enfocado en ventas');
      assert.equal(args.body.copy,'Texto preliminar del curso');
      return {data:{ok:true,copy:'Texto moldeado enfocado en ventas 🔥\n📲 Contacto',cuota:{usadas:16,limite:200,disponibles:184,proxima_renovacion:null}}};
    }
    return prevInvoke(name,args);
  };
  e.get('refine-prompt').value='Hazlo más enfocado en ventas';
  await e.get('refine-submit').onclick();
  assert.equal(e.get('copy').value,'Texto moldeado enfocado en ventas 🔥\n📲 Contacto');
  assert.equal(e.get('refine-prompt').value,'');
  assert.equal(e.get('quota-used').textContent,'16');
  assert.equal(e.get('quota-remaining').textContent,'184');
  assert.equal(e.get('progress-bar').value,100);
});


