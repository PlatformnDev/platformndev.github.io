export interface Manifest{revision:string;bytes:number;sha256:string;chunks:{file:string;bytes:number;sha256:string}[]}
const digest=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
function getModelVariant(){
 if(import.meta.env.VITE_SITE_VARIANT==='light')return 'light';
 return 'standard';
}
function shouldDeleteCache(name:string,prefix:string,cacheName:string,variant:string){
 if(!name.startsWith(prefix))return false;
 if(name===cacheName)return false;
 if(variant==='standard'&&name.startsWith('clearcut-model-light-'))return false;
 return true;
}
export async function loadModel(progress:(done:number,total:number)=>void){
 let manifest:Manifest;
 try{const r=await fetch(import.meta.env.BASE_URL+'models/manifest.json');if(!r.ok)throw Error();manifest=await r.json();}catch{throw Error('MODEL_DOWNLOAD');}
 let cache:Cache|undefined;const variant=getModelVariant();let cacheName='clearcut-model-'+manifest.revision;let cachePrefix='clearcut-model-';
 if(variant==='light'){cachePrefix='clearcut-model-light-';cacheName=cachePrefix+manifest.revision;}
 try{cache=await caches.open(cacheName);const names=await caches.keys();await Promise.all(names.filter(n=>shouldDeleteCache(n,cachePrefix,cacheName,variant)).map(n=>caches.delete(n)));}catch{/* Cache is optional; never stores user data. */}
 const model=new Uint8Array(manifest.bytes);let offset=0;progress(0,manifest.bytes);
 for(const part of manifest.chunks){
 const url=import.meta.env.BASE_URL+'models/'+manifest.revision+'/'+part.file;let b:ArrayBuffer|undefined;
 try{const hit=await cache?.match(url);if(hit){const candidate=await hit.arrayBuffer();if(candidate.byteLength===part.bytes&&await digest(candidate)===part.sha256)b=candidate;else await cache?.delete(url);}}catch{}
 if(!b){try{const r=await fetch(url);if(!r.ok)throw Error();b=await r.arrayBuffer();if(b.byteLength!==part.bytes||await digest(b)!==part.sha256)throw Error();}catch{throw Error('MODEL_DOWNLOAD');}try{await cache?.put(url,new Response(b));}catch{}}
 model.set(new Uint8Array(b),offset);offset+=b.byteLength;progress(offset,manifest.bytes);
 }
 if(offset!==manifest.bytes||await digest(model.buffer)!==manifest.sha256)throw Error('MODEL_DOWNLOAD');
 return model;
}
