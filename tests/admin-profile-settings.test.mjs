import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
function setup(personal=false,admin=true){
 const calls=[],nodes=new Map();
 const c=vm.createContext({APP:{identity:{hasPersonal:personal},access:{acceso_panel:admin},guidedTourUserMetadata:{},avatar:{url:''}},PROFILE_BUCKET:'perfil-fotos',PROFILE_AVATAR_IDS:['side-avatar'],Date,
 document:{querySelectorAll:()=>[]},
 $:id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},classList:{toggle(){}}});return nodes.get(id)},initials:n=>n.slice(0,2),paintProfilePhoto:()=>{},
 db:{rpc:async(...args)=>{calls.push(args);return {data:{ok:true}}},auth:{updateUser:async args=>{calls.push(args);return {}}}}});
 vm.runInContext(source.slice(source.indexOf('function ownProfileBucket'),source.indexOf('async function loadProfilePhoto')),c);
 vm.runInContext(source.slice(source.indexOf('async function saveAdminProfile'),source.indexOf('function renderProfile()')),c);
 return {c,calls};
}
test('admin photo is persisted per account; personal photo keeps existing RPC',async()=>{
 const {c,calls}=setup();assert.equal(c.ownProfileBucket(),'admin-perfil-fotos');
 await c.ownProfilePhoto('dash_guardar_foto','user/avatar.jpg');assert.equal(calls[0].data.kja_admin_foto,'user/avatar.jpg');
 assert.equal((await c.ownProfilePhoto('dash_mi_foto')).data.path,'user/avatar.jpg');
 await c.ownProfilePhoto('dash_quitar_foto');assert.equal((await c.ownProfilePhoto('dash_mi_foto')).data.path,'');
 const personal=setup(true);assert.equal(personal.c.ownProfileBucket(),'perfil-fotos');await personal.c.ownProfilePhoto('dash_guardar_foto','1/avatar.jpg');assert.equal(personal.calls[0][0],'dash_guardar_foto');
});
test('non admin cannot update admin identity or photo',async()=>{
 const {c,calls}=setup(false,false);await c.saveAdminProfile({preventDefault(){}});assert.ok((await c.ownProfilePhoto('dash_guardar_foto','other/avatar.jpg')).error);assert.equal(calls.length,0);
});
test('display name persists without changing authorization and failed saves preserve identity',async()=>{
 const {c,calls}=setup();c.$('admin-profile-name').value='  Yeiser   Administrador ';
 await c.saveAdminProfile({preventDefault(){}});assert.equal(calls[0].data.kja_nombre_visible,'Yeiser Administrador');assert.equal(c.$('side-name').textContent,'Yeiser Administrador');assert.equal(c.$('admin-profile-save').disabled,false);
 c.db.auth.updateUser=async()=>({error:Error('offline')});c.$('admin-profile-name').value='Otro';await c.saveAdminProfile({preventDefault(){}});assert.equal(c.$('side-name').textContent,'Yeiser Administrador');assert.equal(c.$('admin-profile-save').disabled,false);
});

test('profile controls exist and render for administrators without a collaborator',()=>{
 const html=fs.readFileSync('dashboard.html','utf8');const {c}=setup();
 for(const id of ['profile-description','profile-work-notice','admin-profile-settings','admin-profile-name','admin-profile-save','admin-profile-message','side-profile-link'])assert.ok(html.includes('id="'+id+'"'),id);
 c.APP.inicio={perfil:{nombre:'Yeiser'}};c.APP.avatar={url:''};c.syncProfileCover=()=>{};
 vm.runInContext(source.slice(source.indexOf('function renderAdminProfileSettings'),source.indexOf('async function saveAdminProfile')),c);
 vm.runInContext(source.slice(source.indexOf('function renderProfile()'),source.indexOf('async function loadTeam()')),c);
 c.$('side-name').textContent='Yeiser';c.renderProfile();
 assert.equal(c.$('admin-profile-settings').hidden,false);assert.equal(c.$('profile-work-notice').hidden,true);assert.equal(c.$('profile-name').textContent,'Yeiser');
});
