import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHeader,validateLimits,outputFilename,combineAlpha,normalizeMask} from '../src/core.ts';
const ascii=s=>Uint8Array.from(s,c=>c.charCodeAt(0));
test('PNG dimensions are big endian and constrained before decoding',()=>{const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);b.set(ascii('IHDR'),12);const v=new DataView(b.buffer);v.setUint32(16,6000);v.setUint32(20,5000);assert.deepEqual(inspectHeader(b),{format:'png',width:6000,height:5000});assert.throws(()=>validateLimits(100,6000,5000));});
test('all six image signatures, excluded HEIC and SVG',()=>{
 assert.equal(inspectHeader(new Uint8Array([255,216,255,217])).format,'jpeg');
 const gif=ascii('GIF89a\x20\0\x10\0');assert.deepEqual(inspectHeader(gif),{format:'gif',width:32,height:16});
 const bmp=new Uint8Array(26);bmp.set(ascii('BM'));const d=new DataView(bmp.buffer);d.setUint32(14,40,true);d.setInt32(18,32,true);d.setInt32(22,-16,true);assert.deepEqual(inspectHeader(bmp),{format:'bmp',width:32,height:16});
 const webp=ascii('RIFF0000WEBP');assert.equal(inspectHeader(webp).format,'webp');
 const avif=new Uint8Array(24);avif.set(ascii('ftyp'),4);avif.set(ascii('avif'),8);new DataView(avif.buffer).setUint32(0,24);assert.equal(inspectHeader(avif).format,'avif');avif.set(ascii('heic'),8);assert.throws(()=>inspectHeader(avif));assert.throws(()=>inspectHeader(ascii('<svg>')));
});
test('limits include boundaries and reject invalid numbers',()=>{assert.doesNotThrow(()=>validateLimits(20*1024*1024,5000,5000));for(const args of [[0,1,1],[20*1024*1024+1,1,1],[1,8193,1],[1,5001,5000],[1,NaN,1],[1,0,1]])assert.throws(()=>validateLimits(...args));});
test('original transparency multiplied by red mask channel; original untouched',()=>{const original=new Uint8ClampedArray([10,20,30,255,40,50,60,128,20,30,40,0]);const mask=new Uint8ClampedArray([255,255,255,255,128,128,128,255,255,255,255,255]);assert.deepEqual([...combineAlpha(original,mask)],[10,20,30,255,40,50,60,64,20,30,40,0]);assert.equal(original[7],128);});
test('mask minmax, uniform mask, invalid predictions',()=>{assert.deepEqual([...normalizeMask(new Float32Array([-2,0,2]))],[0,128,255]);assert.deepEqual([...normalizeMask(new Float32Array([0.25,0.25]))],[64,64]);assert.throws(()=>normalizeMask(new Float32Array([NaN])));});
test('download name preserves unicode and multiple dots',()=>{assert.equal(outputFilename('가족.photo.JPEG'),'가족.photo-no-bg.png');assert.equal(outputFilename('image'),'image-no-bg.png');});
test('AVIF spatial extents found inside meta/iprp/ipco before native decode',()=>{
 const box=(type,payload)=>{const b=new Uint8Array(8+payload.length);new DataView(b.buffer).setUint32(0,b.length);b.set(ascii(type),4);b.set(payload,8);return b;};
 const ftyp=box('ftyp',ascii('avif0000'));const ispeData=new Uint8Array(12);new DataView(ispeData.buffer).setUint32(4,10000);new DataView(ispeData.buffer).setUint32(8,9000);const prop=box('iprp',box('ipco',box('ispe',ispeData)));const metaData=new Uint8Array(4+prop.length);metaData.set(prop,4);const meta=box('meta',metaData);const file=new Uint8Array(ftyp.length+meta.length);file.set(ftyp);file.set(meta,ftyp.length);const info=inspectHeader(file);assert.deepEqual(info,{format:'avif',width:10000,height:9000});assert.throws(()=>validateLimits(file.length,info.width,info.height));
});
