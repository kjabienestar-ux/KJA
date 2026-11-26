// Compare the user-approved capture, not a newly regenerated golden image.
// The source audit separately verifies contrast, states and code digest.
import fs from 'node:fs';
import {chromium} from 'playwright';
import {designDigest} from './admin-audit-digest.mjs';
const current=JSON.parse(fs.readFileSync('.tmp/kja-051/baseline.json','utf8'));
if(current.digest!==designDigest())throw Error('La captura actual no corresponde al código actual.');
const dirs=['docs/auditorias/KJA-051/reconocimiento-actual/','.tmp/kja-051/'];
const names=['contratos','colaboradores','lista','seguimiento','overview','asignaciones','roles','mes','facebook','ranking','marcado'];
const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();const rows=[];
try{
  for(const name of names){
    const urls=dirs.map(dir=>'data:image/png;base64,'+fs.readFileSync(dir+name+'.png').toString('base64'));
    const stat=await p.evaluate(async urls=>{
      const imgs=await Promise.all(urls.map(s=>new Promise((ok,err)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=err;i.src=s;})));
      if(imgs[0].width!==imgs[1].width||imgs[0].height!==imgs[1].height)throw Error('Las capturas no tienen el mismo tamaño.');
      const c=document.createElement('canvas');c.width=imgs[0].width;c.height=imgs[0].height;const ctx=c.getContext('2d',{willReadFrequently:true});
      const ar=imgs.map(i=>{ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(i,0,0);return ctx.getImageData(0,0,c.width,c.height).data;});
      let changed=0,high=0,max=0;for(let k=0;k<ar[0].length;k+=4){const d=Math.max(...[0,1,2].map(j=>Math.abs(ar[0][k+j]-ar[1][k+j])));if(d>8)changed++;if(d>32)high++;max=Math.max(max,d);}
      return {differentPercent:Math.round(changed/(c.width*c.height)*10000)/100,highPercent:Math.round(high/(c.width*c.height)*10000)/100,max};
    },urls);rows.push({view:name,...stat});
  }
  const report={digest:current.digest,reference:'reconocimiento-actual (approved by Piero, 25/11/2026)',thresholds:{channelDelta:8,reviewPercent:0.5},views:rows,requiresReview:rows.filter(x=>x.differentPercent>0.5).map(x=>x.view),limits:'Pixel comparison is an alert for manual review, not proof of behavior. Dynamic timestamps and data may differ.'};
  fs.writeFileSync('.tmp/kja-051/recognition-diff.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--check')&&report.requiresReview.length)process.exitCode=1;
}finally{await b.close();}
