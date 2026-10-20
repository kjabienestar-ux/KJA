import fs from 'node:fs';

const html = fs.readFileSync('reclutamiento.html', 'utf8');
const regex = /(?:src|href)="([^"]+)"/g;
let match;
const missing = [];
while ((match = regex.exec(html)) !== null) {
  const p = match[1];
  if (!p.startsWith('http') && !p.startsWith('#') && !p.startsWith('mailto:') && !p.startsWith('tel:')) {
    const clean = p.split('?')[0];
    if (!fs.existsSync(clean)) {
      missing.push(p);
    }
  }
}

console.log('Total checked. Missing assets:', missing);
if (missing.length > 0) {
  process.exit(1);
} else {
  console.log('All local assets in reclutamiento.html exist and are valid!');
}
