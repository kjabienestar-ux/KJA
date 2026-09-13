import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {link,compose,parseText}=require('../assets/js/marketing-model.js');

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
  assert.match(copy,/1\. Entrevista ADI-R/);
  assert.match(copy,/2\. Técnicas/);
  assert.doesNotMatch(copy,/online|VACANTES|beneficios|certifica|PSICÓLOGOS/i);
});

// Harness de eventos, sin navegador ni servicios externos; no valida layout.
function editor({facebook=true,publicar=true,publicado=false,extracted=false,ia=true,quotaError=false,connectionError=false,analysisWait}={}){
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
  if(publicado){draft.estado='publicado';draft.copy='Publicado';draft.facebook_id='123_456'}
  if(extracted){draft.datos={};draft.extraccion={titulo:'Lectura persistida',telefono:'51988918238',mensaje:'Hola'}}
  const context=vm.createContext({console,URL,confirm:()=>true,document:{getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelectorAll:selector=>selector==='.marketing-steps li'?steps:[]},navigator:{clipboard:{writeText:async()=>{}}},paintShell:()=>{},closeMenu:()=>{},db:{auth:{onAuthStateChange:fn=>onAuth=fn},rpc:async()=>({data:{acceso:true}}),functions:{invoke:async(name,{body})=>{
    calls.push(body);
    if(body.accion==='analizar'&&analysisWait)await analysisWait;
    if(connectionError&&body.accion==='estado')return {error:{context:{status:404,json:async()=>({message:'Function not found'})}}};
    if(quotaError&&body.accion==='analizar')return {data:{error:'El equipo alcanzó las 20 lecturas nuevas en las últimas 24 horas.'}};
    const results={estado:{ia,facebook,puede_publicar:publicar,pagina:'Página de prueba'},listar:{items:[draft]},cargar:{borrador:draft,imagen:'https://example.test/flyer.png'},crear:{id:'2'},analizar:{datos:{titulo:'Curso leído',telefono:'51988918238',temario:'Tema confirmado'}},guardar:{ok:true},publicar:{ok:true,facebook_id:'123_456'}};
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
  const e=editor();await e.load();e.get('generate').onclick();
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
test('missing Facebook configuration or publishing permission keeps the action disabled',async()=>{
  for(const config of [{facebook:false},{publicar:false}]){
    const e=editor(config);await e.load();e.get('generate').onclick();await e.get('save').onclick();e.get('checked').checked=true;e.get('checked').onchange();
    assert.equal(e.get('publish').disabled,true);await e.get('publish').onclick();assert.equal(e.calls.filter(c=>c.accion==='publicar').length,0);
  }
});
test('a changed WhatsApp message cannot save a copy with the obsolete link',async()=>{
  const e=editor();await e.load();e.get('generate').onclick();e.get('mensaje').value='Mensaje nuevo';
  await e.get('save').onclick();assert.equal(e.calls.filter(c=>c.accion==='guardar').length,0);
  assert.match(e.get('status').textContent,/enlace cambió/);
});
test('published history keeps the post link and cannot send again',async()=>{
  const e=editor({publicado:true});await e.load();
  assert.equal(e.get('post').hidden,false);assert.equal(e.get('post').href,'https://www.facebook.com/123_456');
  assert.equal(e.get('publish').disabled,true);await e.get('publish').onclick();assert.equal(e.calls.filter(c=>c.accion==='publicar').length,0);
});
test('reading a flyer clears absent facts and invalidates a previously reviewed copy',async()=>{
  const e=editor();await e.load();e.get('generate').onclick();await e.get('save').onclick();e.get('checked').checked=true;
  e.get('analyze').onclick();await e.settle();
  assert.equal(e.get('titulo').value,'Curso leído');assert.equal(e.get('modalidad').value,'');assert.equal(e.get('beneficios').value,'');
  assert.match(e.get('copy').value,/Curso leído/);assert.equal(e.get('review').hidden,false);assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('checked').checked,false);assert.equal(e.get('publish').disabled,true);
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
  e.get('source-text').value='Título: Curso manual\nTemario:\nEntrevista\nWhatsApp: 51988918238';e.get('organize').onclick();
  assert.equal(e.get('titulo').value,'Curso manual');e.get('generate').onclick();await e.get('save').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);assert.equal(e.calls.filter(c=>c.accion==='guardar').length,1);
});
test('upload never starts Gemini and preserves manual text prepared before the first flyer',async()=>{
  const e=editor();await e.load();e.get('new').onclick();e.get('mode-text').onchange();
  e.get('source-text').value='Título: Preparado antes de subir\nWhatsApp: 51988918238';e.get('organize').onclick();
  e.get('file').files=[new Blob(['image'],{type:'image/png'})];e.get('file').onchange();await e.settle();
  assert.equal(e.calls.filter(c=>c.accion==='crear').length,1);assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
  assert.equal(e.get('titulo').value,'Preparado antes de subir');assert.match(e.get('source-text').value,/Preparado/);
  e.get('mode-image').onchange();assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
});
test('after an exhausted Gemini quota, manual entry still saves without retrying analysis',async()=>{
  const e=editor({quotaError:true});await e.load();e.get('analyze').onclick();await e.settle();
  assert.match(e.get('status').textContent,/20 lecturas/);
  e.get('mode-text').onchange();e.get('source-text').value='Título: Manual después del límite\nWhatsApp: 51988918238';
  e.get('organize').onclick();e.get('generate').onclick();await e.get('save').onclick();
  assert.equal(e.calls.filter(c=>c.accion==='analizar').length,1);assert.equal(e.calls.filter(c=>c.accion==='guardar').length,1);
});
test('compact editor shows one panel and preserves data when moving back and forth',async()=>{
  const e=editor();await e.load();
  assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('prepare-panel').hidden,true);assert.equal(e.get('review').hidden,false);
  e.get('tab-prepare').onclick();assert.equal(e.get('prepare-panel').hidden,false);assert.equal(e.get('data-panel').hidden,true);
  e.get('tab-review').onclick();assert.equal(e.get('titulo').value,'ADOS-2');
  e.get('generate').onclick();assert.equal(e.get('review').hidden,false);assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('prepare-panel').hidden,true);
  e.get('back-data').onclick();assert.equal(e.get('review').hidden,true);assert.match(e.get('copy').value,/ADOS-2/);
  e.get('tab-review').onclick();assert.equal(e.get('review').hidden,false);
});
test('failed connection exits loading and offers retry without disabling manual preparation',async()=>{
  const e=editor({connectionError:true});await e.context.KJAMarketingPortal.init();await e.context.KJAMarketingPortal.open();
  assert.match(e.get('status').textContent,/aún no está activado/);assert.doesNotMatch(e.get('connection').textContent,/Comprobando/);
  assert.equal(e.get('retry').hidden,false);assert.equal(e.get('retry').disabled,false);
  e.get('mode-text').onchange();e.get('source-text').value='Título: Manual durante fallo';e.get('organize').onclick();
  assert.equal(e.get('titulo').value,'Manual durante fallo');assert.equal(e.get('data-panel').hidden,true);assert.equal(e.get('review').hidden,false);
});
test('limited text creates the copy directly, omits absent facts and publishes without a separate save step',async()=>{
  const e=editor({ia:false});await e.load();e.get('tab-prepare').onclick();e.get('mode-text').onchange();
  e.get('source-text').value='Título: Curso breve\nTemario: Entrevista';e.get('organize').onclick();
  assert.equal(e.get('review').hidden,false);assert.equal(e.get('data-panel').hidden,true);
  assert.equal(e.get('telefono').value,'51988918238');assert.match(e.get('copy').value,/Curso breve/);
  assert.doesNotMatch(e.get('copy').value,/MODALIDAD|BENEFICIOS|DIRIGIDO/);
  e.get('to-publish').onclick();assert.equal(e.get('publish-panel').hidden,false);
  e.get('checked').checked=true;e.get('checked').onchange();await e.get('publish').onclick();
  const actions=e.calls.filter(c=>['guardar','publicar'].includes(c.accion)).map(c=>c.accion);
  assert.deepEqual(actions,['guardar','publicar']);assert.equal(e.calls.filter(c=>c.accion==='analizar').length,0);
});
