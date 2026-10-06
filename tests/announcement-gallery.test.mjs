import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
function setup(){
  const gallery={children:[],replaceChildren(...children){this.children=children;},querySelector(){return this.children[0];}};
  const fallback={focus(){this.focused=true;}},modal={hidden:false};
  const context={document:{createElement:()=>({attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},append(...nodes){this.children.push(...nodes);},getClientRects(){return this.visible===false?[]:[{}];},focus(){this.focused=true;}}),body:{classList:{remove(){}}}},
    $:id=>({'rail-announcement-gallery':gallery,'rail-announcement-open':fallback,'announcement-viewer':modal}[id]),
    showAnnouncement:index=>{context.selected=index;},openAnnouncementViewer:trigger=>{context.announcementTrigger=trigger;},syncAnnouncementRotation(){}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const ANNOUNCEMENTS='),source.indexOf('const ANNOUNCEMENT_ROTATION_MS=')),context);
  vm.runInContext(source.slice(source.indexOf('function renderAnnouncementGallery('),source.indexOf('function openAnnouncementViewer(')),context);
  vm.runInContext(source.slice(source.indexOf('function closeAnnouncementViewer('),source.indexOf("\ndocument.querySelectorAll('[data-close-announcement]'")),context);
  context.renderAnnouncementGallery();
  return {context,gallery,fallback,modal};
}
test('both announcements are available together and each opens its own image',()=>{
  const h=setup();assert.equal(h.gallery.children.length,2);
  assert.notEqual(h.gallery.children[0].children[0].src,h.gallery.children[1].children[0].src);
  h.gallery.children.forEach((button,index)=>{button.onclick();assert.equal(h.context.selected,index);assert.equal(h.context.announcementTrigger,button);assert.equal(button.attrs['aria-haspopup'],'dialog');});
});
test('closing the viewer restores focus to the clicked announcement',()=>{
  const h=setup();h.gallery.children[1].onclick();assert.equal(h.context.closeAnnouncementViewer(),true);
  assert.equal(h.gallery.children[1].focused,true);assert.equal(h.modal.hidden,true);
});
test('closing after the gallery becomes hidden restores focus to the carousel',()=>{
  const h=setup();h.gallery.children[1].onclick();h.gallery.children.forEach(button=>button.visible=false);
  h.context.closeAnnouncementViewer();assert.equal(h.fallback.focused,true);
});
test('a failed thumbnail keeps a named, usable announcement button',()=>{
  const h=setup(),button=h.gallery.children[0];button.children[0].onerror();
  assert.equal(button.children[0].hidden,true);assert.match(button.children[1].textContent,/Pulsa para abrir/);
  button.onclick();assert.equal(h.context.selected,0);
});
