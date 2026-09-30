import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
function harness(){
  const timers=new Map(),listeners={},changes=[];
  let now=0,serial=0;
  const portal={dataset:{}},toggle={hidden:false,dataset:{},setAttribute(k,v){this[k]=v;},focus(){doc.activeElement=this;}};
  const logout={inside:true},footer={getBoundingClientRect:()=>({top:900})};
  const nav={inside:true},sidebar={contains:n=>n===toggle||n?.inside,addEventListener:(event,fn)=>listeners[event]=fn};
  const doc={activeElement:null};
  const state={desktop:true,hover:true};
  const ctx={document:doc,APP:{sessionUid:'test',identity:{hasPersonal:true},view:'inicio'},SIDEBAR_COLLAPSED_KEY:'sidebar',
    $:id=>({'portal':portal,'sidebar':sidebar,'sidebar-collapse-toggle':toggle,'sidebar-tooltip':{hidden:true},'logout':logout,'sidebar-session-actions':footer}[id]),
    window:{matchMedia:query=>({matches:state.desktop&&(!query.includes('hover:')||state.hover)})},
    localStorage:{getItem:()=>null,setItem:(...args)=>changes.push(args)},
    setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,time:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('let sidebarHoverTimer='),source.indexOf('\nfunction paintShell(')),ctx);
  vm.runInContext(source.slice(source.indexOf("const desktopSidebar=$('sidebar');"),source.indexOf("\ndocument.addEventListener('pointerover'")),ctx);
  ctx.syncSidebarCollapse();
  return {ctx,portal,toggle,doc,nav,logout,state,changes,
    event:(name,extra={})=>listeners[name]({pointerType:'mouse',clientY:100,...extra}),
    tick(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.time<=now){timers.delete(id);timer.fn();}},
    collapsed:()=>portal.dataset.sidebarCollapsed==='true'};
}
test('passing briefly over the rail does not flash the expanded panel',()=>{
  const h=harness();h.event('pointerenter');h.tick(40);h.event('pointerleave');h.tick(300);
  assert.equal(h.collapsed(),true);assert.equal(h.changes.length,0);
});
test('hover opens after intent and tolerates a brief trip outside the panel',()=>{
  const h=harness();h.event('pointerenter');h.tick(80);assert.equal(h.collapsed(),false);
  h.event('pointerleave');h.tick(150);assert.equal(h.collapsed(),false);
  h.event('pointerenter');h.tick(300);assert.equal(h.collapsed(),false);
  h.event('pointerleave');h.tick(220);assert.equal(h.collapsed(),true);
});
test('keyboard focus reveals labels and prevents a pointer exit from closing navigation',()=>{
  const h=harness();h.doc.activeElement=h.nav;h.event('focusin',{target:h.nav});
  h.event('pointerleave');h.tick(300);assert.equal(h.collapsed(),false);
  h.doc.activeElement=null;h.event('focusout',{relatedTarget:null});h.tick(220);assert.equal(h.collapsed(),true);
});
test('moving between pages does not close the panel under the pointer',()=>{
  const h=harness();h.event('pointerenter');h.tick(80);h.ctx.syncSidebarCollapse();assert.equal(h.collapsed(),false);
});
test('touch input and leaving the desktop breakpoint do not trigger hover collapse',()=>{
  const h=harness();h.event('pointerenter',{pointerType:'touch'});h.tick(200);assert.equal(h.collapsed(),true);
  h.event('pointerenter');h.state.desktop=false;h.ctx.syncSidebarCollapse();h.tick(300);
  assert.equal(h.collapsed(),false);assert.equal(h.toggle.hidden,true);
});
test('explicit toggle cancels pending hover and keeps its accessible state in sync',()=>{
  const h=harness();h.event('pointerenter');h.ctx.setSidebarCollapsed(true);h.tick(200);
  assert.equal(h.collapsed(),true);assert.equal(h.toggle['aria-expanded'],'false');assert.equal(h.changes.length,1);
});
test('approaching logout from below or from the side keeps the sidebar closed',()=>{
  const h=harness();h.event('pointerenter',{clientY:940});h.tick(300);
  assert.equal(h.collapsed(),true);
  h.event('pointermove',{clientY:925,target:h.logout});h.tick(300);
  assert.equal(h.collapsed(),true);
  h.ctx.syncSidebarCollapse();assert.equal(h.collapsed(),true);
});
test('moving toward logout cancels a pending expansion before the button can shift',()=>{
  const h=harness();h.event('pointerenter',{clientY:820});h.tick(40);
  h.event('pointermove',{clientY:875});h.tick(200);assert.equal(h.collapsed(),true);
  h.event('pointermove',{clientY:700});h.tick(80);assert.equal(h.collapsed(),false);
});
test('focusing logout does not expand the sidebar but focusing navigation does',()=>{
  const h=harness();h.doc.activeElement=h.logout;h.event('focusin',{target:h.logout});
  h.ctx.syncSidebarCollapse();h.tick(300);assert.equal(h.collapsed(),true);
  h.doc.activeElement=h.nav;h.event('focusin',{target:h.nav});assert.equal(h.collapsed(),false);
});
