import test from 'node:test';
import assert from 'node:assert/strict';
import {partialDraft} from '../supabase/functions/marketing-publicaciones/drafts.mjs';
const empty=()=>Object.fromEntries(['titulo','descripcion','publico','temario','modalidad','beneficios','detalles','telefono','correo','mensaje','facebook_url'].map(k=>[k,'']));
test('saves incomplete work verbatim without authorizing publication',()=>{
  const datos={...empty(),titulo:'Avance',telefono:'por confirmar',descripcion:'Texto sin terminar',opciones:{material:true}};
  const result=partialDraft(datos,'Mi texto provisional');
  assert.equal(result.datos.telefono,'por confirmar');assert.equal(result.copy,'Mi texto provisional');assert.equal(result.enlace,'');
  assert.equal(result.datos.opciones.material,true);
});
test('rejects malformed or oversized partial drafts',()=>{
  for(const input of [null,[],{}, {...empty(),titulo:'x'.repeat(6001)},{...empty(),opciones:{admin:true}}])assert.throws(()=>partialDraft(input,''));
  assert.throws(()=>partialDraft(empty(),'x'.repeat(20001)));
});
