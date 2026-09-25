import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const modelContext={};
vm.runInNewContext(fs.readFileSync(new URL('../assets/js/dashboard-close-model.js',import.meta.url),'utf8'),modelContext);
const model=modelContext.KJACloseModel;
const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function dailyEvidenceMode(){'),source.indexOf('async function submitDailyIssue('));
function mode(count,existing=0,allowed=true,requirement='comparticiones'){
  const context={APP:{cierre:{collage_permitido:allowed}},DAILY_EVIDENCE:{requirement,files:Array(count).fill({}),existingFiles:Array(existing).fill({})}};
  vm.runInNewContext(code,context);return context.dailyEvidenceMode();
}
test('one image uses an allowed collage; adding images switches to individual captures',()=>{
  assert.equal(mode(1),'collage');assert.equal(mode(2),'individuales');
  assert.equal(mode(0,1),'collage');assert.equal(mode(1,1),'individuales');
  assert.equal(mode(50),'individuales');assert.equal(mode(0),'individuales');
});
test('automatic format never enables collage when disabled or for another requirement',()=>{
  assert.equal(mode(1,0,false),'individuales');
  assert.equal(mode(1,0,true,'rpe'),'individuales');
  const check=count=>model.evidenceSelectionPolicy({requirement:'comparticiones',mode:mode(count,0,false),count,min:5,max:50,collageAllowed:false});
  assert.equal(check(1).ok,false);assert.equal(check(5).ok,true);assert.equal(check(51).ok,false);
});
