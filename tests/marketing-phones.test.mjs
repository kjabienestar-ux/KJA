import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import {publicationPhones} from '../supabase/functions/marketing-publicaciones/phones.mjs';
const require=createRequire(import.meta.url);
const model=require('../assets/js/marketing-model.js');
const sample='(51) 988 918 238(51) 937 471 659';
test('separates the two contacts from the reported flyer without joining or choosing them',()=>{
  assert.deepEqual(model.phoneCandidates(sample),['51988918238','51937471659']);
  assert.match(model.link(sample,'Hola'),/wa.me\/51988918238/);
});
test('accepts one formatted contact, handles explicit separators and rejects ambiguous strings',()=>{
  assert.match(model.link('+51 (988) 918-238','Hola'),/51988918238/);
  assert.deepEqual(model.phoneCandidates('+51 988 918 238 / +51 937 471 659'),['51988918238','51937471659']);
  assert.deepEqual(model.phoneCandidates('5198891823851937471659'),[]);
  assert.deepEqual(model.phoneCandidates('llamar al 51988918238'),[]);
});
test('selecting a candidate updates both phone fields and prompts regeneration',()=>{
  const source=fs.readFileSync(new URL('../assets/js/dashboard-marketing.js',import.meta.url),'utf8');
  const nodes={telefono:{value:sample,focus(){}},'phone-choices':{children:[],replaceChildren(){this.children=[]},append(node){this.children.push(node)}}};
  let synced=false,changed=false,message='';
  const c={el:id=>nodes[id],KJAMarketing:model,busy:false,locked:false,extraction:null,document:{createElement:()=>({})},syncWhatsApp(){synced=true},changed(){changed=true},status(text){message=text}};
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  function renderPhoneChoices(){'),source.indexOf('  function showPanel(')),c);
  c.renderPhoneChoices();assert.equal(nodes['phone-choices'].children.length,5);
  nodes['phone-choices'].children[4].onclick();assert.equal(nodes.telefono.value,'51937471659 / 51988918238');
  assert.match(model.link(nodes.telefono.value,'Hola'),/wa.me\/51937471659/);
  nodes['phone-choices'].children[3].onclick();assert.equal(nodes.telefono.value,'51937471659');
  assert.ok(synced&&changed);assert.match(message,/Actualizar copy/);
  c.renderPhoneChoices();assert.equal(nodes['phone-choices'].hidden,true);
});
test('slogan flyer uses therapy content and both contacts without course syllabus language',()=>{
  const data={titulo:'Tu bienestar mental es prioridad',descripcion:'Descubre la terapia ideal para ti.',temario:'Terapia de pareja y familia.\nTerapia de pareja cognitivo conductual.\nComunicación, celos, infidelidad, dependencia, etc.\nBienestar emocional, sexual y familiar.',detalles:'Calle Río Amazonas 214 Urb. Las Moras, San Luis, Lima, Perú.',telefono:sample};
  const copy=model.compose(data,'https://example.test/chat');
  assert.match(copy,/SERVICIO DE TERAPIA PSICOLÓGICA/);
  assert.match(copy,/988 918 238/);assert.match(copy,/937 471 659/);assert.match(copy,/📍 Calle Río Amazonas/);
  assert.doesNotMatch(copy,/BENEFICIOS DE ESTA FORMACIÓN|APRENDERÁS|certificado/i);
  assert.match(model.whatsappMessage(data.titulo,'',data),/atención, el costo/);
  assert.doesNotMatch(model.compose({...data,titulo:'Curso de terapia de pareja'},'https://example.test/chat'),/Inscríbete directamente/);
});
test('server and browser agree on both numbers, order and invalid contacts',()=>{
  for(const value of [sample,'51937471659 / 51988918238','+51 (988) 918-238','bad','5198891823851937471659'])assert.deepEqual(publicationPhones(value),model.phoneCandidates(value));
});
test('reported flyer keeps the local contact without using it as a WhatsApp destination',()=>{
  for(const phone of ['(51) 988 918 238 / 01 9074873','01 9074873 / (51) 988 918 238']){
    assert.deepEqual(model.phoneCandidates(phone),['51988918238']);
    assert.deepEqual(publicationPhones(phone),['51988918238']);
    assert.equal(new URL(model.link(phone,'Hola')).pathname,'/51988918238');
    const copy=model.contactLine({telefono:phone},'https://example.test/chat');
    assert.match(copy,/Teléfono: 01 9074873/);assert.match(copy,/988 918 238/);
    assert.doesNotMatch(copy,/\+01|51019074873/);
  }
  assert.throws(()=>model.link('01 9074873','Hola'),/código de país/);
  for(const phone of ['51988918238 / texto','51988918238 / 01','51988918238 / 019074873 / 019074874']){
    assert.deepEqual(model.phoneCandidates(phone),[]);assert.deepEqual(publicationPhones(phone),[]);
  }
});
