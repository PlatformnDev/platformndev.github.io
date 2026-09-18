import {AppError,inspectHeader,validateLimits} from './core';
export async function decode(file:File,signal:AbortSignal){
 validateLimits(file.size,1,1);signal.throwIfAborted();
 const bytes=new Uint8Array(await file.arrayBuffer());const info=inspectHeader(bytes);
 if(info.width&&info.height)validateLimits(file.size,info.width,info.height);
 const mime={jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',avif:'image/avif'}[info.format];
 let bitmap:ImageBitmap;
 try{
 // createImageBitmap(Blob) uses the default image / first animation frame, not a running <img>.
 bitmap=await createImageBitmap(new Blob([bytes],{type:mime}),{imageOrientation:'from-image'});
 }catch{throw new AppError('corrupt','이미지를 열 수 없습니다. 파일이 손상되었거나 이 브라우저가 지원하지 않는 인코딩입니다. 최신 Chrome 또는 Edge에서 확인해 주세요.');}
 try{signal.throwIfAborted();validateLimits(file.size,bitmap.width,bitmap.height);return{bitmap,format:info.format};}catch(e){bitmap.close();throw e;}
}
export async function previewBlob(bitmap:ImageBitmap){
 const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new AppError('memory','이미지를 준비할 메모리가 부족합니다. 다른 탭을 닫거나 작은 이미지로 다시 시도해 주세요.');
 ctx.drawImage(bitmap,0,0);
 try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new AppError('memory','미리보기를 만들 수 없습니다. 더 작은 이미지로 다시 시도해 주세요.')),'image/png'));}finally{canvas.width=canvas.height=0;}
}
