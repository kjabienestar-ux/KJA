import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
const boot=html.split('/* ───── INICIO ───── */')[1].split('</script>')[0];
const dash=html.slice(html.indexOf('async function mostrarDash('),html.indexOf('/* Ingreso con bienvenida'));
function harness({session=null,error=null,profile=true,reject=false}={}){
  const nodes=new Map(); const calls=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{display:'none'},textContent:''});return nodes.get(id)};
  const context={$,console:{warn(){}},setTimeout(){},KJACert:{preloadFonts:async()=>{}},
    initFlatpickr(){calls.push('calendar')},resetForm(){calls.push('reset')},
    db:{auth:{getSession:async()=>{calls.push('session');if(reject)throw Error('offline');return {data:{session},error}}}},
    cargarPerfil:async()=>{calls.push('profile');assert.equal($('dash').style.display,'none');return profile},
    esAdmin:()=>false,prefillNumero(){calls.push('number')},cargarClientes(){calls.push('clients')},dibujar(){calls.push('draw')},
    loginMsg(text){$('login-msg').textContent=text}};
  vm.createContext(context);vm.runInContext(dash,context);
  return {nodes,$,calls,run:()=>vm.runInContext(boot,context)};
}
test('reload restores saved session after form initialization and validates profile',async()=>{
  const h=harness({session:{user:{email:'equipo@example.test'}}});await h.run();
  assert.equal(h.$('dash').style.display,'block');assert.equal(h.$('login-wrap').style.display,'none');
  assert.deepEqual(h.calls,['calendar','reset','session','profile','number','clients','draw']);
});
test('without a session, including after logout, shows login without loading certificates',async()=>{
  const h=harness();await h.run();assert.equal(h.$('login-wrap').style.display,'flex');
  assert.equal(h.$('dash').style.display,'none');assert.ok(!h.calls.includes('profile'));assert.ok(!h.calls.includes('clients'));
});
test('saved authentication does not bypass certificate profile permissions',async()=>{
  const h=harness({session:{user:{email:'equipo@example.test'}},profile:false});await h.run();
  assert.equal(h.$('dash').style.display,'none');assert.equal(h.$('login-wrap').style.display,'flex');
  assert.match(h.$('login-msg').textContent,/no tiene acceso/);assert.ok(!h.calls.includes('clients'));
});
for(const failure of [{error:{message:'expired'}},{reject:true}])test('session recovery failure leaves a usable login',async()=>{
  const h=harness(failure);await h.run();assert.equal(h.$('login-wrap').style.display,'flex');
  assert.equal(h.$('dash').style.display,'none');assert.match(h.$('login-msg').textContent,/recuperar tu sesión/);
});
