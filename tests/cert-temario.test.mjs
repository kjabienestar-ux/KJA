import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../certificados/cert-render.js',import.meta.url),'utf8');
function harness(){
  const text=[],bars=[];
  const ctx={
    clearRect(){},drawImage(){},fillRect(){},beginPath(){},fill(){},stroke(){},
    roundRect(x,y,w,h){bars.push({x,y,w,h});},
    createLinearGradient(){return {addColorStop(){}};},
    measureText(value){return {width:Array.from(value).length*parseFloat(this.font.match(/([\d.]+)px/)[1])*0.6};},
    fillText(value,x,y){text.push({value,x,y,width:this.measureText(value).width,size:parseFloat(this.font.match(/([\d.]+)px/)[1]),color:this.fillStyle});}
  };
  const scope={window:{},Image:class{set src(value){this.onload();}},console};
  scope.window=scope;
  vm.runInNewContext(source,scope);
  return {render:data=>scope.window.KJACert.renderTemario({getContext:()=>ctx},data),text,bars};
}

for(const count of [1,2,8]) for(const tituloSize of [null,48]){
  test(`course titles stay clear of dates and inside ${count} rows, size ${tituloSize}`,async()=>{
    const h=harness();
    const titles=['Introducción a pruebas neuropsicología','Intervención a la neuropsicología en el área clínica y educativa','Neuropsicología'.repeat(15)];
    const modulos=Array.from({length:count},(_,i)=>({titulo:titles[i%titles.length],fechaInicio:'2026-09-10',fechaFin:'2026-10-28',horas:20}));
    await h.render({tipo:'curso',modulos,tituloSize});
    const rows=h.bars.filter(b=>b.x===175);
    const drawn=h.text.filter(t=>t.color==='#3a5588');
    assert.ok(drawn.length>=count);
    for(const t of drawn){
      assert.ok(t.x-t.width/2>=510-0.01,'title must clear the ordinal');
      assert.ok(t.x+t.width/2<=1210+0.01,'title must clear the first date pill at x=1230');
      assert.ok(rows.some(r=>t.y-t.size*0.61>=r.y+3.99 && t.y+t.size*0.61<=r.y+r.h-3.99),'title must fit its row vertically');
    }
    assert.equal(drawn.map(t=>t.value).join('').replace(/\s/g,''),modulos.map(m=>m.titulo).join('').replace(/\s/g,''),'all title text is retained');
    assert.equal(h.text.filter(t=>t.value==='10/09/2026').length,count);
    assert.ok(h.text.some(t=>t.value===`Total de horas académicas = ${count*20} hrs`));
  });
}

for(const tipo of ['curso','especializacion']) test(`titles-only layout remains available for ${tipo}`,async()=>{
  const h=harness();
  await h.render({tipo,soloTitulos:true,modulos:[{titulo:'Evaluación e intervención neuropsicológica'}],nota:17});
  assert.equal(h.text.filter(t=>t.color==='#2c326c').map(t=>t.value).join(' '),'Evaluación e intervención neuropsicológica');
  assert.ok(!h.text.some(t=>t.value.includes('hrs')));
  assert.ok(h.text.some(t=>t.value==='17'));
});
