const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
function setup(update=async()=>({error:null})){
  const nodes={};
  for(const id of ['form','save','message','new','repeat'])nodes[id]={value:'A secure password 123!',disabled:false,dataset:{},focus(){this.focused=true},setAttribute(){},removeAttribute(){}};
  nodes.form.reset=()=>{nodes.new.value=nodes.repeat.value=''};
  const calls=[];
  const context=vm.createContext({APP:{access:{acceso_panel:true}},$:id=>nodes[id.replace('admin-password-','')],db:{auth:{updateUser:async payload=>{calls.push(payload);return update(payload)}}}});
  vm.runInContext(source.slice(source.indexOf('async function saveAdminPassword('),source.indexOf('function renderProfileQuick(')),context);
  return {nodes,calls,context,save:()=>context.saveAdminPassword({preventDefault(){}})};
}
test('changes only the signed-in account and clears password fields on success',async()=>{
  const h=setup();await h.save();
  assert.deepEqual(Object.keys(h.calls[0]),['password']);
  assert.equal(h.calls[0].password,'A secure password 123!');
  assert.equal(h.nodes.new.value,'');assert.equal(h.nodes.repeat.value,'');
  assert.equal(h.nodes.new.type,'password');assert.equal(h.nodes.message.dataset.state,'success');
});
test('accepts exactly six characters in the form and auth request',async()=>{
  const html=fs.readFileSync('dashboard.html','utf8');
  for(const id of ['new','repeat'])assert.match(html,new RegExp('id="admin-password-'+id+'"[^>]*minlength="6"'));
  const h=setup();h.nodes.new.value=h.nodes.repeat.value='Abc123';await h.save();
  assert.equal(h.calls[0].password,'Abc123');assert.equal(h.nodes.message.dataset.state,'success');
});
test('rejects mismatched and short passwords without calling auth',async()=>{
  for(const values of [['short','short'],['A secure password 123!','different password']]){
    const h=setup();[h.nodes.new.value,h.nodes.repeat.value]=values;await h.save();
    assert.equal(h.calls.length,0);assert.equal(h.nodes.message.dataset.state,'error');
  }
});
test('guards panel access and duplicate submissions',async()=>{
  const h=setup();h.context.APP.access.acceso_panel=false;await h.save();assert.equal(h.calls.length,0);
  h.context.APP.access.acceso_panel=true;h.nodes.save.disabled=true;await h.save();assert.equal(h.calls.length,0);
});
test('auth errors and network failures restore the form without reporting success',async()=>{
  for(const code of ['same_password','weak_password','reauthentication_needed','session_not_found',null]){
    const h=setup(async()=>{if(!code)throw new Error('network');return {error:{code}}});await h.save();
    assert.equal(h.nodes.message.dataset.state,'error');assert.equal(h.nodes.save.disabled,false);
    assert.ok(h.nodes.message.textContent.length>0);
  }
});
