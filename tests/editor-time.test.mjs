import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={};vm.runInNewContext(fs.readFileSync('assets/js/dashboard-editor-time.js','utf8'),ctx);
const {normalize}=ctx.KJAEditorTime;
test('editor hours round-trip every minute without rounding existing schedules',()=>{
  for(let h=0;h<24;h++)for(let m=0;m<60;m++){
    const value=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    assert.equal(normalize(value),value);
  }
});
test('24-hour format preserves midnight, noon and custom minutes and rejects invalid values',()=>{
  for(const value of ['00:00','12:00','20:45','23:17'])assert.equal(normalize(value),value);
  assert.equal(normalize('08:17:00'),'08:17');
  for(const value of ['',null,'24:00','08:60','08:00 PM'])assert.equal(normalize(value),'');
});
