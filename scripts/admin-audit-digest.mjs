// A closeout report must refer to the same HTML, internal scripts and CSS.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {scanPortal} from './check-admin-colors.mjs';

export function designDigest(){
  const html=fs.readFileSync('dashboard.html','utf8'),doc=new JSDOM(html).window.document;
  const paths=new Set(['dashboard.html','assets/admin-tokens.json',...scanPortal().keys(),'assets/css/paginas/kja-admin-tokens.css']);
  for(const s of doc.querySelectorAll('script[src]')){const src=new URL(s.getAttribute('src'),'https://kja.local/dashboard.html');if(src.origin==='https://kja.local')paths.add(src.pathname.slice(1));}
  const hash=createHash('sha256');for(const file of [...paths].sort()){hash.update(file+'\0');hash.update(fs.readFileSync(file));hash.update('\0');}return hash.digest('hex');
}
