import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const path=(name)=>new URL(name,root);
const revision='71eff2372ec9c8edbc6ca637ded591423d23b65a';
const url=`https://huggingface.co/xrds/isnet-general-onnx-int8/resolve/${revision}/onnx/model_quantized.onnx`;
const expectedBytes=44_229_662;
const expectedSha256='3b21a6706dc8d6e4ba9f5b31ebc6940f6c785b58862e27bb25daa9dd4424b87f';
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const cached=path('.cache/light-model/model_quantized.onnx');

await mkdir(path('.cache/light-model'),{recursive:true});
await mkdir(path(`public-light/models/${revision}`),{recursive:true});
let bytes;
try{bytes=await readFile(cached);}catch{
  execFileSync('curl',['-fL','--retry','3',url,'-o',cached.pathname],{stdio:'inherit'});
  bytes=await readFile(cached);
}
if(bytes.length!==expectedBytes||sha(bytes)!==expectedSha256){
  throw Error('Light model does not match the pinned size and SHA-256');
}

const chunks=[];
for(let offset=0;offset<bytes.length;offset+=8*1024*1024){
  const chunk=bytes.subarray(offset,offset+8*1024*1024);
  const file=`chunk-${String(chunks.length).padStart(3,'0')}.bin`;
  await writeFile(path(`public-light/models/${revision}/${file}`),chunk);
  chunks.push({file,bytes:chunk.length,sha256:sha(chunk)});
}
const manifest={
  model:'xrds/isnet-general-onnx-int8',revision,url,license:'MIT',
  sha256:expectedSha256,bytes:expectedBytes,inputSize:1024,mean:128,std:256,chunks,
};
await writeFile(path('public-light/models/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path('model-light-lock.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({bytes:bytes.length,sha256:expectedSha256,chunks:chunks.length}));
