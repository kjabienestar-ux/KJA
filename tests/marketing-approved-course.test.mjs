import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {compose,completeCourseData}=require('../assets/js/marketing-model.js');
const course={titulo:'TCC APLICADA AL TRATAMIENTO DE DEPRESIÓN EN ADOLESCENTES',modalidad:'Online (clases en vivo vía Zoom)',beneficios:'300 horas académicas\nMaterial académico\nClases en vivo vía Zoom\nCertificado académico\n1 curso gratis',detalles:'Descuento de 50%\nSolo válido en Perú\nVacantes limitadas',telefono:'51988918238'};
test('approved TCC reference completes missing curriculum and audience, without a new analysis',()=>{
  const data=completeCourseData(course);
  assert.match(data.publico,/psicólogos educativos/);assert.match(data.temario,/activación conductual/);
  assert.match(data.temario,/prevención de recaídas/);assert.equal(data.temario.split('\n').length,3);
  assert.match(data.descripcion,/acompañamiento familiar/);
});
test('reference stays exclusive to the approved course and respects manual edits',()=>{
  for(const titulo of ['TCC aplicada al tratamiento de depresión en adultos','Estimulación temprana','Terapia familiar']){
    const data=completeCourseData({titulo});assert.equal(data.publico,undefined);assert.equal(data.temario,undefined);
  }
  const edited=completeCourseData({...course,descripcion:'Texto revisado',temario:'Programa actualizado',publico:'Grupo aprobado'});
  assert.equal(edited.descripcion,'Texto revisado');assert.equal(edited.temario,'Programa actualizado');assert.equal(edited.publico,'Grupo aprobado');
});
test('course copy groups promotions, removes repeated Zoom and keeps the current contact',()=>{
  const copy=compose(course,'https://example.test/current');
  assert.equal((copy.match(/Zoom/g)||[]).length,1);
  assert.equal((copy.match(/Descuento de 50%/g)||[]).length,1);
  assert.ok(copy.indexOf('Descuento de 50%')<copy.indexOf('1 curso gratis'));
  assert.ok(copy.indexOf('1 curso gratis')<copy.indexOf('300 horas'));
  assert.match(copy,/¿A QUIÉN VA DIRIGIDO/);assert.match(copy,/activación conductual/);
  assert.match(copy,/https:\/\/example.test\/current/);assert.doesNotMatch(copy,/wa.link\/s3i757/);
});
