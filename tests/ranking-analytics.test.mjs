import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/js/ranking-model.js';
const model=globalThis.KJARankingModel;
test('area means exclude unevaluated people and criterion rates use scheduled days',()=>{
  const result=model.summarize([
    {score:90,penalty:3,metricas:{dias_mes:10,entradas_puntuales:9,revisiones_pendientes:2}},
    {score:50,penalty:0,metricas:{dias_mes:30,entradas_puntuales:15}},
    {score:null,penalty:0,metricas:{}}
  ]);
  assert.equal(result.average,70);assert.equal(result.evaluated,2);assert.equal(result.count,3);
  assert.equal(result.criteria[0].rate,60);assert.equal(result.criteria[1].rate,null);
  assert.equal(result.pending,2);assert.equal(result.penalty,3);
});
test('empty analytics stay unevaluated',()=>{
  const result=model.summarize([]);assert.equal(result.average,null);assert.equal(result.count,0);
  assert.ok(result.criteria.every(c=>c.rate===null));
});
