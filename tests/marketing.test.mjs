import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {link,compose,parseText,whatsappMessage}=require('../assets/js/marketing-model.js');

test('WhatsApp message uses this flyer and its exact Facebook post',()=>{
  const post='https://www.facebook.com/photo?fbid=122194279262870132&set=a.122125263440870132&locale=es_LA';
  const message=whatsappMessage('TERAPIA FAMILIAR Y DE PAREJA',post);
  assert.equal(message,'Hola KJA. Vengo de Facebook, deseo información sobre la TERAPIA FAMILIAR Y DE PAREJA de la siguiente publicación: '+post);
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
  assert.match(copy,/👨‍👩‍👧‍👦 TERAPIA/);assert.match(copy,/📋 ¿QUÉ ABORDAMOS EN LAS SESIONES\?/);
  assert.match(copy,/🗣️ Mejora/);assert.match(copy,/🤝 Gestión/);assert.match(copy,/❤️ Bienestar/);
  assert.doesNotMatch(copy,/CURSO|FORMACIÓN|certificado|material/i);
  const sections=['TERAPIA FAMILIAR','La familia','¿QUÉ ABORDAMOS','MODALIDAD Y ENFOQUE','🇵🇪','📲','💙 KJA','🚨'];
  sections.forEach((part,i)=>{assert.ok(copy.includes(part));if(i)assert.ok(copy.indexOf(part)>copy.indexOf(sections[i-1]));});
});

test('cached comma-separated flyer benefits become emoji lines without duplication',()=>{
  const copy=compose({titulo:'Gestión y convivencia escolar',modalidad:'Curso online',beneficios:'300 horas académico, Material académico, Incluye certificado (con QR), Válido concursos públicos y privados',detalles:'Solo válido en Perú, Vacantes limitadas',opciones:{material:true,certificado:true}},'https://example.test/chat');
  assert.match(copy,/🏫 GESTIÓN/);assert.match(copy,/⏱️ 300 horas académico\n📚 Material académico\n📜 Incluye certificado \(con QR\)\n✅ Válido concursos/);
  assert.equal((copy.match(/certificado/gi)||[]).length,1);assert.equal((copy.match(/Material académico/gi)||[]).length,1);
  assert.match(copy,/🇵🇪 Solo válido en Perú/);assert.match(copy,/🚨 ¡VACANTES LIMITADAS!/);
});

// Harness de eventos, sin navegador ni servicios externos; no valida layout.
function editor({facebook=true,publicar=true,publicado=false,extracted=false,ia=true,quotaError=false,connectionError=false,analysisWait,legacy=false}={}){
  class Element{
    value='';hidden=false;disabled=false;checked=false;dataset={};children=[];attrs={};listeners={};textContent='';files=[];
    append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}
    setAttribute(k,v){this.attrs[k]=v}removeAttribute(k){delete this.attrs[k];if(k==='href')this.href=''}
    addEventListener(k,fn){this.listeners[k]=fn}focus(){}
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
  const context=vm.createContext({console,URL,confirm:()=>true,document:{getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelectorAll:selector=>selector==='.marketing-steps li'?steps:[]},navigator:{clipboard:{writeText:async()=>{}}},paintShell:()=>{},closeMenu:()=>{},db:{auth:{onAuthStateChange:fn=>onAuth=fn},rpc:async()=>({data:{acceso:true}}),functions:{invoke:async(name,{body})=>{
    calls.push(body);
    if(body.accion==='analizar'&&analysisWait)await analysisWait;
    if(connectionError&&body.accion==='estado')return {error:{context:{status:404,json:async()=>({message:'Function not found'})}}};
    if(quotaError&&body.accion==='analizar')return {data:{error:'El equipo alcanzó las 20 lecturas nuevas en las últimas 24 horas.'}};
    const results={enlace:{enlace:'https://www.kjadmb.com/w.html?k=abcdefghijklmnop'},estado:{ia,facebook,puede_publicar:publicar,pagina:'Página de prueba'},listar:{items:[draft]},cargar:{borrador:draft,imagen:'https://example.test/flyer.png'},crear:{id:'2'},analizar:{datos:{titulo:'Curso leído',telefono:'51988918238',temario:'Tema confirmado'}},guardar:{ok:true},publicar:{ok:true,facebook_id:'123_456'}};
    return {data:results[body.accion]};
  }}},addEventListener:()=>{}});
  context.window=context;
  context.FileReader=class {readAsDataURL(){this.result='data:image/png;base64,AA==';this.onload()}};
  vm.runInContext(fs.readFileSync(new URL('../assets/js/marketing-model.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../assets/js/dashboard-marketing.js',import.meta.url),'utf8'),context);
  const settle=async()=>{for(let n=0;n<6;n++)await new Promise(resolve=>setImmediate(resolve))};
  return {get,calls,context,settle,onSignOut:()=>onAuth('SIGNED_OUT'),async load(){await context.KJAMarketingPortal.init();await context.KJAMarketingPortal.open();get('history').children[0].children[0].onclick();await settle()}};
}
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

test('opening a legacy draft shortens its WhatsApp without replacing editorial text',async()=>{
  const e=editor({legacy:true});await e.load();
  assert.match(e.get('copy').value,/Texto editado por dirección/);
  assert.doesNotMatch(e.get('copy').value,/wa\.me|text=/);
  assert.equal(e.get('short-url').value,'https://www.kjadmb.com/w.html?k=abcdefghijklmnop');
  assert.equal(e.calls.filter(c=>c.accion==='enlace').length,1);
  assert.equal(e.calls.filter(c=>c.accion==='analizar'||c.accion==='guardar'||c.accion==='publicar').length,0);
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
  e.get('file').files=[new Blob(['image'],{type:'image/png'})];e.get('file').onchange();await e.settle();
  assert.equal(e.calls.filter(c=>c.accion==='crear').length,1);assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
  assert.equal(e.get('titulo').value,'Preparado antes de subir');assert.match(e.get('source-text').value,/Preparado/);
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
