import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkPaintedGeometry} from '../scripts/audit-admin-painted-geometry.mjs';
const tokenFile=JSON.parse(fs.readFileSync(new URL('../assets/admin-tokens.json',import.meta.url),'utf8'));
const tokens=tokenFile.values;
const row=(property,value,classes='',parent='')=>({property,value,samples:[{classes,parent}],count:1});
test('Painted common roles and the exact functional geometry are classified',()=>{
  const result=checkPaintedGeometry({painted:{mes:[row('radius','18px'),row('radius','2px','','admin-month-area-sticky'),row('color','rgb(56, 49, 43)')],ranking:[row('backgroundColor','rgb(255, 248, 234)','rk-ad-person'),row('shadow','rgba(214, 138, 6, 0.35) 0px 4px 10px 0px','rk-crown')]}},tokens);
  assert.equal(result.pass,true);
  assert.equal(result.functional.length,3);
});
test('A different component cannot reuse the functional radius or medal exceptions',()=>{
  const result=checkPaintedGeometry({painted:{mes:[row('radius','2px','','other-control'),row('radius','7px')],ranking:[row('backgroundColor','rgb(255, 248, 234)','ordinary-card')]}},tokens);
  assert.equal(result.pass,false);
  assert.equal(result.unexpected.length,3);
});
test('The six overview graphic roles preserve the approved series and have code consumers',()=>{
  const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
  const approved={positive:'#187d69',alert:'#b45d3c',alternate:'#c69a35',other:'#7a8da4',neutral:'#c9c6bf',empty:'#e5e2dd'};
  for(const [name,color]of Object.entries(approved)){
    assert.equal(tokens['chart-overview-'+name],color);
    assert.ok(source.includes('var(--kja-chart-overview-'+name+','+color+')'));
  }
});
