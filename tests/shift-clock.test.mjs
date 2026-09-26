import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('let _clockInterval=null;'),source.indexOf('\nfunction renderRailSchedule('));
function clock(now){
  let elapsed=0,callback=null,starts=0,position;
  const nodes=new Map();
  const $=id=>{
    if(!nodes.has(id)){
      const classes=new Set(),span={textContent:'00'};
      nodes.set(id,{textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},querySelector:()=>span});
    }
    return nodes.get(id);
  };
  const env={$,Date:{now:()=>elapsed},minutes:t=>t?Number(t.split(':')[0])*60+Number(t.split(':')[1]):null,
    fmtTime:t=>t.slice(0,5),positionNow:d=>{position=d.ahora},
    setInterval:fn=>{callback=fn;starts++;return 1},clearInterval:()=>{callback=null}};
  vm.runInNewContext(code,env);
  env.startShiftClock({labora:true,hora_entrada:'08:00:00',hora_salida:'14:00:00',ahora:now});
  return {$,env,advance:ms=>{elapsed+=ms;callback?.()},running:()=>!!callback,starts:()=>starts,position:()=>position};
}
test('countdown follows server time and advances the restored timeline',()=>{
  const h=clock('13:59:58');
  assert.equal(h.$('clock-s').querySelector().textContent,'02');
  h.advance(1000);
  assert.equal(h.$('clock-s').querySelector().textContent,'01');
  assert.equal(h.position(),'13:59:59');
  h.advance(1000);
  assert.equal(h.$('shift-clock').classList.contains('ended'),true);
  assert.equal(h.$('clock-finish-time').textContent,'Hasta las 14:00');
  assert.match(h.$('clock-caption').textContent,/confirmar tus evidencias y tu salida/);
  assert.equal(h.running(),false);
});
test('finished shifts do not start another timer; upcoming shifts still count down',()=>{
  const ended=clock('19:00:00');
  assert.equal(ended.starts(),0);
  assert.equal(ended.$('clock-h').querySelector().textContent,'00');
  const upcoming=clock('07:30:00');
  assert.equal(upcoming.$('clock-m').querySelector().textContent,'30');
  assert.equal(upcoming.$('clock-label').textContent,'Tu jornada inicia en');
  upcoming.env.startShiftClock({labora:false});
  assert.equal(upcoming.running(),false);
  assert.equal(upcoming.$('clock-finish-time').textContent,'');
  assert.equal(upcoming.$('clock-label').textContent,'Sin jornada programada');
});

test('fractional server seconds stay in two-digit groups across minute and end boundaries',()=>{
  const h=clock('08:09:47.895789');
  assert.deepEqual(['h','m','s'].map(id=>h.$('clock-'+id).querySelector().textContent),['05','50','13']);
  h.advance(13000);
  assert.deepEqual(['h','m','s'].map(id=>h.$('clock-'+id).querySelector().textContent),['05','50','00']);
  h.advance(1000);
  assert.deepEqual(['h','m','s'].map(id=>h.$('clock-'+id).querySelector().textContent),['05','49','59']);
  assert.match(h.position(),/^\d{2}:\d{2}:\d{2}$/);
  const end=clock('13:59:59.999999');
  assert.equal(end.$('clock-s').querySelector().textContent,'01');
  end.advance(1000);
  assert.equal(end.$('clock-s').querySelector().textContent,'00');
  assert.equal(end.running(),false);
});
