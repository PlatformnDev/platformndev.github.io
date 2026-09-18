import {execFileSync} from 'node:child_process';
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=new URL('../dist/',import.meta.url);
const run=(file,args,environment={})=>execFileSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url)),...args],{cwd:root,stdio:'inherit',env:{...process.env,...environment}});
const copySharedAppAssets=async destination=>{
 await cp(new URL('../public/brand/',import.meta.url),new URL('brand/',destination),{recursive:true});
 await cp(new URL('../public/examples/',import.meta.url),new URL('examples/',destination),{recursive:true});
 await cp(new URL('../public/ort/',import.meta.url),new URL('ort/',destination),{recursive:true});
 await cp(new URL('../public/licenses.txt',import.meta.url),new URL('licenses.txt',destination));
 await cp(new URL('../public/favicon.svg',import.meta.url),new URL('favicon.svg',destination));
 await cp(new URL('../public/_headers',import.meta.url),new URL('_headers',destination));
};

// dist is generated output. Rebuild the complete organization site each time.
run('../node_modules/typescript/bin/tsc',['--noEmit']);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../site/',import.meta.url),output,{recursive:true});
await cp(new URL('../public/brand/',import.meta.url),new URL('brand/',output),{recursive:true});
await writeFile(new URL('.nojekyll',output),'');
run('../node_modules/vite/bin/vite.js',['build','--base=/remove-bg/','--outDir=dist/remove-bg'],{SITE_VARIANT:'standard',SITE_BASE_PATH:'/remove-bg/',VITE_SITE_VARIANT:'standard'});
run('../node_modules/vite/bin/vite.js',['build','--base=/remove-bg-light/','--outDir=dist/remove-bg-light'],{SITE_VARIANT:'light',SITE_BASE_PATH:'/remove-bg-light/',VITE_SITE_VARIANT:'light'});
await copySharedAppAssets(new URL('remove-bg-light/',output));
console.log('Organization site: dist/index.html + dist/remove-bg/index.html + dist/remove-bg-light/index.html');
