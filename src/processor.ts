import {AppError} from './core';
import {decode,previewBlob} from './decode';
export interface Result{blob:Blob;width:number;height:number;backend:string;modelMs:number;processMs:number}
export interface Update{stage:'validating'|'loading'|'processing';done?:number;total?:number;preview?:Blob;width?:number;height?:number;format?:string}
let worker:Worker|undefined;let sequence=0;let active=false;
export async function removeBackground(file:File,signal:AbortSignal,onUpdate:(update:Update)=>void):Promise<Result>{
 if(active)throw new AppError('busy','이미지 한 장씩 처리할 수 있습니다.');active=true;const id=++sequence;let bitmap:ImageBitmap|undefined;
 try{
 signal.throwIfAborted();onUpdate({stage:'validating'});const decoded=await decode(file,signal);bitmap=decoded.bitmap;
 const preview=await previewBlob(bitmap);signal.throwIfAborted();onUpdate({stage:'loading',preview,width:bitmap.width,height:bitmap.height,format:decoded.format});
 worker??=new Worker(new URL('./inference.worker.ts',import.meta.url),{type:'module'});
 const current=worker;
 return await new Promise<Result>((resolve,reject)=>{
 const clean=()=>{current.removeEventListener('message',message);current.removeEventListener('error',error);signal.removeEventListener('abort',abort);};
 const abort=()=>{clean();current.terminate();if(worker===current)worker=undefined;reject(new DOMException('Aborted','AbortError'));};
 const error=()=>{clean();current.terminate();worker=undefined;reject(new AppError('memory','처리 도구를 실행할 수 없습니다. 다른 탭을 닫거나 작은 이미지로 다시 시도해 주세요.'));};
 const message=(event:MessageEvent)=>{const d=event.data;if(d.id!==id)return;
 if(d.type==='progress')onUpdate({stage:'loading',done:d.done,total:d.total});
 if(d.type==='stage')onUpdate({stage:'processing'});
 if(d.type==='complete'){clean();resolve(d);}
 if(d.type==='error'){clean();current.terminate();worker=undefined;const messages:Record<string,string>={download:'처리 도구를 내려받지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.',memory:'메모리가 부족합니다. 다른 탭을 닫거나 작은 이미지로 다시 시도해 주세요.',inference:'배경을 제거하지 못했습니다. 최신 Chrome 또는 Edge에서 다시 시도해 주세요.'};reject(new AppError(d.code,messages[d.code]));}
 };
 current.addEventListener('message',message);current.addEventListener('error',error);signal.addEventListener('abort',abort,{once:true});
 if(signal.aborted){abort();return;}current.postMessage({id,bitmap,forceWasm:new URLSearchParams(location.search).get('engine')==='wasm'},[bitmap!]);bitmap=undefined;
 });
 }finally{bitmap?.close();active=false;}
}
