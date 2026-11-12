import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = join(root, 'node_modules', '@vladmandic', 'human');
const out = join(root, 'dist');
const manifest = ['blazeface.json','facemesh.json','faceres.json','antispoof.json','liveness.json'];
await rm(out, {recursive:true,force:true});
await mkdir(join(out,'models'),{recursive:true});
await mkdir(join(out,'vendor'),{recursive:true});
for (const name of ['index.html','pilot.css','pilot.js','checks.js','_headers']) {
  await cp(join(root,name),join(out,name));
}
await cp(join(pkg,'dist','human.js'),join(out,'vendor','human.js'));
// Copy only the required model manifests and all referenced weight shards.
// No camera data, Firebase configuration, or TS Hub credentials enter dist.
for (const name of manifest) {
  const original = join(pkg,'models',name);
  const json = JSON.parse(await readFile(original,'utf8'));
  await cp(original,join(out,'models',name));
  if (!Array.isArray(json.weightsManifest)) throw Error('Invalid weights manifest: '+name);
  for (const group of json.weightsManifest) {
    for (const path of group.paths) {
      if (!/^[a-zA-Z0-9_.-]+$/.test(path) || path==='.' || path==='..') throw Error('Unsafe model shard path');
      await cp(join(pkg,'models',path),join(out,'models',path));
    }
  }
}
await writeFile(join(out,'MODEL-NOTICE.txt'),
  'TS Hub experimental face pilot. Human 3.3.6 (MIT library). Model weights retain their upstream model-specific licenses; review before commercial use. See https://github.com/vladmandic/human/wiki/Models\n');
console.log('Standalone face pilot built at: '+out);
console.log('Deploy ONLY this dist directory to a separate HTTPS test site, never the TS Hub production site.');
