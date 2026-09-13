import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function mobile(){
  class Element{
    children=[];dataset={};attrs={};listeners={};hidden=false;disabled=false;value='';textContent='';classes=new Set();
    classList={add:c=>this.classes.add(c),contains:c=>this.classes.has(c)};
    append(...children){this.children.push(...children)}replaceChildren(){this.children=[]}
    setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}
    focus(){this.focused=true}
    before(el){this.beforeElement=el}addEventListener(k,fn){this.listeners[k]=fn}click(){this.clicks=(this.clicks||0)+1}
    querySelectorAll(){return this.children}
  }
  const nav=new Element(),section=new Element(),ledger=new Element(),modal=new Element(),sidebar=new Element();modal.hidden=true;
  const make=(value,text,hidden=false)=>{const e=new Element();e.dataset.adminSection=value;e.textContent=text;e.hidden=hidden;return e};
  const overview=make('overview','Resumen operativo'),roles=make('roles','Roles y equipos',true),month=make('mes','Mes completo');overview.classes.add('active');nav.append(overview,roles,month);
  const styles={},viewListeners={},observers=[];
  const document={documentElement:{style:{setProperty:(k,v)=>styles[k]=v}},body:{dataset:{}},querySelector:()=>nav,getElementById:id=>id==='view-gestion'?section:id==='admin-month-ledger'?ledger:id==='sidebar'?sidebar:null,createElement:()=>new Element(),querySelectorAll:()=>[modal]};
  const visualViewport={height:700,offsetTop:0,addEventListener:(k,fn)=>viewListeners[k]=fn};
  const context={document,visualViewport,innerHeight:800,addEventListener(){},getComputedStyle:el=>({display:el.hidden?'none':'flex'}),MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(){}}};context.window=context;
  vm.runInNewContext(fs.readFileSync(new URL('../assets/js/dashboard-mobile.js',import.meta.url),'utf8'),context);
  return {nav,overview,roles,month,section,ledger,modal,sidebar,document,styles,visualViewport,viewListeners,observers,select:nav.beforeElement.children[1]};
}

test('mobile admin selector only offers authorized sections and invokes the existing action',()=>{
  const h=mobile();assert.deepEqual(h.select.children.map(o=>o.value),['overview','mes']);
  h.nav.beforeElement.open=true;
  h.select.children[1].listeners.click();assert.equal(h.month.clicks,1);
  assert.equal(h.nav.beforeElement.open,false);
  assert.equal(h.nav.beforeElement.children[0].focused,true);
  h.month.hidden=true;h.select.children[1].listeners.click();assert.equal(h.month.clicks,1);
  assert.equal(h.roles.clicks,undefined);
});
test('mobile navigation follows role changes and active section changes',()=>{
  const h=mobile();h.roles.hidden=false;h.overview.classes.delete('active');h.roles.classes.add('active');h.observers[0].fn();
  assert.deepEqual(h.select.children.map(o=>o.value),['overview','roles','mes']);assert.equal(h.select.children[1].attrs['aria-pressed'],'true');
  assert.equal(h.nav.beforeElement.children[0].children[1].textContent,'Roles y equipos');
  h.roles.disabled=true;h.observers[0].fn();assert.deepEqual(h.select.children.map(o=>o.value),['overview','mes']);
});

test('section disclosure closes with Escape and restores keyboard focus',()=>{
  const h=mobile(),disclosure=h.nav.beforeElement;disclosure.open=true;
  let prevented=false;
  disclosure.listeners.keydown({key:'Escape',preventDefault(){prevented=true}});
  assert.equal(disclosure.open,false);assert.equal(disclosure.children[0].focused,true);assert.equal(prevented,true);
});
test('visible viewport follows keyboard and scroll offsets; dialogs suppress floating chat',()=>{
  const h=mobile();h.visualViewport.height=380;h.visualViewport.offsetTop=60;h.viewListeners.resize();
  assert.equal(h.styles['--mobile-visible-height'],'380px');assert.equal(h.styles['--mobile-visible-top'],'60px');
  h.modal.hidden=false;h.observers[1].fn();assert.equal(h.document.body.dataset.mobileDialogOpen,'true');
  h.modal.hidden=true;h.observers[1].fn();assert.equal(h.document.body.dataset.mobileDialogOpen,'false');
  assert.equal(h.ledger.tabIndex,0);assert.equal(h.ledger.attrs.role,'region');
});

test('opening and closing the sidebar updates the mobile overlay state independently of dialogs',()=>{
  const h=mobile();
  assert.equal(h.document.body.dataset.mobileMenuOpen,'false');
  h.sidebar.classes.add('open');h.observers[2].fn();
  assert.equal(h.document.body.dataset.mobileMenuOpen,'true');
  h.modal.hidden=false;h.observers[1].fn();
  h.sidebar.classes.delete('open');h.observers[2].fn();
  assert.equal(h.document.body.dataset.mobileMenuOpen,'false');
  assert.equal(h.document.body.dataset.mobileDialogOpen,'true');
});
