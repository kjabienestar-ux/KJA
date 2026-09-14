import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../assets/js/ranking-model.js';
const person=(nombre,extra={})=>({nombre,inicio_conocido:true,metricas:{dias_mes:10,dias:10,dias_participacion:12,entradas_puntuales:10,salidas_puntuales:10,rpe_mes:10,rpe_cumplidos:10,facebook_mes:12,facebook_cumplidos:12,...extra}});
test('four requirements reach 100 with ties and no hours bonus',()=>{
 const rows=model.evaluate([person('Ana'),person('Beto',{horas:1000})]);assert.deepEqual(rows.map(r=>r.score),[100,100]);assert.deepEqual(rows.map(r=>r.rank),[1,1]);
});
test('new participants use each calendar from day one',()=>{
 const row=model.evaluate([person('Nueva',{dias:5,entradas_puntuales:5,salidas_puntuales:5,rpe_cumplidos:5,facebook_cumplidos:6})])[0];assert.equal(row.score,50);
});
test('sharing without work still earns a position',()=>{
 const row=model.evaluate([person('Ana',{dias:0,dias_mes:0,rpe_mes:0,rpe_cumplidos:0,entradas_puntuales:0,salidas_puntuales:0})])[0];assert.equal(row.score,30);assert.equal(row.rank,1);assert.equal(row.parts.entrada,null);
});
test('missing scheduled Facebook evidence reduces points',()=>{assert.equal(model.evaluate([person('Ana',{facebook_cumplidos:10})])[0].score,95)});
test('assignment penalty capped and score never negative',()=>{
 assert.equal(model.evaluate([person('Ana',{asignaciones_incumplidas:1})])[0].score,97);
 assert.equal(model.evaluate([person('Ana',{asignaciones_incumplidas:50})])[0].score,85);
 assert.equal(model.evaluate([person('Ana',{entradas_puntuales:0,salidas_puntuales:0,rpe_cumplidos:0,facebook_cumplidos:0,asignaciones_incumplidas:50})])[0].score,0);
});
test('missing participation/start and invalid weights',()=>{
 assert.equal(model.evaluate([{...person('Ana'),inicio_conocido:false}])[0].rank,null);
 assert.equal(model.evaluate([person('Ana',{dias_participacion:0})])[0].rank,null);
 assert.throws(()=>model.evaluate([],{...model.defaults,entrada:90}));assert.throws(()=>model.evaluate([],{...model.defaults,penalizacion:-1}));
});
