import { cp, mkdir, rm, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'public','face-verification');
// Never introduce models or camera assets into an ordinary TS Hub build.
if(process.env.VITE_TSJ_FACE_INTEGRATION!=='true'&&!process.argv.includes('--prepare')){
  await rm(output,{recursive:true,force:true});
  console.log('Face integration preview disabled.');
  process.exit(0);
}
execSync('npm install --prefix face-pilot --ignore-scripts',{cwd:root,stdio:'inherit'});
execSync('npm run build --prefix face-pilot',{cwd:root,stdio:'inherit'});
const source=join(root,'face-pilot','dist');
await access(join(source,'index.html'));
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ['index.html','pilot.css','pilot.js','checks.js','vendor','models','MODEL-NOTICE.txt']){
  await cp(join(source,name),join(output,name),{recursive:true});
}
// Do not copy standalone _headers: that page intentionally forbids framing.
// The preview embeds only same-origin assets, never a third-party scanner.
console.log('Staged controlled face preview at public/face-verification.');
