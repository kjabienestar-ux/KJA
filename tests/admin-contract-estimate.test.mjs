import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-equipo.js','utf8');
const ctx=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function estimateAdminContractHours('),source.indexOf('function calculateAdminContractHours(')),ctx);
const day={mod:'virtual',ini:'08:00',fin:'13:00',vinc:'practicas'};
test('counts inclusive endpoints, weekdays and partial weeks',()=>{
  const schedule={1:day,2:day,3:day,4:day,5:day};
  assert.equal(ctx.estimateAdminContractHours('2026-10-05','2026-10-11',schedule).hours,25);
  assert.equal(ctx.estimateAdminContractHours('2026-10-05','2026-10-05',schedule).hours,5);
  assert.equal(ctx.estimateAdminContractHours('2026-10-10','2026-10-11',schedule).hours,0);
});
test('separates volunteer hours for mixed contracts and preserves fractions',()=>{
  const result=ctx.estimateAdminContractHours('2026-10-05','2026-10-06',{1:{...day,fin:'12:30'},2:{...day,vinc:'voluntariado'}},true);
  assert.equal(result.hours,4.5);assert.equal(result.volunteer,5);
});
test('rejects missing or reversed dates and invalid shifts',()=>{
  assert.throws(()=>ctx.estimateAdminContractHours('','2026-10-06',{}));
  assert.throws(()=>ctx.estimateAdminContractHours('2026-10-07','2026-10-06',{}));
  assert.throws(()=>ctx.estimateAdminContractHours('2026-10-05','2026-10-06',{1:{...day,fin:'07:00'}}));
});
