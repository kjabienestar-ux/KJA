import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(){
 const nodes={};let focused=null,changes=0;
 class Node{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.events={};this.style={};this.value='';this.hidden=false;this.scrollTop=0;this.clientHeight=84;this.offsetTop=0;this.offsetHeight=42;this.classList={toggle(){}};}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
  emit(type,extra={}){const e={target:this,button:0,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};for(const fn of this.events[type]||[])fn(e);return e;}
  dispatchEvent(e){this.emit(e.type);}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  append(child){child.offsetTop=this.children.length*42;this.children.push(child);}
  replaceChildren(){this.children=[];}
  before(){}
  querySelector(s){return nodes[s];}
  getBoundingClientRect(){return {width:220,left:200,top:40,bottom:84};}
  focus(){focused=this;}
  contains(target){return target===this||this.children.some(c=>c.contains(target));}
  matches(){return !!this.visible;}
  showPopover(){this.visible=true;}
  hidePopover(){this.visible=false;}
  scrollIntoView(){throw Error('Must not scroll the page when highlighting an option');}
 }
 const select=new Node('select');select.options=[{value:'',textContent:'Todas las áreas'},{value:'1',textContent:'Clínica'},{value:'2',textContent:'Marketing'}];
 Object.defineProperty(select,'selectedOptions',{get:()=>select.options.filter(o=>o.value===select.value)});
 const trigger=nodes.button=new Node('button');nodes.span=new Node();
 const popup=nodes['.area-picker-popup']=new Node();
 const input=nodes.input=new Node('input'),list=nodes['[role="listbox"]']=new Node();nodes['.area-picker-empty']=new Node();
 popup.children=[input,list];
 const doc=new Node();doc.getElementById=()=>select;doc.createElement=tag=>new Node(tag);doc.createElementNS=(_,tag)=>new Node(tag);
 const win=new Node();win.innerWidth=1000;win.innerHeight=800;
 select.addEventListener('change',()=>changes++);
 const context=vm.createContext({document:doc,window:win,Event:class{constructor(type){this.type=type;}},MutationObserver:class{observe(){}}});
 vm.runInContext(fs.readFileSync('assets/js/dashboard-area-picker.js','utf8'),context);
 return {select,trigger,popup,input,list,get focused(){return focused;},get changes(){return changes;}};
}

test('mouse selection keeps input focus until click, applies area once and closes popup',()=>{
 const h=harness();h.trigger.emit('click');
 assert.equal(h.focused,h.input);
 assert.equal(h.list.children[1].tagName,'button');
 assert.equal(h.list.emit('mousedown').defaultPrevented,true);
 h.list.children[1].emit('click');
 assert.equal(h.select.value,'1');assert.equal(h.changes,1);
 assert.equal(h.popup.hidden,true);assert.equal(h.focused,h.trigger);
});

test('search ignores accents; Enter selects; resetting to all areas works',()=>{
 const h=harness();h.trigger.emit('click');h.input.value='clinica';h.input.emit('input');
 assert.equal(h.list.children.length,1);
 h.input.emit('keydown',{key:'Enter'});assert.equal(h.select.value,'1');
 h.trigger.emit('click');h.list.children[0].emit('click');
 assert.equal(h.select.value,'');assert.equal(h.changes,2);
});

test('keyboard navigation scrolls the list without invoking page scroll',()=>{
 const h=harness();h.trigger.emit('click');
 h.input.emit('keydown',{key:'ArrowDown'});h.input.emit('keydown',{key:'ArrowDown'});
 assert.equal(h.list.scrollTop,42);
 h.input.emit('keydown',{key:'Enter'});assert.equal(h.select.value,'2');
});
