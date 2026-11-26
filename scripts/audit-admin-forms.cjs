// Run from the repository root. Inventory declarations, including dialogs opened on demand.
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const html = fs.readFileSync('dashboard.html','utf8');
const document = new JSDOM(html).window.document;
const surfaces = [...document.querySelectorAll('dialog, [role="dialog"], .modal, form')].filter(node =>
  node.closest('#view-gestion') || /^(admin-|pw-|seg-|assignment-|aa-)/.test(node.id) ||
  node.closest('[id^="admin-"],[id^="pw-"],[id^="seg-"],[id^="aa-"]'));
const rows = surfaces.map(node => {
  const owner = node.closest('[id]')?.id || '';
  const title = document.getElementById(node.getAttribute('aria-labelledby'))?.textContent || node.querySelector('h2,h3')?.textContent || '';
  return [owner,node.tagName.toLowerCase(),title.trim(),node.querySelectorAll('input,select,textarea').length].join(' | ');
});
const dynamic=[];
for(const file of fs.readdirSync('assets/js').filter(name=>/^dashboard-(admin|people|contract|assignment|access|person|ranking|facebook|overview)/.test(name))){
  fs.readFileSync('assets/js/'+file,'utf8').split(/\r?\n/).forEach((line,i)=>{
    if(/<dialog\b|role=["']dialog["']|<form\b|\.showModal\(/.test(line)) dynamic.push(file+':'+(i+1));
  });
}
const report=['# Formularios y diálogos de administración','','Inventario estático reproducible. Se cuentan nodos declarados y referencias de construcción o apertura en JS. Un contenedor y su formulario pueden aparecer por separado. Los nombres se leen del marcado inicial.','','Identificador más cercano | Elemento | Título inicial | Campos descendientes','--- | --- | --- | ---:',...rows,'','## Referencias dinámicas','',...dynamic.map(ref=>'- '+ref),''].join('\n');
fs.writeFileSync('docs/auditorias/KJA-051/formularios.md',report);
console.log(surfaces.length,dynamic.length);
