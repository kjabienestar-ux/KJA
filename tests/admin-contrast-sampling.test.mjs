import test from 'node:test';
import assert from 'node:assert/strict';
import {contrast,parseColor,sampleGlyphBacking} from '../scripts/sample-admin-contrast.mjs';

test('Contraste absoluto y color computado',()=>{
  assert.equal(contrast([0,0,0],[255,255,255]),21);
  assert.deepEqual(parseColor('rgb(56, 49, 43)'),[56,49,43,1]);
  assert.deepEqual(parseColor('rgba(56, 49, 43, 0.5)'),[56,49,43,.5]);
  assert.equal(parseColor('transparent'),null);
});
test('El glifo selecciona el fondo renderizado, no el píxel antialias',()=>{
  const backing=Buffer.from([255,255,255,255,190,170,150,255,150,120,100,255]);
  const normal=Buffer.from([200,200,200,255,130,120,110,255,150,120,100,255]);
  const measured=sampleGlyphBacking(normal,backing,3,1,{x:0,y:0,w:3,h:1},[56,49,43,1]);
  assert.equal(measured.pixels,2);
  assert.deepEqual(measured.worstBackground,[190,170,150]);
  assert.equal(measured.ratio,contrast([56,49,43],[190,170,150]));
  assert.equal(sampleGlyphBacking(backing,backing,3,1,{x:0,y:0,w:3,h:1},[0,0,0,1]),null);
});
test('La tinta translúcida se compone sobre el fondo de cada píxel',()=>{
  const backing=Buffer.from([255,255,255,255]),normal=Buffer.from([128,128,128,255]);
  assert.equal(sampleGlyphBacking(normal,backing,1,1,{x:0,y:0,w:1,h:1},[0,0,0,.5]).ratio,contrast([127.5,127.5,127.5],[255,255,255]));
});
