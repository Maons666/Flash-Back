import { mkdir, cp, rename, writeFile, stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const packageInfo=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const versionLabel=packageInfo.version.replace(/\.0$/,''),target=resolve(root,`release/FlashDodger-v${versionLabel}`);
await mkdir(target,{recursive:true});
await cp(resolve(root,'node_modules/electron/dist'),target,{recursive:true,filter:source=>!source.endsWith('default_app.asar')});
await rename(resolve(target,'electron.exe'),resolve(target,'FlashDodger.exe'));
try{await rename(resolve(target,'electron_wer.dll'),resolve(target,'FlashDodger_wer.dll'));}catch(error){if(error.code!=='ENOENT')throw error;}
const app=resolve(target,'resources/app');
await mkdir(app,{recursive:true});
await cp(resolve(root,'dist'),resolve(app,'dist'),{recursive:true});
await cp(resolve(root,'desktop'),resolve(app,'desktop'),{recursive:true});
await writeFile(resolve(app,'package.json'),JSON.stringify({name:'flash-dodger',productName:'背闪训练器',version:packageInfo.version,main:'desktop/main.cjs'}));
await cp(resolve(root,'docs'),resolve(target,'docs'),{recursive:true});
await cp(resolve(root,'README.md'),resolve(target,'使用说明.md'));
console.log(`Windows app ready: ${target}/FlashDodger.exe`);
console.log(`Executable: ${Math.round((await stat(resolve(target,'FlashDodger.exe'))).size/1048576)} MB. Keep all companion files in this folder.`);
