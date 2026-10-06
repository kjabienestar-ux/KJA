import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const renderSource=source.slice(source.indexOf('function dailyCloseItemMarkup('),source.indexOf('function renderMobileDailyClose('));
const helpers=source.slice(source.indexOf('const esc ='),source.indexOf('// Solo devuelve'));
function render(close,item={}){
  const context=vm.createContext({APP:{cierre:close},FACEBOOK_EVIDENCE_MAX:50});
  vm.runInContext(helpers+renderSource,context);
  return context.dailyCloseItemMarkup({tipo:'comparticiones',titulo:'Comparticiones de Facebook',completo:false,locked:true,...item});
}
const schedule={compartir_desde:'2026-10-05T13:00:00Z',compartir_hasta:'2026-10-05T19:00:00Z',puede_compartir:false};

test('expired sharing on a day off explains the deadline in Peru and recovery',()=>{
  const html=render({...schedule,dia_libre_presencial:true,comparticiones_vencidas:true});
  assert.match(html,/Plazo vencido/);
  assert.match(html,/terminó a las 14:00 \(hora de Perú\)/);
  assert.match(html,/solicita a administración una ampliación/);
  assert.match(html,/disabled/);
  assert.doesNotMatch(html,/Aún no disponible|se habilita al iniciar/);
});
test('a future window explains both hours without requiring attendance',()=>{
  const html=render({...schedule,entrada_at:null});
  assert.match(html,/Horario pendiente/);
  assert.match(html,/de 08:00 a 14:00/);
  assert.doesNotMatch(html,/marca.*entrada/i);
});
test('extending the window removes the blocked message and enables uploading',()=>{
  const html=render({...schedule,puede_compartir:true,comparticiones_vencidas:false},{locked:false});
  assert.match(html,/Subir evidencia/);
  assert.match(html,/data-daily-requirement="comparticiones"/);
  assert.doesNotMatch(html,/Plazo vencido|day-close-unavailable-reason|disabled/);
});
test('missing schedule and temporary blocking have actionable fallbacks',()=>{
  assert.match(render({puede_compartir:false}),/Contacta a administración/);
  assert.match(render({puede_compartir:true}),/espera a que termine/);
  assert.doesNotMatch(render({comparticiones_vencidas:true}),/—|Invalid Date/);
});
test('a locked correction preserves the review note as escaped text',()=>{
  const html=render({...schedule,comparticiones_vencidas:true},{revision_estado:'observada',revision_nota:'Falta <captura>'});
  assert.match(html,/Plazo vencido/);
  assert.match(html,/Corrección solicitada: Falta &lt;captura&gt;/);
});
