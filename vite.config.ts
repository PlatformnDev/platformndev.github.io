import {defineConfig} from 'vite';
import {createReadStream,existsSync} from 'node:fs';
import {resolve} from 'node:path';
function getSiteVariant(){
 if(process.env.SITE_VARIANT==='light')return 'light';
 return 'standard';
}
function getPublicDirectory(variant:string){
 if(variant==='light')return 'public-light';
 return 'public';
}
function getAppName(variant:string){
 if(variant==='light')return '이미지 배경 제거 (Light)';
 return '이미지 배경 제거';
}
function getModelNotice(variant:string){
 if(variant==='light')return '처음 사용할 때 Light 모델 약 44MB와 실행 리소스가 필요해 최대 약 65MB를 내려받을 수 있습니다. 브라우저 캐시 상태에 따라 다시 내려받을 수 있습니다.';
 return '처음 사용할 때 모델 약 176MB와 실행 리소스가 필요해 최대 약 200MB를 내려받을 수 있습니다. 브라우저 캐시 상태에 따라 다시 내려받을 수 있습니다.';
}
const siteVariant=getSiteVariant();
export default defineConfig({
 publicDir:getPublicDirectory(siteVariant),
 base:process.env.SITE_BASE_PATH||'/',
 build:{target:'es2022'},worker:{format:'es'},
 define:{'import.meta.env.VITE_SITE_VARIANT':JSON.stringify(siteVariant)},
 plugins:[{name:'site-variant',transformIndexHtml(html){return html.replaceAll('%APP_NAME%',getAppName(siteVariant)).replaceAll('%MODEL_NOTICE%',getModelNotice(siteVariant));}},{name:'static-csp',apply:'build',transformIndexHtml(){return[{tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; style-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"},injectTo:'head-prepend'}];}},{name:'serve-onnx-native-modules',configureServer(server){
  // ORT imports its own ESM loader dynamically. Serve these vendored modules
  // unchanged in development, matching the production static host.
  server.middlewares.use((req,res,next)=>{
   const pathname=(req.url??'').split('?')[0];
   if(!/^\/ort\/[a-zA-Z0-9.-]+\.(mjs|wasm)$/.test(pathname))return next();
   const file=resolve('public','.'+pathname);if(!existsSync(file))return next();
   res.setHeader('Content-Type',pathname.endsWith('.wasm')?'application/wasm':'text/javascript');createReadStream(file).pipe(res);
  });
 }}]
});
