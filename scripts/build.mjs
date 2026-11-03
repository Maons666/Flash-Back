import { mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, 'dist/vendor'), { recursive:true });
await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive:true });
await cp(resolve(root, 'src'), resolve(root, 'dist/src'), { recursive:true });
for (const name of ['three.module.js','three.core.js']) await cp(resolve(root, 'node_modules/three/build', name), resolve(root, 'dist/vendor', name));
await cp(resolve(root,'node_modules/three/LICENSE'),resolve(root,'dist/vendor/THREE-LICENSE.txt'));
console.log('Built dist/ with local dependencies. No CDN or network required.');
