/// <reference lib="webworker" />
import type * as ORT from 'onnxruntime-web';
const runtimeDirectory=new URL(import.meta.env.BASE_URL+'ort/',self.location.origin).href;
const runtimePath=runtimeDirectory+'ort.webgpu.min.mjs';
let ort:typeof ORT;
import {loadModel} from './model';
import {normalizeMask} from './core';
const scope=self as unknown as DedicatedWorkerGlobalScope;

let session:ORT.InferenceSession|undefined;let backend='wasm';let modelBytes:Uint8Array|undefined;
const send=(id:number,event:Record<string,unknown>)=>scope.postMessage({id,...event});
async function init(id:number,forceWasm:boolean){
 if(session)return;
 ort??=await import(/* @vite-ignore */ runtimePath);
 ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=runtimeDirectory;
 modelBytes=await loadModel((done,total)=>send(id,{type:'progress',done,total}));
 if(!forceWasm&&'gpu' in navigator){try{session=await ort.InferenceSession.create(modelBytes,{executionProviders:['webgpu'],graphOptimizationLevel:'all'});backend='webgpu';}catch{session=undefined;}}
 if(!session){session=await ort.InferenceSession.create(modelBytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});backend='wasm';modelBytes=undefined;}
}
scope.onmessage=async({data})=>{
 const {id,bitmap,forceWasm}=data as {id:number;bitmap:ImageBitmap;forceWasm:boolean};let tensor:ORT.Tensor|undefined;let outputs:ORT.InferenceSession.ReturnType|undefined;
 const canvases:OffscreenCanvas[]=[];const started=performance.now();
 try{
 await init(id,forceWasm);send(id,{type:'stage',stage:'processing',backend});const modelReady=performance.now();
 const inputCanvas=new OffscreenCanvas(1024,1024);canvases.push(inputCanvas);const inputCtx=inputCanvas.getContext('2d',{willReadFrequently:true})!;inputCtx.drawImage(bitmap,0,0,1024,1024);
 const pixels=inputCtx.getImageData(0,0,1024,1024).data;const n=1024*1024;const values=new Float32Array(3*n);
 for(let i=0;i<n;i++){values[i]=(pixels[i*4]-128)/256;values[n+i]=(pixels[i*4+1]-128)/256;values[2*n+i]=(pixels[i*4+2]-128)/256;}
 tensor=new ort.Tensor('float32',values,[1,3,1024,1024]);
 try{outputs=await session!.run({[session!.inputNames[0]]:tensor});}catch(e){
 if(backend!=='webgpu')throw e;await session!.release();session=undefined;
 modelBytes??=await loadModel((done,total)=>send(id,{type:'progress',done,total}));
 session=await ort.InferenceSession.create(modelBytes,{executionProviders:['wasm']});backend='wasm';modelBytes=undefined;send(id,{type:'stage',stage:'processing',backend});outputs=await session.run({[session.inputNames[0]]:tensor});
 }
 modelBytes=undefined;
 const prediction=outputs[session!.outputNames[0]];const raw=prediction.data as Float32Array;
 if(raw.length!==n)throw Error('Unexpected model output dimensions');const mask=normalizeMask(raw);
 const maskCanvas=new OffscreenCanvas(1024,1024);canvases.push(maskCanvas);const maskCtx=maskCanvas.getContext('2d')!;const rgba=new Uint8ClampedArray(n*4);
 for(let i=0;i<n;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=255;rgba[i*4+3]=mask[i];}maskCtx.putImageData(new ImageData(rgba,1024,1024),0,0);
 const width=bitmap.width,height=bitmap.height;const output=new OffscreenCanvas(width,height);canvases.push(output);const ctx=output.getContext('2d')!;
 ctx.drawImage(bitmap,0,0);ctx.globalCompositeOperation='destination-in';ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(maskCanvas,0,0,width,height);
 const blob=await output.convertToBlob({type:'image/png'});
 send(id,{type:'complete',blob,width,height,backend,modelMs:modelReady-started,processMs:performance.now()-modelReady});
 }catch(e){console.error('Background engine:',e);const message=e instanceof Error?e.message:String(e);send(id,{type:'error',code:message.includes('MODEL_DOWNLOAD')?'download':/memory|alloc|out of bounds|rangeerror/i.test(message)?'memory':'inference'});}
 finally{bitmap.close();tensor?.dispose();if(outputs)for(const t of Object.values(outputs))t.dispose();for(const c of canvases)c.width=c.height=1;}
};
