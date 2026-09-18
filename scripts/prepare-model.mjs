import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const revision='440dea96dd4a3b06bbbf5abec3e26569dd7ec49f';
const root=new URL('../',import.meta.url);
const path=(p)=>new URL(p,root);
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(path('.cache'),{recursive:true});
await mkdir(path('public/models/'+revision),{recursive:true});
await mkdir(path('public/ort'),{recursive:true});
const url=`https://huggingface.co/imgly/isnet-general-onnx/resolve/${revision}/onnx/model.onnx`;
let bytes;
try{bytes=await readFile(path('.cache/model.onnx'));}catch{
execFileSync('curl',['-fL','--retry','3',url,'-o',path('.cache/model.onnx').pathname],{stdio:'inherit'});
bytes=await readFile(path('.cache/model.onnx'));
}
if(bytes.length<100_000_000) throw Error('Model download is incomplete');
let pinned;try{pinned=JSON.parse(await readFile(path('model-lock.json'),'utf8'));}catch{}
if(pinned&&pinned.sha256!==sha(bytes))throw Error('Pinned model checksum mismatch');
const chunks=[];
for(let i=0;i<bytes.length;i+=8*1024*1024){const chunk=bytes.subarray(i,i+8*1024*1024);const file=`chunk-${String(chunks.length).padStart(3,'0')}.bin`;await writeFile(path(`public/models/${revision}/${file}`),chunk);chunks.push({file,bytes:chunk.length,sha256:sha(chunk)});}
const manifest={model:'imgly/isnet-general-onnx',revision,url,license:'MIT',sha256:sha(bytes),bytes:bytes.length,inputSize:1024,mean:128,std:256,chunks};
await writeFile(path('public/models/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path('model-lock.json'),JSON.stringify(manifest,null,2)+'\n');
for(const f of ['ort.webgpu.min.mjs','ort-wasm-simd-threaded.jsep.wasm','ort-wasm-simd-threaded.jsep.mjs'])await copyFile(path('node_modules/onnxruntime-web/dist/'+f),path('public/ort/'+f));
console.log(JSON.stringify({bytes:bytes.length,sha256:manifest.sha256,chunks:chunks.length}));
