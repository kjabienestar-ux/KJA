import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
function setup(){
 const dom=new JSDOM(fs.readFileSync('dashboard.html','utf8'),{runScripts:'outside-only',url:'http://localhost/dashboard'}),w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:true,addEventListener(){}});w.APP={view:'gestion',adminSection:'mes',sessionUid:'sidebar-test',access:{rol:'direccion',acceso_panel:true},identity:{isSystem:true}};
 w.localStorage.setItem('kja-admin-lateral-plegadas:sidebar-test',JSON.stringify(['operacion','personas','resultados','configuracion']));
 d.querySelectorAll('.admin-section-nav [data-admin-section]').forEach(x=>x.hidden=false);w.showAdminSection=section=>{w.APP.adminSection=section;w.KJAAdminLateral.sync();};
 w.eval(fs.readFileSync('assets/js/dashboard-admin-lateral.js','utf8'));return {w,d,async close(){await new Promise(r=>setTimeout(r,0));w.close();}};
}
test('static families ignore old folded preferences and preserve navigation and removed sidebar destinations',async()=>{
 const h=setup(),{w,d}=h;try{assert.equal(d.querySelectorAll('.admin-lateral-family h2').length,4);assert.equal(d.querySelectorAll('button.admin-lateral-family-head,.is-folded,.is-tucked').length,0);assert.equal(d.querySelectorAll('[data-lateral-section]').length,11);assert.equal(d.querySelectorAll('[data-lateral-section=control],[data-lateral-section=cierres]').length,0);assert.ok(d.getElementById('admin-control-section'));assert.ok(d.getElementById('admin-close-section'));d.querySelector('[data-lateral-section=roles]').click();assert.equal(w.APP.adminSection,'roles');assert.equal(d.querySelector('[data-lateral-section=roles]').getAttribute('aria-current'),'page');}finally{await h.close();}
});
test('permission changes still hide unavailable destinations and empty static families',async()=>{
 const h=setup(),{w,d}=h;try{d.getElementById('admin-access-tab').hidden=true;w.KJAAdminLateral.sync();assert.equal(d.querySelector('[data-family=configuracion]').hidden,true);assert.equal(d.querySelector('[data-lateral-section=marcado]').closest('li').hidden,true);d.getElementById('admin-access-tab').hidden=false;w.KJAAdminLateral.sync();assert.equal(d.querySelector('[data-family=configuracion]').hidden,false);}finally{await h.close();}
});
