import {execFileSync} from 'node:child_process';
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=new URL('../dist/',import.meta.url);
const run=(file,args)=>execFileSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url)),...args],{cwd:root,stdio:'inherit'});

// dist is generated output. Rebuild the complete organization site each time.
run('../node_modules/typescript/bin/tsc',['--noEmit']);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../site/',import.meta.url),output,{recursive:true});
await writeFile(new URL('.nojekyll',output),'');
run('../node_modules/vite/bin/vite.js',['build','--base=/remove-bg/','--outDir=dist/remove-bg']);
console.log('Organization site: dist/index.html + dist/remove-bg/index.html');
