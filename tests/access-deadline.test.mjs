import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createServer,createTab,flush} from './helpers/pausa-harness.mjs';
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const helper=source.slice(source.indexOf('async function accessWithDeadline('),source.indexOf("$('form-colab').addEventListener('submit'"));
test('a stalled access request expires, clears its timer and permits a later attempt',async()=>{
  let expire,cleared=0;
  const context=vm.createContext({setTimeout:fn=>{expire=fn;return 1},clearTimeout:()=>cleared++});
  vm.runInContext(helper,context);
  const request=context.accessWithDeadline(new Promise(()=>{}));expire();
  await assert.rejects(request,error=>error.code==='ACCESS_TIMEOUT');assert.equal(cleared,1);
  assert.equal(await context.accessWithDeadline(Promise.resolve('session')),'session');assert.equal(cleared,2);
});
test('pauses do not make personal RPCs without an authenticated collaborator',async()=>{
  const server=createServer(),tab=createTab(server);await flush();server.requests.length=0;
  tab.window.APP.inicio=null;
  await tab.api.loadCompleted();assert.equal(server.requests.length,0);
  tab.window.APP.inicio={colaborador:{id:42},dia:{marcado:true}};
  await tab.api.loadCompleted();assert.equal(server.requests[0].name,'dash_mis_pausas');
});
test('login distinguishes credentials, timeouts, limits and connection failures',()=>{
  const context=vm.createContext({});vm.runInContext(helper,context);
  assert.match(context.accessFailureMessage({code:'invalid_credentials'}),/contraseña/);
  assert.match(context.accessFailureMessage({code:'ACCESS_TIMEOUT'}),/tardó demasiado/);
  assert.match(context.accessFailureMessage({name:'TimeoutError'}),/tardó demasiado/);
  assert.match(context.accessFailureMessage({status:429}),/demasiados intentos/);
  assert.doesNotMatch(context.accessFailureMessage({status:503}),/contraseña|base de datos/);
});
