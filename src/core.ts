export class AppError extends Error { code: string; constructor(code:string,message:string){super(message);this.code=code;} }
export type Format='jpeg'|'png'|'webp'|'avif'|'bmp'|'gif';
export function validateLimits(size:number,width:number,height:number){
 if(!Number.isFinite(size)||size<=0)throw new AppError('corrupt','빈 파일이거나 손상된 이미지입니다. 다른 파일을 선택해 주세요.');
 if(size>20*1024*1024)throw new AppError('file-size','파일이 20MB를 넘습니다. 크기를 줄여 다시 선택해 주세요.');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new AppError('corrupt','이미지 크기를 읽을 수 없습니다. 다른 파일을 선택해 주세요.');
 if(width>8192||height>8192||width*height>25_000_000)throw new AppError('dimensions','최대 2,500만 픽셀, 한 변 8,192픽셀까지 지원합니다. 이미지를 줄여 주세요.');
}
export function inspectHeader(b:Uint8Array):{format:Format;width?:number;height?:number}{
 const t=(o:number,n:number)=>String.fromCharCode(...b.subarray(o,o+n));
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length>=8&&b[0]===137&&t(1,7)==='PNG\r\n\x1a\n'&&b.length<24)throw new AppError('corrupt','PNG 파일이 손상되었습니다. 다른 파일을 선택해 주세요.');
 if(b.length>=24&&b[0]===137&&t(1,7)==='PNG\r\n\x1a\n'&&t(12,4)==='IHDR')return{format:'png',width:v.getUint32(16),height:v.getUint32(20)};
 if(b.length>=10&&['GIF87a','GIF89a'].includes(t(0,6)))return{format:'gif',width:v.getUint16(6,true),height:v.getUint16(8,true)};
 if(b.length>=26&&t(0,2)==='BM'){
 const dib=v.getUint32(14,true);return dib===12?{format:'bmp',width:v.getUint16(18,true),height:v.getUint16(20,true)}:{format:'bmp',width:v.getInt32(18,true),height:Math.abs(v.getInt32(22,true))};
 }
 if(b.length>=12&&t(0,4)==='RIFF'&&t(8,4)==='WEBP'){
 const u24=(i:number)=>b[i]|b[i+1]<<8|b[i+2]<<16;
 if(b.length>=30&&t(12,4)==='VP8X')return{format:'webp',width:1+u24(24),height:1+u24(27)};
 if(b.length>=30&&t(12,4)==='VP8 '&&b[23]===0x9d&&b[24]===1&&b[25]===0x2a)return{format:'webp',width:v.getUint16(26,true)&0x3fff,height:v.getUint16(28,true)&0x3fff};
 if(b.length>=25&&t(12,4)==='VP8L'&&b[20]===0x2f){const z=v.getUint32(21,true);return{format:'webp',width:(z&0x3fff)+1,height:((z>>>14)&0x3fff)+1};}
 return{format:'webp'};
 }
 if(b.length>=12&&t(4,4)==='ftyp'){
 const size=Math.min(v.getUint32(0),b.length);let avif=false;
 for(let i=8;i+4<=size;i+=4){if(i===12)continue;if(['avif','avis'].includes(t(i,4)))avif=true;}
 if(avif){
  // Find image spatial extents in the ISO-BMFF property container before decoding.
  let width=0,height=0;
  const boxes=(start:number,end:number,depth:number)=>{
   if(depth>8)return;
   for(let pos=start;pos+8<=end;){
    let length=v.getUint32(pos),head=8;const type=t(pos+4,4);
    if(length===1){if(pos+16>end)return;const n=v.getBigUint64(pos+8);if(n>BigInt(b.length))return;length=Number(n);head=16;}
    if(length===0)length=end-pos;if(length<head||pos+length>end)return;
    if(type==='ispe'&&length>=head+12){width=Math.max(width,v.getUint32(pos+head+4));height=Math.max(height,v.getUint32(pos+head+8));}
    if(['meta','iprp','ipco'].includes(type))boxes(pos+head+(type==='meta'?4:0),pos+length,depth+1);
    pos+=length;
   }
  };boxes(0,b.length,0);
  return width&&height?{format:'avif',width,height}:{format:'avif'};
 }
 }
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255){
 let i=2;while(i+3<b.length){if(b[i]!==255)break;while(b[i]===255)i++;const marker=b[i++];if(marker===0xd9||marker===0xda)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;if(i+2>b.length)break;const len=v.getUint16(i);if(len<2)break;
 if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&i+7<=b.length)return{format:'jpeg',width:v.getUint16(i+5),height:v.getUint16(i+3)};i+=len;
 }return{format:'jpeg'};
 }
 throw new AppError('unsupported','지원하지 않는 형식입니다. JPG, PNG, WebP, AVIF, BMP, GIF를 선택해 주세요.');
}
export const outputFilename=(name:string)=>(name.replace(/\.[^.]+$/,'')||'image')+'-no-bg.png';
export function combineAlpha(original:Uint8ClampedArray,mask:Uint8ClampedArray){
 if(original.length!==mask.length||original.length%4)throw Error('Mask dimensions mismatch');
 const out=original.slice();for(let i=3;i<out.length;i+=4)out[i]=Math.round(out[i]*mask[i-3]/255);return out;
}
export function normalizeMask(values:Float32Array){
 let min=Infinity,max=-Infinity;for(const x of values){if(!Number.isFinite(x))throw Error('Invalid inference output');min=Math.min(min,x);max=Math.max(max,x);}
 const out=new Uint8ClampedArray(values.length),range=max-min;
 for(let i=0;i<values.length;i++)out[i]=range>1e-7?Math.round((values[i]-min)/range*255):Math.round(Math.max(0,Math.min(1,values[i]))*255);
 return out;
}
