import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from 'parse5';

const document=parse(fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8'));
const nodes=[];
function walk(node){nodes.push(node);for(const child of node.childNodes||[])walk(child)}
walk(document);
const attr=(node,key)=>node?.attrs?.find(a=>a.name===key)?.value;
const find=id=>nodes.find(n=>attr(n,'id')===id);
const inside=(node,id)=>{for(let p=node;p;p=p.parentNode)if(attr(p,'id')===id)return true;return false};

test('editor panels stay siblings; history never disappears with a step',()=>{
  for(const panel of ['prepare-panel','data-panel','review','publish-panel'])assert.equal(attr(find('marketing-'+panel).parentNode,'id'),'marketing-editor');
  assert.equal(inside(find('marketing-history'),'marketing-editor'),false);
  assert.equal(inside(find('marketing-history'),'view-marketing'),true);
  assert.equal(attr(find('view-inicio').parentNode,'id'),'workspace');
});

test('WhatsApp is visible in review, fields retain labels and ids are unique',()=>{
  for(const key of ['whatsapp-message','whatsapp-phone','facebook_url','short-url']){
    const field=find('marketing-'+key);assert.ok(field);assert.equal(inside(field,'marketing-review'),true);
    assert.ok(nodes.some(n=>n.tagName==='label'&&attr(n,'for')==='marketing-'+key));
    for(let p=field;p&&attr(p,'id')!=='marketing-review';p=p.parentNode)assert.notEqual(p.tagName,'details');
  }
  const ids=nodes.map(n=>attr(n,'id')).filter(id=>id?.startsWith('marketing-'));
  assert.equal(new Set(ids).size,ids.length);
});

test('every literal marketing element binding has a real HTML target',()=>{
  const source=fs.readFileSync(new URL('../assets/js/dashboard-marketing.js',import.meta.url),'utf8');
  for(const [,id] of source.matchAll(/\bel\('([a-z-]+)'\)/g))assert.ok(find('marketing-'+id),id);
});
