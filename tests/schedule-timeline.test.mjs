import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function minutes('),source.indexOf('/* ── Countdown'));

test('timeline clamps the marker to the shift and keeps the readable caption in sync',()=>{
  const node=()=>({style:{setProperty(name,value){this[name]=value;}},setAttribute(name,value){this[name]=value;}});
  const nodes={'arc-progress':node(),'arc-now-dot':node(),'arc-now-glow':node(),'timeline-caption':node()};
  let requestedLength;
  const track={getTotalLength:()=>400,getPointAtLength:length=>{requestedLength=length;return {x:length===0?12:length===400?388:200,y:length===200?42:78};}};
  const context={document:{querySelector:()=>track,getElementById:id=>nodes[id]||null}};
  vm.runInNewContext(code,context);
  for(const [time,distance,label] of [['07:00',0,'Inicio'],['11:00',200,'Ahora'],['18:00',400,'Fin']]){
    context.positionNow({hora_entrada:'08:00',hora_salida:'14:00',ahora:time});
    assert.equal(requestedLength,distance);
    assert.equal(nodes['arc-progress'].style.strokeDashoffset,400-distance);
    assert.equal(nodes['timeline-caption'].textContent,label);
    assert.equal(parseFloat(nodes['timeline-caption'].style['--marker-x']),nodes['arc-now-dot'].cx/4);
    assert.equal(nodes['arc-now-dot'].cx,nodes['arc-now-glow'].cx);
  }
});
