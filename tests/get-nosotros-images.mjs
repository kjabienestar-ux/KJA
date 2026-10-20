import fs from 'node:fs';

const html = fs.readFileSync('nosotros.html', 'utf8');
const regex = /src="([^"]+\.(?:webp|jpg|jpeg|png))"/g;
let m;
const imgs = new Set();
while ((m = regex.exec(html)) !== null) {
  imgs.add(m[1]);
}
console.log('Images in nosotros.html:');
for (const img of imgs) {
  console.log(img);
}
