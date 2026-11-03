import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require=createRequire(import.meta.url), env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),[resolve(import.meta.dirname,'../desktop/main.cjs')],{stdio:'inherit',env,windowsHide:true});
child.on('exit',code=>process.exit(code||0));
child.on('error',error=>{console.error(error.message);process.exit(1);});
