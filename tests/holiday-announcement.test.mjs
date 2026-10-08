import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('assets/js/dashboard-holiday.js','utf8'),ctx);
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
vm.runInContext(source.slice(source.indexOf('function dailyCloseGuidePresentation('),source.indexOf('function dailyCloseItemMarkup(')),ctx);
const holiday={ok:true,feriado:true,aplica_comparticiones:true,puede_compartir:true,requisitos:[{tipo:'comparticiones',completo:false}]};
test('holiday announcement uses server confirmation and clears on ordinary or unresolved days',()=>{
  for(const data of [null,{}, {ok:true},{...holiday,ok:false},{...holiday,feriado:false}])assert.equal(ctx.KJAHoliday.presentation(data),null);
});
test('unscheduled and completed users are not told to upload evidence',()=>{
  assert.match(ctx.KJAHoliday.presentation({...holiday,aplica_comparticiones:false}).message,/no tienes pendientes/);
  const done={...holiday,requisitos:[{tipo:'comparticiones',completo:true}]};
  assert.match(ctx.KJAHoliday.presentation(done).message,/Ya completaste/);
  assert.match(ctx.dailyCloseGuidePresentation(done).title,/Todo listo/);
});
test('holiday instruction respects open, future and expired Facebook windows',()=>{
  assert.match(ctx.dailyCloseGuidePresentation(holiday).copy,/adjunta tus capturas/);
  assert.match(ctx.dailyCloseGuidePresentation({...holiday,puede_compartir:false}).copy,/se habilitará/);
  assert.match(ctx.dailyCloseGuidePresentation({...holiday,comparticiones_vencidas:true}).copy,/terminó/);
  assert.match(ctx.KJAHoliday.presentation(holiday).detail,/No necesitas marcar asistencia/);
});
