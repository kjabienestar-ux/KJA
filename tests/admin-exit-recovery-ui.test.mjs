import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8');
const ctx=vm.createContext({APP:{access:{rol:'direccion'}}});
vm.runInContext(source.slice(source.indexOf('function adminCloseExitRecovery('),source.indexOf('function adminCloseClock(')),ctx);
const person={id:12,cierre:{entrada_at:'2026-09-30T13:15:00Z',salida_at:null,estado:'incompleta',requisitos:[{tipo:'salida',completo:true}]}};
test('completed exit evidence offers recovery without requiring duplicate uploads',()=>{
  assert.equal(ctx.adminCloseExitRecovery(person),true);
  for(const close of [{salida_at:'2026-09-30T18:00:00Z'},{entrada_at:null},{requiere_salida:false},{aplica_jornada:false},{justificado:true}]){
    assert.equal(ctx.adminCloseExitRecovery({...person,cierre:{...person.cierre,...close}}),false);
  }
  const sparse={...person,cierre:{...person.cierre,requisitos:[]}};
  assert.equal(ctx.adminCloseExitRecovery(sparse),false);
  assert.equal(ctx.adminCloseExitRecovery(sparse,[{requisito:'salida',estado:'completo'}]),true);
});
test('recovery uses selected historical date, refreshes state, reports pending reasons and respects permissions',async()=>{
  const calls=[],messages=[];let refreshes=0,result={ok:true,regularizada:true};
  Object.assign(ctx,{$:()=>({value:'2026-09-30'}),isoLima:()=> '2026-10-05',toast:(...args)=>messages.push(args),
    db:{rpc:async(name,args)=>{calls.push([name,args]);return {data:result};}},loadAdminCloses:async()=>{refreshes++;}});
  const button={disabled:false,textContent:'Recuperar salida'};
  await ctx.recoverAdminCloseExit(12,button);
  assert.equal(calls[0][0],'dash_admin_regularizar_cierre');assert.equal(calls[0][1].p_fecha,'2026-09-30');
  assert.equal(refreshes,1);assert.equal(button.disabled,false);
  result={ok:true,regularizada:false,motivo:'requisitos_pendientes'};
  await ctx.recoverAdminCloseExit(12,button);
  assert.match(messages.at(-1)[0],/faltan evidencias laborales/);assert.equal(messages.at(-1)[1],true);
  ctx.APP.access.rol='lider';await ctx.recoverAdminCloseExit(12,button);assert.equal(calls.length,2);
});
